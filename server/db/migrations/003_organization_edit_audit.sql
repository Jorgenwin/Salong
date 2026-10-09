-- This migration adds manual-edit protection and a durable audit trail without
-- altering existing imported organizations or their A/B/C classifications.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_tier smallint CHECK (sales_tier IS NULL OR sales_tier BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS sales_tier_manual_override boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS organization_changes (
  id bigserial PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('create', 'update')),
  changed_by text NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'agent', 'import')),
  before_data jsonb,
  after_data jsonb NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_changes_org_time_idx
  ON organization_changes(organization_id, happened_at DESC);

-- Browser clients can only access data through the authenticated Salong API.
-- PostgREST roles never receive table-level permissions for this audit log.
REVOKE ALL ON organization_changes FROM PUBLIC;
REVOKE ALL ON SEQUENCE organization_changes_id_seq FROM PUBLIC;
