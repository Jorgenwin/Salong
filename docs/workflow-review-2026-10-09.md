# Salong: ekstern produktgjennomgang – beslutninger 9. oktober 2026

Kilder: de to overleveringene som beskriver «flyt- og sekvensdesign» og «ekstern gjennomgang». Dette er gjennomgang av forslagene, ikke dokumentasjon av faktisk produksjonsfunksjon. Verifisert mot dagens `src/idcmd.js`, `src/idag.js`, `src/mt.js`, `src/tier.js`, `src/tierseq.js`, `src/services/crm.js` og eksisterende backend-DB.

## Begreper som aldri må blandes

- **A/B/C:** kvalitet av selskapet i `organizations.tier`, med kulturprofil og kildegrunnlag. Antall ubegrenset, manuelle endringer prioriteres.
- **Tier 1/2/3:** Salongs eksisterende arbeidsmåte for prospekter (personlig, telefon, utkast), beregnet dynamisk. Tier 1 maks 30 og kulturprofil 3. Ikke en direkte 1:1 mapping fra A/B/C.
- **P0/P1/P2:** segmentprioritet, ikke en individuell virksomhets karakter.
- `previous_customer` / `former`: skal bare settes ved faktisk leiehistorikk, ikke fra en antatt kulturprofil.

## Valgt og implementert i PR #76

1. **Kø fremfor dashbord.** `idQueue` beholder én prioritert neste handling per organisasjon, maks sju i normal `I dag`-visning, høyeste eksisterende hastegrad vinner. Alle underliggende saker, oppgaver og hendelser ligger fortsatt i CRM. Eksisterende fire detaljblokker ligger sammenlagt under «Flere detaljer fra CRM».
2. **Berik som handling, ikke bare status.** Operative, kvalifiserte accounts med manglende kontaktdata kan få «Berik – finn relevant kontaktperson» i køen, prioriteres av eksisterende Tier 1 → 2 → 3 og fit. Ved registrert bounce foreslås ny kontaktkontroll selv om gamle kontaktfelt fortsatt finnes. Ingen Berik-jobber kjøres automatisk.
3. **Rask samtalelogging.** Telefonsteg med faktisk, aktiv kontakt og telefonnummer viser «Logg samtale» → «Nådd / Ikke nådd / Svarer senere». Resultatet lagres som aktivitet; telefonsteg markeres gjennomført uten dobbel logging. Det sendes ikke e-post, og «Svarer senere» lager ikke en udokumentert dato – brukeren setter selv avtalt tidspunkt.
4. **Signal-stopp fra registrerte hendelser.** Manuelt logget innkommende svar, bounce eller opt-out stanser en aktiv sekvens. `tsDue` og `tsUpcoming` utelater stoppede kontoer; `mtStep` kan ikke avansere en stoppet sekvens. Et registrert svar gir førsteprioritet for personlig oppfølging i køen. Ingen e-poståpning blir antatt som et verifisert signal.
5. **14-dagersregelen.** Eksisterende «kontaktet siste 14 dager» fra meningsfulle utgående aktiviteter beholdes. Forfalte oppfølginger får ekstra rangering ved minst 14 dager. Vektene og kapasitetsbudsjettet i Tier-systemet beholdes konfigurerbare; vi hardkoder ikke 12/6/2 timer.
6. **Stopp- og personvern.** Opt-out prioriteres over pågående sekvens; status beholdes for revisjon. Ingen automatisk e-post eller masseopptak, og ingen statusendring i faktiske avtaler gjøres fra heuristikker.

## Viktige forslag som ikke skal implementeres blindt nå

- **Live reply/open/bounce-webhooks** krever ekte postkasseintegrasjon, identitet, idempotency-nøkler, event-lagring og robust personvern. I dag er signalene bare så gode som det brukeren faktisk logger / godkjent Apollo-import. E-poståpning alene er dessuten et usikkert engasjementssignal.
- **Tier 1 automatisk nedgradering etter to forsøk** bør først vises som forslag med eksplisitt godkjenning. Manuelle tier-overstyringer må aldri slettes av en batch.
- **Tre anropsforsøk, fast 3-ukers sekvens og warm-track** påvirker alle eksisterende aktive `enrolledAt`-datoer. Bygg versjonerte kadens-definisjoner før vi migrerer denne logikken; ellers kan neste frist hoppe bakover.
- **Ukentlig cron klokken 08, visningssamlinger og sendt e-post** forutsetter backend-scheduler, avklart Oslo-tid, autentiserte handlinger og en kalender som kan verifisere reell ledighet. Nå er ukeplanen avledet fra seksmånedersmålet og ikke en kjørende jobb.
- **Nye `accounts`, `deals`, `tasks`, `audit_log`-tabeller** må ikke kopieres fra skissen. Salong har allerede `organizations`, `opportunities`, `activities`, `prospects`, `members` og en gammel `audit`-samling i staging. En fremtidig migrasjon bør utvide eksisterende modeller i stedet for å skape parallelle sannheter.
- **Generell idempotent upsert-import** er ikke gitt i eksisterende engangsimport. Den nekter å blande data med en ikke-tom CRM-database, slik at forsøk på re-import ikke kan overskrive eksisterende manualt arbeid. Utvikle separat idempotent sync med diff-preview, orgnr/domene-match, manuelt overstyringsvern og audit før kontinuerlig synkronisering, *etter* initial import.
- **Supabase RLS** er viktig ved direkte klienttilgang, men må koordineres med den faktiske autentiserte backend/SQL-rollen, sikkerhetspolicy og testdekning. Ikke slå på tilfeldige policies som stopper det kjørende API-et. Backend bruker allerede en Auth boundary.
- **Slett alle fixtures** er risikabelt uten eksplisitt fixture-kilde og kontrollert slettejobb; bruk separate testdatabaser/merkede testdata og la ekte data stå urørt.
- **Pris-/økonomimodul og kundeportal** holdes utenfor denne leveransen.

## Videre rekkefølge

1. Test PR #76 med syntetiske kontoer, telefonutfall, bounce/opt-out og eksisterende frontend-regresjoner.
2. Behold importen fra Claude som **separat manuell produksjonsoperasjon** med backup, `--dry-run`, kontrollert `--apply`, deretter kontroll av 154 navngitte selskaper og A/B/C. Ingen endringer i Railway under denne PR-en.
3. Når ekte data og innlogging fungerer: implementer robuste backend-hendelser og sikker idempotent `audit_log` i egen migrasjon; deretter fase-/sekvensmaskin med klokke injisert i tester (`Europe/Oslo` i UI).
4. Bruk faktiske tilbakemeldinger fra selger på daglig logging og køen før vi bygger flere dashboards.
