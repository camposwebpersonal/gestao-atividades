/* Correção de contas CELPE:
   1) Divide valores por 100 (ponto decimal perdido na importação)
   2) Realoca lançamentos genéricos para as escolas corretas, casando:
      - número da conta contrato na observação x campos das escolas
      - nome da escola embutido na observação x nome do subitem
   Uso: site com login admin + ?corrigir=celpe na URL (ou colar no Console). */
(async function(){
  const { collection, doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js");
  const norm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/MINICIPAL/g,'MUNICIPAL').trim();

  const ativ = S.secs.find(s => s.name && s.name.toUpperCase().trim() === 'CONTROLE DE CONTAS');
  if(!ativ){ toast('Atividade CONTROLE DE CONTAS não encontrada','error'); return; }
  const ativId = ativ.id;
  const contas = S.contas.filter(c => c.atividade_id === ativId);
  if(!contas.length){ toast('Nenhum lançamento para corrigir','error'); return; }

  /* ── 1. CORRIGIR VALORES (÷100) ── */
  let fixVal = 0;
  if(ativ.celpe_valores_corrigidos){
    console.log('Valores já corrigidos anteriormente, pulando etapa 1.');
  } else {
    toast('Corrigindo valores (1/2)...','info',6000);
    for(const c of contas){
      const v = parseFloat(c.valor)||0;
      if(v > 0){
        await updateDoc(doc(db,'contas',c.id), { valor: Math.round(v)/100, updated_at: serverTimestamp() });
        fixVal++;
      }
    }
    await updateDoc(doc(db,'secretariats',ativId), { celpe_valores_corrigidos: true, updated_at: serverTimestamp() });
    console.log('Valores corrigidos:', fixVal);
  }

  /* ── 2. REALOCAR LANÇAMENTOS ── */
  toast('Realocando lançamentos (2/2)...','info',6000);
  const subs = S.subitems.filter(s => s.atividade_id === ativId || S.items.some(i => i.id === s.item_id && i.atividade_id === ativId));

  // nomes genéricos que NÃO são destino (agrupadores)
  const genericos = ['ESCOLAS DO MUNICIPIO','ESCOLAS','DEMAIS PREDIOS PUBLICOS','OUTROS','UNIDADES DE SAUDE','UNIDADES BASICAS DE SAUDE','POCOS DO MUNICIPIO','PRACAS PUBLICAS','CEMITERIOS PUBLICOS','SEMAFOROS PUBLICOS','ILUMINACAO PUBLICA'];
  const isGenerico = s => genericos.includes(norm(s.description));
  const destinos = subs.filter(s => !isGenerico(s));

  // índice: dígitos (6+) dos extra_fields de cada local destino -> local
  const numToSub = {};
  destinos.forEach(s => {
    const ef = s.extra_fields || {};
    Object.values(ef).forEach(v => {
      String(v||'').match(/\d{5,}/g)?.forEach(n => { numToSub[n] = numToSub[n] || s; });
    });
  });

  // extrai número e possível nome da observação: "Diversos - 7043228689 NOME DA ESCOLA - 07/05/2025"
  const parseObs = obs => {
    const m = String(obs||'').match(/Diversos\s*-\s*(\d{5,})(?:\/\d+)?\s*-?\s*(.*?)(?:\s*-\s*\d{2}\/\d{2}\/\d{4})?\s*$/);
    if(!m) return null;
    return { num: m[1], nome: (m[2]||'').replace(/[^A-Za-zÀ-ú ]/g,' ').trim() };
  };

  // casa nome embutido com destinos por tokens significativos
  const matchByName = nome => {
    const toks = norm(nome).split(/\s+/).filter(t => t.length > 3 && !['ESCOLA','MUNICIPAL','GRUPO','GRUPPO','ESCOLAR','CRECHE'].includes(t));
    if(!toks.length) return null;
    return destinos.find(s => { const d = norm(s.description); return toks.every(t => d.includes(t)); }) || null;
  };

  // aprende mapeamento número->escola a partir de obs com nome embutido
  const aprendido = {};
  contas.forEach(c => {
    const p = parseObs(c.observacao);
    if(p && p.nome && p.nome.length > 5){
      const alvo = matchByName(p.nome);
      if(alvo) aprendido[p.num] = alvo;
    }
  });
  console.log('Mapeamentos aprendidos por nome:', Object.fromEntries(Object.entries(aprendido).map(([k,v])=>[k,v.description])));

  let movidos = 0; const relatorio = [];
  for(const c of contas){
    const subAtual = subs.find(s => s.id === c.subitem_id);
    if(subAtual && !isGenerico(subAtual)) continue; // já está num local específico
    const p = parseObs(c.observacao);
    if(!p) continue;
    let alvo = aprendido[p.num] || numToSub[p.num] || (p.nome && p.nome.length > 5 ? matchByName(p.nome) : null);
    if(alvo && alvo.id !== c.subitem_id){
      await updateDoc(doc(db,'contas',c.id), { subitem_id: alvo.id, item_id: alvo.item_id, updated_at: serverTimestamp() });
      movidos++;
      relatorio.push((c.observacao||'') + '  →  ' + alvo.description);
    }
  }
  console.log('Lançamentos realocados:', movidos);
  relatorio.forEach(r => console.log('  ', r));

  await loadData();
  toast(`Correção concluída! ${fixVal} valores corrigidos, ${movidos} lançamentos realocados.`,'success',8000);
  if(typeof openActivity === 'function') openActivity(ativId);
})();
