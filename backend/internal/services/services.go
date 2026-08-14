package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

const PasswordHashCost = 12
const MinPasswordLength = 12

var ErrInvalidRequest = errors.New("invalid request")

func ValidatePassword(password string) error {
	if len(password) < MinPasswordLength {
		return fmt.Errorf("password must contain at least %d characters", MinPasswordLength)
	}
	return nil
}

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
	if !ok {
		return false
	}
	for _, a := range allowed {
		if a == to {
			return true
		}
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
	if err := prepareNewRequest(t); err != nil {
		return err
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

func prepareNewRequest(t *models.Ticket) error {
	t.Status = "new"
	if t.Priority == "" {
		t.Priority = "medium"
	}
	if t.RequestKind == "" {
		t.RequestKind = "incident"
	}
	if err := validateRequest(t); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidRequest, err)
	}
	if err := validatePriority(t.Priority); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidRequest, err)
	}
	if t.RequestKind == "software" {
		t.ApprovalStatus = "pending"
	} else {
		t.ApprovalStatus = "not_required"
	}
	return nil
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
	if t.OrganizationID == nil {
		t.OrganizationID = existing.OrganizationID
	}
	if t.Status == "" {
		t.Status = existing.Status
	}
	t.RequestKind = existing.RequestKind
	t.ApprovalStatus = existing.ApprovalStatus
	t.SoftwareName = existing.SoftwareName
	t.BusinessObjective = existing.BusinessObjective
	t.TargetUsers = existing.TargetUsers
	t.DesiredDueDate = existing.DesiredDueDate
	t.ApprovedBy = existing.ApprovedBy
	t.ApprovedAt = existing.ApprovedAt
	t.ApprovalNote = existing.ApprovalNote
	if err := validateRequest(t); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidRequest, err)
	}
	if err := validatePriority(t.Priority); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidRequest, err)
	}
	if existing.Status != t.Status {
		return fmt.Errorf("%w: use the status endpoint to change request status", ErrInvalidRequest)
	}
	return s.repo.UpdateTicket(ctx, t, userID)
}

func (s *Service) UpdateTicketStatus(ctx context.Context, ticketID int64, newStatus string, userID int64, note *string) error {
	existing, err := s.repo.GetTicket(ctx, ticketID)
	if err != nil {
		return err
	}
	if err := validateRequestStatusChange(existing, newStatus); err != nil {
		return err
	}
	if !isValidTransition(existing.Status, newStatus) {
		return fmt.Errorf("invalid status transition: %s → %s", existing.Status, newStatus)
	}
	return s.repo.UpdateTicketStatus(ctx, ticketID, existing.Status, newStatus, userID, note)
}

func (s *Service) DeleteTicket(ctx context.Context, id, userID int64) error {
	return s.repo.DeleteTicket(ctx, id, userID)
}

func (s *Service) UpdateRequestApproval(ctx context.Context, ticketID int64, status string, actorID int64, note string) (*models.Ticket, error) {
	if status != "approved" && status != "rejected" {
		return nil, fmt.Errorf("%w: approval status must be approved or rejected", ErrInvalidRequest)
	}
	note = strings.TrimSpace(note)
	if status == "rejected" && note == "" {
		return nil, fmt.Errorf("%w: rejection note is required", ErrInvalidRequest)
	}
	if err := s.repo.UpdateRequestApproval(ctx, ticketID, status, actorID, note); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, ticketID)
}

func validateRequest(t *models.Ticket) error {
	t.Title = strings.TrimSpace(t.Title)
	t.Description = strings.TrimSpace(t.Description)
	t.SoftwareName = strings.TrimSpace(t.SoftwareName)
	t.BusinessObjective = strings.TrimSpace(t.BusinessObjective)
	t.TargetUsers = strings.TrimSpace(t.TargetUsers)
	if t.Title == "" {
		return fmt.Errorf("title is required")
	}
	switch t.RequestKind {
	case "incident", "service":
		return nil
	case "software":
		if t.SoftwareName == "" {
			return fmt.Errorf("software name is required")
		}
		if t.BusinessObjective == "" {
			return fmt.Errorf("business objective is required")
		}
		if t.TargetUsers == "" {
			return fmt.Errorf("target users are required")
		}
		return nil
	default:
		return fmt.Errorf("invalid request kind")
	}
}

func validatePriority(priority string) error {
	switch priority {
	case "low", "medium", "high", "critical":
		return nil
	default:
		return fmt.Errorf("invalid priority")
	}
}

func validateRequestStatusChange(ticket *models.Ticket, newStatus string) error {
	if ticket.RequestKind == "software" && ticket.ApprovalStatus != "approved" && newStatus != "cancelled" {
		return fmt.Errorf("software request must be approved before work can begin")
	}
	return nil
}

func (s *Service) GetStatusHistory(ctx context.Context, ticketID int64) ([]models.TicketStatusHistory, error) {
	return s.repo.ListStatusHistory(ctx, ticketID)
}

// ─── Ticket Types ───────────────────────────────────────────────

func (s *Service) ListTicketTypes(ctx context.Context) ([]models.TicketType, error) {
	return s.repo.ListTicketTypes(ctx)
}
func (s *Service) CreateTicketType(ctx context.Context, t *models.TicketType) error {
	return s.repo.CreateTicketType(ctx, t)
}
func (s *Service) UpdateTicketType(ctx context.Context, t *models.TicketType) error {
	return s.repo.UpdateTicketType(ctx, t)
}
func (s *Service) DeleteTicketType(ctx context.Context, id int64) error {
	return s.repo.DeleteTicketType(ctx, id)
}

// ─── Ticket Comments ────────────────────────────────────────────

func (s *Service) ListTicketComments(ctx context.Context, ticketID int64, includeInternal bool) ([]models.TicketComment, error) {
	return s.repo.ListTicketComments(ctx, ticketID, includeInternal)
}
func (s *Service) CreateTicketComment(ctx context.Context, c *models.TicketComment) error {
	return s.repo.CreateTicketComment(ctx, c)
}
func (s *Service) DeleteTicketComment(ctx context.Context, id int64) error {
	return s.repo.DeleteTicketComment(ctx, id)
}

// ─── SLA Policies ───────────────────────────────────────────────

func (s *Service) ListSLAPolicies(ctx context.Context) ([]models.SLAPolicy, error) {
	return s.repo.ListSLAPolicies(ctx)
}
func (s *Service) CreateSLAPolicy(ctx context.Context, p *models.SLAPolicy) error {
	return s.repo.CreateSLAPolicy(ctx, p)
}
func (s *Service) UpdateSLAPolicy(ctx context.Context, p *models.SLAPolicy) error {
	return s.repo.UpdateSLAPolicy(ctx, p)
}
func (s *Service) DeleteSLAPolicy(ctx context.Context, id int64) error {
	return s.repo.DeleteSLAPolicy(ctx, id)
}

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
	if a.OrganizationID == nil {
		existing, err := s.repo.GetAsset(ctx, a.ID)
		if err != nil {
			return err
		}
		a.OrganizationID = existing.OrganizationID
	}
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

func (s *Service) ListUsers(ctx context.Context, orgID, holdingID *int64) ([]models.User, error) {
	return s.repo.ListUsers(ctx, orgID, holdingID)
}
func (s *Service) UserInScope(ctx context.Context, userID int64) bool {
	return s.repo.UserInScope(ctx, userID)
}
func (s *Service) RoleHasSettingsAccess(ctx context.Context, roleID int64) (bool, error) {
	return s.repo.RoleHasSettingsAccess(ctx, roleID)
}
func (s *Service) CreateUser(ctx context.Context, u *models.User, password string, organizationIDs []int64) error {
	if err := ValidatePassword(password); err != nil {
		return err
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), PasswordHashCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(h)
	return s.repo.CreateUser(ctx, u, organizationIDs)
}
func (s *Service) UpdateUser(ctx context.Context, u *models.User, organizationIDs *[]int64) error {
	return s.repo.UpdateUser(ctx, u, organizationIDs)
}
func (s *Service) UpdatePassword(ctx context.Context, id int64, pass string) error {
	if err := ValidatePassword(pass); err != nil {
		return err
	}
	h, err := bcrypt.GenerateFromPassword([]byte(pass), PasswordHashCost)
	if err != nil {
		return err
	}
	return s.repo.UpdateUserPassword(ctx, id, string(h))
}

func (s *Service) UpgradePasswordHash(ctx context.Context, id int64, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), PasswordHashCost)
	if err != nil {
		return err
	}
	return s.repo.UpdateUserPassword(ctx, id, string(hash))
}
func (s *Service) SoftDeleteUser(ctx context.Context, id int64) error {
	return s.repo.SoftDeleteUser(ctx, id)
}
func (s *Service) GetUserOrganizationIDs(ctx context.Context, uid int64) ([]int64, error) {
	return s.repo.GetUserOrganizationIDs(ctx, uid)
}
func (s *Service) GetUserOrganizationsWithDetails(ctx context.Context, uid int64) ([]models.UserOrgDetail, error) {
	return s.repo.GetUserOrganizationsWithDetails(ctx, uid)
}
func (s *Service) UpdateUserProfile(ctx context.Context, id int64, name string, avatarURL *string) error {
	return s.repo.UpdateUserProfile(ctx, id, name, avatarURL)
}
func (s *Service) SetUserOrganizations(ctx context.Context, uid int64, orgIDs []int64) error {
	return s.repo.SetUserOrganizations(ctx, uid, orgIDs)
}

func (s *Service) ListRoles(ctx context.Context) ([]models.Role, error) { return s.repo.ListRoles(ctx) }
func (s *Service) CreateRole(ctx context.Context, r *models.Role) error {
	return s.repo.CreateRole(ctx, r)
}
func (s *Service) UpdateRole(ctx context.Context, r *models.Role) error {
	return s.repo.UpdateRole(ctx, r)
}
func (s *Service) DeleteRole(ctx context.Context, id int64) error { return s.repo.DeleteRole(ctx, id) }
func (s *Service) GetRolePermissions(ctx context.Context, roleID int64) ([]models.Permission, error) {
	return s.repo.GetRolePermissions(ctx, roleID)
}
func (s *Service) SetRolePermissions(ctx context.Context, roleID int64, permIDs []int64) error {
	return s.repo.SetRolePermissions(ctx, roleID, permIDs)
}
func (s *Service) ListAllPermissions(ctx context.Context) ([]models.Permission, error) {
	return s.repo.ListAllPermissions(ctx)
}

func (s *Service) ListBin(ctx context.Context) ([]repository.BinItem, error) {
	return s.repo.ListBin(ctx)
}
func (s *Service) RestoreItem(ctx context.Context, typ string, id int64) error {
	return s.repo.RestoreItem(ctx, typ, id)
}
func (s *Service) PermanentlyDelete(ctx context.Context, typ string, id int64) error {
	return s.repo.PermanentlyDelete(ctx, typ, id)
}
func (s *Service) ListAssetTypes(ctx context.Context) ([]models.AssetType, error) {
	return s.repo.ListAssetTypes(ctx)
}
func (s *Service) CreateAssetType(ctx context.Context, t *models.AssetType) error {
	return s.repo.CreateAssetType(ctx, t)
}
func (s *Service) UpdateAssetType(ctx context.Context, t *models.AssetType) error {
	return s.repo.UpdateAssetType(ctx, t)
}
func (s *Service) DeleteAssetType(ctx context.Context, id int64) error {
	return s.repo.DeleteAssetType(ctx, id)
}
func (s *Service) ListAssetCategories(ctx context.Context) ([]models.AssetCategory, error) {
	return s.repo.ListAssetCategories(ctx)
}
func (s *Service) CreateAssetCategory(ctx context.Context, c *models.AssetCategory) error {
	return s.repo.CreateAssetCategory(ctx, c)
}
func (s *Service) UpdateAssetCategory(ctx context.Context, c *models.AssetCategory) error {
	return s.repo.UpdateAssetCategory(ctx, c)
}
func (s *Service) DeleteAssetCategory(ctx context.Context, id int64) error {
	return s.repo.DeleteAssetCategory(ctx, id)
}
func (s *Service) ListAssetModels(ctx context.Context) ([]models.AssetModel, error) {
	return s.repo.ListAssetModels(ctx)
}
func (s *Service) GetAssetModel(ctx context.Context, id int64) (*models.AssetModel, error) {
	return s.repo.GetAssetModel(ctx, id)
}
func (s *Service) CreateAssetModel(ctx context.Context, m *models.AssetModel) error {
	return s.repo.CreateAssetModel(ctx, m)
}
func (s *Service) UpdateAssetModel(ctx context.Context, m *models.AssetModel) error {
	return s.repo.UpdateAssetModel(ctx, m)
}
func (s *Service) DeleteAssetModel(ctx context.Context, id int64) error {
	return s.repo.DeleteAssetModel(ctx, id)
}
func (s *Service) BulkCreateAssets(ctx context.Context, assets []models.Asset) ([]models.Asset, error) {
	return s.repo.BulkCreateAssets(ctx, assets)
}

func (s *Service) ListHoldings(ctx context.Context) ([]models.Holding, error) {
	return s.repo.ListHoldings(ctx)
}
func (s *Service) CreateHolding(ctx context.Context, h *models.Holding) error {
	return s.repo.CreateHolding(ctx, h)
}
func (s *Service) GetOrganization(ctx context.Context, id int64) (*models.Organization, error) {
	return s.repo.GetOrganization(ctx, id)
}
func (s *Service) CreateOrganization(ctx context.Context, o *models.Organization) error {
	return s.repo.CreateOrganization(ctx, o)
}
func (s *Service) ListOrganizations(ctx context.Context) ([]models.Organization, error) {
	return s.repo.ListOrganizations(ctx)
}
