import {supabase} from '../supabase_compat.js?v=9';

const OWNER_EMAIL='camposweb.personal@gmail.com';
const CACHE_PREFIX='gestao-supabase-status-v1:';
const EGRESS_CACHE_PREFIX='gestao-supabase-egress-v1:';
let refreshTimer=0;
let refreshPromise=null;
let egressPromise=null;
let egressLoadedAt=0;

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clamp=value=>Math.max(0,Math.min(100,Number(value)||0));
const pct=(used,limit)=>limit?clamp((Number(used)||0)*100/Number(limit)):0;
const fmtPct=value=>value<.1&&value>0?'menos de 0,1%':value.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const fmtBytes=value=>{
  const bytes=Math.max(0,Number(value)||0),units=['B','KB','MB','GB','TB'];
  let current=bytes,index=0;
  while(current>=1000&&index<units.length-1){current/=1000;index++;}
  return current.toLocaleString('pt-BR',{maximumFractionDigits:index?2:0})+' '+units[index];
};
const formatDate=value=>{
  try{return new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'medium'});}catch{return 'agora';}
};
const formatDay=value=>{
  try{return new Date(`${value}T12:00:00Z`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});}catch{return String(value||'');}
};
const state=()=>window.S||{};
const isOwner=()=>String(state().user?.email||'').trim().toLowerCase()===OWNER_EMAIL;

export function canViewSupabaseStatus(){
  if(isOwner())return true;
  const uid=state().user?.uid;
  return Boolean(uid&&(state().statusAccess||[]).some(row=>row.id===uid&&row.allowed===true));
}

export function updateSupabaseStatusAccessUI(){
  const allowed=canViewSupabaseStatus(),button=document.getElementById('nav-supabase-status');
  state().canViewSupabaseStatus=allowed;
  if(button)button.style.display=allowed?'':'none';
  return allowed;
}

function cacheKey(){return CACHE_PREFIX+(state().user?.uid||'anonymous');}
function readCache(){try{return JSON.parse(localStorage.getItem(cacheKey())||'null');}catch{return null;}}
function writeCache(data){try{localStorage.setItem(cacheKey(),JSON.stringify(data));}catch(_){}}
function egressCacheKey(){return EGRESS_CACHE_PREFIX+(state().user?.uid||'anonymous');}
function readEgressCache(){try{return JSON.parse(localStorage.getItem(egressCacheKey())||'null');}catch{return null;}}
function writeEgressCache(data){try{localStorage.setItem(egressCacheKey(),JSON.stringify(data));}catch(_){}}

function level(percent){return percent>=95?'critical':percent>=85?'danger':percent>=70?'warning':'healthy';}
function gaugeCard({icon,title,used,limit,detail}){
  const percent=pct(used,limit),tone=level(percent);
  return `<article class="supa-metric-card ${tone}"><header><span>${icon}</span><div><small>CONSUMO ATUAL</small><h2>${esc(title)}</h2></div><b>${fmtPct(percent)}</b></header><div class="supa-meter"><i style="width:${percent}%"></i></div><div class="supa-values"><strong>${fmtBytes(used)} usados</strong><span>de ${fmtBytes(limit)}</span></div><p>${esc(detail)}</p></article>`;
}
function renderAlert(data){
  const db=pct(data.database_bytes,data.database_limit_bytes),storage=pct(data.storage_bytes,data.storage_limit_bytes),highest=Math.max(db,storage);
  if(highest>=95)return `<div class="supa-alert critical"><b>⚠ Capacidade crítica</b><span>Um dos recursos ultrapassou 95%. Interrompa o crescimento e aumente a capacidade antes de novos lançamentos.</span></div>`;
  if(highest>=85)return `<div class="supa-alert danger"><b>⚠ Ação necessária</b><span>Um dos recursos ultrapassou 85%. Planeje a ampliação do plano agora, sem esperar o limite.</span></div>`;
  if(highest>=70)return `<div class="supa-alert warning"><b>◷ Atenção preventiva</b><span>Um dos recursos ultrapassou 70%. O painel continuará destacando o crescimento.</span></div>`;
  return `<div class="supa-alert healthy"><b>✓ Capacidade saudável</b><span>Banco e armazenamento estão abaixo do primeiro alerta preventivo de 70%.</span></div>`;
}
function renderSnapshot(data,{cached=false}={}){
  const root=document.getElementById('supabase-status-body');if(!root)return;
  const plan=String(data.plan||'free').toUpperCase();
  root.innerHTML=`${renderAlert(data)}
    <div class="supa-service-strip">
      <div><i></i><span><b>Projeto operacional</b><small>${esc(data.project_ref||'xwlmpxypjheuhbxyfplo')}</small></span></div>
      <div><i></i><span><b>Banco ${esc(data.database_status||'online')}</b><small>Leitura respondendo</small></span></div>
      <div><i></i><span><b>Storage ${esc(data.storage_status||'online')}</b><small>Metadados respondendo</small></span></div>
      <div class="supa-plan"><span><b>Plano ${esc(plan)}</b><small>Região ${esc(data.region||'ca-central-1')}</small></span></div>
    </div>
    <div class="supa-metrics-grid">
      ${gaugeCard({icon:'▤',title:'Banco de dados',used:data.database_bytes,limit:data.database_limit_bytes,detail:'Dados, índices e estrutura do sistema. Alerta preventivo a partir de 70%.'})}
      ${gaugeCard({icon:'▧',title:'Armazenamento de arquivos',used:data.storage_bytes,limit:data.storage_limit_bytes,detail:`${Number(data.storage_files||0).toLocaleString('pt-BR')} arquivo(s) em todos os buckets.`})}
    </div>
    <section class="supa-photo-summary"><div class="supa-photo-icon">▣</div><div><small>BUCKET DE FOTOS DO SISTEMA</small><h2>Imagens das demandas</h2><p>As fotos leves e sincronizadas ficam em <code>gestao-imagens</code>.</p></div><div class="supa-photo-numbers"><strong>${Number(data.image_storage_files||0).toLocaleString('pt-BR')}</strong><span>foto(s)</span><b>${fmtBytes(data.image_storage_bytes||0)}</b></div></section>
    <section class="supa-egress" id="supabase-egress-panel"><div class="supa-egress-loading"><i></i><div><small>TRÁFEGO MENSAL</small><b>Consultando o consumo oficial…</b><span>O Supabase atualiza esta medição aproximadamente a cada hora.</span></div></div></section>
    <footer class="supa-snapshot-footer"><span>${cached?'Última leitura salva no aparelho':'Leitura feita diretamente no Supabase'} em <b>${formatDate(data.sampled_at)}</b></span><span>Atualização automática a cada 30 segundos enquanto esta tela estiver aberta.</span></footer>`;
  const stamp=document.getElementById('supabase-status-stamp');if(stamp)stamp.textContent=cached?'Cópia local':'Ao vivo';
}

function metricValue(payload,name){
  const row=(payload?.summary?.usages||[]).find(item=>item?.metric===name);
  return {used:Number(row?.usage??row?.usage_original??0)||0,limit:Number(row?.pricing_free_units||0)||0};
}

function dailySeries(payload,name){
  const byDate=new Map();
  for(const row of payload?.daily?.usages||[]){
    if(row?.metric!==name||!row?.date)continue;
    byDate.set(row.date,(byDate.get(row.date)||0)+(Number(row.usage??row.usage_original)||0));
  }
  return byDate;
}

function linePoints(values,width=720,height=150,pad=14){
  const max=Math.max(1,...values),step=values.length>1?(width-pad*2)/(values.length-1):0;
  return values.map((value,index)=>`${(pad+index*step).toFixed(1)},${(height-pad-(value/max)*(height-pad*2)).toFixed(1)}`).join(' ');
}

function trafficCard({kind,title,icon,used,limit,description}){
  const percent=pct(used,limit),tone=level(percent);
  return `<article class="supa-traffic-card ${tone} ${kind}"><header><span>${icon}</span><div><small>CONSUMO NO CICLO ATUAL</small><h3>${esc(title)}</h3></div><strong>${fmtPct(percent)}</strong></header><div class="supa-traffic-numbers"><b>${fmtBytes(used)}</b><span>de ${fmtBytes(limit||5000000000)}</span></div><div class="supa-meter"><i style="width:${percent}%"></i></div><p>${esc(description)}</p></article>`;
}

function trafficChart(payload){
  const direct=dailySeries(payload,'EGRESS'),cached=dailySeries(payload,'CACHED_EGRESS');
  const dates=[...new Set([...direct.keys(),...cached.keys()])].sort();
  if(!dates.length)return '<div class="supa-chart-empty">Ainda não há pontos diários liberados pelo Supabase neste ciclo.</div>';
  const directValues=dates.map(date=>direct.get(date)||0),cachedValues=dates.map(date=>cached.get(date)||0);
  const all=[...directValues,...cachedValues],max=Math.max(1,...all);
  const y=value=>150-14-(value/max)*122;
  const area=(values)=>`14,136 ${linePoints(values)} 706,136`;
  const labelIndexes=[0,Math.floor((dates.length-1)/2),dates.length-1].filter((value,index,array)=>array.indexOf(value)===index);
  return `<div class="supa-traffic-chart" role="img" aria-label="Gráfico diário de tráfego direto e em cache no ciclo atual"><svg viewBox="0 0 720 170" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="supa-direct-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b9b7b" stop-opacity=".24"/><stop offset="1" stop-color="#0b9b7b" stop-opacity="0"/></linearGradient><linearGradient id="supa-cache-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#387fcb" stop-opacity=".18"/><stop offset="1" stop-color="#387fcb" stop-opacity="0"/></linearGradient></defs><g class="grid"><line x1="14" y1="14" x2="706" y2="14"/><line x1="14" y1="75" x2="706" y2="75"/><line x1="14" y1="136" x2="706" y2="136"/></g><polygon points="${area(cachedValues)}" fill="url(#supa-cache-fill)"/><polygon points="${area(directValues)}" fill="url(#supa-direct-fill)"/><polyline class="cached-line" points="${linePoints(cachedValues)}"/><polyline class="direct-line" points="${linePoints(directValues)}"/>${dates.map((date,index)=>{const x=dates.length>1?14+index*(692/(dates.length-1)):14;return `<circle class="direct-dot" cx="${x}" cy="${y(directValues[index])}" r="2.6"><title>${formatDay(date)}: ${fmtBytes(directValues[index])} direto</title></circle><circle class="cached-dot" cx="${x}" cy="${y(cachedValues[index])}" r="2.6"><title>${formatDay(date)}: ${fmtBytes(cachedValues[index])} em cache</title></circle>`;}).join('')}</svg><div class="supa-chart-labels">${labelIndexes.map(index=>`<span style="left:${dates.length>1?(index/(dates.length-1))*100:0}%">${formatDay(dates[index])}</span>`).join('')}</div></div>`;
}

function renderEgressSetup(){
  const panel=document.getElementById('supabase-egress-panel');if(!panel)return;
  if(!isOwner()){
    panel.innerHTML='<div class="supa-egress-unavailable"><span>◷</span><div><small>ATIVAÇÃO PENDENTE</small><h2>Leitura oficial ainda não configurada</h2><p>RCAMPOS precisa fazer a ativação única da consulta administrativa. Sua permissão de visualização já está preservada.</p></div></div>';
    return;
  }
  panel.innerHTML=`<div class="supa-token-setup"><div class="supa-token-icon">↗</div><div class="supa-token-copy"><small>ATIVAÇÃO ÚNICA E PROTEGIDA</small><h2>Conectar o relatório oficial de tráfego</h2><p>Crie uma credencial pessoal no Supabase, cole abaixo e confirme. Ela será validada e guardada criptografada no Vault; nunca ficará no navegador ou no código do site.</p><a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer">1. Criar credencial oficial no Supabase ↗</a></div><form onsubmit="event.preventDefault();configureSupabaseUsage().catch(()=>{})"><label for="supabase-management-token">2. Cole a credencial iniciada por <b>sbp_</b></label><div><input id="supabase-management-token" type="password" inputmode="text" autocomplete="off" spellcheck="false" placeholder="sbp_••••••••••••••••••••"><button id="supabase-token-save" type="submit">Conectar e mostrar gráfico</button></div><small>Somente RCAMPOS pode realizar ou substituir esta configuração.</small></form></div>`;
}

function renderEgress(payload,{cached=false}={}){
  const panel=document.getElementById('supabase-egress-panel');if(!panel)return;
  if(!payload?.configured){renderEgressSetup();return;}
  const direct=metricValue(payload,'EGRESS'),cdn=metricValue(payload,'CACHED_EGRESS');
  const directLimit=direct.limit||5000000000,cdnLimit=cdn.limit||5000000000;
  const start=payload.period_start?new Date(payload.period_start).toLocaleDateString('pt-BR'):'—';
  const end=payload.period_end?new Date(payload.period_end).toLocaleDateString('pt-BR'):'—';
  panel.innerHTML=`<header><div><small>TRÁFEGO DE SAÍDA · CICLO ${esc(start)} A ${esc(end)}</small><h2>Uso mensal de visualização e download</h2><p>Valores oficiais de toda a organização, atualizados pelo Supabase aproximadamente a cada hora.</p></div><a href="https://supabase.com/dashboard/org/zeufhaflczahhgcfeylu/usage" target="_blank" rel="noopener noreferrer">Abrir relatório oficial ↗</a></header>${payload.warning?`<div class="supa-egress-warning">◷ ${esc(payload.warning)} Exibindo a última leitura válida.</div>`:''}<div class="supa-traffic-grid">${trafficCard({kind:'direct',title:'Tráfego direto',icon:'↗',used:direct.used,limit:directLimit,description:'Banco, autenticação, Realtime, funções, arquivos sem cache e demais serviços.'})}${trafficCard({kind:'cached',title:'Tráfego em cache/CDN',icon:'⚡',used:cdn.used,limit:cdnLimit,description:'Conteúdo reaproveitado pela rede de distribuição, principalmente imagens e arquivos.'})}</div><div class="supa-chart-card"><header><div><small>EVOLUÇÃO DIÁRIA</small><h3>Consumo ao longo do ciclo</h3></div><div class="supa-chart-legend"><span class="direct">Tráfego direto</span><span class="cached">Cache/CDN</span></div></header>${trafficChart(payload)}</div><footer><span>${cached||payload.stale?'Última leitura salva':'Leitura oficial'}: <b>${formatDate(payload.fetched_at)}</b></span><span>Os limites de 5 GB são independentes: um não consome a franquia do outro.</span></footer>`;
}

async function readFunctionError(error){
  try{const response=error?.context;if(response?.json){const body=await response.json();return body?.message||error.message;}}catch(_){/* resposta sem JSON */}
  return error?.message||'Não foi possível consultar o tráfego mensal.';
}

async function loadEgressUsage(force=false){
  if(egressPromise)return egressPromise;
  if(!force&&egressLoadedAt&&Date.now()-egressLoadedAt<50*60*1000)return readEgressCache();
  egressPromise=(async()=>{
    if(!navigator.onLine){const saved=readEgressCache();if(saved){renderEgress(saved,{cached:true});return saved;}throw new Error('Sem internet para consultar o tráfego.');}
    const {data,error}=await supabase.functions.invoke('supabase-usage',{body:{action:'usage',force}});
    if(error)throw new Error(await readFunctionError(error));
    if(data?.configured){writeEgressCache(data);egressLoadedAt=Date.now();}
    renderEgress(data);return data;
  })().catch(error=>{const saved=readEgressCache();if(saved){renderEgress({...saved,warning:error.message},{cached:true});return saved;}const panel=document.getElementById('supabase-egress-panel');if(panel)panel.innerHTML=`<div class="supa-egress-unavailable"><span>⚠</span><div><small>TRÁFEGO INDISPONÍVEL</small><h2>Não foi possível atualizar o gráfico</h2><p>${esc(error.message)}</p><button type="button" onclick="refreshSupabaseStatus(true).catch(()=>{})">Tentar novamente</button></div></div>`;throw error;}).finally(()=>{egressPromise=null;});
  return egressPromise;
}

export async function configureSupabaseUsage(){
  if(!isOwner())throw new Error('Somente RCAMPOS pode configurar esta conexão.');
  const input=document.getElementById('supabase-management-token'),button=document.getElementById('supabase-token-save');
  const managementToken=String(input?.value||'').trim();
  if(!/^sbp_[A-Za-z0-9_-]{20,}$/.test(managementToken)){input?.focus();throw new Error('Informe uma credencial oficial válida iniciada por sbp_.');}
  if(button){button.disabled=true;button.textContent='Validando e protegendo…';}
  try{
    const {data,error}=await supabase.functions.invoke('supabase-usage',{body:{action:'configure',management_token:managementToken}});
    if(error)throw new Error(await readFunctionError(error));
    if(input)input.value='';writeEgressCache(data);egressLoadedAt=Date.now();renderEgress(data);
    if(typeof window.toast==='function')window.toast('Gráfico de tráfego conectado com segurança.','success');
    return data;
  }catch(error){if(typeof window.toast==='function')window.toast(error.message,'error');throw error;}
  finally{if(button){button.disabled=false;button.textContent='Conectar e mostrar gráfico';}}
}

function renderFailure(error,cached){
  const root=document.getElementById('supabase-status-body');if(!root)return;
  if(cached){renderSnapshot(cached,{cached:true});root.insertAdjacentHTML('afterbegin','<div class="supa-alert warning"><b>◷ Sem conexão ao vivo</b><span>Exibindo a última leitura salva. Assim que a internet voltar, o painel será atualizado automaticamente.</span></div>');return;}
  root.innerHTML=`<div class="supa-status-empty"><span>⚠</span><h2>Não foi possível consultar agora</h2><p>${esc(error?.message||'Verifique a conexão e tente novamente.')}</p><button type="button" onclick="refreshSupabaseStatus(true).catch(()=>{})">Tentar novamente</button></div>`;
}

export async function refreshSupabaseStatus(force=false){
  if(!canViewSupabaseStatus())throw new Error('Seu usuário não possui permissão para visualizar este painel.');
  if(refreshPromise&&!force)return refreshPromise;
  const button=document.getElementById('supabase-status-refresh');if(button){button.disabled=true;button.classList.add('loading');}
  refreshPromise=(async()=>{
    if(!navigator.onLine)throw new Error('O aparelho está offline.');
    const {data,error}=await supabase.rpc('get_supabase_status');
    if(error)throw new Error(error.message||'Falha ao consultar o Supabase.');
    const snapshot=typeof data==='string'?JSON.parse(data):data;
    writeCache(snapshot);renderSnapshot(snapshot);loadEgressUsage(force).catch(()=>{});return snapshot;
  })().catch(error=>{renderFailure(error,readCache());throw error;}).finally(()=>{
    refreshPromise=null;if(button){button.disabled=false;button.classList.remove('loading');}
  });
  return refreshPromise;
}

export function stopSupabaseStatusAutoRefresh(){clearInterval(refreshTimer);refreshTimer=0;}

export function renderSupabaseStatus(){
  stopSupabaseStatusAutoRefresh();
  if(!canViewSupabaseStatus()){
    document.getElementById('content').innerHTML='<div class="empty">Seu usuário não possui permissão para visualizar o status do Supabase.</div>';
    return;
  }
  document.getElementById('content').innerHTML=`<section class="supa-status-page"><header class="supa-status-hero"><div><small>CADASTROS E SISTEMA</small><h1>Status do Supabase</h1><p>Capacidade, armazenamento e saúde técnica acompanhados em um só lugar.</p></div><div class="supa-status-actions"><span id="supabase-status-stamp">Consultando…</span><button id="supabase-status-refresh" type="button" onclick="refreshSupabaseStatus(true).catch(()=>{})">↻ Atualizar agora</button></div></header><div id="supabase-status-body"><div class="supa-status-loading"><i></i><i></i><i></i><p>Consultando métricas protegidas…</p></div></div></section>`;
  refreshSupabaseStatus().catch(()=>{});
  refreshTimer=setInterval(()=>{if(window.__currentView==='supabase-status'&&navigator.onLine)refreshSupabaseStatus().catch(()=>{});},30000);
}

window.addEventListener('online',()=>{if(window.__currentView==='supabase-status')refreshSupabaseStatus(true).catch(()=>{});});
