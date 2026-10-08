# Salong – drifts- og test-runbook

Denne runbooken beskriver hvordan Salong v1 startes og verifiseres uten å legge hemmeligheter eller driftsdata i Git.

## Før du starter

Krever Node 22+, PostgreSQL og private deployment secrets. Ekte kunde-/kontaktdata skal aldri ligge i repoet.

~~~bash
npm ci
npm run check
npm run server:check
npm run test:server
npm test
~~~

Med disponibel PostgreSQL:

~~~bash
npm run test:postgres
~~~

## Miljøvariabler

Se .env.example for full liste. Provider-nøkler skal bare finnes på server/worker og aldri bygges inn i frontend.

Minimum for API med database: NODE_ENV=production, DATABASE_URL og aktiv auth-konfigurasjon.
Minimum for enrichment-worker: DATABASE_URL og minst én av EXA_API_KEY, APOLLO_API_KEY eller ANTHROPIC_API_KEY.
Worker kan i tillegg bruke ANTHROPIC_MODEL, WORKER_ID, WORKER_HEARTBEAT_MS og WORKER_STALE_SECONDS.

## Database

Verifiser tilkobling og migrasjoner:

~~~bash
npm run db:check
~~~

API og worker skal bruke samme produksjonsdatabase i samme miljø. Preview/test-miljøer skal bruke egne databaser.

## Start API

~~~bash
npm run server:start
~~~

Helsesjekk: GET /health. Forventet er HTTP 200 og status ok. I production feiler /api/* lukket hvis auth ikke er aktivert.

## Start enrichment-worker

~~~bash
npm run worker:start
~~~

Workeren plukker persistente jobber fra PostgreSQL, heartbeater aktive jobblåser, re-køer utløpte worker-låser ved oppstart, kjører den delte runResearch()-motoren, lagrer resultater/kilder/fakta og logger heartbeat/providerfeil.

API og worker skal deployes som to separate prosesser selv om de bruker samme kodebase.

## Sikker smoke-test

1. Bruk en testkonto i et ikke-produksjonsmiljø.
2. Start API og worker.
3. Opprett én enrichment-jobb via POST /api/enrichment/accounts/:id.
4. Les GET /api/enrichment/jobs/:jobId.
5. Bekreft overgang queued → running → needs_review|partial|completed.
6. Bekreft at resultatet inneholder kilder og at ukjente felt er null, ikke oppdiktet.
7. Stopp workeren midt i en testjobb, vent over valgt stale-grense i testmiljø, start ny worker og bekreft trygg re-kø/overtakelse.
8. Ikke bruk masseberikelse før én-konto-flyten er verifisert.

## Berik-kvalitet

Før større providerforbruk: test 3–4 ekte organisasjoner manuelt, kontroller anbefalt kontakt mot kilden, kontroller e-post/telefon, bekreft tidlig stopp og se på søk/fetch/LLM-forbruk per organisasjon. Hovedkontakt godkjennes alltid av et menneske.

Den private fasiten på 20–30 organisasjoner skal ikke ligge i dette offentlige repoet.

## Vanlige feil

- database_not_configured: DATABASE_URL mangler.
- providers_not_configured: workeren har ingen research-provider konfigurert.
- auth_not_ready: production-API er startet uten aktiv auth-grense.
- plan_restricted: provideren svarte, men abonnementet gir ikke tilgang. Dette er ikke det samme som ingen treff.
- rate_limited / provider_unavailable / network_error: midlertidige feil med begrenset retry/backoff.
- stale_worker_requeued: en tidligere worker forsvant mens jobben var running; jobben ble lagt tilbake i kø.

## Backup og restore

Før produksjonsbruk: aktiver administrert daglig PostgreSQL-backup, dokumenter retention, og test restore til en separat database. Etter restore: kjør npm run db:check, start API uten worker først, verifiser data, og start deretter worker.

## Produksjonsbytte

Frontend skal ikke byttes til HTTP-backend som standard før auth-provider er aktiv, nødvendige CRM-write-endepunkter finnes, API + worker er deployet, backup/restore er verifisert, repoet er privat og main krever grønn CI.

Byttet skal være eksplisitt via SalongServices.use(createHttpBackend(...)); ingen stille fallback til lokal driftslagring.
