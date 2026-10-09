# Salong: koble vanlig grensesnitt til ekte selskaper

Status 9. oktober 2026: Importen er kontrollert i Supabase (154 organisasjoner, A=26, B=93, C=35). Separat, autentisert leseliste er i drift på Salong API, men dette er ikke den fullverdige Salong-appen.

## Hvorfor ikke bare slå på HTTP-backend?

Den nåværende store Salong-appen har synkrone lokale data i `S.orgs`, `S.mtacc`, `S.deals` og `S.acts`. Prospektering, `mtBuild()`, kundekort og arbeidskø beregnes fra denne tilstanden. Tjenestelaget tilbyr noen HTTP-kall, men mange UI-visninger og mutasjoner bruker fortsatt lokale repositories. En direkte backend-switch ville kunne blande demo og ekte data eller gi inntrykk av at endringer lagres når de ikke gjør det.

## Trygg fremdrift

1. **Datakontrakt** (denne PR-en): Testet, rent oppslag fra API-felter til Salongs `orgs`-format, uendrede ID-er og A/B/C, uten lagring eller sideeffekter.
2. **Separat autentisert Salong-modus:** Vis det eksisterende UI-et på egen API-hostet rute. Før lasting kreves gyldig Supabase-innlogging. Hent `/api/organizations` med bearer-token og fyll et rent serverbasert datasett. Inntil andre tabeller er migrert, blokker alle knapper og aktiviteter som kan skrive, og vis tydelig «Lesemodus — ekte data». Vis aldri blandede demo-kunder.
3. **Ekte mutasjoner:** Opprett server-endepunkter for ny bedrift og kontrollert endring av segment/prioritet. Rolle-/medlemskontroll på hvert endepunkt. Revisjonslogg og beskyttelse av manuelle overstyringer. Bekreft serverlagring og hent data på nytt før UI sier «Lagret».
4. **Kontakt og aktivitet:** Flytt gjeldende kundekort, kontakter, oppfølgingsoppgaver, `I dag` og kalender med fullstendige CRUD-kontrakter. Test gjeninnlogging og tomme/feilende API-responser.
5. **Mål mot 500:** Definer ønsket kontaktdato og tell antall *unike selskaper kontaktet*, avledet fra reelle aktiviteter. Dagsmål styres av antall gjenværende arbeidsdager, ikke en maksgrense på 7.

## Leveransevern

- Ikke endre `Salong`-demoens Railway-service eller dens URL.
- Ikke eksponer selskapsdata uten Supabase Auth og et aktivt `members`-medlemskap.
- Ikke legg eksport, databasepassord eller tokens i GitHub eller statiske artefakter.
- Ingen automatisk utsending, berikingsjobber eller kontaktlogging i lesemodus.
- Ikke innfør en ny parallell kundetabell; bruk `public.organizations`.
