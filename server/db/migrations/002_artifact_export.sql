-- Preserve Claude Artifact documents before mapping into CRM tables.
-- This schema is intentionally separate from public: no PostgREST exposure or grants.
BEGIN;
CREATE SCHEMA IF NOT EXISTS artifact_export;
CREATE TABLE IF NOT EXISTS artifact_export.documents (
  collection text NOT NULL,
  doc_id text NOT NULL,
  data jsonb NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, doc_id),
  CHECK (collection <> '' AND doc_id <> '')
);
CREATE INDEX IF NOT EXISTS artifact_export_documents_collection_idx
  ON artifact_export.documents (collection);
INSERT INTO schema_migrations(version)
VALUES ('002_artifact_export')
ON CONFLICT (version) DO NOTHING;
COMMIT;
