# Salong CRM UX: designbeslutninger basert på mottatt Gemini-spesifikasjon

Mål: gi en rask, ryddig og tilgjengelig CRM-arbeidsflyt for **utleie ved Litteraturhuset**, uten å erstatte den kjente Salong-prototypen med en helt annen bransjeløsning.

## Implementert for det innloggede CRM-et

- **Appskall:** slank, fast side-/mobilnavigasjon mellom selskaper, faktisk pipeline og den eksisterende Salong-arbeidsflaten. Søket er tilgjengelig i topplinjen og bevarer listekonteksten.
- **Tastatur:** Ctrl/Cmd + K søker, N åpner ny organisasjon, J/K velger neste/forrige rad, E åpner valgt selskap, Escape lukker panel. Hurtigtaster overstyrer ikke input/tekstfelt.
- **Sidoskuff:** høyre panel med selskapets informasjon, kontaktpersoner og tidslinje over **lagrede aktiviteter**. Leser får en sikker visning uten lagringsknapper. Mobil bruker hele bredden.
- **Inline-edit:** kvalitet A/B/C kan endres direkte i listen, men kun med gyldig Supabase Auth og editorrolle. Før UI sier «Lagret», kreves positivt API-svar; ved feil gjenopprettes originalvalg.
- **Sikker pipeline i både Kanban og tabell:** Eier/editor kan endre fase fra begge visninger. Duplikat av samme selskap, normaliserte tittel og arrangementsdato avvises med tydelig 409, også ved gjentatt innsending. Manglende estimert beløp vises som ukjent, ikke som bekreftet 0 kr.
- **Ekte Kanban:** de syv eksisterende fasene i `public.opportunities`: ny, dialog, visning, tilbud, holdt, bekreftet, tapt. Visningen kan byttes mellom Kanban og tabell. Summer og antall regnes fra faktisk lagrede muligheter.
- **KPI og tomtilstander:** ekte antall selskaper og A/B/C i toppfeltet; pipeline viser åpen verdi og åpent antall, og forklarer hvorfor listen er tom. Vektet verdi vises som **«Ikke beregnet»** fremfor å late som et estimat er kildebelagt.
- **Reell aktivitetsalder:** varsel ved siste *lagrede, fullførte* kontakt eldre enn syv dager. Ikke basert på siste visning eller importerestempel.
- **Uttrykk:** luftig bakgrunn, lette rammer, kompakt tabell, meningsbærende statusfarger, Salongs mørkegrønne aksent, responsivt design, synlig tastaturfokus og redusert animasjon for brukere som ønsker det.

## Bevisst utsatt eller ikke valgt

- **Ingen falske bookingbeløp.** Eksemplene fra Gemini (frisørsalonger, verdi 420 000) er illustrasjoner, ikke Salong-data.
- **Ingen drag-and-drop som ser lagret ut uten et sikkerhetsprøvd write-API.** Faseflytting og optimistiske animasjoner aktiveres først etter autorisert transaksjon, konflikthåndtering og tilbakeføring ved feil.
- **Ingen automatiske e-poster når et kort flyttes**, og ingen automatisk «konvertering» som kopierer data til ny kundetabell. Salong benytter samme organisasjon som kunde og prospekt; relasjon/status endres på eksisterende ID.
- **Ingen masse-sletting eller skjult bulk-redigering** før eksplisitte serverendepunkter har audit og rollesjekk.
- **Ingen krav om estimert verdi og kontaktperson ved opprettelse:** navn er nok for rask registrering. Resten kan fylles ut når informasjonen finnes.
- **Ingen global AI som handler automatisk:** fremtidige AI-forslag må være kildebelagte, tydelig forslag og kreve godkjenning.
- **Beholder demoen urørt.** Endringene bygges i Salong API-tjenesten og erstatter ikke den statiske demosiden uten separat godkjenning.

## Akseptanse

1. Eier/editor kan logge inn, legge til selskap og redigere kvalitet i listen. Endringen leses på nytt fra API etter lagring.
2. Samme liste står igjen når et selskap åpnes i sidoskuffen; tidslinjen kommer fra `/api/accounts/:id/activities`.
3. Leser kan se selskap, men ikke endre det.
4. Kanban viser bare `/api/opportunities`. Ved null registrerte saker vises en tomtilstand, ikke demokort.
5. Demosiden oppdateres ikke ved CRM-endringer (egen watch pattern i Railway).
6. Responsiv + tastatur: alle interaktive områder kan brukes uten mus, og fokus beholdes ved lukking av drawer.

**Merk:** Dette er en første produksjonssikker UX-etappe. Aktivitetsskaping, bookingflyt og «I dag»-mål fra den eldre prototypen migreres separat til reelle serverlagrede ressurser.
