#!/bin/bash
set -euo pipefail

if [[ -z "${LEAH_TEST_DATABASE_URL:-}" ]]; then
    echo "LEAH_TEST_DATABASE_URL must point to a disposable migrated database" >&2
    exit 1
fi

root_dir=$(cd "$(dirname "$0")/../.." && pwd)

for _ in 1 2; do
    psql "$LEAH_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction \
        -f "$root_dir/backend/migrations/015_login_rate_limit.sql" \
        -f "$root_dir/backend/migrations/016_root_account.sql" \
        -f "$root_dir/backend/migrations/017_core_access.sql" \
        -f "$root_dir/backend/migrations/018_runtime_privileges.sql"
done

psql "$LEAH_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_root') THEN
        RAISE EXCEPTION 'users.is_root is missing';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_superuser') THEN
        RAISE EXCEPTION 'legacy users.is_superuser still exists';
    END IF;
    IF EXISTS (SELECT 1 FROM permissions WHERE name IN ('security.read', 'security.update')) THEN
        RAISE EXCEPTION 'role-based security permissions still exist';
    END IF;
    IF (SELECT COUNT(*) FROM users WHERE is_root=TRUE) <> 1 THEN
        RAISE EXCEPTION 'exactly one Root account is required';
    END IF;
    IF has_table_privilege('leah', 'login_security_settings', 'INSERT')
       OR has_table_privilege('leah', 'login_security_settings', 'DELETE') THEN
        RAISE EXCEPTION 'application role has excessive settings privileges';
    END IF;
    IF has_column_privilege('leah', 'login_security_settings', 'id', 'UPDATE') THEN
        RAISE EXCEPTION 'application role can update immutable settings ID';
    END IF;
    IF NOT has_column_privilege('leah', 'login_security_settings', 'enabled', 'UPDATE') THEN
        RAISE EXCEPTION 'application role cannot update settings';
    END IF;
    IF has_sequence_privilege('leah', 'login_attempts_id_seq', 'SELECT')
       OR NOT has_sequence_privilege('leah', 'login_attempts_id_seq', 'USAGE') THEN
        RAISE EXCEPTION 'application role sequence privileges are invalid';
    END IF;
END
\$\$;
"
