'use strict';

// Budsjett per research-jobb. Hvert trinn trekker fra samme pott, og jobben stopper med en navngitt årsak
// i stedet for å løpe løpsk. Tallene er tak, ikke mål: de fleste jobber bruker langt mindre.

const DEFAULT_LIMITS = Object.freeze({
  searches: 20,      // søkekall (den delte pipelinen bruker normalt 6–12)
  fetches: 12,       // hele sider hentet (dyplesing)
  llmCalls: 6,       // LLM-uttrekk, bare når parserne ikke finner noe
  llmTokens: 60000,  // inn + ut, samlet
  apolloCalls: 8,    // organisasjonsoppslag og personsøk (ikke kreditt-kall)
  wallMs: 120000     // veggklokke for hele jobben
});

class BudgetError extends Error {
  constructor(resource) {
    super(`Budsjettet for ${resource} er brukt opp.`);
    this.name = 'BudgetError';
    this.code = 'budget_exhausted';
    this.fatal = true;   // den delte pipelinen skal ikke svelge dette som et vanlig tomt søk
    this.resource = resource;
  }
}

function createBudget(limits = {}, { now = () => Date.now() } = {}) {
  const max = { ...DEFAULT_LIMITS, ...limits };
  const used = { searches: 0, fetches: 0, llmCalls: 0, llmTokens: 0, apolloCalls: 0, cacheHits: 0 };
  const startedAt = now();
  let exhausted = null;

  const elapsed = () => now() - startedAt;
  const left = resource => Math.max(0, max[resource] - used[resource]);

  function can(resource, n = 1) {
    if (elapsed() > max.wallMs) return false;
    return used[resource] + n <= max[resource];
  }

  /** Trekker fra potten, eller kaster BudgetError og husker hva som tok slutt. */
  function spend(resource, n = 1) {
    if (elapsed() > max.wallMs) { exhausted = exhausted || 'wallMs'; throw new BudgetError('wallMs'); }
    if (used[resource] + n > max[resource]) { exhausted = exhausted || resource; throw new BudgetError(resource); }
    used[resource] += n;
  }

  /** Tokens telles etter at svaret er kommet, så de kan gå litt over taket én gang; neste kall stoppes. */
  function addTokens(n) {
    used.llmTokens += Math.max(0, Number(n) || 0);
    if (used.llmTokens >= max.llmTokens) exhausted = exhausted || 'llmTokens';
  }

  return {
    can, spend, left, addTokens,
    noteCacheHit() { used.cacheHits += 1; },
    get exhausted() { return exhausted; },
    snapshot() { return { ...used, elapsedMs: elapsed(), exhausted, limits: { ...max } }; }
  };
}

module.exports = { createBudget, BudgetError, DEFAULT_LIMITS };
