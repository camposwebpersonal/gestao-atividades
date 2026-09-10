import './perfuracao-pocos.js?v=6';

/* ── SISTEMA MODULAR DE LANÇAMENTOS ── */
const MODULOS = [
  {id:'eventos', label:'Eventos', desc:'Exposições, seminários, agenda e programações especiais.', icon:'🎪', color:'#ec4899', modulo:'eventos'},
  {id:'projetos', label:'Controle de Projetos', desc:'Projetos que a Prefeitura está trabalhando atualmente.', icon:'🚀', color:'#f59e0b', modulo:'projetos'},
  {id:'obras', label:'Obras e Infraestrutura', desc:'Cisternas, barragens, barreiros e demandas de infraestrutura.', icon:'🏗️', color:'#a16207', modulo:'obras'},
  {id:'frota', label:'Frota e Veículos', desc:'IPVA, seguros e aluguéis dos veículos municipais.', icon:'🚗', color:'#6366f1', modulo:'frota'},
  {id:'atendimentos', label:'Atendimentos', desc:'Serviços de urgência e demandas da população.', icon:'🆘', color:'#ef4444', modulo:'atendimentos'},
  {id:'rh', label:'RH e Empregos', desc:'BCCS, comissionados, contratos e gestão de pessoas.', icon:'👥', color:'#8b5cf6', modulo:'rh'},
  {id:'cadastros', label:'Cadastros', desc:'Associações, lideranças e listas diversas.', icon:'📋', color:'#06b6d4', modulo:'cadastros'},
  {id:'contas', label:'Controle de Contas', desc:'Água, luz, telefone, internet, seguros e contas.', icon:'💰', color:'#10b981', modulo:'contas', flag:'controle_contas'},
  {id:'distribuicao', label:'Controle de Distribuição', desc:'Distribuição de leite, cestas e benefícios.', icon:'🚚', color:'#14b8a6', modulo:'distribuicao', flag:'controle_distribuicao'},
  {id:'estoque', label:'Controle de Estoque', desc:'Entradas, saídas e estoque crítico de produtos.', icon:'📦', color:'#0ea5e9', modulo:'estoque', flag:'controle_estoque'},
  {id:'alugueis', label:'Controle de Aluguéis', desc:'Imóveis, equipamentos, veículos alugados e contratos.', icon:'🏠', color:'#f97316', modulo:'alugueis'},
  {id:'mulher', label:'Rede de Assistência e Proteção da Mulher', desc:'Ações, atendimentos e programas de proteção à mulher.', icon:'🙋‍♀️', color:'#d946ef', modulo:'mulher'},
  {id:'agenda_prefeita', label:'Agenda da Prefeita', desc:'Compromissos, agendas e atividades da Prefeita.', icon:'📅', color:'#0d9488', modulo:'agenda_prefeita'},
  {id:'atividades', label:'Outros / Geral', desc:'Demandas e itens não classificados em outro módulo.', icon:'⚙️', color:'#3b82f6', isAtividades:true}
];
window.MODULOS = MODULOS;

const NOME_MODULO = {
  eventos:['expocose','expo','seminário','seminario','agenda','evento','eventos','festa','palestra'],
  projetos:['projetos','projeto'],
  obras:['cisterna','cisternas','barreiro','barreiros','barragem','barragens','infraestrutura','pontos de cisterna','demandas de barreiros','obras'],
  frota:['veiculo','veículos','frota','ipva','seguro dos veiculos','seguro dos veículos'],
  atendimentos:['urgencia','urgência','atendimento','atendimentos','ouvidoria','serviços de urgencia','servicos de urgencia','retro','perfuracao','perfuração','poco','poço','pocos','poços'],
  rh:['rh','empregos','vereadores','bcc s','bcc','comissionados','contratos','igespe','genesis','vigia','vigias'],
  cadastros:['associações','associacoes','lideranças','liderancas','lideres','cadastro'],
  contas:['controle de contas','contas','seguro','seguros'],
  distribuicao:['distribuição','distribuicao','distribuicao de leite','leite'],
  estoque:['estoque','controle de estoque','secretaria de saude','secretaria de saúde','farmacia','farmácia','insumos'],
  alugueis:['aluguel','alugueis','aluguéis'],
  mulher:['rede de assistencia','rede de assistência','protecao da mulher','proteção da mulher','mulher','atendimento mulher'],
  agenda_prefeita:['agenda da prefeita','prefeita','compromisso da prefeita','agenda prefeitura']
};
function _modFromName(name){
  const n=String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for(const id of MODULOS){
    const keys=NOME_MODULO[id.id];
    if(keys&&keys.some(k=>n.includes(k))) return id.id;
  }
  return 'atividades';
}

function _myPerms(){ if(!window.S) return {modulos:{}}; if(window.S.isAdmin) return {modulos:{}, all:true}; return window.S.permissoes || {modulos:{}}; }
window.userCan = function(modId, action='acesso'){
  const p = _myPerms();
  if(p.all) return true;
  const m = (p.modulos && p.modulos[modId]) || {};
  if(action==='acesso') return m.acesso === true;
  if(action==='criar') return m.criar === true || m.gerenciar === true;
  if(action==='editar') return m.editar === true || m.gerenciar === true;
  return false;
};

const _md = {
  esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  setC: h => document.getElementById('content').innerHTML = h,
  fmtD: d => { if(!d) return '—'; try { let s=String(d); if(!s.includes('T') && !s.includes(' ')) s+='T00:00'; return new Date(s).toLocaleDateString('pt-BR'); } catch { return String(d); } },
  pColor: p => p===100 ? '#10b981' : p>0 ? '#3b82f6' : '#334155',
  extra: g => { try { const e=g.extra_fields||{}; return typeof e==='string' ? JSON.parse(e) : e; } catch { return {}; } },
  modFor: s => { const e=_md.extra(s); if(e.modulo) return e.modulo; if(s.controle_estoque==1||s.controle_estoque_modelo==1) return 'estoque'; if(s.controle_contas==1) return 'contas'; if(s.controle_distribuicao==1) return 'distribuicao'; return _modFromName(s.name||s.description||''); },
  pct: g => { if(g.controle_pocos==1||g.extra_fields?.controle_pocos==1){const ps=(window.S?.subitems||[]).filter(s=>s.atividade_id===g.id&&(s.registro_tipo==='poco'||s.extra_fields?.registro_tipo==='poco'));return ps.length?Math.round(ps.filter(s=>(s.status_pagamento||s.extra_fields?.status_pagamento)==='pago').length/ps.length*100):0;} const its = (window.S && S.items && S.items.filter(i=>i.atividade_id===g.id)) || []; if(!its.length) return 0; return Math.round(its.filter(i=>i.concluded==1).length / its.length * 100); },
  ativTotal: g => { if(g.controle_pocos==1||g.extra_fields?.controle_pocos==1)return (window.S?.subitems||[]).filter(s=>s.atividade_id===g.id&&(s.registro_tipo==='poco'||s.extra_fields?.registro_tipo==='poco')).length; return ((window.S && S.items && S.items.filter(i=>i.atividade_id===g.id)) || []).length; },
  grupos: mod => (window.S && S.secs || []).filter(s=> _md.modFor(s)===mod.id).sort((a,b)=>(a.order_num||0)-(b.order_num||0))
};

function _mdCard(mod){
  const grupos = _md.grupos(mod);
  const total = grupos.reduce((a,g)=>a+_md.ativTotal(g),0);
  const disabled = !window.userCan(mod.id,'acesso');
  const style = disabled ? 'opacity:.45;pointer-events:none;filter:grayscale(.8)' : 'cursor:pointer';
  return `<div class="activity-card" ${disabled?'':'onclick="window.renderModulo(\''+mod.id+'\')"'} style="border-top:4px solid ${mod.color};${style}">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
      <div style="width:60px;height:60px;border-radius:16px;background:${mod.color}22;display:flex;align-items:center;justify-content:center;font-size:32px">${mod.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="card-title" style="font-size:16px">${_md.esc(mod.label)}</div>
        <div class="card-obs">${_md.esc(mod.desc)}</div>
      </div>
    </div>
    <div class="card-foot">
      <div style="font-size:11px;color:var(--muted);font-weight:600">${grupos.length} grupo(s) · ${total} lançamento(s)</div>
      <div class="card-btns" style="font-size:18px;color:${mod.color}">➡️</div>
    </div>
  </div>`;
}

window.renderModulos = function(){
  const html = MODULOS.filter(m=>window.userCan(m.id,'acesso')).map(_mdCard).join('');
  _md.setC(`<div class="page-title" style="font-size:clamp(20px,3.2vw,34px);font-weight:800;margin-bottom:4px">🏠 Central de Lançamentos</div>
    <div class="page-sub">Escolha abaixo o tipo de controle que deseja acessar</div>
    <div class="cards-grid">${html || '<div class="empty" style="grid-column:1/-1">Nenhum módulo liberado para o seu usuário.</div>'}</div>`);
};

window.renderModulo = function(id){
  const mod = MODULOS.find(x=>x.id===id);
  if(!mod){ toast('Módulo não encontrado','error'); return; }
  if(!window.userCan(id,'acesso')){ toast('Acesso negado a este módulo','error'); return; }
  renderModuloGrupos(mod);
};

function renderModuloGrupos(mod){
  const grupos = _md.grupos(mod);
  const title = `${mod.icon} ${mod.label}`;
  const podeCriar = window.userCan(mod.id,'criar');
  const podeEditar = window.userCan(mod.id,'editar');
  const admin = window.S && S.isAdmin;
  const pode = admin || podeEditar;
  const novo = admin || podeCriar ? `<button class="btn-action primary" onclick="window.criarGrupoModulo('${mod.id}')">+ Novo Grupo</button>` : '';
  const mass = pode ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-left:auto"><label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" id="ce-sel-all" onchange="window._ceToggleAllGrupos(this.checked)"> Selecionar todos</label><button class="btn-action" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="window._ceExcluirSelecionados('${mod.id}')">🗑️ Excluir selecionados</button></div>` : '';
  const cards = grupos.map(g=>{
    const p=_md.pct(g), col=_md.pColor(p);
    return `<div class="activity-card" style="border-top:4px solid ${mod.color};cursor:pointer;position:relative" data-gid="${_md.esc(g.id)}">
      <input type="checkbox" class="cb-grupo" value="${_md.esc(g.id)}" style="position:absolute;top:10px;right:10px;width:18px;height:18px;cursor:pointer;z-index:2" onchange="event.stopPropagation()" onclick="event.stopPropagation()">
      <div onclick="window.openActivity('${_md.esc(g.id)}')">
      ${g.cover_url?`<img class="card-thumb" src="${_md.esc(g.cover_url)}" loading="lazy" alt="">`:`<div class="card-thumb-ph"><img src="img/logo_sertania.png" style="width:64px;height:64px;object-fit:contain;opacity:.7"></div>`}
      <div class="card-title">${_md.esc(g.name||'Sem nome')}</div>
      ${g.observacoes?`<div class="card-obs">${_md.esc(g.observacoes)}</div>`:''}
      <div class="card-foot">
        <div style="flex:1"><div style="font-size:11px;color:${col};font-weight:700;margin-bottom:3px">${p}% ${(g.controle_pocos==1||g.extra_fields?.controle_pocos==1)?'pagos':'concluído'}</div><div class="prog-bar"><div class="prog-fill" style="width:${p}%;background:${col}"></div></div></div>
        <div class="card-btns">
          ${(admin||podeEditar)?`<button class="card-btn" onclick="event.stopPropagation();window.openSecModal('${_md.esc(g.id)}')">✏️</button>`:''}
          <button class="card-btn" onclick="event.stopPropagation();${(g.controle_pocos==1||g.extra_fields?.controle_pocos==1)?`window.gerarPdfPocos('${_md.esc(g.id)}')`:`window.gerarPdf('${_md.esc(g.id)}')`}">📄</button>
        </div>
      </div>
      </div>
    </div>`;
  }).join('') || `<div class="empty" style="grid-column:1/-1">Nenhum grupo de <strong>${_md.esc(mod.label)}</strong> cadastrado ainda.<br>Clique em <strong>+ Novo Grupo</strong> para começar.</div>`;
  _md.setC(`<div class="page-title">${title}</div>
    <div class="page-sub">${_md.esc(mod.desc)}</div>
    <div style="margin-bottom:18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      ${novo}
      <button class="btn-action" onclick="window.setView('mod')">← Voltar ao início</button>
      <button class="btn-action" onclick="window.gerarRelatorioModulo('${mod.id}')">📄 PDF do módulo</button>
      ${mass}
    </div>
    <div class="cards-grid">${cards}</div>`);
}

window._ceToggleAllGrupos=function(checked){
  document.querySelectorAll('.cb-grupo').forEach(cb=>cb.checked=checked);
};

window._ceExcluirSelecionados=async function(modId){
  const ids=[...document.querySelectorAll('.cb-grupo:checked')].map(cb=>cb.value);
  if(!ids.length){toast('Selecione ao menos um grupo','error'); return;}
  const nomes=ids.map(id=>_md.esc(S.secs.find(s=>s.id===id)?.name||'Grupo')).slice(0,20).join('\n');
  const mais=ids.length>20?`\n... e mais ${ids.length-20}`:'';
  if(!confirm(`Excluir ${ids.length} grupo(s) deste módulo?\n\n${nomes}${mais}\n\nAtenção: todos os itens, sub-itens e lançamentos vinculados também serão excluídos. Esta ação não pode ser desfeita.`)) return;
  for(const id of ids){
    const its=S.items.filter(i=>i.atividade_id===id);
    for(const it of its){const sbs=S.subitems.filter(s=>s.item_id===it.id);for(const sb of sbs)await window.wDeleteDoc(doc(db,'subitems',sb.id),{...sb},'Excluir sub-item');const orig=S.items.find(i=>i.id===it.id);if(orig)await window.wDeleteDoc(doc(db,'items',it.id),{...orig},'Excluir item');}
    const fts=S.fieldTemplates.filter(t=>t.atividade_id===id);for(const ft of fts)await window.wDeleteDoc(doc(db,'fieldTemplates',ft.id),{...ft},'Excluir campo');
    const estqs=S.estoque.filter(e=>e.atividade_id===id);for(const e of estqs)await window.wDeleteDoc(doc(db,'estoque',e.id),{...e},'Excluir lançamento');
    const reqs=S.requisicoes.filter(r=>r.atividade_id===id);for(const r of reqs)await window.wDeleteDoc(doc(db,'requisicoes',r.id),{...r},'Excluir requisição');
    const contas=S.contas.filter(c=>c.atividade_id===id);for(const c of contas)await window.wDeleteDoc(doc(db,'contas',c.id),{...c},'Excluir conta');
    const distrs=(S.distribuicao||[]).filter(d=>d.atividade_id===id);for(const d of distrs)await window.wDeleteDoc(doc(db,'distribuicao',d.id),{...d},'Excluir distribuição');
    const sec=S.secs.find(s=>s.id===id); if(sec) await window.wDeleteDoc(doc(db,'secretariats',id),{...sec},'Excluir grupo');
  }
  await loadData();
  toast(ids.length+' grupo(s) excluído(s)!','success');
  window.renderModulo(modId);
};

window.criarGrupoModulo = async function(modId){
  const mod = MODULOS.find(x=>x.id===modId); if(!mod) return;
  if(!window.userCan(modId,'criar')){ toast('Sem permissão para criar neste módulo','error'); return; }
  const base = {
    name: `Novo ${mod.label}`,
    description: mod.desc,
    observacoes: '',
    responsaveis: '',
    start_date: null,
    end_date: null,
    order_num: (window.S && S.secs && S.secs.length) || 0,
    controle_pendencias: 0,
    controle_contas: 0,
    controle_distribuicao: 0,
    show_stats:0, show_verba:0, verba_on_subitems:0, verba_sum_subitems:0, verba_has_obs:0,
    show_origem_verba:0, origem_verba_on_subitems:0, origem_verba_has_obs:0,
    show_documentacao:0, documentacao_on_subitems:0, documentacao_has_obs:0,
    show_licitacao:0, licitacao_on_subitems:0, licitacao_has_obs:0,
    extra_fields: {modulo: mod.modulo || mod.id},
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  };
  if(mod.flag) base[mod.flag] = 1;
  try{
    const ref = await addDoc(collection(db,'secretariats'), base);
    await loadData();
    window.renderModulo(modId);
    window.openSecModal(ref.id);
  }catch(e){
    console.error(e);
    toast('Erro ao criar grupo','error');
  }
};

window.gerarRelatorioModulo = async function(modId){
  const mod = MODULOS.find(x=>x.id===modId); if(!mod){ toast('Módulo não encontrado','error'); return; }
  if(!window.jspdf || !window.jspdf.jsPDF){ toast('jsPDF não carregado','error'); return; }
  toast('Gerando PDF do módulo…','info',8000);
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  const W = 210, mx = 14;
  const now = new Date().toLocaleString('pt-BR');
  doc.setFillColor(15,23,42); doc.rect(0,0,W,30,'F');
  doc.setTextColor(226,232,240); doc.setFontSize(18); doc.text(`${mod.icon} ${mod.label}`, mx, 18);
  doc.setTextColor(148,163,184); doc.setFontSize(10); doc.text(`Prefeitura de Sertania - PE • ${now}`, mx, 25);
  let y = 38;
  const grupos = _md.grupos(mod);
  for(const g of grupos){
    if(y > 260){ doc.addPage(); y = 20; }
    doc.setTextColor(226,232,240); doc.setFontSize(13); doc.text(_md.esc(g.name||'Sem nome'), mx, y); y += 7;
    const items = ((window.S && S.items) || []).filter(i=>i.atividade_id===g.id).sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    if(items.length){
      const rows = items.map((it, idx)=>{
        const subs = ((window.S && S.subitems) || []).filter(s=>s.item_id===it.id && s.parent_type!=='subitem');
        const done = subs.length ? subs.every(s=>s.concluded==1) : it.concluded==1;
        return [String(idx+1), _md.esc(it.description||''), done ? 'Concluído' : 'Pendente', _md.fmtD(it.deadline_date)];
      });
      doc.autoTable({startY:y, head:[['#','Descrição','Situação','Prazo']], body:rows,
        margin:{left:mx, right:mx}, styles:{fontSize:9, textColor:226232240, fillColor:[15,23,42]},
        headStyles:{fillColor:[59,130,246], textColor:255}, theme:'grid'});
      y = doc.lastAutoTable.finalY + 10;
    } else {
      doc.setTextColor(100,116,139); doc.setFontSize(9); doc.text('Nenhum lançamento neste grupo.', mx, y); y += 8;
    }
  }
  if(!grupos.length){
    doc.setTextColor(100,116,139); doc.setFontSize(11); doc.text('Nenhum grupo cadastrado neste módulo.', mx, y);
  }
  doc.save(`relatorio-${mod.id}-${new Date().toISOString().slice(0,10)}.pdf`);
  toast('PDF do módulo gerado!','success');
};

/* Relatório institucional padronizado pelo modelo de Perfuração de Poços. */
window.gerarRelatorioModulo = async function(modId){
  const mod=MODULOS.find(x=>x.id===modId);
  if(!mod){toast('Módulo não encontrado','error');return;}
  if(!window.jspdf?.jsPDF){toast('jsPDF não carregado','error');return;}
  toast('Gerando relatório institucional…','info',8000);
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210,H=297,mx=14;
  let logo=null;
  try{logo=await window.loadB64?.('img/logo_sertania.png','png',120);}catch(e){}
  const header=()=>{
    doc.setFillColor(247,250,248);doc.rect(0,0,W,31,'F');
    doc.setFillColor(33,135,82);doc.rect(0,0,4,31,'F');
    doc.setDrawColor(121,184,65);doc.setLineWidth(.7);doc.line(0,31,W,31);
    if(logo?.d)doc.addImage(logo.d,'PNG',W-30,5,16,20,undefined,'FAST');
    doc.setTextColor(15,53,43);doc.setFont('helvetica','bold');doc.setFontSize(16);
    doc.text(`RELATÓRIO - ${String(mod.label).toUpperCase()}`,mx,14);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(78,105,96);
    doc.text(`Prefeitura Municipal de Sertânia - Emitido em ${new Date().toLocaleString('pt-BR')}`,mx,21);
  };
  const footer=()=>{
    const pg=doc.internal.getCurrentPageInfo().pageNumber;
    doc.setFillColor(12,61,49);doc.rect(0,H-13,W,13,'F');
    doc.setTextColor(225,242,234);doc.setFontSize(7);doc.setFont('helvetica','bold');
    doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA - GESTÃO DE ATIVIDADES',mx,H-5);
    doc.text(`Página ${pg}`,W-mx,H-5,{align:'right'});
  };
  header();
  let y=40;
  const grupos=_md.grupos(mod);
  for(const g of grupos){
    if(y>253){footer();doc.addPage();header();y=40;}
    doc.setFillColor(231,244,235);doc.roundedRect(mx,y-5,W-mx*2,9,1.5,1.5,'F');
    doc.setTextColor(24,98,61);doc.setFont('helvetica','bold');doc.setFontSize(10);
    doc.text(String(g.name||'Sem nome'),mx+3,y+1);y+=8;
    const items=((window.S&&S.items)||[]).filter(i=>i.atividade_id===g.id).sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    if(items.length){
      const rows=items.map((it,idx)=>{
        const subs=((window.S&&S.subitems)||[]).filter(s=>s.item_id===it.id&&s.parent_type!=='subitem');
        const done=subs.length?subs.every(s=>s.concluded==1):it.concluded==1;
        return[String(idx+1),String(it.description||''),done?'Concluído':'Em andamento',_md.fmtD(it.deadline_date)];
      });
      doc.autoTable({startY:y,head:[['#','Descrição','Situação','Prazo']],body:rows,
        margin:{left:mx,right:mx,top:38,bottom:20},theme:'grid',
        styles:{fontSize:8,textColor:[33,52,63],lineColor:[218,228,224],lineWidth:.2,cellPadding:2.2},
        headStyles:{fillColor:[22,104,70],textColor:[255,255,255],fontStyle:'bold'},
        alternateRowStyles:{fillColor:[247,250,248]},
        didDrawPage:()=>{if(doc.internal.getCurrentPageInfo().pageNumber>1)header();}});
      y=doc.lastAutoTable.finalY+10;
    }else{
      doc.setTextColor(104,122,115);doc.setFontSize(8);
      doc.text('Nenhum lançamento neste grupo.',mx,y);y+=8;
    }
  }
  if(!grupos.length){doc.setTextColor(104,122,115);doc.text('Nenhum grupo cadastrado neste módulo.',mx,y);}
  const pages=doc.internal.getNumberOfPages();
  for(let p=1;p<=pages;p++){doc.setPage(p);footer();}
  doc.save(`RELATORIO-${String(mod.id).toUpperCase()}-${new Date().toISOString().slice(0,10)}.pdf`);
  toast('PDF do módulo gerado!','success');
};

window.modForSec = s => _md.modFor(s);

/* ── PAINEL INSTITUCIONAL 2026 ────────────────────────────────────────────
   A navegação foi reorganizada sem alterar as rotinas ou os dados dos módulos. */
function _visibleModules(){
  return MODULOS.filter(m=>window.userCan(m.id,'acesso'));
}

function _moduleNumbers(mod){
  const grupos=_md.grupos(mod);
  return{
    grupos,
    total:grupos.reduce((sum,g)=>sum+_md.ativTotal(g),0)
  };
}

function _renderSidebarModules(activeId=''){
  const host=document.getElementById('sidebar-modules');
  if(!host)return;
  host.innerHTML=_visibleModules().map(mod=>{
    const numbers=_moduleNumbers(mod);
    return `<button type="button" class="sidebar-module-btn ${activeId===mod.id?'active':''}" onclick="window.renderModulo('${mod.id}')" title="${_md.esc(mod.label)}" style="--module-soft:${mod.color}28;--module-color:${mod.color}">
      <span class="sidebar-module-icon">${mod.icon}</span>
      <span class="sidebar-module-label">${_md.esc(mod.label)}</span>
      <span class="sidebar-module-count">${numbers.grupos.length}</span>
    </button>`;
  }).join('');
}
window.refreshSidebarModules=_renderSidebarModules;

window.renderModulos=function(){
  const mods=_visibleModules();
  const numbers=mods.map(mod=>({mod,..._moduleNumbers(mod)}));
  const totalGroups=numbers.reduce((sum,item)=>sum+item.grupos.length,0);
  const totalEntries=numbers.reduce((sum,item)=>sum+item.total,0);
  _renderSidebarModules('');
  const directory=numbers.map(({mod,grupos,total})=>`<button type="button" class="module-row" onclick="window.renderModulo('${mod.id}')" style="--module-soft:${mod.color}18;--module-color:${mod.color}">
    <span class="module-row-icon">${mod.icon}</span>
    <span class="module-row-copy">
      <span class="module-row-title">${_md.esc(mod.label)}</span>
      <span class="module-row-meta">${grupos.length} grupo(s) · ${total} lançamento(s)</span>
    </span>
    <span class="module-row-action" aria-hidden="true">›</span>
  </button>`).join('');
  _md.setC(`<section class="home-shell" aria-labelledby="home-title">
    <div class="home-hero">
      <div>
        <div class="workspace-kicker">Central integrada</div>
        <h1 class="home-title" id="home-title">Gestão municipal em um só lugar</h1>
        <p class="home-copy">Acesse as áreas operacionais, acompanhe os registros e mantenha as informações da Prefeitura organizadas com rapidez.</p>
      </div>
      <div class="home-totals" aria-label="Resumo geral">
        <div class="home-total"><strong>${totalGroups}</strong><span>Grupos ativos</span></div>
        <div class="home-total"><strong>${totalEntries}</strong><span>Lançamentos</span></div>
      </div>
    </div>
    <div class="home-directory">
      <div class="home-directory-head"><h2>Áreas de trabalho</h2><span>${mods.length} áreas disponíveis para o seu perfil</span></div>
      <div class="module-directory">${directory||'<div class="empty">Nenhuma área liberada para o seu usuário.</div>'}</div>
    </div>
  </section>`);
};

/* Painel executivo V62: usa somente os dados já carregados. */
window.renderModulos=function(){
  const mods=_visibleModules();
  const numbers=mods.map(mod=>({mod,..._moduleNumbers(mod)}));
  const totalGroups=numbers.reduce((sum,item)=>sum+item.grupos.length,0);
  const totalEntries=numbers.reduce((sum,item)=>sum+item.total,0);
  const allowedGroups=new Set(numbers.flatMap(n=>n.grupos.map(g=>g.id)));
  const allItems=((window.S&&S.items)||[]).filter(item=>allowedGroups.has(item.atividade_id));
  const completed=allItems.filter(item=>item.concluded==1).length;
  const pending=Math.max(0,allItems.length-completed);
  const progress=allItems.length?Math.round(completed*100/allItems.length):0;
  const maxTotal=Math.max(1,...numbers.map(n=>n.total));
  const ranked=[...numbers].sort((a,b)=>b.total-a.total);
  _renderSidebarModules('');
  const bars=ranked.slice(0,7).map(({mod,total})=>`
    <button class="dashboard-bar-row" onclick="window.renderModulo('${mod.id}')">
      <span class="dashboard-bar-label">${mod.icon} ${_md.esc(mod.label)}</span>
      <span class="dashboard-bar-track"><i style="width:${Math.max(total?8:0,Math.round(total*100/maxTotal))}%;--bar:${mod.color}"></i></span>
      <strong>${total}</strong>
    </button>`).join('');
  const quick=ranked.slice(0,4).map(({mod,grupos,total})=>`
    <button class="dashboard-quick-card" onclick="window.renderModulo('${mod.id}')" style="--quick:${mod.color}">
      <span>${mod.icon}</span><div><strong>${_md.esc(mod.label)}</strong><small>${grupos.length} grupos · ${total} lançamentos</small></div><b>›</b>
    </button>`).join('');
  const directory=numbers.map(({mod,grupos,total})=>`
    <button type="button" class="dashboard-area-card" onclick="window.renderModulo('${mod.id}')" style="--area:${mod.color}">
      <span class="dashboard-area-icon">${mod.icon}</span><span><strong>${_md.esc(mod.label)}</strong><small>${grupos.length} grupos cadastrados</small></span><b>${total}</b>
    </button>`).join('');
  const stamp=x=>{const v=x.g.updated_at||x.g.created_at;return Number(v?.seconds||v?._seconds||Date.parse(v||0)||0);};
  const recent=numbers.flatMap(({mod,grupos})=>grupos.map(g=>({mod,g}))).sort((a,b)=>stamp(b)-stamp(a)).slice(0,5).map(({mod,g})=>`
    <button class="dashboard-recent-row" onclick="openActivity('${g.id}')"><span style="--recent:${mod.color}">${mod.icon}</span><div><strong>${_md.esc(g.name||'Grupo sem nome')}</strong><small>${_md.esc(mod.label)} · ${_md.ativTotal(g)} lançamentos</small></div><b>›</b></button>`).join('');
  _md.setC(`<section class="dashboard-shell" aria-labelledby="dashboard-title">
    <header class="dashboard-heading"><div><div class="workspace-kicker">Visão geral</div><h1 id="dashboard-title">Painel de Gestão</h1><p>Acompanhamento integrado das atividades municipais.</p></div><div class="dashboard-date">Atualizado em <strong>${new Date().toLocaleDateString('pt-BR')}</strong></div></header>
    <section class="dashboard-banner"><div><span class="dashboard-banner-mark">PMS</span><div><strong>Bem-vindo à Central de Gestão</strong><p>Indicadores reais e acesso rápido a todas as áreas operacionais.</p></div></div><button onclick="document.querySelector('.dashboard-areas')?.scrollIntoView({behavior:'smooth'})">Explorar áreas ↓</button></section>
    <div class="dashboard-kpis">
      <article><span class="kpi-icon blue">▦</span><div><small>Áreas operacionais</small><strong>${mods.length}</strong><em>disponíveis</em></div></article>
      <article><span class="kpi-icon green">✓</span><div><small>Concluídos</small><strong>${completed}</strong><em>${progress}% dos lançamentos</em></div></article>
      <article><span class="kpi-icon amber">◷</span><div><small>Em andamento</small><strong>${pending}</strong><em>requerem acompanhamento</em></div></article>
      <article><span class="kpi-icon violet">◎</span><div><small>Total registrado</small><strong>${totalEntries}</strong><em>em ${totalGroups} grupos</em></div></article>
    </div>
    <div class="dashboard-main-grid">
      <article class="dashboard-panel dashboard-chart"><header><div><h2>Atividades por área</h2><p>Volume de lançamentos cadastrados</p></div></header><div>${bars||'<p class="empty">Nenhum lançamento disponível.</p>'}</div></article>
      <article class="dashboard-panel dashboard-progress"><header><div><h2>Progresso geral</h2><p>Conclusão dos registros</p></div></header><div class="dashboard-donut" style="--progress:${progress*3.6}deg"><div><strong>${progress}%</strong><span>concluído</span></div></div><div class="dashboard-legend"><span><i class="done"></i> ${completed} concluídos</span><span><i></i> ${pending} em andamento</span></div></article>
      <article class="dashboard-panel dashboard-shortcuts"><header><div><h2>Acessos rápidos</h2><p>Rotinas administrativas</p></div></header><button onclick="setView('secr')">▦ <span><strong>Secretarias</strong><small>Estrutura municipal</small></span>›</button><button onclick="setView('resp')">♟ <span><strong>Responsáveis</strong><small>Agentes cadastrados</small></span>›</button><button onclick="setView('cont')">☏ <span><strong>Contatos</strong><small>Agenda institucional</small></span>›</button></article>
    </div>
    <div class="dashboard-lower-grid"><article class="dashboard-panel"><header><div><h2>Áreas mais movimentadas</h2><p>Acesso direto às maiores bases</p></div></header><div class="dashboard-quick-grid">${quick||'<p class="empty">Nenhuma área disponível.</p>'}</div></article><article class="dashboard-panel"><header><div><h2>Grupos recentes</h2><p>Continue de onde parou</p></div></header><div>${recent||'<p class="empty">Nenhum grupo cadastrado.</p>'}</div></article></div>
    <article class="dashboard-panel dashboard-areas"><header><div><h2>Todas as áreas operacionais</h2><p>${mods.length} áreas disponíveis para o seu perfil</p></div></header><div class="dashboard-area-grid">${directory||'<p class="empty">Nenhuma área liberada.</p>'}</div></article>
  </section>`);
};

const _renderModuloBeforeRedesign=window.renderModulo;
window.renderModulo=function(id){
  _renderSidebarModules(id);
  document.querySelectorAll('#navmenu > .nav-btn').forEach(btn=>btn.classList.remove('active'));
  return _renderModuloBeforeRedesign(id);
};
