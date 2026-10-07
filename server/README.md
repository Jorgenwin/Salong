# server/ – backend v1

Backend v1 is decided in `docs/decisions/0001-backend-v1.md`. This directory now contains the first deliberately small server foundation: a dependency-free Node HTTP process, configuration validation and a health endpoint. Database, auth, CRM routes and enrichment workers are added in later PRs.

## Run locally

From the repository root:

```bash
npm run server:start
```

Default address: `http://localhost:3000`.

Override the port with `PORT`:

```bash
PORT=8081 npm run server:start
```

Health check:

```text
GET /health
→ {"status":"ok","service":"salong-api"}
```

Run server tests:

```bash
npm run test:server
```

The skeleton intentionally has no third-party runtime dependencies yet.

## Target structure

```
server/
  src/
    index.js        process entrypoint and graceful shutdown
    app.js          HTTP app / routing shell
    config.js       environment validation
    api/            accounts, contacts, enrichment, opportunities, calendar
    enrichment/     persistent queue + worker
    integrations/   Apollo, Exa/Firecrawl, LLM
    auth/           authentication and owner/editor/reader authorization
    db/             schema, migrations and repositories
  test/
```

## Contract

The server implements `SalongBackend` from `src/services/types.js`. Planned minimum mapping:

| Frontend call | HTTP |
|---|---|
| `getAccount(id)` | `GET /api/accounts/:id` |
| `getProspects(filter)` | `GET /api/prospects` |
| `getContacts(accountId)` | `GET /api/accounts/:id/contacts` |
| `enrichAccount(id)` | `POST /api/enrichment/accounts/:id` → `{ jobId }` |
| `enrichAccounts(ids)` | `POST /api/enrichment/batch` |
| `getEnrichmentJob(id)` | `GET /api/enrichment/jobs/:id` → `EnrichmentJob` |

Until those routes are implemented, unknown endpoints return the standard service error shape with `error_code: "not_found"`.

## Rules

- Apollo, Exa, Firecrawl, LLM, database and auth secrets are server-side only.
- No simulated provider responses in production code. Provider failure/plan states are explicit.
- Operational CRM data belongs in PostgreSQL, never Git.
- Research values retain provenance; undocumented values stay null.
- Salong does not send email unless a separate explicit decision enables it.
