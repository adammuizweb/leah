-- Unified request metadata and approval workflow on top of tickets.
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS request_kind VARCHAR(30) NOT NULL DEFAULT 'incident',
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS software_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS business_objective TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS target_users TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS desired_due_date DATE,
    ADD COLUMN IF NOT EXISTS approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approval_note TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tickets_request_kind_check' AND conrelid='tickets'::regclass) THEN
        ALTER TABLE tickets ADD CONSTRAINT tickets_request_kind_check
            CHECK (request_kind IN ('incident', 'service', 'software'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tickets_approval_status_check' AND conrelid='tickets'::regclass) THEN
        ALTER TABLE tickets ADD CONSTRAINT tickets_approval_status_check
            CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tickets_software_request_fields_check' AND conrelid='tickets'::regclass) THEN
        ALTER TABLE tickets ADD CONSTRAINT tickets_software_request_fields_check
            CHECK (
                request_kind <> 'software'
                OR (
                    LENGTH(TRIM(software_name)) > 0
                    AND LENGTH(TRIM(business_objective)) > 0
                    AND LENGTH(TRIM(target_users)) > 0
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_request_kind ON tickets(request_kind);
CREATE INDEX IF NOT EXISTS idx_tickets_approval_status ON tickets(approval_status)
    WHERE approval_status <> 'not_required';

INSERT INTO permissions (name, label, module, action) VALUES
    ('requests.approve', 'Approve software requests', 'requests', 'approve')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('superadmin', 'admin') AND p.name='requests.approve'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('user', 'agent') AND p.name='tickets.comment'
ON CONFLICT DO NOTHING;
