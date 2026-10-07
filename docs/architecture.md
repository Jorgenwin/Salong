# Salong – arkitektur

Salong er et CRM- og prospekteringsverktøy for utleie ved Litteraturhuset. Det startet som en prototype i en Claude-artefakt og flyttes nå gradvis til en vanlig kodebase som senere kan kjøres som egen webapp. Dette dokumentet beskriver hva som finnes **i dag**, hva som først trenger en backend, hva som bevares, og hvilken gjeld prototypen har. Det er skrevet etter å ha lest hele koden, ikke etter en plan.

Kort status: frontenden fungerer og er testet (22 testfiler, rundt 750 kontroller). Den har fra før et lagdelt internt tjenestelag (`crm.*` → services → repositories → store). Det som er nytt i denne omgangen er repo-strukturen, et tydelig tjenesteinnlegg for UI (`SalongServices`), en backend-klar `EnrichmentJob`-modell og Apollo bak en adapter. Ingen backend er bygget.

## Slik er koden bygget i dag

- **Ingen rammeverk.** Vanilla JavaScript, ett skall (`src/app_base.js`, ca. 1 500 linjer) pluss ca. 50 moduler i `src/` som slås sammen til én IIFE med `python3 src/build.py`. Utdata er `dist/salong.html` (fragment som Artifact-verktøyet pakker inn) og `dist/index.html` (full side for lokal kjøring og tester).
- **Moduler deler ett scope.** Senere funksjonsdeklarasjoner overstyrer tidligere (hoisting), og noen moduler tilordner funksjoner på nytt. Rekkefølgen i `MODS`-listen i `src/build.py` er derfor en del av programmet.
- **Routing:** `UI.view` med `location.hash`. Ingen URL-router.
- **Tilstand:** `S[collection][id]` i minnet, skrevet via `put()` og repositories. Samlinger: `orgs, deals, acts, offers, bookings, prospects, audit, imports, kdocs, members, notices, mscen, malts, mpos, mtacc, mtper, mtbat, mtsnap, mtq, mtjob`.
- **Lagring:** i artefakten brukes Claudes delte `db`-kapabilitet (sanntidsabonnement per samling, utboks i `localStorage` ved feil). Utenfor artefakten finnes ingen database: appen starter i **demomodus** («Demo · endringer lagres ikke») med eksempeldata.
- **Eksterne tjenester** går via `claude.use('mcp')` (Exa og Apollo for research, Gmail/Outlook for *utkast*), `claude.use('sample')` (Spør Salong og tekstutkast) og `claude.use('user')` (hvem er innlogget i Claude, ikke Salong-innlogging).
- **Lag i koden** (`src/core.js`, `src/services/crm.js`): UI → `crm.*`-fasade → services (enrichment, planning, market, priority) → repositories (`accountRepository`, `contactRepository`, `caseRepository`, `enrichmentJobRepository` …) → store → Local-adapter. Domenemodellene (`toAccount`, `toContact`, `toCase`, `toJobEntity`) er allerede snake_case og uavhengige av lagringsformen.

## A. Hva virker i frontend i dag

| Område | Status |
|---|---|
| Kunder, saker, pipeline, kalender, tilbud, forespørsler (innliming og strukturering), I dag, Mål og prognose | Fungerer fullt mot `db` i artefakten, og mot demodata utenfor |
| Prospekter: Målmarked, Arbeidsliste, batcher, sekvenser (planlegging, ikke sending), kontaktdekning | Fungerer |
| Marked og posisjon (referansedata fra `mseed.js`, segmentfit, prioriteringsflate) | Fungerer, rene lesedata |
| Berik: organisasjonsresearch, kontaktsøk i flere runder, kandidatvurdering, godkjenn/bytt/avvis | Fungerer **mens siden er åpen** og seeren har samtykket til connectorene |
| Spør Salong (kunnskapslag med kildehenvisning) og tekstutkast | Fungerer via `sample` (Claude) |
| Utkast til e-post | Lages som utkast i Gmail/Outlook via connector. **Salong sender ingenting.** |
| Eksport/import (CSV, bookinguttrekk), data-kvalitetsstatus, endringslogg | Fungerer |

Apollo i dag: organisasjonsoppslag virker. Personsøk er sperret på gratisplanen (`API_INACCESSIBLE`, klassifisert som `plan_restricted`, vist som «Apollo utilgjengelig»). `people_match` koster kreditter og kjøres bare som en eksplisitt handling per person.

## B. Hva trenger backend senere

Dette lar seg ikke gjøre riktig i en nettleser og må på en server før Salong er en ekte webapp:

1. **Innlogging og tilgang.** I dag finnes bare «testprofil» (valgt i nettleseren, eksplisitt ikke innlogging) og Claude-kontoens `data.write`-rettighet. Ansvarlig/eier er arbeidsfordeling, ikke tilgangskontroll.
2. **Hemmeligheter og integrasjoner.** Apollo, Exa, Firecrawl og LLM-kall krever nøkler som aldri kan ligge i frontend. I dag omgås det av at Claude-connectorene bruker seerens egne kontoer, med samtykke per visning.
3. **Bakgrunnsjobber.** Enrichment kjører i siden (`enrKick`, hjerteslag hvert 20. sekund). Lukkes siden, stopper arbeidet. En server trenger en jobbkø med arbeidere som overlever navigasjon.
4. **Persistente enrichment-resultater og kilder.** Resultater skrives i dag til `mtacc.enr` og `mtper` av siden som kjørte jobben.
5. **Ekte database med skjema og migrasjoner.** I dag lastes hele samlinger inn i minnet via snapshot-abonnement. Det skalerer ikke langt, og det finnes ingen migrasjoner utover `SCHEMA`-versjonen i `core.js`.
6. **Booking- og e-postintegrasjon** (fase 3). Bookinger importeres i dag som CSV-uttrekk. E-post er bare utkast.
7. **Revisjonsspor på serveren.** Endringsloggen (`audit`) skrives av klienten.

## C. Hva beholdes uendret

- All domenelogikk og UI: fit-score (seks delkomponenter, maks 100), statusflyten Oppdaget → Kvalifisert → Researchet → Kontakt klar → Adressert → Dialog → Mulighet, kontaktrangering (`cdisc.js`), enrichment-tilstandsmaskinen (`enrsvc.js`), I dag-køen, planlegging.
- Prinsippene: ingen dummydata i produksjons-UI («Ikke dokumentert»), ingen simulerte providersvar, Salong sender ingenting, godkjenning av hovedkontakt er et menneskelig valg, kilder og sjekkdato følger verdier.
- Repository- og domenemodellene i `src/core.js` og fasaden `crm.*`. De er grensen en backend skal implementere.
- Testsuiten. Den kjører mot den bygde siden og skal fortsette å gjøre det mens backend bygges.

## D. Teknisk gjeld og prototypebegrensninger

- **`rep()`-patcher i `src/build.py`** er historikk fra iterasjoner i artefakten. Oppryddingen gjøres gradvis i små PR-er: de første lavrisiko-kjernepatchene er nå flyttet inn i `app_base.js`, mens resten fortsatt skal brettes inn i de faktiske kildefilene uten funksjonsendringer.
- **Delt scope og modulrekkefølge.** Duplikater finnes (f.eks. `enrProbe` i både `enr.js` og `enrsvc.js`; den siste vinner). Ingen ES-moduler, ingen typer utover JSDoc i `services/types.js`.
- **Én stor fil (1,4 MB)** og ingen kodesplitting.
- **Testkrok i produksjonskode:** `window.__salong` eksponerer intern tilstand for testene (inneholder ingen hemmeligheter).
- **Demodata bygges inn ved bygging.** `data/example/seed.json` er eneste kilde for eksempeldata; `src/build.py` injiserer den i den selvstendige appen. `tests/e2e/t20.js` verifiserer at bygget bruker nøyaktig denne seed-filen.
- **Steder som later som om en backend finnes** og som er ærlig merket: `enrichmentRunner` heter `prototype_queue` («utføres av Claude-økten, ikke autonomt»); kommentarer om `POST /api/…` beskriver målformen, ikke noe som kjører; Cognism-provideren er bare en plassholder («ikke tilkoblet»); statusfeltet «Tilkoblet» betyr at artefaktdatabasen svarer, ikke at det finnes en server.
- **Samtykke per seer** for connectorer. Én bruker kan ha tilgang til Apollo mens en annen ikke har det.
- **Ingen skjemavalidering på serveren**, ingen rate limiting, ingen kreditt-/kostnadsstyring utover at `people_match` er manuell.

## Målarkitektur (struktur, ikke implementert)

```
Nettleser (src/)                    Backend (server/, fase 2)                Eksternt
─────────────────                   ─────────────────────────                ─────────
UI (views, drawer)                  API  ── auth, tilgang                    Apollo (org, personer)
   │                                CRM-data (organisasjoner, personer,      Exa / Firecrawl (research)
SalongServices  ───── HTTP ─────►   saker, aktiviteter, prospekter)          Bookingsystem (fase 3)
 accounts · contacts                Enrichment-jobber + arbeidere            E-post (fase 3, utkast først)
 enrichment · opportunities         Integrasjonsadaptere (apollo.js …)       LLM (Spør Salong)
 calendar · (providers)             Hemmeligheter (.env / secret store)
   │                                      │
localBackend (i dag)                Database: organizations, persons, cases, activities, prospects,
 = repositories + store             enrichment_jobs, enrichment_results, sources, bookings (senere)
```

Grensen er `SalongServices` i `src/services/api.js`. En server implementerer de samme funksjonene bak HTTP, og frontenden bytter med `SalongServices.use(httpBackend)`. UI-koden endres ikke.

## Tjenestelaget

`window.SalongServices` (se `src/services/api.js` og kontrakten i `src/services/types.js`):

| Tjeneste | Funksjoner |
|---|---|
| `accounts` | `getAccount(id)`, `getProspects(filter)` |
| `contacts` | `getContacts(accountId)` |
| `enrichment` | `enrichAccount(accountId)`, `enrichAccounts(accountIds)`, `getJob(jobId)`, `getLatestJob(accountId)` |
| `opportunities` | `list(accountId?)` |
| `calendar` | `items({from,to})` |

Alt er async. Skrivende kall returnerer `{success, data, error_code, error_message}` og kaster ikke for forventede feil. Berik-knappene (`berik.js`, `enrrun.js`) går via `SalongServices.enrichment`. Mange øvrige deler av UI bruker fortsatt `crm.*` direkte (det eldre, bredere internfasaden). De flyttes gradvis; det er ikke gjort her for å unngå risiko uten gevinst.

## EnrichmentJob

`toEnrichmentJob()` i `src/services/enrichment-job.js` oversetter prototypens interne jobbdokument (`mtjob`) til modellen en server skal returnere:

```
{ id, accountId,
  status: queued | running | needs_review | completed | partial | failed (| cancelled),
  startedAt, completedAt,
  sourceStatuses: { web, apollo, cognism: ok | empty | blocked | plan_restricted | error | not_connected },
  error,
  result: {
    organization:       { name, domain, description },
    eventSignals:       [{ event, date, venue, type, source }],
    contactCandidates:  [{ name, title, relevanceScore, source }],
    contactData:        [{ email, phone, linkedin, source, verifiedAt }],
    recommendation:     { whyNow, recommendedUseCase, recommendedRoom } } }
```

Felt uten dokumentasjon er `null`; UI viser «Ikke dokumentert». Det finnes ingen arbeidsflytmotor: tilstandsmaskinen (`ENR_ST`, `enrAdvance`) er en liste med tillatte overganger. Merk at `result` i dag avledes fra accountens *nåværende* data, ikke fra et frosset øyeblikksbilde per jobb. En server bør lagre resultatet per jobb (`enrichment_results`).

## Integrasjoner: Apollo som én datakilde

`src/services/providers/apollo.js` har tre operasjoner med nøytrale resultatformer, og en byttbar transport:

- `findOrganization({name, domain})`, `searchPeople({domain, orgId, titles, keywords})`, `matchPerson({id, name, organizationName, domain})`.
- Transporten er i dag `claude.use('mcp')` mot Apollo-connectoren. Serverversjonen kaller `apolloAdapter.setTransport({call})` og går via serveren. Resten av koden og UI er uendret.

| | Hva |
|---|---|
| **Virker nå** | Organisasjonsoppslag mot Apollo; Exa-søk og sidehenting for research; kontaktkandidater fra research |
| **Krever samtykke fra brukeren** | Alle connector-kall (per seer, per artefakt). Artefakten deklarerer bare de verktøyene den bruker: `apollo_organizations_lookup`, `apollo_mixed_people_api_search`, `apollo_people_match`, `web_search_exa`, `web_fetch_exa`, Gmail `create_draft`, Outlook `outlook_create_draft`. Salong forsøker aldri å omgå Claudes tillatelsesmodell |
| **Krever serverside nøkler** | Apollo-personsøk i bulk, autonom enrichment uten åpen side, alt som skal kjøre uten at en person har siden åpen: `APOLLO_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY`, LLM-nøkkel. Se `.env.example` |

Apollo-gratisplanen sperrer personsøk. Det håndteres som tilstanden `plan_restricted` («Apollo utilgjengelig») og aldri som en tom, glatt feil.

## Data: ekte, eksempel og testdata

Se `data/README.md` for den fullstendige oversikten. I korte trekk:

- **Offentlig/verifisert referansedata:** `MKSEED` i `src/mseed.js` (lokaler og priser, kontrollert 5. oktober 2026, med kilder), organisasjonsprofiler `PROFILES` i `app_base.js` (offentlige kilder), romdata og Litteraturhusets egne forutsetninger. Leses, skrives aldri til CRM-databasen.
- **Eksempeldata** (alltid merket `example: true`, vises med «Eksempel»): `DEMO` i `app_base.js` / `data/example/seed.json` og `u3Seed()` i `src/u3seed.js`. Brukes bare i demomodus, ikke mot en delt database.
- **Salongs anslag** (markedsstørrelse per segment, fit og potensial): merket som anslag i UI, ikke dokumentasjon.
- **Researchgrunnlag:** `data/research/` (offentlige kilder, målgruppe «Wave 1»). Brukes av testene, ikke bygget inn i appen.
- **Testfixtures:** `tests/e2e/h.js` og innebygde fixtures i testene. Navn er oppdiktede og merket `[TEST]`. Finnes aldri i produktkode.

Ingen ekte kundeposter ligger i repoet. Ingenting er slettet.

## Hemmeligheter

Frontenden har ingen og skal aldri få noen. `.env.example` dokumenterer variabler uten verdier for en fremtidig server; `.env` er i `.gitignore`. `tests/e2e/t20.js` skanner kildekoden for nøkkelmønstre.

## Hva kan ikke testes i skyen

- Ekte Apollo-, Exa- og Gmail/Outlook-kall (krever seerens connector-samtykke i Claude). Testene bruker mockede connectorsvar.
- Claude-artefaktens `db`-kapabilitet. Testene bruker en delt mock i Node som oppfører seg som `db`.
- Visuell kontroll i ekte nettlesere utover Chromium, og Google Fonts (blokkert i sandkassen; siden faller tilbake til systemfonter).
- Alt som krever en faktisk server (ikke bygget).
