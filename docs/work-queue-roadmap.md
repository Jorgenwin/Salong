# Salong: arbeidskø først – vurdering av ekstern gjennomgang (9. oktober 2026)

Retning: «I dag» skal foreslå **én neste handling per konto**, ikke fungere som et overvåkingsdashbord. Første endring viser opptil sju forskjellige kontoer, prioriterer allerede registrerte svar og forfalte oppgaver, og beholder alle øvrige oppgaver på de originale CRM-objektene.

## Allerede implementert i dagens app

- `src/idag.js` henter eksisterende oppgaver, forespørsler, tilbud og sekvenssteg til samme prioriterte kø, med årsaksforklaring, «Ferdig», «Utsett», «Logg kontakt» og fokusmodus.
- `src/tier.js` / `src/tierseq.js`: Tier 1/2/3 med personlige, telefonbaserte og e-postbaserte kadenser; varm gjenaktivering får egen sekvens. Maler er utkast, ikke automatisk sending.
- `src/mt.js`: Dokumentert/antatt eventsignal, fit etter kilde, 14-dagersdekning, kvalifisering og manuell overstyring.
- `src/idag.js`: Ukeplan, oppfølging av tilbud og baklengsmål via eksisterende målmodul.
- `server/db/migrations/001_initial.sql`: Reelle `organizations`, `prospects`, `activities`, `opportunities`, `members`; dette er **ikke** den foreslåtte separate `accounts`-tabellen. Bevar den eksisterende modellen.

## Endring i denne PR-en

- Maks 7 **ulike kontoer** i «I dag» (tidligere opptil 10 handlinger fra samme eller forskjellige kontoer).
- Hvis én konto har flere oppgaver, viser vi bare den høyest rangerte som «neste». Ingen underliggende oppgaver slettes, fullføres eller skjules permanent; alt er tilgjengelig på kontoen.
- Antallet «flere» teller nå kontoer, ikke dupliserte oppgaver.
- Automatisk utsending, endring av pipeline-steg, automatisk nedgradering og kalenderbooking er **ikke** aktivert. Slike handlinger må ikke utløses før vi har ekte hendelses- og samtykkedata.

## Neste trygge utviklingstrinn (ikke inkludert)

1. **Dataførst:** Selskapsimport, rådata i staging, ekte owner-auth og feltvis manuelt overstyringsvern/audit ved senere oppdateringer. Den eksisterende engangsimporten er transaksjonell og nekter å blande med produksjonsdata; den er **ikke** generell idempotent upsert.
2. **Riktig 14-dagersregel:** Sett en lesbar, kildebasert «sist meningsfull kontakt» på kontoen; bare inn-/utgående reell kontakt, ikke notater, interne oppgaver eller genererte e-postutkast. Test tidsgrenser med injisert klokke og Europe/Oslo som visningssone.
3. **Sekvenshendelser:** Modell for aktiv sekvens, due-at og avmeldingsgrunn. Mottatt svar, bounce, opt-out og møte/tilbud skal stoppe sekvensen idempotent. Ingen faktisk utsending ennå.
4. **10-sekunders logging:** Tre store utfallsvalg ved telefon (nådd/ikke nådd/ring senere), ett-klikk lagring og riktig oppfølgingsdato. Test på mobil.
5. **Blokker/visningsdager:** Ringeblokk og berikbølge er forslag basert på kvalifiserte telefonnummer/kilder. Visningsdag er en delbar ressurs og må integreres med virkelig kalender før tidsluker loves bort.
6. **Baklengs-KPI:** Fortsett å bruke møter, tilbud og bekreftede saker fremfor volum av e-poster. Aktivitetsvekt regnes fra faktiske handlinger, ikke en lagret sannhet.
7. **Fixtures og tilgang:** Skill syntetisk demo fra produksjon; behandle RLS, audit og idempotent import som egne, testede leveranser. Ikke opprett nye parallelltabeller eller åpne API-er ukritisk.

## Viktige forbehold

Dokumentets «12/6/2 timer», «maks 17 telefonkontoer», 14-dagers intervall og sesongregler er anbefalinger, ikke validerte salgstall. Vi skal gjøre dem konfigurerbare når vi bygger dem, ikke låse dem i kode. Skill A/B/C (kulturkvalitet), P0/P1/P2 (segment) og Tier 1/2/3 (arbeidsmetode). Ingen kundedata er lagt i GitHub.
