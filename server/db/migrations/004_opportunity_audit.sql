-- Record opportunity changes in the same append-only CRM audit trail.
-- Safe to apply after 003_crm_edit_and_rls; existing audit rows are preserved.
BEGIN;
ALTER TABLE public.crm_audit_events
  DROP CONSTRAINT IF EXISTS crm_audit_events_action_check;
ALTER TABLE public.crm_audit_events
  ADD CONSTRAINT crm_audit_events_action_check
  CHECK (action IN (
    'organization_created','organization_updated',
    'opportunity_created','opportunity_stage_changed'
  ));
COMMIT;
