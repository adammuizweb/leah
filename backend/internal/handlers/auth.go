package handlers

import (
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/services"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID         int64    `json:"user_id"`
	Email          string   `json:"email"`
	Role           string   `json:"role"`
	Permissions    []string `json:"perms"`
	IsRoot         bool     `json:"is_root"`
	OrganizationID int64    `json:"organization_id"`
	OrgPath        string   `json:"org_path"`
	OrgIDs         []int64  `json:"org_ids"`
	OrgPaths       []string `json:"org_paths"`
	jwt.RegisteredClaims
}

const dummyPasswordHash = "$2b$12$I.NY04zy0/7HoIII.mUfzuhckWoKK4VsYBBOtOr6atm47gbCNMkfy"

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || req.Password == "" {
		respond(w, 400, map[string]string{"error": "email and password required"})
		return
	}

	settings, err := h.svc.GetLoginSecuritySettings(r.Context())
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
		return
	}
	ip := clientIP(r)
	releaseLoginLock := func() error { return nil }
	if settings.Enabled {
		lockedCtx, release, err := h.svc.AcquireLoginLock(r.Context(), ip, req.Email)
		if err != nil {
			if errors.Is(err, services.ErrLoginLockBusy) {
				respondLoginRateLimited(w, time.Now().Add(time.Second))
				return
			}
			respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
			return
		}
		r = r.WithContext(lockedCtx)
		releaseLoginLock = release
		defer func() { _ = releaseLoginLock() }()
	}
	now := time.Now()
	windowStart := now.Add(-time.Duration(settings.AttemptWindowMinutes) * time.Minute)
	if settings.Enabled {
		count, first, err := h.svc.CountIPLoginFailures(r.Context(), ip, windowStart)
		if err != nil {
			respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
			return
		}
		if count >= settings.IPAttemptLimit {
			respondLoginRateLimited(w, first.Add(time.Duration(settings.AttemptWindowMinutes)*time.Minute))
			return
		}
	}

	user, err := h.svc.GetUserByEmail(r.Context(), req.Email)
	if err != nil || user.DeletedAt != nil {
		_ = bcrypt.CompareHashAndPassword([]byte(dummyPasswordHash), []byte(req.Password))
		if settings.Enabled {
			h.recordLoginFailure(w, r, settings, ip, req.Email, nil, nil, windowStart, now)
			return
		}
		respond(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	if settings.Enabled && user.LockedUntil != nil && user.LockedUntil.After(now) {
		_ = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
		h.recordLoginFailure(w, r, settings, ip, req.Email, nil, nil, windowStart, now)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		if settings.Enabled {
			if user.IsRoot {
				h.recordLoginFailure(w, r, settings, ip, req.Email, nil, nil, windowStart, now)
			} else {
				h.recordLoginFailure(w, r, settings, ip, req.Email, &user.Email, user, windowStart, now)
			}
			return
		}
		respond(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	if settings.Enabled {
		if err := h.svc.ResolveLoginFailures(r.Context(), user.Email); err != nil {
			respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
			return
		}
	}
	passwordCost, _ := bcrypt.Cost([]byte(user.PasswordHash))
	if err := releaseLoginLock(); err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
		return
	}
	releaseLoginLock = func() error { return nil }
	if passwordCost < services.PasswordHashCost {
		if err := h.svc.UpgradePasswordHash(r.Context(), user.ID, req.Password); err != nil {
			respond(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			return
		}
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

	orgID := int64(0)
	orgPath := ""
	if user.OrganizationID != nil {
		orgID = *user.OrganizationID
	}

	// Get all organizations this user belongs to
	orgIDs, err := h.svc.GetUserOrganizationIDs(r.Context(), user.ID)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve organization scope"})
		return
	}
	orgIDList := make([]int64, 0)
	orgPaths := make([]string, 0)
	seenOrgIDs := make(map[int64]bool)
	for _, oid := range orgIDs {
		if seenOrgIDs[oid] {
			continue
		}
		seenOrgIDs[oid] = true
		orgIDList = append(orgIDList, oid)
		org, err := h.svc.GetOrganization(r.Context(), oid)
		if err != nil {
			respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve organization scope"})
			return
		}
		orgPaths = append(orgPaths, org.Path)
		if oid == orgID {
			orgPath = org.Path
		}
	}
	if user.OrganizationID != nil && *user.OrganizationID > 0 && !seenOrgIDs[*user.OrganizationID] {
		org, err := h.svc.GetOrganization(r.Context(), *user.OrganizationID)
		if err != nil {
			respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to resolve organization scope"})
			return
		}
		orgIDList = append(orgIDList, org.ID)
		orgPaths = append(orgPaths, org.Path)
		orgPath = org.Path
	}

	claims := Claims{
		UserID:         user.ID,
		Email:          user.Email,
		Role:           user.Role,
		Permissions:    permNames,
		IsRoot:         user.IsRoot,
		OrganizationID: orgID,
		OrgPath:        orgPath,
		OrgIDs:         orgIDList,
		OrgPaths:       orgPaths,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		respond(w, 500, map[string]string{"error": "failed to generate token"})
		return
	}

	respond(w, 200, models.AuthResponse{
		Token:       tokenString,
		User:        *user,
		Permissions: permNames,
	})
}

func (h *Handler) recordLoginFailure(w http.ResponseWriter, r *http.Request, settings *models.LoginSecuritySettings, ip, accountKey string, email *string, user *models.User, windowStart, now time.Time) {
	if err := h.svc.RecordLoginFailure(r.Context(), ip, email); err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
		return
	}

	count, err := h.svc.CountEmailLoginFailures(r.Context(), accountKey, windowStart)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
		return
	}
	accountFailures := 0
	if email != nil && user != nil {
		accountFailures = count
	}

	ipFailures, first, err := h.svc.CountIPLoginFailures(r.Context(), ip, windowStart)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
		return
	}
	decision := evaluateLoginFailure(settings, ipFailures, accountFailures, first, now)
	if decision.LockAccount && user != nil {
		if err := h.svc.LockUser(r.Context(), user.ID, decision.LockedUntil); err != nil {
			respond(w, http.StatusInternalServerError, map[string]string{"error": "login security is unavailable"})
			return
		}
	}
	if decision.RateLimited {
		respondLoginRateLimited(w, decision.RetryAt)
		return
	}
	respondInvalidCredentials(w)
}

type loginFailureDecision struct {
	LockAccount bool
	LockedUntil time.Time
	RateLimited bool
	RetryAt     time.Time
}

func evaluateLoginFailure(settings *models.LoginSecuritySettings, ipFailures, accountFailures int, firstFailure, now time.Time) loginFailureDecision {
	return loginFailureDecision{
		LockAccount: accountFailures >= settings.AccountAttemptLimit,
		LockedUntil: now.Add(time.Duration(settings.AccountLockMinutes) * time.Minute),
		RateLimited: ipFailures >= settings.IPAttemptLimit,
		RetryAt:     firstFailure.Add(time.Duration(settings.AttemptWindowMinutes) * time.Minute),
	}
}

func respondInvalidCredentials(w http.ResponseWriter) {
	respond(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
}

func respondLoginRateLimited(w http.ResponseWriter, until time.Time) {
	retryAfter := secondsUntil(until)
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	respond(w, http.StatusTooManyRequests, map[string]any{
		"error":       "too many failed login attempts; try again later",
		"retry_after": retryAfter,
	})
}

func secondsUntil(until time.Time) int {
	seconds := int(time.Until(until).Seconds()) + 1
	if seconds < 1 {
		return 1
	}
	return seconds
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	remoteIP := net.ParseIP(host)
	if remoteIP == nil {
		return "0.0.0.0"
	}

	if remoteIP.IsLoopback() {
		if forwarded := net.ParseIP(strings.TrimSpace(r.Header.Get("X-Real-IP"))); forwarded != nil {
			return forwarded.String()
		}
	}
	return remoteIP.String()
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
