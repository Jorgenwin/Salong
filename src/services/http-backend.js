/* ---------- HTTP-backend for den selvstendige Salong-serveren ----------
   Ikke aktivert automatisk. Produksjon bytter eksplisitt med:
   SalongServices.use(SalongServices.createHttpBackend({baseUrl:''}))
   først når de nødvendige skrive-endepunktene også finnes. */
function salongLocalDate(d){
  d=d||new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function createHttpBackend(opt){
  opt=opt||{};
  const base=String(opt.baseUrl||'').replace(/\/$/,'');
  const fetcher=opt.fetch||window.fetch.bind(window);

  const qs=obj=>{
    const p=new URLSearchParams();
    for(const [k,v] of Object.entries(obj||{})) if(v!==undefined&&v!==null&&v!=='') p.set(k,String(v));
    const s=p.toString();
    return s?'?'+s:'';
  };

  function notReadyResult(operation){
    return {
      success:false,
      error_code:'backend_not_ready',
      error_message:'HTTP-backend mangler '+operation+' ennå.'
    };
  }

  function notReadyError(operation){
    const error=new Error('HTTP-backend mangler '+operation+' ennå.');
    error.code='backend_not_ready';
    return error;
  }

  async function request(path){
    let response;
    try{ response=await fetcher(base+path,{headers:{accept:'application/json'}}); }
    catch(error){
      const e=new Error('Kunne ikke kontakte Salong-serveren.');
      e.code='network_error'; e.cause=error; throw e;
    }

    let body=null;
    try{ body=await response.json(); }
    catch(_error){ body=null; }

    if(!response.ok){
      const e=new Error(body&&body.error_message||('Serverfeil '+response.status));
      e.code=body&&body.error_code||'http_error';
      e.status=response.status;
      e.requestId=body&&body.requestId||response.headers.get('x-request-id')||null;
      throw e;
    }
    return body;
  }

  return {
    async getAccount(id){
      try{ return await request('/api/accounts/'+encodeURIComponent(id)); }
      catch(error){ if(error.status===404&&error.code==='account_not_found') return null; throw error; }
    },
    getProspects(filter){ return request('/api/prospects'+qs(filter||{})); },
    getContacts(accountId){ return request('/api/accounts/'+encodeURIComponent(accountId)+'/contacts'); },
    getOpportunities(accountId){ return request('/api/opportunities'+qs(accountId?{account_id:accountId}:{})); },
    getCalendar(filter){
      filter=filter||{};
      const from=filter.from||salongLocalDate();
      return request('/api/calendar'+qs({from,to:filter.to||from}));
    },
    async enrichAccount(){ return notReadyResult('enrichAccount'); },
    async enrichAccounts(){ return notReadyResult('enrichAccounts'); },
    async getEnrichmentJob(){ throw notReadyError('getEnrichmentJob'); },
    async getLatestEnrichmentJob(){ throw notReadyError('getLatestEnrichmentJob'); }
  };
}
