-- Cross-holding service providers and auditable requester memberships.
CREATE TABLE IF NOT EXISTS service_routes (
    id BIGSERIAL PRIMARY KEY,
    service_key VARCHAR(50) NOT NULL,
    consumer_holding_id BIGINT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
    provider_organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (service_key, consumer_holding_id)
);

INSERT INTO service_routes (service_key, consumer_holding_id, provider_organization_id)
SELECT 'it_requests', id, it_organization_id
FROM holdings
WHERE it_organization_id IS NOT NULL
ON CONFLICT (service_key, consumer_holding_id) DO NOTHING;

ALTER TABLE holdings DROP COLUMN IF EXISTS it_organization_id;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS identity_source VARCHAR(50) NOT NULL DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS external_person_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_external_person_identity_unique
    ON users(identity_source, external_person_id)
    WHERE external_person_id IS NOT NULL AND external_person_id <> '';

ALTER TABLE user_organizations
    ADD COLUMN IF NOT EXISTS id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS role_id BIGINT REFERENCES roles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS identity_type VARCHAR(30) NOT NULL DEFAULT 'member',
    ADD COLUMN IF NOT EXISTS display_title VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS identity_source VARCHAR(50) NOT NULL DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS external_membership_id TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO user_organizations (user_id, organization_id, role_id, is_default)
SELECT users.id, users.organization_id, users.role_id, TRUE
FROM users
WHERE users.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

UPDATE user_organizations uo
SET role_id=users.role_id,
    is_default=(users.organization_id=uo.organization_id)
FROM users
WHERE users.id=uo.user_id AND uo.role_id IS NULL;

ALTER TABLE user_organizations ADD CONSTRAINT user_organizations_id_unique UNIQUE (id);
ALTER TABLE user_organizations ADD CONSTRAINT user_organizations_identity_type_check
    CHECK (identity_type IN ('member', 'employee', 'lecturer', 'student', 'contractor', 'service_account'));

CREATE UNIQUE INDEX IF NOT EXISTS user_organizations_one_default
    ON user_organizations(user_id) WHERE is_default AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS user_organizations_external_identity_unique
    ON user_organizations(identity_source, external_membership_id)
    WHERE external_membership_id IS NOT NULL AND external_membership_id <> '';
CREATE INDEX IF NOT EXISTS idx_user_organizations_role ON user_organizations(role_id);

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS requester_membership_id BIGINT
        REFERENCES user_organizations(id) ON DELETE RESTRICT;

UPDATE tickets t
SET requester_membership_id=(
    SELECT MIN(uo.id)
    FROM user_organizations uo
    WHERE uo.user_id=t.created_by AND uo.organization_id=t.organization_id
)
WHERE requester_membership_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_requester_membership
    ON tickets(requester_membership_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON service_routes TO leah;
GRANT USAGE, SELECT ON SEQUENCE service_routes_id_seq TO leah;
GRANT USAGE, SELECT ON SEQUENCE user_organizations_id_seq TO leah;
