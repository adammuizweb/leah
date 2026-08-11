package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

type AuthorizationState struct {
	Email          string
	Role           string
	Permissions    []string
	IsRoot         bool
	OrganizationID int64
	OrgPath        string
	OrgIDs         []int64
	OrgPaths       []string
}

type AuthorizationLoader func(context.Context, int64) (*AuthorizationState, error)

const (
	CtxKeyUserID      ctxKey = "user_id"
	CtxKeyUserEmail   ctxKey = "user_email"
	CtxKeyUserRole    ctxKey = "user_role"
	CtxKeyPermissions ctxKey = "permissions"
	CtxKeyIsRoot      ctxKey = "is_root"
	CtxKeyOrgID       ctxKey = "organization_id"
	CtxKeyOrgPath     ctxKey = "org_path"
	CtxKeyOrgIDs      ctxKey = "org_ids"   // all accessible org IDs from JWT
	CtxKeyOrgPaths    ctxKey = "org_paths" // paths of those orgs
)

func Auth(secret string, load AuthorizationLoader) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "" {
				http.Error(w, `{"error":"missing authorization header"}`, 401)
				return
			}

			parts := strings.SplitN(auth, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, `{"error":"invalid authorization format"}`, 401)
				return
			}

			token, err := jwt.Parse(parts[1], func(_ *jwt.Token) (any, error) {
				return []byte(secret), nil
			}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
			if err != nil || !token.Valid {
				http.Error(w, `{"error":"invalid or expired token"}`, 401)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":"invalid token claims"}`, 401)
				return
			}

			rawUserID, ok := claims["user_id"].(float64)
			if !ok || rawUserID < 1 {
				http.Error(w, `{"error":"invalid token claims"}`, http.StatusUnauthorized)
				return
			}
			userID := int64(rawUserID)
			state, err := load(r.Context(), userID)
			if err != nil {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), CtxKeyUserID, userID)
			ctx = context.WithValue(ctx, CtxKeyUserEmail, state.Email)
			ctx = context.WithValue(ctx, CtxKeyUserRole, state.Role)
			ctx = context.WithValue(ctx, CtxKeyPermissions, state.Permissions)
			ctx = context.WithValue(ctx, CtxKeyIsRoot, state.IsRoot)
			ctx = context.WithValue(ctx, CtxKeyOrgID, state.OrganizationID)
			ctx = context.WithValue(ctx, CtxKeyOrgPath, state.OrgPath)
			ctx = context.WithValue(ctx, CtxKeyOrgIDs, state.OrgIDs)
			ctx = context.WithValue(ctx, CtxKeyOrgPaths, state.OrgPaths)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			perms, _ := r.Context().Value(CtxKeyPermissions).([]string)
			role, _ := r.Context().Value(CtxKeyUserRole).(string)
			isRoot, _ := r.Context().Value(CtxKeyIsRoot).(bool)

			// Root bypasses all permission and scope checks.
			if isRoot {
				next.ServeHTTP(w, r)
				return
			}

			// Admin role bypasses content permissions (tickets, assets, users),
			// but NOT settings.* (role/permission management)
			if role == "admin" && !strings.HasPrefix(permission, "settings.") {
				next.ServeHTTP(w, r)
				return
			}

			for _, p := range perms {
				if p == permission {
					next.ServeHTTP(w, r)
					return
				}
			}

			http.Error(w, `{"error":"forbidden"}`, 403)
		})
	}
}

func RequireRoot(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isRoot, _ := r.Context().Value(CtxKeyIsRoot).(bool)
		if !isRoot {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"root access required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
