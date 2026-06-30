-- Audit fields: track who created, updated, deleted
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS asset_id BIGINT REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_tickets_updated_by ON tickets(updated_by);
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_by ON tickets(deleted_by);
CREATE INDEX IF NOT EXISTS idx_tickets_asset_id ON tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_created_by ON assets(created_by);
CREATE INDEX IF NOT EXISTS idx_assets_updated_by ON assets(updated_by);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_by ON assets(deleted_by);
