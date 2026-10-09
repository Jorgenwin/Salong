-- Incremental, non-destructive CRM editing and private API hardening.
-- The application connects as the trusted Postgres owner; browsers only
-- authenticate through Supabase Auth, never through PostgREST table endpoints.
BEGIN;
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS quality_manual_override boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.crm_audit_events (
  id text PRIMARY KEY,
  organization_id text REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id text REFERENCES public.members(id) ON DELETE SET NULL,
  action text NOT NULL CHECK(action IN ('organization_created','organization_updated')),
  before_data jsonb,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_audit_events_org_at_idx
  ON public.crm_audit_events(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS crm_audit_events_actor_at_idx
  ON public.crm_audit_events(actor_id,created_at DESC);

-- No browser-side table access. All authenticated authorization is checked
-- by Salong API against active members. Postgres owner remains privileged.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'schema_migrations','members','organizations','contacts','opportunities',
    'activities','prospects','prospect_batches','prospect_batch_accounts',
    'bookings','enrichment_jobs','enrichment_results','sources','researched_facts',
    'crm_audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  END LOOP;
END $$;
COMMIT;
