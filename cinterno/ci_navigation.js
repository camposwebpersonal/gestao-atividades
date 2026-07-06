const CI_MODULE_PAGE_MAP = {
  home: 'index.php',
  secretarias: 'secretarias.php',
  medicamentos: 'medicamentos.php',
  contratados: 'funcionarios.php',
  combustivel: 'combustivel.php',
  contas: 'contas.php',
  apresentacao: 'apresentacao.php'
};

const CI_SECTION_PAGE_MAP = {
  'adm-folha': 'secretarias_administracao_folha.php',
  dashboard: 'secretarias_secretarias.php',
  cadastros: 'secretarias_cadastros.php',
  'rel-forn': 'medicamentos_relatoriofornecedores.php',
  orc: 'medicamentos_medicamentosorcados.php',
  notas: 'medicamentos_notasfiscais.php',
  'cont-list': 'funcionarios_lista.php',
  'cont-orgaos': 'funcionarios_orgaos.php',
  'cont-dup': 'funcionarios_duplicidades.php',
  'cont-vagas': 'funcionarios_vagas.php',
  'cont-rel': 'funcionarios_relatorio.php',
  'comb-list': 'combustivel_abastecimentos.php',
  'comb-veiculos': 'combustivel_veiculos.php',
  'comb-rel': 'combustivel_relatorio.php',
  contas: 'contas.php'
};

const CI_CONTAS_TAB_PAGE_MAP = {
  luz: 'contas_luz.php',
  agua: 'contas_agua.php',
  internet: 'contas_internet.php',
  aluguel: 'contas_aluguel.php',
  relatorios: 'contas_relatorios.php'
};

function ciNavigate(url) {
  if (!url) return;
  window.location.href = url;
}

function ciGetModulePage(moduleName) {
  return CI_MODULE_PAGE_MAP[moduleName] || '';
}

function ciGetSectionPage(type, id) {
  if (type === 'sec') {
    const qs = new URLSearchParams({ ci_section: 'sec' });
    if (id !== undefined && id !== null && id !== '') qs.set('ci_section_id', String(id));
    return `secretarias.php?${qs.toString()}`;
  }
  return CI_SECTION_PAGE_MAP[type] || '';
}

function ciGetContasTabPage(tab) {
  return CI_CONTAS_TAB_PAGE_MAP[tab] || 'contas.php';
}

function ciGoModulePage(moduleName) {
  const url = ciGetModulePage(moduleName);
  if (url) {
    ciNavigate(url);
    return;
  }
  if (typeof switchModule === 'function') switchModule(moduleName);
}

function ciGoSectionPage(type, id) {
  const url = ciGetSectionPage(type, id);
  if (url) {
    ciNavigate(url);
    return;
  }
  if (typeof showSection === 'function') showSection(type, id);
}

function ciGoContasTabPage(tab) {
  const url = ciGetContasTabPage(tab);
  if (url) {
    ciNavigate(url);
    return;
  }
  if (typeof showSection === 'function') {
    showSection('contas');
    setTimeout(() => {
      if (typeof contasSetTab === 'function') contasSetTab(tab);
    }, 100);
  }
}

function ciGoOrcTabPage(tab) {
  const map = {
    dashboard: 'medicamentos_medicamentosorcados.php',
    itens: 'medicamentos_medicamentosorcados.php?ci_orc_tab=itens',
    relatorio_nf: 'medicamentos_relatorionf.php'
  };
  const url = map[tab] || 'medicamentos_medicamentosorcados.php';
  ciNavigate(url);
}
