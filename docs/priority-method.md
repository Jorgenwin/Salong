# Salong: kultur-først-prioritet ved selskapsimport

Dette er en **gjennomgåbar anbefaling** for A/B/C på `organizations.tier`, ikke en automatisk igangsatt utsendelse. Etter import kan den redigeres. Koden ligger i `server/src/db/import-priority.js` og kjører bare med `--companies-only`. Eksporten skal ikke legges i GitHub eller i offentlig buildkontekst.

## Forankring i eksisterende Salong

- `src/mt.js`: Segmentprioritet P0 (bl.a. forlag, forskning, fag, ambassader og tech), P1 (bl.a. NGO, finans, konsulent, SaaS) og P2 (bl.a. byrå, utdanning, offentlig).
- `src/tier.js`: Kulturprofil 0–3 og maks 30 toppmål (Tier 1), minst 35 i fit. Kunst/litteratur/kunnskap prioriteres foran alminnelig bedriftsprospektering.
- **Ikke bland begrepene:** P0/P1/P2 er *segmenter*, A/B/C er *lagret importforslag*, og Tier 1/2/3 er den dynamiske arbeidsprioriteten i dagens frontend. Til full backend-integrasjon kan disse visningene avvike.

## Forslagslogikk

1. Behold eksisterende manuelle A/B/C i `orgs` når de er angitt.
2. For nye navngitte `mtacc`: Kulturprofil bygges av segment + litteratur- og kulturord i **navn og faktabeskrivelse** (`about`), ikke tolkningsfeltet `why`. Møter på Kulturhuset/museum gjør ikke en bedrift til kulturaktør. «Kunstig intelligens» gir ikke kunst-treff.
3. Konservativ fit: Dokumentert eventsignal med kilde +30, indikasjon med kilde +15, ellers 0; segment P0/P1/P2 +20/+12/+5; Oslo/Norge +10/+5; kjent størrelse L/M/S +10/+6/+3. **Ukjent romfit og ukjent tidligere relasjon er 0**, aldri gjettet.
4. Sorter etter Salong-lik kulturprofil/fit: kulturprofil×20 + 8 for flere kulturord/kjerne-forlag + fit×0,25. A krever kulturprofil 3 og fit minst 35 og har maks 30 plasser. B krever kulturprofil minst 2, eller profil 1 og fit minst 40. Resten C. Begrunnelse og kilde legges i `prospects.metadata.import_priority` og i den private gjennomgangsrapporten.
5. Poster med `example: true` normaliseres ikke. `mtacc` uten navn blir i privat staging; vi finner ikke på et navn.
6. Ingen kontakter, e-postsekvenser, Berik-jobber eller avtaler aktiveres av dette.

**Kildegrense:** Prioriteringen bygger på eksportens felt og kildehenvisninger, ikke nye nettsideoppslag. Arrangementssignaler fra 6. oktober 2026 er ikke nødvendigvis oppdatert senere.

## Verifisering og import

Kjør først en privat dry-run:

```sh
npm run import:artifact -- --file data/exports/salong-artifact-export-2026-10-08.json --companies-only --dry-run
```

Kontroller `priorities.counts`, `review_required_count`, forventet antall, manuelt bevarte tiers, og særtilfeller i gjennomgangsarket. Import kan **bare** kjøres fra en sikker prosess med `DATABASE_URL` etter backup og eksplisitt `--apply`, ikke fra SQL Editor med rådata, og aldri ved å endre den permanente API-startkommandoen.

Etter import må det sjekkes at antall CRM-oppføringer og `organizations.tier` samsvarer med dry-run. Den private staging-tabellen inneholder råfilens originale dokumentverdier.
