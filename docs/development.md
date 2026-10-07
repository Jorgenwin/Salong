# Utviklingsflyt

Dette er den praktiske arbeidsflyten for Salong-repoet.

## Branch og PR

1. Start fra oppdatert `main`.
2. Lag én branch per avgrenset oppgave.
3. Gjør endringer i kildefiler, ikke i `dist/`.
4. Kjør testene.
5. Åpne Pull Request mot `main`.
6. Merge først når endringen er forståelig, testet og avgrenset.

Forslag til branchnavn:

- `feat/...` for ny funksjonalitet
- `fix/...` for feilretting
- `refactor/...` for ren strukturendring uten ønsket funksjonsendring
- `chore/...` for repo, dokumentasjon og vedlikehold

## Lokal verifisering

```bash
npm install
npm run check
npm run server:check
npm run test:server
npm test
```

Hvis Chromium mangler i Codespaces eller et annet nytt miljø:

```bash
npx playwright install --with-deps chromium
```

## Agentarbeid

`AGENTS.md` er felles instruks for Claude, Codex og andre kodeagenter. `CLAUDE.md` supplerer denne for Claude.

En god standard er at én agent implementerer en avgrenset oppgave, mens en annen reviewer eller tester den. Unngå parallelle omskrivinger av samme område.

## Refaktorering

Salong har teknisk gjeld fra Artifact-perioden, særlig `rep()`-patcher i `src/build.py` og delt modulscope. Rydd dette gradvis i små PR-er med uendret oppførsel og grønne tester. Ikke kombiner stor opprydding med produktendringer.

## Backend

Backend v1 bygges gradvis under `server/`. Følg `docs/decisions/0001-backend-v1.md` og `docs/backend-roadmap.md`, og behold `SalongServices` som kontraktsgrense. Database, auth, API-ruter, worker og providers skal fortsatt komme i små, separate PR-er.
