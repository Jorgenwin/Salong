# Kodekart

Hvor ting bor, og hvilken rolle hver fil har. `src/` er flat av historiske grunner; dette kartet er den logiske inndelingen inntil filene flyttes til mapper per domene (se «Flytteplan» nederst).

Regelen for nye filer: én fil har ett domene og én rolle (regler, tjeneste, visning eller data). Regler er rene funksjoner uten DOM og lagring, slik at de også kan kjøres av serveren.

## Domener

| Domene | Hva det eier | Server-motpart |
|---|---|---|
| **kjerne** | skall, lagring, repositories, tjenestegrense | `server/src/api`, `server/src/db` |
| **crm** | kunder, saker, tilbud, kalender, team, e-postutkast | repositories |
| **prospekter** | målmarked, arbeidsliste, batcher, sekvenser, prioritet | repositories |
| **research** | «Berik»: research-pipeline, kontaktfunn, tilstander | `server/src/research` |
| **i dag og plan** | arbeidskø, uke/måned, mål og prognose | – |
| **marked** | posisjon, segmentfit, referansedata | – |
| **kunnskap** | Spør Salong, kunnskapslag med kilder | LLM-adapter (senere) |

## Filer i `src/`

### kjerne
| Fil | Rolle |
|---|---|
| `app_base.js` | Skall: konstanter, tilstand `S`, `put()`, routing, grunnvisninger, oppstart |
| `core.js` | Dataslag: store, hendelser, domenemodeller (`toAccount` …), repositories |
| `dq.js` | Dataopprinnelse: skiller ekte, eksempel og testdata i operative flater |
| `services/api.js` | **Grensen mot backend:** `SalongServices` |
| `services/crm.js` | Intern fasade `crm.*`, providers, enrichment-/markeds-/prioritetstjenester |
| `services/types.js` | Kontrakten (JSDoc): `EnrichmentJob`, `SalongBackend` |
| `build.py` | Bygg: slår sammen filene i `MODS`-rekkefølge |

### crm
| Fil | Rolle |
|---|---|
| `k3.js`, `ux.js` | Kunder: liste, relasjon, eier og tildeling |
| `team.js` | Team, ansvar og tildeling (kunde-, saks- og oppgaveansvarlig) |
| `c3.js`, `cal2.js`, `kal3.js` | Kalender: belegg, statuslinje, dag/uke/måned/kapasitet |
| `maler.js` | Maler og samtaler: e-postutkast etter intensjon (sender aldri) |

### prospekter
| Fil | Rolle |
|---|---|
| `mt.js` | **Regler:** account-modell, fit, statusflyt, sekvenser (avledning) |
| `mtui.js`, `mtmod.js` | Visning: Arbeidsliste, Målmarked, Sekvenser; dialoger, import, eksport |
| `elig.js` | Regler: hvem kan legges i en batch, og hvorfor ikke |
| `cov.js`, `drw.js` | Visning: markedsdekning (funnel, segmenttabell); kompakt account-kort |
| `tier.js`, `tierui.js`, `tierseq.js` | Prioritet (tier): regler, visning, liste til sekvens |
| `strat.js` | Strategi: posisjonering, arenaer, økonomi og innsats |

### research
| Fil | Rolle |
|---|---|
| `research/rules.js` | **Regler (modul):** rollefamilier, parsere, `cdScore` |
| `research/events.js` | **Regler (modul):** lesing av søke- og hentesvar, datoer, eventsignaler, romvalg |
| `research/method.js` | **Metode (modul):** verifikator, LLM-uttrekk, tidlig stopp, hvem som beholdes |
| `research/pipeline.js` | **Pipeline (modul):** `enrPipeline` og `createWebOps` (web-operasjoner bundet til porter) |
| `enrrun.js` | Claude-connectorene som porter (`WEB_OPS`), LLM-port via `sample`, lagring og jobbkjøring i siden |
| `enr.js` | Connector-kall (`enrCall`, `enrExa`), jobbkø og fremdrift i siden |
| `enrsvc.js` | Tilstandsmaskin per account (`ENR_ST`), `cdRank`, tekster |
| `services/providers/apollo.js` | Apollo-adapter med byttbar transport |
| `services/enrichment-job.js` | `toEnrichmentJob()`: intern jobb → kontrakt |
| `berik.js`, `berikui.js`, `enrui2.js` | Visning: jobblinje, kontaktkort, godkjenn/bytt/avvis |

`src/research/*.js` er vanlige CommonJS-moduler uten DOM, lagring eller Claude-globals. Serveren importerer dem med `require()` (`server/src/research/shared.js`), og `src/build.py` pakker dem inn i Artifact-bunten (`RMODS`). Endres en regel der, gjelder den begge steder. En modul her kan bare kreve andre moduler i samme mappe.

### i dag og plan
| Fil | Rolle |
|---|---|
| `idag.js` | Regler: arbeidskøen (rangering, utsett, ferdig) |
| `idagui.js`, `idnew.js`, `idcmd.js` | Visning: I dag, Denne uken, Denne måneden |
| `services/planning.js` | Regler: ett seksmånedersmål, alt annet utledes |
| `g3.js`, `planui.js` | Visning: Mål og prognose |

### marked
| Fil | Rolle |
|---|---|
| `mseed.js` | Data: offentlig researchgrunnlag (lokaler, priser, kilder) |
| `u3.js` | Regler: felles beregninger for markedsarbeid (dekning, segmentfit) |
| `u3seed.js` | Data: eksempeldata for demomodus |
| `market.js`, `market2.js`, `m3.js`, `m3v.js`, `mkgap.js` | Visning: sammenligning, posisjonering, oversikt, markedsgap |

### kunnskap
| Fil | Rolle |
|---|---|
| `kb.js` | Regler: kunnskapslag (søk, bookinger, grunnlag med kilder) |
| `kbui.js`, `kn.js`, `i3.js`, `ask.js` | Visning: «Spør om kunden», chatflate, Innsikt, sidepanel |

## `server/`

| Sti | Rolle |
|---|---|
| `src/app.js`, `src/api/` | HTTP-API som følger `SalongBackend` |
| `src/db/` | Migrasjoner og repositories (PostgreSQL) |
| `src/research/` | Research-motoren som enrichment-workeren kaller (se README der) |
| `test/` | `node --test`; `research-*.test.js` dekker motoren |

## Flytteplan (ikke gjort ennå)

Resten av filene flyttes til `src/<domene>/` med lesbare navn i én ren flytte-PR uten andre endringer. Rekkefølgen i `MODS` beholdes. Research-reglene er allerede flyttet (`src/research/`), fordi serveren må kunne importere dem.
