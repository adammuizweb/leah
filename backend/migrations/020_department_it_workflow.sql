-- Department acknowledgement and IT recommendation workflow.
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS manager_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE holdings
    ADD COLUMN IF NOT EXISTS it_organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS technology_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS vendor_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS specification TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS manager_reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS manager_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS manager_review_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS it_reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS it_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS it_review_note TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS it_recommendation VARCHAR(30) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS it_manager_recommendation VARCHAR(30) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS legacy_workflow BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_request_kind_check;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_approval_status_check;

UPDATE tickets SET legacy_workflow=TRUE
WHERE request_kind='software' AND approval_status IN ('approved', 'rejected');

UPDATE tickets SET request_kind='support' WHERE request_kind IN ('incident', 'service');
UPDATE tickets SET approval_status='pending_manager'
WHERE request_kind IN ('software', 'technology_review') AND approval_status='pending';

ALTER TABLE tickets ADD CONSTRAINT tickets_request_kind_check
    CHECK (request_kind IN ('support', 'software', 'technology_review'));

ALTER TABLE tickets ADD CONSTRAINT tickets_approval_status_check
    CHECK (approval_status IN (
        'not_required', 'pending_manager', 'pending_it_review',
        'pending_it_manager', 'approved', 'rejected'
    ));

ALTER TABLE tickets ADD CONSTRAINT tickets_it_recommendation_check
    CHECK (it_recommendation IN ('', 'recommended', 'not_recommended'));
ALTER TABLE tickets ADD CONSTRAINT tickets_it_manager_recommendation_check
    CHECK (it_manager_recommendation IN ('', 'recommended', 'not_recommended'));
ALTER TABLE tickets ADD CONSTRAINT tickets_technology_review_fields_check
    CHECK (
        request_kind <> 'technology_review'
        OR (
            LENGTH(TRIM(technology_name)) > 0
            AND LENGTH(TRIM(business_objective)) > 0
            AND LENGTH(TRIM(specification)) > 0
        )
    );

CREATE INDEX IF NOT EXISTS idx_organizations_manager ON organizations(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_it_organization ON holdings(it_organization_id);

CREATE TABLE IF NOT EXISTS request_workflow_history (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    stage VARCHAR(30) NOT NULL CHECK (stage IN ('department_manager', 'it_review', 'it_manager', 'legacy_approval')),
    decision VARCHAR(30) NOT NULL CHECK (decision IN ('approved', 'rejected', 'recommended', 'not_recommended')),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_workflow_history_ticket
    ON request_workflow_history(ticket_id, created_at);

INSERT INTO request_workflow_history (ticket_id, stage, decision, actor_id, note, created_at)
SELECT id, 'legacy_approval',
    approval_status,
    approved_by, approval_note, COALESCE(approved_at, updated_at)
FROM tickets
WHERE request_kind IN ('software', 'technology_review')
  AND approval_status IN ('approved', 'rejected')
  AND approved_by IS NOT NULL;

UPDATE permissions
SET name='requests.it_review', label='Provide IT recommendations', action='it_review'
WHERE name='requests.approve';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name='agent' AND p.name='requests.it_review'
ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT ON request_workflow_history TO leah;
GRANT USAGE, SELECT ON SEQUENCE request_workflow_history_id_seq TO leah;
