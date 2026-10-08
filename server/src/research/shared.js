'use strict';

// Grensen mot den delte research-koden.
//
// Metoden og reglene bak «Berik» bor i src/research/ som vanlige CommonJS-moduler:
//   rules.js      rollefamilier, parsere, cdScore
//   events.js     lesing av søke- og hentesvar, datoer, eventsignaler, romvalg
//   method.js     verifikator, LLM-uttrekk, tidlig stopp, hvem som beholdes
//   pipeline.js   enrPipeline og web-operasjonene, bundet til porter
//
// Serveren importerer dem med require() som all annen kode. Ingen eval, ingen vm og ingen lesing av kildefiler som
// tekst. Modulene kjenner verken window, DOM eller Claude-connectorer: alt nettverk kommer inn som porter
// (createWebOps i pipeline.js, io.apollo og io.llm i enrPipeline). Frontend-bygget (src/build.py) pakker de samme
// filene inn i Artifact-bunten, så det finnes én utgave av reglene.

const rules = require('../../../src/research/rules');
const events = require('../../../src/research/events');
const method = require('../../../src/research/method');
const pipeline = require('../../../src/research/pipeline');

module.exports = { ...rules, ...events, ...method, ...pipeline };
