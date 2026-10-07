# data/ og dataopprinnelse

Skillet mellom ekte, eksempel og test er viktig: produksjons-UI skal aldri late som testdata er ekte. Ingen ekte kundeposter ligger i repoet, og ingenting er slettet fra prototypen.

| Type | Hvor | Merking | Brukes til |
|---|---|---|---|
| Offentlig/verifisert referansedata | `src/mseed.js` (`MKSEED`: lokaler og priser, kontrollert 2026-10-05, med kilder), `PROFILES` i `src/app_base.js`, romdata og Litteraturhusets forutsetninger | Kilder og sjekkdato i UI | Marked og posisjon, kundekort. Leses, skrives aldri til CRM-databasen |
| Eksempeldata | `DEMO` i `src/app_base.js` (identisk med `data/example/seed.json`), `u3Seed()` i `src/u3seed.js` | `example: true`, vises med «Eksempel» | Demomodus uten delt database. Kan fjernes under Data og oppsett |
| Salongs anslag | segmentstørrelser, fit, potensial (`mt.js`, `k3.js` m.fl.) | Merket som anslag i UI | Prioritering; ikke dokumentasjon |
| Researchgrunnlag | `data/research/` (offentlige kilder, «Wave 1»; `SPEC.md` beskriver oppdraget) | – | Brukes av testene; ikke bygget inn i appen |
| Testfixtures | `tests/e2e/h.js` og fixtures i testene | `[TEST]`, oppdiktede navn | Bare tester |

`data/example/seed.json` leses av testene. `DEMO` i `app_base.js` må holdes lik den (sjekkes av `tests/e2e/t20.js`).
