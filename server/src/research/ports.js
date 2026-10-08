'use strict';

// Porter: det eneste research-motoren vet om omverdenen. Selve adapterne (Exa, Firecrawl, Apollo, LLM) skrives
// separat og holder nøklene; motoren får bare funksjoner. Uten en port er kilden «not_connected» – aldri simulert.
//
//   search(query, {objective, numResults})            -> [{url, title, text, published?}]
//   fetch(urls)                                       -> [{url, text, title?, links?:[{url,text}]}]
//   apollo.findOrganization({name, domain})           -> {matched, id?, name?, domain?}
//   apollo.searchPeople({domain, orgId, titles, keywords}) -> {people:[{name,title,apolloId,linkedin,loc,masked}], count}
//   llm.complete({system, prompt, maxTokens, tier})   -> {text, usage?:{inputTokens, outputTokens}}
//
// En port melder feil ved å kaste en Error med `code`. Kodene under er de motoren skiller på.

const shared = require('./shared');

const BLOCKED = new Set(['not_connected', 'not_configured', 'unauthorized', 'forbidden', 'needs_reauth']);

/** Samme tredeling som frontendens enrClassify: blocked (ingen tilgang), plan (ikke på planen), error (forbigående). */
function classifyError(e) {
  const code = (e && e.code) || 'error';
  const message = String((e && e.message) || code).slice(0, 300);
  if (code === 'plan_restricted') return { kind: 'plan', code, message };
  if (BLOCKED.has(code)) return { kind: 'blocked', code, message };
  return { kind: 'error', code, message };
}

const provider = (id, ops) => ({
  id,
  async call(op, args) {
    try {
      if (typeof ops[op] !== 'function') { const err = new Error(`Ukjent operasjon ${id}.${op}`); err.code = 'not_connected'; throw err; }
      return { ok: true, data: await ops[op](args) };
    } catch (e) {
      return { ok: false, ...classifyError(e) };
    }
  }
});

/**
 * Kobler rå porter til formen den delte pipelinen (enrPipeline) forventer, med cache og budsjett imellom.
 * @returns {{io:{web:object, apollo:object, llm:object|null, has:object}}}
 */
function connect({ ports = {}, cache, budget }) {
  // søk: trekkes fra budsjettet, og hvert treff huskes i cachen (til kilderadene)
  const search = ports.search && (async (query, objective, n) => {
    budget.spend('searches');
    const results = (await ports.search(query, { objective, numResults: n })) || [];
    const out = [];
    for (const r of results) {
      if (!r || !r.url) continue;
      const item = { url: String(r.url), title: String(r.title || ''), text: String(r.text || ''), published: r.published || '' };
      cache.rememberSnippet(item.url, item);
      out.push(item);
    }
    return out;
  });

  // hele sider: pipelinen ber om adresser, cachen henter bare det som mangler
  const fetchPages = ports.fetch && (async urls => {
    const pages = await cache.fetchMany(urls, ports.fetch, { budget });
    return pages.map(p => ({ url: p.url, title: p.title || '', text: p.text }));
  });

  const webOps = shared.createWebOps({
    search: search || undefined,
    fetchPages: fetchPages || undefined,
    isFatal: e => !!e && e.fatal === true     // f.eks. brukt opp budsjett: skal ikke svelges som et tomt søk
  });

  const apolloOps = ports.apollo ? {
    async org({ a }) {
      const domain = a.domain || shared.enrHost(a.website || '');
      if (!domain) return { matched: false, note: 'Mangler domene.' };
      budget.spend('apolloCalls');
      const r = (await ports.apollo.findOrganization({ name: a.name, domain })) || {};
      return r.matched ? { matched: true, id: r.id, name: r.name || '' } : { matched: false };
    },
    async people(x) {
      budget.spend('apolloCalls');
      const r = (await ports.apollo.searchPeople({ domain: x.dom, orgId: x.orgId, titles: x.titles, keywords: x.keywords })) || {};
      const people = Array.isArray(r.people) ? r.people : [];
      return { people, count: r.count == null ? people.length : r.count };
    }
  } : {};

  // LLM-porten får budsjett: hvert kall trekkes fra potten, og tokens telles fra svaret (eller anslås fra tegn).
  const llm = ports.llm && {
    async complete(req) {
      budget.spend('llmCalls');
      const r = (await ports.llm.complete(req)) || {};
      const u = r.usage || {};
      const counted = Number(u.inputTokens || 0) + Number(u.outputTokens || 0);
      budget.addTokens(counted || Math.ceil((String(req.system || '').length + String(req.prompt || '').length + String(r.text || '').length) / 4));
      return r;
    }
  };

  return {
    io: {
      web: provider('web', webOps),
      apollo: provider('apollo', apolloOps),
      llm: llm || null,
      has: { web: !!ports.search, apollo: !!ports.apollo, fetch: !!ports.fetch, llm: !!ports.llm }
    }
  };
}

module.exports = { connect, classifyError };
