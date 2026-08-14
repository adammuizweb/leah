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
    IF (SELECT COUNT(*) FROM schema_migrations) <> 19 THEN
        RAISE EXCEPTION 'unexpected migration ledger size';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='is_root'
    ) THEN
        RAISE EXCEPTION 'adopted schema is missing users.is_root';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='tickets' AND column_name='request_kind'
    ) THEN
        RAISE EXCEPTION 'adopted schema is missing request workflow columns';
    END IF;
    IF (SELECT COUNT(*) FROM pg_constraint WHERE conrelid='tickets'::regclass AND conname IN (
        'tickets_request_kind_check', 'tickets_approval_status_check', 'tickets_software_request_fields_check',
        'tickets_it_recommendation_check', 'tickets_it_manager_recommendation_check', 'tickets_technology_review_fields_check'
    )) <> 6 THEN
        RAISE EXCEPTION 'request workflow constraints are missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name='requests.it_review') THEN
        RAISE EXCEPTION 'IT review permission is missing';
    END IF;
    IF to_regclass('request_workflow_history') IS NULL THEN
        RAISE EXCEPTION 'request workflow history is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='organizations' AND column_name='manager_user_id'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='holdings' AND column_name='it_organization_id'
    ) THEN
        RAISE EXCEPTION 'organization workflow routing columns are missing';
    END IF;
END
\$\$;"
