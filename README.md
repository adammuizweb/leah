# LEAH

LEAH (List Everything Assets & Helpdesk) is a lightweight IT asset management
and helpdesk application. It combines an asset inventory, ticket workflows,
organization-aware access, role-based administration, and configurable login
protection in a React single-page application backed by a Go API and PostgreSQL.

[![CI](https://github.com/adammuizweb/leah/actions/workflows/ci.yml/badge.svg)](https://github.com/adammuizweb/leah/actions/workflows/ci.yml)

## Features

- Unified employee requests for IT help, new applications, and IT reviews of
  technology or vendors, with priorities, assignment, comments, status history,
  and SLA deadlines.
- Formal request routing from the requester's department manager to IT review
  and IT manager sign-off, with an immutable decision trail. IT review records a
  technical recommendation and does not replace the Finance purchasing process.
- Asset inventory with types, hierarchical categories, reusable models,
  assignment, ticket relationships, and bulk creation.
- Holdings and hierarchical organizations with scoped data access, inherited
  department managers, and an explicitly configured IT destination.
- Configurable roles and granular permissions.
- Soft deletion, restore, and permanent-delete workflows.
- User profiles and avatar uploads.
- Root-only login security administration.
- Failed-login limits by IP and account with temporary account lockout.
- Responsive administration UI for desktop and mobile.

## Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.22+, Chi, pgx, JWT, bcrypt |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Database | PostgreSQL 17+ |
| Production | Nginx and systemd |

```text
Browser
  -> Nginx (TLS and static frontend)
      -> /api/*
          -> Go API on 127.0.0.1:8080
              -> PostgreSQL
```

## Prerequisites

- Go 1.22 or newer
- Node.js 22 or newer and npm
- PostgreSQL 17 or newer, including `psql`
- Bash
- `curl` and `jq` for the optional deployed security test
- Nginx, systemd, DNS, and TLS certificates for production

The migration scripts expect a restricted PostgreSQL runtime role named
`leah`. Schema migrations and Root bootstrap must use a separate database-owner
connection.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/adammuizweb/leah.git
cd leah
npm --prefix frontend ci
```

### 2. Prepare PostgreSQL

Create a database and a restricted login role named `leah`. Choose passwords
interactively or through your secret-management system; do not put real
credentials in shell history or tracked files.

The following commands open PostgreSQL as its local administrator:

```bash
sudo -u postgres createuser --no-superuser --no-createdb --no-createrole leah
sudo -u postgres createdb leah
sudo -u postgres psql
```

Inside `psql`, assign a strong runtime password:

```sql
\password leah
\q
```

### 3. Apply the production schema

The supported runner records applied migrations in `schema_migrations` and can
be resumed safely:

```bash
export DATABASE_OWNER_URL='postgresql:///leah'
sudo --preserve-env=DATABASE_OWNER_URL -u postgres \
  bash backend/migrations/migrate_schema.sh
```

For an existing installation created before the migration ledger, back it up
and verify it is at migration 014 before running once with
`ADOPT_EXISTING_SCHEMA=1`. The runner refuses implicit schema adoption.

> Never run `backend/migrations/003_seed.sql` in production. It contains public
> development fixtures and known demo credentials. The production runner
> intentionally excludes it.

### 4. Bootstrap Root

Root is a single account-level security flag, not a role. Choose a private email
address and a unique password. No default Root login is created on a fresh
production database.

```bash
go -C backend build -o /tmp/leah-bootstrap-root ./cmd/bootstrap-root

export DATABASE_OWNER_URL='postgresql:///leah'
export ROOT_EMAIL='private-root@example.com'
read -r -s ROOT_PASSWORD
export ROOT_PASSWORD

sudo --preserve-env=DATABASE_OWNER_URL,ROOT_EMAIL,ROOT_PASSWORD \
  -u postgres /tmp/leah-bootstrap-root

unset ROOT_PASSWORD ROOT_EMAIL DATABASE_OWNER_URL
rm /tmp/leah-bootstrap-root
```

The bootstrap stores a bcrypt cost-12 hash, enforces exactly one Root, and can
be run again to change the existing Root email or password. Do not keep
`ROOT_PASSWORD` in a long-lived environment file.

### 5. Configure the API

```bash
cp backend/.env.example backend/.env
```

Replace every placeholder in `backend/.env`. The API refuses to start with a
missing/placeholder database URL or a JWT secret shorter than 32 characters.
The local `.env` file is ignored by Git.

### 6. Run development servers

Use two terminals:

```bash
make dev-backend
```

```bash
make dev-frontend
```

Open `http://localhost:5173`. Vite proxies `/api` requests to
`http://localhost:8080`.

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | API | Required restricted runtime PostgreSQL URL |
| `JWT_SECRET` | API | Required; at least 32 non-placeholder characters |
| `HOST` | API | Bind address; defaults to `127.0.0.1` |
| `PORT` | API | API port; defaults to `8080` |
| `CORS_ORIGINS` | API | Allowed frontend origin |
| `DATABASE_OWNER_URL` | Migrations/bootstrap | Database-owner connection |
| `ROOT_EMAIL` | Bootstrap | Required private Root email |
| `ROOT_PASSWORD` | Bootstrap | Required; minimum 16 characters |
| `VITE_API_PROXY` | Vite | Optional API proxy target |
| `LEAH_TEST_DATABASE_URL` | Tests | Disposable migrated test database |

Public examples are provided in [`backend/.env.example`](backend/.env.example)
and [`deploy/leah.env.example`](deploy/leah.env.example). Never commit populated
environment files, database dumps, certificates, or private keys.

## Login Security

Default login protection:

| Setting | Default |
|---|---:|
| Rolling attempt window | 15 minutes |
| Failed attempts per IP | 5 |
| Failed attempts per account | 8 |
| Account lock duration | 24 hours |
| Failed-attempt retention | 30 days |

- IP limits return HTTP `429` with `Retry-After`.
- Public authentication errors do not disclose whether an account exists or is
  locked.
- Root cannot be account-locked, but failed Root attempts still count toward
  the IP limit.
- Only Root can view/change global login security, clear failed-attempt history,
  or unlock users.
- PostgreSQL advisory transaction locks enforce thresholds across concurrent
  API processes.
- Nginx must normalize the real client IP before forwarding requests. Keep the
  Go API bound to loopback and use the supplied deployment template.

## Roles and Root

- **Root**: unique account-level bypass for global security and recovery.
- **Superadmin**: explicit role permissions, excluding Root-only operations.
- **Admin**: content and user management without global settings privileges.
- **Agent**: ticket and asset operations assigned through permissions.
- **User**: restricted self-service access.

The runtime database role cannot create, promote, rename, lock, or delete Root.
Root bootstrap therefore requires the database-owner connection.

## Testing

```bash
go -C backend test ./...
go -C backend test -race ./...
go -C backend vet ./...
npm --prefix frontend ci
npm --prefix frontend run build
```

CI also provisions disposable PostgreSQL databases, replays the production
migration runner twice, validates Root/security migrations, and runs repository
integration tests.

For a deployed test instance:

```bash
ROOT_EMAIL='...' ROOT_PASSWORD='...' \
ADMIN_EMAIL='...' ADMIN_PASSWORD='...' \
TEST_USER_EMAIL='...' TEST_USER_PASSWORD='...' \
LEAH_API_URL='http://127.0.0.1:8080/api' \
bash backend/test_login_security_e2e.sh
```

The script temporarily changes login-security settings and restores them on
exit. Use only a test account and a controlled instance.

## Production Deployment

See [`deploy/README.md`](deploy/README.md) for the Nginx/systemd deployment
flow. The templates use documentation-only domains and generic `/opt/leah`
paths; customize them for your environment.

## Project Structure

```text
.github/workflows/ci.yml       CI and database-backed tests
backend/
  cmd/api/                     API entry point
  cmd/bootstrap-root/          owner-only Root bootstrap
  internal/                    handlers, services, repository, middleware
  migrations/                  schema and security migration runners
frontend/
  public/                      static assets
  src/components/              reusable UI
  src/pages/                   public, application, and admin pages
  src/services/                API client and authentication state
deploy/                        generic Nginx/systemd templates
```

## Security Notes

- Keep `backend/.env`, `/etc/leah/leah.env`, backups, uploads, certificates, and
  keys outside Git.
- Use a private Root email and a password manager-generated password.
- Rotate `JWT_SECRET` when changing authentication claims or after a suspected
  token leak.
- Back up PostgreSQL before applying migrations.
- Do not expose port `8080` directly to untrusted networks.
- Report suspected vulnerabilities privately to the repository owner rather
  than opening a public issue with exploit details.

## License

No license file is currently included. Until a license is added, standard
copyright rules apply.
