# ─── Development ───────────────────────────────────────────
dev-backend:
	cd backend && go run ./cmd/api

dev-frontend:
	cd frontend && npm run dev

# ─── Build ─────────────────────────────────────────────────
build-backend:
	cd backend && go build -o leah ./cmd/api

build-frontend:
	cd frontend && npm ci && npm run build

build: build-backend build-frontend

# ─── Database ──────────────────────────────────────────────
migrate:
	DATABASE_OWNER_URL="$${DATABASE_OWNER_URL}" bash backend/migrations/migrate_schema.sh

bootstrap-root:
	cd backend && go run ./cmd/bootstrap-root

# ─── Production ────────────────────────────────────────────
run:
	./backend/leah

.PHONY: dev-backend dev-frontend build-backend build-frontend build migrate bootstrap-root run
