# server/ – backend v1

Dette er den selvstendige Salong-backenden under oppbygging. Arkitekturvalget ligger i `docs/decisions/0001-backend-v1.md`.

## Nåværende status

På plass i kode og tester:

- Node 22 HTTP-server, konfigurasjonsvalidering, strukturert logging og `GET /health`
- PostgreSQL-skjema og versjonerte migrasjoner
- repository-lag med parameteriserte spørringer
- read-API for accounts, prospects, contacts, opportunities og calendar
- kalenderhåndtering eksplisitt i `Europe/Oslo`
- frontend `httpBackend` for read-kontrakten; uferdige enrichment-kall stopper tydelig i stedet for å falle tilbake lokalt
- persistente enrichment-jobber med atomisk claim (`FOR UPDATE SKIP LOCKED`), worker-lås, retries og status
- provider-uavhengig worker-kjerne med injisert executor og enkel health/status

Ikke på plass ennå:

- live PostgreSQL-miljø er ikke konfigurert i repoet; runtime-driver og `DATABASE_URL`-bootstrap finnes, men må verifiseres mot en separat testdatabase før produksjon
- auth og roller
- CRM-skrive-API
- kobling av research-motoren til workeren
- ekte Apollo/web/LLM-adaptere og secrets
- produksjonsdeployment og bytte av UI til server som standard

Det betyr at backendarkitekturen kan testes isolert, men det finnes fortsatt ingen produksjonsdataflyt.

## Kjør lokalt

Fra repo-roten:

```bash
npm install
npm run server:check
npm run test:server
# Når DATABASE_URL peker på en separat utviklings/testdatabase:
npm run db:check
npm run server:start
```

Standard er `HOST=0.0.0.0`, `PORT=3000` og `NODE_ENV=development`.

Helsesjekk:

```text
GET /health
```

Responsen inneholder bare driftsstatus, miljø, tidspunkt og request-id. Den skal aldri lekke hemmeligheter eller database/provider-detaljer.

## Struktur

```text
server/
  db/
    migrations/       versjonert PostgreSQL-skjema
  src/
    api/              HTTP-kontrakter
    db/               repositories og migrasjonsrunner
    worker/           persistent enrichment-worker, provider-uavhengig
    app.js            HTTP-handler
    config.js         miljøvariabler og validering
    index.js          prosessoppstart, logging og graceful shutdown
  test/               backendtester
```

Research-motoren og worker-grensen bygges/testes separat. PostgreSQL-runtime kan nå koble til via `DATABASE_URL`, kjøre migrasjoner og lukke poolen kontrollert. Før produksjon må `db:check` kjøres mot en separat testdatabase, auth-verifieren aktiveres og API-et fortsatt være fail-closed uten gyldig auth.

## Regler

- Nøkler (Apollo, Exa, Firecrawl, LLM, database, auth) bare serverside.
- Ingen simulerte providerresultater i produksjonskode.
- Forventede providerfeil skal bli eksplisitte tilstander, ikke tomme «vellykkede» resultater.
- Produksjonsdata skal i PostgreSQL, aldri i Git.
- Ukjente researchfelt forblir `null` / «Ikke dokumentert».
- Hovedkontakt godkjennes av et menneske, ikke automatisk av research-motoren.
- Salong sender ikke e-post uten en separat, eksplisitt beslutning.
