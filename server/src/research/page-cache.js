'use strict';

// Felles sidecache for research. Hver URL hentes én gang og gjenbrukes av alle trinn og alle jobber innenfor TTL.
// Cachen er også sannhetskilden for verifikatoren: en påstand godtas bare hvis teksten faktisk finnes her.
//
// To slags innhold per URL:
//   page     hele siden, hentet med hente-porten
//   snippet  utdrag fra søkeresultater (det den delte pipelinen jobber på)
//
// Lageret er et lite grensesnitt ({get, set}) med Map som standard. En Postgres-utgave kan legges bak samme
// grensesnitt senere (krever egen tabell for sidetekst; `sources` lagrer i dag bare metadata).

const { createHash } = require('node:crypto');

const DAY = 24 * 60 * 60 * 1000;
const DEFAULTS = Object.freeze({ pageTtlMs: 7 * DAY, failTtlMs: 60 * 60 * 1000, maxChars: 200000 });
const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|source$)/i;

function normalizeUrl(input) {
  try {
    const u = new URL(String(input || '').trim());
    if (!/^https?:$/.test(u.protocol)) return '';
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    let out = u.toString();
    if (u.pathname !== '/' && out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch (e) {
    return '';
  }
}

const hashText = text => createHash('sha256').update(String(text || '')).digest('hex').slice(0, 32);

function createPageCache({ store = new Map(), now = () => Date.now(), ...options } = {}) {
  const opt = { ...DEFAULTS, ...options };

  const read = key => store.get(key) || null;
  const write = (key, entry) => { store.set(key, entry); return entry; };
  const blank = url => ({ url, title: '', page: null, snippets: [], links: [], failedAt: null, failCode: null });

  /** Husker et utdrag (søketreff) for en URL. Samme utdrag lagres ikke to ganger. */
  function rememberSnippet(url, { text, title } = {}) {
    const key = normalizeUrl(url);
    const body = String(text || '').trim();
    if (!key || !body) return null;
    const entry = read(key) || blank(url);
    if (title && !entry.title) entry.title = String(title).slice(0, 300);
    if (!entry.snippets.some(s => s.hash === hashText(body))) {
      entry.snippets.push({ text: body.slice(0, opt.maxChars), hash: hashText(body), at: now() });
    }
    return write(key, entry);
  }

  /** Lagrer en hel side. Returnerer oppføringen med hash, slik at kilderaden kan peke på nøyaktig innhold. */
  function rememberPage(url, { text, title, links } = {}) {
    const key = normalizeUrl(url);
    if (!key) return null;
    const entry = read(key) || blank(url);
    const body = String(text || '').slice(0, opt.maxChars);
    entry.page = { text: body, hash: hashText(body), at: now() };
    entry.failedAt = null; entry.failCode = null;
    if (title) entry.title = String(title).slice(0, 300);
    if (Array.isArray(links)) entry.links = links.filter(l => l && l.url).slice(0, 300).map(l => ({ url: String(l.url), text: String(l.text || '').slice(0, 120) }));
    return write(key, entry);
  }

  function rememberFailure(url, code) {
    const key = normalizeUrl(url);
    if (!key) return null;
    const entry = read(key) || blank(url);
    entry.failedAt = now(); entry.failCode = code || 'error';
    return write(key, entry);
  }

  const freshPage = entry => !!(entry && entry.page && now() - entry.page.at < opt.pageTtlMs);
  const recentFailure = entry => !!(entry && entry.failedAt && now() - entry.failedAt < opt.failTtlMs);

  /** Hel side hvis den finnes og er fersk, ellers null. */
  function getPage(url) {
    const entry = read(normalizeUrl(url));
    return freshPage(entry) ? { url: entry.url, title: entry.title, text: entry.page.text, hash: entry.page.hash, fetchedAt: entry.page.at, links: entry.links } : null;
  }

  /** All tekst vi faktisk har sett for en URL (hel side først, så utdrag). Tom streng betyr «ikke sett». */
  function textFor(url) {
    const entry = read(normalizeUrl(url));
    if (!entry) return '';
    const parts = [];
    if (entry.title) parts.push(entry.title);   // søketreff har ofte navnet bare i tittelen (f.eks. profilsider)
    if (entry.page) parts.push(entry.page.text);
    for (const s of entry.snippets) parts.push(s.text);
    return parts.join('\n');
  }

  function describe(url) {
    const entry = read(normalizeUrl(url));
    if (!entry) return null;
    const at = entry.page ? entry.page.at : entry.snippets.length ? Math.max(...entry.snippets.map(s => s.at)) : null;
    return { url: entry.url, title: entry.title || null, kind: entry.page ? 'page' : 'snippet', hash: entry.page ? entry.page.hash : hashText(entry.snippets.map(s => s.text).join('\n')), checkedAt: at };
  }

  /**
   * Henter bare det som mangler. `fetcher(urls)` skal returnere [{url, text, title?, links?}] og kan utelate
   * sider som ikke lot seg hente. Feil huskes en kort stund, så samme døde lenke ikke prøves i hver runde.
   */
  async function fetchMany(urls, fetcher, { budget } = {}) {
    const wanted = [...new Set(urls.map(u => String(u || '')).filter(u => normalizeUrl(u)))];
    const out = [], missing = [];
    for (const url of wanted) {
      const entry = read(normalizeUrl(url));
      if (freshPage(entry)) { out.push(getPage(url)); if (budget) budget.noteCacheHit(); }
      else if (recentFailure(entry)) continue;
      else missing.push(url);
    }
    const allowed = [];
    for (const url of missing) { if (budget && !budget.can('fetches')) break; if (budget) budget.spend('fetches'); allowed.push(url); }
    if (allowed.length) {
      const got = await fetcher(allowed);
      const byKey = new Map((got || []).filter(p => p && p.url && String(p.text || '').trim()).map(p => [normalizeUrl(p.url), p]));
      for (const url of allowed) {
        const hit = byKey.get(normalizeUrl(url));
        if (hit) { rememberPage(url, hit); out.push(getPage(url)); }
        else rememberFailure(url, 'not_fetched');
      }
    }
    return out;
  }

  return { rememberSnippet, rememberPage, rememberFailure, getPage, textFor, describe, fetchMany, normalizeUrl };
}

module.exports = { createPageCache, normalizeUrl, hashText };
