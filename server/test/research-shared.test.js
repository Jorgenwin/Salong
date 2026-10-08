'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const shared = require('../src/research/shared');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULES = ['rules', 'events', 'method', 'pipeline'].map(n => path.join(ROOT, 'src', 'research', n + '.js'));

test('the server imports the shared research code as ordinary modules', () => {
  for (const name of ['enrPipeline', 'createWebOps', 'cdScore', 'cdParseRoster', 'rsVerifyCandidate', 'rsVerifyEvent', 'rsStanding', 'enrParseFetch', 'enrEvents', 'enrRoom']) {
    assert.equal(typeof shared[name], 'function', `mangler ${name}`);
  }
  assert.equal(shared.CD_TUNE.rec, 50, 'terskelen for anbefalt kontakt er endret: oppdater engine.rank og eval-fasiten sammen med den');
  assert.equal(shared.enrPipeline, require('../../src/research/pipeline').enrPipeline, 'samme funksjonsobjekt, ikke en kopi');
});

test('no eval, no vm and no reading of source files as text anywhere on the research path', () => {
  const files = MODULES.concat(fs.readdirSync(path.join(__dirname, '..', 'src', 'research')).filter(f => f.endsWith('.js') && f !== 'eval-cli.js').map(f => path.join(__dirname, '..', 'src', 'research', f)));
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /new Function|\beval\s*\(|require\(['"](?:node:)?vm['"]\)|readFileSync|readFile\(/, path.relative(ROOT, file));
  }
});

test('shared modules need no browser or Artifact globals: they load and run in a bare Node process', () => {
  const script = `
    for (const g of ['window','document','localStorage','claude','navigator']) if (typeof globalThis[g] !== 'undefined' && g !== 'navigator') throw new Error('uventet global: ' + g);
    const s = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'research', 'shared.js'))});
    const ops = s.createWebOps({ search: async () => [{ url: 'https://x-test.no/om-oss/ansatte', title: 'Ansatte', text: 'Kari Testesen, Kommunikasjonssjef' }] });
    s.enrPipeline({ name: 'X Test', domain: 'x-test.no', segId: 'fag' }, {
      web: { call: async (op, a) => { try { return { ok: true, data: await ops[op](a) }; } catch (e) { return { ok: false, kind: 'blocked', code: e.code }; } } },
      apollo: { call: async () => ({ ok: false, kind: 'blocked', code: 'not_connected' }) },
      has: { web: true, apollo: false, fetch: false, llm: false }
    }).then(R => { process.stdout.write(JSON.stringify(R.cands.map(c => c.name))); });`;
  const out = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), ['Kari Testesen']);
  for (const file of MODULES) {
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\bwindow\b|\bdocument\b|\blocalStorage\b|\bclaude\.use\b|\bmcp\.|\bsample\(/, path.relative(ROOT, file));
  }
});

test('shared parsers behave like the frontend ones (same module, no copy)', () => {
  assert.deepEqual(shared.cdParseRoster('Kari Testesen, Kommunikasjonssjef').map(p => [p.name, p.title]), [['Kari Testesen', 'Kommunikasjonssjef']]);
  assert.equal(shared.cdPageKind('https://x-test.no/om-oss/ansatte'), 'team');
  assert.equal(shared.cdPageKind('https://x-test.no/arrangement/fagdag'), 'event');
  assert.deepEqual(shared.enrDates('14. november 2026').map(d => d.date), ['2026-11-14']);
  assert.equal(shared.enrOwn('https://www.x-test.no/a', 'x-test.no'), true);
  assert.equal(shared.enrOwn('https://ond-x-test.no/a', 'x-test.no'), false);
});

test('fetched pages are split per URL in the format the fetch tool really answers in', () => {
  const answer = '# Ansatte | X\nURL: https://x-test.no/ansatte\n\n# Kari Testesen\n\nKommunikasjonssjef tlf. 22 00 00 11\n\nkari@x-test.no\n\n# Kontakt | X\nURL: https://x-test.no/kontakt\n\npost@x-test.no\n\nError fetching https://x-test.no/borte: CRAWL_NOT_FOUND\n';
  const pages = shared.enrParseFetch(answer);
  assert.deepEqual(pages.map(p => [p.url, p.title]), [['https://x-test.no/ansatte', 'Ansatte | X'], ['https://x-test.no/kontakt', 'Kontakt | X']]);
  assert.deepEqual(shared.cdParseRoster(pages[0].text).map(p => [p.name, p.title, p.email, p.phone]), [['Kari Testesen', 'Kommunikasjonssjef', 'kari@x-test.no', '+47 22 00 00 11']]);
  assert.ok(!/post@x-test\.no/.test(pages[0].text), 'neste side lekker ikke inn i den forrige');
});

test('a title written as a sentence is cut down to the title', () => {
  assert.deepEqual(shared.cdParseRoster('Tor Oppdiktet er arrangementsansvarlig og planlegger alle seminarene våre.').map(p => p.title), ['Arrangementsansvarlig']);
  assert.deepEqual(shared.cdParseRoster('Kari Testesen, Leder for kommunikasjon og marked').map(p => p.title), ['Leder for kommunikasjon og marked']);
});

test('web operations answer not_connected without ports instead of inventing results', async () => {
  const ops = shared.createWebOps();
  await assert.rejects(() => ops.probe({ dom: 'x-test.no' }), e => e.code === 'not_connected');
  await assert.rejects(() => ops.read({ dom: 'x-test.no', urls: ['https://x-test.no/a'] }), e => e.code === 'not_connected');
  await assert.rejects(() => ops.sitePages({ dom: 'x-test.no', terms: ['kommunikasjon'] }), e => e.code === 'not_connected');
  await assert.rejects(() => ops.events({ a: { name: 'X', domain: 'x-test.no' } }), e => e.code === 'not_connected' || e.code === 'upstream_error');
});
