package repository

import (
	"context"
	"fmt"

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
