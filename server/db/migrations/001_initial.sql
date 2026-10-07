-- Salong backend v1 initial schema
-- IDs are TEXT deliberately: the current frontend/service contract already uses string IDs,
-- including imported IDs that are not guaranteed to be UUIDs.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id text PRIMARY KEY,
  auth_subject text UNIQUE,
  name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner','editor','reader')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  website text,
  org_number text,
  segment text,
  tier text CHECK (tier IS NULL OR tier IN ('A','B','C')),
  former boolean NOT NULL DEFAULT false,
  notes text,
  owner_id text REFERENCES members(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organizations_name_idx ON organizations (lower(name));
CREATE INDEX organizations_owner_idx ON organizations (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX organizations_segment_idx ON organizations (segment) WHERE deleted_at IS NULL;

CREATE TABLE contacts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  email text,
  phone text,
  linkedin_url text,
  is_primary boolean NOT NULL DEFAULT false,
  relevance_score numeric(5,2),
  source_state text,
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contacts_organization_idx ON contacts (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX contacts_email_idx ON contacts (lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE opportunities (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title text NOT NULL,
  stage text NOT NULL DEFAULT 'ny'
    CHECK (stage IN ('ny','dialog','visning','tilbud','holdt','bekreftet','tapt')),
  room text,
  event_date date,
  attendees integer CHECK (attendees IS NULL OR attendees >= 0),
  pricing text CHECK (pricing IS NULL OR pricing IN ('open','closed')),
  value_amount numeric(14,2) CHECK (value_amount IS NULL OR value_amount >= 0),
  recurring integer NOT NULL DEFAULT 1 CHECK (recurring >= 1),
  source text,
  owner_id text REFERENCES members(id) ON DELETE SET NULL,
  lost_reason text,
  notes text,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX opportunities_org_idx ON opportunities (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX opportunities_stage_idx ON opportunities (stage) WHERE deleted_at IS NULL;
CREATE INDEX opportunities_owner_idx ON opportunities (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX opportunities_event_date_idx ON opportunities (event_date) WHERE deleted_at IS NULL;

CREATE TABLE activities (
  id text PRIMARY KEY,
  organization_id text REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id text REFERENCES opportunities(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('call','email','meeting','visning','note','task')),
  text text NOT NULL DEFAULT '',
  body text,
  happened_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  done boolean NOT NULL DEFAULT true,
  actor_id text REFERENCES members(id) ON DELETE SET NULL,
  owner_id text REFERENCES members(id) ON DELETE SET NULL,
  wait_reason text,
  task_key text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

CREATE INDEX activities_org_idx ON activities (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX activities_opportunity_idx ON activities (opportunity_id) WHERE deleted_at IS NULL;
CREATE INDEX activities_due_idx ON activities (due_at) WHERE type='task' AND done=false AND deleted_at IS NULL;
CREATE INDEX activities_owner_idx ON activities (owner_id) WHERE type='task' AND done=false AND deleted_at IS NULL;

CREATE TABLE prospects (
  organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  relationship text,
  status text,
  fit_score numeric(5,2),
  potential_score numeric(5,2),
  expected_value numeric(14,2),
  priority text,
  owner_id text REFERENCES members(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prospects_priority_idx ON prospects (priority);
CREATE INDEX prospects_owner_idx ON prospects (owner_id);

CREATE TABLE bookings (
  id text PRIMARY KEY,
  external_id text,
  source_system text NOT NULL,
  organization_id text REFERENCES organizations(id) ON DELETE SET NULL,
  status text,
  room text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  attendees integer CHECK (attendees IS NULL OR attendees >= 0),
  amount numeric(14,2),
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, external_id)
);

CREATE INDEX bookings_org_idx ON bookings (organization_id);
CREATE INDEX bookings_starts_at_idx ON bookings (starts_at);

CREATE TABLE enrichment_jobs (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','needs_review','completed','partial','failed','cancelled')),
  requested_by text REFERENCES members(id) ON DELETE SET NULL,
  source_statuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX enrichment_jobs_queue_idx
  ON enrichment_jobs (status, available_at, created_at)
  WHERE status='queued';

CREATE INDEX enrichment_jobs_account_idx
  ON enrichment_jobs (account_id, created_at DESC);

CREATE TABLE enrichment_results (
  job_id text PRIMARY KEY REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
  organization jsonb,
  event_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sources (
  id text PRIMARY KEY,
  organization_id text REFERENCES organizations(id) ON DELETE CASCADE,
  enrichment_job_id text REFERENCES enrichment_jobs(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source_url text,
  provider_ref text,
  title text,
  checked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR enrichment_job_id IS NOT NULL)
);

CREATE INDEX sources_org_idx ON sources (organization_id);
CREATE INDEX sources_job_idx ON sources (enrichment_job_id);

-- Fine-grained researched values can point to a source rather than leaving provenance
-- trapped only inside a provider response blob.
CREATE TABLE researched_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value jsonb,
  source_id text REFERENCES sources(id) ON DELETE SET NULL,
  confidence numeric(5,2),
  review_state text NOT NULL DEFAULT 'unreviewed'
    CHECK (review_state IN ('unreviewed','accepted','rejected','conflict')),
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX researched_facts_org_field_idx
  ON researched_facts (organization_id, field_key);

INSERT INTO schema_migrations(version)
VALUES ('001_initial')
ON CONFLICT (version) DO NOTHING;

COMMIT;
