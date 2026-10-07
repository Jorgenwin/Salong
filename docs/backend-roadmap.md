# Backend-veikart

Kort, tre faser. Backend-teknologi velges i en egen økt; ingenting her er installert eller deployet.

## Fase 1 – nå

- GitHub er kildekoden. Frontenden fungerer og bygges med `npm run build`.
- Tjenestelag (`SalongServices`), `EnrichmentJob`-modell og Apollo-adapter finnes og er testet.
- Data er lokale/prototype: Claudes `db` i artefakten, eksempeldata i demomodus. Ingen hemmeligheter i koden.
- Kjent begrensning: research kjører bare mens siden er åpen og seeren har samtykket.

## Fase 2 – ekte database og API

- Database og API som implementerer `SalongBackend` (se `src/services/types.js`): organisasjoner, personer, saker, aktiviteter, prospekter, enrichment-jobber og -resultater, kilder.
- Innlogging og enkel tilgang (eier/redaktør/leser; ikke full RBAC).
- Integrasjoner flyttes serverside bak adapterne: `apolloAdapter.setTransport(...)`, Exa/Firecrawl. Nøkler i miljøvariabler.
- Persistente enrichment-jobber med en enkel arbeider (kø i databasen), slik at research ikke avhenger av en åpen side.
- Frontend bytter med `SalongServices.use(httpBackend)`. Resterende `crm.*`-kall flyttes bak tjenestelaget før dette.

## Fase 3 – booking, e-post, automatisering

- Bookingsystem (importer først, synk senere), e-post (utkast først; sending bare etter en eksplisitt beslutning).
- Eventuelle bakgrunnsarbeidere for periodisk research og påminnelser.
- Overvåking og kostnadsstyring for kreditt-baserte kilder.
