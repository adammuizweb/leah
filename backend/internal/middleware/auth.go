package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const (
	CtxKeyUserID      ctxKey = "user_id"
	CtxKeyUserEmail   ctxKey = "user_email"
	CtxKeyUserRole    ctxKey = "user_role"
	CtxKeyPermissions ctxKey = "permissions"
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

			ctx := context.WithValue(r.Context(), CtxKeyUserID, userID)
			ctx = context.WithValue(ctx, CtxKeyUserEmail, email)
			ctx = context.WithValue(ctx, CtxKeyUserRole, role)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequirePermission(permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			perms, _ := r.Context().Value(CtxKeyPermissions).([]string)

			// Admin bypass
			role, _ := r.Context().Value(CtxKeyUserRole).(string)
			if role == "admin" {
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
