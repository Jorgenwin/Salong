# server/ – backend v1

Dette er den selvstendige Salong-backenden under oppbygging. Arkitekturvalget ligger i `docs/decisions/0001-backend-v1.md`.

## Nåværende status

På plass i kode og tester:

- Node 22 HTTP-server, konfigurasjonsvalidering, strukturert logging og `GET /health`
- PostgreSQL-skjema og versjonerte migrasjoner
- repository-lag med parameteriserte spørringer
- read-API for accounts, prospects, contacts, opportunities og calendar
- kalenderhåndtering eksplisitt i `Europe/Oslo`
- frontend `httpBackend` for read-kontrakten og den persistente enrichment-køen; ingen lokal fallback når HTTP-backend er aktiv
- persistente enrichment-jobber med atomisk claim (`FOR UPDATE SKIP LOCKED`), worker-lås, retries og status
- provider-uavhengig worker-kjerne med injisert executor og enkel health/status
- delt `runResearch()`-motor koblet til workeren med persistente resultater, kilder og researched facts
- vendor-uavhengig auth/rollegrense (`owner` / `editor` / `reader`) med server-side håndheving når auth aktiveres

Ikke på plass ennå:

- faktisk auth-provider/verifier og produksjonsaktivering av auth
- øvrig CRM-skrive-API (konto/kontakt/sak)
- ekte Apollo/web/LLM-adaptere og secrets
- produksjonsdeployment og bytte av UI til server som standard

PostgreSQL-runtime og kø-API kan nå kjøres mot en ekte database, men full produksjonsdataflyt er fortsatt ikke aktivert fordi konkret auth-provider, providertransporter og øvrige CRM-skriveendepunkter mangler.

## Kjør lokalt

Fra repo-roten:

```bash
npm install
npm run server:check
npm run test:server
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

Research-kjeden er grønn med fake adaptere og offline eval: HTTP-kø → databasejobb → worker → `runResearch()` → kildeverifikasjon → persistente resultater/kilder/fakta → `needs_review`. Neste tekniske milepæl er konkret auth-provider og ekte server-side provideradaptere, deretter worker/deployment-aktivering.

## Regler

- Nøkler (Apollo, Exa, Firecrawl, LLM, database, auth) bare serverside.
- Ingen simulerte providerresultater i produksjonskode.
- Forventede providerfeil skal bli eksplisitte tilstander, ikke tomme «vellykkede» resultater.
- Produksjonsdata skal i PostgreSQL, aldri i Git.
- Ukjente researchfelt forblir `null` / «Ikke dokumentert».
- Hovedkontakt godkjennes av et menneske, ikke automatisk av research-motoren.
- Salong sender ikke e-post uten en separat, eksplisitt beslutning.
