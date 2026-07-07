package models

import "time"

type Holding struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"created_at"`
}

type Organization struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	ParentID  *int64    `json:"parent_id,omitempty"`
	HoldingID int64     `json:"holding_id"`
	Path      string    `json:"path"`
	Level     int       `json:"level"`
	CreatedAt time.Time `json:"created_at"`
}

type Ticket struct {
	ID             int64      `json:"id"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	Status         string     `json:"status"`
	Priority       string     `json:"priority"`
	AssignedTo     *int64     `json:"assigned_to"`
	CreatedBy      int64      `json:"created_by"`
	UpdatedBy      *int64     `json:"updated_by,omitempty"`
	DeletedBy      *int64     `json:"deleted_by,omitempty"`
	AssetID        *int64     `json:"asset_id,omitempty"`
	OrganizationID *int64     `json:"organization_id,omitempty"`
	TypeID         *int64     `json:"type_id,omitempty"`
	SLAPolicyID    *int64     `json:"sla_policy_id,omitempty"`
	SLAResponseAt  *time.Time `json:"sla_response_at,omitempty"`
	SLAResolveAt   *time.Time `json:"sla_resolve_at,omitempty"`
	ClosedAt       *time.Time `json:"closed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
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
	ID             int64      `json:"id"`
	Email          string     `json:"email"`
	Name           string     `json:"name"`
	PasswordHash   string     `json:"-"`
	RoleID         *int64     `json:"role_id"`
	Role           string     `json:"role"`
	IsSuperuser    bool       `json:"is_superuser"`
	OrganizationID *int64     `json:"organization_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
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
	Token string `json:"token"`
	User  User   `json:"user"`
}

type Permission struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Module string `json:"module"`
	Action string `json:"action"`
}
