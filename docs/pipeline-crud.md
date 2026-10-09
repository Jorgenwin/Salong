# Ekte pipeline: opprette saker og endre salgsfase

Dette er CRM-funksjoner, ikke reservasjoner i Litteraturhusets bookingsystem.

## Lagringsflyt

- Innlogget **owner/editor** oppretter en salgsmulighet i **Pipeline → Ny salgsmulighet**.
- `POST /api/opportunities` krever et eksisterende selskap og tittel. Valgfritt: arrangementsdato, forventet verdi, rom og notater. Startfase er alltid `ny`.
- Samme selskap + samme tittel + samme arrangementsdato kan ikke opprettes to ganger, selv ved samtidige forsøk.
- Salgsfase endres eksplisitt i Kanban-kort eller pipelinetabell. `POST /api/opportunities/:id/stage` krever `expectedStage`, og returnerer **409** hvis en annen bruker allerede har flyttet saken.
- «Tapt» krever årsak. Lagring oppdaterer `stage_at` og `updated_at`, men oppretter aldri en booking, sender aldri e-post og endrer aldri en kontakt automatisk.
- Alle opprettelser og reelle faseendringer logges atomisk til `crm_opportunity_events` med aktiv medlems-ID, tidspunkt og før/etter. Idempotente oppdateringer dobbeltskriver ikke revisjonsspor.
- Nye selskapsposter og aktivitetshistorikk fra tidligere PR-er berøres ikke.

## Sikkerhet og visning

- Supabase JWT verifiseres av Salong API, som kontrollerer aktiv `members`-rad og minimumsrolle **editor** før alle skriveruter.
- `reader` kan se pipeline og selskap, men får ingen opprett- eller faseknapper.
- Vellykket serversvar før grensesnittet viser lagret. Ved feil beholdes den gamle fasen og pipeline hentes på nytt.
- Ingen hemmeligheter, database-URL, Supabase passord eller API-tokens legges i offentlige JavaScript-filer.
- `004_opportunity_audit.sql` er en additiv migrasjon, bruker RLS uten lesepolicy og kjøres av API-et ved oppstart. Den endrer ikke bookings- eller aktivitetstabellene.
- Den statiske Salong-demoen har separat Railway watch pattern og endres ikke av denne utrullingen.

## QA før daglig bruk

CI må bestå: backend syntax/test, PostgreSQL integrasjon med syntetiske selskaper, Playwright (eier oppretter/flytter, leser kan ikke), samt Docker-build. Etter merge: sjekk Railway Salong API `SUCCESS`, demo `SKIPPED` og at `/crm` fortsatt åpner. En ekte innlogget eier må til slutt sjekke skjemaet i nettleser med egne data, men dette bør ikke kreve Terminal.

**Begrensning:** Registrert «bekreftet» fase er en intern salgsstatus, ikke en bekreftet booking eller fakturert inntekt. Separat bookingsynk krever godkjent integrasjon.
