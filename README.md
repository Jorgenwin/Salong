# Salong 2027

CRM og prospektering for utleie ved Litteraturhuset. Salong hjelper med tre ting: hvem som skal kontaktes, hvorfor nå, og neste handling. Salong sender ingen e-post; den lager utkast.

Status: frontend-prototype som flyttes fra en Claude-artefakt til en vanlig kodebase. Ingen backend er bygget. Se [docs/architecture.md](docs/architecture.md) for hva som virker i dag og hva som krever en server, og [docs/backend-roadmap.md](docs/backend-roadmap.md) for veien videre.

## Kom i gang (fra bunnen)

Krever Node 18+ og Python 3 (bare standardbiblioteket).

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

Testene bruker Playwright med Chromium. I Claude Code-skyøkter er Chromium forhåndsinstallert: sett `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` og ikke kjør `playwright install`. Andre steder: `npx playwright install chromium`. Skjermbilder fra testene havner i en temp-mappe (`SALONG_SHOTS` overstyrer), ikke i repoet.

## Utvikling og data

- Arbeidsflyt for branches, tester, Claude/Codex og PR-er: [docs/development.md](docs/development.md)
- Regler for hva som kan og ikke kan ligge i Git: [docs/data-policy.md](docs/data-policy.md)
- Felles agentregler: [AGENTS.md](AGENTS.md) og [CLAUDE.md](CLAUDE.md)

## Hva du får utenfor Claude

Appen starter i **demomodus**: eksempeldata (merket «Eksempel»), ingenting lagres, og research/Apollo/Spør Salong er «ikke tilkoblet», fordi de i dag går via Claude-artefaktens kapabiliteter (`db`, `mcp`, `sample`). Det er ikke en feil. Full funksjon krever artefakten eller en fremtidig backend.

## Struktur

```
src/                 frontend: app_base.js + ca. 50 moduler + CSS + build.py
  services/          tjenestelag: api.js (SalongServices), crm.js, planning.js,
                     enrichment-job.js, providers/apollo.js, types.js (kontrakt)
data/                example/ (eksempeldata), research/ (offentlig researchgrunnlag), README.md
tests/               run.js og e2e/ (Playwright, mockede Exa/Apollo, oppdiktede testdata)
scripts/serve.js     statisk lokal server
server/              plassholder: foreslått backend-struktur, ingen kode
docs/                architecture.md, backend-roadmap.md
```

Moduler slås sammen i rekkefølgen i `MODS` i `src/build.py`. Rekkefølgen er en del av programmet (se «Teknisk gjeld» i arkitekturdokumentet).

## Publisere som Claude-artefakt

`dist/salong.html` er fragmentet Artifact-verktøyet pakker inn. Publiser med kapabilitetene `db`, `downloads`, `sample`, `user` og `mcp` (Apollo_io, Exa, Gmail, Microsoft 365, kun de verktøyene arkitekturdokumentet lister).

## Hemmeligheter

Frontenden har ingen, og skal aldri få noen. Aldri commit nøkler eller kundedata. `.env.example` lister variabler en fremtidig server trenger (uten verdier). `.env` er i `.gitignore`.

## Arbeid i Claude Code-skyøkter

Repoet bygger og testes fra bunnen med kommandoene over, uten lokale oppsett. Endre i `src/`, kjør `npm test`, og commit på en egen gren. Ikke redigér `dist/`.
