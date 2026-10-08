'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { runResearch, toPipelineAccount } = require('../src/research/engine');
const { createPageCache } = require('../src/research/page-cache');
const { toRows } = require('../src/research/persist-map');
const { NOW, RYDDIG, PROSA, searchPort, fetchPort, llmPort } = require('./research-fixtures');

const names = run => run.result.contactCandidates.map(c => c.name);

test('without any port the job fails honestly: nothing found, nothing invented', async () => {
  const run = await runResearch({ account: RYDDIG.account, ports: {}, now: NOW });
  assert.equal(run.status, 'failed');
  assert.equal(run.errorCode, 'not_connected');
  assert.deepEqual(run.sourceStatuses, { web: 'not_connected', apollo: 'not_connected', llm: 'not_connected' });
  assert.deepEqual(run.result.contactCandidates, []);
  assert.deepEqual(run.result.eventSignals, []);
  assert.deepEqual(run.result.recommendation, { whyNow: null, recommendedUseCase: null, recommendedRoom: null, roomBasis: null });
});

test('search only: works on snippets like the Artifact version and asks a human to choose', async () => {
  const run = await runResearch({ account: RYDDIG.account, ports: { search: searchPort(RYDDIG, { snippet: 20 }) }, now: NOW });
  assert.equal(run.status, 'needs_review');
  assert.equal(run.sourceStatuses.web, 'ok');
  assert.deepEqual(run.result.eventSignals.map(e => [e.event, e.date, e.attendees]), [['Fagdag 2026', '2026-11-14', 120]]);
  assert.deepEqual(names(run), ['Ola Prøvesen'], 'ansattlisten er avkortet i søkeutdraget, så bare eventkontakten er funnet');
  assert.equal(run.usage.fetches, 0);
});

test('with a fetch port whole pages are read: more contacts, email only when it stands on the page', async () => {
  const fetched = [];
  const run = await runResearch({ account: RYDDIG.account, ports: { search: searchPort(RYDDIG), fetch: fetchPort(RYDDIG, { calls: fetched }) }, now: NOW });
  assert.deepEqual(names(run), ['Ola Prøvesen', 'Kari Testesen']);
  assert.equal(run.recommended, 'Ola Prøvesen');
  assert.equal(run.result.contactCandidates[0].recommended, true);
  assert.equal(run.result.contactCandidates[1].email, 'kari.testesen@ryddig-test.no');
  assert.ok(!names(run).includes('Per Tallsen'), 'økonomisjefen er ikke en arrangementskontakt');
  assert.ok(run.result.contactData.some(d => d.general && d.email === 'post@ryddig-test.no'), 'generell adresse fra kontaktsiden som ansattsiden lenker til');
  assert.equal(run.result.recommendation.recommendedRoom, 'Collett');
  assert.match(run.result.recommendation.whyNow, /Fagdag 2026.*2026-11-14/);
  assert.equal(new Set(fetched).size, fetched.length, 'ingen side hentes to ganger i samme jobb');
  assert.ok(run.result.contactCandidates.every(c => c.evidence.length && c.evidence.every(e => e.verified === 'page')));
  assert.equal(run.status, 'needs_review', 'motoren godkjenner aldri hovedkontakt selv');
});

test('search stops early once a recommended contact and a reserve are found', async () => {
  const searches = [];
  const run = await runResearch({ account: RYDDIG.account, ports: { search: searchPort(RYDDIG, { calls: searches }), fetch: fetchPort(RYDDIG) }, now: NOW });
  assert.equal(run.usage.stop, 'recommended');
  assert.equal(run.usage.rounds, 0);
  assert.equal(searches.length, 4, 'to søk på eget nettsted og to etter arrangementer; ingen personsøk-runder');
  assert.ok(run.steps.some(s => s.id === 'people_web' && /Ikke nødvendig/.test(s.detail)));
});

test('a shared page cache makes the next job on the same site free of fetches', async () => {
  const cache = createPageCache({ now: () => NOW().getTime() });
  const ports = { search: searchPort(RYDDIG), fetch: fetchPort(RYDDIG) };
  const first = await runResearch({ account: RYDDIG.account, ports, cache, now: NOW });
  const second = await runResearch({ account: RYDDIG.account, ports, cache, now: NOW });
  assert.ok(first.usage.fetches > 0);
  assert.equal(second.usage.fetches, 0);
  assert.ok(second.usage.cacheHits > 0);
  assert.deepEqual(names(second), names(first));
});

test('Apollo plan restriction is a named source status, not an empty success', async () => {
  const apollo = {
    findOrganization: async () => ({ matched: true, id: 'a'.repeat(24), name: 'Ryddig' }),
    searchPeople: async () => { const e = new Error('Apollo-planen gir ikke tilgang til personsøk.'); e.code = 'plan_restricted'; throw e; }
  };
  // nettsiden har ingen navn, så personsøket i Apollo blir forsøkt
  const fx = { account: { id: 'o-tom', name: 'Tom Side Test', domain: 'tom-test.no', segment_id: 'fag' }, pages: { 'https://tom-test.no/om-oss': { title: 'Om oss', text: 'Vi er en forening for fagfolk i hele landet.' } } };
  const run = await runResearch({ account: fx.account, ports: { search: searchPort(fx), apollo }, now: NOW });
  assert.equal(run.sourceStatuses.apollo, 'ok', 'organisasjonsoppslaget virket');
  assert.ok(run.errors.some(e => e.provider === 'apollo' && e.code === 'plan_restricted'));
  assert.ok(run.steps.some(s => s.id === 'people_apollo' && s.status === 'unavailable'));
  assert.equal(run.status, 'partial');
  assert.deepEqual(run.result.contactCandidates, []);
});

test('LLM extraction runs only when parsers found too few people, and the verifier drops what is not on the page', async () => {
  const asked = [];
  const llm = llmPort({
    'https://prosa-test.no/om-oss/team': { people: [
      { name: 'Mona Fiktivsen', title: 'Kommunikasjonsdirektør', email: 'mona@prosa-test.no', relation: 'staff', quote: 'Mona Fiktivsen, som er kommunikasjonsdirektør hos oss' },
      { name: 'Tor Oppdiktet', title: 'Arrangementsansvarlig', email: 'tor.oppdiktet@prosa-test.no', relation: 'staff', quote: 'Tor Oppdiktet er arrangementsansvarlig' },
      { name: 'Hilde Hallusinert', title: 'Eventsjef', email: 'hilde@prosa-test.no', relation: 'staff', quote: 'Hilde Hallusinert, eventsjef' }
    ] },
    'https://prosa-test.no/aktuelt/hostmote': { events: [
      { title: 'Høstmøte for medlemmer', date: '2026-11-20', venue: 'Litteraturhuset', attendees: null, type: 'møte', quote: 'Dato: 20. november 2026' },
      { title: 'Vårmøte', date: '2027-03-01', venue: null, attendees: null, type: 'møte', quote: 'Dato: 1. mars 2027' }
    ] }
  }, { calls: asked });
  const run = await runResearch({ account: PROSA.account, ports: { search: searchPort(PROSA), fetch: fetchPort(PROSA), llm }, now: NOW });

  assert.deepEqual(names(run).sort(), ['Mona Fiktivsen', 'Tor Oppdiktet']);
  assert.equal(run.sourceStatuses.llm, 'ok');
  const tor = run.result.contactCandidates.find(c => c.name === 'Tor Oppdiktet');
  assert.equal(tor.email, null, 'e-posten sto ikke på siden og er fjernet');
  const mona = run.result.contactCandidates.find(c => c.name === 'Mona Fiktivsen');
  assert.equal(mona.evidence[0].method, 'llm');
  assert.equal(mona.email, 'mona@prosa-test.no');
  assert.deepEqual(run.result.eventSignals.map(e => [e.date, e.method]), [['2026-11-20', 'llm']]);
  assert.deepEqual(run.rejected.map(r => [r.kind, r.name, r.reasons[0]]).sort(), [['contact', 'Hilde Hallusinert', 'name_missing'], ['event', 'Vårmøte', 'quote_missing']]);
  assert.ok(run.steps.some(s => s.id === 'verify' && /2 forslag forkastet/.test(s.detail)));
  assert.ok(run.usage.llmTokens > 0);
  assert.deepEqual([...new Set(asked)].sort(), ['https://prosa-test.no/aktuelt/hostmote', 'https://prosa-test.no/om-oss/team']);
});

test('LLM is not called when the parsers already found enough people', async () => {
  const asked = [];
  const fx = { account: RYDDIG.account, pages: { ...RYDDIG.pages, 'https://ryddig-test.no/om-oss/ansatte': { title: 'Ansatte', text: 'Kari Testesen, Kommunikasjonssjef\nOla Prøvesen, Arrangementsansvarlig\nLise Lånesen, Markedssjef\nNina Navnesen, Programansvarlig' } } };
  const run = await runResearch({ account: fx.account, ports: { search: searchPort(fx), fetch: fetchPort(fx), llm: llmPort({}, { calls: asked }) }, now: NOW });
  assert.equal(asked.length, 0);
  assert.equal(run.sourceStatuses.llm, 'skipped');
  assert.equal(run.usage.llmCalls, 0);
  assert.ok(names(run).length >= 3);
});

test('a broken LLM port never costs the research already done', async () => {
  const llm = { complete: async () => { const e = new Error('Mangler nøkkel'); e.code = 'not_configured'; throw e; } };
  const run = await runResearch({ account: PROSA.account, ports: { search: searchPort(PROSA), fetch: fetchPort(PROSA), llm }, now: NOW });
  assert.equal(run.sourceStatuses.llm, 'blocked');
  assert.deepEqual(names(run), ['Tor Oppdiktet'], 'det parserne fant er beholdt');
  assert.equal(run.status, 'needs_review');
  assert.equal(run.errorCode, null);
  assert.ok(run.errors.some(e => e.provider === 'llm' && e.code === 'not_configured'));
});

test('research that finds events but no person is partial; completed only when a contact is already approved', async () => {
  const fx = { account: { id: 'o-bare', name: 'Bare Arrangement Test', domain: 'bare-test.no', segment_id: 'fag' }, pages: { 'https://bare-test.no/arrangement/seminar': { title: 'Høstseminar 2026', text: 'Høstseminar 2026\n3. desember 2026 10:00 - 14:00\nSentralen, Øvre Slottsgate 3' } } };
  const ports = { search: searchPort(fx), fetch: fetchPort(fx) };
  const run = await runResearch({ account: fx.account, ports, now: NOW });
  assert.equal(run.status, 'partial');
  assert.equal(run.errorCode, null);
  assert.deepEqual(run.result.contactCandidates, []);
  assert.deepEqual(run.result.eventSignals.map(e => e.date), ['2026-12-03']);
  assert.equal(run.result.recommendation.recommendedRoom, null, 'ingen deltakertall i kilden, så rom er ikke dokumentert');
  const done = await runResearch({ account: fx.account, ports, options: { hasApprovedContact: true }, now: NOW });
  assert.equal(done.status, 'completed');
});

test('budget stops the job with a reason and keeps partial results', async () => {
  const searches = [];
  const run = await runResearch({ account: RYDDIG.account, ports: { search: searchPort(RYDDIG, { calls: searches }), fetch: fetchPort(RYDDIG) }, limits: { searches: 2 }, now: NOW });
  assert.equal(searches.length, 2);
  assert.equal(run.usage.exhausted, 'searches');
  assert.ok(run.errors.some(e => e.code === 'budget_exhausted'));
  assert.ok(names(run).includes('Ola Prøvesen'), 'det som ble funnet før stoppen er beholdt');
});

test('status reporting failures never fail the job, and checkpoints carry early findings', async () => {
  const checkpoints = [];
  const run = await runResearch({
    account: RYDDIG.account, ports: { search: searchPort(RYDDIG) }, now: NOW,
    onProgress: async () => { throw new Error('databasen svarte ikke'); },
    onCheckpoint: async c => { checkpoints.push(c.events.length); }
  });
  assert.equal(run.status, 'needs_review');
  assert.deepEqual(checkpoints, [1]);
});

test('toPipelineAccount accepts the SalongBackend account contract', () => {
  const a = toPipelineAccount({ id: 'o-1', name: ' Eksempel AS ', domain: 'WWW.Eksempel-test.no', website: 'https://eksempel-test.no', segment_id: 'forlag', relation: 'kunde' });
  assert.deepEqual([a.name, a.domain, a.segId, a.rel], ['Eksempel AS', 'eksempel-test.no', 'forlag', 'kunde']);
  assert.deepEqual([a.roles, a.evsig, a.doc.aliases], [[], [], []]);
});

test('toRows maps a run to the inputs of the repositories on main, with deterministic ids and provenance', async () => {
  const run = await runResearch({ account: RYDDIG.account, ports: { search: searchPort(RYDDIG), fetch: fetchPort(RYDDIG) }, now: NOW });
  const rows = toRows(run, { jobId: 'job-1', organizationId: 'o-ryddig' });
  const again = toRows(run, { jobId: 'job-1', organizationId: 'o-ryddig' });
  assert.deepEqual(rows.facts.map(f => f.id), again.facts.map(f => f.id));
  assert.notDeepEqual(rows.facts.map(f => f.id), toRows(run, { jobId: 'job-2', organizationId: 'o-ryddig' }).facts.map(f => f.id));

  assert.deepEqual(rows.job, { status: 'needs_review', sourceStatuses: run.sourceStatuses, errorCode: null, errorMessage: null });
  assert.deepEqual(Object.keys(rows.result), ['organization', 'eventSignals', 'contactCandidates', 'contactData', 'recommendation']);
  const ids = new Set(rows.sources.map(s => s.id));
  const sourced = rows.facts.filter(f => f.fieldKey !== 'recommended_room');
  assert.ok(sourced.length >= 4);
  for (const f of sourced) {
    assert.ok(ids.has(f.sourceId), `${f.fieldKey} peker på en kilde`);
    assert.match(f.checkedAt, /^2026-10-07T/);
    assert.equal(f.reviewState, 'unreviewed');
    assert.equal(f.organizationId, 'o-ryddig');
  }
  for (const s of rows.sources) {
    assert.equal(s.enrichmentJobId, 'job-1');
    assert.equal(s.provider, 'web');
    assert.match(s.sourceUrl, /^https:\/\/ryddig-test\.no\//);
    assert.match(s.metadata.contentHash, /^[a-f0-9]{32}$/);
  }
  assert.throws(() => toRows(run, { jobId: '', organizationId: 'o' }), /krever jobId/);
});

test('toRows output is accepted by the real repositories (fake pg client, same SQL contract)', async () => {
  const { createRepositories } = require('../src/db/repositories');
  const run = await runResearch({ account: RYDDIG.account, ports: { search: searchPort(RYDDIG), fetch: fetchPort(RYDDIG) }, now: NOW });
  const rows = toRows(run, { jobId: 'job-1', organizationId: 'o-ryddig' });
  const seen = [];
  const db = { query: async (sql, params) => { seen.push([String(sql).match(/INSERT INTO (\w+)/)[1], params]); return { rows: [{}] }; } };
  const repos = createRepositories(db);
  await repos.enrichmentResults.upsert('job-1', rows.result);
  for (const s of rows.sources) await repos.sources.save(s);
  for (const f of rows.facts) await repos.researchedFacts.save(f);
  assert.deepEqual([...new Set(seen.map(x => x[0]))], ['enrichment_results', 'sources', 'researched_facts']);
  assert.equal(seen.filter(x => x[0] === 'sources').length, rows.sources.length);
  const firstFact = seen.find(x => x[0] === 'researched_facts')[1];
  assert.equal(firstFact[1], 'o-ryddig');
  assert.ok(rows.sources.some(s => s.id === firstFact[4]), 'faktaet peker på en kilde som er lagret først');
  assert.deepEqual(JSON.parse(seen[0][1][3]).map(c => c.name), run.result.contactCandidates.map(c => c.name));
});
