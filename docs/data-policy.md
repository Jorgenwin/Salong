# Datapolicy for repoet

Git-repoet er **kildekode og dokumentasjon**, ikke en database for Salongs driftsdata.

## Kan ligge i Git

- kildekode, tester og dokumentasjon
- tydelig merkede syntetiske eksempel-/testdata
- offentlig researchgrunnlag som er nødvendig for å bygge eller teste produktet, så lenge kilde og formål er tydelig
- skjemaer og tomme konfigurasjonseksempler som `.env.example`

## Skal ikke ligge i Git

- API-nøkler, tokens, passord eller andre hemmeligheter
- eksport fra en ekte CRM/database
- private kontaktlister eller personopplysninger hentet fra intern drift
- e-postinnhold, bookinguttrekk eller aktiviteter fra ekte kunder
- rå enrichment-resultater om reelle personer som er ment som driftsdata
- lokale databaser eller midlertidige eksportfiler

Lokale filer for slikt arbeid skal ligge under ignorerte mapper som `data/private/`, `data/local/` eller `data/exports/`. I produksjon skal driftsdata ligge i databasen, ikke i Git.

## Eksempeldata

Eksempel- og testdata skal være tydelig markert og skal aldri blandes med produksjonsdata i UI. Tester kan bruke oppdiktede navn, domener og kontaktdata.

## Offentlig research

`data/research/` er ment for dokumentert researchgrunnlag, ikke som en skjult CRM-database. Nye felt bør ha kilde/provenance og kontroll-/sjekkdato der det er relevant. Ikke legg inn privat informasjon bare fordi den er teknisk mulig å hente.

## Repository visibility

Repoet er offentlig per 7. oktober 2026. Før reelle CRM-/kundedata eller andre interne driftsdata introduseres, skal repoet gjøres privat og Git-historikken kontrolleres for utilsiktede hemmeligheter eller data.

Selv i et privat repo gjelder reglene over: Git skal fortsatt ikke brukes som produksjonsdatabase.
