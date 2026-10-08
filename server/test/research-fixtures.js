'use strict';

// Oppdiktede organisasjoner og sider for research-testene. Ingen ekte personer eller virksomheter.
// Navnene er valgt for å se oppdiktede ut, og domenene ender på -test.no.

const NOW = () => new Date('2026-10-07T10:00:00Z');

// «Ryddig»: ansattliste og arrangementsside parserne klarer selv.
const RYDDIG = {
  account: { id: 'o-ryddig', name: 'Ryddig Forlag Test AS', domain: 'ryddig-test.no', segment_id: 'forlag' },
  pages: {
    'https://ryddig-test.no/om-oss/ansatte': {
      title: 'Ansatte',
      text: '# Ansatte\n\nKari Testesen\nKommunikasjonssjef\nkari.testesen@ryddig-test.no\n\nOla Prøvesen\nArrangementsansvarlig\n\nPer Tallsen\nØkonomisjef',
      links: [{ url: 'https://ryddig-test.no/kontakt', text: 'Kontakt oss' }]
    },
    'https://ryddig-test.no/arrangement/fagdag': {
      title: 'Fagdag 2026',
      text: 'Fagdag 2026\n14. november 2026 09:30 - 15:00\nSentralen, Øvre Slottsgate 3\n120 deltakere\nKontaktperson: Ola Prøvesen, Arrangementsansvarlig'
    },
    'https://ryddig-test.no/kontakt': { title: 'Kontakt', text: 'Kontakt oss\npost@ryddig-test.no\nTelefon: 22 33 44 55' }
  }
};

// «Prosa»: teamsiden er skrevet som løpende tekst, så parserne finner ingen. Her trengs LLM-uttrekk.
const PROSA = {
  account: { id: 'o-prosa', name: 'Prosa Instituttet Test', domain: 'prosa-test.no', segment_id: 'forskning' },
  pages: {
    'https://prosa-test.no/om-oss/team': {
      title: 'Vårt team',
      text: 'Vårt team\n\nKommunikasjon og arrangement ledes av Mona Fiktivsen, som er kommunikasjonsdirektør hos oss. Ta kontakt med henne på mona@prosa-test.no.\n\nTor Oppdiktet er arrangementsansvarlig og planlegger alle seminarene våre.'
    },
    'https://prosa-test.no/aktuelt/hostmote': {
      title: 'Høstmøte for medlemmer',
      text: 'Vi inviterer til høstmøte for alle medlemmer.\n\nDato: 20. november 2026\nSted kommer senere.'
    }
  }
};

/** Søkeport som bare kjenner sidene i fixturen: site:-søk gir korte utdrag (som en ekte søkemotor), ikke hele siden. */
function searchPort(fx, { snippet = 70, calls } = {}) {
  return async query => {
    if (calls) calls.push(query);
    const dom = fx.account.domain, out = [];
    if (/category:people/.test(query)) return out;
    for (const [url, p] of Object.entries(fx.pages)) {
      const isEvent = /arrangement|aktuelt/.test(url);
      if (query.includes('site:' + dom) || (isEvent && /arrangement/.test(query))) out.push({ url, title: p.title, text: p.text.slice(0, isEvent && !query.includes('site:') ? 2000 : snippet) });
    }
    return out;
  };
}

function fetchPort(fx, { calls } = {}) {
  return async urls => {
    if (calls) calls.push(...urls);
    return urls.filter(u => fx.pages[u]).map(u => ({ url: u, ...fx.pages[u] }));
  };
}

/** LLM-port som svarer med ferdige JSON-svar per side-URL. `answers[url]` kan være objekt eller funksjon. */
function llmPort(answers, { calls } = {}) {
  return {
    async complete({ prompt }) {
      const url = (/^Side: (\S+)/m.exec(prompt) || [])[1];
      if (calls) calls.push(url);
      const a = answers[url];
      if (a === undefined) return { text: '{"people":[],"events":[]}', usage: { inputTokens: 100, outputTokens: 10 } };
      return { text: JSON.stringify(typeof a === 'function' ? a(prompt) : a), usage: { inputTokens: 400, outputTokens: 80 } };
    }
  };
}

module.exports = { NOW, RYDDIG, PROSA, searchPort, fetchPort, llmPort };
