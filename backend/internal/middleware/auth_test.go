package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func TestRequireRoot(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	t.Run("allows root", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/api/security/login", nil)
		r = r.WithContext(context.WithValue(r.Context(), CtxKeyIsRoot, true))
		w := httptest.NewRecorder()
		RequireRoot(next).ServeHTTP(w, r)
		if w.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want 204", w.Code)
		}
	})

	t.Run("rejects non-root", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/api/security/login", nil)
		w := httptest.NewRecorder()
		RequireRoot(next).ServeHTTP(w, r)
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", w.Code)
		}
	})
}

func TestAuthLoadsCurrentRootAccess(t *testing.T) {
	const secret = "test-secret"
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":         float64(1),
		"email":           "root@leah.lan",
		"role":            "superadmin",
		"is_root":         true,
		"organization_id": float64(0),
	})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isRoot, _ := r.Context().Value(CtxKeyIsRoot).(bool); !isRoot {
			t.Error("root claim was not added to context")
		}
		w.WriteHeader(http.StatusNoContent)
	})
	r := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	r.Header.Set("Authorization", "Bearer "+signed)
	w := httptest.NewRecorder()
	load := func(context.Context, int64) (*AuthorizationState, error) {
		return &AuthorizationState{IsRoot: true}, nil
	}
	Auth(secret, load)(next).ServeHTTP(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", w.Code)
	}
}

func TestAuthRejectsRevokedUser(t *testing.T) {
	const secret = "test-secret"
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"user_id": float64(7)})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}

	load := func(context.Context, int64) (*AuthorizationState, error) {
		return nil, errors.New("user deleted")
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("revoked user reached the next handler")
		w.WriteHeader(http.StatusNoContent)
	})
	r := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	r.Header.Set("Authorization", "Bearer "+signed)
	w := httptest.NewRecorder()
	Auth(secret, load)(next).ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}

func TestAuthRejectsMissingUserID(t *testing.T) {
	const secret = "test-secret"
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"email": "user@example.com"})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("request with missing user ID reached the next handler")
		w.WriteHeader(http.StatusNoContent)
	})
	r := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	r.Header.Set("Authorization", "Bearer "+signed)
	w := httptest.NewRecorder()
	load := func(context.Context, int64) (*AuthorizationState, error) {
		return &AuthorizationState{}, nil
	}
	Auth(secret, load)(next).ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}
