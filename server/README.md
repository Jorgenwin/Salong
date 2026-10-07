# server/ – plassholder for fremtidig backend

Ingen kode ennå, bevisst. Backend v1 er nå besluttet på arkitekturnivå i `docs/decisions/0001-backend-v1.md` (se også `docs/backend-roadmap.md`). Ingen backend-kode er installert ennå; implementeringen skal fortsatt skje i små, testede PR-er.

## Foreslått struktur

```
server/
  src/
    api/            ruter: accounts, contacts, enrichment, opportunities, calendar (samme navn som SalongServices)
    enrichment/     jobbkø + arbeider som kjører research-pipelinen og skriver EnrichmentJob/-result
    integrations/   apollo (samme tre operasjoner som src/services/providers/apollo.js), exa, firecrawl
    auth/           innlogging og enkel tilgang
    db/             skjema og migrasjoner
  .env              (ikke i git; variabler står i ../.env.example)
```

## Kontrakten

Serveren implementerer `SalongBackend` fra `src/services/types.js`, f.eks.:

| Frontend-kall | HTTP |
|---|---|
| `getAccount(id)` | `GET /api/accounts/:id` |
| `getProspects(filter)` | `GET /api/prospects` |
| `getContacts(accountId)` | `GET /api/accounts/:id/contacts` |
| `enrichAccount(id)` | `POST /api/enrichment/accounts/:id` → `{ jobId }` |
| `enrichAccounts(ids)` | `POST /api/enrichment/batch` |
| `getEnrichmentJob(id)` | `GET /api/enrichment/jobs/:id` → `EnrichmentJob` |

Tabeller (forslag): `organizations`, `persons`, `cases`, `activities`, `prospects`, `enrichment_jobs`, `enrichment_results`, `sources`, `bookings` (senere).

## Regler

- Nøkler (Apollo, Exa, Firecrawl, LLM) bare her, aldri i frontend.
- Ingen simulerte svar fra eksterne kilder. Feil er tilstander (`plan_restricted`, `blocked`, `not_connected`), ikke tomme resultater.
- Salong sender ikke e-post uten en eksplisitt, egen beslutning.
