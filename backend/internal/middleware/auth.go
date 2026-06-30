package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const (
	CtxKeyUserID         ctxKey = "user_id"
	CtxKeyUserEmail      ctxKey = "user_email"
	CtxKeyUserRole       ctxKey = "user_role"
	CtxKeyPermissions    ctxKey = "permissions"
	CtxKeyIsSuperuser    ctxKey = "is_superuser"
	CtxKeyOrgID          ctxKey = "organization_id"
	CtxKeyOrgPath        ctxKey = "org_path"
	CtxKeyOrgIDs         ctxKey = "org_ids"     // all accessible org IDs from JWT
	CtxKeyOrgPaths       ctxKey = "org_paths"   // paths of those orgs
)

func Auth(secret string) func(http.Handler) http.Handler {
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

			token, err := jwt.Parse(parts[1], func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"error":"invalid or expired token"}`, 401)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":"invalid token claims"}`, 401)
				return
			}

			userID := int64(claims["user_id"].(float64))
			email, _ := claims["email"].(string)
			role, _ := claims["role"].(string)
			isSuper, _ := claims["is_superuser"].(bool)
			orgID, _ := claims["organization_id"].(float64)
			orgPath, _ := claims["org_path"].(string)

			// Extract org IDs array
			var orgIDs []int64
			if rawIDs, ok := claims["org_ids"].([]any); ok {
				for _, v := range rawIDs {
					if f, ok := v.(float64); ok {
						orgIDs = append(orgIDs, int64(f))
					}
				}
			}

			// Extract org paths array
			var orgPaths []string
			if rawPaths, ok := claims["org_paths"].([]any); ok {
				for _, v := range rawPaths {
					if s, ok := v.(string); ok {
						orgPaths = append(orgPaths, s)
					}
				}
			}

			var perms []string
			if rawPerms, ok := claims["perms"].([]any); ok {
				for _, p := range rawPerms {
					if s, ok := p.(string); ok {
						perms = append(perms, s)
					}
				}
			}

			ctx := context.WithValue(r.Context(), CtxKeyUserID, userID)
			ctx = context.WithValue(ctx, CtxKeyUserEmail, email)
			ctx = context.WithValue(ctx, CtxKeyUserRole, role)
			ctx = context.WithValue(ctx, CtxKeyPermissions, perms)
			ctx = context.WithValue(ctx, CtxKeyIsSuperuser, isSuper)
			ctx = context.WithValue(ctx, CtxKeyOrgID, int64(orgID))
			ctx = context.WithValue(ctx, CtxKeyOrgPath, orgPath)
			ctx = context.WithValue(ctx, CtxKeyOrgIDs, orgIDs)
			ctx = context.WithValue(ctx, CtxKeyOrgPaths, orgPaths)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			perms, _ := r.Context().Value(CtxKeyPermissions).([]string)
			role, _ := r.Context().Value(CtxKeyUserRole).(string)
			isSuper, _ := r.Context().Value(CtxKeyIsSuperuser).(bool)

			// Superuser bypasses ALL checks
			if isSuper {
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
