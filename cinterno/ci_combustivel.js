// ─── COMBUSTÍVEL Module ───────────────────────────────────────────────────────

const combState = {
  orgaos: [],
  veiculos: [],
  registros: [],
  mesFilter: '',
  loaded: false
};

const combRelState = {
  mes: '',
  registros: [],
  orgaosOn: {},
  placasOn: {},
  loaded: false
};

function combFmt$(v) {
  return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function combFmtN(v, dec) {
  dec = (dec !== undefined) ? dec : 3;
  return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
}
function combMesLabel(ym) {
  if (!ym) return '';
  const [y,m] = ym.split('-');
  return new Date(+y, +m-1, 1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
}
function combMesOpts(cur, includeAll) {
  const now = new Date();
  let html = includeAll ? `<option value="" ${!cur?'selected':''}>Todos os meses</option>` : '';
  for (let i = 0; i < 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    html += `<option value="${v}" ${v===cur?'selected':''}>${combMesLabel(v)}</option>`;
  }
  return html;
}
function combEfetivo(r) {
  const calc = (+r.litros||0) * (+r.valor_litro||0);
  return (r.total_manual !== null && r.total_manual !== '' && r.total_manual !== undefined)
    ? +r.total_manual : calc;
}
function combFmtDate(s) {
  if (!s) return '\u2014';
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');
}

async function combLoad(forceReload) {
  if (combState.loaded && !forceReload) return;
  const now = new Date();
  if (!combState.mesFilter) combState.mesFilter = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const [orgRes, veicRes, regRes] = await Promise.all([
    fetch('api.php?action=contratados_orgaos').then(r=>r.json()),
    fetch('api.php?action=comb_veiculos_list').then(r=>r.json()),
    fetch(`api.php?action=comb_list&mes=${combState.mesFilter}`).then(r=>r.json())
  ]);
  combState.orgaos    = Array.isArray(orgRes)  ? orgRes  : (orgRes.data  || []);
  combState.veiculos  = Array.isArray(veicRes) ? veicRes : (veicRes.data || []);
  combState.registros = Array.isArray(regRes)  ? regRes  : (regRes.data  || []);
  combState.loaded = true;
}

async function combRelLoad() {
  const now = new Date();
  if (!combRelState.mes) combRelState.mes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const qs = combRelState.mes ? `&mes=${combRelState.mes}` : '';
  const [orgRes, veicRes, regRes] = await Promise.all([
    fetch('api.php?action=contratados_orgaos').then(r=>r.json()),
    fetch('api.php?action=comb_veiculos_list').then(r=>r.json()),
    fetch(`api.php?action=comb_list${qs}`).then(r=>r.json())
  ]);
  combState.orgaos   = Array.isArray(orgRes)  ? orgRes  : (orgRes.data  || []);
  combState.veiculos = Array.isArray(veicRes) ? veicRes : (veicRes.data || []);
  combRelState.registros = Array.isArray(regRes) ? regRes : (regRes.data || []);
  combRelState.orgaosOn = {};
  combRelState.placasOn = {};
  combRelState.registros.forEach(r => {
    const oKey = r.orgao_id ? String(r.orgao_id) : '0';
    combRelState.orgaosOn[oKey] = true;
    if (r.placa) combRelState.placasOn[r.placa] = true;
  });
  combRelState.loaded = true;
}

// ── Abastecimentos list ───────────────────────────────────────
async function renderCombList() {
  document.getElementById('content').innerHTML = '<div class="loading">Carregando\u2026</div>';
  await combLoad();

  const orgaoMap = {};
  combState.orgaos.forEach(o => orgaoMap[String(o.id)] = o.nome);

  const byOrgao = {};
  combState.registros.forEach(r => {
    const key = r.orgao_id ? String(r.orgao_id) : '0';
    if (!byOrgao[key]) byOrgao[key] = [];
    byOrgao[key].push(r);
  });

  const totalLit = combState.registros.reduce((a,r)=>a+(+r.litros||0),0);
  const totalVal = combState.registros.reduce((a,r)=>a+combEfetivo(r),0);

  let html = `<div style="padding:24px 20px;max-width:1200px;margin:0 auto">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="font-size:20px;font-weight:800;margin:0">\u26fd Controle de Combust\u00edvel</h2>
        <div style="color:var(--muted);font-size:12px;margin-top:4px">${combMesLabel(combState.mesFilter)} \u00b7 ${combState.registros.length} abastecimento(s)</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select class="search-box" style="width:200px" onchange="combChangeMes(this.value)">
          ${combMesOpts(combState.mesFilter, false)}
        </select>
        <button class="btn-primary" onclick="openCombModal(0)">+ Novo Abastecimento</button>
        <button class="btn-secondary" onclick="ciGoSectionPage('comb-veiculos')">\ud83d\ude97 Ve\u00edculos</button>
        <button class="btn-secondary" onclick="ciGoSectionPage('comb-rel')">\ud83d\udcca Relat\u00f3rio</button>
      </div>
    </div>
    <div class="orc-sum-row" style="margin-bottom:20px">
      <div class="orc-sum-card"><div class="osc-icon">\u26fd</div><div class="osc-val">${combState.registros.length}</div><div class="osc-lbl">Abastecimentos</div></div>
      <div class="orc-sum-card"><div class="osc-icon">\ud83d\udee2\ufe0f</div><div class="osc-val">${combFmtN(totalLit)} L</div><div class="osc-lbl">Total de Litros</div></div>
      <div class="orc-sum-card"><div class="osc-icon">\ud83d\udcb0</div><div class="osc-val" style="color:#10B981">${combFmt$(totalVal)}</div><div class="osc-lbl">Total Gasto</div></div>
    </div>`;

  if (!combState.registros.length) {
    html += `<div style="text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:44px;margin-bottom:12px">\u26fd</div>
      <div style="font-size:15px">Nenhum abastecimento em ${combMesLabel(combState.mesFilter)}</div>
      <button class="btn-primary" style="margin-top:16px" onclick="openCombModal(0)">+ Registrar Abastecimento</button>
    </div>`;
  } else {
    Object.keys(byOrgao).sort((a,b) => {
      if (a==='0') return 1; if (b==='0') return -1;
      return (orgaoMap[a]||'').localeCompare(orgaoMap[b]||'','pt-BR');
    }).forEach(oId => {
      const regs = byOrgao[oId];
      const orgNome = oId==='0' ? 'Sem \u00d3rg\u00e3o' : (orgaoMap[oId] || `\u00d3rg\u00e3o #${oId}`);
      const subLit = regs.reduce((a,r)=>a+(+r.litros||0),0);
      const subVal = regs.reduce((a,r)=>a+combEfetivo(r),0);
      html += `<div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--bg-secondary);border-radius:8px 8px 0 0;border-bottom:2px solid var(--primary)">
          <h3 style="font-size:14px;font-weight:700;color:var(--primary);margin:0">\ud83c\udfe2 ${escHtml(orgNome)}</h3>
          <span style="font-size:12px;color:var(--muted)">${combFmtN(subLit)} L \u00b7 ${combFmt$(subVal)}</span>
        </div>
        <div style="overflow-x:auto;border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:var(--bg-secondary)">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700">Data</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700">Placa / Ve\u00edculo</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;font-weight:700">KM</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;font-weight:700">Litros</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;font-weight:700">R$/L</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;font-weight:700">Total Calc.</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;font-weight:700">Total Efetivo</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;font-weight:700">A\u00e7\u00f5es</th>
          </tr></thead>
          <tbody>
          ${regs.map(r => {
            const calc = (+r.litros||0)*(+r.valor_litro||0);
            const efet = combEfetivo(r);
            const hasM = r.total_manual !== null && r.total_manual !== '' && r.total_manual !== undefined && Math.abs(+r.total_manual - calc) > 0.005;
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px 12px">${combFmtDate(r.data_abastecimento)}</td>
              <td style="padding:8px 12px">
                <span style="font-weight:700;letter-spacing:.5px">${escHtml(r.placa||'\u2014')}</span>
                ${r.descricao_veiculo ? `<div style="font-size:11px;color:var(--muted)">${escHtml(r.descricao_veiculo)}</div>` : ''}
              </td>
              <td style="padding:8px 12px;text-align:right">${r.km ? combFmtN(r.km,0)+' km' : '\u2014'}</td>
              <td style="padding:8px 12px;text-align:right">${combFmtN(r.litros)} L</td>
              <td style="padding:8px 12px;text-align:right">${combFmt$(r.valor_litro)}</td>
              <td style="padding:8px 12px;text-align:right;color:var(--muted)">${combFmt$(calc)}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:${hasM?'#F59E0B':'#10B981'}">
                ${combFmt$(efet)}${hasM ? ' <span title="Valor manual" style="font-size:11px">\u270f\ufe0f</span>' : ''}
              </td>
              <td style="padding:8px 12px;text-align:center;white-space:nowrap">
                <button onclick="openCombModal(${r.id})" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--text)">\u270f\ufe0f</button>
                <button onclick="deleteComb(${r.id})" style="background:none;border:1px solid #EF444444;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:#EF4444;margin-left:4px">\ud83d\uddd1\ufe0f</button>
              </td>
            </tr>`;
          }).join('')}
          </tbody>
          <tfoot><tr style="background:var(--bg-secondary);font-weight:700">
            <td colspan="3" style="padding:8px 12px;font-size:12px">Subtotal ${escHtml(orgNome)}</td>
            <td style="padding:8px 12px;text-align:right">${combFmtN(subLit)} L</td>
            <td></td><td></td>
            <td style="padding:8px 12px;text-align:right;color:#10B981">${combFmt$(subVal)}</td>
            <td></td>
          </tr></tfoot>
        </table></div></div>`;
    });
  }
  html += `</div>`;
  document.getElementById('content').innerHTML = html;
}

async function combChangeMes(val) {
  combState.mesFilter = val;
  combState.loaded = false;
  renderCombList();
}

// ── Vehicles ──────────────────────────────────────────────────
async function renderCombVeiculos() {
  if (!combState.loaded) await combLoad();
  const rows = combState.veiculos.length
    ? combState.veiculos.map(v => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px;font-weight:700;letter-spacing:.5px">${escHtml(v.placa)}</td>
        <td style="padding:10px 12px">${escHtml(v.descricao||'\u2014')}</td>
        <td style="padding:10px 12px">${escHtml(v.orgao_nome||'Sem \u00f3rg\u00e3o')}</td>
        <td style="padding:10px 12px;text-align:center;white-space:nowrap">
          <button onclick="openVeiculoModal(${v.id})" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:var(--text)">\u270f\ufe0f Editar</button>
          <button onclick="deleteVeiculo(${v.id})" style="background:none;border:1px solid #EF444444;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:#EF4444;margin-left:4px">\ud83d\uddd1\ufe0f</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="padding:40px;text-align:center;color:var(--muted)">Nenhum ve\u00edculo cadastrado ainda</td></tr>`;

  document.getElementById('content').innerHTML = `
  <div style="padding:24px 20px;max-width:900px;margin:0 auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <h2 style="font-size:20px;font-weight:800;margin:0">\ud83d\ude97 Ve\u00edculos Cadastrados</h2>
        <div style="color:var(--muted);font-size:12px;margin-top:4px">${combState.veiculos.length} ve\u00edculo(s)</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="openVeiculoModal(0)">+ Novo Ve\u00edculo</button>
        <button class="btn-secondary" onclick="ciGoSectionPage('comb-list')">\u26fd Abastecimentos</button>
      </div>
    </div>
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-secondary)">
        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700">Placa</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700">Descri\u00e7\u00e3o / Modelo</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700">\u00d3rg\u00e3o</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;font-weight:700">A\u00e7\u00f5es</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function openVeiculoModal(id) {
  const v = id ? combState.veiculos.find(x=>x.id==id) : null;
  const orgOpts = combState.orgaos.map(o =>
    `<option value="${o.id}" ${v && +v.orgao_id===o.id?'selected':''}>${escHtml(o.nome)}</option>`).join('');
  document.getElementById('cv-id').value    = id || 0;
  document.getElementById('cv-placa').value = v ? v.placa : '';
  document.getElementById('cv-desc').value  = v ? (v.descricao||'') : '';
  document.getElementById('cv-orgao').innerHTML = `<option value="">Selecione o \u00f3rg\u00e3o\u2026</option>${orgOpts}`;
  if (v && v.orgao_id) document.getElementById('cv-orgao').value = v.orgao_id;
  document.getElementById('comb-veiculo-modal-title').textContent = id ? 'Editar Ve\u00edculo' : 'Novo Ve\u00edculo';
  document.getElementById('comb-veiculo-modal-overlay').style.display = 'flex';
}

function closeVeiculoModal() {
  document.getElementById('comb-veiculo-modal-overlay').style.display = 'none';
}

async function saveVeiculo() {
  const id    = +document.getElementById('cv-id').value;
  const placa = document.getElementById('cv-placa').value.trim().toUpperCase();
  const desc  = document.getElementById('cv-desc').value.trim();
  const orgao = document.getElementById('cv-orgao').value || null;
  if (!placa) { toast('Placa obrigat\u00f3ria', 'error'); return; }
  const r = await fetch('api.php?action=comb_veiculos_save', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({id, placa, descricao:desc, orgao_id:orgao})
  }).then(x=>x.json());
  if (r.error) { toast(r.error,'error'); return; }
  toast('Ve\u00edculo salvo!','success');
  closeVeiculoModal();
  combState.loaded = false;
  await combLoad();
  renderCombVeiculos();
}

async function deleteVeiculo(id) {
  if (!confirm('Excluir este ve\u00edculo?')) return;
  await fetch('api.php?action=comb_veiculos_delete', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id})
  });
  toast('Ve\u00edculo exclu\u00eddo','success');
  combState.loaded = false;
  await combLoad();
  renderCombVeiculos();
}

// ── Fuel modal ────────────────────────────────────────────────
function openCombModal(id) {
  const r = id ? combState.registros.find(x=>x.id==id) : null;
  const now = new Date();
  const defaultMes  = combState.mesFilter || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const defaultDate = (r && r.data_abastecimento) ? r.data_abastecimento : now.toISOString().slice(0,10);
  const veicOpts = combState.veiculos.map(v => {
    const orgNome = (combState.orgaos.find(o=>o.id==v.orgao_id)||{}).nome || '';
    return `<option value="${v.id}" data-orgao="${v.orgao_id||''}" ${r&&+r.veiculo_id===v.id?'selected':''}>${escHtml(v.placa)}${v.descricao?' \u2014 '+escHtml(v.descricao):''}${orgNome?' ('+escHtml(orgNome)+')':''}</option>`;
  }).join('');
  const calc = r ? ((+r.litros||0)*(+r.valor_litro||0)) : 0;
  const manVal = (r && r.total_manual !== null && r.total_manual !== '') ? r.total_manual : '';
  document.getElementById('cm-id').value           = id || 0;
  document.getElementById('cm-mes').value          = r ? (r.mes||'').slice(0,7) : defaultMes;
  document.getElementById('cm-data').value         = defaultDate;
  document.getElementById('cm-km').value           = r ? (r.km||'') : '';
  document.getElementById('cm-litros').value       = r ? r.litros : '';
  document.getElementById('cm-vlitro').value       = r ? r.valor_litro : '';
  document.getElementById('cm-total-calc').value   = r ? combFmt$(calc) : '';
  document.getElementById('cm-total-manual').value = manVal;
  document.getElementById('cm-obs').value          = r ? (r.observacao||'') : '';
  document.getElementById('cm-veiculo').innerHTML  = `<option value="">Selecione o ve\u00edculo\u2026</option>${veicOpts}`;
  if (r && r.veiculo_id) document.getElementById('cm-veiculo').value = r.veiculo_id;
  document.getElementById('comb-modal-title').textContent = id ? 'Editar Abastecimento' : 'Novo Abastecimento';
  document.getElementById('comb-modal-overlay').style.display = 'flex';
  combRecalc();
}

function combRecalc() {
  const lit  = parseFloat((document.getElementById('cm-litros').value||'').replace(',','.')) || 0;
  const vlit = parseFloat((document.getElementById('cm-vlitro').value||'').replace(',','.')) || 0;
  const calc = lit * vlit;
  document.getElementById('cm-total-calc').value = calc > 0 ? combFmt$(calc) : '';
}

function closeCombModal() {
  document.getElementById('comb-modal-overlay').style.display = 'none';
}

async function saveComb() {
  const id      = +document.getElementById('cm-id').value;
  const mesYM   = document.getElementById('cm-mes').value;
  const mes     = mesYM ? mesYM + '-01' : null;
  const data    = document.getElementById('cm-data').value || null;
  const kmRaw   = (document.getElementById('cm-km').value||'').replace(',','.');
  const km      = kmRaw !== '' ? parseFloat(kmRaw) : null;
  const litros  = parseFloat((document.getElementById('cm-litros').value||'').replace(',','.')) || 0;
  const vlitro  = parseFloat((document.getElementById('cm-vlitro').value||'').replace(',','.')) || 0;
  const manRaw  = (document.getElementById('cm-total-manual').value||'').replace(',','.');
  const totalManual = manRaw !== '' ? parseFloat(manRaw) : null;
  const obs     = document.getElementById('cm-obs').value.trim();
  const veicId  = document.getElementById('cm-veiculo').value || null;

  if (!mes)        { toast('Selecione o m\u00eas', 'error'); return; }
  if (litros <= 0) { toast('Informe a quantidade de litros', 'error'); return; }

  let orgaoId = null;
  if (veicId) {
    const veiculo = combState.veiculos.find(v=>v.id==veicId);
    if (veiculo) orgaoId = veiculo.orgao_id || null;
  }

  const r = await fetch('api.php?action=comb_save', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({id, mes, data_abastecimento:data, km, litros,
      valor_litro:vlitro, total_manual:totalManual, observacao:obs,
      veiculo_id:veicId, orgao_id:orgaoId})
  }).then(x=>x.json());

  if (r.error) { toast(r.error,'error'); return; }
  toast('Abastecimento salvo!','success');
  closeCombModal();
  combState.loaded = false;
  await combLoad();
  renderCombList();
}

async function deleteComb(id) {
  if (!confirm('Excluir este abastecimento?')) return;
  await fetch('api.php?action=comb_delete', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id})
  });
  toast('Abastecimento exclu\u00eddo','success');
  combState.loaded = false;
  await combLoad();
  renderCombList();
}

// ── Relatório ─────────────────────────────────────────────────
async function renderCombRel() {
  document.getElementById('content').innerHTML = '<div class="loading">Carregando\u2026</div>';
  await combRelLoad();
  _combRelDraw();
}

function _combRelGetFiltered() {
  return combRelState.registros.filter(r => {
    const oKey = r.orgao_id ? String(r.orgao_id) : '0';
    if (combRelState.orgaosOn[oKey] === false) return false;
    if (r.placa && combRelState.placasOn[r.placa] === false) return false;
    return true;
  });
}

function _combRelDraw() {
  const orgaoMap = {};
  combState.orgaos.forEach(o => orgaoMap[String(o.id)] = o.nome);

  const allOrgaos = {};
  const allPlacas = {};
  combRelState.registros.forEach(r => {
    const oKey = r.orgao_id ? String(r.orgao_id) : '0';
    allOrgaos[oKey] = orgaoMap[String(r.orgao_id)] || (r.orgao_id ? `\u00d3rg\u00e3o #${r.orgao_id}` : 'Sem \u00d3rg\u00e3o');
    if (r.placa) allPlacas[r.placa] = r.descricao_veiculo || '';
  });
  Object.keys(allOrgaos).forEach(k => { if (!(k in combRelState.orgaosOn)) combRelState.orgaosOn[k] = true; });
  Object.keys(allPlacas).forEach(k => { if (!(k in combRelState.placasOn)) combRelState.placasOn[k] = true; });

  const filtered = _combRelGetFiltered();
  const totalLit = filtered.reduce((a,r)=>a+(+r.litros||0),0);
  const totalVal = filtered.reduce((a,r)=>a+combEfetivo(r),0);

  const orgChks = Object.keys(allOrgaos).sort((a,b)=>allOrgaos[a].localeCompare(allOrgaos[b],'pt-BR')).map(k =>
    `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:13px;cursor:pointer">
      <input type="checkbox" ${combRelState.orgaosOn[k]!==false?'checked':''} onchange="combRelToggleOrgao('${k}',this.checked)">
      ${escHtml(allOrgaos[k])}
    </label>`).join('') || '<span style="color:var(--muted);font-size:12px">Sem registros</span>';

  const placChks = Object.keys(allPlacas).sort().map(p =>
    `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:13px;cursor:pointer">
      <input type="checkbox" ${combRelState.placasOn[p]!==false?'checked':''} onchange="combRelTogglePlaca('${escHtml(p).replace(/'/g,"\\'")}',this.checked)">
      <span style="font-weight:700">${escHtml(p)}</span>${allPlacas[p]?` <span style="color:var(--muted);font-size:11px">${escHtml(allPlacas[p])}</span>`:''}
    </label>`).join('') || '<span style="color:var(--muted);font-size:12px">Sem registros</span>';

  const byOrgao = {};
  filtered.forEach(r => {
    const key = r.orgao_id ? String(r.orgao_id) : '0';
    if (!byOrgao[key]) byOrgao[key] = [];
    byOrgao[key].push(r);
  });

  let tableHtml = '';
  if (!filtered.length) {
    tableHtml = `<div style="text-align:center;padding:50px;color:var(--muted)">Nenhum registro com os filtros selecionados</div>`;
  } else {
    Object.keys(byOrgao).sort((a,b)=>{ if(a==='0')return 1;if(b==='0')return -1; return (allOrgaos[a]||'').localeCompare(allOrgaos[b]||'','pt-BR'); }).forEach(oId => {
      const regs = byOrgao[oId];
      const orgNome = allOrgaos[oId] || 'Sem \u00d3rg\u00e3o';
      const subLit = regs.reduce((a,r)=>a+(+r.litros||0),0);
      const subVal = regs.reduce((a,r)=>a+combEfetivo(r),0);
      tableHtml += `<div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--bg-secondary);border-radius:8px 8px 0 0;border-bottom:2px solid var(--primary)">
          <h3 style="font-size:13px;font-weight:700;color:var(--primary);margin:0">\ud83c\udfe2 ${escHtml(orgNome)}</h3>
          <span style="font-size:12px;color:var(--muted)">${combFmtN(subLit)} L \u00b7 ${combFmt$(subVal)}</span>
        </div>
        <div style="overflow-x:auto;border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--bg-secondary)">
            <th style="padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase;font-weight:700">Data</th>
            <th style="padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase;font-weight:700">Placa / Ve\u00edculo</th>
            <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;font-weight:700">KM</th>
            <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;font-weight:700">Litros</th>
            <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;font-weight:700">R$/L</th>
            <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;font-weight:700">Total Calc.</th>
            <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;font-weight:700">Total Efetivo</th>
            <th style="padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase;font-weight:700">Obs.</th>
          </tr></thead>
          <tbody>
          ${regs.map(r=>{
            const calc=(+r.litros||0)*(+r.valor_litro||0);
            const efet=combEfetivo(r);
            const hasM=r.total_manual!==null&&r.total_manual!==''&&r.total_manual!==undefined&&Math.abs(+r.total_manual-calc)>0.005;
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:7px 12px">${combFmtDate(r.data_abastecimento)}</td>
              <td style="padding:7px 12px"><span style="font-weight:700">${escHtml(r.placa||'\u2014')}</span>${r.descricao_veiculo?`<span style="color:var(--muted);font-size:11px;margin-left:6px">${escHtml(r.descricao_veiculo)}</span>`:''}</td>
              <td style="padding:7px 12px;text-align:right">${r.km?combFmtN(r.km,0):'—'}</td>
              <td style="padding:7px 12px;text-align:right">${combFmtN(r.litros)} L</td>
              <td style="padding:7px 12px;text-align:right">${combFmt$(r.valor_litro)}</td>
              <td style="padding:7px 12px;text-align:right;color:var(--muted)">${combFmt$(calc)}</td>
              <td style="padding:7px 12px;text-align:right;font-weight:700;color:${hasM?'#F59E0B':'#10B981'}">${combFmt$(efet)}${hasM?' \u270f\ufe0f':''}</td>
              <td style="padding:7px 12px;font-size:11px;color:var(--muted)">${escHtml(r.observacao||'')}</td>
            </tr>`;
          }).join('')}
          </tbody>
          <tfoot><tr style="background:var(--bg-secondary);font-weight:700">
            <td colspan="3" style="padding:7px 12px;font-size:11px">Subtotal</td>
            <td style="padding:7px 12px;text-align:right">${combFmtN(subLit)} L</td>
            <td></td><td></td>
            <td style="padding:7px 12px;text-align:right;color:#10B981">${combFmt$(subVal)}</td>
            <td></td>
          </tr></tfoot>
        </table></div></div>`;
    });
  }

  document.getElementById('content').innerHTML = `
  <div style="padding:24px 20px;max-width:1200px;margin:0 auto">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="font-size:20px;font-weight:800;margin:0">\ud83d\udcca Relat\u00f3rio de Combust\u00edvel</h2>
        <div style="color:var(--muted);font-size:12px;margin-top:4px">${combRelState.mes ? combMesLabel(combRelState.mes) : 'Todos os meses'} \u00b7 ${filtered.length} registro(s)</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select class="search-box" style="width:200px" onchange="combRelChangeMes(this.value)">
          ${combMesOpts(combRelState.mes, true)}
        </select>
        <button onclick="combRelPdf()" style="padding:9px 18px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">\ud83d\udcc4 Gerar PDF</button>
        <button class="btn-secondary" onclick="ciGoSectionPage('comb-list')">\u26fd Abastecimentos</button>
      </div>
    </div>
    <div class="orc-sum-row" style="margin-bottom:20px">
      <div class="orc-sum-card"><div class="osc-icon">\u26fd</div><div class="osc-val">${filtered.length}</div><div class="osc-lbl">Abastecimentos</div></div>
      <div class="orc-sum-card"><div class="osc-icon">\ud83d\udee2\ufe0f</div><div class="osc-val">${combFmtN(totalLit)} L</div><div class="osc-lbl">Total de Litros</div></div>
      <div class="orc-sum-card"><div class="osc-icon">\ud83d\udcb0</div><div class="osc-val" style="color:#10B981">${combFmt$(totalVal)}</div><div class="osc-lbl">Total Gasto</div></div>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
      <div style="flex:1;min-width:220px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;color:var(--primary)">\ud83c\udfe2 Filtrar por \u00d3rg\u00e3o</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button onclick="combRelAllOrgaos(true)" style="font-size:11px;padding:3px 10px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;color:var(--text)">Todos</button>
          <button onclick="combRelAllOrgaos(false)" style="font-size:11px;padding:3px 10px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;color:var(--text)">Nenhum</button>
        </div>
        ${orgChks}
      </div>
      <div style="flex:1;min-width:220px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;color:var(--primary)">\ud83d\ude97 Filtrar por Placa</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button onclick="combRelAllPlacas(true)" style="font-size:11px;padding:3px 10px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;color:var(--text)">Todas</button>
          <button onclick="combRelAllPlacas(false)" style="font-size:11px;padding:3px 10px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;color:var(--text)">Nenhuma</button>
        </div>
        ${placChks}
      </div>
    </div>
    ${tableHtml}
  </div>`;
}

async function combRelChangeMes(val) {
  combRelState.mes = val;
  combRelState.orgaosOn = {};
  combRelState.placasOn = {};
  combRelState.loaded = false;
  renderCombRel();
}
function combRelToggleOrgao(key, val) { combRelState.orgaosOn[key] = val; _combRelDraw(); }
function combRelTogglePlaca(placa, val) { combRelState.placasOn[placa] = val; _combRelDraw(); }
function combRelAllOrgaos(val) { Object.keys(combRelState.orgaosOn).forEach(k=>combRelState.orgaosOn[k]=val); _combRelDraw(); }
function combRelAllPlacas(val) { Object.keys(combRelState.placasOn).forEach(k=>combRelState.placasOn[k]=val); _combRelDraw(); }

// ── PDF ───────────────────────────────────────────────────────
function combRelPdf() {
  const filtered = _combRelGetFiltered();
  if (!filtered.length) { toast('Nenhum dado para gerar PDF', 'error'); return; }

  const orgaoMap = {};
  combState.orgaos.forEach(o => orgaoMap[String(o.id)] = o.nome);
  const byOrgao  = {};
  filtered.forEach(r => {
    const key = r.orgao_id ? String(r.orgao_id) : '0';
    if (!byOrgao[key]) byOrgao[key] = [];
    byOrgao[key].push(r);
  });

  const totalLit = filtered.reduce((a,r) => a + (+r.litros||0), 0);
  const totalVal = filtered.reduce((a,r) => a + combEfetivo(r), 0);
  const fmt$  = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const fmtN  = (v,d) => { d=d??3; return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}); };
  const fmtD  = s => { if (!s) return '\u2014'; return new Date(s+'T12:00:00').toLocaleDateString('pt-BR'); };

  const sortedOids = Object.keys(byOrgao).sort((a,b) => {
    if (a==='0') return 1; if (b==='0') return -1;
    return (orgaoMap[a]||'').localeCompare(orgaoMap[b]||'','pt-BR');
  });

  const now      = new Date();
  const dtStr    = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const mesTitulo = combRelState.mes ? combMesLabel(combRelState.mes) : 'Todos os meses';
  const sections = [];

  sections.push({
    type:     'header',
    title:    'Relatorio de Combustivel',
    subtitle: 'Prefeitura Municipal de Sertania \u2014 ' + mesTitulo,
    right:    'Emitido em: ' + dtStr,
    color:    [13, 34, 64],
  });

  sections.push({ type: 'cards', items: [
    { value: String(filtered.length), label: 'Abastecimentos', color: [13, 34, 64] },
    { value: fmtN(totalLit) + ' L',  label: 'Total de Litros', color: [13, 34, 64] },
    { value: fmt$(totalVal),          label: 'Total Gasto',     color: [13, 122, 116] },
  ]});

  sections.push({ type: 'section-title', text: 'Resumo por Orgao' });

  const resumoBody = sortedOids.map(oId => {
    const regs    = byOrgao[oId];
    const orgNome = oId==='0' ? 'Sem Orgao' : (orgaoMap[oId] || 'Orgao #'+oId);
    const lit     = regs.reduce((a,r) => a + (+r.litros||0), 0);
    const val     = regs.reduce((a,r) => a + combEfetivo(r), 0);
    return [
      orgNome,
      { content: String(regs.length), styles: { halign: 'right' } },
      { content: fmtN(lit) + ' L',    styles: { halign: 'right' } },
      { content: fmt$(val),            styles: { halign: 'right', textColor: [13,122,116], fontStyle: 'bold' } },
    ];
  });
  const resumoFoot = [[
    { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' } },
    { content: String(filtered.length), styles: { halign: 'right', fontStyle: 'bold' } },
    { content: fmtN(totalLit) + ' L',  styles: { halign: 'right', fontStyle: 'bold' } },
    { content: fmt$(totalVal),          styles: { halign: 'right', fontStyle: 'bold', textColor: [13,122,116] } },
  ]];
  sections.push({ type: 'table',
    head: [['Orgao',
      { content: 'Abastecimentos', styles: { halign: 'right' } },
      { content: 'Litros',         styles: { halign: 'right' } },
      { content: 'Total',          styles: { halign: 'right' } }]],
    body: resumoBody,
    foot: resumoFoot,
    fontSize: 9,
  });

  sections.push({ type: 'section-title', text: 'Detalhamento por Orgao' });

  for (const oId of sortedOids) {
    const regs    = byOrgao[oId];
    const orgNome = oId==='0' ? 'Sem Orgao' : (orgaoMap[oId] || 'Orgao #'+oId);
    const subLit  = regs.reduce((a,r) => a + (+r.litros||0), 0);
    const subVal  = regs.reduce((a,r) => a + combEfetivo(r), 0);
    sections.push({
      type:   'org-header',
      name:   orgNome,
      right:  fmt$(subVal),
      right2: fmtN(subLit) + ' L \u00b7 ' + regs.length + ' abastecimento(s)',
      color:  [13, 34, 64],
    });
    const head = [['Data', 'Placa / Veiculo',
      { content: 'KM',            styles: { halign: 'right' } },
      { content: 'Litros',        styles: { halign: 'right' } },
      { content: 'R$/L',          styles: { halign: 'right' } },
      { content: 'Total Calc.',   styles: { halign: 'right' } },
      { content: 'Total Efetivo', styles: { halign: 'right' } },
      'Obs.',
    ]];
    const body = regs.map(r => {
      const calc = (+r.litros||0) * (+r.valor_litro||0);
      const efet = combEfetivo(r);
      const hasM = r.total_manual !== null && r.total_manual !== '' && r.total_manual !== undefined && Math.abs(+r.total_manual - calc) > 0.005;
      return [
        fmtD(r.data_abastecimento),
        { content: (r.placa||'\u2014') + (r.descricao_veiculo ? '\n' + r.descricao_veiculo : ''), styles: { fontStyle: 'bold' } },
        { content: r.km ? fmtN(r.km,0) : '\u2014',    styles: { halign: 'right' } },
        { content: fmtN(r.litros) + ' L',              styles: { halign: 'right' } },
        { content: fmt$(r.valor_litro),                 styles: { halign: 'right' } },
        { content: fmt$(calc),                          styles: { halign: 'right', textColor: [150,150,150] } },
        { content: fmt$(efet) + (hasM ? ' *' : ''),    styles: { halign: 'right', textColor: hasM ? [180,85,9] : [13,122,116], fontStyle: 'bold' } },
        { content: String(r.observacao || ''),          styles: { fontSize: 7, textColor: [120,120,120] } },
      ];
    });
    const foot = [[
      { content: 'Subtotal', colSpan: 3, styles: { fontStyle: 'bold' } },
      { content: fmtN(subLit) + ' L', styles: { halign: 'right', fontStyle: 'bold' } },
      '', '',
      { content: fmt$(subVal), styles: { halign: 'right', fontStyle: 'bold', textColor: [13,122,116] } },
      '',
    ]];
    sections.push({ type: 'table', head, body, foot, fontSize: 8,
      colStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 28, halign: 'right' },
        7: { cellWidth: 28 },
      }
    });
  }

  _downloadPdf({ filename: 'relatorio-combustivel.pdf', orientation: 'landscape', sections });
}

