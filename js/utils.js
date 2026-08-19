/* ── UTILITÁRIOS COMPARTILHADOS ──
   Funções usadas por index.html e pelos módulos js/*.js.
   Carregar ANTES dos demais scripts. Expõe window.PMS e aliases globais
   (esc, fmtD, setC, toast wrappers ficam em index.html). */
(function(){
  'use strict';

  const esc = s => String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const stripAccents = s => String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const normUpper = s => stripAccents(s).toUpperCase();
  const normLower = s => stripAccents(s).toLowerCase();
  const normKey = s => normLower(s).replace(/[^a-z0-9]/g,'');

  const fmtD = d => {
    if(!d) return '—';
    try {
      let s = String(d);
      if(!s.includes('T') && !s.includes(' ')) s += 'T00:00';
      return new Date(s).toLocaleDateString('pt-BR');
    } catch { return String(d); }
  };

  const fmtMoney = v => parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
  const fmtBRL = v => 'R$ ' + fmtMoney(v);
  const fmtNum = v => { const n=parseFloat(v||0); return Number.isInteger(n)?n.toString():n.toFixed(2).replace('.',','); };
  const parseNum = v => { const n=parseFloat(String(v==null?'':v).replace(/[^\d,\-]/g,'').replace(',','.')); return isNaN(n)?0:n; };

  const onlyDigits = (v, max) => { const d=String(v==null?'':v).replace(/\D/g,''); return max?d.slice(0,max):d; };

  const fmtCPF = v => {
    const d = onlyDigits(v,11);
    if(d.length<=3) return d;
    if(d.length<=6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if(d.length<=9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const fmtTel = v => {
    const d = onlyDigits(v,11);
    if(d.length<=2) return d;
    if(d.length<=7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if(d.length<=10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };

  const hojeISO = () => new Date().toISOString().slice(0,10);
  const hojeBR = () => new Date().toLocaleDateString('pt-BR');

  // Nome de arquivo seguro para PDFs (remove pontuação, mantém acentos).
  const slugArquivo = (nome, fallback) => String(nome||fallback||'relatorio')
    .replace(/[^a-zA-Z0-9\u00C0-\u00FA ]/g,'_').trim();

  // Localiza a chave de extra_fields cujo nome contém o fragmento informado,
  // ignorando acentos e caixa.
  const efFindKey = (ef, frag) => Object.keys(ef||{}).find(k => normUpper(k).includes(normUpper(frag))) || null;
  const efGet = (ef, frag) => { const k = efFindKey(ef, frag); return k ? ef[k] : ''; };

  // extra_fields pode vir como objeto ou string JSON (legado).
  const extraFields = o => {
    try { const e=(o&&o.extra_fields)||{}; return typeof e==='string' ? JSON.parse(e) : (e||{}); }
    catch { return {}; }
  };

  const setC = h => document.getElementById('content').innerHTML = h;
  // Cor do progresso: verde (100%), azul (em andamento), cinza (0%).
  const pColor = p => p===100 ? '#10b981' : p>0 ? '#3b82f6' : '#334155';

  // ── jsPDF ──
  function getJsPDF(){
    if(window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    const aviso = 'jsPDF não carregado';
    if(typeof window.toast === 'function') window.toast(aviso,'error'); else alert(aviso);
    return null;
  }

  // Estilizador de texto do jsPDF: sf(tamanho, negrito, [r,g,b])
  const pdfStyler = doc => (sz, bold, clr) => {
    doc.setFontSize(sz||9);
    doc.setFont('helvetica', bold?'bold':'normal');
    const c = clr||[26,32,44];
    doc.setTextColor(c[0],c[1],c[2]);
  };

  const PMS = {
    esc, stripAccents, normUpper, normLower, normKey,
    fmtD, fmtMoney, fmtBRL, fmtNum, parseNum,
    onlyDigits, fmtCPF, fmtTel, hojeISO, hojeBR, slugArquivo,
    efFindKey, efGet, extraFields, setC, pColor,
    getJsPDF, pdfStyler
  };

  window.PMS = PMS;
  // Aliases globais mantidos por compatibilidade com o código existente.
  window.esc = esc;
  window.fmtD = fmtD;
  window.setC = setC;
})();
