# 500 unike selskaper kontaktet — dynamisk plan

Salong må ikke forveksle «de sju første oppgavene på skjermen» med maks antall selskaper som kan kontaktes samme dag. De sju øverste er kun en prioritert startkø. `Vis neste 7` utvider løpende uten hard grense.

## Resultatmål og tempo

- **500 unike organisasjoner med registrert første utgående kontakt**, ikke 500 oppgaver, kontakter eller e-poster.
- Standard startdato: **1. desember 2026**.
- Standard frist: **31. mai 2027**. Dette er seneste planlagte frist; hvis arbeidet går raskere blir estimert dagsbehov lavere. Sett en tidligere frist hvis ønskelig.
- Tempo: `ceil((mål - allerede kontaktet) / gjenværende mandag–fredag)`, med kalenderdager uten helger; helligdager/ferie er ikke trukket fra og må hensyntas manuelt.
- Mål og frister kan settes via `S.settings.outreach={goal,start,deadline}`; redigeringskontroll i den **nye databasedrevne** appen kommer når innstillingene kan lagres sikkert.
- Før oppstart viser «I dag» forventet dagstempo fra desember, men oppretter ikke forfalte oppgaver av den grunn. I en allerede påbegynt uke er ukemålet dynamisk og regner med kontakter som allerede er gjort den uken.

## Hva teller som kontakt?

En unik organisasjon teller én gang når det finnes en **logget utgående**, faktisk samtale, e-post, møte eller visning i Salong. Inngående e-poster, notater, interne flagg, oppgaver og genererte e-postutkast teller ikke. Tidspunktet for første kontakt brukes for uketall, ikke den siste påminnelsen.

Dette er arbeidsflytlogikk for prototypen. I produksjons-CRM-et må teller og frister flyttes til server-side aktiviteter og databasevisninger, testes med injisert klokke og vises i Europe/Oslo, før man lover fullstendig nøyaktig status på 500-målet.
