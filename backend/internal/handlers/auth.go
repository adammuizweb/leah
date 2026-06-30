package handlers

import (
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID      int64    `json:"user_id"`
	Email       string   `json:"email"`
	Role        string   `json:"role"`
	Permissions []string `json:"perms"`
	IsSuperuser bool     `json:"is_superuser"`
	jwt.RegisteredClaims
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Email == "" || req.Password == "" {
		respond(w, 400, map[string]string{"error": "email and password required"})
		return
	}

	user, err := h.svc.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		respond(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		respond(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	perms, err := h.svc.GetUserPermissions(r.Context(), user.ID)
	if err != nil {
		respond(w, 500, map[string]string{"error": "internal server error"})
		return
	}

	permNames := make([]string, len(perms))
	for i, p := range perms {
		permNames[i] = p.Name
	}

	secret := h.jwtSecret
	if secret == "" {
		secret = "change-me-in-production"
	}

	claims := Claims{
		UserID:      user.ID,
		Email:       user.Email,
		Role:        user.Role,
		Permissions: permNames,
		IsSuperuser: user.IsSuperuser,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		respond(w, 500, map[string]string{"error": "failed to generate token"})
		return
	}

	respond(w, 200, models.AuthResponse{
		Token: tokenString,
		User:  *user,
	})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.CtxKeyUserID).(int64)

	user, err := h.svc.GetUserByID(r.Context(), userID)
	if err != nil {
		respond(w, 404, map[string]string{"error": "user not found"})
		return
	}

	perms, err := h.svc.GetUserPermissions(r.Context(), userID)
	if err != nil {
		respond(w, 500, map[string]string{"error": "internal server error"})
		return
	}

	permNames := make([]string, len(perms))
	for i, p := range perms {
		permNames[i] = p.Name
	}

	respond(w, 200, map[string]any{
		"user":        user,
		"permissions": permNames,
	})
}
