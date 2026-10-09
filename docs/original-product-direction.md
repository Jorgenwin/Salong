# Salong – originalflaten er produktet

Oppdatert 9. oktober 2026 etter tilbakemelding fra brukeren.

## Produktretning

- **Original-Salong er hovedgrensesnittet.** `src/` eier navigasjon, Prospekter, Kunder, I dag, Pipeline, Kalender, tilbud, research og resten av funksjonaliteten.
- Behold arbeidsflyt, faner, detaljer og fagspråk. Gjør dem mer forståelige med klare beskrivelser, sterkere visuelt hierarki, tydelige aktive valg og gode tomtilstander.
- **Ikke erstatt originalen med den forenklede `/crm`-visningen.** Integrer nye CRM-funksjoner i originalen, ikke ved å fjerne moduler.
- Gemini-forslag er designinspirasjon. Prioriter lesbarhet, tydelighet, mobil og statusforklaringer framfor å bytte hele layouten.
- Kontroller originalens faner og sider i Playwright før frontend-release, inkludert `/#prosp`.
- **Vis konklusjonen først:** korte, konkrete setninger på kontokort og prospektlister. La `<details>`/piler åpne original begrunnelse, kildehenvisninger og poengfordeling ved behov. Ingen kildedata slettes.
- Interne felt som `score`, `market_status`, `cult/3`, automatisk tierberegning og API-koder skal ikke brukes som hovedtekst eller hjelpetekst rettet mot brukeren. Vis menneskelig språk uten å forandre beregningene.


## Lagring og avgrensning

`salong-production.up.railway.app` viser den komplette originale frontenden. Den er fremdeles en **statisk demo uten permanent lagring** utenfor Claude Artifact. Innhold som legges inn der, er ikke lagret i Supabase.

`salong-api-production.up.railway.app/crm` er en separat autentisert klient med Supabase/PostgreSQL og permanente CRM-skriveoperasjoner. Behold den som migreringsbro, men ikke som produktets valgte sluttflate.

## Trygg integrasjon

1. Bevar originalens UI, datamodell og navigasjon.
2. Legg inn innlogging og ekte serverdata i originalen, uten å blande demodata og ekte kunder.
3. Koble én funksjon om gangen til serverens datakontrakter: organisasjoner, kontakter, oppfølging, salgsmuligheter, beriking, kalender. Svar må bekreftes før UI viser «Lagret».
4. Hvis en modul ennå ikke har trygg serverlagring, vis den tydelig som ikke-synkronisert framfor å simulere permanent lagring.
5. Test roller, refresh, feil, mobil, tastatur og tomtilstander. Verifiser skriveparitet før produksjonsbytte.

## Railway

`Salong` bruker `Dockerfile.demo` med `scripts/serve.js` inntil originalskallet får autentisert backend. Ikke sett `DATABASE_URL` eller hemmelige nøkler på den statiske tjenesten.

`Salong API` beholder `Dockerfile.api` og databasekonfigurasjon. Ikke flytt produksjonsdomener til en redusert CRM-visning som snarvei.
