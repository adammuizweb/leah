package main

import (
	"context"
	"fmt"
	"log"
	"net/mail"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("backend/.env")
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_OWNER_URL"))
	email := strings.ToLower(strings.TrimSpace(os.Getenv("ROOT_EMAIL")))
	password := os.Getenv("ROOT_PASSWORD")
	if databaseURL == "" {
		log.Fatal("DATABASE_OWNER_URL is required")
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || len(email) > 255 {
		log.Fatal("ROOT_EMAIL must be a valid email address")
	}
	if len(password) < 16 {
		log.Fatal("ROOT_PASSWORD must contain at least 16 characters")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		log.Fatal(err)
	}
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	tx, err := pool.Begin(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	var roleID int64
	if err := tx.QueryRow(context.Background(), `SELECT id FROM roles WHERE name='superadmin'`).Scan(&roleID); err != nil {
		log.Fatal("superadmin role is missing; apply schema migrations first")
	}

	var rootID int64
	err = tx.QueryRow(context.Background(), `SELECT id FROM users WHERE is_root=TRUE FOR UPDATE`).Scan(&rootID)
	if err == pgx.ErrNoRows {
		err = tx.QueryRow(context.Background(), `
			INSERT INTO users (email, name, password_hash, role_id, is_root)
			VALUES ($1, 'Root', $2, $3, TRUE)
			RETURNING id
		`, email, string(hash), roleID).Scan(&rootID)
	} else if err == nil {
		_, err = tx.Exec(context.Background(), `
			UPDATE users
			SET email=$1, name='Root', password_hash=$2, role_id=$3,
			    is_root=TRUE, deleted_at=NULL, locked_until=NULL
			WHERE id=$4
		`, email, string(hash), roleID, rootID)
	}
	if err != nil {
		log.Fatal(err)
	}
	if err := tx.Commit(context.Background()); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Root account %s is ready\n", email)
}
