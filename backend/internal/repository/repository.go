package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

// scopeOrgIDs returns all organization IDs this user can access,
// including descendants of their orgs. Returns nil for root (bypass).
func (r *Repository) scopeOrgIDs(ctx context.Context) []int64 {
	if isRoot, _ := ctx.Value(middleware.CtxKeyIsRoot).(bool); isRoot {
		return nil
	}
	orgIDs, _ := ctx.Value(middleware.CtxKeyOrgIDs).([]int64)
	orgPaths, _ := ctx.Value(middleware.CtxKeyOrgPaths).([]string)
	seen := make(map[int64]bool)
	var result []int64
	for _, id := range orgIDs {
		if !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	if len(orgPaths) > 0 {
		for _, path := range orgPaths {
			if path == "" {
				return []int64{-1}
			}
			rows, err := r.db.Query(ctx, `SELECT id FROM organizations WHERE path LIKE $1 || '%' AND id != ALL($2)`, path, orgIDs)
			if err != nil {
				return []int64{-1}
			}
			for rows.Next() {
				var id int64
				if err := rows.Scan(&id); err != nil {
					rows.Close()
					return []int64{-1}
				}
				if !seen[id] {
					seen[id] = true
					result = append(result, id)
				}
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				return []int64{-1}
			}
			rows.Close()
		}
	}
	if len(result) == 0 {
		return []int64{-1}
	}
	return result
}

func (r *Repository) organizationAllowed(ctx context.Context, organizationID *int64) bool {
	if isRoot, _ := ctx.Value(middleware.CtxKeyIsRoot).(bool); isRoot {
		return true
	}
	if organizationID == nil {
		return false
	}
	for _, id := range r.scopeOrgIDs(ctx) {
		if id == *organizationID {
			return true
		}
	}
	return false
}

func contextHasPermission(ctx context.Context, permission string) bool {
	if isRoot, _ := ctx.Value(middleware.CtxKeyIsRoot).(bool); isRoot {
		return true
	}
	if role, _ := ctx.Value(middleware.CtxKeyUserRole).(string); role == "admin" {
		return true
	}
	permissions, _ := ctx.Value(middleware.CtxKeyPermissions).([]string)
	for _, candidate := range permissions {
		if candidate == permission {
			return true
		}
	}
	return false
}

// ticketScopeOrgIDs extends scope only for ticket work routed to the configured
// IT organization. It must not be used by asset, user, or settings repositories.
func (r *Repository) ticketScopeOrgIDs(ctx context.Context) []int64 {
	base := r.scopeOrgIDs(ctx)
	if base == nil {
		return nil
	}
	userID, _ := ctx.Value(middleware.CtxKeyUserID).(int64)
	if userID < 1 {
		return base
	}
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT o.id
		FROM organizations o
		WHERE o.id=ANY($1)
		OR EXISTS (
			SELECT 1 FROM service_routes route
			JOIN organizations it_org ON it_org.id=route.provider_organization_id
			WHERE route.service_key='it_requests' AND route.consumer_holding_id=o.holding_id AND (
				(it_org.manager_user_id=$2 AND EXISTS (
					SELECT 1 FROM organizations active_org
					WHERE active_org.id=ANY($1) AND active_org.holding_id=it_org.holding_id
					AND active_org.path LIKE it_org.path || '%'
				))
				OR ($3 AND EXISTS (
					SELECT 1 FROM organizations member_org
					WHERE member_org.holding_id=it_org.holding_id
					AND member_org.path LIKE it_org.path || '%'
					AND member_org.id=ANY($1)
				))
			)
		)
	`, base, userID, contextHasPermission(ctx, "requests.it_review"))
	if err != nil {
		return base
	}
	defer rows.Close()
	result := make([]int64, 0, len(base))
	for rows.Next() {
		var organizationID int64
		if err := rows.Scan(&organizationID); err != nil {
			return base
		}
		result = append(result, organizationID)
	}
	if len(result) == 0 {
		return base
	}
	return result
}

func (r *Repository) scopedUserExists(ctx context.Context, userID int64) bool {
	if isRoot, _ := ctx.Value(middleware.CtxKeyIsRoot).(bool); isRoot {
		var exists bool
		err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND deleted_at IS NULL)`, userID).Scan(&exists)
		return err == nil && exists
	}
	orgIDs := r.scopeOrgIDs(ctx)
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM users u
			WHERE u.id=$1 AND u.deleted_at IS NULL AND (
				u.organization_id=ANY($2)
				OR EXISTS (SELECT 1 FROM user_organizations uo WHERE uo.user_id=u.id AND uo.organization_id=ANY($2) AND uo.is_active)
			)
		)
	`, userID, orgIDs).Scan(&exists)
	return err == nil && exists
}

func (r *Repository) userBelongsToOrganization(ctx context.Context, userID int64, organizationID *int64) bool {
	if organizationID == nil {
		return false
	}
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM users u
			WHERE u.id=$1 AND u.deleted_at IS NULL AND (
				u.organization_id=$2
				OR EXISTS (
					SELECT 1 FROM user_organizations uo
					WHERE uo.user_id=u.id AND uo.organization_id=$2 AND uo.is_active
				)
			)
		)
	`, userID, *organizationID).Scan(&exists)
	return err == nil && exists
}

func (r *Repository) UserInScope(ctx context.Context, userID int64) bool {
	return r.scopedUserExists(ctx, userID)
}

func (r *Repository) UserHasMembershipOutsideScope(ctx context.Context, userID int64) bool {
	if isRoot, _ := ctx.Value(middleware.CtxKeyIsRoot).(bool); isRoot {
		return false
	}
	var outside bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM user_organizations
			WHERE user_id=$1 AND is_active AND organization_id != ALL($2)
		)
	`, userID, r.scopeOrgIDs(ctx)).Scan(&outside)
	return err != nil || outside
}

func (r *Repository) UserHasSettingsMembership(ctx context.Context, userID int64) (bool, error) {
	var privileged bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM user_organizations membership
			JOIN roles role ON role.id=membership.role_id
			WHERE membership.user_id=$1 AND membership.is_active AND (
				role.name='superadmin'
				OR EXISTS (
					SELECT 1 FROM role_permissions rp
					JOIN permissions permission ON permission.id=rp.permission_id
					WHERE rp.role_id=membership.role_id AND permission.module='settings'
				)
			)
		)
	`, userID).Scan(&privileged)
	return privileged, err
}

func (r *Repository) validateOrganizationIDs(ctx context.Context, organizationIDs []int64) error {
	if isRoot, _ := ctx.Value(middleware.CtxKeyIsRoot).(bool); isRoot {
		return nil
	}
	if len(organizationIDs) == 0 {
		return fmt.Errorf("at least one organization is required")
	}
	allowed := make(map[int64]bool)
	for _, id := range r.scopeOrgIDs(ctx) {
		allowed[id] = true
	}
	for _, id := range organizationIDs {
		if !allowed[id] {
			return fmt.Errorf("organization is outside your scope")
		}
	}
	return nil
}

// ─── Tickets ────────────────────────────────────────────────────

const ticketCols = `id, title, description, status, priority, assigned_to, created_by, updated_by, deleted_by, asset_id, organization_id, requester_membership_id, type_id, sla_policy_id, sla_response_at, sla_resolve_at, closed_at, request_kind, approval_status, software_name, software_request_type, business_objective, target_users, desired_due_date, approved_by, approved_at, approval_note, technology_name, vendor_name, specification, estimated_cost, manager_reviewed_by, manager_reviewed_at, manager_review_note, it_reviewed_by, it_reviewed_at, it_review_note, it_recommendation, it_manager_recommendation, legacy_workflow, created_at, updated_at, COALESCE((SELECT name FROM users WHERE users.id=created_by),''), COALESCE((SELECT name FROM organizations WHERE organizations.id=organization_id),''), COALESCE((SELECT display_title FROM user_organizations WHERE user_organizations.id=requester_membership_id),''), COALESCE((SELECT identity_type FROM user_organizations WHERE user_organizations.id=requester_membership_id),''), COALESCE((SELECT name FROM users WHERE users.id=manager_reviewed_by),''), COALESCE((SELECT name FROM users WHERE users.id=it_reviewed_by),''), COALESCE((SELECT name FROM users WHERE users.id=approved_by),'')`

type TicketFilter struct {
	Search         string
	Status         string
	Priority       string
	TypeID         int64
	OrganizationID int64
	HoldingID      int64
	CreatedBy      *int64
	RequestKind    string
	ApprovalStatus string
	ParticipantID  *int64
	Page           int
	PerPage        int
}

type PaginatedResult[T any] struct {
	Data       []T `json:"data"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	TotalPages int `json:"total_pages"`
}

func (r *Repository) ListTickets(ctx context.Context, f TicketFilter) (*PaginatedResult[models.Ticket], error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PerPage < 1 {
		f.PerPage = 20
	}

	where := `WHERE t.deleted_at IS NULL`
	args := []any{}
	aidx := 1

	// Scope filter
	if orgIDs := r.ticketScopeOrgIDs(ctx); len(orgIDs) > 0 {
		where += fmt.Sprintf(` AND t.organization_id = ANY($%d)`, aidx)
		args = append(args, orgIDs)
		aidx++
	}

	if f.Search != "" {
		where += fmt.Sprintf(` AND (t.title ILIKE $%d OR t.description ILIKE $%d OR t.software_name ILIKE $%d OR t.business_objective ILIKE $%d OR t.target_users ILIKE $%d OR t.technology_name ILIKE $%d OR t.vendor_name ILIKE $%d OR t.specification ILIKE $%d)`, aidx, aidx, aidx, aidx, aidx, aidx, aidx, aidx)
		args = append(args, "%"+f.Search+"%")
		aidx++
	}
	if f.Status != "" {
		where += fmt.Sprintf(` AND t.status = $%d`, aidx)
		args = append(args, f.Status)
		aidx++
	}
	if f.Priority != "" {
		where += fmt.Sprintf(` AND t.priority = $%d`, aidx)
		args = append(args, f.Priority)
		aidx++
	}
	if f.TypeID > 0 {
		where += fmt.Sprintf(` AND t.type_id = $%d`, aidx)
		args = append(args, f.TypeID)
		aidx++
	}
	if f.OrganizationID > 0 {
		where += fmt.Sprintf(` AND t.organization_id = $%d`, aidx)
		args = append(args, f.OrganizationID)
		aidx++
	}
	if f.HoldingID > 0 {
		where += fmt.Sprintf(` AND t.organization_id IN (SELECT id FROM organizations WHERE holding_id = $%d)`, aidx)
		args = append(args, f.HoldingID)
		aidx++
	}
	if f.ParticipantID != nil {
		where += fmt.Sprintf(` AND (
			t.created_by = $%d
			OR (t.request_kind <> 'support' AND EXISTS (
				SELECT 1 FROM organizations request_org
				JOIN organizations managed_org ON request_org.path LIKE managed_org.path || '%%'
				JOIN users manager_user ON manager_user.id=managed_org.manager_user_id AND manager_user.deleted_at IS NULL
				WHERE request_org.id=t.organization_id AND managed_org.holding_id=request_org.holding_id
				AND managed_org.manager_user_id=$%d
				AND request_org.id=ANY($%d)
				AND managed_org.level=(
					SELECT MAX(candidate.level) FROM organizations candidate
					JOIN users active_manager ON active_manager.id=candidate.manager_user_id AND active_manager.deleted_at IS NULL
					WHERE candidate.holding_id=request_org.holding_id AND request_org.path LIKE candidate.path || '%%'
				)
			))
			OR EXISTS (
				SELECT 1 FROM organizations request_org
				JOIN service_routes route ON route.consumer_holding_id=request_org.holding_id AND route.service_key='it_requests'
				JOIN organizations it_org ON it_org.id=route.provider_organization_id
				WHERE request_org.id=t.organization_id AND it_org.manager_user_id=$%d
				AND EXISTS (
					SELECT 1 FROM organizations active_org
					WHERE active_org.id=ANY($%d) AND active_org.holding_id=it_org.holding_id
					AND active_org.path LIKE it_org.path || '%%'
				)
			)
			OR ($%d AND EXISTS (
				SELECT 1 FROM organizations request_org
				JOIN service_routes route ON route.consumer_holding_id=request_org.holding_id AND route.service_key='it_requests'
				JOIN organizations it_org ON it_org.id=route.provider_organization_id
				JOIN organizations member_org ON member_org.holding_id=it_org.holding_id AND member_org.path LIKE it_org.path || '%%'
				WHERE request_org.id=t.organization_id AND member_org.id=ANY($%d)
			))
		)`, aidx, aidx, aidx+2, aidx, aidx+2, aidx+1, aidx+2)
		args = append(args, *f.ParticipantID, contextHasPermission(ctx, "requests.it_review"), r.scopeOrgIDs(ctx))
		aidx += 3
	} else if f.CreatedBy != nil {
		where += fmt.Sprintf(` AND t.created_by = $%d`, aidx)
		args = append(args, *f.CreatedBy)
		aidx++
	}
	if f.RequestKind != "" {
		where += fmt.Sprintf(` AND t.request_kind = $%d`, aidx)
		args = append(args, f.RequestKind)
		aidx++
	}
	if f.ApprovalStatus != "" {
		where += fmt.Sprintf(` AND t.approval_status = $%d`, aidx)
		args = append(args, f.ApprovalStatus)
		aidx++
	}

	var total int
	countQuery := `SELECT COUNT(*) FROM tickets t ` + where
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	offset := (f.Page - 1) * f.PerPage
	dataQuery := `SELECT ` + ticketCols + ` FROM tickets t ` + where + ` ORDER BY t.created_at DESC LIMIT $` + fmt.Sprintf("%d", aidx) + ` OFFSET $` + fmt.Sprintf("%d", aidx+1)
	args = append(args, f.PerPage, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tickets := make([]models.Ticket, 0)
	for rows.Next() {
		var t models.Ticket
		if err := scanTicket(rows, &t); err != nil {
			return nil, err
		}
		tickets = append(tickets, t)
	}

	totalPages := (total + f.PerPage - 1) / f.PerPage
	return &PaginatedResult[models.Ticket]{Data: tickets, Total: total, Page: f.Page, PerPage: f.PerPage, TotalPages: totalPages}, nil
}

func (r *Repository) CreateTicket(ctx context.Context, t *models.Ticket) error {
	if t.SoftwareRequestType == "" {
		t.SoftwareRequestType = "unspecified"
	}
	if !r.organizationAllowed(ctx, t.OrganizationID) {
		return fmt.Errorf("organization is outside your scope")
	}
	if t.AssignedTo != nil && !r.userBelongsToOrganization(ctx, *t.AssignedTo, t.OrganizationID) {
		return fmt.Errorf("assignee is outside the ticket organization")
	}
	if t.AssetID != nil {
		asset, err := r.GetAsset(ctx, *t.AssetID)
		if err != nil || t.OrganizationID == nil || asset.OrganizationID == nil || *asset.OrganizationID != *t.OrganizationID {
			return fmt.Errorf("asset is outside the ticket organization")
		}
	}
	return r.db.QueryRow(ctx,
		`INSERT INTO tickets (title, description, status, priority, assigned_to, created_by, asset_id, organization_id, requester_membership_id, type_id, sla_policy_id, sla_response_at, sla_resolve_at, request_kind, approval_status, software_name, software_request_type, business_objective, target_users, desired_due_date, technology_name, vendor_name, specification, estimated_cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id, created_at, updated_at`,
		t.Title, t.Description, t.Status, t.Priority, t.AssignedTo, t.CreatedBy, t.AssetID, t.OrganizationID, t.RequesterMembershipID, t.TypeID, t.SLAPolicyID, t.SLAResponseAt, t.SLAResolveAt, t.RequestKind, t.ApprovalStatus, t.SoftwareName, t.SoftwareRequestType, t.BusinessObjective, t.TargetUsers, t.DesiredDueDate, t.TechnologyName, t.VendorName, t.Specification, t.EstimatedCost,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *Repository) GetTicket(ctx context.Context, id int64) (*models.Ticket, error) {
	t := &models.Ticket{}
	query := `SELECT ` + ticketCols + ` FROM tickets WHERE id=$1 AND deleted_at IS NULL`
	args := []any{id}
	if orgIDs := r.ticketScopeOrgIDs(ctx); orgIDs != nil {
		query += ` AND organization_id=ANY($2)`
		args = append(args, orgIDs)
	}
	err := scanTicket(r.db.QueryRow(ctx, query, args...), t)
	if err != nil {
		return nil, fmt.Errorf("ticket not found")
	}
	return t, nil
}

type ticketScanner interface {
	Scan(...any) error
}

func scanTicket(row ticketScanner, t *models.Ticket) error {
	return row.Scan(
		&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.AssignedTo, &t.CreatedBy, &t.UpdatedBy, &t.DeletedBy, &t.AssetID,
		&t.OrganizationID, &t.RequesterMembershipID, &t.TypeID, &t.SLAPolicyID, &t.SLAResponseAt,
		&t.SLAResolveAt, &t.ClosedAt, &t.RequestKind, &t.ApprovalStatus,
		&t.SoftwareName, &t.SoftwareRequestType, &t.BusinessObjective, &t.TargetUsers, &t.DesiredDueDate,
		&t.ApprovedBy, &t.ApprovedAt, &t.ApprovalNote,
		&t.TechnologyName, &t.VendorName, &t.Specification, &t.EstimatedCost,
		&t.ManagerReviewedBy, &t.ManagerReviewedAt, &t.ManagerReviewNote,
		&t.ITReviewedBy, &t.ITReviewedAt, &t.ITReviewNote, &t.ITRecommendation,
		&t.ITManagerRecommendation, &t.LegacyWorkflow, &t.CreatedAt, &t.UpdatedAt,
		&t.CreatedByName, &t.OrganizationName, &t.RequesterDisplayTitle,
		&t.RequesterIdentityType, &t.ManagerReviewerName,
		&t.ITReviewerName, &t.ITManagerReviewerName,
	)
}

type RequestRoute struct {
	DepartmentManagerID *int64
	ITOrganizationID    *int64
	ITManagerID         *int64
	HasITReviewer       bool
}

func (r *Repository) ResolveRequestRoute(ctx context.Context, organizationID int64) (*RequestRoute, error) {
	route := &RequestRoute{}
	err := r.db.QueryRow(ctx, `
		SELECT manager.manager_user_id, route.provider_organization_id, it_manager.id,
			EXISTS (
				SELECT 1 FROM users reviewer
				WHERE reviewer.deleted_at IS NULL
				AND (
					reviewer.is_root
					OR EXISTS (
						SELECT 1 FROM user_organizations membership
						JOIN organizations member_org ON member_org.id=membership.organization_id
						WHERE membership.user_id=reviewer.id AND membership.is_active
						AND member_org.holding_id=it_org.holding_id
						AND member_org.path LIKE it_org.path || '%'
						AND EXISTS (
							SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
							WHERE rp.role_id=membership.role_id AND p.name='requests.it_review'
						)
						AND EXISTS (
							SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
							WHERE rp.role_id=membership.role_id AND p.name IN ('tickets.read','tickets.read.own')
						)
					)
				)
			)
		FROM organizations request_org
		JOIN holdings h ON h.id=request_org.holding_id
		LEFT JOIN service_routes route ON route.consumer_holding_id=h.id AND route.service_key='it_requests'
		LEFT JOIN LATERAL (
			SELECT candidate.manager_user_id
			FROM organizations candidate
			JOIN users manager_user ON manager_user.id=candidate.manager_user_id AND manager_user.deleted_at IS NULL
				AND (manager_user.is_root OR EXISTS (
					SELECT 1 FROM user_organizations membership
					JOIN organizations member_org ON member_org.id=membership.organization_id
					JOIN role_permissions rp ON rp.role_id=membership.role_id
					JOIN permissions p ON p.id=rp.permission_id
					WHERE membership.user_id=manager_user.id AND membership.is_active
					AND member_org.holding_id=candidate.holding_id
					AND request_org.path LIKE member_org.path || '%'
					AND p.name IN ('tickets.read','tickets.read.own')
				))
			WHERE candidate.holding_id=request_org.holding_id
			AND request_org.path LIKE candidate.path || '%'
			ORDER BY candidate.level DESC
			LIMIT 1
		) manager ON TRUE
		LEFT JOIN organizations it_org ON it_org.id=route.provider_organization_id
		LEFT JOIN users it_manager ON it_manager.id=it_org.manager_user_id AND it_manager.deleted_at IS NULL
			AND (it_manager.is_root OR EXISTS (
				SELECT 1 FROM user_organizations membership
				JOIN organizations member_org ON member_org.id=membership.organization_id
				JOIN role_permissions rp ON rp.role_id=membership.role_id
				JOIN permissions p ON p.id=rp.permission_id
				WHERE membership.user_id=it_manager.id AND membership.is_active
				AND member_org.holding_id=it_org.holding_id
				AND member_org.path LIKE it_org.path || '%'
				AND p.name IN ('tickets.read','tickets.read.own')
			))
		WHERE request_org.id=$1
	`, organizationID).Scan(&route.DepartmentManagerID, &route.ITOrganizationID, &route.ITManagerID, &route.HasITReviewer)
	if err != nil {
		return nil, fmt.Errorf("request organization is not configured")
	}
	return route, nil
}

func (r *Repository) CanParticipateInRequest(ctx context.Context, ticketID, userID int64) bool {
	activeOrganizationIDs := r.scopeOrgIDs(ctx)
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM tickets t
			JOIN organizations request_org ON request_org.id=t.organization_id
			JOIN holdings h ON h.id=request_org.holding_id
			LEFT JOIN service_routes route ON route.consumer_holding_id=h.id AND route.service_key='it_requests'
			LEFT JOIN organizations it_org ON it_org.id=route.provider_organization_id
			WHERE t.id=$1 AND t.deleted_at IS NULL AND (
				t.created_by=$2
				OR (it_org.manager_user_id=$2 AND EXISTS (
					SELECT 1 FROM organizations active_org
					WHERE active_org.id=ANY($3) AND active_org.holding_id=it_org.holding_id
					AND active_org.path LIKE it_org.path || '%'
				))
				OR (t.request_kind <> 'support' AND EXISTS (
					SELECT 1 FROM organizations managed_org
					JOIN users manager_user ON manager_user.id=managed_org.manager_user_id AND manager_user.deleted_at IS NULL
					WHERE managed_org.holding_id=request_org.holding_id
					AND request_org.path LIKE managed_org.path || '%' AND managed_org.manager_user_id=$2
					AND request_org.id=ANY($3)
					AND managed_org.level=(
						SELECT MAX(candidate.level) FROM organizations candidate
						JOIN users active_manager ON active_manager.id=candidate.manager_user_id AND active_manager.deleted_at IS NULL
						WHERE candidate.holding_id=request_org.holding_id AND request_org.path LIKE candidate.path || '%'
					)
				))
			)
		)
	`, ticketID, userID, activeOrganizationIDs).Scan(&allowed)
	if err == nil && allowed {
		return true
	}
	return contextHasPermission(ctx, "requests.it_review") && r.CanITReviewRequest(ctx, ticketID, userID)
}

func (r *Repository) organizationTreeAllowed(ctx context.Context, targetOrganizationID *int64) bool {
	if isRoot, _ := ctx.Value(middleware.CtxKeyIsRoot).(bool); isRoot {
		return true
	}
	if targetOrganizationID == nil {
		return false
	}
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM organizations target_org
			JOIN organizations active_org ON active_org.holding_id=target_org.holding_id
				AND active_org.path LIKE target_org.path || '%'
			WHERE target_org.id=$1 AND active_org.id=ANY($2)
		)
	`, *targetOrganizationID, r.scopeOrgIDs(ctx)).Scan(&allowed)
	return err == nil && allowed
}

func (r *Repository) CanITReviewRequest(ctx context.Context, ticketID, _ int64) bool {
	var itOrganizationID *int64
	err := r.db.QueryRow(ctx, `
		SELECT it_org.id
		FROM tickets t
		JOIN organizations o ON o.id=t.organization_id
		JOIN holdings h ON h.id=o.holding_id
		JOIN service_routes route ON route.consumer_holding_id=h.id AND route.service_key='it_requests'
		JOIN organizations it_org ON it_org.id=route.provider_organization_id
		WHERE t.id=$1 AND t.deleted_at IS NULL
	`, ticketID).Scan(&itOrganizationID)
	return err == nil && r.organizationTreeAllowed(ctx, itOrganizationID)
}

func (r *Repository) userCanReceiveProviderTicket(ctx context.Context, ticketID, userID int64) bool {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM tickets ticket
			JOIN organizations request_org ON request_org.id=ticket.organization_id
			JOIN service_routes route ON route.consumer_holding_id=request_org.holding_id AND route.service_key='it_requests'
			JOIN organizations provider_org ON provider_org.id=route.provider_organization_id
			JOIN users assignee ON assignee.id=$2 AND assignee.deleted_at IS NULL
			JOIN user_organizations membership ON membership.user_id=$2 AND membership.is_active
			JOIN roles membership_role ON membership_role.id=membership.role_id
			JOIN organizations member_org ON member_org.id=membership.organization_id
				AND member_org.holding_id=provider_org.holding_id
				AND member_org.path LIKE provider_org.path || '%'
			WHERE ticket.id=$1 AND ticket.deleted_at IS NULL
			AND (membership_role.name='admin' OR EXISTS (
				SELECT 1 FROM role_permissions rp JOIN permissions permission ON permission.id=rp.permission_id
				WHERE rp.role_id=membership.role_id AND permission.name='tickets.update'
			))
			AND (membership_role.name='admin' OR EXISTS (
				SELECT 1 FROM role_permissions rp JOIN permissions permission ON permission.id=rp.permission_id
				WHERE rp.role_id=membership.role_id AND permission.name IN ('tickets.read','tickets.read.own')
			))
			AND (
				provider_org.manager_user_id=assignee.id
				OR membership_role.name='admin'
				OR EXISTS (
					SELECT 1 FROM role_permissions rp JOIN permissions permission ON permission.id=rp.permission_id
					WHERE rp.role_id=membership.role_id AND permission.name='requests.it_review'
				)
			)
		)
	`, ticketID, userID).Scan(&allowed)
	return err == nil && allowed
}

func (r *Repository) UpdateDepartmentManagerReview(ctx context.Context, ticketID, actorID int64, decision, note string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	nextStatus := "pending_it_review"
	if decision == "rejected" {
		nextStatus = "rejected"
	}
	var requestStatus string
	err = tx.QueryRow(ctx, `
		UPDATE tickets t
		SET approval_status=$1::text, manager_reviewed_by=$2, manager_reviewed_at=NOW(),
			manager_review_note=$3,
			status=CASE WHEN $1::text='rejected' THEN 'cancelled' ELSE status END,
			updated_at=NOW(), updated_by=$2
		WHERE t.id=$4 AND t.deleted_at IS NULL AND t.status='new' AND t.approval_status='pending_manager'
			AND EXISTS (
				SELECT 1 FROM organizations request_org
				JOIN organizations managed_org ON request_org.path LIKE managed_org.path || '%'
				JOIN users manager_user ON manager_user.id=managed_org.manager_user_id AND manager_user.deleted_at IS NULL
				WHERE request_org.id=t.organization_id AND managed_org.holding_id=request_org.holding_id
				AND managed_org.manager_user_id=$2
				AND request_org.id=ANY($5)
				AND managed_org.level=(
					SELECT MAX(candidate.level) FROM organizations candidate
					JOIN users active_manager ON active_manager.id=candidate.manager_user_id AND active_manager.deleted_at IS NULL
					WHERE candidate.holding_id=request_org.holding_id AND request_org.path LIKE candidate.path || '%'
				)
			)
		RETURNING status
	`, nextStatus, actorID, note, ticketID, r.scopeOrgIDs(ctx)).Scan(&requestStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("request is not awaiting this department manager")
		}
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO request_workflow_history (ticket_id, stage, decision, actor_id, note) VALUES ($1,'department_manager',$2,$3,$4)`, ticketID, decision, actorID, note); err != nil {
		return err
	}
	if decision == "rejected" {
		if _, err := tx.Exec(ctx, `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, note) VALUES ($1,'new','cancelled',$2,$3)`, ticketID, actorID, note); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) UpdateITReview(ctx context.Context, ticketID, actorID int64, recommendation, note string) error {
	if !r.CanITReviewRequest(ctx, ticketID, actorID) {
		return fmt.Errorf("request is outside the configured IT organization")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `
		UPDATE tickets t SET approval_status='pending_it_manager', it_reviewed_by=$1,
			it_reviewed_at=NOW(), it_review_note=$2, it_recommendation=$3,
			updated_at=NOW(), updated_by=$1
		WHERE t.id=$4 AND t.deleted_at IS NULL AND t.status='new' AND t.approval_status='pending_it_review'
		AND EXISTS (
			SELECT 1 FROM organizations request_org
			JOIN users reviewer ON reviewer.id=$1 AND reviewer.deleted_at IS NULL
			JOIN holdings h ON h.id=request_org.holding_id
			JOIN service_routes route ON route.consumer_holding_id=h.id AND route.service_key='it_requests'
			JOIN organizations it_org ON it_org.id=route.provider_organization_id
			JOIN user_organizations membership ON membership.id=$5 AND membership.user_id=$1 AND membership.is_active
			JOIN organizations member_org ON member_org.id=membership.organization_id
				AND member_org.holding_id=it_org.holding_id AND member_org.path LIKE it_org.path || '%'
			WHERE request_org.id=t.organization_id
			AND EXISTS (
				SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
				WHERE rp.role_id=membership.role_id AND p.name='requests.it_review'
			)
		)
	`, actorID, note, recommendation, ticketID, ctx.Value(middleware.CtxKeyMembershipID))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("request is not awaiting IT review")
	}
	if _, err := tx.Exec(ctx, `INSERT INTO request_workflow_history (ticket_id, stage, decision, actor_id, note) VALUES ($1,'it_review',$2,$3,$4)`, ticketID, recommendation, actorID, note); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) UpdateITManagerReview(ctx context.Context, ticketID, actorID int64, recommendation, note string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	approvalStatus := "approved"
	if recommendation == "not_recommended" {
		approvalStatus = "rejected"
	}
	var requestStatus string
	err = tx.QueryRow(ctx, `
		UPDATE tickets t
		SET approval_status=$1::text, approved_by=$2, approved_at=NOW(), approval_note=$3,
			it_manager_recommendation=$4,
			status=CASE WHEN $1::text='rejected' THEN 'cancelled' ELSE status END,
			updated_at=NOW(), updated_by=$2
		WHERE t.id=$5 AND t.deleted_at IS NULL AND t.status='new' AND t.approval_status='pending_it_manager'
			AND EXISTS (
				SELECT 1 FROM organizations request_org
				JOIN holdings h ON h.id=request_org.holding_id
				JOIN service_routes route ON route.consumer_holding_id=h.id AND route.service_key='it_requests'
				JOIN organizations it_org ON it_org.id=route.provider_organization_id
				JOIN users it_manager ON it_manager.id=it_org.manager_user_id AND it_manager.deleted_at IS NULL
				WHERE request_org.id=t.organization_id AND it_manager.id=$2
				AND EXISTS (
					SELECT 1 FROM organizations active_org
					WHERE active_org.id=ANY($6) AND active_org.holding_id=it_org.holding_id
					AND active_org.path LIKE it_org.path || '%'
				)
			)
		RETURNING status
	`, approvalStatus, actorID, note, recommendation, ticketID, r.scopeOrgIDs(ctx)).Scan(&requestStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("request is not awaiting this IT manager")
		}
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO request_workflow_history (ticket_id, stage, decision, actor_id, note) VALUES ($1,'it_manager',$2,$3,$4)`, ticketID, recommendation, actorID, note); err != nil {
		return err
	}
	if recommendation == "not_recommended" {
		if _, err := tx.Exec(ctx, `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, note) VALUES ($1,'new','cancelled',$2,$3)`, ticketID, actorID, note); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListRequestWorkflowHistory(ctx context.Context, ticketID int64) ([]models.RequestWorkflowHistory, error) {
	if _, err := r.GetTicket(ctx, ticketID); err != nil {
		return nil, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT h.id, h.ticket_id, h.stage, h.decision, h.actor_id, u.name, h.note, h.created_at
		FROM request_workflow_history h
		JOIN users u ON u.id=h.actor_id
		WHERE h.ticket_id=$1
		ORDER BY h.created_at, h.id
	`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	history := make([]models.RequestWorkflowHistory, 0)
	for rows.Next() {
		var item models.RequestWorkflowHistory
		if err := rows.Scan(&item.ID, &item.TicketID, &item.Stage, &item.Decision, &item.ActorID, &item.ActorName, &item.Note, &item.CreatedAt); err != nil {
			return nil, err
		}
		history = append(history, item)
	}
	return history, rows.Err()
}

func (r *Repository) UpdateTicket(ctx context.Context, t *models.Ticket, userID int64) error {
	var existingOrganizationID *int64
	if err := r.db.QueryRow(ctx, `SELECT organization_id FROM tickets WHERE id=$1 AND deleted_at IS NULL`, t.ID).Scan(&existingOrganizationID); err != nil {
		return fmt.Errorf("ticket not found")
	}
	if t.OrganizationID == nil || existingOrganizationID == nil || *t.OrganizationID != *existingOrganizationID {
		return fmt.Errorf("request organization cannot be changed after submission")
	}
	if !r.organizationAllowed(ctx, t.OrganizationID) && !(contextHasPermission(ctx, "requests.it_review") && r.CanITReviewRequest(ctx, t.ID, userID)) {
		return fmt.Errorf("organization is outside your scope")
	}
	if t.AssignedTo != nil && !r.userBelongsToOrganization(ctx, *t.AssignedTo, t.OrganizationID) && !r.userCanReceiveProviderTicket(ctx, t.ID, *t.AssignedTo) {
		return fmt.Errorf("assignee is outside the ticket organization")
	}
	if t.AssetID != nil {
		var assetOrganizationID *int64
		err := r.db.QueryRow(ctx, `SELECT organization_id FROM assets WHERE id=$1 AND deleted_at IS NULL`, *t.AssetID).Scan(&assetOrganizationID)
		if err != nil || t.OrganizationID == nil || assetOrganizationID == nil || *assetOrganizationID != *t.OrganizationID {
			return fmt.Errorf("asset is outside the ticket organization")
		}
	}
	orgIDs := r.ticketScopeOrgIDs(ctx)
	query := `UPDATE tickets SET title=$1, description=$2, priority=$3, assigned_to=$4, asset_id=$5, organization_id=$6, type_id=$7, updated_at=NOW(), updated_by=$8 WHERE id=$9 AND deleted_at IS NULL`
	args := []any{t.Title, t.Description, t.Priority, t.AssignedTo, t.AssetID, t.OrganizationID, t.TypeID, userID, t.ID}
	if orgIDs != nil {
		query += ` AND organization_id=ANY($10)`
		args = append(args, orgIDs)
	}
	tag, err := r.db.Exec(ctx,
		query, args...,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ticket not found")
	}
	return nil
}

func (r *Repository) UpdateTicketStatus(ctx context.Context, ticketID int64, oldStatus, newStatus string, userID int64, note *string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	now := time.Now()
	var closedAt *time.Time
	if newStatus == "closed" {
		closedAt = &now
	}
	orgIDs := r.ticketScopeOrgIDs(ctx)
	query := `UPDATE tickets SET status=$1, closed_at=$2, updated_at=NOW(), updated_by=$3 WHERE id=$4 AND status=$5 AND deleted_at IS NULL`
	args := []any{newStatus, closedAt, userID, ticketID, oldStatus}
	if orgIDs != nil {
		query += ` AND organization_id=ANY($6)`
		args = append(args, orgIDs)
	}
	tag, err := tx.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ticket status changed concurrently")
	}
	if _, err := tx.Exec(ctx, `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, note) VALUES ($1,$2,$3,$4,$5)`, ticketID, oldStatus, newStatus, userID, note); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListStatusHistory(ctx context.Context, ticketID int64) ([]models.TicketStatusHistory, error) {
	if _, err := r.GetTicket(ctx, ticketID); err != nil {
		return nil, err
	}
	rows, err := r.db.Query(ctx,
		`SELECT h.id, h.ticket_id, h.from_status, h.to_status, h.changed_by, h.note, h.created_at,
		        u.name
		 FROM ticket_status_history h
		 JOIN users u ON u.id = h.changed_by
		 WHERE h.ticket_id = $1
		 ORDER BY h.created_at ASC`, ticketID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	hh := make([]models.TicketStatusHistory, 0)
	for rows.Next() {
		var h models.TicketStatusHistory
		if err := rows.Scan(&h.ID, &h.TicketID, &h.FromStatus, &h.ToStatus, &h.ChangedBy, &h.Note, &h.CreatedAt, &h.ChangedByName); err != nil {
			return nil, err
		}
		hh = append(hh, h)
	}
	return hh, nil
}

func (r *Repository) DeleteTicket(ctx context.Context, id, userID int64) error {
	orgIDs := r.ticketScopeOrgIDs(ctx)
	query := `UPDATE tickets SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL`
	args := []any{userID, id}
	if orgIDs != nil {
		query += ` AND organization_id=ANY($3)`
		args = append(args, orgIDs)
	}
	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ticket not found")
	}
	return nil
}

// ─── Ticket Types ───────────────────────────────────────────────

func (r *Repository) ListTicketTypes(ctx context.Context) ([]models.TicketType, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, created_at FROM ticket_types WHERE deleted_at IS NULL ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tt := make([]models.TicketType, 0)
	for rows.Next() {
		var t models.TicketType
		if err := rows.Scan(&t.ID, &t.Name, &t.CreatedAt); err != nil {
			return nil, err
		}
		tt = append(tt, t)
	}
	return tt, nil
}

func (r *Repository) CreateTicketType(ctx context.Context, t *models.TicketType) error {
	return r.db.QueryRow(ctx, `INSERT INTO ticket_types (name) VALUES ($1) RETURNING id, created_at`, t.Name).Scan(&t.ID, &t.CreatedAt)
}

func (r *Repository) UpdateTicketType(ctx context.Context, t *models.TicketType) error {
	_, err := r.db.Exec(ctx, `UPDATE ticket_types SET name=$1 WHERE id=$2 AND deleted_at IS NULL`, t.Name, t.ID)
	return err
}

func (r *Repository) DeleteTicketType(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE ticket_types SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ticket type not found")
	}
	return nil
}

// ─── Ticket Comments ────────────────────────────────────────────

func (r *Repository) ListTicketComments(ctx context.Context, ticketID int64, includeInternal bool) ([]models.TicketComment, error) {
	if _, err := r.GetTicket(ctx, ticketID); err != nil {
		return nil, err
	}
	query := `SELECT c.id, c.ticket_id, c.user_id, c.content, c.is_internal, c.created_at,
	                 u.name
	          FROM ticket_comments c
	          JOIN users u ON u.id = c.user_id
	          WHERE c.ticket_id = $1 AND c.deleted_at IS NULL`
	if !includeInternal {
		query += ` AND c.is_internal = false`
	}
	query += ` ORDER BY c.created_at ASC`

	rows, err := r.db.Query(ctx, query, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cc := make([]models.TicketComment, 0)
	for rows.Next() {
		var c models.TicketComment
		if err := rows.Scan(&c.ID, &c.TicketID, &c.UserID, &c.Content, &c.IsInternal, &c.CreatedAt, &c.UserName); err != nil {
			return nil, err
		}
		cc = append(cc, c)
	}
	return cc, nil
}

func (r *Repository) CreateTicketComment(ctx context.Context, c *models.TicketComment) error {
	if _, err := r.GetTicket(ctx, c.TicketID); err != nil {
		return err
	}
	return r.db.QueryRow(ctx,
		`INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
		c.TicketID, c.UserID, c.Content, c.IsInternal,
	).Scan(&c.ID, &c.CreatedAt)
}

func (r *Repository) DeleteTicketComment(ctx context.Context, id int64) error {
	orgIDs := r.ticketScopeOrgIDs(ctx)
	query := `UPDATE ticket_comments c SET deleted_at=NOW() WHERE c.id=$1 AND c.deleted_at IS NULL`
	args := []any{id}
	if orgIDs != nil {
		query += ` AND EXISTS (SELECT 1 FROM tickets t WHERE t.id=c.ticket_id AND t.deleted_at IS NULL AND t.organization_id=ANY($2))`
		args = append(args, orgIDs)
	}
	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}

// ─── SLA Policies ───────────────────────────────────────────────

func (r *Repository) ListSLAPolicies(ctx context.Context) ([]models.SLAPolicy, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, priority, response_hours, resolve_hours, created_at FROM sla_policies ORDER BY priority`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	pp := make([]models.SLAPolicy, 0)
	for rows.Next() {
		var p models.SLAPolicy
		if err := rows.Scan(&p.ID, &p.Name, &p.Priority, &p.ResponseHours, &p.ResolveHours, &p.CreatedAt); err != nil {
			return nil, err
		}
		pp = append(pp, p)
	}
	return pp, nil
}

func (r *Repository) GetSLAPolicyByPriority(ctx context.Context, priority string) (*models.SLAPolicy, error) {
	p := &models.SLAPolicy{}
	err := r.db.QueryRow(ctx, `SELECT id, name, priority, response_hours, resolve_hours, created_at FROM sla_policies WHERE priority=$1`, priority).Scan(&p.ID, &p.Name, &p.Priority, &p.ResponseHours, &p.ResolveHours, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("SLA policy not found for priority: %s", priority)
	}
	return p, nil
}

func (r *Repository) CreateSLAPolicy(ctx context.Context, p *models.SLAPolicy) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO sla_policies (name, priority, response_hours, resolve_hours) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
		p.Name, p.Priority, p.ResponseHours, p.ResolveHours,
	).Scan(&p.ID, &p.CreatedAt)
}

func (r *Repository) UpdateSLAPolicy(ctx context.Context, p *models.SLAPolicy) error {
	_, err := r.db.Exec(ctx,
		`UPDATE sla_policies SET name=$1, priority=$2, response_hours=$3, resolve_hours=$4 WHERE id=$5`,
		p.Name, p.Priority, p.ResponseHours, p.ResolveHours, p.ID,
	)
	return err
}

func (r *Repository) DeleteSLAPolicy(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM sla_policies WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("SLA policy not found")
	}
	return nil
}

// ─── Assets ─────────────────────────────────────────────────────

const assetCols = `id, name, type, type_id, category_id, model_id, COALESCE(serial,''), status, COALESCE(location,''), assigned_to, created_by, updated_by, deleted_by, organization_id, created_at, updated_at`

const modelCols = `id, name, manufacturer, part_number, category_id, type_id, created_at, updated_at`

type AssetFilter struct {
	Search         string
	Status         string
	TypeID         int64
	OrganizationID int64
	HoldingID      int64
	AssignedTo     *int64
	Page           int
	PerPage        int
}

func (r *Repository) ListAssets(ctx context.Context, f AssetFilter) (*PaginatedResult[models.Asset], error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PerPage < 1 {
		f.PerPage = 20
	}

	where := `WHERE a.deleted_at IS NULL`
	args := []any{}
	aidx := 1

	if orgIDs := r.scopeOrgIDs(ctx); len(orgIDs) > 0 {
		where += fmt.Sprintf(` AND a.organization_id = ANY($%d)`, aidx)
		args = append(args, orgIDs)
		aidx++
	}

	if f.Search != "" {
		where += fmt.Sprintf(` AND (a.name ILIKE $%d OR a.serial ILIKE $%d)`, aidx, aidx)
		args = append(args, "%"+f.Search+"%")
		aidx++
	}
	if f.Status != "" {
		where += fmt.Sprintf(` AND a.status = $%d`, aidx)
		args = append(args, f.Status)
		aidx++
	}
	if f.TypeID > 0 {
		where += fmt.Sprintf(` AND a.type_id = $%d`, aidx)
		args = append(args, f.TypeID)
		aidx++
	}
	if f.OrganizationID > 0 {
		where += fmt.Sprintf(` AND a.organization_id = $%d`, aidx)
		args = append(args, f.OrganizationID)
		aidx++
	}
	if f.HoldingID > 0 {
		where += fmt.Sprintf(` AND a.organization_id IN (SELECT id FROM organizations WHERE holding_id = $%d)`, aidx)
		args = append(args, f.HoldingID)
		aidx++
	}
	if f.AssignedTo != nil {
		where += fmt.Sprintf(` AND a.assigned_to = $%d`, aidx)
		args = append(args, *f.AssignedTo)
		aidx++
	}

	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM assets a `+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	offset := (f.Page - 1) * f.PerPage
	dataQuery := `SELECT ` + assetCols + ` FROM assets a ` + where + ` ORDER BY a.name LIMIT $` + fmt.Sprintf("%d", aidx) + ` OFFSET $` + fmt.Sprintf("%d", aidx+1)
	args = append(args, f.PerPage, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]models.Asset, 0)
	for rows.Next() {
		var a models.Asset
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.TypeID, &a.CategoryID, &a.ModelID, &a.Serial, &a.Status, &a.Location, &a.AssignedTo, &a.CreatedBy, &a.UpdatedBy, &a.DeletedBy, &a.OrganizationID, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	totalPages := (total + f.PerPage - 1) / f.PerPage
	return &PaginatedResult[models.Asset]{Data: assets, Total: total, Page: f.Page, PerPage: f.PerPage, TotalPages: totalPages}, nil
}

func (r *Repository) CreateAsset(ctx context.Context, a *models.Asset) error {
	if !r.organizationAllowed(ctx, a.OrganizationID) {
		return fmt.Errorf("organization is outside your scope")
	}
	if a.AssignedTo != nil && !r.userBelongsToOrganization(ctx, *a.AssignedTo, a.OrganizationID) {
		return fmt.Errorf("assignee is outside the asset organization")
	}
	return r.db.QueryRow(ctx,
		`INSERT INTO assets (name, type, type_id, category_id, model_id, serial, status, location, assigned_to, created_by, organization_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, created_at, updated_at`,
		a.Name, a.Type, a.TypeID, a.CategoryID, a.ModelID, a.Serial, a.Status, a.Location, a.AssignedTo, a.CreatedBy, a.OrganizationID,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *Repository) GetAsset(ctx context.Context, id int64) (*models.Asset, error) {
	a := &models.Asset{}
	query := `SELECT ` + assetCols + ` FROM assets WHERE id=$1 AND deleted_at IS NULL`
	args := []any{id}
	if orgIDs := r.scopeOrgIDs(ctx); orgIDs != nil {
		query += ` AND organization_id=ANY($2)`
		args = append(args, orgIDs)
	}
	err := r.db.QueryRow(ctx, query, args...,
	).Scan(&a.ID, &a.Name, &a.Type, &a.TypeID, &a.CategoryID, &a.ModelID, &a.Serial, &a.Status, &a.Location, &a.AssignedTo, &a.CreatedBy, &a.UpdatedBy, &a.DeletedBy, &a.OrganizationID, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("asset not found")
	}
	return a, nil
}

func (r *Repository) UpdateAsset(ctx context.Context, a *models.Asset, userID int64) error {
	if !r.organizationAllowed(ctx, a.OrganizationID) {
		return fmt.Errorf("organization is outside your scope")
	}
	if a.AssignedTo != nil && !r.userBelongsToOrganization(ctx, *a.AssignedTo, a.OrganizationID) {
		return fmt.Errorf("assignee is outside the asset organization")
	}
	orgIDs := r.scopeOrgIDs(ctx)
	query := `UPDATE assets SET name=$1, type=$2, type_id=$3, category_id=$4, model_id=$5, serial=$6, status=$7, location=$8, assigned_to=$9, organization_id=$10, updated_at=NOW(), updated_by=$11 WHERE id=$12 AND deleted_at IS NULL`
	args := []any{a.Name, a.Type, a.TypeID, a.CategoryID, a.ModelID, a.Serial, a.Status, a.Location, a.AssignedTo, a.OrganizationID, userID, a.ID}
	if orgIDs != nil {
		query += ` AND organization_id=ANY($13)`
		args = append(args, orgIDs)
	}
	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("asset not found")
	}
	return nil
}

func (r *Repository) DeleteAsset(ctx context.Context, id, userID int64) error {
	orgIDs := r.scopeOrgIDs(ctx)
	query := `UPDATE assets SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL`
	args := []any{userID, id}
	if orgIDs != nil {
		query += ` AND organization_id=ANY($3)`
		args = append(args, orgIDs)
	}
	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("asset not found")
	}
	return nil
}

// ─── Asset Models ───────────────────────────────────────────────

func (r *Repository) GetAssetModel(ctx context.Context, id int64) (*models.AssetModel, error) {
	m := &models.AssetModel{}
	err := r.db.QueryRow(ctx,
		`SELECT `+modelCols+` FROM asset_models WHERE id=$1 AND deleted_at IS NULL`, id,
	).Scan(&m.ID, &m.Name, &m.Manufacturer, &m.PartNumber, &m.CategoryID, &m.TypeID, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("model not found")
	}
	return m, nil
}

func (r *Repository) ListAssetModels(ctx context.Context) ([]models.AssetModel, error) {
	rows, err := r.db.Query(ctx, `SELECT `+modelCols+` FROM asset_models WHERE deleted_at IS NULL ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	models_ := make([]models.AssetModel, 0)
	for rows.Next() {
		var m models.AssetModel
		if err := rows.Scan(&m.ID, &m.Name, &m.Manufacturer, &m.PartNumber, &m.CategoryID, &m.TypeID, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		models_ = append(models_, m)
	}
	return models_, nil
}

func (r *Repository) CreateAssetModel(ctx context.Context, m *models.AssetModel) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO asset_models (name, manufacturer, part_number, category_id, type_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at, updated_at`,
		m.Name, m.Manufacturer, m.PartNumber, m.CategoryID, m.TypeID,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
}

func (r *Repository) UpdateAssetModel(ctx context.Context, m *models.AssetModel) error {
	_, err := r.db.Exec(ctx,
		`UPDATE asset_models SET name=$1, manufacturer=$2, part_number=$3, category_id=$4, type_id=$5, updated_at=NOW() WHERE id=$6 AND deleted_at IS NULL`,
		m.Name, m.Manufacturer, m.PartNumber, m.CategoryID, m.TypeID, m.ID,
	)
	return err
}

func (r *Repository) DeleteAssetModel(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE asset_models SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("model not found")
	}
	return nil
}

func (r *Repository) BulkCreateAssets(ctx context.Context, assets []models.Asset) ([]models.Asset, error) {
	for i := range assets {
		if !r.organizationAllowed(ctx, assets[i].OrganizationID) {
			return nil, fmt.Errorf("organization is outside your scope")
		}
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	created := make([]models.Asset, 0, len(assets))
	for i := range assets {
		a := &assets[i]
		err := tx.QueryRow(ctx,
			`INSERT INTO assets (name, type, type_id, category_id, model_id, serial, status, location, assigned_to, created_by, organization_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, created_at, updated_at`,
			a.Name, a.Type, a.TypeID, a.CategoryID, a.ModelID, a.Serial, a.Status, a.Location, a.AssignedTo, a.CreatedBy, a.OrganizationID,
		).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		created = append(created, *a)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return created, nil
}

// ─── Auth / Users ───────────────────────────────────────────────

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	u := &models.User{}
	err := r.executor(ctx).QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.password_hash, u.role_id, COALESCE(ro.name,'') as role, u.is_root, u.organization_id, u.created_at, u.deleted_at, u.locked_until
		 FROM users u LEFT JOIN roles ro ON ro.id = u.role_id WHERE LOWER(u.email)=$1`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.RoleID, &u.Role, &u.IsRoot, &u.OrganizationID, &u.CreatedAt, &u.DeletedAt, &u.LockedUntil)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	return u, nil
}

func (r *Repository) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	u := &models.User{}
	err := r.db.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.password_hash, u.role_id, COALESCE(ro.name,'') as role, u.is_root, u.avatar_url, u.organization_id, u.created_at, u.deleted_at, u.locked_until
		 FROM users u LEFT JOIN roles ro ON ro.id = u.role_id WHERE u.id=$1`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.RoleID, &u.Role, &u.IsRoot, &u.AvatarURL, &u.OrganizationID, &u.CreatedAt, &u.DeletedAt, &u.LockedUntil)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	return u, nil
}

func (r *Repository) LoadAuthorizationState(ctx context.Context, userID int64, requestedMembershipID *int64) (*middleware.AuthorizationState, error) {
	state := &middleware.AuthorizationState{}
	var primaryOrganizationID *int64
	var globalRole string
	if err := r.db.QueryRow(ctx, `
		SELECT u.email, COALESCE(ro.name,''), u.is_root, u.organization_id
		FROM users u
		LEFT JOIN roles ro ON ro.id=u.role_id
		WHERE u.id=$1 AND u.deleted_at IS NULL
	`, userID).Scan(&state.Email, &globalRole, &state.IsRoot, &primaryOrganizationID); err != nil {
		return nil, fmt.Errorf("active user not found")
	}
	if state.IsRoot {
		state.Role = globalRole
		permissions, err := r.GetUserPermissions(ctx, userID)
		if err != nil {
			return nil, err
		}
		for _, permission := range permissions {
			state.Permissions = append(state.Permissions, permission.Name)
		}
		if primaryOrganizationID != nil {
			state.OrganizationID = *primaryOrganizationID
		}
		return state, nil
	}

	query := `SELECT uo.id, o.id, o.path, COALESCE(role.name,''), uo.role_id
		FROM user_organizations uo
		JOIN organizations o ON o.id=uo.organization_id
		LEFT JOIN roles role ON role.id=uo.role_id
		WHERE uo.user_id=$1 AND uo.is_active`
	args := []any{userID}
	if requestedMembershipID != nil {
		query += ` AND uo.id=$2`
		args = append(args, *requestedMembershipID)
	}
	query += ` ORDER BY uo.is_default DESC, uo.id LIMIT 1`
	var roleID *int64
	if err := r.db.QueryRow(ctx, query, args...).Scan(
		&state.MembershipID, &state.OrganizationID, &state.OrgPath, &state.Role, &roleID,
	); err != nil || roleID == nil {
		return nil, fmt.Errorf("active membership not found")
	}
	state.OrgIDs = []int64{state.OrganizationID}
	state.OrgPaths = []string{state.OrgPath}
	rows, err := r.db.Query(ctx, `
		SELECT p.name FROM permissions p
		JOIN role_permissions rp ON rp.permission_id=p.id
		WHERE rp.role_id=$1 ORDER BY p.name
	`, *roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return nil, err
		}
		state.Permissions = append(state.Permissions, permission)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return state, nil
}

func (r *Repository) GetUserPermissions(ctx context.Context, userID int64) ([]models.Permission, error) {
	rows, err := r.db.Query(ctx,
		`SELECT p.id, p.name, p.module, p.action FROM permissions p
		 JOIN role_permissions rp ON rp.permission_id=p.id JOIN users u ON u.role_id=rp.role_id WHERE u.id=$1`, userID,
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

// ─── User Management ────────────────────────────────────────────

func (r *Repository) ListUsers(ctx context.Context, orgID *int64, holdingID *int64) ([]models.User, error) {
	query := `SELECT u.id, u.email, u.name, u.password_hash, u.role_id, COALESCE(ro.name,'') as role, u.is_root, u.avatar_url, u.organization_id,
		ARRAY(SELECT organization_id FROM (
			SELECT u.organization_id AS organization_id WHERE u.organization_id IS NOT NULL
			UNION SELECT uo.organization_id FROM user_organizations uo WHERE uo.user_id=u.id AND uo.is_active
		) memberships ORDER BY organization_id),
		u.created_at, u.deleted_at, u.locked_until
		FROM users u LEFT JOIN roles ro ON ro.id=u.role_id`
	args := []any{}
	aidx := 1

	var where []string
	if orgIDs := r.scopeOrgIDs(ctx); len(orgIDs) > 0 {
		where = append(where, fmt.Sprintf(`(
			u.organization_id = ANY($%d)
			OR EXISTS (SELECT 1 FROM user_organizations uo WHERE uo.user_id=u.id AND uo.organization_id=ANY($%d) AND uo.is_active)
		)`, aidx, aidx))
		args = append(args, orgIDs)
		aidx++
	}
	if orgID != nil {
		where = append(where, fmt.Sprintf(`u.organization_id = $%d`, aidx))
		args = append(args, *orgID)
		aidx++
	}
	if holdingID != nil {
		where = append(where, fmt.Sprintf(`u.organization_id IN (SELECT id FROM organizations WHERE holding_id = $%d)`, aidx))
		args = append(args, *holdingID)
		aidx++
	}
	if len(where) > 0 {
		query += ` WHERE ` + strings.Join(where, ` AND `)
	}
	query += ` ORDER BY u.created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.RoleID, &u.Role, &u.IsRoot, &u.AvatarURL, &u.OrganizationID, &u.OrgIDs, &u.CreatedAt, &u.DeletedAt, &u.LockedUntil); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *Repository) CreateUser(ctx context.Context, u *models.User, organizationIDs []int64) error {
	if err := r.validateOrganizationIDs(ctx, organizationIDs); err != nil {
		return err
	}
	if len(organizationIDs) > 0 {
		u.OrganizationID = &organizationIDs[0]
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := tx.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash, role_id, organization_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
		u.Email, u.Name, u.PasswordHash, u.RoleID, u.OrganizationID,
	).Scan(&u.ID, &u.CreatedAt); err != nil {
		return err
	}
	if err := replaceUserOrganizations(ctx, tx, u.ID, organizationIDs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) UpdateUser(ctx context.Context, u *models.User, organizationIDs *[]int64) error {
	if !r.scopedUserExists(ctx, u.ID) {
		return fmt.Errorf("user not found")
	}
	if organizationIDs != nil {
		if err := r.validateOrganizationIDs(ctx, *organizationIDs); err != nil {
			return err
		}
		if len(*organizationIDs) > 0 {
			u.OrganizationID = &(*organizationIDs)[0]
		} else {
			u.OrganizationID = nil
		}
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var tag pgconn.CommandTag
	if organizationIDs == nil {
		tag, err = tx.Exec(ctx,
			`UPDATE users SET name=$1, email=$2, role_id=$3 WHERE id=$4 AND deleted_at IS NULL`,
			u.Name, u.Email, u.RoleID, u.ID,
		)
	} else {
		tag, err = tx.Exec(ctx,
			`UPDATE users SET name=$1, email=$2, role_id=$3, organization_id=$4 WHERE id=$5 AND deleted_at IS NULL`,
			u.Name, u.Email, u.RoleID, u.OrganizationID, u.ID,
		)
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	if organizationIDs != nil {
		if err := replaceUserOrganizations(ctx, tx, u.ID, *organizationIDs); err != nil {
			return err
		}
	}
	if u.RoleID != nil {
		if _, err := tx.Exec(ctx, `UPDATE user_organizations SET role_id=$1 WHERE user_id=$2 AND is_active AND is_default`, u.RoleID, u.ID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) UpdateUserPassword(ctx context.Context, id int64, hash string) error {
	tag, err := r.db.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2 AND deleted_at IS NULL`, hash, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (r *Repository) GetUserOrganizationsWithDetails(ctx context.Context, userID int64) ([]models.UserOrgDetail, error) {
	rows, err := r.db.Query(ctx,
		`SELECT uo.id, uo.organization_id, o.name, o.holding_id, h.name,
			uo.role_id, COALESCE(r.name,''), COALESCE(r.label,''), uo.identity_type,
			uo.display_title, uo.identity_source, uo.external_membership_id,
			uo.is_active, uo.is_default
		 FROM user_organizations uo
		 JOIN organizations o ON o.id = uo.organization_id
		 JOIN holdings h ON h.id = o.holding_id
		 LEFT JOIN roles r ON r.id=uo.role_id
		 WHERE uo.user_id=$1 AND uo.is_active
		 ORDER BY uo.is_default DESC, h.name, o.name`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	orgs := make([]models.UserOrgDetail, 0)
	for rows.Next() {
		var o models.UserOrgDetail
		if err := rows.Scan(
			&o.MembershipID, &o.OrganizationID, &o.OrgName, &o.HoldingID, &o.HoldingName,
			&o.RoleID, &o.RoleName, &o.RoleLabel, &o.IdentityType, &o.DisplayTitle,
			&o.IdentitySource, &o.ExternalMembershipID, &o.IsActive, &o.IsDefault,
		); err != nil {
			return nil, err
		}
		orgs = append(orgs, o)
	}
	return orgs, nil
}

func (r *Repository) ResolveRequesterMembership(ctx context.Context, userID int64, membershipID *int64) (*models.UserOrgDetail, error) {
	query := `SELECT uo.id, uo.organization_id, o.name, o.holding_id, h.name,
		uo.role_id, COALESCE(role.name,''), COALESCE(role.label,''), uo.identity_type,
		uo.display_title, uo.identity_source, uo.external_membership_id,
		uo.is_active, uo.is_default,
		(role.name='admin' OR EXISTS (
			SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
			WHERE rp.role_id=uo.role_id AND p.name='tickets.create'
		))
		FROM user_organizations uo
		JOIN organizations o ON o.id=uo.organization_id
		JOIN holdings h ON h.id=o.holding_id
		LEFT JOIN roles role ON role.id=uo.role_id
		WHERE uo.user_id=$1 AND uo.is_active`
	args := []any{userID}
	if membershipID != nil {
		query += ` AND uo.id=$2`
		args = append(args, *membershipID)
	}
	query += ` ORDER BY uo.is_default DESC, uo.id LIMIT 1`
	membership := &models.UserOrgDetail{}
	var canCreate bool
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&membership.MembershipID, &membership.OrganizationID, &membership.OrgName,
		&membership.HoldingID, &membership.HoldingName, &membership.RoleID,
		&membership.RoleName, &membership.RoleLabel, &membership.IdentityType,
		&membership.DisplayTitle, &membership.IdentitySource,
		&membership.ExternalMembershipID, &membership.IsActive,
		&membership.IsDefault, &canCreate,
	)
	if err != nil || !canCreate {
		return nil, fmt.Errorf("active requester membership with create permission not found")
	}
	return membership, nil
}

func (r *Repository) UpdateUserProfile(ctx context.Context, id int64, name string, avatarURL *string) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE users SET name=CASE WHEN $1='' THEN name ELSE $1 END, avatar_url=COALESCE($2, avatar_url), updated_at=NOW() WHERE id=$3 AND deleted_at IS NULL`,
		name, avatarURL, id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (r *Repository) GetUserOrganizationIDs(ctx context.Context, userID int64) ([]int64, error) {
	rows, err := r.db.Query(ctx, `SELECT organization_id FROM user_organizations WHERE user_id=$1 AND is_active`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (r *Repository) SetUserOrganizations(ctx context.Context, userID int64, orgIDs []int64) error {
	if !r.scopedUserExists(ctx, userID) {
		return fmt.Errorf("user not found")
	}
	if err := r.validateOrganizationIDs(ctx, orgIDs); err != nil {
		return err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var primaryOrganizationID *int64
	if len(orgIDs) > 0 {
		primaryOrganizationID = &orgIDs[0]
	}
	if _, err := tx.Exec(ctx, `UPDATE users SET organization_id=$1 WHERE id=$2`, primaryOrganizationID, userID); err != nil {
		return err
	}
	if err := replaceUserOrganizations(ctx, tx, userID, orgIDs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) SetUserMemberships(ctx context.Context, userID int64, memberships []models.UserMembershipInput) error {
	if !r.scopedUserExists(ctx, userID) {
		return fmt.Errorf("user not found")
	}
	organizationIDs := make([]int64, len(memberships))
	for i := range memberships {
		organizationIDs[i] = memberships[i].OrganizationID
	}
	if err := r.validateOrganizationIDs(ctx, organizationIDs); err != nil {
		return err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE user_organizations SET is_active=false, is_default=false WHERE user_id=$1`, userID); err != nil {
		return err
	}
	defaultIndex := 0
	for i := range memberships {
		if memberships[i].IsDefault {
			defaultIndex = i
			break
		}
	}
	for i, membership := range memberships {
		identityType := strings.TrimSpace(membership.IdentityType)
		if identityType == "" {
			identityType = "member"
		}
		identitySource := strings.TrimSpace(membership.IdentitySource)
		if identitySource == "" {
			identitySource = "local"
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_organizations (
				user_id, organization_id, role_id, identity_type, display_title,
				identity_source, external_membership_id, is_active, is_default
			) VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)
			ON CONFLICT (user_id, organization_id) DO UPDATE SET
				role_id=EXCLUDED.role_id, identity_type=EXCLUDED.identity_type,
				display_title=EXCLUDED.display_title, identity_source=EXCLUDED.identity_source,
				external_membership_id=EXCLUDED.external_membership_id,
				is_active=true, is_default=EXCLUDED.is_default
		`, userID, membership.OrganizationID, membership.RoleID, identityType,
			strings.TrimSpace(membership.DisplayTitle), identitySource,
			membership.ExternalMembershipID, i == defaultIndex); err != nil {
			return err
		}
	}
	var primaryOrganizationID, primaryRoleID *int64
	if len(memberships) > 0 {
		primaryOrganizationID = &memberships[defaultIndex].OrganizationID
		primaryRoleID = memberships[defaultIndex].RoleID
	}
	if _, err := tx.Exec(ctx, `UPDATE users SET organization_id=$1, role_id=COALESCE($2,role_id) WHERE id=$3`, primaryOrganizationID, primaryRoleID, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func replaceUserOrganizations(ctx context.Context, tx pgx.Tx, userID int64, organizationIDs []int64) error {
	if _, err := tx.Exec(ctx, `UPDATE user_organizations SET is_active=false, is_default=false WHERE user_id=$1`, userID); err != nil {
		return err
	}
	for index, organizationID := range organizationIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_organizations (user_id, organization_id, role_id, is_active, is_default)
			SELECT $1,$2,role_id,true,$3 FROM users WHERE id=$1
			ON CONFLICT (user_id, organization_id) DO UPDATE
			SET is_active=true, is_default=EXCLUDED.is_default,
				role_id=COALESCE(user_organizations.role_id, EXCLUDED.role_id)
		`, userID, organizationID, index == 0); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) SoftDeleteUser(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE users SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// ─── Roles ──────────────────────────────────────────────────────

func (r *Repository) ListRoles(ctx context.Context) ([]models.Role, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, label, is_admin, created_at FROM roles ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	roles := make([]models.Role, 0)
	for rows.Next() {
		var ro models.Role
		if err := rows.Scan(&ro.ID, &ro.Name, &ro.Label, &ro.IsAdmin, &ro.CreatedAt); err != nil {
			return nil, err
		}
		roles = append(roles, ro)
	}
	return roles, nil
}

func (r *Repository) RoleHasSettingsAccess(ctx context.Context, roleID int64) (bool, error) {
	var privileged bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM roles ro
			LEFT JOIN role_permissions rp ON rp.role_id=ro.id
			LEFT JOIN permissions p ON p.id=rp.permission_id
			WHERE ro.id=$1 AND (ro.name='superadmin' OR p.module='settings')
		)
	`, roleID).Scan(&privileged)
	return privileged, err
}

func (r *Repository) CreateRole(ctx context.Context, ro *models.Role) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO roles (name, label, is_admin) VALUES ($1,$2,$3) RETURNING id, created_at`,
		ro.Name, ro.Label, ro.IsAdmin,
	).Scan(&ro.ID, &ro.CreatedAt)
}

func (r *Repository) UpdateRole(ctx context.Context, ro *models.Role) error {
	_, err := r.db.Exec(ctx,
		`UPDATE roles SET name=$1, label=$2, is_admin=$3 WHERE id=$4`,
		ro.Name, ro.Label, ro.IsAdmin, ro.ID,
	)
	return err
}

func (r *Repository) DeleteRole(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM roles WHERE id=$1 AND is_admin=false`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("role not found or cannot delete admin role")
	}
	return nil
}

func (r *Repository) GetRolePermissions(ctx context.Context, roleID int64) ([]models.Permission, error) {
	rows, err := r.db.Query(ctx,
		`SELECT p.id, p.name, p.module, p.action FROM permissions p
		 JOIN role_permissions rp ON rp.permission_id=p.id WHERE rp.role_id=$1 ORDER BY p.module, p.action`, roleID,
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

func (r *Repository) SetRolePermissions(ctx context.Context, roleID int64, permissionIDs []int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM role_permissions WHERE role_id=$1`, roleID); err != nil {
		return err
	}
	for _, pid := range permissionIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, roleID, pid); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListAllPermissions(ctx context.Context) ([]models.Permission, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, module, action FROM permissions ORDER BY module, action`)
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

// ─── Bin (soft delete) ──────────────────────────────────────────

type BinItem struct {
	Type      string    `json:"type"`
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	DeletedAt time.Time `json:"deleted_at"`
}

func (r *Repository) ListBin(ctx context.Context) ([]BinItem, error) {
	items := make([]BinItem, 0)

	rows, err := r.db.Query(ctx, `SELECT 'ticket' as type, id, title, deleted_at FROM tickets WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var b BinItem
		if err := rows.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows2, err := r.db.Query(ctx, `SELECT 'asset' as type, id, name, deleted_at FROM assets WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var b BinItem
		if err := rows2.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows3, err := r.db.Query(ctx, `SELECT 'user' as type, id, name, deleted_at FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows3.Close()
	for rows3.Next() {
		var b BinItem
		if err := rows3.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows4, err := r.db.Query(ctx, `SELECT 'type' as type, id, name, deleted_at FROM asset_types WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows4.Close()
	for rows4.Next() {
		var b BinItem
		if err := rows4.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows5, err := r.db.Query(ctx, `SELECT 'category' as type, id, name, deleted_at FROM asset_categories WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows5.Close()
	for rows5.Next() {
		var b BinItem
		if err := rows5.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows6, err := r.db.Query(ctx, `SELECT 'model' as type, id, name, deleted_at FROM asset_models WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows6.Close()
	for rows6.Next() {
		var b BinItem
		if err := rows6.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows7, err := r.db.Query(ctx, `SELECT 'ticket_type' as type, id, name, deleted_at FROM ticket_types WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows7.Close()
	for rows7.Next() {
		var b BinItem
		if err := rows7.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	return items, nil
}

func (r *Repository) RestoreItem(ctx context.Context, itemType string, id int64) error {
	var table string
	switch itemType {
	case "ticket":
		table = "tickets"
	case "asset":
		table = "assets"
	case "user":
		table = "users"
	case "type":
		table = "asset_types"
	case "category":
		table = "asset_categories"
	case "model":
		table = "asset_models"
	case "ticket_type":
		table = "ticket_types"
	default:
		return fmt.Errorf("unknown type: %s", itemType)
	}
	tag, err := r.db.Exec(ctx, fmt.Sprintf(`UPDATE %s SET deleted_at=NULL WHERE id=$1`, table), id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

func (r *Repository) PermanentlyDelete(ctx context.Context, itemType string, id int64) error {
	if itemType == "user" {
		tag, err := r.db.Exec(ctx, `DELETE FROM users WHERE id=$1 AND deleted_at IS NOT NULL AND is_root=FALSE`, id)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("item not found")
		}
		return nil
	}
	var table string
	switch itemType {
	case "ticket":
		table = "tickets"
	case "asset":
		table = "assets"
	case "type":
		table = "asset_types"
	case "category":
		table = "asset_categories"
	case "model":
		table = "asset_models"
	case "ticket_type":
		table = "ticket_types"
	default:
		return fmt.Errorf("unknown type: %s", itemType)
	}
	tag, err := r.db.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE id=$1 AND deleted_at IS NOT NULL`, table), id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

// ─── Asset Types & Categories ──────────────────────────────────

func (r *Repository) ListAssetTypes(ctx context.Context) ([]models.AssetType, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, created_at FROM asset_types WHERE deleted_at IS NULL ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	types := make([]models.AssetType, 0)
	for rows.Next() {
		var t models.AssetType
		if err := rows.Scan(&t.ID, &t.Name, &t.CreatedAt); err != nil {
			return nil, err
		}
		types = append(types, t)
	}
	return types, nil
}

func (r *Repository) CreateAssetType(ctx context.Context, t *models.AssetType) error {
	return r.db.QueryRow(ctx, `INSERT INTO asset_types (name) VALUES ($1) RETURNING id, created_at`, t.Name).Scan(&t.ID, &t.CreatedAt)
}

func (r *Repository) UpdateAssetType(ctx context.Context, t *models.AssetType) error {
	_, err := r.db.Exec(ctx, `UPDATE asset_types SET name=$1 WHERE id=$2 AND deleted_at IS NULL`, t.Name, t.ID)
	return err
}

func (r *Repository) DeleteAssetType(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE asset_types SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	// Also soft-delete categories under this type
	r.db.Exec(ctx, `UPDATE asset_categories SET deleted_at=NOW() WHERE type_id=$1 AND deleted_at IS NULL`, id)
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("type not found")
	}
	return nil
}

func (r *Repository) ListAssetCategories(ctx context.Context) ([]models.AssetCategory, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, parent_id, type_id, created_at FROM asset_categories WHERE deleted_at IS NULL ORDER BY type_id, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cats := make([]models.AssetCategory, 0)
	for rows.Next() {
		var c models.AssetCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.ParentID, &c.TypeID, &c.CreatedAt); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, nil
}

func (r *Repository) CreateAssetCategory(ctx context.Context, c *models.AssetCategory) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO asset_categories (name, parent_id, type_id) VALUES ($1,$2,$3) RETURNING id, created_at`,
		c.Name, c.ParentID, c.TypeID,
	).Scan(&c.ID, &c.CreatedAt)
}

func (r *Repository) UpdateAssetCategory(ctx context.Context, c *models.AssetCategory) error {
	_, err := r.db.Exec(ctx,
		`UPDATE asset_categories SET name=$1, parent_id=$2, type_id=$3 WHERE id=$4`,
		c.Name, c.ParentID, c.TypeID, c.ID,
	)
	return err
}

func (r *Repository) ListHoldings(ctx context.Context) ([]models.Holding, error) {
	query := `SELECT holdings.id, holdings.name, holdings.slug, route.provider_organization_id, holdings.created_at
		FROM holdings
		LEFT JOIN service_routes route ON route.consumer_holding_id=holdings.id AND route.service_key='it_requests'`
	args := []any{}
	if organizationIDs := r.scopeOrgIDs(ctx); organizationIDs != nil {
		query += ` WHERE EXISTS (SELECT 1 FROM organizations o WHERE o.holding_id=holdings.id AND o.id=ANY($1))`
		args = append(args, organizationIDs)
	}
	query += ` ORDER BY name`
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	hh := make([]models.Holding, 0)
	for rows.Next() {
		var h models.Holding
		if err := rows.Scan(&h.ID, &h.Name, &h.Slug, &h.ServiceProviderOrganizationID, &h.CreatedAt); err != nil {
			return nil, err
		}
		hh = append(hh, h)
	}
	return hh, nil
}

func (r *Repository) CreateHolding(ctx context.Context, h *models.Holding) error {
	return r.db.QueryRow(ctx, `INSERT INTO holdings (name, slug) VALUES ($1,$2) RETURNING id, created_at`, h.Name, h.Slug).Scan(&h.ID, &h.CreatedAt)
}

func (r *Repository) UpdateHoldingServiceProvider(ctx context.Context, holdingID int64, organizationID *int64) error {
	if organizationID != nil {
		if _, err := r.GetOrganization(ctx, *organizationID); err != nil || !r.organizationAllowed(ctx, organizationID) {
			return fmt.Errorf("service provider organization is outside your scope")
		}
	}
	query := `SELECT EXISTS(SELECT 1 FROM holdings WHERE id=$1)`
	args := []any{holdingID}
	if organizationIDs := r.scopeOrgIDs(ctx); organizationIDs != nil {
		query = `SELECT EXISTS(SELECT 1 FROM holdings h WHERE h.id=$1 AND EXISTS (SELECT 1 FROM organizations o WHERE o.holding_id=h.id AND o.id=ANY($2)))`
		args = append(args, organizationIDs)
	}
	var holdingAllowed bool
	if err := r.db.QueryRow(ctx, query, args...).Scan(&holdingAllowed); err != nil || !holdingAllowed {
		return fmt.Errorf("consumer holding is outside your scope")
	}
	if organizationID == nil {
		_, err := r.db.Exec(ctx, `DELETE FROM service_routes WHERE service_key='it_requests' AND consumer_holding_id=$1`, holdingID)
		return err
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO service_routes (service_key, consumer_holding_id, provider_organization_id)
		VALUES ('it_requests',$1,$2)
		ON CONFLICT (service_key, consumer_holding_id)
		DO UPDATE SET provider_organization_id=EXCLUDED.provider_organization_id, updated_at=NOW()
	`, holdingID, *organizationID)
	if err != nil {
		return err
	}
	return nil
}

func (r *Repository) GetOrganization(ctx context.Context, id int64) (*models.Organization, error) {
	o := &models.Organization{}
	err := r.db.QueryRow(ctx, `SELECT id, name, parent_id, holding_id, path, level, manager_user_id, created_at FROM organizations WHERE id=$1`, id).Scan(&o.ID, &o.Name, &o.ParentID, &o.HoldingID, &o.Path, &o.Level, &o.ManagerUserID, &o.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("organization not found")
	}
	return o, nil
}

func (r *Repository) CreateOrganization(ctx context.Context, o *models.Organization) error {
	if organizationIDs := r.scopeOrgIDs(ctx); organizationIDs != nil {
		var holdingAllowed bool
		if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM organizations WHERE holding_id=$1 AND id=ANY($2))`, o.HoldingID, organizationIDs).Scan(&holdingAllowed); err != nil || !holdingAllowed {
			return fmt.Errorf("holding is outside your scope")
		}
	}
	var parent *models.Organization
	if o.ParentID != nil {
		var err error
		parent, err = r.GetOrganization(ctx, *o.ParentID)
		if err != nil || parent.HoldingID != o.HoldingID || !r.organizationAllowed(ctx, o.ParentID) {
			return fmt.Errorf("parent organization must belong to the same holding and your scope")
		}
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := tx.QueryRow(ctx,
		`INSERT INTO organizations (name, parent_id, holding_id, path, level) VALUES ($1,$2,$3,'/',0) RETURNING id, created_at`,
		o.Name, o.ParentID, o.HoldingID,
	).Scan(&o.ID, &o.CreatedAt); err != nil {
		return err
	}

	path := "/" + fmt.Sprintf("%d", o.ID) + "/"
	if parent != nil {
		path = parent.Path + fmt.Sprintf("%d", o.ID) + "/"
		o.Level = parent.Level + 1
	}
	if _, err := tx.Exec(ctx, `UPDATE organizations SET path=$1, level=$2 WHERE id=$3`, path, o.Level, o.ID); err != nil {
		return err
	}
	o.Path = path
	return tx.Commit(ctx)
}

func (r *Repository) UpdateOrganizationManager(ctx context.Context, organizationID int64, managerUserID *int64) error {
	if !r.organizationAllowed(ctx, &organizationID) {
		return fmt.Errorf("organization is outside your scope")
	}
	if managerUserID != nil && !r.userBelongsToOrganization(ctx, *managerUserID, &organizationID) {
		return fmt.Errorf("manager must be an active member of this organization")
	}
	tag, err := r.db.Exec(ctx, `UPDATE organizations SET manager_user_id=$1 WHERE id=$2`, managerUserID, organizationID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("organization not found")
	}
	return nil
}

func (r *Repository) ListOrganizations(ctx context.Context) ([]models.Organization, error) {
	query := `SELECT id, name, parent_id, holding_id, path, level, manager_user_id, created_at FROM organizations`
	args := []any{}
	if organizationIDs := r.scopeOrgIDs(ctx); organizationIDs != nil {
		query += ` WHERE id=ANY($1)`
		args = append(args, organizationIDs)
	}
	query += ` ORDER BY path`
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	oo := make([]models.Organization, 0)
	for rows.Next() {
		var o models.Organization
		if err := rows.Scan(&o.ID, &o.Name, &o.ParentID, &o.HoldingID, &o.Path, &o.Level, &o.ManagerUserID, &o.CreatedAt); err != nil {
			return nil, err
		}
		oo = append(oo, o)
	}
	return oo, nil
}

func (r *Repository) DeleteAssetCategory(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE asset_categories SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("category not found")
	}
	return nil
}
