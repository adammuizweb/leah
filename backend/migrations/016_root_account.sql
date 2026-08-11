-- Root is an account-level bypass flag, not a role.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='is_superuser'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='is_root'
    ) THEN
        ALTER TABLE users RENAME COLUMN is_superuser TO is_root;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='is_superuser'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='is_root'
    ) THEN
        UPDATE users SET is_root=(is_root OR is_superuser);
        ALTER TABLE users DROP COLUMN is_superuser;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='is_root'
    ) THEN
        ALTER TABLE users ADD COLUMN is_root BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_users_is_superuser;
CREATE INDEX IF NOT EXISTS idx_users_is_root ON users(is_root);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM users
        WHERE is_root=TRUE
          AND password_hash='$2b$12$I.NY04zy0/7HoIII.mUfzuhckWoKK4VsYBBOtOr6atm47gbCNMkfy'
    ) THEN
        RAISE EXCEPTION 'refusing to promote public seed credentials to Root; rotate the password first';
    END IF;
END $$;

-- Preserve customized legacy bypass identities. The database owner can rename or
-- create Root with cmd/bootstrap-root after this migration.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM users WHERE is_root=TRUE) > 1 THEN
        RAISE EXCEPTION 'multiple legacy Root accounts found; resolve them as the database owner';
    END IF;
END $$;
UPDATE users SET locked_until=NULL WHERE is_root=TRUE;

-- Security administration is root-only and cannot be delegated through roles.
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE name IN ('security.read', 'security.update')
);
DELETE FROM permissions WHERE name IN ('security.read', 'security.update');
