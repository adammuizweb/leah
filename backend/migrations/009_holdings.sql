-- Holdings (top-level entities)
CREATE TABLE IF NOT EXISTS holdings (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations (hierarchical, within holdings)
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    holding_id BIGINT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
    path TEXT NOT NULL DEFAULT '/',   -- materialized path: /1/3/7
    level INT NOT NULL DEFAULT 0,     -- depth: 0 = root
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add organization_id to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_holding ON organizations(holding_id);
CREATE INDEX IF NOT EXISTS idx_organizations_path ON organizations(path);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(organization_id);
