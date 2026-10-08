# Salong 2027

CRM og prospektering for utleie ved Litteraturhuset. Salong hjelper med tre ting: hvem som skal kontaktes, hvorfor nå, og neste handling. Salong sender ingen e-post; den lager utkast.

Status: frontend-prototypen er flyttet til vanlig kodebase. Backend v1 har Node-server, PostgreSQL-skjema og migrasjoner, repository-lag, read-API for CRM/kalender, frontend HTTP-adapter, persistente enrichment-jobber, worker, delt research-motor og server-side rollegrense. Det som fortsatt mangler før ekte drift er blant annet konkret auth-provider, øvrige CRM-skriveendepunkter, ekte provideradaptere, worker/deployment-aktivering og produksjonsbyttet. Se [docs/architecture.md](docs/architecture.md), [backend-veikartet](docs/backend-roadmap.md) og [ADR 0001](docs/decisions/0001-backend-v1.md).

## Kom i gang (fra bunnen)

Krever Node 22+ og Python 3 (bare standardbiblioteket).

```bash
git clone https://github.com/Jorgenwin/Salong.git && cd Salong
npm install        # bare Playwright, og bare for testene
npm start          # bygger og kjører på http://localhost:8080
```

| Kommando | Gjør |
|---|---|
| `npm run build` | Bygger `dist/salong.html` (fragment til Artifact-verktøyet), `dist/index.html` (full side) og `dist/app.js` |
| `npm start` | Bygger og starter en statisk server (`PORT` styrer porten) |
| `npm run check` | Bygger og syntakssjekker `dist/app.js` |
| `npm test` | Bygger og kjører alle ende-til-ende-testene (`tests/run.js`). Filtrer: `node tests/run.js t12 t20` |
| `npm run server:check` | Syntakssjekker backend-koden |
| `npm run test:server` | Kjører backendens Node-tester |
| `npm run server:start` | Starter backend-serveren (standard `http://localhost:3000`; bruker `DATABASE_URL` når satt) |

Testene bruker Playwright med Chromium. I Claude Code-skyøkter er Chromium forhåndsinstallert: sett `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` og ikke kjør `playwright install`. Andre steder: `npx playwright install chromium`. Skjermbilder fra testene havner i en temp-mappe (`SALONG_SHOTS` overstyrer), ikke i repoet.

## Utvikling og data

- Arbeidsflyt for branches, tester, Claude/Codex og PR-er: [docs/development.md](docs/development.md)
- Drift, smoke-test, API/worker og backup: [docs/operations-runbook.md](docs/operations-runbook.md)
- Regler for hva som kan og ikke kan ligge i Git: [docs/data-policy.md](docs/data-policy.md)
- Felles agentregler: [AGENTS.md](AGENTS.md) og [CLAUDE.md](CLAUDE.md)

## Hva du får utenfor Claude

Frontenden starter fortsatt i **demomodus** utenfor Claude: eksempeldata (merket «Eksempel») lagres ikke, og research/Apollo/Spør Salong er ikke koblet til den nye serveren ennå. Backendkoden har nå live PostgreSQL-runtime, lesing, kalender, persistent Berik-kø, worker-kjerne og den samme research-motoren som Berik. Konkret auth-provider og ekte providertransport er fortsatt ikke aktivert i standardoppsettet. `data/example/seed.json` er eneste kilde for demodata og bygges inn i appen av `src/build.py`.

## Struktur

```
src/                 frontend: app_base.js + ca. 50 moduler + CSS + build.py
  services/          tjenestelag: api.js (SalongServices), crm.js, planning.js,
                     enrichment-job.js, providers/apollo.js, types.js (kontrakt)
data/                example/ (eksempeldata), research/ (offentlig researchgrunnlag), README.md
tests/               run.js og e2e/ (Playwright, mockede Exa/Apollo, oppdiktede testdata)
scripts/serve.js     statisk lokal server
server/              backend v1: HTTP/read-API, PostgreSQL-skjema/repositories, enrichment-kø/worker
docs/                architecture.md, backend-roadmap.md, decisions/
```

Moduler slås sammen i rekkefølgen i `MODS` i `src/build.py`. Rekkefølgen er en del av programmet (se «Teknisk gjeld» i arkitekturdokumentet).

## Publisere som Claude-artefakt

`dist/salong.html` er fragmentet Artifact-verktøyet pakker inn. Publiser med kapabilitetene `db`, `downloads`, `sample`, `user` og `mcp` (Apollo_io, Exa, Gmail, Microsoft 365, kun de verktøyene arkitekturdokumentet lister).

## Hemmeligheter

Frontenden har ingen hemmeligheter og skal aldri få noen. Aldri commit nøkler eller kundedata. `.env.example` dokumenterer backend-variabler uten hemmelige verdier; ekte verdier skal ligge i lokal/deployment secret storage. `.env` er i `.gitignore`.

## Arbeid i Claude Code-skyøkter

Repoet bygger og testes fra bunnen med kommandoene over, uten lokale oppsett. Frontendendringer gjøres i `src/`; backendendringer i `server/`. Kjør relevante checks/tester og commit på en egen gren. Ikke redigér `dist/`.
