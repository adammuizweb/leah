-- Distinguish new application proposals from feature development requests.
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS software_request_type VARCHAR(30) NOT NULL DEFAULT 'unspecified';

ALTER TABLE tickets ADD CONSTRAINT tickets_software_request_type_check
    CHECK (software_request_type IN ('unspecified', 'new_app', 'feature_development'));
