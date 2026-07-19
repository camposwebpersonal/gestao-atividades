/* ── SISTEMA MODULAR DE LANÇAMENTOS ── */
const MODULOS = [
  {id:'atividades', label:'Atividades', desc:'Controle de atividades, pendências e prazos da prefeitura.', icon:'📅', color:'#3b82f6', isAtividades:true},
  {id:'contas', label:'Controle de Contas', desc:'Água, luz, telefone, internet e demais contas.', icon:'💰', color:'#10b981', flag:'controle_contas'},
  {id:'alugueis', label:'Controle de Aluguéis', desc:'Imóveis, equipamentos, veículos alugados e contratos.', icon:'🏠', color:'#8b5cf6', modulo:'alugueis'},
  {id:'projetos', label:'Controle de Projetos', desc:'Projetos que a Prefeitura está trabalhando atualmente.', icon:'🚀', color:'#f59e0b', modulo:'projetos'},
  {id:'rh', label:'Controle de RH', desc:'BCC, efetivos, comissionados e folha de salários.', icon:'👥', color:'#ec4899', modulo:'rh'},
  {id:'cadastros', label:'Listas de Cadastros', desc:'Veículos, associações, líderes e cadastros diversos.', icon:'📋', color:'#06b6d4', modulo:'cadastros'},
  {id:'distribuicao', label:'Controle de Distribuição', desc:'Distribuição de leite, cestas e benefícios.', icon:'🚚', color:'#14b8a6', flag:'controle_distribuicao'}
];
window.MODULOS = MODULOS;

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
  pct: g => { const its = (window.S && S.items && S.items.filter(i=>i.atividade_id===g.id)) || []; if(!its.length) return 0; return Math.round(its.filter(i=>i.concluded==1).length / its.length * 100); },
  ativTotal: g => { return ((window.S && S.items && S.items.filter(i=>i.atividade_id===g.id)) || []).length; },
  grupos: mod => (window.S && S.secs || []).filter(s=>{
    if(mod.flag) return s[mod.flag]==1;
    if(mod.isAtividades) return !s.controle_contas && !s.controle_distribuicao && !_md.extra(s).modulo;
    return _md.extra(s).modulo === mod.modulo;
  }).sort((a,b)=>(a.order_num||0)-(b.order_num||0))
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
  const novo = (window.S && S.isAdmin) || podeCriar ? `<button class="btn-action primary" onclick="window.criarGrupoModulo('${mod.id}')">+ Novo Grupo</button>` : '';
  const cards = grupos.map(g=>{
    const p=_md.pct(g), col=_md.pColor(p);
    return `<div class="activity-card" onclick="window.openActivity('${g.id}')" style="border-top:4px solid ${mod.color};cursor:pointer">
      ${g.cover_url?`<img class="card-thumb" src="${_md.esc(g.cover_url)}" loading="lazy" alt="">`:`<div class="card-thumb-ph"><img src="img/logo_sertania.png" style="width:64px;height:64px;object-fit:contain;opacity:.7"></div>`}
      <div class="card-title">${_md.esc(g.name||'Sem nome')}</div>
      ${g.observacoes?`<div class="card-obs">${_md.esc(g.observacoes)}</div>`:''}
      <div class="card-foot">
        <div style="flex:1"><div style="font-size:11px;color:${col};font-weight:700;margin-bottom:3px">${p}% concluído</div><div class="prog-bar"><div class="prog-fill" style="width:${p}%;background:${col}"></div></div></div>
        <div class="card-btns">
          ${((window.S&&S.isAdmin)||podeEditar)?`<button class="card-btn" onclick="event.stopPropagation();window.openSecModal('${g.id}')">✏️</button>`:''}
          <button class="card-btn" onclick="event.stopPropagation();window.gerarPdf('${g.id}')">📄</button>
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
    </div>
    <div class="cards-grid">${cards}</div>`);
}

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
