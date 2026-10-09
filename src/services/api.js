/* ---------- Tjenestelaget UI-et snakker med: SalongServices ----------
   Fem tjenester: accounts, contacts, enrichment, opportunities, calendar. Kallene er async og returnerer rene objekter (types.js),
   slik at de kan flyttes til HTTP uten at UI endres:  GET /api/accounts/:id · GET /api/prospects · GET /api/accounts/:id/contacts ·
   POST /api/enrichment/accounts/:id · POST /api/enrichment/batch · GET /api/enrichment/jobs/:id.
   I dag er `localBackend` implementasjonen (nettleserens lagring via repositories + enrichmentService i denne siden).
   Server senere:  SalongServices.use(httpBackend)  – ingen UI-endring. Se docs/architecture.md.
   Ingen hemmeligheter her: Apollo m.m. nås via adapter (services/providers/apollo.js) og transport som byttes serverside. */
const localBackend={
  async getOrganizations(){return accountRepository.list({scope:'all'});},
  async getAccount(id){ const a=mtGet(id); return a?toAccount(a):null; },
  async getProspects(f){ return accountRepository.list(f||{}); },
  async getContacts(accountId){ return contactRepository.listByAccount(accountId); },
  /* legger jobben i køen og returnerer jobbid (backend: POST /api/enrichment/accounts/:id). Følg status med getEnrichmentJob. */
  async enrichAccount(accountId,opt){ const r=await crm.enrichment.start(accountId,opt||{}); return r.success?ok({...r.data,jobId:(r.data.job_ids||[])[0]||null}):r; },
  async enrichAccounts(accountIds,opt){ const r=await enrichmentService.startMany(accountIds,opt||{}); return r.queued?ok(r):fail('nothing_to_do','Ingenting å berike.',r); },
  async getEnrichmentJob(id){ const j=S.mtjob[id]; return j?toEnrichmentJob({id,...j}):null; },
  async getLatestEnrichmentJob(accountId){ const j=bkJobOf(accountId); return j?toEnrichmentJob(j):null; },
  async getOpportunities(accountId){ return caseRepository.list(accountId?{account_id:accountId}:{}); },
  async getCalendar(f){ f=f||{}; const t=kalToday(); return kalItems(f.from||t,f.to||f.from||t); } };
let salongBackend=localBackend;
const SalongServices={
  use(impl){ salongBackend=Object.assign({},localBackend,impl||{}); return SalongServices; },
  reset(){ salongBackend=localBackend; },
  createHttpBackend,
  accounts:{ getAccount:id=>salongBackend.getAccount(id), getProspects:f=>salongBackend.getProspects(f),
    getOrganizations:()=>salongBackend.getOrganizations(),
    mapImportedOrganizations:rows=>salongMapImportedOrganizations(rows) },
  contacts:{ getContacts:accountId=>salongBackend.getContacts(accountId) },
  enrichment:{ enrichAccount:(id,o)=>salongBackend.enrichAccount(id,o), enrichAccounts:(ids,o)=>salongBackend.enrichAccounts(ids,o),
    getJob:id=>salongBackend.getEnrichmentJob(id), getLatestJob:accountId=>salongBackend.getLatestEnrichmentJob(accountId) },
  opportunities:{ list:accountId=>salongBackend.getOpportunities(accountId) },
  calendar:{ items:f=>salongBackend.getCalendar(f) } };
/* datakilde-adaptere (bytt transport med providers.apollo.setTransport, se providers/apollo.js) */
SalongServices.providers={apollo:apolloAdapter};
window.SalongServices=SalongServices;
