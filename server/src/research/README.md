# server/src/research

Research-motoren bak «Berik». Enrichment-workeren kaller `runResearch()`; alt annet her er deler av den. Beslutningen står i `docs/decisions/0002-research-engine.md`.

```
runResearch({account, ports, cache})
  enrPipeline (delt med frontenden, src/research/pipeline.js + method.js + rules.js + events.js):
    søketreff → hele sider → LLM-uttrekk ved behov → personsøk ved behov → verifikator → rangering
  → {status, sourceStatuses, result, steps, rejected, usage}
toRows(run, {jobId, organizationId}) → {job, result, sources, facts} i formen repositoriene på main tar imot
```

Metoden bor i `src/` og er den samme som Artifact-utgaven kjører. Denne mappen inneholder det bare en server kan gi.

| Fil | Rolle |
|---|---|
| `engine.js` | `runResearch`: kobler porter, kjører den delte pipelinen, setter status og resultatform |
| `shared.js` | Importgrensen: `require()` på `src/research/*.js` (ingen kopi, ingen eval) |
| `ports.js` | Portene motoren trenger, feilklasser, cache og budsjett imellom |
| `page-cache.js` | Hver URL hentes én gang, også på tvers av jobber |
| `budget.js` | Tak per jobb med navngitt stoppårsak |
| `persist-map.js` | `toRows`: fra et resultat til det `enrichmentResults`, `sources` og `researchedFacts` i `server/src/db/repositories.js` tar imot |
| `eval.js`, `eval-cli.js` | Opptak, avspilling og måltall |

`shared.js` er grensen: den gjør `require()` på modulene i `src/research/`. Ingen eval, ingen vm, ingen fillesing. Serveren må derfor deployes med `src/research/` ved siden av `server/`.

## Porter

```js
search(query, {objective, numResults})   // -> [{url, title, text, published?}]
fetch(urls)                              // -> [{url, text, title?, links?}]
apollo.findOrganization({name, domain})  // -> {matched, id?, name?}
apollo.searchPeople({domain, orgId, titles, keywords}) // -> {people, count}
llm.complete({system, prompt, maxTokens, tier})        // -> {text, usage?}
```

En port melder feil ved å kaste en `Error` med `code`: `not_connected`, `not_configured`, `unauthorized`, `plan_restricted`, `rate_limited`, `timeout` eller `upstream_error`. Mangler porten, blir kilden `not_connected`. Ingenting simuleres.

## Måle før du endrer

```bash
node server/src/research/eval-cli.js server/test/fixtures/research-golden.sample.json
```

Eksempelfilen er syntetisk. En ekte fasit lages ved å pakke ekte porter i `record()` (se `eval.js`), kjøre 20–30 organisasjoner der riktig kontakt er kjent, og lagre kassettene **utenfor repoet**: de inneholder navn og e-post til virkelige personer.

## Tester

`npm run test:server` kjører `server/test/research-*.test.js` sammen med resten, og `npm run server:check` syntakssjekker modulene her og i `src/research/`.
