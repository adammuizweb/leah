-- Configurable login rate limiting and account lockout
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (
        SELECT LOWER(TRIM(email)) FROM users
        GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'duplicate user emails differ only by case or whitespace';
    END IF;
END $$;
UPDATE users SET email=LOWER(TRIM(email)) WHERE email<>LOWER(TRIM(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS login_security_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    attempt_window_minutes INTEGER NOT NULL DEFAULT 15 CHECK (attempt_window_minutes BETWEEN 1 AND 1440),
    ip_attempt_limit INTEGER NOT NULL DEFAULT 5 CHECK (ip_attempt_limit BETWEEN 1 AND 100),
    account_attempt_limit INTEGER NOT NULL DEFAULT 8 CHECK (account_attempt_limit BETWEEN 2 AND 100),
    account_lock_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (account_lock_minutes BETWEEN 1 AND 43200),
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO login_security_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    email VARCHAR(255),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
    ON login_attempts (ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
    ON login_attempts (email, attempted_at DESC)
    WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_login_attempts_unresolved
    ON login_attempts (attempted_at DESC)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_login_attempts_retention
    ON login_attempts (attempted_at);

REVOKE INSERT, DELETE, UPDATE ON login_security_settings FROM leah;
GRANT SELECT ON login_security_settings TO leah;
GRANT UPDATE (enabled, attempt_window_minutes, ip_attempt_limit, account_attempt_limit, account_lock_minutes, updated_by, updated_at)
    ON login_security_settings TO leah;
GRANT SELECT, INSERT, UPDATE, DELETE ON login_attempts TO leah;
REVOKE SELECT ON SEQUENCE login_attempts_id_seq FROM leah;
GRANT USAGE ON SEQUENCE login_attempts_id_seq TO leah;
