-- Asset models (product templates for bulk creation)
CREATE TABLE IF NOT EXISTS asset_models (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL DEFAULT '',
    part_number VARCHAR(255) NOT NULL DEFAULT '',
    category_id BIGINT REFERENCES asset_categories(id) ON DELETE SET NULL,
    type_id BIGINT REFERENCES asset_types(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE assets ADD COLUMN IF NOT EXISTS model_id BIGINT REFERENCES asset_models(id) ON DELETE SET NULL;

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_serial_key;

CREATE INDEX IF NOT EXISTS idx_assets_model_id ON assets(model_id);
CREATE INDEX IF NOT EXISTS idx_asset_models_type ON asset_models(type_id);
CREATE INDEX IF NOT EXISTS idx_asset_models_category ON asset_models(category_id);
CREATE INDEX IF NOT EXISTS idx_asset_models_deleted_at ON asset_models(deleted_at);

INSERT INTO permissions (name, label, module, action) VALUES
    ('models.read',   'View asset models',   'models', 'read'),
    ('models.create', 'Create asset models', 'models', 'create'),
    ('models.update', 'Update asset models', 'models', 'update'),
    ('models.delete', 'Delete asset models', 'models', 'delete')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'superadmin' AND p.module = 'models'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.module = 'models'
ON CONFLICT DO NOTHING;
