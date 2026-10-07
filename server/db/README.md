# Database

Salong backend v1 uses PostgreSQL as the system of record. The accepted architecture is in `docs/decisions/0001-backend-v1.md`.

## Migrations

Versioned SQL lives in `server/db/migrations/`.

Rules:

- migrations are append-only after they have reached production
- operational/customer data is never committed to Git
- string IDs are kept in v1 to remain compatible with existing Salong IDs and imports
- unknown researched values remain `NULL`
- provenance is explicit through `sources` and `researched_facts`
- enrichment jobs are persistent and indexed for database-backed queue claiming
- do not add Redis or another queue until PostgreSQL is proven insufficient

## Initial schema

`001_initial.sql` defines:

- members
- organizations
- contacts
- opportunities
- activities
- prospects
- prospect batches / batch memberships
- bookings
- enrichment_jobs
- enrichment_results
- sources
- researched_facts

The schema deliberately separates operational CRM records from enrichment/research provenance.

Repository code and a migration runner are added in follow-up commits/PRs; this file alone does not make the frontend use PostgreSQL.
