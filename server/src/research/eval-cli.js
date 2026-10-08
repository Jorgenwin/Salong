#!/usr/bin/env node
'use strict';

// Kjør fasiten uten nett:  node server/src/research/eval-cli.js sti/til/fasit.json
// Filen er en liste med cases (se eval.js). Skriver ett sammendrag og én linje per organisasjon.

const fs = require('node:fs');
const { runEval } = require('./eval');

(async () => {
  const file = process.argv[2];
  if (!file) { console.error('Bruk: node server/src/research/eval-cli.js <fasit.json>'); process.exit(2); }
  const cases = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = await runEval(Array.isArray(cases) ? cases : cases.cases, { now: cases.now ? () => new Date(cases.now) : undefined });
  for (const r of report.cases) {
    console.log([r.id, r.status, 'kontakter ' + (r.contactRecall == null ? '–' : Math.round(r.contactRecall * 100) + ' %'), 'anbefalt ' + (r.recommendedCorrect == null ? '–' : r.recommendedCorrect ? 'riktig' : 'FEIL'), 'event ' + (r.eventRecall == null ? '–' : Math.round(r.eventRecall * 100) + ' %'), `søk ${r.cost.searches} · sider ${r.cost.fetches} · LLM ${r.cost.llmCalls}`].join('  |  '));
  }
  console.log('\n' + JSON.stringify(report.summary, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
