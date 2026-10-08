# Klargjør CRM-databasen: kontrollert drift

Vi har to Railway-tjenester: `Salong` (statisk demo) og `Salong API` (PostgreSQL-backend). Ikke legg DATABASE_URL eller Supabase-nokler i demoen.

## Skjema

En ny eksplisitt CLI er tilgjengelig i API-containeren:

- `npm run db:setup -- --check` rapporterer migrasjoner og om nødvendige CRM-tabeller finnes, **uten å skrive data**.
- `npm run db:setup -- --apply` kjører de versjonerte migrasjonene og verifiserer tabellene. Må bare kjøres etter backup og verifisert databaseprosjekt.

Ikke sett `db:setup --apply` som permanent Start Command på Salong API: den skal bare kjøres én gang i en midlertidig, privat engangsjobb eller et kontrollert terminalmiljø med samme DATABASE_URL. Ikke endre oppstartskommandoen til den fungerende API-tjenesten.

## Eier

Etter at tabellene er opprettet: bekreft at selvregistrering/anonym innlogging er av i Supabase Auth. Sett SALONG_OWNER_AUTH_SUBJECT til Auth User UID fra riktig Supabase-prosjekt, samt SALONG_OWNER_NAME (og valgfritt e-post) kun i engangsjobben. Kjør `node server/scripts/provision-owner.js --apply`. Den oppretter bare én `owner` og nekter hvis members allerede inneholder rader. Den skriver ikke brukerpassord.

## Selskaper først

Følg docs/artifact-import.md med `--companies-only --dry-run` før import. Eksporten skal være i gitignored data/exports lokalt i et kontrollert miljø. Vurder manglende selskapsnavn før import; ikke bruk `--allow-unmapped` ukritisk. Sett aldri kundedata eller passord i GitHub, Railway-buildkontekst eller chat. API-et er ikke det samme som en ferdig frontend-innlogging.

## Railway

Auto deploy for API kan stå av mens onboarding pågår. Gi aldri en midlertidig jobb offentlig domain. Hold demoen tilgjengelig og uten ekte data. Etter migrasjoner: bekreft at API-et starter, `/health` svarer og `/api` krever gyldig eiertoken. Produksjonsfrontenden kobles først til når disse kontrollene er bestått.
