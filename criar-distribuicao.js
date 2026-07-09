/* CRIA AS ATIVIDADES DE CONTROLE DE DISTRIBUIÇÃO
   Uso: ?criar=distribuicao
   Idempotente: não duplica atividades existentes com o mesmo nome. */
(async function(){
  const { collection, doc, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js");
  const atividades = [
    {
      name: 'CONTROLE DE DISTRIBUIÇÃO DE MEDICAMENTOS',
      observacoes: 'Cadastro e controle mensal de pacientes beneficiários de distribuição de medicamentos.',
      cor: '#10b981'
    },
    {
      name: 'CONTROLE DE DISTRIBUIÇÃO DE LEITE',
      observacoes: 'Cadastro e controle mensal de pacientes beneficiários de distribuição de leite.',
      cor: '#38bdf8'
    }
  ];

  let criadas = 0;
  for (const ativ of atividades) {
    const existe = S.secs.find(s => s.name && s.name.toUpperCase().trim() === ativ.name.toUpperCase().trim());
    if (existe) {
      console.log('Atividade já existe:', ativ.name);
      continue;
    }
    await addDoc(collection(db, 'secretariats'), {
      name: ativ.name,
      observacoes: ativ.observacoes,
      responsaveis: '',
      start_date: null,
      end_date: null,
      controle_pendencias: 0,
      controle_contas: 0,
      controle_distribuicao: 1,
      show_stats: 0,
      show_verba: 0,
      verba_on_subitems: 0,
      verba_sum_subitems: 0,
      verba_has_obs: 0,
      show_origem_verba: 0,
      origem_verba_on_subitems: 0,
      origem_verba_has_obs: 0,
      show_documentacao: 0,
      documentacao_on_subitems: 0,
      documentacao_has_obs: 0,
      show_licitacao: 0,
      licitacao_on_subitems: 0,
      licitacao_has_obs: 0,
      order_num: S.secs.length,
      created_at: serverTimestamp()
    });
    criadas++;
  }
  await loadData();
  toast(criadas > 0 ? `${criadas} atividade(s) de distribuição criada(s)!` : 'Atividades de distribuição já existem.', criadas > 0 ? 'success' : 'info', 6000);
  renderDash();
})();
