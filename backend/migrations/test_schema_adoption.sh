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
)

for migration in "${base_migrations[@]}"; do
    psql "$LEAH_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction \
        -f "$root_dir/backend/migrations/$migration"
done

ADOPT_EXISTING_SCHEMA=1 DATABASE_OWNER_URL="$LEAH_TEST_DATABASE_URL" \
    bash "$root_dir/backend/migrations/migrate_schema.sh"
DATABASE_OWNER_URL="$LEAH_TEST_DATABASE_URL" \
    bash "$root_dir/backend/migrations/migrate_schema.sh"

psql "$LEAH_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
DO \$\$
BEGIN
    IF (SELECT COUNT(*) FROM schema_migrations) <> 17 THEN
        RAISE EXCEPTION 'unexpected migration ledger size';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='is_root'
    ) THEN
        RAISE EXCEPTION 'adopted schema is missing users.is_root';
    END IF;
END
\$\$;"
