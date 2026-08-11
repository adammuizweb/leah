#!/bin/bash
set -euo pipefail

: "${LEAH_TEST_DATABASE_URL:?LEAH_TEST_DATABASE_URL must point to an empty disposable database owned by the migration user}"
root_dir=$(cd "$(dirname "$0")/../.." && pwd)

base_migrations=(
    001_init.sql
    002_roles.sql
    004_admin.sql
    005_superuser.sql
    006_audit_relations.sql
    007_asset_types.sql
    008_softdelete_types.sql
    009_holdings.sql
    010_user_organizations.sql
    011_asset_models.sql
    012_ticket_workflow.sql
    013_user_avatar.sql
    014_asset_read_own.sql
    015_login_rate_limit.sql
)

for migration in "${base_migrations[@]}"; do
    psql "$LEAH_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction \
        -f "$root_dir/backend/migrations/$migration"
done

psql "$LEAH_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO roles (name, label, is_admin) VALUES
    ('superadmin', 'Super Admin', TRUE),
    ('user', 'User', FALSE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (email, name, password_hash, role_id, is_superuser)
SELECT 'superuser@leah.lan', 'Superuser', 'non-public-test-hash', id, TRUE
FROM roles WHERE name='superadmin';
INSERT INTO users (email, name, password_hash, role_id)
SELECT 'user@leah.lan', 'User', 'non-public-test-hash', id
FROM roles WHERE name='user';
SQL

LEAH_TEST_DATABASE_URL="$LEAH_TEST_DATABASE_URL" \
    bash "$root_dir/backend/migrations/test_login_security.sh"
