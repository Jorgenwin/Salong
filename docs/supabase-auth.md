# Supabase Auth - en privat Salong-eier

Salong v1 er forelopig ett-bruker. Supabase Auth er identitetsleverandor, mens rollen kommer fra public.members. Brukerens access token verifiseres av Supabase Auth /auth/v1/user (ikke ved å stole på et uverifisert token). Dette fungerer både for nye asymmetriske signeringsnokler og legacy HS256 uten at Salong trenger JWT-secret.

## Oppsett i Supabase

1. Opprett eieren som en konto under Authentication > Users i prosjektet Salong. Bruk en invitasjon eller administrativ opprettelse.
2. Slå av nye registreringer: Authentication > Settings / General > Allow new users to sign up = off. Slå også av anonyme innlogginger. Bekreft at eksisterende eier kan logge inn.
3. Finn User ID (UUID) til den kontoen i Authentication > Users.
4. Behold PostgreSQL DATABASE_URL privat på API-/worker-host. Sett SUPABASE_URL og SUPABASE_PUBLISHABLE_KEY for API-host. Disse brukes av serveren til tokenkontroll. Ikke legg admin-/service-role-nokler i nettleseren.
5. Sett SALONG_OWNER_AUTH_SUBJECT til UUID i et privat terminalmiljo, SALONG_OWNER_NAME til visningsnavn og valgfritt SALONG_OWNER_EMAIL.
6. Kjor migrasjoner og provisjoner nøyaktig én eier:

    npm run db:check
    node server/scripts/provision-owner.js --apply

Skriptet nekter hvis members allerede har rader. Det importerer aldri roller eller brukere fra Claude-artifaktet. Eierskapet opprettes bare av denne eksplisitte driftskommandoen med auth UUID fra Supabase.

## API-autorisasjon

Salong aksepterer en Authorization: Bearer <access_token>-header. Serveren kontrollerer tokenet via Supabase Auth, slår deretter opp sub i members.auth_subject og håndhever owner/editor/reader. Uten aktiv member returneres 403. Ugyldig/manglende token returnerer 401. Et reelt DATABASE_URL uten fungerende auth vil gi 503 på /api selv i development, slik at en utviklingsdatabase ikke eksponeres ved et uhell. /health forblir offentlig.

En publisert nettleser-innlogging og frontend-bytte til httpBackend er et eget steg: autentiseringsverifikasjon på API-et er ikke alene en ferdig login UI.

## Leverandorer

Apollo, Exa og Anthropic er allerede kodet som serveradaptere. Sett APOLLO_API_KEY, EXA_API_KEY og ANTHROPIC_API_KEY i vertsmiljoet for workeren. Ikke bruk provider-credentials under datamigreringen, og ikke start worker for en nyimportert database for den er kontrollert. Sjekk planens kredittrestriksjoner for Apollo personoppslag. Ingen automatisk e-postsending.

## Drift / sikkerhet

- Supabase-prosjektets varslede region eu-north-1 og referanse finnes hos eier, men kode skal ikke stole pa hardkodede identifikatorer.
- Ta backup og verifiser eierkonto manuelt for produksjonsbytte.
- Auth-verifisering er online per API-kall, slik at feil ved Supabase Auth feiler lukket.
- En eneste members-rad gir bare eieren tilgang; å åpne registrering krever senere eksplisitt produktbeslutning.
