package models

import "time"

type Ticket struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Priority    string    `json:"priority"`
	AssignedTo  *int64    `json:"assigned_to"`
	CreatedBy   int64     `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Asset struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Serial      string    `json:"serial"`
	Status      string    `json:"status"`
	Location    string    `json:"location"`
	AssignedTo  *int64    `json:"assigned_to"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type User struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	PasswordHash string    `json:"-"`
	RoleID       *int64    `json:"role_id"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
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
