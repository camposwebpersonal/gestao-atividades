/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SCRIPT DE IMPORTAÇÃO BCCS — COLE NO CONSOLE DO NAVEGADOR  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INSTRUÇÕES:
 * 1. Acesse https://camposwebpersonal.github.io/gestao-atividades/
 * 2. Faça login como ADMIN (RCAMPOS/admin/camposweb)
 * 3. Aguarde o loading completar (aparecer as atividades)
 * 4. Aperte F12 → Console
 * 5. Digite: allow pasting  (e Enter)
 * 6. Cole este script e aperte ENTER
 */

(async () => {
  console.log("🚀 Iniciando importação BCC...");

  // Carregar funções do Firebase dinamicamente
  const fb = await import("https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js");
  const { addDoc, collection, doc, updateDoc, serverTimestamp, getDocs, query, where } = fb;

  const db = window.db;
  if (!db) {
    console.error("❌ window.db não encontrado. Recarregue a página (F5) e tente novamente.");
    return;
  }

  const S = window.S;
  if (!S || !S.secs) {
    console.error("❌ Dados do site não carregados. Aguarde o loading completar.");
    return;
  }

  console.log("📥 Carregando dados BCC...");
  let BCC_DATA = [];
  try {
    const res = await fetch('bcc_data_junho_2026.json');
    BCC_DATA = await res.json();
  } catch (e) {
    console.error("❌ Erro ao carregar bcc_data_junho_2026.json:", e);
    return;
  }
  console.log("✅ Dados carregados:", BCC_DATA.length, "secretarias");

  // 1. Encontrar atividade BCCS
  let bccs = S.secs.find(s => s.name.toUpperCase().includes('BCC'));
  if (!bccs) {
    console.error("❌ Atividade BCCS não encontrada. Crie a atividade primeiro no site.");
    return;
  }
  console.log("📌 Atividade BCCS encontrada:", bccs.name, "ID:", bccs.id);

  // 2. Criar Secretarias
  console.log("🏛️ Verificando secretarias...");
  const secNames = [...new Set(BCC_DATA.map(s => s.name))];
  const secMap = {};

  for (const sn of secNames) {
    const existing = S.secretarias.find(s => s.name === sn);
    if (existing) {
      secMap[sn] = existing.id;
      console.log("  ↳ Secretaria já existe:", sn);
    } else {
      const r = await addDoc(collection(db, 'secretarias'), {
        name: sn,
        created_at: serverTimestamp()
      });
      secMap[sn] = r.id;
      console.log("  ✚ Nova secretaria:", sn);
    }
  }

  // 3. Criar FieldTemplates (campos extras) na atividade BCCS
  console.log("🗂️ Verificando campos extras...");
  const fieldDefs = [
    { name: 'Localidade',    type: 'text' },
    { name: 'Telefone',      type: 'text' },
    { name: 'Função',        type: 'text' },
    { name: 'Remuneração',   type: 'text' },
    { name: 'Data Início',   type: 'text' },
    { name: 'Carga Horária', type: 'text' },
    { name: 'Mês',           type: 'text' }
  ];

  const ftMap = {};
  const existingFT = S.fieldTemplates.filter(t => t.atividade_id === bccs.id && t.scope === 'subitem');

  for (const fd of fieldDefs) {
    const ex = existingFT.find(t => t.field_name === fd.name);
    if (ex) {
      ftMap[fd.name] = ex.id;
      console.log("  ↳ Field já existe:", fd.name);
    } else {
      const r = await addDoc(collection(db, 'fieldTemplates'), {
        atividade_id: bccs.id,
        scope: 'subitem',
        field_name: fd.name,
        field_type: fd.type,
        order_num: Object.keys(ftMap).length,
        created_at: serverTimestamp()
      });
      ftMap[fd.name] = r.id;
      console.log("  ✚ Novo field:", fd.name);
    }
  }

  // 4. Criar Items (1 por secretaria)
  console.log("📋 Criando itens...");
  const itemMap = {};
  const existingItems = S.items.filter(i => i.atividade_id === bccs.id);

  for (const sec of BCC_DATA) {
    const ex = existingItems.find(i => i.description === sec.name);
    if (ex) {
      itemMap[sec.name] = ex.id;
      console.log("  ↳ Item já existe:", sec.name);
    } else {
      const r = await addDoc(collection(db, 'items'), {
        atividade_id: bccs.id,
        description: sec.name,
        secretaria_id: secMap[sec.name] || null,
        item_icon: '🏛️',
        item_color: '#3B82F6',
        order_num: (S.items.length + Object.keys(itemMap).length),
        concluded: 0,
        created_at: serverTimestamp()
      });
      itemMap[sec.name] = r.id;
      console.log("  ✚ Novo item:", sec.name);
    }
  }

  // 5. Criar Sub-items (1 por pessoa)
  console.log("👤 Criando sub-itens...");
  let subCount = 0;
  let skipCount = 0;
  const baseSubCount = S.subitems.length;
  const existingSubKeys = new Set();
  S.subitems.filter(s => s.atividade_id === bccs.id).forEach(s => {
    const mes = (s.extra_fields || {})['Mês'] || '';
    existingSubKeys.add((s.description || '').trim().toUpperCase() + '|' + String(mes).trim().toUpperCase());
  });

  for (const sec of BCC_DATA) {
    const itemId = itemMap[sec.name];
    let secNew = 0, secSkip = 0;
    for (const p of sec.people) {
      const ef = {};
      if (p.localidade)     ef['Localidade']    = p.localidade;
      if (p.telefone)       ef['Telefone']      = p.telefone;
      if (p.funcao)         ef['Função']        = p.funcao;
      if (p.remuneracao != null) ef['Remuneração'] = 'R$ ' + Number(p.remuneracao).toFixed(2).replace('.',',');
      if (p.data_inicio)    ef['Data Início']   = p.data_inicio;
      if (p.carga_horaria)  ef['Carga Horária'] = p.carga_horaria;
      ef['Mês'] = p.mes || '06/2026';

      const key = (p.nome || '').trim().toUpperCase() + '|' + String(ef['Mês']).trim().toUpperCase();
      if (existingSubKeys.has(key)) {
        skipCount++; secSkip++;
        console.log("  ↳ Já existe:", p.nome, "-", sec.name, "Mês:", ef['Mês']);
        continue;
      }
      existingSubKeys.add(key);

      await addDoc(collection(db, 'subitems'), {
        atividade_id: bccs.id,
        item_id: itemId,
        description: p.nome,
        extra_fields: ef,
        order_num: (baseSubCount + subCount),
        concluded: 0,
        created_at: serverTimestamp()
      });
      subCount++; secNew++;
    }
    console.log("  ✚", sec.name, ":", secNew, "novos", secSkip > 0 ? "(" + secSkip + " já existiam)" : "");
  }

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          ✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO!               ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  Secretarias : " + String(secNames.length).padStart(3) + "                                      ║");
  console.log("║  Itens       : " + String(Object.keys(itemMap).length).padStart(3) + "                                      ║");
  console.log("║  Sub-itens   : " + String(subCount).padStart(3) + "                                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("🔄 Recarregue a página (F5) para ver os dados importados.");
  console.log("🙏 DEUS JESUS CRISTO TE ABENÇOE!");

})();
