# Gmail i Salong: trygg innføring

## Tilgjengelig uten Google-tilkobling

Salongs sekvensvisning kan nå åpne hver forfalt e-post i en ferdigutfylt Gmail-komponering (`to`, `su`, `body`). Det er en brukerstyrt overgang til Gmail, **ikke** sending fra Salong. Kontroller mottaker og avsender i Gmail før du trykker Send, og merk deretter manuelt som sendt i Salong. Ingen automatisk logging, svarregistrering eller åpningssporing følger med denne snarveien.

## Neste integrasjon: OAuth mot Gmail

Før serveren kan sende, lagre utkast direkte eller synkronisere faktisk sendte og mottatte meldinger, kreves en Google Cloud OAuth-klient og at brukeren uttrykkelig kobler til Gmail. Ikke be om e-postpassord, ikke legg tokens i GitHub eller i nettleserkoden, og ikke legg Gmail OAuth-tokens i Supabase Auth sin eksisterende JWT.

Bygg server-side kode med disse grensene:

- Gmail API med minste nødvendige scopes for lesing og sending, granular consent og tydelig valg om man bare vil bruke snarveien.
- Kryptert, server-side oppbevaring av refresh token og eksplisitt frakobling/tilbakekalling. Maks ett autentisert Gmail-account per Salong-medlem i første versjon.
- Send alltid fra brukerens godkjente Gmail-identitet, med menneskelig forhåndsvisning/bekreftelse. Ingen automatisk bulkutsending fra sekvenser.
- Lagre `gmail_message_id` / `thread_id` og sendingstid. Idempotensnøkkel på hver send-handling; ikke send på nytt ved timeout uten å kontrollere Gmail-status.
- Innkommende svar skal opprette en oppfølgingsoppgave og stoppe videre sekvenssteg. Bounce og opt-out skal også stoppe sekvensen. Knytt meldinger bare til riktig konto og kontakt; tvetydige matcher til gjennomgang.
- Registrer `sent`, `replied`, `bounced`, `failed` og `unknown` som separate, revisjonssporbare hendelser. Ikke merk «sendt» bare fordi brukeren åpnet Gmail.
- Beskytt e-postinnhold i logger og API, håndhev innlogging/rolle, begrens synkronisering til nødvendig metadata, og dokumenter sletting/retensjon.

## Åpninger: senere og med forbehold

Gmail API gir ikke et generelt, pålitelig `opened_at` for e-post som er sendt. Sporingspiksler har falske positive fra bildeproksyer og forhåndslasting, falske negative når bilder blokkeres, og krever grundig personvernvurdering etter gjeldende regler. Vis eventuelt «mulig åpning», aldri «kunden har lest» som en sikker påstand, og **aldri** bruk dette alene som grunn til automatisk flytting eller nye henvendelser. Svar er et sterkere signal.

## Forventet fremdrift

1. Først kontrollert import av selskaper til Supabase, og test av appen med innlogging.
2. Deretter OAuth-basert Gmail draft/send i backend med eksplisitt samtykke og full testsuite.
3. Så synkronisering av svar og sekvensavmelding.
4. Til slutt separat beslutning om åpninger og klikk, med personvernvurdering.

Ikke bruk den statiske demoen som en reell produksjons-klient for utsendelse.
