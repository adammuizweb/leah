package services

import (
	"context"
	"fmt"
	"time"

	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type Service struct{ repo *repository.Repository }

func New(repo *repository.Repository) *Service { return &Service{repo: repo} }

// Valid status transitions map
var validTransitions = map[string][]string{
	"new":         {"open", "cancelled"},
	"open":        {"in_progress", "cancelled"},
	"in_progress": {"pending", "resolved"},
	"pending":     {"in_progress", "cancelled"},
	"resolved":    {"closed", "in_progress"},
	"closed":      {"in_progress"},
	"cancelled":   {},
}

func isValidTransition(from, to string) bool {
	allowed, ok := validTransitions[from]
	if !ok { return false }
	for _, a := range allowed {
		if a == to { return true }
	}
	return false
}

func (s *Service) ListTickets(ctx context.Context, f repository.TicketFilter) (*repository.PaginatedResult[models.Ticket], error) {
	return s.repo.ListTickets(ctx, f)
}
func (s *Service) ListMyTickets(ctx context.Context, f repository.TicketFilter, userID int64) (*repository.PaginatedResult[models.Ticket], error) {
	f.CreatedBy = &userID
	return s.repo.ListTickets(ctx, f)
}

func (s *Service) CreateTicket(ctx context.Context, t *models.Ticket) error {
	if t.Status == "" {
		t.Status = "new"
	}
	if t.Priority == "" {
		t.Priority = "medium"
	}
	// Auto-assign SLA based on priority
	now := time.Now()
	sla, err := s.repo.GetSLAPolicyByPriority(ctx, t.Priority)
	if err == nil {
		t.SLAPolicyID = &sla.ID
		respAt := now.Add(time.Duration(sla.ResponseHours) * time.Hour)
		resvAt := now.Add(time.Duration(sla.ResolveHours) * time.Hour)
		t.SLAResponseAt = &respAt
		t.SLAResolveAt = &resvAt
	}
	return s.repo.CreateTicket(ctx, t)
}

func (s *Service) GetTicket(ctx context.Context, id int64) (*models.Ticket, error) {
	return s.repo.GetTicket(ctx, id)
}

func (s *Service) UpdateTicket(ctx context.Context, t *models.Ticket, userID int64) error {
	// If status is changing, validate transition
	existing, err := s.repo.GetTicket(ctx, t.ID)
	if err != nil {
		return err
	}
	if existing.Status != t.Status {
		if !isValidTransition(existing.Status, t.Status) {
			return fmt.Errorf("invalid status transition: %s → %s", existing.Status, t.Status)
		}
		// Create status history
		from := existing.Status
		h := &models.TicketStatusHistory{
			TicketID:   t.ID,
			FromStatus: &from,
			ToStatus:   t.Status,
			ChangedBy:  userID,
		}
		if err := s.repo.CreateStatusHistory(ctx, h); err != nil {
			return err
		}
	}
	return s.repo.UpdateTicket(ctx, t, userID)
}

func (s *Service) UpdateTicketStatus(ctx context.Context, ticketID int64, newStatus string, userID int64, note *string) error {
	existing, err := s.repo.GetTicket(ctx, ticketID)
	if err != nil {
		return err
	}
	if !isValidTransition(existing.Status, newStatus) {
		return fmt.Errorf("invalid status transition: %s → %s", existing.Status, newStatus)
	}
	// Create status history
	from := existing.Status
	h := &models.TicketStatusHistory{
		TicketID:   ticketID,
		FromStatus: &from,
		ToStatus:   newStatus,
		ChangedBy:  userID,
		Note:       note,
	}
	if err := s.repo.CreateStatusHistory(ctx, h); err != nil {
		return err
	}
	return s.repo.UpdateTicketStatus(ctx, ticketID, newStatus, userID, note)
}

func (s *Service) DeleteTicket(ctx context.Context, id, userID int64) error {
	return s.repo.DeleteTicket(ctx, id, userID)
}

func (s *Service) GetStatusHistory(ctx context.Context, ticketID int64) ([]models.TicketStatusHistory, error) {
	return s.repo.ListStatusHistory(ctx, ticketID)
}

// ─── Ticket Types ───────────────────────────────────────────────

func (s *Service) ListTicketTypes(ctx context.Context) ([]models.TicketType, error)     { return s.repo.ListTicketTypes(ctx) }
func (s *Service) CreateTicketType(ctx context.Context, t *models.TicketType) error     { return s.repo.CreateTicketType(ctx, t) }
func (s *Service) UpdateTicketType(ctx context.Context, t *models.TicketType) error     { return s.repo.UpdateTicketType(ctx, t) }
func (s *Service) DeleteTicketType(ctx context.Context, id int64) error                 { return s.repo.DeleteTicketType(ctx, id) }

// ─── Ticket Comments ────────────────────────────────────────────

func (s *Service) ListTicketComments(ctx context.Context, ticketID int64, includeInternal bool) ([]models.TicketComment, error) {
	return s.repo.ListTicketComments(ctx, ticketID, includeInternal)
}
func (s *Service) CreateTicketComment(ctx context.Context, c *models.TicketComment) error { return s.repo.CreateTicketComment(ctx, c) }
func (s *Service) DeleteTicketComment(ctx context.Context, id int64) error               { return s.repo.DeleteTicketComment(ctx, id) }

// ─── SLA Policies ───────────────────────────────────────────────

func (s *Service) ListSLAPolicies(ctx context.Context) ([]models.SLAPolicy, error)     { return s.repo.ListSLAPolicies(ctx) }
func (s *Service) CreateSLAPolicy(ctx context.Context, p *models.SLAPolicy) error      { return s.repo.CreateSLAPolicy(ctx, p) }
func (s *Service) UpdateSLAPolicy(ctx context.Context, p *models.SLAPolicy) error      { return s.repo.UpdateSLAPolicy(ctx, p) }
func (s *Service) DeleteSLAPolicy(ctx context.Context, id int64) error                 { return s.repo.DeleteSLAPolicy(ctx, id) }

func (s *Service) ListAssets(ctx context.Context, f repository.AssetFilter) (*repository.PaginatedResult[models.Asset], error) {
	return s.repo.ListAssets(ctx, f)
}
func (s *Service) ListMyAssets(ctx context.Context, f repository.AssetFilter, userID int64) (*repository.PaginatedResult[models.Asset], error) {
	f.AssignedTo = &userID
	return s.repo.ListAssets(ctx, f)
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

func (s *Service) ListUsers(ctx context.Context, orgID, holdingID *int64) ([]models.User, error)       { return s.repo.ListUsers(ctx, orgID, holdingID) }
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
func (s *Service) GetUserOrganizationIDs(ctx context.Context, uid int64) ([]int64, error) { return s.repo.GetUserOrganizationIDs(ctx, uid) }
func (s *Service) GetUserOrganizationsWithDetails(ctx context.Context, uid int64) ([]models.UserOrgDetail, error) { return s.repo.GetUserOrganizationsWithDetails(ctx, uid) }
func (s *Service) UpdateUserProfile(ctx context.Context, id int64, name string, avatarURL *string) error { return s.repo.UpdateUserProfile(ctx, id, name, avatarURL) }
func (s *Service) SetUserOrganizations(ctx context.Context, uid int64, orgIDs []int64) error { return s.repo.SetUserOrganizations(ctx, uid, orgIDs) }

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
func (s *Service) ListAssetModels(ctx context.Context) ([]models.AssetModel, error)     { return s.repo.ListAssetModels(ctx) }
func (s *Service) GetAssetModel(ctx context.Context, id int64) (*models.AssetModel, error) { return s.repo.GetAssetModel(ctx, id) }
func (s *Service) CreateAssetModel(ctx context.Context, m *models.AssetModel) error     { return s.repo.CreateAssetModel(ctx, m) }
func (s *Service) UpdateAssetModel(ctx context.Context, m *models.AssetModel) error     { return s.repo.UpdateAssetModel(ctx, m) }
func (s *Service) DeleteAssetModel(ctx context.Context, id int64) error                 { return s.repo.DeleteAssetModel(ctx, id) }
func (s *Service) BulkCreateAssets(ctx context.Context, assets []models.Asset) ([]models.Asset, error) {
	return s.repo.BulkCreateAssets(ctx, assets)
}

func (s *Service) ListHoldings(ctx context.Context) ([]models.Holding, error)                 { return s.repo.ListHoldings(ctx) }
func (s *Service) CreateHolding(ctx context.Context, h *models.Holding) error                 { return s.repo.CreateHolding(ctx, h) }
func (s *Service) GetOrganization(ctx context.Context, id int64) (*models.Organization, error)  { return s.repo.GetOrganization(ctx, id) }
func (s *Service) CreateOrganization(ctx context.Context, o *models.Organization) error         { return s.repo.CreateOrganization(ctx, o) }
func (s *Service) ListOrganizations(ctx context.Context) ([]models.Organization, error)        { return s.repo.ListOrganizations(ctx) }
