package models

import "time"

type Holding struct {
	ID                            int64     `json:"id"`
	Name                          string    `json:"name"`
	Slug                          string    `json:"slug"`
	ServiceProviderOrganizationID *int64    `json:"service_provider_organization_id,omitempty"`
	CreatedAt                     time.Time `json:"created_at"`
}

type Organization struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	ParentID      *int64    `json:"parent_id,omitempty"`
	HoldingID     int64     `json:"holding_id"`
	Path          string    `json:"path"`
	Level         int       `json:"level"`
	ManagerUserID *int64    `json:"manager_user_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type Ticket struct {
	ID                      int64      `json:"id"`
	Title                   string     `json:"title"`
	Description             string     `json:"description"`
	Status                  string     `json:"status"`
	Priority                string     `json:"priority"`
	AssignedTo              *int64     `json:"assigned_to"`
	CreatedBy               int64      `json:"created_by"`
	UpdatedBy               *int64     `json:"updated_by,omitempty"`
	DeletedBy               *int64     `json:"deleted_by,omitempty"`
	AssetID                 *int64     `json:"asset_id,omitempty"`
	OrganizationID          *int64     `json:"organization_id,omitempty"`
	RequesterMembershipID   *int64     `json:"requester_membership_id,omitempty"`
	TypeID                  *int64     `json:"type_id,omitempty"`
	SLAPolicyID             *int64     `json:"sla_policy_id,omitempty"`
	SLAResponseAt           *time.Time `json:"sla_response_at,omitempty"`
	SLAResolveAt            *time.Time `json:"sla_resolve_at,omitempty"`
	ClosedAt                *time.Time `json:"closed_at,omitempty"`
	RequestKind             string     `json:"request_kind"`
	ApprovalStatus          string     `json:"approval_status"`
	SoftwareName            string     `json:"software_name,omitempty"`
	SoftwareRequestType     string     `json:"software_request_type,omitempty"`
	BusinessObjective       string     `json:"business_objective,omitempty"`
	TargetUsers             string     `json:"target_users,omitempty"`
	DesiredDueDate          *time.Time `json:"desired_due_date,omitempty"`
	ApprovedBy              *int64     `json:"approved_by,omitempty"`
	ApprovedAt              *time.Time `json:"approved_at,omitempty"`
	ApprovalNote            string     `json:"approval_note,omitempty"`
	TechnologyName          string     `json:"technology_name,omitempty"`
	VendorName              string     `json:"vendor_name,omitempty"`
	Specification           string     `json:"specification,omitempty"`
	EstimatedCost           *float64   `json:"estimated_cost,omitempty"`
	ManagerReviewedBy       *int64     `json:"manager_reviewed_by,omitempty"`
	ManagerReviewedAt       *time.Time `json:"manager_reviewed_at,omitempty"`
	ManagerReviewNote       string     `json:"manager_review_note,omitempty"`
	ITReviewedBy            *int64     `json:"it_reviewed_by,omitempty"`
	ITReviewedAt            *time.Time `json:"it_reviewed_at,omitempty"`
	ITReviewNote            string     `json:"it_review_note,omitempty"`
	ITRecommendation        string     `json:"it_recommendation,omitempty"`
	ITManagerRecommendation string     `json:"it_manager_recommendation,omitempty"`
	LegacyWorkflow          bool       `json:"legacy_workflow,omitempty"`
	CreatedByName           string     `json:"created_by_name,omitempty"`
	OrganizationName        string     `json:"organization_name,omitempty"`
	RequesterDisplayTitle   string     `json:"requester_display_title,omitempty"`
	RequesterIdentityType   string     `json:"requester_identity_type,omitempty"`
	ManagerReviewerName     string     `json:"manager_reviewer_name,omitempty"`
	ITReviewerName          string     `json:"it_reviewer_name,omitempty"`
	ITManagerReviewerName   string     `json:"it_manager_reviewer_name,omitempty"`
	CanManagerReview        bool       `json:"can_manager_review,omitempty"`
	CanITReview             bool       `json:"can_it_review,omitempty"`
	CanITManagerReview      bool       `json:"can_it_manager_review,omitempty"`
	CreatedAt               time.Time  `json:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at"`
	DeletedAt               *time.Time `json:"deleted_at,omitempty"`
}

type RequestWorkflowHistory struct {
	ID        int64     `json:"id"`
	TicketID  int64     `json:"ticket_id"`
	Stage     string    `json:"stage"`
	Decision  string    `json:"decision"`
	ActorID   int64     `json:"actor_id"`
	ActorName string    `json:"actor_name"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

type TicketType struct {
	ID        int64      `json:"id"`
	Name      string     `json:"name"`
	CreatedAt time.Time  `json:"created_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}

type TicketComment struct {
	ID         int64      `json:"id"`
	TicketID   int64      `json:"ticket_id"`
	UserID     int64      `json:"user_id"`
	Content    string     `json:"content"`
	IsInternal bool       `json:"is_internal"`
	CreatedAt  time.Time  `json:"created_at"`
	DeletedAt  *time.Time `json:"deleted_at,omitempty"`
	// Joined fields
	UserName  string `json:"user_name,omitempty"`
	UserEmail string `json:"user_email,omitempty"`
}

type TicketStatusHistory struct {
	ID         int64     `json:"id"`
	TicketID   int64     `json:"ticket_id"`
	FromStatus *string   `json:"from_status,omitempty"`
	ToStatus   string    `json:"to_status"`
	ChangedBy  int64     `json:"changed_by"`
	Note       *string   `json:"note,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	// Joined fields
	ChangedByName  string `json:"changed_by_name,omitempty"`
	ChangedByEmail string `json:"changed_by_email,omitempty"`
}

type SLAPolicy struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	Priority      string    `json:"priority"`
	ResponseHours int       `json:"response_hours"`
	ResolveHours  int       `json:"resolve_hours"`
	CreatedAt     time.Time `json:"created_at"`
}

type AssetType struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type AssetCategory struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	ParentID  *int64    `json:"parent_id,omitempty"`
	TypeID    int64     `json:"type_id"`
	CreatedAt time.Time `json:"created_at"`
}

type AssetModel struct {
	ID           int64      `json:"id"`
	Name         string     `json:"name"`
	Manufacturer string     `json:"manufacturer"`
	PartNumber   string     `json:"part_number"`
	CategoryID   *int64     `json:"category_id,omitempty"`
	TypeID       *int64     `json:"type_id,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty"`
}

type Asset struct {
	ID             int64      `json:"id"`
	Name           string     `json:"name"`
	Type           string     `json:"type"`
	TypeID         *int64     `json:"type_id,omitempty"`
	CategoryID     *int64     `json:"category_id,omitempty"`
	ModelID        *int64     `json:"model_id,omitempty"`
	Serial         string     `json:"serial"`
	Status         string     `json:"status"`
	Location       string     `json:"location"`
	AssignedTo     *int64     `json:"assigned_to"`
	CreatedBy      *int64     `json:"created_by,omitempty"`
	UpdatedBy      *int64     `json:"updated_by,omitempty"`
	DeletedBy      *int64     `json:"deleted_by,omitempty"`
	OrganizationID *int64     `json:"organization_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type User struct {
	ID               int64      `json:"id"`
	Email            string     `json:"email"`
	Name             string     `json:"name"`
	PasswordHash     string     `json:"-"`
	RoleID           *int64     `json:"role_id"`
	Role             string     `json:"role"`
	IsRoot           bool       `json:"is_root"`
	AvatarURL        *string    `json:"avatar_url,omitempty"`
	OrganizationID   *int64     `json:"organization_id,omitempty"`
	OrgIDs           []int64    `json:"org_ids,omitempty"`
	IdentitySource   string     `json:"identity_source,omitempty"`
	ExternalPersonID *string    `json:"external_person_id,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
	LockedUntil      *time.Time `json:"-"`
}

type UserSecurityView struct {
	User
	LockedUntil *time.Time `json:"locked_until,omitempty"`
}

type UserOrgDetail struct {
	MembershipID         int64   `json:"membership_id"`
	OrganizationID       int64   `json:"organization_id"`
	OrgName              string  `json:"org_name"`
	HoldingID            int64   `json:"holding_id"`
	HoldingName          string  `json:"holding_name"`
	RoleID               *int64  `json:"role_id,omitempty"`
	RoleName             string  `json:"role_name,omitempty"`
	RoleLabel            string  `json:"role_label,omitempty"`
	IdentityType         string  `json:"identity_type"`
	DisplayTitle         string  `json:"display_title,omitempty"`
	IdentitySource       string  `json:"identity_source"`
	ExternalMembershipID *string `json:"external_membership_id,omitempty"`
	IsActive             bool    `json:"is_active"`
	IsDefault            bool    `json:"is_default"`
}

type UserMembershipInput struct {
	OrganizationID       int64   `json:"organization_id"`
	RoleID               *int64  `json:"role_id"`
	IdentityType         string  `json:"identity_type"`
	DisplayTitle         string  `json:"display_title"`
	IdentitySource       string  `json:"identity_source"`
	ExternalMembershipID *string `json:"external_membership_id,omitempty"`
	IsDefault            bool    `json:"is_default"`
}

type ServiceRoute struct {
	ID                     int64     `json:"id"`
	ServiceKey             string    `json:"service_key"`
	ConsumerHoldingID      int64     `json:"consumer_holding_id"`
	ProviderOrganizationID int64     `json:"provider_organization_id"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type Role struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Label     string    `json:"label"`
	IsAdmin   bool      `json:"is_admin"`
	CreatedAt time.Time `json:"created_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token              string          `json:"token"`
	User               User            `json:"user"`
	Permissions        []string        `json:"permissions"`
	Memberships        []UserOrgDetail `json:"memberships"`
	ActiveMembershipID int64           `json:"active_membership_id"`
}

type LoginSecuritySettings struct {
	Enabled              bool      `json:"enabled"`
	AttemptWindowMinutes int       `json:"attempt_window_minutes"`
	IPAttemptLimit       int       `json:"ip_attempt_limit"`
	AccountAttemptLimit  int       `json:"account_attempt_limit"`
	AccountLockMinutes   int       `json:"account_lock_minutes"`
	UpdatedBy            *int64    `json:"updated_by,omitempty"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type LoginAttemptSummary struct {
	IPAddress    string    `json:"ip_address"`
	Email        *string   `json:"email,omitempty"`
	AttemptCount int64     `json:"attempt_count"`
	ActiveCount  int64     `json:"active_count"`
	LastAttempt  time.Time `json:"last_attempt"`
}

type Permission struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Module string `json:"module"`
	Action string `json:"action"`
}
