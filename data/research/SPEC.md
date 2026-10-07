# Research-oppdrag: Wave 1 target-universe for Litteraturhuset (Salong 2027)

Kontekst: Litteraturhuset i Oslo åpner storsalen **Solstad** (opptil 320 i stolrader) i februar 2027, i tillegg til mindre rom
(Wergeland, Skram, Collett, Kverneland, Hofmo m.fl.). Salgsarbeidet er utadrettet: finne organisasjoner som arrangerer
seminarer, fagdager, konferanser, lanseringer, årsmøter, debatter osv. og som kan leie lokaler.
Dato i dag: 2026-10-06.

## Hva du skal levere
En JSON-fil med **verifiserte, ekte norske (eller i Norge aktive) organisasjoner** for oppgitte segmenter. Kvalitet slår kvantitet:
returner færre enn målet heller enn å gjette. Ingen oppdiktede organisasjoner, personer, nettsteder, datoer, deltakertall eller priser.

## Harde regler
1. En organisasjon tas bare med hvis du selv har åpnet organisasjonens eget nettsted (eller en offisiell kilde) i denne økten og
   bekreftet at den eksisterer, og hva domenet er. Bruk WebFetch/WebSearch (og Exa/Firecrawl-verktøy hvis tilgjengelig).
2. Hver organisasjon må ha minst én kilde-URL du faktisk har lest. `checked` = "2026-10-06".
3. Eventsignal er «documented» bare hvis du har en side (arrangementsprogram, nyhetssak, pressemelding, årsrapport) som viser at organisasjonen
   arrangerer fysiske arrangementer. Skriv hva siden faktisk sier. Ellers `documented:false` og confidence "low"; da skal
   `types`, `venues`, `next_dates` være tomme lister. Ikke utled frekvens, deltakertall, venue eller måned uten at kilden sier det.
4. Ingen kontaktpersoner. Bare roller (f.eks. "Events", "Communications", "Programme Manager"). Ingen e-post, telefon eller navn.
5. Ikke ta med: andre utleielokaler/konkurrerende venues (Sentralen, Oslo Konserthus, Folketeateret osv.), organisasjoner som står i
   `existing.json` (match på navn eller domene), mikrovirksomheter uten arrangementsaktivitet, eller noe du ikke finner nettsted til.
6. Ikke legg til en score eller «fit». Skriv en kort, nøktern `why` (maks 220 tegn) som er tydelig avledet analyse, ikke kildefakta.
7. Skill kildefakta (`about`, `event_signal`) fra analyse (`why`, `room_hint`). `room_hint` er null med mindre kilden oppgir deltakertall/venue som gir grunnlag.
8. Foretrekk organisasjoner i Oslo/Akershus. Landsdekkende organisasjoner med kontor eller arrangementer i Oslo er ok.
9. Rapporter forbehold: hvis en nettside ikke kunne åpnes, si det i `rejected`.

## Format (skriv med Write-verktøyet til filen du får oppgitt)
```json
{
 "agent": "<navn>",
 "segments": ["forlag"],
 "accounts": [
  {
   "name": "Offisielt navn",
   "website": "https://www.example.no",
   "domain": "example.no",
   "segment": "<segment-id fra listen under>",
   "place": "Oslo",
   "geo": "oslo | norge | intl",
   "size": "S | M | L | null",
   "about": "1-2 setninger, fra kildene",
   "why": "kort analyse, maks 220 tegn",
   "event_signal": {
     "documented": true,
     "summary": "Hva kilden sier, kort",
     "types": ["fagdag", "konferanse", "lansering", "årsmøte", "seminar", "debatt", "mingle", "kurs"],
     "frequency": "kun hvis kilden sier det, ellers null",
     "typical_attendance": null,
     "attendance_source": null,
     "venues": ["kun venues kilden nevner"],
     "months": ["kun hvis kilden sier det"],
     "open_closed": "åpent | lukket | ukjent",
     "next_dates": [{"date": "2026-11-12", "title": "...", "venue": "...", "url": "..."}],
     "confidence": "high | medium | low"
   },
   "room_hint": null,
   "contact_roles": ["Events", "Communications"],
   "sources": [{"url": "https://...", "title": "...", "checked": "2026-10-06"}]
  }
 ],
 "rejected": [{"name": "...", "reason": "kunne ikke verifisere | finnes allerede | konkurrerende venue | ..."}]
}
```
`size`: L bare hvis kilden viser stort arrangement (200+ deltakere) eller stor organisasjon (>200 ansatte/medlemmer i tusenvis); ellers M/S ut fra kilde; ellers null.
`confidence`: high = datert arrangement som navngir organisasjonen som arrangør; medium = gjentakende program omtalt uten spesifikke datoer; low = ikke dokumentert.

## Segment-id'er
forlag (Forlag, bok, litteratur og medier) · forskning (Forskning, universitetsmiljøer og tenketanker) · fag (Fag-, profesjons-, medlems- og bransjeorganisasjoner) ·
ambassade (Ambassader, kulturinstitutter og internasjonale organisasjoner) · pharma (Helse, pharma og medtech) · ngo (NGO-er, stiftelser og samfunnsorganisasjoner) ·
tech (Teknologileverandører, distributører og partnerøkosystemer) · saas (B2B-teknologi og SaaS) · finans (Finans og forsikring) · konsulent (Konsulent-, advokat- og rådgivningsmiljøer) ·
bedrift (Større bedrifter med dokumentert arrangementsaktivitet) · offentlig (Offentlig sektor og direktorater) · utdanning (Utdanning og kompetanseaktører) ·
byra (Event-, PR- og kommunikasjonsmiljøer) · nettverk (Nettverk, communities og øvrige eventaktive organisasjoner)

Vær økonomisk: sikt på ca. 50–70 verktøykall totalt. Avslutt med én linje: antall accounts levert og antall avvist.
