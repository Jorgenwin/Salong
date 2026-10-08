'use strict';

// Eval-rigg: mål research-motoren mot en fasit FØR en regel eller prompt endres.
//
// En «kassett» er et opptak av det portene svarte for én organisasjon. Avspilling er helt uten nett og nøkler,
// så samme fasit kan kjøres i CI og gi samme tall hver gang. Opptak gjøres én gang med ekte porter (record()).
//
//   kassett = { searches: {"<spørring>": [treff…]}, pages: {"<url>": {text,title,links}}, apollo: {org, people}, llm: {"<sha>": "<svar>"} }
//   case    = { account, expect: {contacts:[navn…], recommended?:navn, events?:[YYYY-MM-DD…]}, cassette }

const { createHash } = require('node:crypto');
const { runResearch } = require('./engine');
const { normalizeUrl } = require('./page-cache');

const key = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const lower = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Porter som svarer fra en kassett. Det som ikke er tatt opp gir tomt svar (søk/henting) eller «not_connected». */
function replayPorts(cassette = {}) {
  const ports = {};
  if (cassette.searches) ports.search = async query => cassette.searches[query] || [];
  if (cassette.pages) {
    const byUrl = new Map(Object.entries(cassette.pages).map(([u, p]) => [normalizeUrl(u), { url: u, ...p }]));
    ports.fetch = async urls => urls.map(u => byUrl.get(normalizeUrl(u))).filter(Boolean);
  }
  if (cassette.apollo) {
    ports.apollo = {
      findOrganization: async () => cassette.apollo.org || { matched: false },
      searchPeople: async () => {
        if (cassette.apollo.peopleError) { const e = new Error(cassette.apollo.peopleError); e.code = cassette.apollo.peopleError; throw e; }
        return { people: cassette.apollo.people || [] };
      }
    };
  }
  if (cassette.llm) {
    ports.llm = { complete: async ({ prompt }) => {
      const hit = cassette.llm[key(prompt)];
      if (hit == null) { const e = new Error('LLM-svaret er ikke tatt opp for denne siden.'); e.code = 'not_recorded'; throw e; }
      return { text: hit, usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(String(hit).length / 4) } };
    } };
  }
  return ports;
}

/** Pakker ekte porter slik at alt de svarer havner i en kassett. Brukes én gang per organisasjon når fasiten lages. */
function record(ports) {
  const cassette = { searches: {}, pages: {} };
  const out = {};
  if (ports.search) out.search = async (query, o) => { const r = await ports.search(query, o); cassette.searches[query] = r; return r; };
  if (ports.fetch) out.fetch = async urls => { const r = await ports.fetch(urls); for (const p of r || []) cassette.pages[p.url] = { text: p.text, title: p.title || '', links: p.links || [] }; return r; };
  if (ports.apollo) {
    cassette.apollo = {};
    out.apollo = {
      findOrganization: async q => (cassette.apollo.org = await ports.apollo.findOrganization(q)),
      searchPeople: async q => { try { const r = await ports.apollo.searchPeople(q); cassette.apollo.people = (cassette.apollo.people || []).concat(r.people || []); return r; } catch (e) { cassette.apollo.peopleError = e.code || 'error'; throw e; } }
    };
  }
  if (ports.llm) {
    cassette.llm = {};
    out.llm = { complete: async req => { const r = await ports.llm.complete(req); cassette.llm[key(req.prompt)] = r.text; return r; } };
  }
  return { ports: out, cassette };
}

function scoreCase(c, run) {
  const names = run.result.contactCandidates.map(x => lower(x.name));
  const want = (c.expect.contacts || []).map(lower);
  const found = want.filter(n => names.includes(n));
  const top3 = names.slice(0, 3);
  const wantEvents = c.expect.events || [];
  const gotEvents = run.result.eventSignals.map(e => e.date);
  return {
    id: c.account.id || c.account.name,
    status: run.status,
    contactRecall: want.length ? found.length / want.length : null,
    hitTop3: want.length ? want.some(n => top3.includes(n)) : null,
    recommendedCorrect: c.expect.recommended === undefined ? null : lower(run.recommended) === lower(c.expect.recommended),
    unexpectedContacts: c.expect.onlyListed ? names.filter(n => !want.includes(n)) : [],
    eventRecall: wantEvents.length ? wantEvents.filter(d => gotEvents.includes(d)).length / wantEvents.length : null,
    rejected: run.rejected.length,
    cost: { searches: run.usage.searches, fetches: run.usage.fetches, cacheHits: run.usage.cacheHits, llmCalls: run.usage.llmCalls, llmTokens: run.usage.llmTokens },
    stop: run.usage.stop
  };
}

const mean = xs => { const v = xs.filter(x => x != null); return v.length ? Math.round(v.reduce((s, x) => s + Number(x), 0) / v.length * 1000) / 1000 : null; };

/**
 * Kjører alle cases og gir tall som kan sammenlignes mellom to utgaver av reglene.
 * @param {Array} cases
 * @param {{now?:Function, limits?:object, options?:object}} [cfg]
 */
async function runEval(cases, cfg = {}) {
  const rows = [];
  for (const c of cases) {
    const run = await runResearch({ account: c.account, ports: replayPorts(c.cassette), limits: cfg.limits, options: { ...cfg.options, ...c.options }, now: cfg.now });
    rows.push(scoreCase(c, run));
  }
  return {
    cases: rows,
    summary: {
      n: rows.length,
      contactRecall: mean(rows.map(r => r.contactRecall)),
      hitTop3: mean(rows.map(r => r.hitTop3)),
      recommendedCorrect: mean(rows.map(r => r.recommendedCorrect)),
      eventRecall: mean(rows.map(r => r.eventRecall)),
      unexpectedContacts: rows.reduce((s, r) => s + r.unexpectedContacts.length, 0),
      rejected: rows.reduce((s, r) => s + r.rejected, 0),
      avgSearches: mean(rows.map(r => r.cost.searches)),
      avgFetches: mean(rows.map(r => r.cost.fetches)),
      avgLlmCalls: mean(rows.map(r => r.cost.llmCalls)),
      avgLlmTokens: mean(rows.map(r => r.cost.llmTokens))
    }
  };
}

module.exports = { runEval, replayPorts, record, scoreCase, promptKey: key };
