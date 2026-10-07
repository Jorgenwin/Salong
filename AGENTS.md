# AGENTS.md

Dette repoet er kildekilden for **Salong 2027**, et CRM- og prospekteringsverktøy for utleie ved Litteraturhuset.

## Før du endrer noe

Les i denne rekkefølgen:

1. `README.md`
2. `docs/architecture.md`
3. `docs/backend-roadmap.md`
4. `docs/decisions/0001-backend-v1.md` ved backendarbeid
5. Relevant kode under `src/` eller `server/`

Ikke anta at planlagte backend-endepunkter faktisk finnes. Arkitekturdokumentet skiller mellom det som virker i dag og målarkitekturen.

## Arbeidsmåte

- Jobb alltid på en egen branch fra oppdatert `main`.
- Hold hver oppgave avgrenset. Ikke kombiner refaktorering, ny funksjonalitet og arkitekturendring uten god grunn.
- Før merge: kjør minst `npm run check` og `npm test`.
- Oppsummer i PR-en: hva som ble endret, hvorfor, hvilke tester som er kjørt, og eventuelle kjente begrensninger.
- Ikke force-push `main`.
- Ikke rediger genererte filer i `dist/` manuelt.

## Viktige produktprinsipper

Bevar disse med mindre oppgaven eksplisitt sier noe annet:

- Ingen dummydata i produksjons-UI. Eksempeldata skal være tydelig merket som eksempel/demo.
- Ikke dikt opp enrichment-resultater, providersvar, kontakter, e-postadresser eller kilder.
- Ukjent eller udokumentert informasjon skal være `null` / «Ikke dokumentert», ikke gjettes.
- Kilder, sjekkdato og provenance skal følge research/enrichment-data.
- Salong sender ikke e-post. Den lager utkast.
- Godkjenning av hovedkontakt er et menneskelig valg.
- Eksisterende domenelogikk, fit-score, statusflyt og prioriteringslogikk skal ikke endres uten eksplisitt grunn.

## Arkitekturgrenser

Frontend er i dag vanilla JavaScript og bygges av `src/build.py`.

Viktig:

- `src/build.py` og rekkefølgen i `MODS` er funksjonelt viktige.
- Det finnes teknisk gjeld i form av mange `rep()`-patcher. Ikke rydd dem aggressivt i samme PR som funksjonelle endringer.
- `SalongServices` i `src/services/api.js` er grensen mellom UI og fremtidig backend.
- Nye eksterne integrasjoner skal ligge bak adaptere/tjenestelag, ikke kobles direkte inn i UI.
- Hemmeligheter og API-nøkler skal aldri ligge i frontend eller committed filer.
- `.env.example` kan dokumentere variabelnavn, men aldri verdier.

## Backend

Backend v1 bygges nå gradvis under `server/`. Ikke bygg en stor backend som sideeffekt av en frontend-oppgave, og ikke hopp over de avtalte små PR-trinnene i ADR 0001.

Når backendarbeid faktisk er oppgaven:

- Bevar `SalongServices`-kontrakten.
- Skill auth, database, enrichment-jobber og providers tydelig.
- Bakgrunnsjobber må være server-side og tåle at nettleseren lukkes.
- Apollo/Exa/Firecrawl/LLM-nøkler skal kun ligge server-side.
- Ikke lat som en provider er tilgjengelig hvis den ikke er testet.

## Testing lokalt / Codespaces

Vanlig flyt:

```bash
npm install
npm run check
npm run server:check
npm run test:server
npm test
```

Playwright bruker Chromium. I Codespaces kan dette ved behov installeres med:

```bash
npx playwright install --with-deps chromium
```

Ikke endre testforventninger bare for å få rødt til grønt uten å forstå årsaken.

## Review-regler for Claude og Codex

Når én agent implementerer, bør den andre primært reviewe/teste i stedet for å omskrive samme område parallelt.

Ved review, prioriter:

1. dataintegritet og manglende/oppdiktede data
2. regresjoner i eksisterende CRM-flyt
3. UI → service → repository-grenser
4. kilde/provenance i enrichment
5. sikkerhet og hemmeligheter
6. testdekning og build-stabilitet
7. deretter stil og opprydding

Hvis en oppgave er uklar, gjør den minste trygge endringen og beskriv hva som fortsatt er uklart.
