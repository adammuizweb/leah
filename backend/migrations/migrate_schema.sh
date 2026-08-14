#!/bin/bash
set -euo pipefail

: "${DATABASE_OWNER_URL:?DATABASE_OWNER_URL must use the database owner}"
root_dir=$(cd "$(dirname "$0")/../.." && pwd)

migrations=(
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
    016_root_account.sql
    017_core_access.sql
    018_runtime_privileges.sql
    019_request_workflow.sql
)

psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);"

# Adopt databases created before the migration ledger existed. Validate the
# latest pre-ledger schema before recording migrations that must not be replayed.
ledger_count=$(psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 -Atc \
    "SELECT COUNT(*) FROM schema_migrations")
has_existing_schema=$(psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 -Atc \
    "SELECT (to_regclass('public.users') IS NOT NULL)::int")
if [[ "$ledger_count" == "0" && "$has_existing_schema" == "1" ]]; then
    if [[ "${ADOPT_EXISTING_SCHEMA:-}" != "1" ]]; then
        printf 'existing pre-ledger schema detected; back it up, verify it is at migration 014, then rerun with ADOPT_EXISTING_SCHEMA=1\n' >&2
        exit 1
    fi
    psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 --single-transaction <<'SQL'
DO $$
BEGIN
    IF EXISTS (
        SELECT required_name
        FROM unnest(ARRAY[
            'users', 'tickets', 'assets', 'roles', 'permissions',
            'role_permissions', 'asset_types', 'asset_categories', 'holdings',
            'organizations', 'user_organizations', 'asset_models',
            'ticket_types', 'ticket_status_history', 'ticket_comments',
            'sla_policies'
        ]) AS required(required_name)
        WHERE to_regclass('public.' || required_name) IS NULL
    ) OR EXISTS (
        SELECT * FROM (VALUES
            ('users', 'role_id'),
            ('users', 'organization_id'), ('users', 'deleted_at'),
            ('users', 'avatar_url'),
            ('tickets', 'updated_by'), ('tickets', 'deleted_by'),
            ('tickets', 'asset_id'), ('tickets', 'organization_id'),
            ('tickets', 'type_id'), ('tickets', 'sla_policy_id'),
            ('tickets', 'sla_response_at'), ('tickets', 'sla_resolve_at'),
            ('tickets', 'closed_at'), ('tickets', 'deleted_at'),
            ('assets', 'created_by'), ('assets', 'updated_by'),
            ('assets', 'deleted_by'), ('assets', 'organization_id'),
            ('assets', 'type_id'), ('assets', 'category_id'),
            ('assets', 'model_id'), ('assets', 'deleted_at'),
            ('asset_types', 'deleted_at'),
            ('asset_categories', 'deleted_at')
        ) AS expected(table_name, column_name)
        EXCEPT
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema='public'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users'
          AND column_name IN ('is_superuser', 'is_root')
    ) OR EXISTS (
        SELECT required_name
        FROM unnest(ARRAY[
            'assets.read.own', 'models.read', 'ticket_types.read',
            'tickets.comment', 'sla_policies.read'
        ]) AS required(required_name)
        WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name=required_name)
    ) THEN
        RAISE EXCEPTION 'existing schema is not at migration 014; migrate it manually before ledger adoption';
    END IF;
END $$;

INSERT INTO schema_migrations (name) VALUES
    ('001_init.sql'),
    ('002_roles.sql'),
    ('004_admin.sql'),
    ('005_superuser.sql'),
    ('006_audit_relations.sql'),
    ('007_asset_types.sql'),
    ('008_softdelete_types.sql'),
    ('009_holdings.sql'),
    ('010_user_organizations.sql'),
    ('011_asset_models.sql'),
    ('012_ticket_workflow.sql'),
    ('013_user_avatar.sql'),
    ('014_asset_read_own.sql');
SQL
fi

for migration in "${migrations[@]}"; do
    applied=$(psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 -Atc \
        "SELECT COUNT(*) FROM schema_migrations WHERE name='$migration'")
    if [[ "$applied" == "1" ]]; then
        continue
    fi
    psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 --single-transaction \
        -f "$root_dir/backend/migrations/$migration" \
        -c "INSERT INTO schema_migrations (name) VALUES ('$migration')"
done
