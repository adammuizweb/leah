ALTER TABLE asset_types ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_asset_types_deleted_at ON asset_types(deleted_at);
CREATE INDEX IF NOT EXISTS idx_asset_categories_deleted_at ON asset_categories(deleted_at);
