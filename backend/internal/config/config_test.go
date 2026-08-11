package config

import "testing"

func TestLoadRejectsMissingOrPlaceholderSecrets(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JWT_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("Load accepted missing configuration")
	}

	t.Setenv("DATABASE_URL", "postgres://leah:replace-me@localhost/leah")
	t.Setenv("JWT_SECRET", "replace-with-at-least-32-random-bytes")
	if _, err := Load(); err == nil {
		t.Fatal("Load accepted placeholder configuration")
	}
}

func TestLoadAcceptsStrongConfiguration(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://leah:strong-password@localhost/leah")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" {
		t.Fatal("Load returned empty configuration")
	}
}
