# LEAH production deployment

The Go API must only listen on loopback. Nginx normalizes the client IP before
forwarding it because login rate limiting must not trust arbitrary request
headers.

## Configuration

Provision the service user, PostgreSQL database/role, DNS names, and TLS
certificates before installation. Replace `leah.example.com` and certificate
paths in the templates with values for the target host.

1. Copy `leah.env.example` to `/etc/leah/leah.env`, replace all secrets, and set
   its mode to `0600`.
2. Install `nginx/leah-real-ip.conf` in `/etc/nginx/conf.d/` and `nginx/leah.conf`
   in `/etc/nginx/sites-available/`.
3. Install `systemd/leah.service` in `/etc/systemd/system/`.
4. Enable the Nginx site, build both applications, and install the backend binary.
5. Validate Nginx and systemd before reloading either service.

```bash
sudo install -d -o root -g root -m 0700 /etc/leah
sudo install -d -o leah -g leah -m 0750 /opt/leah/backend/uploads/avatars
sudo install -d -o root -g root -m 0755 /opt/leah/frontend/dist
sudo install -o root -g root -m 0600 deploy/leah.env.example /etc/leah/leah.env
# Edit /etc/leah/leah.env and replace every placeholder before continuing.
sudo install -o root -g root -m 0644 deploy/nginx/leah-real-ip.conf /etc/nginx/conf.d/leah-real-ip.conf
sudo install -o root -g root -m 0644 deploy/nginx/leah.conf /etc/nginx/sites-available/leah.conf
sudo ln -s /etc/nginx/sites-available/leah.conf /etc/nginx/sites-enabled/leah.conf
sudo install -o root -g root -m 0644 deploy/systemd/leah.service /etc/systemd/system/leah.service

go -C backend build -o /tmp/leah ./cmd/api
npm --prefix frontend ci
npm --prefix frontend run build
sudo install -o root -g root -m 0755 /tmp/leah /opt/leah/backend/leah
sudo cp -a frontend/dist/. /opt/leah/frontend/dist/
```

## Login security migrations

Back up PostgreSQL first, then apply the ordered production schema as the
database owner before restarting Leah. The development-only `003_seed.sql` is
intentionally excluded because it contains public demo credentials.

```bash
DATABASE_OWNER_URL=postgresql:///leah \
  sudo --preserve-env=DATABASE_OWNER_URL -u postgres \
  bash backend/migrations/migrate_schema.sh
```

`016_root_account.sql` renames the account-level bypass flag from
`is_superuser` to `is_root` and removes delegable role permissions for global
login security. Rotate `JWT_SECRET` during this deployment so existing tokens
cannot retain legacy claims.

For installations created before `schema_migrations` existed, back up and
verify the database first, then run once with `ADOPT_EXISTING_SCHEMA=1`. The
runner validates the migration-014 schema and records that baseline instead of
replaying non-idempotent historical migrations. Without this explicit flag it
refuses to adopt an existing schema.

For a fresh production database, create Root only after all schema migrations.
The password is hashed by the bootstrap command and is never stored in source:

```bash
export DATABASE_OWNER_URL='postgresql:///leah'
export ROOT_EMAIL='choose-a-private-root-email@example.com'
read -r -s ROOT_PASSWORD
export ROOT_PASSWORD
go -C backend build -o /tmp/leah-bootstrap-root ./cmd/bootstrap-root
sudo --preserve-env=DATABASE_OWNER_URL,ROOT_EMAIL,ROOT_PASSWORD \
  -u postgres /tmp/leah-bootstrap-root
rm /tmp/leah-bootstrap-root
unset ROOT_PASSWORD ROOT_EMAIL DATABASE_OWNER_URL
```

Alternatively, set `DATABASE_OWNER_URL`, `ROOT_EMAIL`, and `ROOT_PASSWORD` in
the ignored `backend/.env`, build `cmd/bootstrap-root`, and execute it as the
database owner. Remove `ROOT_PASSWORD` from the file immediately afterward;
the database retains only its bcrypt hash. Running bootstrap again safely
changes the existing Root email/password without creating a second Root.

## Verification

```bash
go -C backend test ./...
go -C backend test -race ./...
npm --prefix frontend run build
sudo nginx -t
sudo systemd-analyze verify deploy/systemd/leah.service
sudo systemctl daemon-reload
sudo systemctl enable --now leah nginx
sudo systemctl reload nginx
sudo systemctl restart leah
systemctl is-active leah nginx
curl --fail https://leah.example.com/api/health
```

Run `backend/migrations/test_login_security.sh` only against a disposable clone
by setting `LEAH_TEST_DATABASE_URL`.

Run `backend/test_login_security_e2e.sh` against a deployed test instance by
providing `ROOT_EMAIL`, `ROOT_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`TEST_USER_EMAIL`, and `TEST_USER_PASSWORD`. The script restores settings and
unlocks its test account on exit.
