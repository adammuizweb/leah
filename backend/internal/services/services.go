package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/adammuiz/leah/internal/middleware"
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

func (s *Service) LoadAuthorizationState(ctx context.Context, userID int64, membershipID *int64) (*middleware.AuthorizationState, error) {
	return s.repo.LoadAuthorizationState(ctx, userID, membershipID)
}

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
	f.ParticipantID = &userID
	return s.repo.ListTickets(ctx, f)
}

func (s *Service) CreateTicket(ctx context.Context, t *models.Ticket) error {
	if err := prepareNewRequest(t); err != nil {
		return err
	}
	if isRoot, _ := ctx.Value(middleware.CtxKeyIsRoot).(bool); !isRoot {
		activeMembershipID, _ := ctx.Value(middleware.CtxKeyMembershipID).(int64)
		if activeMembershipID < 1 {
			return fmt.Errorf("%w: active membership is required", ErrInvalidRequest)
		}
		if t.RequesterMembershipID != nil && *t.RequesterMembershipID != activeMembershipID {
			return fmt.Errorf("%w: requester membership does not match the active context", ErrInvalidRequest)
		}
		t.RequesterMembershipID = &activeMembershipID
		membership, err := s.repo.ResolveRequesterMembership(ctx, t.CreatedBy, t.RequesterMembershipID)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrInvalidRequest, err)
		}
		t.RequesterMembershipID = &membership.MembershipID
		t.OrganizationID = &membership.OrganizationID
	}
	if t.OrganizationID == nil {
		return fmt.Errorf("%w: organization is required", ErrInvalidRequest)
	}
	route, err := s.repo.ResolveRequestRoute(ctx, *t.OrganizationID)
	if err != nil || route.ITOrganizationID == nil {
		return fmt.Errorf("%w: this holding does not have an IT organization configured", ErrInvalidRequest)
	}
	if t.RequestKind != "support" {
		if !route.HasITReviewer {
			return fmt.Errorf("%w: the IT organization does not have an active reviewer configured", ErrInvalidRequest)
		}
		if route.DepartmentManagerID == nil {
			return fmt.Errorf("%w: this department does not have a manager configured", ErrInvalidRequest)
		}
		if route.ITManagerID == nil {
			return fmt.Errorf("%w: the IT organization does not have a manager configured", ErrInvalidRequest)
		}
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
		t.RequestKind = "support"
	}
	if t.RequestKind == "software" {
		if t.SoftwareRequestType != "new_app" && t.SoftwareRequestType != "feature_development" {
			return fmt.Errorf("%w: choose whether to create a new app or develop an existing app", ErrInvalidRequest)
		}
	} else {
		t.SoftwareRequestType = "unspecified"
	}
	if err := validateRequest(t); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidRequest, err)
	}
	if err := validatePriority(t.Priority); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidRequest, err)
	}
	if t.RequestKind == "software" || t.RequestKind == "technology_review" {
		t.ApprovalStatus = "pending_manager"
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
	} else if existing.OrganizationID == nil || *t.OrganizationID != *existing.OrganizationID {
		return fmt.Errorf("%w: request organization cannot be changed after submission", ErrInvalidRequest)
	}
	if t.Status == "" {
		t.Status = existing.Status
	}
	t.RequestKind = existing.RequestKind
	t.RequesterMembershipID = existing.RequesterMembershipID
	t.ApprovalStatus = existing.ApprovalStatus
	t.SoftwareName = existing.SoftwareName
	t.SoftwareRequestType = existing.SoftwareRequestType
	t.BusinessObjective = existing.BusinessObjective
	t.TargetUsers = existing.TargetUsers
	t.DesiredDueDate = existing.DesiredDueDate
	t.ApprovedBy = existing.ApprovedBy
	t.ApprovedAt = existing.ApprovedAt
	t.ApprovalNote = existing.ApprovalNote
	t.TechnologyName = existing.TechnologyName
	t.VendorName = existing.VendorName
	t.Specification = existing.Specification
	t.EstimatedCost = existing.EstimatedCost
	t.ManagerReviewedBy = existing.ManagerReviewedBy
	t.ManagerReviewedAt = existing.ManagerReviewedAt
	t.ManagerReviewNote = existing.ManagerReviewNote
	t.ITReviewedBy = existing.ITReviewedBy
	t.ITReviewedAt = existing.ITReviewedAt
	t.ITReviewNote = existing.ITReviewNote
	t.ITRecommendation = existing.ITRecommendation
	t.ITManagerRecommendation = existing.ITManagerRecommendation
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

func (s *Service) UpdateDepartmentManagerReview(ctx context.Context, ticketID, actorID int64, decision, note string) (*models.Ticket, error) {
	if decision != "approved" && decision != "rejected" {
		return nil, fmt.Errorf("%w: decision must be approved or rejected", ErrInvalidRequest)
	}
	note = strings.TrimSpace(note)
	if decision == "rejected" && note == "" {
		return nil, fmt.Errorf("%w: rejection note is required", ErrInvalidRequest)
	}
	if err := s.repo.UpdateDepartmentManagerReview(ctx, ticketID, actorID, decision, note); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, ticketID)
}

func (s *Service) UpdateITReview(ctx context.Context, ticketID, actorID int64, recommendation, note string) (*models.Ticket, error) {
	if recommendation != "recommended" && recommendation != "not_recommended" {
		return nil, fmt.Errorf("%w: IT recommendation is invalid", ErrInvalidRequest)
	}
	note = strings.TrimSpace(note)
	if note == "" {
		return nil, fmt.Errorf("%w: IT review note is required", ErrInvalidRequest)
	}
	if err := s.repo.UpdateITReview(ctx, ticketID, actorID, recommendation, note); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, ticketID)
}

func (s *Service) UpdateITManagerReview(ctx context.Context, ticketID, actorID int64, recommendation, note string) (*models.Ticket, error) {
	if recommendation != "recommended" && recommendation != "not_recommended" {
		return nil, fmt.Errorf("%w: IT manager recommendation is invalid", ErrInvalidRequest)
	}
	note = strings.TrimSpace(note)
	if recommendation == "not_recommended" && note == "" {
		return nil, fmt.Errorf("%w: a note is required when technology is not recommended", ErrInvalidRequest)
	}
	if err := s.repo.UpdateITManagerReview(ctx, ticketID, actorID, recommendation, note); err != nil {
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
	t.TechnologyName = strings.TrimSpace(t.TechnologyName)
	t.VendorName = strings.TrimSpace(t.VendorName)
	t.Specification = strings.TrimSpace(t.Specification)
	if t.Title == "" {
		return fmt.Errorf("title is required")
	}
	switch t.RequestKind {
	case "support":
		return nil
	case "software":
		if t.SoftwareName == "" {
			return fmt.Errorf("software name is required")
		}
		if t.SoftwareRequestType != "unspecified" && t.SoftwareRequestType != "new_app" && t.SoftwareRequestType != "feature_development" {
			return fmt.Errorf("invalid software request type")
		}
		if t.BusinessObjective == "" {
			return fmt.Errorf("business objective is required")
		}
		if t.TargetUsers == "" {
			return fmt.Errorf("target users are required")
		}
		return nil
	case "technology_review":
		if t.TechnologyName == "" {
			return fmt.Errorf("technology or vendor name is required")
		}
		if t.BusinessObjective == "" {
			return fmt.Errorf("business purpose is required")
		}
		if t.Specification == "" {
			return fmt.Errorf("product information or specification is required")
		}
		if t.EstimatedCost != nil && *t.EstimatedCost < 0 {
			return fmt.Errorf("estimated cost cannot be negative")
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
	if ticket.RequestKind != "support" && ticket.ApprovalStatus != "approved" && newStatus != "cancelled" {
		return fmt.Errorf("formal request must complete manager and IT review before work can begin")
	}
	return nil
}

func (s *Service) GetStatusHistory(ctx context.Context, ticketID int64) ([]models.TicketStatusHistory, error) {
	return s.repo.ListStatusHistory(ctx, ticketID)
}

func (s *Service) GetRequestWorkflowHistory(ctx context.Context, ticketID int64) ([]models.RequestWorkflowHistory, error) {
	return s.repo.ListRequestWorkflowHistory(ctx, ticketID)
}

func (s *Service) CanParticipateInRequest(ctx context.Context, ticketID, userID int64) bool {
	return s.repo.CanParticipateInRequest(ctx, ticketID, userID)
}

func (s *Service) DecorateRequestActions(ctx context.Context, ticket *models.Ticket, userID int64, canITReview bool) {
	if ticket.OrganizationID == nil {
		return
	}
	route, err := s.repo.ResolveRequestRoute(ctx, *ticket.OrganizationID)
	if err != nil {
		return
	}
	ticket.CanManagerReview = ticket.Status == "new" && ticket.ApprovalStatus == "pending_manager" && route.DepartmentManagerID != nil && *route.DepartmentManagerID == userID
	ticket.CanITReview = ticket.Status == "new" && ticket.ApprovalStatus == "pending_it_review" && canITReview && s.repo.CanITReviewRequest(ctx, ticket.ID, userID)
	ticket.CanITManagerReview = ticket.Status == "new" && ticket.ApprovalStatus == "pending_it_manager" && route.ITManagerID != nil && *route.ITManagerID == userID
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
func (s *Service) UserHasMembershipOutsideScope(ctx context.Context, userID int64) bool {
	return s.repo.UserHasMembershipOutsideScope(ctx, userID)
}
func (s *Service) UserHasSettingsMembership(ctx context.Context, userID int64) (bool, error) {
	return s.repo.UserHasSettingsMembership(ctx, userID)
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
func (s *Service) SetUserMemberships(ctx context.Context, userID int64, memberships []models.UserMembershipInput) error {
	if len(memberships) == 0 {
		return fmt.Errorf("at least one membership is required")
	}
	defaultCount := 0
	for i := range memberships {
		if memberships[i].RoleID == nil {
			return fmt.Errorf("membership role is required")
		}
		if memberships[i].IsDefault {
			defaultCount++
		}
		switch memberships[i].IdentityType {
		case "", "member", "employee", "lecturer", "student", "contractor", "service_account":
		default:
			return fmt.Errorf("invalid identity type")
		}
	}
	if defaultCount != 1 {
		return fmt.Errorf("exactly one default membership is required")
	}
	return s.repo.SetUserMemberships(ctx, userID, memberships)
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
func (s *Service) UpdateHoldingServiceProvider(ctx context.Context, holdingID int64, organizationID *int64) error {
	return s.repo.UpdateHoldingServiceProvider(ctx, holdingID, organizationID)
}
func (s *Service) GetOrganization(ctx context.Context, id int64) (*models.Organization, error) {
	return s.repo.GetOrganization(ctx, id)
}
func (s *Service) CreateOrganization(ctx context.Context, o *models.Organization) error {
	return s.repo.CreateOrganization(ctx, o)
}
func (s *Service) UpdateOrganizationManager(ctx context.Context, organizationID int64, managerUserID *int64) error {
	return s.repo.UpdateOrganizationManager(ctx, organizationID, managerUserID)
}
func (s *Service) ListOrganizations(ctx context.Context) ([]models.Organization, error) {
	return s.repo.ListOrganizations(ctx)
}
