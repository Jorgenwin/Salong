-- CRM opportunities: audit-only, no booking-system side effects.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crm_opportunity_events (
  id text PRIMARY KEY,
  opportunity_id text REFERENCES public.opportunities(id) ON DELETE SET NULL,
  actor_id text REFERENCES public.members(id) ON DELETE SET NULL,
  action text NOT NULL CHECK(action IN ('opportunity_created','opportunity_stage_changed')),
  before_data jsonb,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_opportunity_events_by_opportunity
  ON public.crm_opportunity_events(opportunity_id,created_at DESC);
ALTER TABLE public.crm_opportunity_events ENABLE ROW LEVEL SECURITY;
COMMIT;
