# Claude Artifact -> PostgreSQL (privat engangsimport)

Dette er importflyten for en ekte Salong-eksport. Ingen datafil eller DATABASE_URL skal inn i Git, issue/PR eller testfixture. GitHub-repoet er offentlig.

## 1. Eksport lokalt

Legg eksakt råeksport i gitignored data/exports/. Formatet har toppnivå collections, og collections.<collection>.<doc_id> inneholder dokumentobjektet.

- Eksportfilen redigeres ikke før import.
- Alle data (også example: true og audit) lagres som dokumentverdier i artifact_export.documents (jsonb).
- Dokumenter med example: true blir ikke mappet til CRM-tabellene.
- jsonb bevarer dokumentverdien, men ikke opprinnelig tekstformatering eller nøkkelrekkefølge. Behold derfor original JSON-fil privat som backup.

## 2. Kjør kontroll uten database

    npm run import:artifact -- --file data/exports/salong-artifact-export-2026-10-08.json --dry-run

Kommandoen viser planlagt antall per tabell og hvilke poster som ikke kan mappes, med `review_required_count` og `review_reason_counts`. Den kontakter ingen API-er og skriver ikke til database.

## 3. Migrer og importer med eksplisitt godkjenning

Før import: lag en databackup. Kjør kun mot et nytt/tomt CRM-skjema (med eventuelt én manuelt provisionert members-rad). Start ikke workeren under migreringen.

Sett DATABASE_URL i miljøet på egen maskin/host. Bruk Supabase sin PostgreSQL-tilkoblingsstreng fra prosjektet ditt, ikke en API- eller anon-nøkkel.

    npm run db:check
    npm run import:artifact -- --file data/exports/salong-artifact-export-2026-10-08.json --apply

--apply er et separat, eksplisitt valg. Skriptet kjører versjonerte migrasjoner, åpner én transaksjon, sjekker at måltabellene er tomme, skriver alle raw-dokumenter til staging, og deretter mapper det de kan til CRM-tabellene. Ved feil rulles staging og CRM-innsettingene tilbake. Importen nekter å blande eksportdata med en eksisterende CRM-database.

Etterpå returneres planlagte antall, faktiske rader per tabell og umappede dokumenter. Verifiser dette mot eksporten før API/worker aktiveres.

## Mapping (bevisst konservativ)

- orgs -> organizations (organisasjonsmetadata)
- mtacc -> prospects, og organizations for kontoer som ikke finnes i orgs; organisasjoner fra orgs prioriteres ved overlapp
- mtper -> contacts (krever konto og navn)
- deals -> opportunities (strengt tillatte stage-verdier)
- acts -> activities (krever gyldig type, tidspunkt og konto/sak)
- mtbat -> prospect_batches og prospect_batch_accounts (kun eksisterende kontoer)
- mtjob -> enrichment_jobs, historiske og ikke automatisk kjørbare: tidligere queued/running blir cancelled; gamle fullførte jobber blir needs_review siden research-resultatene ikke er normalisert
- audit, members, settings og alle andre samlinger beholdes bare i staging inntil egen mapping/review

Salong autoriserer ikke på grunnlag av gamle members fra artifakten. Lag en ny eier i Supabase Auth og én members-rad med eksakt auth_subject (Supabase Auth user UUID). Ikke autogodkjenn hovedkontakter. Eierskap til kontoer, fritekst, historikk, dokumenter og researchfelter som ikke passer i målskjemaet, er bevart i staging og må vurderes separat.

Hvis orgs har innebygde kontakter, eller en post peker til en konto som er utelatt som eksempel/ikke finnes, rapporteres forholdet og råinnholdet beholdes. Ingen tilfeldige navn, e-poster, kontakter eller organisasjoner opprettes for å fylle hull.

## Sikkerhet

- artifact_export er en egen PostgreSQL schema, ikke en PostgREST-eksponert public-tabell.
- Staging inneholder persondata. Begrens DB-brukerens tilgang og bruk privat backup/sletting etter besluttet oppbevaringstid.
- Ingen Apollo/Exa/Anthropic-kall under import.
- Ingen automatisk produksjonsaktivering eller kontogodkjenning.
- Hvis import må gjentas: gjenopprett et tomt målsystem fra backup eller bruk et nytt miljø. Verktøyet overskriver ikke tidligere data.

## Importstopp for umappede reelle dokumenter

Dersom noen dokumenter uten `example: true` ikke lar seg mappe fullt ut, nekter `--apply` nå å starte en databasetransaksjon. Dette er tilsiktet: den faktiske Claude-eksporten har referanser til organisasjoner som bare finnes som eksempler, og mange Research- og audit-felter kan ennå bare lagres i staging. Undersok rapporten og godkjenn tap av normaliserte koblinger for eventuell import.

Forst etter manuell gjennomgang kan en operatør eksplisitt kjore `--apply --allow-unmapped`. Da bevares alle ra dokumenter i privat staging, mens de ikke-mappede blir i staging til senere opprydding. Dette er ikke standardanbefalingen for produksjon. `--allow-unmapped` alene uten `--apply` er ugyldig.
