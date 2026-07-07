-- Ticket Workflow: types, status history, comments, SLA

CREATE TABLE ticket_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE ticket_status_history (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by BIGINT NOT NULL REFERENCES users(id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_status_history_ticket ON ticket_status_history(ticket_id);

CREATE TABLE ticket_comments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);

CREATE TABLE sla_policies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    priority VARCHAR(50) NOT NULL UNIQUE,
    response_hours INT NOT NULL,
    resolve_hours INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add workflow columns to tickets
ALTER TABLE tickets
    ADD COLUMN type_id BIGINT REFERENCES ticket_types(id),
    ADD COLUMN sla_policy_id BIGINT REFERENCES sla_policies(id),
    ADD COLUMN sla_response_at TIMESTAMPTZ,
    ADD COLUMN sla_resolve_at TIMESTAMPTZ,
    ADD COLUMN closed_at TIMESTAMPTZ;

-- Default ticket types
INSERT INTO ticket_types (name) VALUES
    ('Incident'),
    ('Service Request'),
    ('Change Request'),
    ('Maintenance'),
    ('Complaint');

-- Default SLA policies
INSERT INTO sla_policies (name, priority, response_hours, resolve_hours) VALUES
    ('Critical SLA', 'critical', 1, 4),
    ('High SLA', 'high', 4, 8),
    ('Medium SLA', 'medium', 8, 24),
    ('Low SLA', 'low', 24, 72);

-- New permissions
INSERT INTO permissions (name, label, module, action) VALUES
    ('ticket_types.create', 'Create ticket types', 'ticket_types', 'create'),
    ('ticket_types.read', 'View ticket types', 'ticket_types', 'read'),
    ('ticket_types.update', 'Update ticket types', 'ticket_types', 'update'),
    ('ticket_types.delete', 'Delete ticket types', 'ticket_types', 'delete'),
    ('tickets.comment', 'Comment on tickets', 'tickets', 'comment'),
    ('tickets.internal', 'View internal notes', 'tickets', 'internal'),
    ('sla_policies.create', 'Create SLA policies', 'sla_policies', 'create'),
    ('sla_policies.read', 'View SLA policies', 'sla_policies', 'read'),
    ('sla_policies.update', 'Update SLA policies', 'sla_policies', 'update'),
    ('sla_policies.delete', 'Delete SLA policies', 'sla_policies', 'delete');

-- Grant table permissions to leah user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO leah;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO leah;

-- Assign new permissions to superadmin role
DO $$
DECLARE
    r_id BIGINT;
    p_id BIGINT;
BEGIN
    SELECT id INTO r_id FROM roles WHERE name = 'superadmin';
    IF r_id IS NOT NULL THEN
        FOR p_id IN SELECT id FROM permissions WHERE module IN ('ticket_types', 'sla_policies') LOOP
            INSERT INTO role_permissions (role_id, permission_id) VALUES (r_id, p_id) ON CONFLICT DO NOTHING;
        END LOOP;
        -- Also assign tickets.comment to superadmin
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r_id, id FROM permissions WHERE name = 'tickets.comment'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
