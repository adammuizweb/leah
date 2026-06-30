-- Seed data — development only, can be destroyed anytime

-- Default roles
INSERT INTO roles (name, label, is_admin) VALUES
    ('admin', 'Administrator', TRUE),
    ('agent', 'Agent', FALSE),
    ('user', 'User', FALSE)
ON CONFLICT (name) DO NOTHING;

-- Define all permissions
INSERT INTO permissions (name, label, module, action) VALUES
    -- Tickets
    ('tickets.create',   'Create tickets',   'tickets', 'create'),
    ('tickets.read',     'View all tickets', 'tickets', 'read'),
    ('tickets.read.own', 'View own tickets', 'tickets', 'read.own'),
    ('tickets.update',   'Update tickets',   'tickets', 'update'),
    ('tickets.delete',   'Delete tickets',   'tickets', 'delete'),
    ('tickets.assign',   'Assign tickets',   'tickets', 'assign'),
    -- Assets
    ('assets.create',   'Create assets',    'assets', 'create'),
    ('assets.read',     'View all assets',  'assets', 'read'),
    ('assets.update',   'Update assets',    'assets', 'update'),
    ('assets.delete',   'Delete assets',    'assets', 'delete'),
    ('assets.assign',   'Assign assets',    'assets', 'assign'),
    -- Users
    ('users.create', 'Create users', 'users', 'create'),
    ('users.read',   'View users',   'users', 'read'),
    ('users.update', 'Update users', 'users', 'update'),
    ('users.delete', 'Delete users', 'users', 'delete'),
    -- Settings
    ('settings.read',   'View settings',   'settings', 'read'),
    ('settings.update', 'Update settings', 'settings', 'update')
ON CONFLICT (name) DO NOTHING;

-- Admin — all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Agent — ticket & asset management (except delete)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'agent'
  AND p.name IN (
      'tickets.create', 'tickets.read', 'tickets.update', 'tickets.assign',
      'assets.create', 'assets.read', 'assets.update', 'assets.assign'
  )
ON CONFLICT DO NOTHING;

-- User — only create tickets & read own
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user'
  AND p.name IN ('tickets.create', 'tickets.read.own')
ON CONFLICT DO NOTHING;

-- Test admin user (password: admin)
INSERT INTO users (email, name, password_hash, role_id)
SELECT 'admin@leah.lan', 'Admin', '$2a$10$dummy_hash_replace_me', r.id
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (email) DO NOTHING;

-- Test agent user
INSERT INTO users (email, name, password_hash, role_id)
SELECT 'agent@leah.lan', 'Agent', '$2a$10$dummy_hash_replace_me', r.id
FROM roles r WHERE r.name = 'agent'
ON CONFLICT (email) DO NOTHING;

-- Test regular user
INSERT INTO users (email, name, password_hash, role_id)
SELECT 'user@leah.lan', 'User', '$2a$10$dummy_hash_replace_me', r.id
FROM roles r WHERE r.name = 'user'
ON CONFLICT (email) DO NOTHING;
