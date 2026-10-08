# ADR 0002 – Research-motor og agenttrinn

Status: **Akseptert og implementert**. Delt research-kjerne, Artifact/Berik-integrasjon og server-worker-kobling ligger på `main`.

Dato: 2026-10-07

## Kontekst

«Berik» kjører i dag i nettleseren: søk via Claude-connectorer, og regler som leser utdrag fra søketreff. Det stopper når siden lukkes, det ser bare det søkemotoren viser, og det finnes ingen måte å måle om en endring gjør resultatet bedre.

ADR 0001 legger enrichment på en server-worker. Dette dokumentet bestemmer hva workeren faktisk kjører, og hvordan mer avansert henting og LLM-trinn legges til uten at Salong begynner å dikte.

## Beslutning

1. **Orkestreringen er vanlig kode.** Én funksjon, `runResearch()`, kjører trinnene i fast rekkefølge. Ingen agenter som snakker med hverandre, ikke noe agent-rammeverk.
2. **Samme metode i Artifact og på server, som vanlige moduler.** Metoden bor i `src/research/` (`rules.js`, `events.js`, `method.js`, `pipeline.js`) som CommonJS-moduler uten DOM, lagring eller Claude-globals. Serveren gjør `require()` på dem (`server/src/research/shared.js`); ingen eval, ingen vm, ingen lesing av kildefiler som tekst. Frontend-bygget pakker de samme filene inn i Artifact-bunten. I Artifact-utgaven er hente-porten `web_fetch_exa` og LLM-porten Claude via `sample`.
3. **Billigst først.** Hvert trinn kjører bare hvis det forrige ikke ga nok:
   1. søketreff (utdrag)
   2. hele ansatt- og arrangementssider fra organisasjonens eget nettsted, lest med de samme parserne
   3. LLM-uttrekk på sider som alt er lest, bare når ingen kan anbefales (høyst to sider per organisasjon)
   4. personsøk i runder, bare hvis det fortsatt mangler en anbefalt kontakt og en reserve
4. **Bevis før alt annet.** En verifikator slipper bare gjennom det som står i tekst vi har hentet: navn og stilling sammen, e-post og telefon ordrett, dato lesbar i kilden. Det gjelder også parserne, ikke bare LLM. LLM-forslag kontrolleres før de slipper inn, så et oppdiktet navn ikke kan stanse søket.
5. **Porter, ikke leverandører.** Motoren får `search`, `fetch`, `apollo` og `llm` som funksjoner. Mangler en port, er kilden `not_connected`. Adapterne med nøkler skrives i steg 7–8 i ADR 0001.
6. **Budsjett per jobb** (søk, sider, LLM-kall, tokens, tid) med navngitt stoppårsak, og **felles sidecache** så en URL hentes én gang.
7. **Mennesket velger hovedkontakt.** Motoren returnerer `needs_review` når det finnes kandidater. Den setter aldri en kontakt som godkjent.
8. **Mål før du endrer.** En eval-rigg spiller av opptak uten nett og gir treffrate og kostnad per organisasjon.

## Agenttrinnene

| Trinn | Type | Når | Fil |
|---|---|---|---|
| Org-oppslag | kode | alltid | `pipeline.js` |
| Eget nettsted og arrangementer (søk) | kode + søk | alltid | `pipeline.js`, `events.js` |
| Hele sider | kode + henting | når en hente-port finnes | `pipeline.js` (`readPages`) |
| Kontaktuttrekk | LLM | ingen kan anbefales | `method.js` |
| Personsøk i runder | kode + søk | mangler anbefalt kontakt og reserve | `pipeline.js` |
| Eventuttrekk | LLM | ingen datofestede arrangementer funnet | `method.js` |
| Verifikator | kode | alltid, på alt | `method.js` |
| Rangering og anbefaling | kode | alltid | `rules.js` |
| Kontaktdata som koster kreditter (Apollo match) | kode | bare som eksplisitt handling | ikke i pipelinen |

Sideinnhold er upålitelige data. Det pakkes inn, modellen får beskjed om ikke å følge instrukser derfra, og svaret må være JSON i fast form. Verifikatoren garanterer **at påstanden står i kilden**, ikke at kilden har rett.

## Kobling til ADR 0001

- Steg 6 er implementert på `main`: `server/src/worker/research-executor.js` kobler `runResearch({account, ports, cache})` til den persistente workeren og bruker `toRows(run, {jobId, organizationId})` for `enrichmentResults`, `sources` og `researchedFacts`. ID-ene er deterministiske, så et nytt forsøk treffer de samme radene.
- `runResearch` returnerer `failed` når ingen kilde svarte. `research-executor.js` oversetter dette til eksplisitte worker-feil med `code` og `retryable`.
- Steg 7–8 (adaptere): implementer portene i `ports.js`. `apollo`-porten har samme form som `src/services/providers/apollo.js`.
- Sidecachen er i minnet nå. Varig cache trenger en egen tabell for sidetekst (`sources` lagrer bare metadata og innholds-hash). Det er en egen migrasjon.

## Det som ikke er gjort, og hvorfor

- **Ingen ekte adaptere.** Det finnes ingen nøkler i denne økten, og en utestet adapter skal ikke se ferdig ut.
- **Ingen LLM-navigator** som selv velger lenker. Faste regler (ansatt- og arrangementssider, vanlige stier) er billigere og målbare. Vurderes hvis fasiten viser at de ikke rekker.
- **Ingen syntese-tekst fra LLM.** «Hvorfor nå» settes fra det best dokumenterte arrangementet. `recommendedUseCase` er `null` på server og avledes av segmentet i frontenden.

## Regler som er endret i denne omgangen

Alle er dekket av tester (`tests/e2e/t21.js`, `tests/e2e/u_cd.js`, `server/test/research-*.test.js`):

- **Tidlig stopp.** Søket stopper når det finnes en anbefalt kontakt og en reserve, ikke først ved tre plausible. På de syntetiske casene gikk antall søk fra 11 til 4.
- **Hele sider** leses med `web_fetch_exa`. Svarformatet er verifisert mot et ekte kall (`# Tittel`, `URL:`, innhold; feil som `Error fetching …`) og har egen parser (`enrParseFetch`). Den gamle direkte-hentingen (`probe`) leste dette formatet feil.
- **E-post og telefon per person** hentes fra linjene som hører til personen på ansattsider (navn, stilling, e-post og omtale på hver sin linje).
- **Stilling skrevet som setning** («er arrangementsansvarlig og planlegger …») kortes til selve stillingen.
- **Feil ved henting eller LLM** stenger ikke lenger resten av web-researchen.

## Konsekvenser

Research blir uavhengig av en åpen nettleser, kan lese hele sider, og kan måles. Frontend-bygget har fått en liten innpakker for modulene i `src/research/` (`RMODS` i `src/build.py`): hver modul får egen `module`/`require` i bunten, og eksportene blir navn i frontendens felles scope. `server/test/research-shared.test.js` feiler hvis noen innfører eval, vm, fillesing eller nettleser-globals på research-stien.
