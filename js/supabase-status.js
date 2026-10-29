import {supabase} from '../supabase_compat.js?v=9';

const OWNER_EMAIL='camposweb.personal@gmail.com';
const CACHE_PREFIX='gestao-supabase-status-v1:';
let refreshTimer=0;
let refreshPromise=null;

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

function level(percent){return percent>=95?'critical':percent>=85?'danger':percent>=70?'warning':'healthy';}
function gaugeCard({icon,title,used,limit,detail}){
  const percent=pct(used,limit),tone=level(percent);
  return `<article class="supa-metric-card ${tone}"><header><span>${icon}</span><div><small>CONSUMO ATUAL</small><h2>${esc(title)}</h2></div><b>${fmtPct(percent)}</b></header><div class="supa-meter"><i style="width:${percent}%"></i></div><div class="supa-values"><strong>${fmtBytes(used)} usados</strong><span>de ${fmtBytes(limit)}</span></div><p>${esc(detail)}</p></article>`;
}
function quotaCard({icon,title,limit,description}){
  return `<article class="supa-quota-card"><span>${icon}</span><div><small>LIMITE MENSAL DO PLANO</small><h3>${esc(title)}</h3><strong>${fmtBytes(limit)}</strong><p>${esc(description)}</p></div></article>`;
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
    <section class="supa-egress"><header><div><small>TRÁFEGO DE SAÍDA</small><h2>Limites mensais de visualização e download</h2></div><a href="https://supabase.com/dashboard/org/zeufhaflczahhgcfeylu/usage" target="_blank" rel="noopener noreferrer">Abrir relatório oficial ↗</a></header><div class="supa-quota-grid">
      ${quotaCard({icon:'↗',title:'Tráfego direto',limit:data.uncached_egress_limit_bytes,description:'Dados entregues sem cache, somando banco, autenticação, arquivos e demais serviços.'})}
      ${quotaCard({icon:'⚡',title:'Tráfego em cache/CDN',limit:data.cached_egress_limit_bytes,description:'Imagens e arquivos reaproveitados pela rede de distribuição do Supabase.'})}
    </div><p class="supa-egress-note">O plano Free não disponibiliza o consumo mensal de egress por uma API pública segura para este site. O painel mostra os limites corretos e leva ao relatório oficial sem expor chaves administrativas.</p></section>
    <footer class="supa-snapshot-footer"><span>${cached?'Última leitura salva no aparelho':'Leitura feita diretamente no Supabase'} em <b>${formatDate(data.sampled_at)}</b></span><span>Atualização automática a cada 30 segundos enquanto esta tela estiver aberta.</span></footer>`;
  const stamp=document.getElementById('supabase-status-stamp');if(stamp)stamp.textContent=cached?'Cópia local':'Ao vivo';
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
    writeCache(snapshot);renderSnapshot(snapshot);return snapshot;
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
