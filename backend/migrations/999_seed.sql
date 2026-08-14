-- Development-only fixtures with public credentials. Never run in production.
INSERT INTO holdings (name, slug)
VALUES ('Default', 'default')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO organizations (name, holding_id, path, level)
SELECT 'Default', holding.id, '/' || holding.id || '/', 0
FROM holdings holding
WHERE holding.slug='default'
AND NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE holding_id=holding.id AND parent_id IS NULL AND name='Default'
);

INSERT INTO users (email, name, password_hash, role_id, organization_id)
SELECT fixture.email, fixture.name,
    '$2b$12$I.NY04zy0/7HoIII.mUfzuhckWoKK4VsYBBOtOr6atm47gbCNMkfy',
    role.id, organization.id
FROM (VALUES
    ('superadmin@leah.lan', 'Superadmin', 'superadmin'),
    ('admin@leah.lan', 'Admin', 'admin'),
    ('agent@leah.lan', 'Agent', 'agent'),
    ('user@leah.lan', 'User', 'user')
) AS fixture(email, name, role_name)
JOIN roles role ON role.name=fixture.role_name
JOIN holdings holding ON holding.slug='default'
JOIN LATERAL (
    SELECT candidate.id
    FROM organizations candidate
    WHERE candidate.holding_id=holding.id AND candidate.parent_id IS NULL
    ORDER BY (candidate.name='Default') DESC, candidate.id
    LIMIT 1
) organization ON TRUE
ON CONFLICT (email) DO UPDATE
SET name=EXCLUDED.name, password_hash=EXCLUDED.password_hash,
    role_id=EXCLUDED.role_id, organization_id=EXCLUDED.organization_id,
    deleted_at=NULL;

UPDATE user_organizations
SET is_default=FALSE
WHERE user_id IN (
    SELECT id FROM users
    WHERE email IN ('superadmin@leah.lan', 'admin@leah.lan', 'agent@leah.lan', 'user@leah.lan')
);

INSERT INTO user_organizations (user_id, organization_id, role_id, is_active, is_default)
SELECT users.id, users.organization_id, users.role_id, TRUE, TRUE
FROM users
WHERE users.organization_id IS NOT NULL AND NOT users.is_root
AND users.email IN ('superadmin@leah.lan', 'admin@leah.lan', 'agent@leah.lan', 'user@leah.lan')
ON CONFLICT (user_id, organization_id) DO UPDATE
SET role_id=EXCLUDED.role_id, is_active=TRUE, is_default=TRUE;
