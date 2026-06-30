package services

import (
	"context"

	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/repository"
)

type Service struct {
	repo *repository.Repository
}

func New(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListTickets(ctx context.Context) ([]models.Ticket, error) {
	return s.repo.ListTickets(ctx)
}

func (s *Service) CreateTicket(ctx context.Context, t *models.Ticket) error {
	if t.Status == "" {
		t.Status = "open"
	}
	if t.Priority == "" {
		t.Priority = "medium"
	}
	return s.repo.CreateTicket(ctx, t)
}

func (s *Service) GetTicket(ctx context.Context, id int64) (*models.Ticket, error) {
	return s.repo.GetTicket(ctx, id)
}

func (s *Service) UpdateTicket(ctx context.Context, t *models.Ticket) error {
	return s.repo.UpdateTicket(ctx, t)
}

func (s *Service) DeleteTicket(ctx context.Context, id int64) error {
	return s.repo.DeleteTicket(ctx, id)
}

func (s *Service) ListAssets(ctx context.Context) ([]models.Asset, error) {
	return s.repo.ListAssets(ctx)
}

func (s *Service) CreateAsset(ctx context.Context, a *models.Asset) error {
	if a.Status == "" {
		a.Status = "active"
	}
	return s.repo.CreateAsset(ctx, a)
}

func (s *Service) GetAsset(ctx context.Context, id int64) (*models.Asset, error) {
	return s.repo.GetAsset(ctx, id)
}

func (s *Service) UpdateAsset(ctx context.Context, a *models.Asset) error {
	return s.repo.UpdateAsset(ctx, a)
}

func (s *Service) DeleteAsset(ctx context.Context, id int64) error {
	return s.repo.DeleteAsset(ctx, id)
}

func (s *Service) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	return s.repo.GetUserByEmail(ctx, email)
}

func (s *Service) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	return s.repo.GetUserByID(ctx, id)
}

func (s *Service) GetUserPermissions(ctx context.Context, userID int64) ([]models.Permission, error) {
	return s.repo.GetUserPermissions(ctx, userID)
}
