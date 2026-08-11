-- Restrict the runtime role to application DML and enforce Root invariants.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM leah;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM leah;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leah;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO leah;

DO $$
BEGIN
    IF to_regclass('public.schema_migrations') IS NOT NULL THEN
        REVOKE ALL PRIVILEGES ON schema_migrations FROM leah;
    END IF;
END $$;

REVOKE INSERT, DELETE, UPDATE ON login_security_settings FROM leah;
GRANT SELECT ON login_security_settings TO leah;
GRANT UPDATE (enabled, attempt_window_minutes, ip_attempt_limit, account_attempt_limit, account_lock_minutes, updated_by, updated_at)
    ON login_security_settings TO leah;

CREATE OR REPLACE FUNCTION protect_root_identity() RETURNS TRIGGER AS $$
BEGIN
    IF session_user <> 'leah' THEN
        IF TG_OP='DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP='INSERT' AND NEW.is_root THEN
        RAISE EXCEPTION 'Root privilege can only be assigned by the database owner';
    END IF;
    IF TG_OP='DELETE' AND OLD.is_root THEN
        RAISE EXCEPTION 'Root account cannot be deleted';
    END IF;
    IF TG_OP='UPDATE' THEN
        IF OLD.is_root AND (
            NEW.is_root IS DISTINCT FROM TRUE
            OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
            OR NEW.email IS DISTINCT FROM OLD.email
            OR NEW.name IS DISTINCT FROM OLD.name
            OR NEW.locked_until IS DISTINCT FROM OLD.locked_until
        ) THEN
            RAISE EXCEPTION 'Root identity cannot be demoted, deleted, renamed, or locked';
        END IF;
        IF NOT OLD.is_root AND NEW.is_root THEN
            RAISE EXCEPTION 'Root privilege can only be assigned by the database owner';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_protect_root_identity ON users;
CREATE TRIGGER users_protect_root_identity
BEFORE INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION protect_root_identity();

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_root
    ON users ((is_root)) WHERE is_root=TRUE;
