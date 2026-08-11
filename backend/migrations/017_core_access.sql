-- Production-safe roles and permission assignments (no demo users/passwords).
INSERT INTO roles (name, label, is_admin) VALUES
    ('superadmin', 'Superadmin', FALSE),
    ('admin', 'Administrator', TRUE),
    ('agent', 'Agent', FALSE),
    ('user', 'User', FALSE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, label, module, action) VALUES
    ('tickets.create', 'Create tickets', 'tickets', 'create'),
    ('tickets.read', 'View all tickets', 'tickets', 'read'),
    ('tickets.read.own', 'View own tickets', 'tickets', 'read.own'),
    ('tickets.update', 'Update tickets', 'tickets', 'update'),
    ('tickets.delete', 'Delete tickets', 'tickets', 'delete'),
    ('tickets.bulk_delete', 'Bulk delete tickets', 'tickets', 'bulk_delete'),
    ('tickets.assign', 'Assign tickets', 'tickets', 'assign'),
    ('assets.create', 'Create assets', 'assets', 'create'),
    ('assets.read', 'View all assets', 'assets', 'read'),
    ('assets.read.own', 'View own assigned assets', 'assets', 'read.own'),
    ('assets.update', 'Update assets', 'assets', 'update'),
    ('assets.delete', 'Delete assets', 'assets', 'delete'),
    ('assets.bulk_delete', 'Bulk delete assets', 'assets', 'bulk_delete'),
    ('assets.assign', 'Assign assets', 'assets', 'assign'),
    ('users.create', 'Create users', 'users', 'create'),
    ('users.read', 'View users', 'users', 'read'),
    ('users.update', 'Update users', 'users', 'update'),
    ('users.delete', 'Delete users', 'users', 'delete'),
    ('types.read', 'View asset types', 'types', 'read'),
    ('types.create', 'Create asset types', 'types', 'create'),
    ('types.update', 'Update asset types', 'types', 'update'),
    ('types.delete', 'Delete asset types', 'types', 'delete'),
    ('categories.read', 'View categories', 'categories', 'read'),
    ('categories.create', 'Create categories', 'categories', 'create'),
    ('categories.update', 'Update categories', 'categories', 'update'),
    ('categories.delete', 'Delete categories', 'categories', 'delete'),
    ('settings.read', 'View settings', 'settings', 'read'),
    ('settings.update', 'Update settings', 'settings', 'update')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name='superadmin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name='admin' AND p.module<>'settings'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name='agent' AND p.name IN (
    'tickets.create', 'tickets.read', 'tickets.update', 'tickets.assign',
    'assets.create', 'assets.read', 'assets.update', 'assets.assign'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name='user' AND p.name IN (
    'tickets.create', 'tickets.read.own', 'assets.read.own'
)
ON CONFLICT DO NOTHING;
