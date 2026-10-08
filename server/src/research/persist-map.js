'use strict';

// Rene avbildninger fra et research-resultat til det repositoriene i server/src/db/repositories.js tar imot:
//   enrichmentResults.upsert(jobId, result)   sources.save(source)   researchedFacts.save(fact)
// Ingen database her. ID-ene er deterministiske (jobb + innhold), så et nytt forsøk på samme jobb treffer de samme
// radene (repositoriene gjør ON CONFLICT … DO UPDATE) i stedet for å lage duplikater.

const { createHash } = require('node:crypto');

const id = (prefix, ...parts) => prefix + '_' + createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
const iso = ms => (ms ? new Date(ms).toISOString() : null);

/**
 * @param {object} run       returverdien fra runResearch
 * @param {{jobId:string, organizationId:string}} ref
 * @returns {{job:{status,sourceStatuses,errorCode,errorMessage}, result:object, sources:object[], facts:object[]}}
 */
function toRows(run, { jobId, organizationId }) {
  if (!jobId || !organizationId) throw new Error('toRows krever jobId og organizationId');
  const sources = new Map();

  const sourceFor = (url, provider) => {
    if (!url || url === 'apollo') {
      if (provider !== 'apollo') return null;
      const sid = id('src', jobId, 'apollo');
      if (!sources.has(sid)) sources.set(sid, { id: sid, organizationId, enrichmentJobId: jobId, provider: 'apollo', sourceUrl: null, providerRef: null, title: 'Apollo', checkedAt: null, metadata: {} });
      return sid;
    }
    const sid = id('src', jobId, run.cache.normalizeUrl(url) || url);
    if (!sources.has(sid)) {
      const d = run.cache.describe(url) || {};
      sources.set(sid, { id: sid, organizationId, enrichmentJobId: jobId, provider: 'web', sourceUrl: url, providerRef: null, title: d.title || null, checkedAt: iso(d.checkedAt), metadata: { kind: d.kind || null, contentHash: d.hash || null } });
    }
    return sid;
  };
  const checked = sid => (sid && sources.get(sid) ? sources.get(sid).checkedAt : null);
  const facts = [];
  const fact = (fieldKey, key, value, sid, confidence) => facts.push({
    id: id('fact', jobId, fieldKey, key), organizationId, fieldKey, value,
    sourceId: sid, confidence: confidence == null ? null : Math.round(confidence * 100) / 100, reviewState: 'unreviewed', checkedAt: checked(sid)
  });

  for (const e of run.result.eventSignals) {
    fact('event_signal', e.date + '|' + e.event, e, sourceFor(e.source, 'web'), e.level === 'Dokumentert' ? 0.9 : 0.6);
  }
  for (const c of run.result.contactCandidates) {
    const first = c.evidence.find(x => x.url) || c.evidence[0] || {};
    const sid = sourceFor(first.url, first.kind === 'apollo' ? 'apollo' : 'web');
    for (const x of c.evidence.slice(1)) sourceFor(x.url, x.kind === 'apollo' ? 'apollo' : 'web');
    fact('contact_candidate', c.name, { name: c.name, title: c.title, email: c.email, phone: c.phone, linkedin: c.linkedin, recommended: c.recommended, why: c.why, concerns: c.concerns, evidence: c.evidence }, sid, c.relevanceScore / 100);
  }
  for (const d of run.result.contactData.filter(x => x.general)) {
    if (d.email) fact('general_email', d.email, d.email, sourceFor(d.source, 'web'), 0.9);
    if (d.phone) fact('general_phone', d.phone, d.phone, sourceFor(d.source, 'web'), 0.9);
  }
  const rec = run.result.recommendation;
  if (rec.recommendedRoom) fact('recommended_room', 'room', { room: rec.recommendedRoom, basis: rec.roomBasis }, null, null);

  return {
    // det workerens execute() returnerer til jobbkøen (server/src/worker/runner.js)
    job: { status: run.status, sourceStatuses: run.sourceStatuses, errorCode: run.errorCode, errorMessage: run.errorMessage },
    // andre argument til enrichmentResults.upsert(jobId, result)
    result: {
      organization: run.result.organization,
      eventSignals: run.result.eventSignals,
      contactCandidates: run.result.contactCandidates,
      contactData: run.result.contactData,
      recommendation: run.result.recommendation
    },
    sources: [...sources.values()],   // lagres før fakta: researched_facts.source_id peker på dem
    facts
  };
}

module.exports = { toRows };
