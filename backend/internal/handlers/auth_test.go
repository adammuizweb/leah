package handlers

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/adammuiz/leah/internal/models"
)

func TestClientIPIgnoresForwardedHeadersFromUntrustedPeer(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/auth/login", nil)
	r.RemoteAddr = "192.0.2.10:1234"
	r.Header.Set("CF-Connecting-IP", "203.0.113.20")
	r.Header.Set("X-Real-IP", "203.0.113.21")

	if got := clientIP(r); got != "192.0.2.10" {
		t.Fatalf("clientIP() = %q, want direct peer IP", got)
	}
}

func TestEvaluateLoginFailure(t *testing.T) {
	now := time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC)
	first := now.Add(-2 * time.Minute)
	settings := &models.LoginSecuritySettings{
		AttemptWindowMinutes: 15,
		IPAttemptLimit:       5,
		AccountAttemptLimit:  8,
		AccountLockMinutes:   60,
	}

	tests := []struct {
		name              string
		ipFailures        int
		accountFailures   int
		wantRateLimited   bool
		wantAccountLocked bool
	}{
		{name: "below thresholds", ipFailures: 4, accountFailures: 7},
		{name: "IP threshold", ipFailures: 5, accountFailures: 7, wantRateLimited: true},
		{name: "account threshold", ipFailures: 4, accountFailures: 8, wantAccountLocked: true},
		{name: "both thresholds", ipFailures: 5, accountFailures: 8, wantRateLimited: true, wantAccountLocked: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluateLoginFailure(settings, tt.ipFailures, tt.accountFailures, first, now)
			if got.RateLimited != tt.wantRateLimited || got.LockAccount != tt.wantAccountLocked {
				t.Fatalf("evaluateLoginFailure() = rate:%v lock:%v", got.RateLimited, got.LockAccount)
			}
			if got.RetryAt != first.Add(15*time.Minute) {
				t.Fatalf("RetryAt = %v", got.RetryAt)
			}
			if got.LockedUntil != now.Add(time.Hour) {
				t.Fatalf("LockedUntil = %v", got.LockedUntil)
			}
		})
	}
}

func TestInvalidCredentialsResponseDoesNotDiscloseLockState(t *testing.T) {
	w := httptest.NewRecorder()
	respondInvalidCredentials(w)
	if w.Code != 401 {
		t.Fatalf("status = %d, want 401", w.Code)
	}
	if body := w.Body.String(); body != "{\"error\":\"invalid credentials\"}\n" {
		t.Fatalf("body = %q", body)
	}
}

func TestClientIPTrustsRealIPFromLoopbackProxy(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/auth/login", nil)
	r.RemoteAddr = "127.0.0.1:1234"
	r.Header.Set("CF-Connecting-IP", "203.0.113.20")
	r.Header.Set("X-Real-IP", "192.0.2.10")

	if got := clientIP(r); got != "192.0.2.10" {
		t.Fatalf("clientIP() = %q, want Nginx-normalized client IP", got)
	}
}

func TestClientIPFallsBackToRealIPFromLoopbackProxy(t *testing.T) {
	r := httptest.NewRequest("POST", "/api/auth/login", nil)
	r.RemoteAddr = "[::1]:1234"
	r.Header.Set("X-Real-IP", "192.0.2.10")

	if got := clientIP(r); got != "192.0.2.10" {
		t.Fatalf("clientIP() = %q, want Nginx real IP", got)
	}
}
