# Salong: deployment av demo, API og worker

Tre Dockerfiler lar Railway bygge tre adskilte tjenester fra samme GitHub-repo. Opprett disse manuelt, ingen tjenester blir deployet av denne PR-en.

## 1. Demo (kan publiseres uten ekte data)
Opprett webservice fra main. Dockerfile path: Dockerfile.demo. Sett PORT=8080 om nodvendig. Ingen DATABASE_URL eller API-nokler. Denne versjonen er en merket frontend-demo med syntetiske data, IKKE produksjons-CRM. Sjekk demo-banner, mobil og at ekte kundedata ikke er tilgjengelig. Bruk gjerne adgangskontroll pa preview.

## 2. API (etter Supabase-oppsett)
Opprett annen webservice med Dockerfile.api. NODE_ENV=production, HOST=0.0.0.0, PORT=3000. Sett DATABASE_URL, SUPABASE_URL og SUPABASE_PUBLISHABLE_KEY i vertens secret storage. Healthcheck: GET /health. API er beskyttet av Supabase tokenverifikasjon og public.members. /health er offentlig. Opprett og test eierbruker, se docs/supabase-auth.md.

## 3. Worker (hold AV under import)
Opprett privat bakgrunnsservice med Dockerfile.worker. Bruk samme DATABASE_URL, og legg EXA_API_KEY, APOLLO_API_KEY og ANTHROPIC_API_KEY bare i worker-env. Ingen offentlig domene. Start forst nar data er validert, backup fungerer og en enkelt Berik-test er klar. Ikke kjør bulk research som forste test.

## Manuelle blokkeringspunkter
1. Gjør GitHub-repo privat for drift med reelle CRM-data og kontroller tidligere commits for hemmeligheter.
2. Opprett/inviter deg selv i Supabase Auth, deaktiver offentlig og anonym registrering, og provisioner en enkelt owner (se docs/supabase-auth.md).
3. Sett private DATABASE_URL og provider-credentials i hostingens sikre variabellager. Ikke del nøkler i Git/chat.
4. Last opp Claude-eksport lokalt til data/exports og kjør dry-run med docs/artifact-import.md. Ta backup før apply.
5. Bekreft Postgres migrasjoner, backup/restore, API-auth og en kontrollert én-konto-Berik-jobb.
6. Bygg separat nettleser-innlogging og eksplisitt produksjons-switch til httpBackend før demo kan erstattes med live CRM.
7. Velg eget domene og koble DNS når testmiljoet er godkjent.

.dockerignore holder eksportfiler, lokale hemmeligheter, og avhengigheter utenfor Docker build context. Demo og API skal ikke forveksles: demo serverer bare statiske filer.
