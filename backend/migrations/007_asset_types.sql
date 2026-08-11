-- Asset types (fixed categories like Laptop, Monitor, Server, Software)
CREATE TABLE IF NOT EXISTS asset_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset categories (hierarchical, e.g. Dell under Laptop)
CREATE TABLE IF NOT EXISTS asset_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id BIGINT REFERENCES asset_categories(id) ON DELETE SET NULL,
    type_id BIGINT NOT NULL REFERENCES asset_types(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(name, type_id)
);

-- Link assets to types and categories
ALTER TABLE assets ADD COLUMN IF NOT EXISTS type_id BIGINT REFERENCES asset_types(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES asset_categories(id);

CREATE INDEX IF NOT EXISTS idx_asset_categories_parent ON asset_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_asset_categories_type ON asset_categories(type_id);
CREATE INDEX IF NOT EXISTS idx_assets_type_id ON assets(type_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets(category_id);

-- Default seed data
INSERT INTO asset_types (name) VALUES
    ('Laptop'),
    ('Desktop'),
    ('Monitor'),
    ('Server'),
    ('Printer'),
    ('Network'),
    ('Software'),
    ('License'),
    ('Accessory'),
    ('Phone')
ON CONFLICT (name) DO NOTHING;
