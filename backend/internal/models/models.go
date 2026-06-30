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
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
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

type Asset struct {
	ID             int64      `json:"id"`
	Name           string     `json:"name"`
	Type           string     `json:"type"`
	TypeID         *int64     `json:"type_id,omitempty"`
	CategoryID     *int64     `json:"category_id,omitempty"`
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
