package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
}

func Load() (Config, error) {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if databaseURL == "" || strings.Contains(databaseURL, "replace-me") {
		return Config{}, fmt.Errorf("DATABASE_URL must be configured")
	}
	if len(jwtSecret) < 32 || strings.Contains(jwtSecret, "replace") || jwtSecret == "change-me-in-production" {
		return Config{}, fmt.Errorf("JWT_SECRET must contain at least 32 non-placeholder characters")
	}
	return Config{DatabaseURL: databaseURL, JWTSecret: jwtSecret}, nil
}
