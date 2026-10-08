# Backend-veikart

Arkitekturvalget for backend v1 er dokumentert i [docs/decisions/0001-backend-v1.md](decisions/0001-backend-v1.md).

Dette dokumentet beskriver faktisk status i repoet, ikke bare den opprinnelige planen.

## Fase 1 – prototype og kontrakter ✅

På plass:

- GitHub er source of truth; frontend bygges fra `src/`.
- `SalongServices` og `SalongBackend` er kontrakten mellom UI og data/backend.
- Artifact og standalone-app bruker samme delte research-metode.
- Berik har kildeverifikasjon, tidlig stopp, kostnadsbudsjett/cache og menneskelig valg av hovedkontakt.
- Eksempeldata er isolert fra driftsdata; hemmeligheter skal aldri inn i frontend eller Git.

## Fase 2 – ekte backend og persistent Berik 🚧

På `main`:

- Node HTTP-server og `/health`.
- PostgreSQL-skjema, migrasjoner, live runtime/pool og integrasjonstest.
- Repository-lag for CRM, kalender, enrichment-jobber, resultater, kilder og researched facts.
- Read-API for accounts, prospects, contacts, opportunities og kalender.
- Persistent enrichment-HTTP-kø for enkeltkonto og batch.
- Atomisk jobbclaim med PostgreSQL, retries, worker-lås og eksplisitte kilde-/feiltilstander.
- Delt `runResearch()` koblet til workeren.
- Prosess-livssyklus for workeren med heartbeat og graceful shutdown.
- Server-side adaptere for Exa, Apollo og Anthropic. Adapterne er inaktive uten servernøkler.
- Server-side rollegrense for owner/editor/reader.
- Frontend HTTP-adapter uten stille fallback til lokal lagring.
- Berik UI har tydeligere research-/kilde-/statusvisning og mobilpolish.

Neste arbeid:

1. Merge/aktivér provider-runtime og eksplisitt `worker:start` (PR #54).
2. Koble konkret auth-provider til den eksisterende auth-grensen.
3. Implementer de CRM-skriveendepunktene UI-et fortsatt trenger.
4. Kjør en privat fasit/eval på 20–30 virkelige organisasjoner før større providerforbruk.
5. Bytt produksjons-UI eksplisitt til `httpBackend` først når auth, writes og deployment er på plass.
6. Deployment/runbook: API + worker som separate prosesser, secrets, backup/restore og observability.

## Fase 3 – booking, e-post og automatisering

- Bookingsystem: importer først, synk senere.
- E-post: utkast først; sending bare etter en egen eksplisitt beslutning.
- Periodisk research/påminnelser først når v1-datakvalitet og kostnader er målt.
- Overvåking og kostnadsstyring for kreditt-/tokenbaserte kilder.

## Guardrails

- Produksjonsdata i PostgreSQL, aldri i Git.
- Provider-, database- og auth-nøkler kun serverside.
- Ukjent researchdata forblir `null` / «Ikke dokumentert».
- Providerfeil må være eksplisitte; de skal aldri bli et tomt «vellykket» resultat.
- Hovedkontakt godkjennes av et menneske.
- Apollo person-match/e-post er kredittbruk og skal være en eksplisitt handling, ikke automatisk bulk enrichment.
- Ingen agent-framework eller agenter som chatter med hverandre: orkestreringen er vanlig, testbar kode.
