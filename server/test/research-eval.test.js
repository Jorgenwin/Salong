'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { runResearch } = require('../src/research/engine');
const { runEval, replayPorts, record } = require('../src/research/eval');
const { NOW, RYDDIG, searchPort, fetchPort } = require('./research-fixtures');

const GOLDEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'research-golden.sample.json'), 'utf8'));

test('golden sample replays without network and scores the engine', async () => {
  const report = await runEval(GOLDEN.cases, { now: () => new Date(GOLDEN.now) });
  assert.deepEqual(report.cases.map(c => c.id), ['o-ryddig', 'o-prosa']);
  assert.equal(report.summary.contactRecall, 1);
  assert.equal(report.summary.eventRecall, 1);
  assert.equal(report.summary.recommendedCorrect, 1);
  assert.equal(report.summary.unexpectedContacts, 0, 'ingen kontakt utenfor fasiten');
  assert.equal(report.summary.rejected, 1, 'den oppdiktede personen i LLM-svaret ble avvist');
  assert.ok(report.summary.avgSearches <= 12 && report.summary.avgLlmCalls <= 1, 'kostnaden per organisasjon skal ikke øke umerkelig');
});

test('a recording replays to the same result as the live run', async () => {
  const rec = record({ search: searchPort(RYDDIG), fetch: fetchPort(RYDDIG) });
  const live = await runResearch({ account: RYDDIG.account, ports: rec.ports, now: NOW });
  const replay = await runResearch({ account: RYDDIG.account, ports: replayPorts(JSON.parse(JSON.stringify(rec.cassette))), now: NOW });
  assert.deepEqual(replay.result, live.result);
  assert.equal(replay.status, live.status);
});

test('replay never answers for something that was not recorded', async () => {
  const ports = replayPorts({ searches: {}, pages: {}, llm: {} });
  assert.deepEqual(await ports.search('ukjent spørring'), []);
  assert.deepEqual(await ports.fetch(['https://ukjent-test.no/']), []);
  await assert.rejects(() => ports.llm.complete({ prompt: 'ukjent' }), e => e.code === 'not_recorded');
  assert.equal(replayPorts({}).apollo, undefined);
});

test('the eval notices a regression: a missing expected contact lowers recall', async () => {
  const cases = [{ ...GOLDEN.cases[0], expect: { contacts: ['Ola Prøvesen', 'Finnes Ikkesen'], recommended: 'Finnes Ikkesen' } }];
  const report = await runEval(cases, { now: () => new Date(GOLDEN.now) });
  assert.equal(report.summary.contactRecall, 0.5);
  assert.equal(report.summary.recommendedCorrect, 0);
});
