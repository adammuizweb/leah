package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/adammuiz/leah/internal/models"
)

type Repository struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListTickets(ctx context.Context) ([]models.Ticket, error) {
	rows, err := r.db.Query(ctx, "SELECT id, title, description, status, priority, assigned_to, created_by, created_at, updated_at FROM tickets ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tickets := make([]models.Ticket, 0)
	for rows.Next() {
		var t models.Ticket
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.AssignedTo, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tickets = append(tickets, t)
	}
	return tickets, nil
}

func (r *Repository) CreateTicket(ctx context.Context, t *models.Ticket) error {
	return r.db.QueryRow(ctx,
		"INSERT INTO tickets (title, description, status, priority, assigned_to, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at",
		t.Title, t.Description, t.Status, t.Priority, t.AssignedTo, t.CreatedBy,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *Repository) GetTicket(ctx context.Context, id int64) (*models.Ticket, error) {
	t := &models.Ticket{}
	err := r.db.QueryRow(ctx,
		"SELECT id, title, description, status, priority, assigned_to, created_by, created_at, updated_at FROM tickets WHERE id = $1", id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.AssignedTo, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *Repository) UpdateTicket(ctx context.Context, t *models.Ticket) error {
	tag, err := r.db.Exec(ctx,
		"UPDATE tickets SET title=$1, description=$2, status=$3, priority=$4, assigned_to=$5, updated_at=NOW() WHERE id=$6",
		t.Title, t.Description, t.Status, t.Priority, t.AssignedTo, t.ID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ticket not found")
	}
	return err
}

func (r *Repository) DeleteTicket(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, "DELETE FROM tickets WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ticket not found")
	}
	return nil
}

func (r *Repository) ListAssets(ctx context.Context) ([]models.Asset, error) {
	rows, err := r.db.Query(ctx, "SELECT id, name, type, serial, status, location, assigned_to, created_at, updated_at FROM assets ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]models.Asset, 0)
	for rows.Next() {
		var a models.Asset
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.Serial, &a.Status, &a.Location, &a.AssignedTo, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, nil
}

func (r *Repository) CreateAsset(ctx context.Context, a *models.Asset) error {
	return r.db.QueryRow(ctx,
		"INSERT INTO assets (name, type, serial, status, location, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at",
		a.Name, a.Type, a.Serial, a.Status, a.Location, a.AssignedTo,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *Repository) GetAsset(ctx context.Context, id int64) (*models.Asset, error) {
	a := &models.Asset{}
	err := r.db.QueryRow(ctx,
		"SELECT id, name, type, serial, status, location, assigned_to, created_at, updated_at FROM assets WHERE id = $1", id,
	).Scan(&a.ID, &a.Name, &a.Type, &a.Serial, &a.Status, &a.Location, &a.AssignedTo, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (r *Repository) UpdateAsset(ctx context.Context, a *models.Asset) error {
	tag, err := r.db.Exec(ctx,
		"UPDATE assets SET name=$1, type=$2, serial=$3, status=$4, location=$5, assigned_to=$6, updated_at=NOW() WHERE id=$7",
		a.Name, a.Type, a.Serial, a.Status, a.Location, a.AssignedTo, a.ID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("asset not found")
	}
	return nil
}

func (r *Repository) DeleteAsset(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, "DELETE FROM assets WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("asset not found")
	}
	return nil
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	u := &models.User{}
	err := r.db.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.password_hash, u.role_id, COALESCE(r.name, '') as role, u.created_at
		 FROM users u
		 LEFT JOIN roles r ON r.id = u.role_id
		 WHERE u.email = $1`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.RoleID, &u.Role, &u.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}
	return u, nil
}

func (r *Repository) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	u := &models.User{}
	err := r.db.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.password_hash, u.role_id, COALESCE(r.name, '') as role, u.created_at
		 FROM users u
		 LEFT JOIN roles r ON r.id = u.role_id
		 WHERE u.id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.RoleID, &u.Role, &u.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}
	return u, nil
}

func (r *Repository) GetUserPermissions(ctx context.Context, userID int64) ([]models.Permission, error) {
	rows, err := r.db.Query(ctx,
		`SELECT p.id, p.name, p.module, p.action
		 FROM permissions p
		 JOIN role_permissions rp ON rp.permission_id = p.id
		 JOIN users u ON u.role_id = rp.role_id
		 WHERE u.id = $1`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	perms := make([]models.Permission, 0)
	for rows.Next() {
		var p models.Permission
		if err := rows.Scan(&p.ID, &p.Name, &p.Module, &p.Action); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, nil
}
