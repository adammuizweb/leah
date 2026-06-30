# ─── Development ───────────────────────────────────────────
dev-backend:
	cd backend && go run ./cmd/api

dev-frontend:
	cd frontend && npm run dev

# ─── Build ─────────────────────────────────────────────────
build-backend:
	cd backend && go build -o leah ./cmd/api

build-frontend:
	cd frontend && npm install && npm run build

build: build-backend build-frontend

# ─── Database ──────────────────────────────────────────────
migrate:
	psql -U leah -d leah -f backend/migrations/001_init.sql

# ─── Production ────────────────────────────────────────────
run:
	./backend/leah

.PHONY: dev-backend dev-frontend build-backend build-frontend build migrate run
