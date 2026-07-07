-- Add assets.read.own permission for User role
INSERT INTO permissions (name, label, module, action) VALUES
    ('assets.read.own', 'View own assigned assets', 'assets', 'read.own')
ON CONFLICT (name) DO NOTHING;

-- Grant to user role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user'
  AND p.name = 'assets.read.own'
ON CONFLICT DO NOTHING;
