/* Central de licitações: anos, grupos independentes e planilhas editáveis/offline. */
import {supabase,collection,doc,addDoc,updateDoc,deleteDoc,serverTimestamp} from '../supabase_compat.js?v=3';

(function(){
  'use strict';
  const YEAR='licitacao_ano',GROUP='licitacao_grupo',ROW='licitacao_lancamento';
  const STATUSES=['CONCLUÍDO','PENDENTE','SOLICITADO','AUTORIZADO','EM AVALIAÇÃO','EM EXECUÇÃO','RESSALVA'];
  const COLUMNS=[
    {key:'processo',label:'N° PROCESSO',type:'text',width:140},{key:'modalidade',label:'MODALIDADE',type:'text',width:145},
    {key:'objeto',label:'OBJETO',type:'text',width:270},{key:'fornecedor_numero',label:'FORNECEDOR / N°',type:'text',width:210},
    {key:'contrato',label:'CONTRATO',type:'text',width:130},{key:'valor_global',label:'VALOR GLOBAL',type:'currency',width:145},
    {key:'vigencia',label:'VIGÊNCIA',type:'text',width:170},{key:'obs',label:'OBS',type:'text',width:250}
  ];
  const REQUEST_COLUMNS=[{key:'data',label:'DATA',type:'date',width:135},{key:'objeto',label:'OBJETO',type:'text',width:360},{key:'secretaria',label:'SECRETARIA',type:'text',width:220},{key:'obs',label:'OBS',type:'text',width:300}];
  const COLUMN_TYPES={text:'Texto',number:'Número',date:'Data',currency:'Valor monetário'};
  const SEED_GROUPS=['FUNDO GERAL','SEC. EDUCAÇÃO','SEC. SAÚDE','SEC. ASSISTÊNCIA SOCIAL'];
  const state={secId:'',scope:'2025',groupId:'',search:'',saving:false,pdfBusy:false,gridDirty:false,seedJobs:new Map(),seeded:new Set(),selected:new Set(),anchor:null};
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const arg=v=>String(JSON.stringify(String(v??''))).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const val=(row,key,fallback='')=>row?.[key]??row?.extra_fields?.[key]??fallback;
  const type=row=>val(row,'registro_tipo');
  const cleanStatusLabel=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR').slice(0,50);
  const uniqueStatuses=list=>{const out=[],seen=new Set;for(const value of Array.isArray(list)?list:[]){const label=cleanStatusLabel(value),key=norm(label);if(label&&key&&!seen.has(key)){seen.add(key);out.push(label);}}return out;};
  const rawStatuses=row=>uniqueStatuses(val(row,'status_list',[]));
  const canEdit=sec=>Boolean(window.S?.isAdmin||window.userCanGroup?.(sec,'editar'));
  const currentSec=()=>window.S?.secs?.find(s=>String(s.id)===String(state.secId));
  const years=()=>window.S.items.filter(x=>x.atividade_id===state.secId&&type(x)===YEAR).sort((a,b)=>Number(val(a,'ano'))-Number(val(b,'ano')));
  const looseGroups=()=>window.S.items.filter(x=>x.atividade_id===state.secId&&type(x)===GROUP);
  const yearGroups=yearId=>window.S.subitems.filter(x=>x.atividade_id===state.secId&&type(x)===GROUP&&String(val(x,'parent_id',x.item_id))===String(yearId));
  const allGroups=()=>[...looseGroups(),...years().flatMap(y=>yearGroups(y.id))];
  const findGroup=id=>allGroups().find(x=>String(x.id)===String(id));
  const statusOrderFor=g=>{const saved=val(g,'status_options',null);return Array.isArray(saved)?uniqueStatuses(saved):[...STATUSES];};
  const groupForEntity=entity=>type(entity)===GROUP?entity:findGroup(val(entity,'parent_id'));
  const statusesForOptions=(entity,options)=>{const selected=new Set(rawStatuses(entity).map(norm));return uniqueStatuses(options).filter(s=>selected.has(norm(s)));};
  const statuses=row=>statusesForOptions(row,statusOrderFor(groupForEntity(row)));
  const groupRows=group=>window.S.subitems.filter(x=>x.atividade_id===state.secId&&type(x)===ROW&&String(val(x,'parent_id'))===String(group?.id)).sort((a,b)=>(Number(a.order_num)||0)-(Number(b.order_num)||0));
  const groupYear=g=>type(g)===GROUP&&g.item_id?years().find(y=>String(y.id)===String(g.item_id)):null;
  const now=()=>serverTimestamp();
  const money=v=>{if(v===''||v==null)return null;if(typeof v==='number')return Number.isFinite(v)?v:null;let s=String(v).trim().replace(/R\$\s?/gi,'').replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null;};
  const moneyBR=v=>v===''||v==null?'':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const statusSlug=s=>norm(s).toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const statusBadges=list=>list.length?list.map(s=>`<span class="lic-status ${statusSlug(s)}">${esc(s)}</span>`).join(''):'<span class="lic-status vazio">SEM STATUS</span>';
  const rowStatusBadges=list=>list.length?statusBadges(list):'<span class="lic-status vazio">SELECIONAR STATUS</span>';
  const columnsFor=g=>{const saved=val(g,'table_columns',[]);return Array.isArray(saved)&&saved.length?saved:COLUMNS;};
  const templateForName=name=>norm(name)==='SOLICITACAO DE LICITACOES'?REQUEST_COLUMNS:COLUMNS;
  const dateISO=v=>{const s=String(v??'').trim();if(!s)return'';let y,m,d,match=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(match)[,y,m,d]=match;else{match=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!match)return null;[,d,m,y]=match;}const iso=`${y}-${m}-${d}`,check=new Date(`${iso}T00:00:00Z`);return !Number.isNaN(check.getTime())&&check.toISOString().slice(0,10)===iso?iso:null;};
  const dateBR=v=>{const s=String(v??'').trim(),iso=dateISO(s);if(!iso)return s;const [y,m,d]=iso.split('-');return`${d}/${m}/${y}`;};
  const pdfCell=(row,column)=>{const raw=val(row,column.key,'');if(raw===''||raw==null)return '—';if(column.type==='currency'){const n=money(raw);return n==null?String(raw):moneyBR(n);}if(column.type==='number'){const n=money(raw);return n==null?String(raw):n.toLocaleString('pt-BR');}if(column.type==='date')return dateBR(raw);return String(raw);};
  const pdfModel=g=>{const rows=groupRows(g),configured=columnsFor(g);let cols=configured.filter(c=>rows.some(r=>String(val(r,c.key,'')??'').trim()!==''));if(!cols.length)cols=configured;return{rows,cols,head:['#',...cols.map(c=>c.label),'STATUS'],body:rows.map((r,i)=>[String(i+1),...cols.map(c=>pdfCell(r,c)),statuses(r).join(' • ')||'—'])};};
  const filePart=v=>norm(v).replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'GRUPO';
  const payloadBase=(extra={})=>({updated_at:now(),...extra});

  window.isLicitacaoGroup=function(sec){
    if(!sec)return false;
    return val(sec,'controle_licitacoes')===1||val(sec,'controle_licitacoes')===true||norm(sec.name||sec.description)==='LICITACAO';
  };

  async function createYear(year){
    const existing=years().find(y=>Number(val(y,'ano'))===Number(year));if(existing)return existing;
    const data={atividade_id:state.secId,description:String(year),order_num:Number(year),created_at:now(),updated_at:now(),registro_tipo:YEAR,ano:Number(year)};
    const ref=await addDoc(collection(supabase,'items'),data);const row={id:ref.id,...data};window.S.items.push(row);return row;
  }
  async function createGroup(name,year=null){
    const data={atividade_id:state.secId,description:name,order_num:year?yearGroups(year.id).length:looseGroups().length,created_at:now(),updated_at:now(),registro_tipo:GROUP,ano:year?Number(val(year,'ano')):null,parent_id:year?.id||null,parent_type:year?'item':'atividade',status_list:[],status_options:[...STATUSES],table_columns:templateForName(name)};
    const table=year?'subitems':'items';if(year)data.item_id=year.id;
    const ref=await addDoc(collection(supabase,table),data);const row={id:ref.id,...data};window.S[table].push(row);return row;
  }
  async function seed(secId){
    if(state.seedJobs.has(secId))return state.seedJobs.get(secId);
    const job=(async()=>{
      const sec=window.S.secs.find(s=>String(s.id)===String(secId));if(!sec||!canEdit(sec))return;
      state.secId=secId;
      if(!val(sec,'controle_licitacoes')){await updateDoc(doc(supabase,'secretariats',sec.id),{controle_licitacoes:1,updated_at:now()});sec.controle_licitacoes=1;}
      const y2025=await createYear(2025);await createYear(2026);
      for(const name of SEED_GROUPS){if(!yearGroups(y2025.id).some(g=>norm(g.description)===norm(name)))await createGroup(name,y2025);}
      state.seeded.add(secId);
      await window.loadData();
    })().finally(()=>state.seedJobs.delete(secId));
    state.seedJobs.set(secId,job);return job;
  }
  function seedReady(){const y25=years().find(y=>Number(val(y,'ano'))===2025),y26=years().find(y=>Number(val(y,'ano'))===2026);return Boolean(y25&&y26&&SEED_GROUPS.every(name=>yearGroups(y25.id).some(g=>norm(g.description)===norm(name))));}

  function top(sec){
    const rows=allGroups().flatMap(groupRows),total=rows.reduce((s,r)=>s+(money(val(r,'valor_global'))||0),0);
    return `<section class="lic-page"><header class="lic-hero"><div><div class="lic-kicker">🏛️ Secretaria de Finanças</div><h1>Licitações</h1><p>Anos, grupos e processos independentes, organizados em planilhas de alta produtividade.</p></div><div class="lic-hero-stats"><span><b>${years().length}</b> anos</span><span><b>${allGroups().length}</b> grupos</span><span><b>${rows.length}</b> lançamentos</span><span><b>${esc(moneyBR(total)||'R$ 0,00')}</b> valor global</span></div></header><div class="lic-toolbar"><button class="btn-action" onclick="renderModulo('atendimentos')">← Demandas</button>${canEdit(sec)?'<button class="btn-action primary" onclick="openLicitacaoYearModal()">＋ Ano</button><button class="btn-action" onclick="openLicitacaoGroupModal()">＋ Grupo</button>':''}<label class="lic-search"><span>⌕</span><input id="lic-search" type="search" value="${esc(state.search)}" placeholder="Buscar grupo, processo, objeto ou fornecedor" oninput="licitacaoSearch(this.value)"></label></div>`;
  }
  function scopeTabs(){
    return `<nav class="lic-year-tabs" aria-label="Anos das licitações">${years().map(y=>`<button class="${state.scope===String(val(y,'ano'))?'active':''}" onclick="selectLicitacaoScope('${esc(val(y,'ano'))}')"><span>${esc(val(y,'ano'))}</span><small>${yearGroups(y.id).length} grupos</small></button>`).join('')}<button class="${state.scope==='sem-ano'?'active':''}" onclick="selectLicitacaoScope('sem-ano')"><span>Sem ano</span><small>${looseGroups().length} grupos permanentes</small></button></nav>`;
  }
  function groupCard(g){
    const rows=groupRows(g),sum=rows.reduce((s,r)=>s+(money(val(r,'valor_global'))||0),0),q=norm(state.search);
    if(q){const hay=norm([g.description,...rows.flatMap(r=>columnsFor(g).map(c=>val(r,c.key))),...rows.flatMap(statuses)].join(' '));if(!hay.includes(q))return '';}
    return `<article class="lic-group-card"><div class="lic-group-head"><div class="lic-folder">🗂</div><div><h3>${esc(g.description||'Grupo sem nome')}</h3><div class="lic-statuses">${statusBadges(statuses(g))}</div></div></div><div class="lic-group-metrics"><span><b>${rows.length}</b> processos</span><span><b>${esc(moneyBR(sum)||'R$ 0,00')}</b> valor global</span></div><div class="lic-group-actions"><button class="btn-action primary" onclick="openLicitacaoTable(${arg(g.id)})">Abrir planilha →</button><button class="card-btn" title="Gerar PDF deste grupo" aria-label="Gerar PDF deste grupo" onclick="gerarPdfLicitacoes(${arg(g.id)})">📄</button>${canEdit(currentSec())?`<button class="card-btn" title="Gerenciar itens de status" aria-label="Gerenciar itens de status" onclick="openLicitacaoStatusOrder(${arg(g.id)})">⚙️</button><button class="card-btn" title="Status do grupo" onclick="openLicitacaoStatus('group',${arg(g.id)})">🏷️</button><button class="card-btn" title="Renomear grupo" onclick="openLicitacaoGroupModal(${arg(g.id)})">✏️</button><button class="card-btn danger" title="Excluir grupo" onclick="deleteLicitacaoGroup(${arg(g.id)})">🗑️</button>`:''}</div></article>`;
  }
  function renderGroups(sec){
    const year=years().find(y=>String(val(y,'ano'))===state.scope),groups=state.scope==='sem-ano'?looseGroups():(year?yearGroups(year.id):[]);
    const cards=groups.map(groupCard).join('');
    document.getElementById('content').innerHTML=top(sec)+scopeTabs()+`<div class="lic-scope-head"><div><h2>${state.scope==='sem-ano'?'Grupos permanentes':'Exercício '+esc(state.scope)}</h2><p>${state.scope==='sem-ano'?'Grupos que continuam fora de um exercício específico.':'Cada grupo e seus lançamentos pertencem exclusivamente a este ano.'}</p></div>${canEdit(sec)?`<button class="btn-action primary" onclick="openLicitacaoGroupModal()">＋ Novo grupo ${state.scope==='sem-ano'?'permanente':'em '+esc(state.scope)}</button>`:''}</div><div class="lic-groups">${cards||`<div class="lic-empty"><b>Nenhum grupo encontrado.</b><span>${state.search?'Limpe a busca ou tente outro termo.':'Crie o primeiro grupo desta seção.'}</span></div>`}</div></section>`;
  }
  function statusChoices(selected=[],prefix='lic-st',options=STATUSES){
    return options.length?options.map((s,i)=>`<label class="lic-status-choice"><input type="checkbox" id="${prefix}-${i}" value="${esc(s)}" ${selected.includes(s)?'checked':''}><span class="lic-status ${statusSlug(s)}">${esc(s)}</span></label>`).join(''):'<span class="lic-status-empty">Nenhum status cadastrado neste grupo.</span>';
  }
  function rowHtml(r,index,cols,editable,g){
    const list=r?statuses(r):[],rid=r?.id||'',cells=cols.map((c,col)=>{const kind=c.type||'text',raw=val(r,c.key),shown=kind==='currency'&&raw!==''?moneyBR(raw):kind==='date'?dateBR(raw):raw,mode=kind==='date'?'inputmode="numeric" maxlength="10" placeholder="dd/mm/yyyy"':kind==='currency'||kind==='number'?'inputmode="decimal"':'';return `<td><input ${editable?'':'disabled'} type="text" class="lic-cell" data-row="${index}" data-col="${col}" data-key="${esc(c.key)}" data-type="${esc(kind)}" value="${esc(shown)}" ${mode} autocomplete="off"></td>`;}).join('');
    return `<tr data-id="${esc(rid)}" data-index="${index}"><td class="lic-row-number">${index+1}</td>${cells}<td class="lic-row-status"><details><summary><span class="lic-statuses">${rowStatusBadges(list)}</span></summary><div class="lic-status-menu">${statusChoices(list,'rs-'+index,statusOrderFor(g))}</div></details></td>${editable?`<td class="lic-row-actions"><button type="button" title="Excluir linha" onclick="deleteLicitacaoRow(this)">×</button></td>`:''}</tr>`;
  }
  function renderTable(sec,g){
    const cols=columnsFor(g),rows=groupRows(g),editable=canEdit(sec),year=groupYear(g);state.gridDirty=false;
    document.getElementById('content').innerHTML=`<section class="lic-page lic-table-page"><div class="lic-table-title"><button class="btn-action" onclick="backLicitacaoGroups()">← Grupos</button><div><div class="lic-kicker">${year?'Exercício '+esc(val(year,'ano')):'Grupo permanente'}</div><h1>${esc(g.description)}</h1><div class="lic-statuses">${statusBadges(statuses(g))}</div></div><div class="lic-table-title-actions"><button class="btn-action" onclick="gerarPdfLicitacoes(${arg(g.id)})">📄 Gerar PDF</button>${editable?`<button class="btn-action" onclick="openLicitacaoStatus('group',${arg(g.id)})">🏷️ Status do grupo</button><button class="btn-action" onclick="openLicitacaoStatusOrder(${arg(g.id)})">⚙️ Gerenciar status</button><button class="btn-action" onclick="openLicitacaoColumns(${arg(g.id)})">⚙️ Editar colunas</button><button class="btn-action" onclick="appendLicitacaoRows(5)">＋ 5 linhas</button><button class="btn-action primary btn-save" onclick="saveLicitacaoTable()">💾 Salvar planilha</button>`:''}</div></div><div class="lic-grid-hint"><b>Planilha inteligente</b><span>Copie e cole do Excel. Use <kbd>Ctrl+C</kbd>, <kbd>Ctrl+V</kbd>, <kbd>Ctrl+D</kbd>, setas, Tab e Enter. Arraste para selecionar várias células.</span></div><div class="lic-table-wrap sticky-scroll-source"><table class="lic-grid"><colgroup><col style="width:44px">${cols.map(c=>`<col style="width:${Number(c.width)||160}px">`).join('')}<col style="width:240px">${editable?'<col style="width:48px">':''}</colgroup><thead><tr><th>#</th>${cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}<th>STATUS</th>${editable?'<th></th>':''}</tr></thead><tbody id="lic-grid-body">${rows.map((r,i)=>rowHtml(r,i,cols,editable,g)).join('')}${editable?Array.from({length:Math.max(3,rows.length?1:5)},(_,i)=>rowHtml(null,rows.length+i,cols,true,g)).join(''):''}</tbody></table></div><div class="lic-table-footer"><span>${rows.length} lançamento(s) salvo(s) neste grupo.</span>${editable?'<button class="btn-action primary btn-save" onclick="saveLicitacaoTable()">💾 Salvar todos os lançamentos</button>':''}</div></section>`;
    bindGrid();
  }

  window.gerarPdfLicitacoes=async function(id){
    if(state.pdfBusy){window.toast('O relatório já está sendo preparado. Aguarde.','info');return;}
    if(!window.jspdf?.jsPDF){window.toast('O gerador de PDF ainda não foi carregado. Recarregue a página.','error');return;}
    const g=findGroup(id),model=g?pdfModel(g):null;if(!g)return;if(!model.rows.length){window.toast('Este grupo ainda não possui lançamentos salvos para o relatório.','error');return;}
    state.pdfBusy=true;window.toast('Preparando o relatório deste grupo…','info',7000);
    try{
      const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),W=297,H=210,mx=12,HDR=30,FTR=15,top=36,year=groupYear(g),scope=year?'Exercício '+val(year,'ano'):'Grupo permanente';
      if(typeof doc.autoTable!=='function')throw new Error('Componente de tabelas do PDF indisponível');
      const logo=window.loadB64?await window.loadB64('img/logo_sertania.png','png',120).catch(()=>null):null;
      const font=(size,bold,color)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...(color||[30,41,59]));};
      const header=()=>{doc.setFillColor(245,252,248);doc.rect(0,0,W,HDR,'F');doc.setFillColor(13,113,91);doc.rect(0,0,6,HDR,'F');doc.setFillColor(34,197,94);doc.rect(0,HDR-3,W,3,'F');if(logo?.d){let h=22,w=h*(logo.w/logo.h);if(w>30){w=30;h=w/(logo.w/logo.h);}doc.addImage(logo.d,'PNG',W-mx-w,3+(23-h)/2,w,h,undefined,'FAST');}font(14,true,[13,113,91]);doc.text('RELATÓRIO DE LICITAÇÕES',mx+8,12);font(9,true,[30,41,59]);doc.text(String(g.description||'Grupo sem nome').toUpperCase(),mx+8,19,{maxWidth:W-mx*2-48});font(7,false,[71,85,105]);doc.text(`Prefeitura Municipal de Sertânia — PE  •  ${scope}  •  ${new Date().toLocaleDateString('pt-BR')}`,mx+8,25,{maxWidth:W-mx*2-48});};
      const footer=()=>{const page=doc.internal.getCurrentPageInfo().pageNumber;doc.setFillColor(13,34,64);doc.rect(0,H-FTR,W,FTR,'F');doc.setFillColor(34,197,94);doc.rect(0,H-FTR,W,2,'F');font(7,true,[220,252,231]);doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA — PE',mx,H-FTR+8);font(6.5,false,[203,213,225]);doc.text('Gestão de Atividades • Central de Licitações',W/2,H-FTR+11,{align:'center'});doc.text(`Página ${page}`,W-mx,H-FTR+8,{align:'right'});};
      header();footer();
      const currency=model.cols.filter(c=>c.type==='currency'),total=currency.reduce((sum,c)=>sum+model.rows.reduce((s,r)=>s+(money(val(r,c.key))||0),0),0),groupStatus=statuses(g).join(' • ')||'SEM STATUS';
      const cards=[['LANÇAMENTOS',String(model.rows.length)],[currency.length?'VALOR TOTAL':'COLUNAS EXIBIDAS',currency.length?moneyBR(total):String(model.cols.length)],['STATUS DO GRUPO',groupStatus]],cw=(W-mx*2-6)/3;
      cards.forEach((card,i)=>{const x=mx+i*(cw+3);doc.setFillColor(248,250,252);doc.setDrawColor(203,213,225);doc.roundedRect(x,top,cw,16,2,2,'FD');font(6.2,true,[100,116,139]);doc.text(card[0],x+4,top+5);font(i===2?7.2:10,true,i===2?[13,113,91]:[15,23,42]);const lines=doc.splitTextToSize(card[1],cw-8);doc.text(lines.slice(0,2),x+4,top+11);});
      const styles={0:{cellWidth:8,halign:'center'},[model.head.length-1]:{cellWidth:34}};
      doc.autoTable({startY:top+21,head:[model.head],body:model.body,margin:{left:mx,right:mx,top:36,bottom:20},tableWidth:W-mx*2,styles:{fontSize:model.cols.length>6?5.7:6.8,cellPadding:1.5,overflow:'linebreak',textColor:[30,41,59],lineColor:[203,213,225],lineWidth:.1,valign:'middle'},headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontStyle:'bold',fontSize:model.cols.length>6?5.8:7},alternateRowStyles:{fillColor:[248,252,248]},columnStyles:styles,rowPageBreak:'avoid',didDrawPage:data=>{if(data.pageNumber>1)header();footer();}});
      const pages=doc.internal.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);footer();}
      const iso=new Date().toISOString().slice(0,10),scopePart=year?String(val(year,'ano')):'PERMANENTE';doc.save(`RELATORIO-LICITACOES-${scopePart}-${filePart(g.description)}-${iso}.pdf`);window.toast(`PDF gerado com ${model.rows.length} lançamento(s).`,'success');
    }catch(e){console.error(e);window.toast('Não foi possível gerar o PDF: '+(e.message||e),'error',9000);}finally{state.pdfBusy=false;}
  };

  window.renderLicitacoes=function(secId){
    state.secId=String(secId);const sec=currentSec();if(!sec)return;
    if(!state.seeded.has(state.secId)&&seedReady())state.seeded.add(state.secId);
    if(!state.seeded.has(state.secId)&&canEdit(sec)){
      document.getElementById('content').innerHTML='<div class="lic-loading"><span></span><b>Preparando a Central de Licitações…</b><small>Criando os exercícios e grupos iniciais sem duplicar dados.</small></div>';
      seed(state.secId).then(()=>{if(!years().some(y=>String(val(y,'ano'))===state.scope))state.scope=years()[0]?String(val(years()[0],'ano')):'sem-ano';window.renderLicitacoes(state.secId);}).catch(e=>{console.error(e);window.toast('Não foi possível preparar as licitações: '+(e.message||e),'error',8000);});return;
    }
    if(state.groupId){const g=findGroup(state.groupId);if(g){renderTable(sec,g);return;}state.groupId='';}
    if(!years().some(y=>String(val(y,'ano'))===state.scope)&&state.scope!=='sem-ano')state.scope=years()[0]?String(val(years()[0],'ano')):'sem-ano';renderGroups(sec);
  };
  window.selectLicitacaoScope=s=>{state.scope=String(s);state.groupId='';window.renderLicitacoes(state.secId);};
  window.licitacaoSearch=v=>{state.search=v||'';renderGroups(currentSec());requestAnimationFrame(()=>{const el=document.getElementById('lic-search');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}});};
  window.openLicitacaoTable=id=>{state.groupId=String(id);state.search='';window.renderLicitacoes(state.secId);};
  window.backLicitacaoGroups=()=>{state.groupId='';window.renderLicitacoes(state.secId);};

  window.openLicitacaoYearModal=function(){
    window.openModal('📅 Novo exercício','Crie um ano independente para receber seus próprios grupos e lançamentos.',`<form onsubmit="event.preventDefault();saveLicitacaoYear()"><div class="form-group"><label>Ano *</label><input id="lic-year" type="number" min="2000" max="2200" value="${new Date().getFullYear()}" inputmode="numeric" required></div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" type="submit">Criar ano</button></div></form>`);
  };
  window.saveLicitacaoYear=async function(){const year=Number(document.getElementById('lic-year')?.value);if(year<2000||year>2200){window.toast('Informe um ano entre 2000 e 2200.','error');return;}if(years().some(y=>Number(val(y,'ano'))===year)){window.toast('Este ano já existe.','info');return;}try{await createYear(year);await window.loadData();state.scope=String(year);window.closeModal();window.toast(`Ano ${year} criado!`);window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível criar o ano: '+(e.message||e),'error');}};
  window.openLicitacaoGroupModal=function(id=''){
    const g=findGroup(id),currentYear=years().find(y=>String(val(y,'ano'))===state.scope),selected=g?(groupYear(g)?.id||'sem-ano'):(currentYear?.id||'sem-ano');
    window.openModal(g?'✏️ Editar grupo':'🗂 Novo grupo de licitações','O grupo manterá uma planilha e status totalmente independentes.',`<form onsubmit="event.preventDefault();saveLicitacaoGroup(${arg(id)})"><div class="form-group"><label>Nome do grupo *</label><input id="lic-group-name" maxlength="140" value="${esc(g?.description||'')}" placeholder="Ex.: Solicitação de Licitações" required></div>${g?'':`<div class="form-group"><label>Localização</label><select id="lic-group-year">${years().map(y=>`<option value="${esc(y.id)}" ${selected===y.id?'selected':''}>Ano ${esc(val(y,'ano'))}</option>`).join('')}<option value="sem-ano" ${selected==='sem-ano'?'selected':''}>Fora dos anos · grupo permanente</option></select></div>`}<div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" type="submit">${g?'Salvar nome':'Criar grupo e planilha'}</button></div></form>`);
  };
  window.saveLicitacaoGroup=async function(id=''){
    const name=document.getElementById('lic-group-name')?.value.trim();if(!name){window.toast('Informe o nome do grupo.','error');return;}
    try{const g=findGroup(id);if(g){await updateDoc(doc(supabase,window.S.items.some(x=>x.id===g.id)?'items':'subitems',g.id),payloadBase({description:name}));}
      else{const yearId=document.getElementById('lic-group-year')?.value,year=years().find(y=>String(y.id)===String(yearId));await createGroup(name,year||null);state.scope=year?String(val(year,'ano')):'sem-ano';}
      await window.loadData();window.closeModal();window.toast(g?'Grupo atualizado!':'Grupo e planilha criados!');window.renderLicitacoes(state.secId);
    }catch(e){window.toast('Não foi possível salvar o grupo: '+(e.message||e),'error',8000);}
  };
  function columnEditorRow(column){
    const options=Object.entries(COLUMN_TYPES).map(([key,label])=>`<option value="${key}" ${(column.type||'text')===key?'selected':''}>${label}</option>`).join('');
    return `<div class="lic-column-config" data-key="${esc(column.key)}" data-width="${Number(column.width)||160}"><span class="lic-column-grip">☰</span><input class="lic-column-label" value="${esc(column.label)}" maxlength="60" aria-label="Nome da coluna"><select class="lic-column-type" aria-label="Tipo da coluna">${options}</select><div class="lic-column-order"><button type="button" title="Mover para cima" onclick="moveLicitacaoColumn(this,-1)">↑</button><button type="button" title="Mover para baixo" onclick="moveLicitacaoColumn(this,1)">↓</button></div><button type="button" class="lic-column-remove" title="Remover coluna" onclick="removeLicitacaoColumn(this)">×</button></div>`;
  }
  window.openLicitacaoColumns=function(id){
    if(state.gridDirty){window.toast('Salve os lançamentos preenchidos antes de editar as colunas.','info',5500);return;}
    const g=findGroup(id);if(!g||!canEdit(currentSec()))return;
    window.openModal('⚙️ Editar colunas da planilha',g.description,'<p class="lic-column-help">Crie, renomeie, ordene ou remova colunas somente desta tabela. Remover uma coluna não apaga imediatamente seus dados antigos; eles deixam de aparecer na planilha.</p><div id="lic-column-list">'+columnsFor(g).map(columnEditorRow).join('')+'</div><button type="button" class="btn-action lic-add-column" onclick="addLicitacaoColumn()">＋ Criar coluna</button><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="button" class="btn-save" onclick="saveLicitacaoColumns('+arg(g.id)+')">Salvar colunas</button></div>');
  };
  window.addLicitacaoColumn=function(){const host=document.getElementById('lic-column-list');if(!host)return;const key='custom_'+Date.now().toString(36);host.insertAdjacentHTML('beforeend',columnEditorRow({key,label:'NOVA COLUNA',type:'text',width:180}));host.lastElementChild?.querySelector('.lic-column-label')?.select();};
  window.moveLicitacaoColumn=function(button,direction){const row=button.closest('.lic-column-config'),target=direction<0?row?.previousElementSibling:row?.nextElementSibling;if(!row||!target)return;if(direction<0)row.parentElement.insertBefore(row,target);else row.parentElement.insertBefore(target,row);};
  window.removeLicitacaoColumn=function(button){const row=button.closest('.lic-column-config'),key=row?.dataset.key,g=findGroup(state.groupId);if(!row)return;if(document.querySelectorAll('.lic-column-config').length<=1){window.toast('A tabela precisa ter pelo menos uma coluna.','error');return;}const hasData=g&&groupRows(g).some(item=>String(val(item,key,'')).trim());if(hasData&&!confirm('Esta coluna possui informações salvas. Deseja ocultá-la da tabela? Os dados permanecerão preservados no cadastro.'))return;row.remove();};
  window.saveLicitacaoColumns=async function(id){
    const g=findGroup(id),rows=[...document.querySelectorAll('.lic-column-config')];if(!g||!rows.length)return;
    const labels=rows.map(row=>row.querySelector('.lic-column-label').value.trim());if(labels.some(x=>!x)){window.toast('Todas as colunas precisam ter um nome.','error');return;}if(new Set(labels.map(norm)).size!==labels.length){window.toast('Não use nomes de coluna repetidos.','error');return;}
    const cols=rows.map((row,index)=>({key:row.dataset.key||('custom_'+index+'_'+Date.now().toString(36)),label:labels[index].toLocaleUpperCase('pt-BR'),type:row.querySelector('.lic-column-type').value||'text',width:Number(row.dataset.width)||180}));
    const table=window.S.items.some(x=>x.id===g.id)?'items':'subitems';try{await updateDoc(doc(supabase,table,g.id),payloadBase({table_columns:cols}));await window.loadData();window.closeModal();window.toast('Colunas desta tabela atualizadas!');window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível salvar as colunas: '+(e.message||e),'error',8000);}
  };
  window.openLicitacaoStatus=function(kind,id){
    const entity=kind==='group'?findGroup(id):window.S.subitems.find(x=>x.id===id);if(!entity)return;
    const g=kind==='group'?entity:groupForEntity(entity);window.openModal('🏷️ Status simultâneos',kind==='group'?'Estes status representam o grupo inteiro. Marque quantos precisar.':'Marque todos os status aplicáveis ao lançamento.',`<div class="lic-status-picker">${statusChoices(statuses(entity),'modal-st',statusOrderFor(g))}</div><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="saveLicitacaoStatus('${kind}',${arg(id)})">Salvar status</button></div>`);
  };
  window.saveLicitacaoStatus=async function(kind,id){const list=[...document.querySelectorAll('.lic-status-picker input:checked')].map(x=>x.value),entity=kind==='group'?findGroup(id):window.S.subitems.find(x=>x.id===id);if(!entity)return;const table=window.S.items.some(x=>x.id===entity.id)?'items':'subitems';try{await updateDoc(doc(supabase,table,entity.id),payloadBase({status_list:list,status:list[0]||null,concluded:list.includes('CONCLUÍDO')?1:0}));await window.loadData();window.closeModal();window.toast('Status atualizados!');window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível salvar os status: '+(e.message||e),'error');}};
  const statusOrderRow=status=>`<div class="lic-status-order-config" data-status="${esc(status)}"><button type="button" class="lic-status-drag-handle" title="Segure e arraste para mudar a ordem" aria-label="Arrastar ${esc(status)} para mudar a ordem" onpointerdown="startLicitacaoStatusDrag(event,this)">⠿</button><span class="lic-status ${statusSlug(status)}">${esc(status)}</span><div class="lic-column-order"><button type="button" title="Mover para cima" aria-label="Mover ${esc(status)} para cima" onclick="moveLicitacaoStatus(this,-1)">↑</button><button type="button" title="Mover para baixo" aria-label="Mover ${esc(status)} para baixo" onclick="moveLicitacaoStatus(this,1)">↓</button></div><button type="button" class="lic-status-order-remove" title="Excluir status" aria-label="Excluir ${esc(status)}" onclick="removeLicitacaoStatusOption(this)">×</button></div>`;
  window.openLicitacaoStatusOrder=function(id){
    if(state.gridDirty){window.toast('Salve os lançamentos preenchidos antes de ordenar os status.','info',5500);return;}const g=findGroup(id);if(!g||!canEdit(currentSec()))return;
    window.openModal('⚙️ Gerenciar itens de status',g.description,`<p class="lic-column-help">Crie, exclua e ordene os status somente deste grupo. Segure a alça ⠿ e arraste para a posição desejada. A ordem definida será usada nas células, nos seletores e no relatório PDF.</p><div class="lic-status-create"><input id="lic-new-status" maxlength="50" placeholder="Nome do novo status" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();addLicitacaoStatusOption()}"><button type="button" class="btn-action" onclick="addLicitacaoStatusOption()">＋ Criar status</button></div><div id="lic-status-order-list">${statusOrderFor(g).map(statusOrderRow).join('')}</div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="button" class="btn-save" onclick="saveLicitacaoStatusOrder(${arg(g.id)})">Salvar itens de status</button></div>`);
  };
  window.addLicitacaoStatusOption=function(){const input=document.getElementById('lic-new-status'),host=document.getElementById('lic-status-order-list');if(!input||!host)return;const label=cleanStatusLabel(input.value);if(!label||!norm(label).replace(/[^A-Z0-9]/g,'')){window.toast('Informe um nome válido para o status.','error');input.focus();return;}const existing=[...host.querySelectorAll('.lic-status-order-config')];if(existing.length>=30){window.toast('Este grupo já atingiu o limite de 30 status.','error');return;}if(existing.some(row=>norm(row.dataset.status)===norm(label))){window.toast('Este status já existe neste grupo.','info');input.select();return;}host.insertAdjacentHTML('beforeend',statusOrderRow(label));input.value='';input.focus();};
  window.removeLicitacaoStatusOption=function(button){const row=button.closest('.lic-status-order-config'),label=row?.dataset.status;if(!row)return;if(!confirm(`Excluir o status "${label}" deste grupo? Ao salvar, ele também será retirado dos lançamentos que o utilizam.`))return;row.remove();};
  function placeLicitacaoStatusRow(row,target,before){if(!row||!target||row===target||row.parentElement!==target.parentElement)return false;target.parentElement.insertBefore(row,before?target:target.nextElementSibling);return true;}
  window.moveLicitacaoStatus=function(button,direction){const row=button.closest('.lic-status-order-config'),target=direction<0?row?.previousElementSibling:row?.nextElementSibling;if(!row||!target)return;placeLicitacaoStatusRow(row,target,direction<0);};
  const statusDrag={row:null,handle:null,pointerId:null};
  function endLicitacaoStatusDrag(event){if(!statusDrag.row||(event&&event.pointerId!==statusDrag.pointerId))return;statusDrag.row.classList.remove('is-dragging');statusDrag.row.parentElement?.classList.remove('is-sorting');statusDrag.handle?.removeAttribute('aria-grabbed');try{statusDrag.handle?.releasePointerCapture?.(statusDrag.pointerId);}catch(_){}statusDrag.row=null;statusDrag.handle=null;statusDrag.pointerId=null;document.removeEventListener('pointermove',dragLicitacaoStatus);document.removeEventListener('pointerup',endLicitacaoStatusDrag);document.removeEventListener('pointercancel',endLicitacaoStatusDrag);}
  function dragLicitacaoStatus(event){if(!statusDrag.row||event.pointerId!==statusDrag.pointerId)return;event.preventDefault();const hit=document.elementFromPoint?.(event.clientX,event.clientY),target=hit?.closest?.('.lic-status-order-config');if(target&&target.parentElement===statusDrag.row.parentElement&&target!==statusDrag.row){const rect=target.getBoundingClientRect(),before=event.clientY<rect.top+rect.height/2;placeLicitacaoStatusRow(statusDrag.row,target,before);}const scroller=statusDrag.row.closest('.modal-body');if(scroller){const rect=scroller.getBoundingClientRect(),edge=46;if(event.clientY<rect.top+edge)scroller.scrollBy?.({top:-14});else if(event.clientY>rect.bottom-edge)scroller.scrollBy?.({top:14});}}
  window.startLicitacaoStatusDrag=function(event,handle){if(statusDrag.row||(event.pointerType==='mouse'&&event.button!==0))return;const row=handle?.closest('.lic-status-order-config');if(!row)return;event.preventDefault();statusDrag.row=row;statusDrag.handle=handle;statusDrag.pointerId=event.pointerId;row.classList.add('is-dragging');row.parentElement?.classList.add('is-sorting');handle.setAttribute('aria-grabbed','true');handle.setPointerCapture?.(event.pointerId);document.addEventListener('pointermove',dragLicitacaoStatus,{passive:false});document.addEventListener('pointerup',endLicitacaoStatusDrag);document.addEventListener('pointercancel',endLicitacaoStatusDrag);};
  window.saveLicitacaoStatusOrder=async function(id){const g=findGroup(id),order=uniqueStatuses([...document.querySelectorAll('#lic-status-order-list .lic-status-order-config')].map(row=>row.dataset.status));if(!g)return;const rows=document.querySelectorAll('#lic-status-order-list .lic-status-order-config');if(order.length!==rows.length){window.toast('Existem status vazios ou repetidos. Corrija antes de salvar.','error');return;}const allowed=new Set(order.map(norm)),cleanSelection=entity=>statusesForOptions(entity,order),affected=groupRows(g).filter(row=>rawStatuses(row).some(status=>!allowed.has(norm(status)))),groupList=cleanSelection(g),table=window.S.items.some(x=>x.id===g.id)?'items':'subitems';try{for(let start=0;start<affected.length;start+=10)await Promise.all(affected.slice(start,start+10).map(row=>{const list=cleanSelection(row);return updateDoc(doc(supabase,'subitems',row.id),payloadBase({status_list:list,status:list[0]||null,concluded:list.some(s=>norm(s)===norm('CONCLUÍDO'))?1:0}));}));await updateDoc(doc(supabase,table,g.id),payloadBase({status_options:order,status_list:groupList,status:groupList[0]||null,concluded:groupList.some(s=>norm(s)===norm('CONCLUÍDO'))?1:0}));await window.loadData();window.closeModal();const detail=affected.length?` ${affected.length} lançamento(s) também foram atualizados.`:'';window.toast(navigator.onLine?'Itens de status salvos!'+detail:'Itens de status salvos neste aparelho e aguardando sincronização.','success',7000);window.renderLicitacoes(state.secId);}catch(e){console.error(e);window.toast('Não foi possível salvar os itens de status: '+(e.message||e),'error',9000);}};

  window.appendLicitacaoRows=function(count=5){const body=document.getElementById('lic-grid-body'),g=findGroup(state.groupId);if(!body||!g)return;const start=body.rows.length,cols=columnsFor(g);body.insertAdjacentHTML('beforeend',Array.from({length:count},(_,i)=>rowHtml(null,start+i,cols,true,g)).join(''));bindGrid();body.rows[start]?.querySelector('.lic-cell')?.focus();};
  window.deleteLicitacaoRow=async function(button){const tr=button.closest('tr'),id=tr?.dataset.id;if(!id){tr?.remove();reindexRows();return;}if(!confirm('Excluir este lançamento da planilha?'))return;try{await deleteDoc(doc(supabase,'subitems',id));await window.loadData();window.toast('Lançamento excluído.');window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível excluir: '+(e.message||e),'error');}};
  window.deleteLicitacaoGroup=async function(id){const g=findGroup(id);if(!g||!confirm(`Excluir o grupo "${g.description}" e todos os seus lançamentos?`))return;try{for(const r of groupRows(g))await deleteDoc(doc(supabase,'subitems',r.id));await deleteDoc(doc(supabase,window.S.items.some(x=>x.id===g.id)?'items':'subitems',g.id));await window.loadData();window.toast('Grupo excluído.');window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível excluir o grupo: '+(e.message||e),'error');}};
  window.saveLicitacaoTable=async function(){
    if(state.saving){window.toast('A planilha já está sendo salva. Aguarde.','info');return;}const g=findGroup(state.groupId),body=document.getElementById('lic-grid-body');if(!g||!body)return;
    const trs=[...body.querySelectorAll('tr')],year=groupYear(g),invalidDate=trs.flatMap((tr,row)=>[...tr.querySelectorAll('.lic-cell[data-type="date"]')].map(input=>({input,row}))).find(({input})=>input.value.trim()&&!dateISO(input.value));if(invalidDate){window.toast(`Data inválida na linha ${invalidDate.row+1}. Use o formato DD/MM/YYYY.`, 'error',7000);invalidDate.input.focus();invalidDate.input.select();return;}let changed=0;state.saving=true;
    try{for(let index=0;index<trs.length;index++){const tr=trs[index],values={};tr.querySelectorAll('.lic-cell').forEach(input=>{const raw=input.value.trim(),kind=input.dataset.type;values[input.dataset.key]=kind==='date'?(raw?dateISO(raw):''):kind==='currency'||kind==='number'?money(raw):raw;});const list=[...tr.querySelectorAll('.lic-status-menu input:checked')].map(x=>x.value),used=Object.values(values).some(v=>v!==''&&v!==null)||list.length;if(!used&&!tr.dataset.id)continue;const firstValue=Object.values(values).find(v=>v!==''&&v!==null);const data={atividade_id:state.secId,item_id:year?.id||g.id,parent_id:g.id,parent_type:year?'subitem':'item',description:values.objeto||values.processo||String(firstValue||'Licitação'),observacao:values.obs||'',order_num:index,registro_tipo:ROW,...values,status_list:list,status:list[0]||null,concluded:list.includes('CONCLUÍDO')?1:0,updated_at:now()};if(tr.dataset.id)await updateDoc(doc(supabase,'subitems',tr.dataset.id),data);else{data.created_at=now();await addDoc(collection(supabase,'subitems'),data);}changed++;}
      await window.loadData();state.gridDirty=false;window.toast(navigator.onLine?`${changed} linha(s) salvas com sucesso!`:`${changed} linha(s) salvas neste aparelho. A sincronização ocorrerá quando a internet voltar.`,'success',6000);window.renderLicitacoes(state.secId);
    }catch(e){console.error(e);window.toast('Não foi possível salvar a planilha: '+(e.message||e),'error',9000);}finally{state.saving=false;window.releaseSaveButtons?.();}
  };

  function reindexRows(){document.querySelectorAll('#lic-grid-body tr').forEach((tr,i)=>{tr.dataset.index=i;const n=tr.querySelector('.lic-row-number');if(n)n.textContent=i+1;tr.querySelectorAll('.lic-cell').forEach(x=>x.dataset.row=i);});}
  function cells(){return [...document.querySelectorAll('#lic-grid-body .lic-cell')];}
  function cellAt(r,c){return document.querySelector(`#lic-grid-body .lic-cell[data-row="${r}"][data-col="${c}"]`);}
  function clearSelection(){cells().forEach(x=>x.classList.remove('selected','selection-edge'));state.selected.clear();}
  function selectRect(a,b){clearSelection();const r1=Math.min(a.r,b.r),r2=Math.max(a.r,b.r),c1=Math.min(a.c,b.c),c2=Math.max(a.c,b.c);for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const el=cellAt(r,c);if(el){el.classList.add('selected');state.selected.add(`${r}:${c}`);}}}
  function selectedMatrix(){const pos=[...state.selected].map(x=>x.split(':').map(Number));if(!pos.length)return null;const rs=pos.map(x=>x[0]),cs=pos.map(x=>x[1]),r1=Math.min(...rs),r2=Math.max(...rs),c1=Math.min(...cs),c2=Math.max(...cs);return{r1,r2,c1,c2};}
  function gridKey(e){
    const el=e.target.closest('.lic-cell');if(!el)return;const r=Number(el.dataset.row),c=Number(el.dataset.col);
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();const box=selectedMatrix()||{r1:r,r2:r,c1:c,c2:c},multi=box.r2>box.r1,sourceRow=multi?box.r1:box.r1-1,targetStart=multi?box.r1+1:box.r1;if(sourceRow<0)return;for(let col=box.c1;col<=box.c2;col++){const source=cellAt(sourceRow,col)?.value??'';for(let row=targetStart;row<=box.r2;row++){const target=cellAt(row,col);if(target)target.value=source;}}state.gridDirty=true;return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){const box=selectedMatrix();if(box){e.preventDefault();const text=Array.from({length:box.r2-box.r1+1},(_,ri)=>Array.from({length:box.c2-box.c1+1},(_,ci)=>cellAt(box.r1+ri,box.c1+ci)?.value||'').join('\t')).join('\n');navigator.clipboard?.writeText(text);}return;}
    const moves={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],Enter:[1,0]};let move=moves[e.key];if(e.key==='Tab')move=[0,e.shiftKey?-1:1];if(!move)return;if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&el.selectionStart!==el.selectionEnd)return;e.preventDefault();let nr=r+move[0],nc=c+move[1];const max=columnsFor(findGroup(state.groupId)).length-1;if(nc>max){nc=0;nr++;}if(nc<0){nc=max;nr--;}const target=cellAt(nr,nc);if(target){target.focus();target.select();if(e.shiftKey)selectRect(state.anchor||{r,c},{r:nr,c:nc});else{state.anchor={r:nr,c:nc};selectRect(state.anchor,state.anchor);}}
  }
  function gridPaste(e){const el=e.target.closest('.lic-cell');if(!el)return;const text=e.clipboardData?.getData('text/plain');if(!text||(!text.includes('\t')&&!text.includes('\n')))return;e.preventDefault();const startR=Number(el.dataset.row),startC=Number(el.dataset.col),data=text.replace(/\r/g,'').split('\n').filter((x,i,a)=>x!==''||i<a.length-1).map(x=>x.split('\t'));const required=startR+data.length-document.querySelectorAll('#lic-grid-body tr').length;if(required>0)window.appendLicitacaoRows(required);data.forEach((row,ri)=>row.forEach((v,ci)=>{const target=cellAt(startR+ri,startC+ci);if(target){const iso=target.dataset.type==='date'?dateISO(v):null;target.value=iso?dateBR(iso):v;}}));state.gridDirty=true;selectRect({r:startR,c:startC},{r:startR+data.length-1,c:startC+Math.max(...data.map(x=>x.length))-1});}
  function updateRowStatus(input){const details=input.closest('details'),list=[...details.querySelectorAll('input:checked')].map(x=>x.value),host=details.querySelector('summary .lic-statuses');if(host)host.innerHTML=rowStatusBadges(list);state.gridDirty=true;}
  function closeLicitacaoStatusMenus(event){
    const target=event?.target,openMenus=document.querySelectorAll?.('#lic-grid-body .lic-row-status details[open]')||[];
    openMenus.forEach(details=>{if(!target||!details.contains(target))details.removeAttribute('open');});
  }
  function bindGrid(){const body=document.getElementById('lic-grid-body');if(!body||body.dataset.bound)return;body.dataset.bound='1';body.addEventListener('keydown',gridKey);body.addEventListener('paste',gridPaste);body.addEventListener('input',e=>{if(e.target.matches('.lic-cell'))state.gridDirty=true;});body.addEventListener('focusout',e=>{if(e.target.matches('.lic-cell[data-type="date"]')){const iso=dateISO(e.target.value);if(iso)e.target.value=dateBR(iso);}});body.addEventListener('change',e=>{if(e.target.matches('.lic-status-menu input'))updateRowStatus(e.target);});body.addEventListener('pointerdown',e=>{const el=e.target.closest('.lic-cell');if(!el)return;const p={r:Number(el.dataset.row),c:Number(el.dataset.col)};if(e.shiftKey&&state.anchor)selectRect(state.anchor,p);else{state.anchor=p;selectRect(p,p);}body.dataset.selecting='1';document.addEventListener('pointerup',()=>{delete body.dataset.selecting;},{once:true});});body.addEventListener('pointerover',e=>{if(body.dataset.selecting!=='1'||!state.anchor)return;const el=e.target.closest('.lic-cell');if(el)selectRect(state.anchor,{r:Number(el.dataset.row),c:Number(el.dataset.col)});});}

  document.addEventListener?.('pointerdown',closeLicitacaoStatusMenus);
  document.addEventListener?.('keydown',event=>{if(event.key==='Escape')closeLicitacaoStatusMenus();});

  window.__licitacaoTest={YEAR,GROUP,ROW,STATUSES,COLUMNS,REQUEST_COLUMNS,COLUMN_TYPES,SEED_GROUPS,norm,money,dateISO,dateBR,pdfCell,cleanStatusLabel,uniqueStatuses,statusOrderFor,statusesForOptions,statuses,rowStatusBadges,templateForName,placeLicitacaoStatusRow,closeLicitacaoStatusMenus,isLicitacaoGroup:window.isLicitacaoGroup};
})();
