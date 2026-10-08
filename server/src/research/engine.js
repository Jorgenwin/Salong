'use strict';

// runResearch: én research-jobb for én organisasjon. Dette er det enrichment-workeren kaller.
//
// Selve METODEN bor i src/research/ som vanlige moduler og deles med Artifact-utgaven (pipeline.js, method.js, rules.js, events.js):
// søketreff → hele sider → tidlig stopp → LLM-uttrekk ved behov → verifikator → rangering.
// Serveren kjører nøyaktig samme funksjon som Artifact-utgaven. Det serveren legger til, er det en nettleser
// ikke kan gi: porter med nøkler bak, felles sidecache, budsjett per jobb og rader til databasen.
//
// Motoren skriver ikke til databasen og kjenner ingen nøkler. Den returnerer et rent resultat som workeren lagrer
// (se persist-map.js), og den godkjenner aldri en kontakt: status blir «needs_review» når noen må velge.

const shared = require('./shared');
const { createPageCache } = require('./page-cache');
const { createBudget } = require('./budget');
const { connect } = require('./ports');

/** Fra SalongBackend-kontoen (server/src/db/repositories.js mapAccount) til formen den delte pipelinen leser. */
function toPipelineAccount(account) {
  const a = account || {};
  return {
    id: a.id,
    name: String(a.name || '').trim(),
    domain: String(a.domain || '').trim().toLowerCase().replace(/^www\./, ''),
    website: a.website || '',
    segId: a.segId || a.segment_id || '',
    size: a.size || '',                      // 'S' | 'M' | 'L' når det er kjent
    roles: Array.isArray(a.roles) ? a.roles : [],
    rel: a.rel || a.relation || '',
    bookings: Array.isArray(a.bookings) ? a.bookings : [],
    evsig: Array.isArray(a.eventSignals) ? a.eventSignals : [],   // tidligere dokumenterte signaler styrer rollerekkefølgen
    doc: { aliases: Array.isArray(a.aliases) ? a.aliases : [] }
  };
}

const view = c => ({ ...c, cd: { ev: c.ev, loc: c.loc, cur: c.cur, masked: c.masked } });

function rank(shared, a, U, cands) {
  const list = cands.map(c => ({ c, s: shared.cdScore(a, view(c), U) }));
  const hasChannel = c => !!(c.email || c.phone || c.linkedin);
  list.sort((x, y) => y.s.score - x.s.score || (+hasChannel(y.c)) - (+hasChannel(x.c)) || x.c.name.localeCompare(y.c.name, 'nb'));
  // samme regel som cdRank i src/enrsvc.js og rsStanding: bare den øverste, over terskelen og uten minuspunkter, anbefales
  const top = list[0];
  return { list, recommended: top && top.s.score >= shared.CD_TUNE.rec && !top.s.neg.length ? top.c : null };
}

function sourceStatus(pv, anyOk, hasPort, foundSomething) {
  if (!hasPort) return 'not_connected';
  if (anyOk) return foundSomething ? 'ok' : 'empty';
  return pv === 'blocked' ? 'blocked' : pv === 'plan' ? 'plan_restricted' : pv === 'error' ? 'error' : 'empty';
}

function whyNow(events, today) {
  const best = events.filter(e => e.date >= today).sort((x, y) => x.date.localeCompare(y.date))[0]
    || events.slice().sort((x, y) => y.date.localeCompare(x.date))[0];
  return best ? `«${best.title}» ${best.date}${best.venue ? ' · ' + best.venue : ''}` : null;
}

/**
 * @param {object} input
 * @param {object} input.account            konto fra SalongBackend (id, name, domain, website, segment_id …)
 * @param {object} input.ports              {search, fetch, apollo, llm} – se ports.js. Manglende port = «not_connected».
 * @param {object} [input.cache]            delt sidecache (createPageCache). Del den mellom jobber for å spare henting.
 * @param {object} [input.limits]           overstyr budsjett-tak (budget.js)
 * @param {object} [input.options]          {hasApprovedContact}
 * @param {Function} [input.onProgress]     ({state, stage, steps}) underveis – for jobbstatus
 * @param {Function} [input.onCheckpoint]   ({events, general}) – lagre det som er funnet før personsøket
 * @param {Function} [input.now]            () => Date
 */
async function runResearch({ account, ports = {}, cache, limits, options = {}, onProgress, onCheckpoint, now = () => new Date() }) {
  if (!account || !account.name) throw new Error('runResearch krever en konto med navn');
  const pages = cache || createPageCache({ now: () => now().getTime() });
  const budget = createBudget(limits, { now: () => now().getTime() });
  const { io } = connect({ ports, cache: pages, budget });
  const a = toPipelineAccount(account);
  const today = now().toISOString().slice(0, 10);
  const progress = onProgress ? async p => { try { await onProgress(p); } catch (e) { /* statusrapportering skal aldri felle jobben */ } } : async () => {};

  // hele metoden: R.cands og R.events er allerede kontrollert mot kildene og rangert
  const R = await shared.enrPipeline(a, { ...io, report: progress, checkpoint: onCheckpoint });

  const events = R.events.slice().sort((x, y) => String(y.date).localeCompare(String(x.date)));
  const ranked = rank(shared, a, R.U, R.cands);
  const room = shared.enrRoom(events);

  const sourceOf = c => { const e = (c.ev || []).find(x => x.url) || (c.ev || [])[0] || {}; return e.url || (e.k === 'apollo' ? 'apollo' : null); };
  const contactCandidates = ranked.list.map(({ c, s }) => ({
    name: c.name, title: c.title || null, relevanceScore: s.score, source: sourceOf(c),
    recommended: c === ranked.recommended, why: s.why, concerns: s.bad,
    email: c.email || null, phone: c.phone || null, linkedin: c.linkedin || null,
    evidence: (c.ev || []).map(e => ({ kind: e.k, url: e.url || null, quote: e.q || null, method: e.method || (e.k === 'apollo' ? 'provider' : 'parser'), verified: e.verified }))
  }));
  const contactData = [];
  for (const c of contactCandidates) if (c.email || c.phone || c.linkedin) contactData.push({ name: c.name, email: c.email, phone: c.phone, linkedin: c.linkedin, source: c.source, verifiedAt: null });
  for (const e of R.general.emails) contactData.push({ name: null, general: true, email: e.v, phone: null, linkedin: null, source: e.url || null, verifiedAt: null });
  for (const p of R.general.phones) contactData.push({ name: null, general: true, email: null, phone: p, linkedin: null, source: R.general.url || null, verifiedAt: null });

  const result = {
    organization: { name: a.name, domain: a.domain || null, description: null },
    eventSignals: events.map(e => ({ event: e.title, date: e.date, venue: e.venue || null, type: e.type || null, source: e.source || null, attendees: e.capacity || null, level: e.level || null, method: e.method || 'parser' })),
    contactCandidates,
    contactData,
    recommendation: {
      whyNow: whyNow(events, today),
      recommendedUseCase: null,                     // avledes i frontenden av segmentet; ikke gjettet her
      recommendedRoom: room ? room.fit : null,
      roomBasis: room ? room.reason : null
    }
  };

  const webFound = events.length || R.pages.length || contactCandidates.length;
  const sourceStatuses = {
    web: sourceStatus(R.pv.web, R.okBy.web > 0, io.has.web, webFound),
    apollo: sourceStatus(R.pv.apollo, R.okBy.apollo > 0, io.has.apollo, R.orgId || contactCandidates.some(c => c.source === 'apollo')),
    llm: R.llm.status || (io.has.llm ? 'skipped' : 'not_connected')
  };
  const researchOk = R.okBy.web > 0 || R.okBy.apollo > 0;
  let status, errorCode = null, errorMessage = null;
  if (!researchOk) {
    status = 'failed';
    errorCode = (R.blockedCode === 'server_not_connected' ? 'not_connected' : R.blockedCode) || (budget.exhausted ? 'budget_exhausted' : 'provider_unavailable');
    errorMessage = (R.errors[0] && R.errors[0].message) || 'Ingen kilde svarte.';
  } else if (contactCandidates.length) status = 'needs_review';       // et menneske velger hovedkontakt
  else if (options.hasApprovedContact) status = 'completed';
  else status = 'partial';                                            // research gikk, men ingen person ble funnet

  return {
    status, errorCode, errorMessage, sourceStatuses, result,
    steps: R.steps, rejected: R.rejected,
    recommended: ranked.recommended ? ranked.recommended.name : null,
    usage: { ...budget.snapshot(), pipelineCalls: R.calls, rounds: R.rounds.length, stop: R.stop, pagesRead: R.read.pages },
    errors: R.errors.concat(R.llm.errors.map(e => ({ provider: 'llm', ...e }))),
    understanding: { summary: R.U.summary, why: R.U.why },
    cache: pages
  };
}

module.exports = { runResearch, toPipelineAccount };
