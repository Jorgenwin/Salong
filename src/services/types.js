/* Typer for tjenestelaget (kun JSDoc – ingen kjøretidskode, ikke med i bygget).
   Dette er kontrakten mellom UI og «backend», uansett om backend i dag er nettleserens lokale lagring
   eller en ekte server senere. Navn i API-et er camelCase; interne dokumenter i prototypen bruker snake_case/norsk (se core.js toAccount/toContact).

   @typedef {'queued'|'running'|'needs_review'|'completed'|'partial'|'failed'|'cancelled'} EnrichmentStatus

   @typedef {Object} EnrichmentJob
   @property {string} id
   @property {string} accountId
   @property {EnrichmentStatus} status
   @property {string|null} startedAt            ISO-tid
   @property {string|null} completedAt          ISO-tid
   @property {Object<string,SourceStatus>} sourceStatuses   per kilde: web, apollo, cognism
   @property {string|null} error                kort feilkode/tekst, ellers null
   @property {EnrichmentResult|null} result     null til jobben har fullført (eller delvis fullført)

   @typedef {'ok'|'empty'|'blocked'|'plan_restricted'|'error'|'not_connected'} SourceStatus

   @typedef {Object} EnrichmentResult
   @property {{name:string, domain:string|null, description:string|null}} organization
   @property {Array<{event:string, date:string|null, venue:string|null, type:string|null, source:string|null}>} eventSignals
   @property {Array<{name:string, title:string|null, relevanceScore:number|null, source:string|null}>} contactCandidates
   @property {Array<{email:string|null, phone:string|null, linkedin:string|null, source:string|null, verifiedAt:string|null}>} contactData
   @property {{whyNow:string|null, recommendedUseCase:string|null, recommendedRoom:string|null}} recommendation
   Felt uten dokumentasjon er null (aldri gjettet). UI viser «Ikke dokumentert».

   @typedef {Object} ServiceResult   Alle skrivende kall returnerer dette. Aldri unntak for forventede feil.
   @property {boolean} success
   @property {*} [data]
   @property {string} [error_code]
   @property {string} [error_message]

   @typedef {Object} SalongBackend   Det en server må implementere for å erstatte localBackend (se docs/architecture.md)
   @property {function(string):Promise<Object|null>} getAccount
   @property {function(Object=):Promise<Object[]>} getProspects
   @property {function(string):Promise<Object[]>} getContacts
   @property {function(string,Object=):Promise<ServiceResult>} enrichAccount
   @property {function(string[],Object=):Promise<ServiceResult>} enrichAccounts
   @property {function(string):Promise<EnrichmentJob|null>} getEnrichmentJob
   @property {function(string):Promise<EnrichmentJob|null>} getLatestEnrichmentJob
   @property {function(string=):Promise<Object[]>} getOpportunities
   @property {function(Object=):Promise<Object[]>} getCalendar
*/
