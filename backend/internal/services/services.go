package services

import (
	"context"

	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type Service struct{ repo *repository.Repository }

func New(repo *repository.Repository) *Service { return &Service{repo: repo} }

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
func (s *Service) UpdateTicket(ctx context.Context, t *models.Ticket, userID int64) error {
	return s.repo.UpdateTicket(ctx, t, userID)
}
func (s *Service) DeleteTicket(ctx context.Context, id, userID int64) error {
	return s.repo.DeleteTicket(ctx, id, userID)
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
func (s *Service) UpdateAsset(ctx context.Context, a *models.Asset, userID int64) error {
	return s.repo.UpdateAsset(ctx, a, userID)
}
func (s *Service) DeleteAsset(ctx context.Context, id, userID int64) error {
	return s.repo.DeleteAsset(ctx, id, userID)
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

func (s *Service) ListUsers(ctx context.Context) ([]models.User, error)       { return s.repo.ListUsers(ctx) }
func (s *Service) CreateUser(ctx context.Context, u *models.User, password string) error {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(h)
	return s.repo.CreateUser(ctx, u)
}
func (s *Service) UpdateUser(ctx context.Context, u *models.User) error     { return s.repo.UpdateUser(ctx, u) }
func (s *Service) UpdatePassword(ctx context.Context, id int64, pass string) error {
	h, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.repo.UpdateUserPassword(ctx, id, string(h))
}
func (s *Service) SoftDeleteUser(ctx context.Context, id int64) error       { return s.repo.SoftDeleteUser(ctx, id) }

func (s *Service) ListRoles(ctx context.Context) ([]models.Role, error)     { return s.repo.ListRoles(ctx) }
func (s *Service) CreateRole(ctx context.Context, r *models.Role) error     { return s.repo.CreateRole(ctx, r) }
func (s *Service) UpdateRole(ctx context.Context, r *models.Role) error     { return s.repo.UpdateRole(ctx, r) }
func (s *Service) DeleteRole(ctx context.Context, id int64) error           { return s.repo.DeleteRole(ctx, id) }
func (s *Service) GetRolePermissions(ctx context.Context, roleID int64) ([]models.Permission, error) {
	return s.repo.GetRolePermissions(ctx, roleID)
}
func (s *Service) SetRolePermissions(ctx context.Context, roleID int64, permIDs []int64) error {
	return s.repo.SetRolePermissions(ctx, roleID, permIDs)
}
func (s *Service) ListAllPermissions(ctx context.Context) ([]models.Permission, error) {
	return s.repo.ListAllPermissions(ctx)
}

func (s *Service) ListBin(ctx context.Context) ([]repository.BinItem, error)       { return s.repo.ListBin(ctx) }
func (s *Service) RestoreItem(ctx context.Context, typ string, id int64) error      { return s.repo.RestoreItem(ctx, typ, id) }
func (s *Service) PermanentlyDelete(ctx context.Context, typ string, id int64) error { return s.repo.PermanentlyDelete(ctx, typ, id) }
func (s *Service) ListAssetTypes(ctx context.Context) ([]models.AssetType, error)     { return s.repo.ListAssetTypes(ctx) }
func (s *Service) CreateAssetType(ctx context.Context, t *models.AssetType) error     { return s.repo.CreateAssetType(ctx, t) }
func (s *Service) UpdateAssetType(ctx context.Context, t *models.AssetType) error     { return s.repo.UpdateAssetType(ctx, t) }
func (s *Service) DeleteAssetType(ctx context.Context, id int64) error                { return s.repo.DeleteAssetType(ctx, id) }
func (s *Service) ListAssetCategories(ctx context.Context) ([]models.AssetCategory, error) { return s.repo.ListAssetCategories(ctx) }
func (s *Service) CreateAssetCategory(ctx context.Context, c *models.AssetCategory) error   { return s.repo.CreateAssetCategory(ctx, c) }
func (s *Service) UpdateAssetCategory(ctx context.Context, c *models.AssetCategory) error      { return s.repo.UpdateAssetCategory(ctx, c) }
func (s *Service) DeleteAssetCategory(ctx context.Context, id int64) error                    { return s.repo.DeleteAssetCategory(ctx, id) }
