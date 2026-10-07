# ADR 0001 – Backend v1 for Salong

Status: **Accepted for v1 implementation**

Date: 2026-10-07

## Context

Salong is currently a tested frontend prototype. Inside the Claude Artifact environment it can use Claude-provided database and connector capabilities, but outside that environment there is no real database, authentication, persistent job runner or server-side provider integration.

The existing frontend already has the boundary we want to preserve: `SalongServices` / `SalongBackend` in `src/services/`. Backend work should implement that contract rather than rewrite the UI.

The immediate operational need is a small, dependable system where:

- CRM data persists independently of a browser session
- enrichment can call Apollo/web/LLM providers without per-view connector approval
- provider keys never reach the frontend
- enrichment jobs survive browser close/navigation
- research facts retain provenance and unknown fields stay null / «Ikke dokumentert»
- the system remains simple enough to maintain with a small team and agent-assisted development

## Decision

Backend v1 will use:

1. **Node 22 HTTP API**
   - one small server application under `server/`
   - exposes REST endpoints matching the current `SalongBackend` contract
   - serves the built frontend initially, so deployment has one public application endpoint

2. **Managed PostgreSQL as the system of record**
   - recommended default: Supabase Postgres
   - migrations live in the repository
   - production data is never committed to Git

3. **Simple authentication**
   - recommended default: Supabase Auth
   - v1 roles: owner, editor, reader
   - assignment/ownership in CRM remains a work-distribution concept and is not used as authorization

4. **A separate long-running enrichment worker**
   - same repository and runtime as the API, deployed as a separate process/service
   - jobs are persisted in PostgreSQL
   - start with a database-backed queue using row locking / claim semantics; do not add Redis until scale requires it
   - worker can resume work after browser close or API restart

5. **Server-side provider adapters**
   - Apollo
   - web research provider(s), initially Exa/Firecrawl where useful
   - LLM provider for Spør Salong / drafting
   - provider-specific payloads are normalized behind adapters before reaching domain code

Recommended deployment default for the first real environment:

- **Supabase**: PostgreSQL + auth
- **Railway or equivalent long-running Node host**: one web/API service + one worker service

The code must remain portable enough that either vendor can be replaced later without changing the Salong UI contract.

## Why not serverless-only for v1?

Short request/response API calls fit serverless well, but the core enrichment workflow can involve multiple provider calls, retries, partial results and review states. A normal worker process is easier to reason about and does not depend on a browser remaining open or on short function execution windows.

This is an operational simplicity choice, not a permanent ban on serverless functions.

## Frontend boundary

The UI continues to call `window.SalongServices`.

The migration target is:

```
UI
  -> SalongServices
     -> httpBackend
        -> /api/...
           -> domain/service layer
              -> repositories
                 -> PostgreSQL
```

The frontend switches implementation with `SalongServices.use(httpBackend)`. Product views should not call PostgreSQL, Supabase or provider SDKs directly.

## API v1

Minimum endpoints corresponding to the current service contract:

| Salong service | HTTP |
|---|---|
| `accounts.getAccount(id)` | `GET /api/accounts/:id` |
| `accounts.getProspects(filter)` | `GET /api/prospects` |
| `contacts.getContacts(accountId)` | `GET /api/accounts/:id/contacts` |
| `enrichment.enrichAccount(id)` | `POST /api/enrichment/accounts/:id` |
| `enrichment.enrichAccounts(ids)` | `POST /api/enrichment/batch` |
| `enrichment.getJob(id)` | `GET /api/enrichment/jobs/:id` |
| `enrichment.getLatestJob(accountId)` | `GET /api/accounts/:id/enrichment/latest` |
| `opportunities.list(accountId?)` | `GET /api/opportunities` |
| `calendar.items({from,to})` | `GET /api/calendar` |

Writing endpoints keep the existing result shape:

```json
{
  "success": true,
  "data": {}
}
```

Expected/operational errors use `error_code` and `error_message` rather than fabricating empty successful results.

## Initial data model

The first schema should cover only fields required by the existing product:

- `organizations`
- `contacts`
- `opportunities`
- `activities`
- `prospects`
- `bookings`
- `enrichment_jobs`
- `enrichment_results`
- `sources`
- `members`

A source/provenance record must be linkable to researched/enriched values. Important researched values should be able to retain:

- provider/source
- source URL or provider reference
- checked/retrieved timestamp
- confidence/review state where relevant

Unknown values remain null. A failed provider call is represented as a source/job status, not as «not found».

## Enrichment job lifecycle

Use the current domain states as the baseline:

- `queued`
- `running`
- `needs_review`
- `completed`
- `partial`
- `failed`
- `cancelled`

The worker must:

1. atomically claim a queued job
2. mark it running
3. call providers through adapters
4. persist partial source statuses/results
5. preserve provenance
6. finish as completed / partial / needs_review / failed
7. allow safe retry without creating duplicate operational records

Batch enrichment creates individual persisted jobs or a persisted batch that references individual jobs; it must not be an in-memory browser queue.

## Provider and cost rules

- secrets live only in host/server secret storage
- no provider SDK/key is exposed in `src/`
- Apollo person matching that consumes credits remains an explicit operation or is governed by a clear server-side cost rule
- rate limits and provider-plan restrictions become explicit states
- retries use bounded backoff; no infinite retry loops
- provider responses are not stored wholesale unless needed for audit/debugging; store normalized result + source metadata

## Authentication and authorization

v1 is deliberately small:

- **owner**: all application/admin actions
- **editor**: normal CRM and enrichment work
- **reader**: read-only

Authentication protects the API. Authorization is enforced server-side. The frontend may hide controls for usability but is never the security boundary.

## Email

Backend v1 does **not** automatically send email.

Salong may prepare/store drafts. Sending remains disabled until a separate product/security decision explicitly enables it.

## Environments

Start with:

- local development
- one real production environment

Add a dedicated staging environment only when backend changes become risky enough to justify it.

Preview branches must use synthetic/demo data and must not point at the production database by default.

## Secrets and configuration

`.env.example` documents variable names only.

Real values belong in deployment secret storage. Never commit:

- database credentials
- auth secrets
- Apollo/Exa/Firecrawl/LLM keys
- email or booking credentials

## Observability v1

Keep it basic but useful:

- structured server logs
- request ID / job ID in relevant log lines
- persisted enrichment job error code and source statuses
- health endpoint
- worker heartbeat or equivalent operational signal

Do not build a large monitoring stack before there is production usage.

## Migration sequence

Implementation should be split into small PRs:

1. server skeleton + health endpoint + configuration validation
2. PostgreSQL schema/migrations + repositories
3. auth and server-side roles
4. `httpBackend` implementation for read-only account/contact/opportunity/calendar calls
5. writing CRM calls needed by the current UI
6. persistent enrichment jobs + worker
7. Apollo adapter transport on the server
8. web/LLM adapters and provenance persistence
9. switch production UI from local/Artifact storage to `httpBackend`
10. only then consider booking sync, email integrations and scheduled automation

Each step keeps existing frontend tests green and adds server tests for the new boundary.

## Non-goals for v1

- migrating the frontend to a framework
- full enterprise RBAC
- Redis or a dedicated queue product before needed
- microservices
- automatic email sending
- replacing all Artifact functionality in one PR
- speculative integrations without a concrete product use case

## Consequences

This adds a real backend and one worker process, but keeps the product architecture small and explicit. The main tradeoff is operating two application processes plus managed PostgreSQL/auth. In return, enrichment becomes dependable, secrets stay server-side, and Claude/Codex can work against a conventional codebase with clear contracts and tests.
