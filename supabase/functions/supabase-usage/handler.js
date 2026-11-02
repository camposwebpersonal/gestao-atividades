const OWNER_EMAIL='camposweb.personal@gmail.com';
const ORGANIZATION_SLUG='zeufhaflczahhgcfeylu';
const PLATFORM_BASE='https://api.supabase.com';
const CACHE_MAX_AGE=55*60*1000;
const FORCE_MIN_AGE=5*60*1000;

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};

const normalizeCache=row=>row?{
  configured:true,
  period_start:row.period_start,
  period_end:row.period_end,
  mode:row.summary?.mode||(row.daily?.days?'requests':'egress'),
  summary:row.summary||{},
  daily:row.daily||{},
  fetched_at:row.fetched_at,
  source:'official-cache'
}:null;

const PROJECT_REF='xwlmpxypjheuhbxyfplo';
const REJECTED_TOKEN='A credencial foi recusada pelo Supabase. Confira se ela foi copiada inteira, se não foi revogada e se pertence à conta dona do projeto.';

async function apiGet(fetchImpl,path,managementToken){
  const response=await fetchImpl(PLATFORM_BASE+path,{headers:{Authorization:`Bearer ${managementToken}`,Accept:'application/json'}});
  let payload=null;
  try{payload=await response.json();}catch{payload=null;}
  if(!response.ok){
    const detail=payload?.message||payload?.error||`HTTP ${response.status}`;
    const error=new Error(`O Supabase não entregou as métricas: ${detail}`);
    error.status=response.status;
    throw error;
  }
  return payload;
}

// Valida a credencial na API pública oficial (/v1), que aceita tokens sbp_.
async function validateToken(fetchImpl,managementToken){
  try{
    await apiGet(fetchImpl,`/v1/projects/${PROJECT_REF}`,managementToken);
  }catch(error){
    if(error.status===401||error.status===403){
      const rejected=new Error(REJECTED_TOKEN);
      rejected.status=401;
      throw rejected;
    }
    throw error;
  }
}

// Tráfego em GB por organização: endpoint interno do painel. Nem sempre aceita
// tokens pessoais; quando recusar, usamos as requisições oficiais do /v1.
async function fetchEgress(fetchImpl,managementToken){
  const subscription=await apiGet(fetchImpl,`/platform/organizations/${ORGANIZATION_SLUG}/billing/subscription`,managementToken);
  const now=new Date();
  const periodStart=new Date(Number(subscription.current_period_start||0)*1000);
  const periodEnd=new Date(Number(subscription.current_period_end||0)*1000);
  if(!Number.isFinite(periodStart.getTime())||periodStart.getUTCFullYear()<2020)throw new Error('O Supabase não informou o início do ciclo de uso atual.');
  const sampleEnd=periodEnd>now?now:periodEnd;
  const query=new URLSearchParams({start:periodStart.toISOString(),end:sampleEnd.toISOString()});
  const [summary,daily]=await Promise.all([
    apiGet(fetchImpl,`/platform/organizations/${ORGANIZATION_SLUG}/usage?${query}`,managementToken),
    apiGet(fetchImpl,`/platform/organizations/${ORGANIZATION_SLUG}/usage/daily?${query}`,managementToken)
  ]);
  return {mode:'egress',period_start:periodStart.toISOString(),period_end:periodEnd.toISOString(),summary:summary||{},daily:daily||{}};
}

const toDay=value=>{
  if(value===null||value===undefined||value==='')return null;
  let date;
  if(typeof value==='number'){
    const ms=value>1e14?value/1000:value>1e11?value:value*1000;
    date=new Date(ms);
  }else date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):null;
};

async function fetchRequests(fetchImpl,managementToken){
  const payload=await apiGet(fetchImpl,`/v1/projects/${PROJECT_REF}/analytics/endpoints/usage.api-counts?interval=7day`,managementToken);
  const rows=Array.isArray(payload?.result)?payload.result:Array.isArray(payload)?payload:[];
  const byDay=new Map();
  for(const row of rows){
    const day=toDay(row?.timestamp);
    if(!day)continue;
    const current=byDay.get(day)||{date:day,rest:0,auth:0,storage:0,realtime:0};
    current.rest+=Number(row.total_rest_requests)||0;
    current.auth+=Number(row.total_auth_requests)||0;
    current.storage+=Number(row.total_storage_requests)||0;
    current.realtime+=Number(row.total_realtime_requests)||0;
    byDay.set(day,current);
  }
  const days=[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const totals=days.reduce((acc,day)=>{for(const key of ['rest','auth','storage','realtime'])acc[key]+=day[key];return acc;},{rest:0,auth:0,storage:0,realtime:0});
  const sorted=days.map(day=>day.date);
  return {mode:'requests',period_start:sorted[0]?`${sorted[0]}T00:00:00.000Z`:null,period_end:sorted.length?`${sorted[sorted.length-1]}T23:59:59.000Z`:null,summary:{totals},daily:{days}};
}

async function fetchOfficialUsage(fetchImpl,managementToken){
  await validateToken(fetchImpl,managementToken);
  let result;
  let egressNote=null;
  try{
    result=await fetchEgress(fetchImpl,managementToken);
  }catch(error){
    egressNote=error.status===401||error.status===403
      ?'O Supabase não libera o tráfego em GB para credenciais pessoais; exibindo as requisições oficiais do projeto.'
      :`Tráfego em GB indisponível agora (${error.message}); exibindo as requisições oficiais do projeto.`;
    result=await fetchRequests(fetchImpl,managementToken);
  }
  if(egressNote)result.summary={...result.summary,note:egressNote};
  return {configured:true,...result,fetched_at:new Date().toISOString(),source:'official-live'};
}

export function supabaseUsageHandler(client,{fetchImpl=fetch}={}){
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
  return async request=>{
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
    if(request.method!=='POST')return reply(405,{message:'Método não permitido.'});
    try{
      const accessToken=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
      if(!accessToken)return reply(401,{message:'Entre novamente para consultar o uso do Supabase.'});
      const {data:identity,error:identityError}=await client.auth.getUser(accessToken);
      if(identityError||!identity.user)return reply(401,{message:'Sua sessão expirou. Entre novamente.'});

      const email=String(identity.user.email||'').trim().toLowerCase();
      const owner=email===OWNER_EMAIL;
      let allowed=owner;
      if(!allowed){
        const {data:access,error:accessError}=await client.from('supabase_status_access').select('allowed').eq('id',identity.user.id).maybeSingle();
        if(accessError)return reply(500,{message:'Não foi possível validar sua permissão de acesso.'});
        allowed=access?.allowed===true;
      }
      if(!allowed)return reply(403,{message:'Seu usuário não possui permissão para visualizar o tráfego do Supabase.'});

      let body={};
      try{body=await request.json();}catch{body={};}
      const action=body.action==='configure'?'configure':'usage';
      const {data:cachedRows}=await client.from('supabase_egress_cache').select('*').eq('singleton',true).limit(1);
      const cached=normalizeCache(cachedRows?.[0]);

      if(action==='configure'){
        if(!owner)return reply(403,{message:'Somente RCAMPOS pode configurar a leitura oficial de tráfego.'});
        const managementToken=String(body.management_token||'').trim();
        if(!/^sbp_[A-Za-z0-9_-]{20,}$/.test(managementToken))return reply(400,{message:'Informe uma credencial pessoal oficial do Supabase iniciada por sbp_.'});
        const fresh=await fetchOfficialUsage(fetchImpl,managementToken);
        const {error:tokenError}=await client.rpc('set_supabase_management_token_for_runtime',{token_value:managementToken});
        if(tokenError)throw new Error('Não foi possível guardar a credencial no cofre criptografado.');
        const {error:saveError}=await client.rpc('save_supabase_egress_cache_for_runtime',{
          new_period_start:fresh.period_start,new_period_end:fresh.period_end,
          new_summary:{...fresh.summary,mode:fresh.mode},new_daily:fresh.daily,new_fetched_at:fresh.fetched_at
        });
        if(saveError)throw new Error('As métricas foram lidas, mas não foi possível salvar o cache protegido.');
        return reply(200,fresh);
      }

      const {data:managementToken,error:tokenError}=await client.rpc('get_supabase_management_token_for_runtime');
      if(tokenError)throw new Error('Não foi possível acessar o cofre protegido do Supabase.');
      if(!managementToken)return reply(200,{configured:false,owner,cache:cached});

      const cacheAge=cached?.fetched_at?Date.now()-new Date(cached.fetched_at).getTime():Infinity;
      const force=body.force===true&&owner&&cacheAge>=FORCE_MIN_AGE;
      if(cached&&cacheAge<CACHE_MAX_AGE&&!force)return reply(200,cached);

      try{
        const fresh=await fetchOfficialUsage(fetchImpl,managementToken);
        const {error:saveError}=await client.rpc('save_supabase_egress_cache_for_runtime',{
          new_period_start:fresh.period_start,new_period_end:fresh.period_end,
          new_summary:{...fresh.summary,mode:fresh.mode},new_daily:fresh.daily,new_fetched_at:fresh.fetched_at
        });
        if(saveError)throw new Error('Falha ao atualizar o cache protegido.');
        return reply(200,fresh);
      }catch(error){
        if(cached)return reply(200,{...cached,stale:true,warning:error.message});
        throw error;
      }
    }catch(error){
      return reply(Number(error?.status)>=400&&Number(error?.status)<500?Number(error.status):500,{message:error?.message||'Não foi possível consultar o uso mensal agora.'});
    }
  };
}

