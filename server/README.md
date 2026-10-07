# server/ – backend v1

Dette er starten på den ekte Salong-backenden. Arkitekturvalget ligger i `docs/decisions/0001-backend-v1.md`.

## Nåværende status

Første steg er med vilje lite:

- Node 22 HTTP-server uten tredjeparts runtime-avhengigheter
- konfigurasjonsvalidering
- `GET /health`
- strukturert oppstarts-/avslutningslogg
- request-id på svar
- servertester i CI

Det finnes **ikke** database, auth eller providerintegrasjoner ennå. De legges til i egne PR-er.

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
  src/
    app.js          HTTP-handler og endepunkter
    config.js       miljøvariabler og validering
    index.js        prosessoppstart, logging og graceful shutdown
  test/
    health.test.js
```

Neste planlagte steg er PostgreSQL-skjema/migrasjoner og repository-lag. API-et skal implementere `SalongBackend` fra `src/services/types.js` gradvis, uten at UI-et kobles direkte til database eller providers.

## Regler

- Nøkler (Apollo, Exa, Firecrawl, LLM, database, auth) bare serverside.
- Ingen simulerte providerresultater i produksjonskode.
- Forventede providerfeil skal bli eksplisitte tilstander, ikke tomme «vellykkede» resultater.
- Produksjonsdata skal i PostgreSQL, aldri i Git.
- Salong sender ikke e-post uten en separat, eksplisitt beslutning.
