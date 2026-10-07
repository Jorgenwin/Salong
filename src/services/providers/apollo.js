/* ---------- Apollo-adapter: Apollo som én datakilde bak et lite, fast grensesnitt ----------
   UI og enrichment-pipelinen kjenner bare disse tre operasjonene og de nøytrale resultatformene under.
   Alt som er Apollo-spesifikt (verktøynavn, feltnavn, planbegrensninger) bor i denne filen.

     findOrganization({name, domain})                       → {matched, id, name, domain} | {matched:false, note}
     searchPeople({domain, orgId, titles, keywords})        → {people:[{name,title,apolloId,linkedin,loc,masked,…}], count}
     matchPerson({id, name, organizationName, domain})      → {email, emailStatus, linkedin, id, credits}   (KOSTER KREDITTER)

   TRANSPORT (hvordan kallet faktisk går ut) er det eneste som byttes mellom miljøer:
     - Claude-artefakt (i dag):  apolloTransport.call = enrCall → claude.use('mcp') → Apollo-connectoren.
                                 Krever at seeren samtykker per visning. Ingen API-nøkkel finnes i frontend.
                                 Gratisplan: organisasjonsoppslag virker, personsøk er sperret (API_INACCESSIBLE → 'plan_restricted').
     - Backend (fase 2):         apolloAdapter.setTransport({call:(tool,input)=>fetch('/api/integrations/apollo',…)}) – serveren
                                 holder APOLLO_API_KEY og kaller Apollo. Samme adapter, samme resultatformer, ingen UI-endring.
   Ingenting her simulerer svar: feiler transporten, kastes feilen videre og klassifiseres av enrClassify()
   (f.eks. «Apollo utilgjengelig», «Ingen person funnet»). */
const apolloTransport={ call:(tool,input)=>enrCall(tool,input) };

const apolloAdapter={
  id:'apollo',
  /** Bytt transport, f.eks. til et backend-endepunkt. `t.call(tool,input)` må returnere {payload}. */
  setTransport(t){ if(t&&typeof t.call==='function') apolloTransport.call=t.call; },
  async findOrganization(q){ q=q||{}; const key=q.domain||q.name; if(!key) return {matched:false,note:'Mangler domene.'};
    const r=await apolloTransport.call('apollo_organizations_lookup',{q_organization_fuzzy_name:key,display_mode:'fuzzy_select_mode',per_page:3});
    const L=(r.payload&&r.payload.organizations)||[];
    const hit=q.domain?L.find(o=>String(o.domain||enrHost(o.website_url||'')).toLowerCase().replace(/^www\./,'')===String(q.domain).toLowerCase()):L[0];
    return hit?{matched:true,id:hit.id,name:hit.name||'',domain:hit.domain||''}:{matched:false}; },
  async searchPeople(q){ q=q||{}; const inp={q_organization_domains_list:[q.domain],per_page:25};
    if(q.orgId) inp.organization_ids=[q.orgId]; if(q.titles&&q.titles.length) inp.person_titles=q.titles.slice(0,12); if(q.keywords) inp.q_keywords=q.keywords;
    let r; try{ r=await apolloTransport.call('apollo_mixed_people_api_search',inp); }
    catch(e){ if(e&&e.code==='tool_error'&&/API_INACCESSIBLE|upgrade|plan/i.test(String(e.message||''))) throw {code:'plan_restricted',message:'Apollo-planen gir ikke tilgang til personsøk.'}; throw e; }
    const P=(r.payload&&(r.payload.people||r.payload.contacts))||[]; return {people:cdFromApollo(P),count:P.length}; },
  /* e-post koster kreditter: bare som eksplisitt handling per person, aldri i bulk og aldri automatisk */
  async matchPerson(q){ q=q||{}; const inp={reveal_personal_emails:false,reveal_phone_number:false};
    if(q.id&&/^[a-f0-9]{24}$/.test(q.id)) inp.id=q.id; else { inp.name=q.name; inp.organization_name=q.organizationName; if(q.domain) inp.domain=q.domain; }
    const r=await apolloTransport.call('apollo_people_match',inp), pe=(r.payload&&(r.payload.person||r.payload))||{};
    return {email:pe.email||'',emailStatus:pe.email_status||'',linkedin:pe.linkedin_url||'',id:pe.id||'',credits:r.payload&&r.payload.mcp_credits||null}; } };

/* Eldre navn som provider-registreringen og pipelinen fortsatt bruker. De er tynne skall rundt adapteren. */
async function enrApolloCompany(args){ const a=args.a, dom=a.domain||enrHost(a.website||''); if(!dom) return {matched:false,note:'Mangler domene.'};
  const r=await apolloAdapter.findOrganization({name:a.name,domain:dom}); return r.matched?{matched:true,id:r.id,name:r.name}:{matched:false}; }
async function enrApolloPeople(args){ const a=args.a, dom=a.domain||enrHost(a.website||''), roles=args.roles||[]; if(!dom) return {people:[]};
  let r; try{ r=await apolloTransport.call('apollo_mixed_people_api_search',{q_organization_domains_list:[dom],person_titles:roles.slice(0,6),per_page:5}); }
  catch(e){ if(e&&e.code==='tool_error'&&/API_INACCESSIBLE|upgrade|plan/i.test(String(e.message||''))) throw {code:'plan_restricted',message:'Apollo-planen gir ikke tilgang til personsøk.'}; throw e; }
  const P=(r.payload&&(r.payload.people||r.payload.contacts))||[], out=[];
  for(const p of P.slice(0,5)){ const name=[p.first_name,p.last_name_obfuscated||p.last_name].filter(Boolean).join(' ')||p.name||''; if(!name||!p.title) continue;
    out.push({name,title:p.title,email:'',apolloId:p.id||'',url:p.linkedin_url||''}); }
  return {people:out,count:out.length}; }
async function enrApolloEmail(args){ const p=args.p, a=args.a;
  return apolloAdapter.matchPerson({id:p.sourceId,name:p.name,organizationName:a.name,domain:a.domain}); }
