import './perfuracao-pocos.js?v=3';

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
    controle_pendencias: 1,
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

window.modForSec = s => _md.modFor(s);
