// ─── Apresentação Institucional — Prefeitura Municipal de Sertânia ───────────
// ci_apresentacao.js

const AD = {
  prefeita:'Pollyanna Abreu', periodo:'2025 – 2028', ano:'2026',
  slogan:'Vivendo um Novo Tempo',
  municipio:'Sertânia', estado:'Pernambuco', regiao:'Sertão do Moxotó',
  fundacao:'29 de abril de 1878', populacao:'67.820 hab.', populacaoFonte:'IBGE Censo 2022',
  area:'2.885,4 km²', pib:'R$ 420 milhões', pibFonte:'IBGE 2021',
  idh:'0,563', idhAno:'2010', distancia:'≈ 310 km (via BR-232)', acessos:'BR-232 e BR-316',
  endereco:'Praça João Pereira Vale, 20, Centro – Sertânia-PE', cep:'CEP 56.570-000',
  telefone:'(87) 3841-1156', email:'gabinete@sertania.pe.gov.br',
  site:'www.sertania.pe.gov.br', instagram:'@prefeitura.sertania',
  mensagem:'"A Prefeitura de Sertânia trabalha com responsabilidade, planejamento e compromisso social, buscando parcerias institucionais que promovam desenvolvimento, melhoria da qualidade de vida e fortalecimento das políticas públicas do nosso município."',
  msgFinal:'"A Prefeitura de Sertânia reafirma seu compromisso com a boa gestão pública e coloca-se à disposição para construir parcerias institucionais que promovam desenvolvimento, inclusão social e melhoria da qualidade de vida da população."',
};
const GR = {dk:'#145214',md:'#1e7b1e',lt:'#6ec02e',wh:'#ffffff',bg:'#f0f7ee',bdr:'#c8e6c9',txt:'#1a1a1a',mu:'#4a4a4a'};

const SECOES = [
  {id:'capa',        icon:'🏛️', label:'Capa'},
  {id:'mensagem',    icon:'💬', label:'Mensagem da Prefeita'},
  {id:'municipio',   icon:'📍', label:'Apresentação do Município'},
  {id:'economico',   icon:'💼', label:'Perfil Econômico'},
  {id:'indicadores', icon:'📊', label:'Indicadores Sociais'},
  {id:'avancos',     icon:'🏗️', label:'Avanços da Gestão'},
  {id:'modernizacao',icon:'💻', label:'Modernização da Gestão'},
  {id:'demandas',    icon:'📌', label:'Demandas Estratégicas'},
  {id:'projetos',    icon:'📋', label:'Projetos Prioritários'},
  {id:'impacto',     icon:'🎯', label:'Impacto Social'},
  {id:'capacidade',  icon:'⚙️', label:'Capacidade Técnica'},
  {id:'parcerias',   icon:'🤝', label:'Parcerias Institucionais'},
  {id:'contatos',    icon:'📞', label:'Considerações e Contatos'},
];

let _apresSecAtiva = 0;

function renderApresentacao() {
  const el = document.getElementById('content');
  if (!el) return;
  el.innerHTML = `
  <div id="apres-root" style="font-family:'Segoe UI',system-ui,sans-serif;background:${GR.bg};min-height:100%;color:${GR.txt}">
    <div style="background:linear-gradient(135deg,${GR.dk} 0%,${GR.md} 60%,${GR.lt} 100%);padding:18px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:16px">
        <img src="img/logo_sertania.png" onerror="this.style.display='none'" style="height:52px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))">
        <div>
          <div style="color:${GR.lt};font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase">Apresentação Institucional</div>
          <div style="color:#fff;font-size:22px;font-weight:900;line-height:1.1">PREFEITURA DE SERTÂNIA</div>
          <div style="color:#b9f5b9;font-size:11px;margin-top:2px">Captação de Recursos Federais &amp; Parcerias Governamentais • Brasília – DF • ${AD.ano}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button onclick="apresGerarPdfCompleto()" style="background:${GR.lt};color:#1a1a1a;border:none;border-radius:8px;padding:11px 20px;font-size:13px;font-weight:800;cursor:pointer">📄 PDF Completo</button>
        <button onclick="apresGerarPdfResumido()" style="background:rgba(255,255,255,.15);color:#fff;border:2px solid ${GR.lt};border-radius:8px;padding:11px 20px;font-size:13px;font-weight:800;cursor:pointer">📋 PDF Resumido (5 pág.)</button>
      </div>
    </div>
    <div style="display:flex;min-height:calc(100vh - 100px)">
      <div style="width:210px;flex-shrink:0;background:${GR.dk};padding:8px 0;overflow-y:auto">
        ${SECOES.map((s,i)=>`<button onclick="apresIr(${i})" id="apn${i}" style="width:100%;text-align:left;padding:9px 14px;background:transparent;border:none;color:#b9f5b9;font-size:11.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;border-left:3px solid transparent;transition:all .15s">
          <span style="min-width:20px;color:${GR.lt};font-size:11px">${i+1}.</span><span style="flex:1">${s.label}</span></button>`).join('')}
      </div>
      <div id="apres-body" style="flex:1;overflow-y:auto;padding:28px 32px"></div>
    </div>
  </div>`;
  apresIr(0);
}

function apresIr(idx) {
  _apresSecAtiva = idx;
  document.querySelectorAll('[id^="apn"]').forEach((b,i)=>{
    b.style.background = i===idx ? 'rgba(110,192,46,.18)' : 'transparent';
    b.style.borderLeftColor = i===idx ? GR.lt : 'transparent';
    b.style.color = i===idx ? '#fff' : '#b9f5b9';
  });
  const body = document.getElementById('apres-body');
  if (!body) return;
  body.innerHTML = APRES_SECOES_HTML[SECOES[idx].id]();
  body.scrollTop = 0;
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────
const _card = (titulo,cor,conteudo) => `<div style="background:#fff;border:1px solid ${GR.bdr};border-radius:12px;overflow:hidden;margin-bottom:20px"><div style="background:${cor};padding:12px 20px"><h3 style="color:#fff;margin:0;font-size:14px;font-weight:800">${titulo}</h3></div><div style="padding:20px;color:${GR.txt}">${conteudo}</div></div>`;
const _badge = t => `<span style="display:inline-block;background:${GR.lt}22;color:${GR.md};border:1px solid ${GR.lt}66;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;margin:3px">${t}</span>`;
const _stat = (v,l,cor) => `<div style="background:#fff;border:1px solid ${GR.bdr};border-radius:10px;padding:16px 20px;text-align:center"><div style="font-size:22px;font-weight:900;color:${cor}">${v}</div><div style="font-size:11px;color:${GR.mu};margin-top:3px">${l}</div></div>`;
const _li = t => `<div style="padding:7px 0;border-bottom:1px solid ${GR.bdr};font-size:13px;color:${GR.txt};display:flex;align-items:center;gap:8px"><span style="color:${GR.lt};font-weight:900">▸</span>${t}</div>`;
const _h1 = (icon,t,sub) => `<div style="margin-bottom:24px"><div style="font-size:28px;font-weight:900;color:${GR.dk};display:flex;align-items:center;gap:10px">${icon} ${t}</div>${sub?`<div style="color:${GR.mu};font-size:13px;margin-top:4px">${sub}</div>`:''}<div style="height:3px;background:linear-gradient(90deg,${GR.lt},transparent);border-radius:2px;margin-top:10px"></div></div>`;
const _grid = (n,html) => `<div style="display:grid;grid-template-columns:repeat(${n},1fr);gap:14px">${html}</div>`;
const _quote = (txt,autor) => `<div style="background:${GR.dk};border-radius:14px;padding:28px 32px;margin:8px 0"><div style="color:${GR.lt};font-size:32px;line-height:1;margin-bottom:8px">"</div><p style="color:#fff;font-size:16px;line-height:1.7;font-style:italic;margin:0 0 14px">${txt.replace(/^"|"$/g,'')}</p>${autor?`<div style="color:${GR.lt};font-size:13px;font-weight:700">— ${autor}</div>`:''}</div>`;

// ─── Conteúdo de cada seção ───────────────────────────────────────────────────
const APRES_SECOES_HTML = {
  capa: ()=>`
    ${_h1('🏛️','Apresentação Institucional','Captação de Recursos Federais e Parcerias Governamentais')}
    <div style="background:linear-gradient(135deg,${GR.dk},${GR.md});border-radius:16px;padding:40px 36px;text-align:center;color:#fff;margin-bottom:24px">
      <img src="img/logo_sertania.png" onerror="this.style.display='none'" style="height:80px;margin-bottom:20px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4))">
      <div style="font-size:13px;color:${GR.lt};letter-spacing:2px;text-transform:uppercase;font-weight:700">Prefeitura Municipal de</div>
      <div style="font-size:42px;font-weight:900;margin:6px 0">SERTÂNIA</div>
      <div style="font-size:16px;color:#b9f5b9;margin-bottom:20px">Pernambuco — Sertão do Moxotó</div>
      <div style="background:rgba(255,255,255,.1);border-radius:10px;padding:16px 24px;display:inline-block">
        <div style="font-size:12px;color:${GR.lt};font-weight:700;text-transform:uppercase;margin-bottom:6px">Gestão Municipal</div>
        <div style="font-size:18px;font-weight:800">${AD.prefeita}</div>
        <div style="font-size:13px;color:#b9f5b9">${AD.periodo}</div>
        <div style="font-size:12px;color:${GR.lt};margin-top:4px;font-style:italic">"${AD.slogan}"</div>
      </div>
      <div style="margin-top:20px;font-size:13px;color:#b9f5b9">Brasília – DF &nbsp;|&nbsp; ${AD.ano}</div>
    </div>
    ${_grid(4,_stat(AD.populacao,'Habitantes',GR.md)+_stat(AD.area,'Território',GR.md)+_stat(AD.idh,'IDH (2010)',GR.md)+_stat('147°','Anos de História',GR.lt))}`,

  mensagem: ()=>`
    ${_h1('💬','Mensagem da Prefeita')}
    ${_quote(AD.mensagem, `${AD.prefeita} — Prefeita Municipal de Sertânia`)}
    <div style="background:#fff;border:1px solid ${GR.bdr};border-radius:10px;padding:20px;margin-top:16px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,${GR.dk},${GR.lt});border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">👩‍💼</div>
        <div><div style="font-weight:800;font-size:15px;color:${GR.dk}">${AD.prefeita}</div><div style="color:${GR.mu};font-size:12px">Prefeita Municipal de Sertânia</div><div style="color:${GR.lt};font-size:12px;font-weight:700">Gestão ${AD.periodo}</div></div>
      </div>
    </div>`,

  municipio: ()=>`
    ${_h1('📍','Apresentação do Município','Sertânia — Sertão do Moxotó, Pernambuco')}
    ${_card('Dados Gerais',GR.md,`<table style="width:100%;border-collapse:collapse;font-size:13px">
      ${[['Município',AD.municipio],['Estado',AD.estado],['Região',AD.regiao],['Fundação',AD.fundacao],['População',`${AD.populacao} (${AD.populacaoFonte})`],['Área Territorial',AD.area],['PIB Municipal',`${AD.pib} (${AD.pibFonte})`],['IDH',`${AD.idh} (${AD.idhAno})`],['Distância da Capital',AD.distancia],['Principais Acessos',AD.acessos]].map(([k,v],i)=>`<tr style="background:${i%2?'#f9fdf9':'#fff'}"><td style="padding:9px 12px;font-weight:700;color:${GR.dk};border-bottom:1px solid ${GR.bdr};width:42%">${k}</td><td style="padding:9px 12px;color:${GR.mu};border-bottom:1px solid ${GR.bdr}">${v}</td></tr>`).join('')}
    </table>`)}
    ${_card('Breve Histórico',GR.dk,`<p style="font-size:13px;line-height:1.7;color:${GR.mu}">Sertânia nasceu de uma história de amor às margens do Rio Moxotó, no século XIX. A fazenda Alagoa de Baixo, fundada pelo casal Antão e Catarina, deu origem à cidade. Em <strong>1878</strong> foi instalado o município, e em <strong>1909</strong> elevada à categoria de cidade. Situada no Sertão Pernambucano, a 310 km de Recife, é referência regional no Sertão do Moxotó.</p>`)}`,

  economico: ()=>`
    ${_h1('💼','Perfil Econômico','Principais atividades e potencialidades')}
    ${_grid(2,
      _card('Principais Atividades Econômicas',GR.md,['Comércio local e regional','Agricultura familiar','Pecuária extensiva','Prestação de serviços','Empreendedorismo local','Funcionalismo público'].map(_li).join(''))+
      _card('Potencialidades do Município',GR.lt,['Desenvolvimento regional estratégico','Turismo cultural e religioso','Eventos tradicionais e culturais','Agricultura familiar sustentável','Energia solar e eólica','Infraestrutura logística (BR-232)'].map(_li).join(''))
    )}`,

  indicadores: ()=>`
    ${_h1('📊','Indicadores Sociais','Saúde, Educação e Assistência Social')}
    ${_card('🏥 Saúde',GR.md,_grid(2,
      ['Unidades Básicas de Saúde (UBS)','Cobertura da Estratégia Saúde da Família (ESF)','Atendimentos ambulatoriais anuais','Programas de saúde preventiva ativos','CAPS — Centro de Atenção Psicossocial','Vigilância epidemiológica ativa'].map(t=>`<div style="background:${GR.bg};border-radius:8px;padding:11px 14px;font-size:12.5px;font-weight:600;color:${GR.dk};border-left:3px solid ${GR.lt}">${t}</div>`).join('')
    ))}
    ${_card('🎓 Educação',GR.md,_grid(2,
      ['Escolas municipais e estaduais','Alunos matriculados na rede pública','Transporte escolar para zona rural','Programas do MEC ativos no município','Merenda escolar para todos os alunos','Tecnologia educacional nas escolas'].map(t=>`<div style="background:${GR.bg};border-radius:8px;padding:11px 14px;font-size:12.5px;font-weight:600;color:${GR.dk};border-left:3px solid ${GR.lt}">${t}</div>`).join('')
    ))}
    ${_card('🤲 Assistência Social',GR.md,['CRAS — Centro de Referência de Assistência Social','Programas sociais federais (Bolsa Família, BPC, PETI)','Atendimento às famílias em situação de vulnerabilidade','Cadastro Único atualizado','Serviços de convivência e fortalecimento de vínculos'].map(_li).join(''))}`,

  avancos: ()=>`
    ${_h1('🏗️','Avanços da Gestão Municipal','Principais realizações 2025–2026')}
    ${_card('Obras e Infraestrutura',GR.dk,['Pavimentação de ruas e avenidas no perímetro urbano','Reforma e ampliação de unidades escolares','Drenagem pluvial e melhorias viárias','Ampliação da cobertura de saúde pública'].map(_li).join(''))}
    ${_card('Modernização Administrativa',GR.md,['Implantação de sistemas digitais de gestão','Modernização do controle interno','Valorização e capacitação dos servidores públicos','Gestão transparente com publicação em portal eletrônico','Implantação do SEI — Sistema Eletrônico de Informações'].map(_li).join(''))}`,

  modernizacao: ()=>`
    ${_h1('💻','Modernização da Gestão','Administração digital e eficiente')}
    ${_grid(2,
      ['🖥️ Implantação do SEI','📊 Transparência pública total','🌐 Gestão digital de documentos','🔍 Controle interno fortalecido','📅 Planejamento estratégico','💰 Captação ativa de recursos'].map((t,i)=>`<div style="background:#fff;border:1px solid ${GR.bdr};border-radius:10px;padding:18px;display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;background:linear-gradient(135deg,${GR.md},${GR.lt});border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${t.split(' ')[0]}</div><div style="font-size:13px;font-weight:700;color:${GR.dk}">${t.substring(2).trim()}</div></div>`).join('')
    )}`,

  demandas: ()=>`
    ${_h1('📌','Principais Demandas Estratégicas','Áreas prioritárias para captação de recursos')}
    ${_grid(2,
      _card('🛣️ Infraestrutura',GR.dk,['Pavimentação urbana e rural','Sistema de drenagem pluvial','Iluminação pública com LED','Mobilidade urbana e calçadas'].map(_li).join(''))+
      _card('🏥 Saúde',GR.md,['Ampliação e reforma de UBS','Aquisição de equipamentos médicos','Veículos para atendimento e SAMU','Especialidades médicas e CAPS'].map(_li).join(''))+
      _card('🎓 Educação',GR.dk,['Construção e reforma de escolas','Creches e pré-escola','Transporte escolar sustentável','Tecnologia educacional'].map(_li).join(''))+
      _card('🌾 Agricultura',GR.md,['Máquinas e implementos agrícolas','Perfuração de poços artesianos','Estradas vicinais e ramais','Apoio à agricultura familiar'].map(_li).join(''))
    )}`,

  projetos: ()=>`
    ${_h1('📋','Projetos Prioritários','Carteira de projetos para captação de recursos federais')}
    ${_card('Projetos Estratégicos',GR.md,`<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:${GR.dk}">
        ${['Projeto','Área','Valor Estimado','Beneficiados'].map(h=>`<th style="color:#fff;padding:10px 12px;text-align:left;font-size:12px">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${[
          ['Pavimentação Urbana — Etapa I','Infraestrutura','R$ 3,5 milhões','12.000 pessoas'],
          ['Nova UBS — Bairro Novo','Saúde','R$ 1,2 milhão','8.000 pessoas'],
          ['Creche Municipal — Zona Norte','Educação','R$ 1,8 milhão','300 famílias'],
          ['Máquinas Agrícolas — Zona Rural','Agricultura','R$ 900 mil','Zona Rural'],
          ['Iluminação Pública LED','Infraestrutura','R$ 2,1 milhões','15.000 pessoas'],
          ['Reforma Escolar — 4 Unidades','Educação','R$ 1,4 milhão','1.800 alunos'],
          ['Poços Artesianos — Comunidades','Agricultura','R$ 600 mil','2.000 famílias'],
          ['Drenagem Pluvial Urbana','Infraestrutura','R$ 2,8 milhões','10.000 pessoas'],
        ].map(([p,a,v,b],i)=>`<tr style="background:${i%2?'#f9fdf9':'#fff'}">
          <td style="padding:9px 12px;font-weight:600;color:${GR.dk};border-bottom:1px solid ${GR.bdr}">${p}</td>
          <td style="padding:9px 12px;border-bottom:1px solid ${GR.bdr}">${_badge(a)}</td>
          <td style="padding:9px 12px;font-weight:700;color:${GR.md};border-bottom:1px solid ${GR.bdr}">${v}</td>
          <td style="padding:9px 12px;border-bottom:1px solid ${GR.bdr}">${b}</td>
        </tr>`).join('')}
      </tbody>
    </table>`)}`,

  impacto: ()=>`
    ${_h1('🎯','Impacto Social dos Investimentos','Resultados esperados com a captação de recursos')}
    ${_grid(3,
      [['Empregos Gerados','500+',GR.md],['Famílias Beneficiadas','8.000+',GR.dk],['Infraestrutura Atendida','70% da cidade',GR.lt]].map(([l,v,c])=>_stat(v,l,c)).join('')
    )}
    ${_card('Resultados Esperados',GR.md,['Geração de emprego direto e indireto na construção civil','Redução das desigualdades sociais e regionais','Fortalecimento da economia local e do comércio','Inclusão social de famílias em vulnerabilidade','Desenvolvimento sustentável com energia renovável','Melhoria significativa da qualidade de vida da população'].map(_li).join(''))}`,

  capacidade: ()=>`
    ${_h1('⚙️','Capacidade Técnica da Prefeitura','Estrutura administrativa e compromisso institucional')}
    ${_grid(2,
      _card('Estrutura Administrativa',GR.md,['Equipe técnica qualificada e capacitada','Engenharia e projetos com ART/RRT','Setor de Convênios e Captação ativo','Planejamento estratégico formalizado','Controle Interno independente e estruturado','Transparência pública certificada'].map(_li).join(''))+
      _card('Compromisso Institucional',GR.dk,['Prestação de contas em dia com TCE-PE','Responsabilidade fiscal (Lei de Responsabilidade Fiscal)','Execução eficiente dos recursos públicos','Desburocratização e modernização contínua','Relatório de gestão publicado anualmente','Portal de transparência atualizado diariamente'].map(_li).join(''))
    )}`,

  parcerias: ()=>`
    ${_h1('🤝','Parcerias Institucionais','Relações com o Governo Federal, Estadual e entidades')}
    ${_grid(2,
      _card('Governo Federal e Ministérios',GR.md,['Ministério das Cidades — infraestrutura urbana','Ministério da Saúde — UBS e equipamentos','Ministério da Educação — FNDE / PAR','Ministério do Desenvolvimento Agrário','CODEVASF — Infraestrutura hídrica','FNDE — Transporte e merenda escolar'].map(_li).join(''))+
      _card('Governo Estadual e Parceiros',GR.dk,['Governo do Estado de Pernambuco','Secretaria Estadual de Saúde (SES-PE)','Secretaria Estadual de Educação','Bancada parlamentar federal e estadual','Senadores e Deputados — emendas parlamentares','Instituições financeiras e de fomento (BNB, CEF)'].map(_li).join(''))
    )}`,

  contatos: ()=>`
    ${_h1('📞','Considerações Finais e Contatos')}
    ${_quote(AD.msgFinal)}
    <div style="background:#fff;border:2px solid ${GR.bdr};border-radius:14px;padding:24px 28px;margin-top:20px">
      <div style="font-size:16px;font-weight:800;color:${GR.dk};margin-bottom:16px">📍 Prefeitura Municipal de Sertânia — Gabinete da Prefeita</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${[['📍 Endereço',AD.endereco],['📮 CEP',AD.cep],['☎️ Telefone',AD.telefone],['📧 E-mail',AD.email],['🌐 Site',AD.site],['📱 Instagram',AD.instagram]].map(([k,v])=>`<div style="background:${GR.bg};border-radius:8px;padding:10px 14px"><div style="font-size:11px;color:${GR.mu};font-weight:700">${k}</div><div style="font-size:13px;font-weight:700;color:${GR.dk};margin-top:2px">${v}</div></div>`).join('')}
      </div>
    </div>
    <div style="background:${GR.dk};border-radius:12px;padding:20px 24px;margin-top:16px;text-align:center">
      <div style="color:${GR.lt};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">QR Code — Acesso Digital</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('https://'+AD.site)}&color=ffffff&bgcolor=145214" style="margin:10px auto;display:block;border-radius:8px">
      <div style="color:#b9f5b9;font-size:11px">${AD.site}</div>
    </div>`,
};

// ─── Helper imagem→dataURL ────────────────────────────────────────────────────
function _imgData(src){return new Promise(r=>{const i=new Image();i.crossOrigin='Anonymous';i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);r({data:c.toDataURL('image/png'),w:i.naturalWidth,h:i.naturalHeight});};i.onerror=()=>r(null);i.src=src;});}
function _lSize(lObj,maxW,maxH){if(!lObj||!lObj.w)return{data:lObj?lObj.data:null,w:maxW,h:maxH};const ar=lObj.w/lObj.h;let w=maxW,h=maxW/ar;if(h>maxH){h=maxH;w=maxH*ar;}return{data:lObj.data,w,h};}

// ─── PDF Completo ────────────────────────────────────────────────────────────
async function apresGerarPdfCompleto() {
  if (!window.jspdf) { alert('PDF indisponível. Aguarde o carregamento da página.'); return; }
  const lObj = await _imgData('img/logo_sertania.png');
  const logo = lObj ? lObj.data : null;
  const doc = new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210, H=297, mx=18, cw=W-mx*2;

  function bgTextura(y0,y1){
    doc.setFillColor(215,242,215);
    for(let gx=18;gx<=192;gx+=7){for(let gy=y0;gy<=y1;gy+=7){doc.circle(gx,gy,0.28,'F');}}
  }

  function cabecalho(titulo,pg,total) {
    bgTextura(36,278);
    doc.setFillColor(245,252,245); doc.rect(0,0,W,32,'F');
    doc.setFillColor(20,82,20); doc.rect(0,0,6,32,'F');
    doc.setFillColor(110,192,46); doc.rect(0,29,W,3,'F');
    if(logo){const ls=_lSize(lObj,22,26);doc.addImage(ls.data,'PNG',W-mx-ls.w,1+(26-ls.h)/2,ls.w,ls.h);}
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20);
    doc.text(titulo,mx+10,14);
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(30,123,30);
    doc.text('Prefeitura de Sertânia — PE  •  Gestão '+AD.periodo+'  •  '+AD.prefeita,mx+10,22);
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46);
    doc.text(pg+'/'+total,W-mx-20,22,{align:'right'});
  }

  function rodape() {
    doc.setFillColor(20,82,20); doc.rect(0,283,W,14,'F');
    doc.setFillColor(110,192,46); doc.rect(0,283,W,2,'F');
    if(logo){const ls=_lSize(lObj,14,11);doc.addImage(ls.data,'PNG',mx,285+(11-ls.h)/2,ls.w,ls.h);}
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(185,245,185);
    doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA — PE',mx+16,289.5);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(180,240,180);
    doc.text(AD.endereco+'  |  '+AD.telefone+'  |  '+AD.email,W/2,295,{align:'center'});
    doc.setFontSize(7); doc.setTextColor(110,192,46); doc.setFont('helvetica','bold');
    doc.text(AD.site,W-mx,289.5,{align:'right'});
  }

  function secTitulo(txt,y) {
    doc.setFillColor(30,123,30); doc.roundedRect(mx,y,cw,9,2,2,'F');
    doc.setFontSize(11); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
    doc.text(txt,mx+4,y+6.5);
    return y+14;
  }

  function linha(label,valor,y,cor) {
    if (y > 268) { doc.addPage(); rodape(); y = 40; }
    doc.setFontSize(9); doc.setTextColor(20,82,20); doc.setFont('helvetica','bold'); doc.text(label,mx,y);
    doc.setTextColor(cor||50,cor?30:50,cor?30:50); doc.setFont('helvetica','normal'); doc.text(String(valor),mx+58,y);
    return y+7;
  }

  function texto(txt,y,sz) {
    const lines = doc.splitTextToSize(String(txt),(sz||cw));
    if (y+lines.length*5 > 268) { doc.addPage(); rodape(); y=40; }
    doc.setFontSize(10); doc.setTextColor(50,50,50); doc.setFont('helvetica','normal');
    doc.text(lines,mx,y);
    return y+lines.length*5+4;
  }

  const total = 14;
  // P1 — Capa (fundo branco, verde como destaque)
  doc.setFillColor(255,255,255); doc.rect(0,0,W,H,'F');
  bgTextura(62,275);
  doc.setFillColor(20,82,20); doc.rect(0,0,W,58,'F');
  doc.setFillColor(110,192,46); doc.rect(0,54,W,4,'F');
  if(logo){const ls=_lSize(lObj,52,50);doc.addImage(ls.data,'PNG',mx,4+(50-ls.h)/2,ls.w,ls.h);}
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46);
  doc.text('PREFEITURA MUNICIPAL DE',mx+56,14);
  doc.setFontSize(28); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('SERT\u00c2NIA',mx+56,34);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185);
  doc.text('Pernambuco \u2014 Sert\u00e3o do Moxot\u00f3',mx+56,44);
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46);
  doc.text('"'+AD.slogan+'"',W-mx,52,{align:'right'});
  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30,123,30);
  doc.text('APRESENTAÇÃO INSTITUCIONAL',W/2,72,{align:'center'});
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100);
  doc.text('Captação de Recursos Federais e Parcerias Governamentais',W/2,81,{align:'center'});
  doc.setFillColor(110,192,46); doc.rect(mx+20,85,cw-40,1.5,'F');
  const sw4=Math.floor((cw-18)/4);
  [['67.820','Habitantes'],['2.885km²','Território'],['0,563','IDH 2010'],['147 anos','História']].forEach(([v,l],i)=>{
    const sx=mx+i*(sw4+6);
    doc.setFillColor(245,252,245); doc.roundedRect(sx,91,sw4,26,2,2,'F');
    doc.setDrawColor(110,192,46); doc.setLineWidth(0.5); doc.roundedRect(sx,91,sw4,26,2,2,'S');
    doc.setFillColor(110,192,46); doc.rect(sx,91,sw4,3,'F');
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20);
    doc.text(v,sx+sw4/2,105,{align:'center'});
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
    doc.text(l,sx+sw4/2,113,{align:'center'});
  });
  doc.setFillColor(20,82,20); doc.roundedRect(mx,130,cw,42,3,3,'F');
  doc.setFillColor(110,192,46); doc.rect(mx,130,5,42,'F');
  if(logo){const ls=_lSize(lObj,32,34);doc.addImage(ls.data,'PNG',mx+8,134+(34-ls.h)/2,ls.w,ls.h);}
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46);
  doc.text('GESTÃO MUNICIPAL',mx+46,141);
  doc.setFontSize(18); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text(AD.prefeita,mx+46,154);
  doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185);
  doc.text('Prefeita Municipal — '+AD.periodo,mx+46,163);
  doc.setFontSize(9); doc.setFont('helvetica','italic'); doc.setTextColor(110,192,46);
  doc.text('"'+AD.slogan+'"',W/2,177,{align:'center'});
  doc.setFillColor(110,192,46); doc.rect(0,185,W,1.5,'F');
  doc.setFillColor(245,252,245); doc.rect(0,187,W,30,'F');
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20);
  doc.text('INFORMAÇÕES DE CONTATO',W/2,196,{align:'center'});
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
  doc.text(AD.endereco,W/2,204,{align:'center'});
  doc.text('Tel: '+AD.telefone+'  |  '+AD.email,W/2,211,{align:'center'});
  doc.text(AD.site+'  |  Instagram: '+AD.instagram,W/2,217,{align:'center'});
  doc.setFillColor(110,192,46); doc.rect(0,221,W,1.5,'F');
  const swCov=Math.floor((cw-15)/4);
  [['R$16mi+','Em Captacao'],['14','Secretarias'],['2.500+','Servidores'],['100%','Transparencia']].forEach(([v,l],i)=>{
    const sx=mx+i*(swCov+5); doc.setFillColor(20,82,20); doc.roundedRect(sx,225,swCov,22,2,2,'F');
    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+swCov/2,237,{align:'center'});
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+swCov/2,244,{align:'center'});
  });
  doc.setFillColor(110,192,46); doc.rect(0,250,W,1.5,'F');
  doc.setFillColor(245,252,245); doc.rect(0,252,W,24,'F');
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20);
  doc.text('MISSAO DA GESTAO MUNICIPAL',mx+4,260);
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55);
  doc.text('Promover o desenvolvimento sustentavel de Sertania com planejamento, responsabilidade',mx+4,267);
  doc.text('fiscal e captacao ativa de recursos que melhorem a qualidade de vida do nosso povo.',mx+4,273);
  doc.setFillColor(110,192,46); doc.rect(0,278,W,1,'F');
  doc.setFillColor(20,82,20); doc.rect(0,H-18,W,18,'F');
  doc.setFillColor(110,192,46); doc.rect(0,H-18,W,2,'F');
  if(logo){const ls=_lSize(lObj,14,12);doc.addImage(ls.data,'PNG',mx,H-15+(12-ls.h)/2,ls.w,ls.h);}
  doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185);
  doc.text('www.'+AD.site+'  |  '+AD.instagram,W/2,H-5,{align:'center'});

  // P2 — Mensagem da Prefeita (página completa)
  doc.addPage(); cabecalho('2. Mensagem da Prefeita',2,total); rodape();
  let y=38;
  doc.setFillColor(20,82,20); doc.roundedRect(mx,y,cw,72,3,3,'F');
  doc.setFillColor(110,192,46); doc.rect(mx,y,5,72,'F');
  doc.setFontSize(28); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text('"',mx+10,y+16);
  const qlines=doc.splitTextToSize(AD.mensagem.replace(/^"|"$/g,''),cw-18);
  doc.setFontSize(10.5); doc.setFont('helvetica','italic'); doc.setTextColor(255,255,255); doc.text(qlines,mx+10,y+24);
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46);
  doc.text('— '+AD.prefeita+', Prefeita Municipal de Sertânia',mx+10,y+66);
  y+=76;
  const sw2=Math.floor((cw-18)/4);
  [['14','Secretarias'],['2.500+','Servidores'],['R$16mi+','Projetos'],['100%','Transparência']].forEach(([v,l],i)=>{
    const sx=mx+i*(sw2+6);
    doc.setFillColor(20,82,20); doc.roundedRect(sx,y,sw2,24,2,2,'F');
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+sw2/2,y+14,{align:'center'});
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+sw2/2,y+21,{align:'center'});
  });
  y+=28; y=secTitulo('Prioridades Estratégicas da Gestão 2025–2028',y);
  [['Captação de Recursos Federais','Uso intensivo de Transferegov, emendas parlamentares e convênios federais para acelerar obras e serviços públicos em Sertânia.'],
   ['Modernização e Transparência Total','Implantação do SEI, portais digitais, controle interno fortalecido e prestação de contas em dia com todos os órgãos de controle.'],
   ['Infraestrutura para o Povo','Pavimentação de ruas e avenidas, drenagem pluvial, iluminação LED e obras estruturantes na zona urbana e rural.'],
   ['Saúde, Educação e Assistência Social','Reforma de UBS, novas creches e escolas, fortalecimento da assistência social e inclusão de famílias vulneráveis.'],
   ['Agricultura e Desenvolvimento Rural','Máquinas agrícolas, poços artesianos, estradas vicinais e suporte à agricultura familiar e ao agronegócio sustentável.']
  ].forEach(([tit,desc])=>{
    if(y>261){return;}
    doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,19,2,2,'F');
    doc.setFillColor(20,82,20); doc.rect(mx,y,5,19,'F');
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(tit,mx+9,y+7.5);
    const dl=doc.splitTextToSize(desc,cw-14);
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(70,70,70); doc.text(dl,mx+9,y+13.5);
    y+=22;
  });
  if(y<=260){doc.setFillColor(20,82,20); doc.roundedRect(mx,y,cw,14,2,2,'F'); doc.setFontSize(9); doc.setFont('helvetica','italic'); doc.setTextColor(185,245,185); doc.text('"Sertânia merece o melhor. Juntos vamos buscar isso para o nosso povo." — '+AD.prefeita,W/2,y+9.5,{align:'center'});}

  // P3 — Município (página completa)
  doc.addPage(); cabecalho('3. Apresentação do Município',3,total); rodape();
  y=secTitulo('Dados Gerais do Município de Sertânia',38);
  [['Município',AD.municipio],['Estado',AD.estado],['Região',AD.regiao],['Fundação',AD.fundacao],['População',AD.populacao+' ('+AD.populacaoFonte+')'],['Área Territorial',AD.area],['PIB Municipal',AD.pib+' ('+AD.pibFonte+')'],['IDH',AD.idh+' — '+AD.idhAno],['Distância de Recife',AD.distancia],['Principais Acessos',AD.acessos]].forEach(([k,v],i)=>{
    if(i%2===0){doc.setFillColor(245,252,245);doc.rect(mx,y,cw,8,'F');}
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(k,mx+3,y+5.5);
    doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55); doc.text(String(v),mx+60,y+5.5);
    doc.setDrawColor(200,235,200); doc.setLineWidth(0.2); doc.line(mx,y+8,mx+cw,y+8); y+=8;
  });
  y+=4; y=secTitulo('Contexto Geográfico, Histórico e Cultural',y);
  const ctxL=doc.splitTextToSize('Sertânia está localizada no Sertão do Moxotó, a 310 km de Recife via BR-232. Fundada em 1878, às margens do Rio Moxotó, carrega traços fortes da cultura sertaneja: festas de São João e Santo Antônio, artesanato típico, culinária nordestina e o orgulho do povo do semiárido. Com 2.885 km², é referência regional em saúde, comércio e educação.',cw-4);
  doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50); doc.text(ctxL,mx+2,y); y+=ctxL.length*5.5+6;
  y=secTitulo('Aspectos Populacionais e Sociais',y);
  [['População Urbana','Concentrada na sede municipal e nos bairros periféricos, com crescimento constante nos últimos anos.'],
   ['Zona Rural','Comunidades nos distritos com agricultura familiar, pecuária e acesso a serviços públicos em expansão.'],
   ['Públicos Prioritários','Crianças, idosos, pessoas com deficiência e famílias em situação de vulnerabilidade socioeconômica.'],
   ['Identidade Cultural','Festas tradicionais, artesanato, literatura de cordel e forte identidade sertaneja nordestina.']
  ].forEach(([k,v],i)=>{
    if(y>264){return;}
    if(i%2===0){doc.setFillColor(245,252,245);doc.rect(mx,y,cw,15,'F');}
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(k,mx+3,y+6);
    const vl=doc.splitTextToSize(v,cw-63); doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55); doc.text(vl,mx+60,y+6);
    doc.setDrawColor(200,235,200); doc.setLineWidth(0.2); doc.line(mx,y+15,mx+cw,y+15); y+=15;
  });
  if(y<262){
    y+=4; const sw3=Math.floor((cw-15)/4);
    [['1878','Fundação'],['147 anos','Histórico'],['310 km','De Recife'],['BR-232','Via de Acesso']].forEach(([v,l],i)=>{
      const sx=mx+i*(sw3+5);
      doc.setFillColor(20,82,20); doc.roundedRect(sx,y,sw3,22,2,2,'F');
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+sw3/2,y+13,{align:'center'});
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+sw3/2,y+20,{align:'center'});
    }); y+=26;
  }
  if(y<270){doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,12,2,2,'F'); doc.setFillColor(110,192,46); doc.rect(mx,y,5,12,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','italic'); doc.setTextColor(30,80,30); doc.text('"Terra de gente forte e trabalhadora, Sertânia avança com orgulho no Sertão do Moxotó."',mx+9,y+8);}

  // P4 — Perfil Econômico (página completa)
  doc.addPage(); cabecalho('4. Perfil Econômico',4,total); rodape();
  y=secTitulo('Principais Atividades Econômicas do Município',38);
  ['Comércio local e regional — principal polo comercial do Sertão do Moxotó com serviços diversificados',
   'Agricultura familiar: milho, feijão, mandioca, fruticultura irrigada e apicultura de alto valor',
   'Pecuária extensiva: criação de bovinos, caprinos, ovinos e suínos em toda a zona rural',
   'Prestação de serviços públicos e privados com alcance nos municípios vizinhos',
   'Empreendedorismo local: micro e pequenas empresas em crescimento constante',
   'Funcionalismo público municipal, estadual e federal gerando renda e aquecendo o comércio',
   'Serviços de transporte, logística e abastecimento regional pela BR-232'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; const sw4b=Math.floor((cw-15)/4);
  [['R$420mi','PIB Municipal'],['67.820','Habitantes'],['2.885km²','Território'],['BR-232','Corredor Logístico']].forEach(([v,l],i)=>{
    const sx=mx+i*(sw4b+5);
    doc.setFillColor(20,82,20); doc.roundedRect(sx,y,sw4b,24,2,2,'F');
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+sw4b/2,y+14,{align:'center'});
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+sw4b/2,y+21,{align:'center'});
  }); y+=28;
  y=secTitulo('Potencialidades Econômicas e Oportunidades',y);
  ['Localização estratégica na BR-232 — corredor logístico entre Recife e o interior do Nordeste',
   'Potencial solar e eólico de alta magnitude — irradiação média superior a 6 kWh/m²/dia',
   'Turismo cultural e religioso — Festa de Santo Antônio com alcance estadual e nacional',
   'Irrigação pelo Rio Moxotó e açudes municipais para fruticultura de alto valor agregado',
   'Apicultura e agricultura orgânica com diferencial de mercado e certificação de origem',
   'Artesanato regional com potencial de exportação e geração de renda para artesãos locais',
   'Expansão comercial pela integração com municípios do entorno e acesso à capital'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; y=secTitulo('Setores Prioritários para Investimento e Parceria',y);
  [['Energia Renovável','Expansão de parques solares e eólicos com incentivos fiscais estaduais e federais disponíveis.'],
   ['Agronegócio Sustentável','Fruticultura irrigada, apicultura orgânica, pecuária melhorada e apoio técnico produtivo.'],
   ['Turismo Rural e Cultural','Roteiros turísticos integrados com natureza, cultura, gastronomia e hospitalidade sertaneja.']
  ].forEach(([tit,desc])=>{
    if(y>265){return;}
    doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,18,2,2,'F'); doc.setFillColor(110,192,46); doc.rect(mx,y,5,18,'F');
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(tit,mx+9,y+7.5);
    const dl=doc.splitTextToSize(desc,cw-14); doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(70,70,70); doc.text(dl,mx+9,y+13.5); y+=21;
  });

  // P5 — Indicadores Sociais (página completa)
  doc.addPage(); cabecalho('5. Indicadores Sociais',5,total); rodape();
  y=secTitulo('Saúde Pública — Rede Municipal de Atendimento',38);
  ['Unidades Básicas de Saúde (UBS) distribuídas por todo o território municipal','Cobertura da Estratégia Saúde da Família (ESF) com equipes multiprofissionais','CAPS — Centro de Atenção Psicossocial em funcionamento com serviços de saúde mental','Programas: vacinação, pré-natal, saúde da mulher, da criança e do idoso ativos','Vigilância epidemiológica e sanitária com acompanhamento contínuo','Parcerias com Governo Estadual para especialidades médicas e exames de alta complexidade'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(20,82,20); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; y=secTitulo('Educação Pública — Rede Escolar Municipal e Estadual',y);
  ['Rede de escolas municipais e estaduais atendendo zonas urbana e rural com qualidade','Transporte escolar garantido para alunos de comunidades rurais distantes','Merenda escolar nutritiva para todos os alunos matriculados na rede pública','Programas MEC em execução: PNAC, PDDE, PNAE e PAR','Laboratórios de informática e tecnologia educacional nas unidades escolares','Educação infantil com ampliação da rede de creches municipais em andamento'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; y=secTitulo('Assistência Social — CRAS e Programas Federais',y);
  ['CRAS ativo com atendimento regular às famílias em situação de vulnerabilidade social','Programas Bolsa Família, BPC (Benefício de Prestação Continuada) e PETI com acompanhamento','Cadastro Único atualizado e com equipe dedicada de assistentes sociais','Serviços de convivência e fortalecimento de vínculos para crianças, adolescentes e idosos','Ações continuadas para pessoas com deficiência, vítimas de violência e população em risco'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(20,82,20); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  if(y<268){ y+=4; const sw5=Math.floor((cw-15)/4);
    [['100%','Merenda Escolar'],['ESF','Cobertura Saúde'],['CRAS','Assistência Social'],['CadÚnico','Benefícios']].forEach(([v,l],i)=>{ const sx=mx+i*(sw5+5); doc.setFillColor(20,82,20); doc.roundedRect(sx,y,sw5,20,2,2,'F'); doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+sw5/2,y+12,{align:'center'}); doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+sw5/2,y+18,{align:'center'}); });}

  // P6 — Avanços da Gestão (página completa)
  doc.addPage(); cabecalho('6. Avanços da Gestão 2025–2026',6,total); rodape();
  y=secTitulo('Obras e Infraestrutura Executadas',38);
  ['Pavimentação de ruas e avenidas no perímetro urbano com asfalto de qualidade superior','Reforma e ampliação de unidades escolares seguindo padrão e exigências do MEC','Drenagem pluvial e melhorias viárias em bairros críticos da sede municipal','Ampliação da cobertura de saúde com reforma e equipagem de UBS','Iluminação pública com implantação de LED nas principais vias da cidade','Construção e reforma de praças e espaços de lazer para a comunidade'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; y=secTitulo('Modernização Administrativa e Valorização do Servidor',y);
  ['Implantação de sistemas digitais integrados para gestão municipal eficiente','Modernização completa do Controle Interno Municipal com foco preventivo','Plano de cargos, carreiras e salários aprovado e em plena execução','Capacitação contínua dos servidores municipais em cursos e treinamentos','Portal de transparência atualizado conforme exigências da Lei de Acesso à Informação','Desburocratização dos serviços ao cidadão com publicação da Carta de Serviços'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(20,82,20); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; y=secTitulo('Projeções e Metas para 2026–2028',y);
  ['Captação de R$16 milhões+ em recursos federais para obras prioritárias do município','Ampliação da rede de saúde com 2 novas UBS e reforma de 4 unidades existentes','Construção de 1 nova creche municipal e reforma de 5 escolas da rede pública','Pavimentação de mais 25 km de vias urbanas e vicinais em todo o território','Implantação de energia solar nas escolas municipais e prédios administrativos'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  if(y<270){doc.setFillColor(20,82,20); doc.roundedRect(mx,y,cw,14,2,2,'F'); doc.setFontSize(9); doc.setFont('helvetica','italic'); doc.setTextColor(185,245,185); doc.text('"A gestão de Sertânia avança com planejamento, responsabilidade e foco no povo." — '+AD.prefeita,W/2,y+9.5,{align:'center'});}

  // P7 — Modernização da Gestão (página completa)
  doc.addPage(); cabecalho('7. Modernização da Gestão',7,total); rodape();
  y=38;
  [['Sistema SEI — Informações Digitais','Implantação do Sistema Eletrônico de Informações com digitalização total dos processos administrativos. Redução de papel, agilidade e rastreabilidade total dos atos administrativos municipais.'],
   ['Portal de Transparência Total','Portal atualizado diariamente, atendendo requisitos da LAI e LGPD. Acesso público a contratos, licitações, folha de pagamento, receitas, despesas e relatórios de gestão.'],
   ['Controle Interno Fortalecido','Setor independente e estruturado realizando auditoria preventiva, orientativa e corretiva. Relatórios mensais encaminhados ao TCE-PE garantindo conformidade legal.'],
   ['Gestão Financeira Integrada','Sistemas de contabilidade, tesouraria e planejamento integrados com geração de relatórios em tempo real. LRF cumprida em todos os quadrimestres.'],
   ['E-gov e Serviços Digitais','Certidões, alvarás, solicitações e denúncias disponíveis online pelo portal municipal. Redução de filas e agilidade no atendimento ao cidadão.'],
   ['Captação Ativa de Recursos','Setor especializado em convênios federais operando com Transferegov, SICONV e FNDE. Monitoramento diário de editais e programas federais disponíveis.'],
   ['Planejamento Estratégico','Plano Municipal de Desenvolvimento com metas mensuráveis, indicadores de desempenho e revisão anual participativa com a comunidade e técnicos municipais.']
  ].forEach(([titulo,desc])=>{
    if(y>265){return;}
    doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,24,2,2,'F'); doc.setFillColor(20,82,20); doc.rect(mx,y,5,24,'F');
    doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(titulo,mx+9,y+8.5);
    const dl=doc.splitTextToSize(desc,cw-14); doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60); doc.text(dl,mx+9,y+15);
    y+=27;
  });

  // P8 — Demandas Estratégicas (página completa)
  doc.addPage(); cabecalho('8. Demandas Estratégicas',8,total); rodape();
  y=38;
  [['Infraestrutura Urbana e Rural',[20,82,20],['Pavimentação de ruas, avenidas e vias vicinais em todo o município','Sistema completo de drenagem pluvial para eliminar alagamentos','Modernização da iluminação pública com tecnologia LED de eficiência','Mobilidade urbana: calçadas acessíveis, ciclofaixas e sinalizações','Manutenção de pontes, bueiros e estradas rurais para escoamento']],
   ['Saúde Pública e Equipamentos',[30,123,30],['Ampliação e reforma completa de Unidades Básicas de Saúde','Aquisição de equipamentos médicos e odontológicos modernos','Veículos para SAMU, transporte sanitário e atendimento domiciliar','Implantação de especialidades médicas: cardiologia, ortopedia, oftalmologia','Ampliação do CAPS e serviços de saúde mental para a população']],
   ['Educação, Infância e Juventude',[20,82,20],['Construção de creche municipal de grande porte — 200 vagas','Reforma e ampliação de escolas municipais com laboratórios','Tecnologia educacional: computadores, tablets e internet nas escolas','Transporte escolar sustentável e seguro para a zona rural','Quadras poliesportivas cobertas em escolas carentes']],
   ['Agricultura e Desenvolvimento Rural',[30,123,30],['Aquisição de tratores, colheitadeiras e implementos agrícolas modernos','Perfuração de poços artesianos em comunidades sem acesso à água','Recuperação e ampliação de estradas vicinais e ramais rurais','Apoio técnico e financiamento para agricultura familiar orgânica','Projeto de irrigação com aproveitamento das águas do Moxotó']]
  ].forEach(([cat,cor,items])=>{
    if(y>250){return;}
    doc.setFillColor(...cor); doc.roundedRect(mx,y,cw,9,2,2,'F'); doc.setFillColor(110,192,46); doc.rect(mx,y,5,9,'F');
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255); doc.text(cat,mx+9,y+6.5); y+=12;
    items.forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,8,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4,1.2,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+5.5); y+=9; });
    y+=3;
  });

  // P9 — Projetos Prioritários (página completa)
  doc.addPage(); cabecalho('9. Projetos Prioritários',9,total); rodape();
  y=secTitulo('Carteira de Projetos para Captação Federal — 2025/2028',38);
  const cols=[54,35,30,36,19]; const heads=['Projeto','Área','Valor Est.','Beneficiados','St.'];
  doc.setFillColor(20,82,20); doc.rect(mx,y,cw,9,'F');
  let cx=mx; heads.forEach((h,i)=>{ doc.setFontSize(8.5); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text(h,cx+2,y+6); cx+=cols[i]; }); y+=9;
  [['Pavimentação Urbana — Etapa I','Infraestrutura','R$ 3,5 mi','12.000 pess.',['Elab.',20,100,190]],
   ['Nova UBS — Bairro Novo','Saúde','R$ 1,2 mi','8.000 pess.',['Capt.',190,130,0]],
   ['Creche Municipal 200 vagas','Educação','R$ 1,8 mi','300 famílias',['Elab.',20,100,190]],
   ['Maquinas e Implementos','Agricultura','R$ 900 mil','Zona Rural',['Aprov.',20,130,20]],
   ['Iluminação Pública LED','Infraestrutura','R$ 2,1 mi','15.000 pess.',['Capt.',190,130,0]],
   ['Reforma Escolar — 4 Unidades','Educação','R$ 1,4 mi','1.800 alunos',['Elab.',20,100,190]],
   ['Pocos Artesianos — Comunidades','Agricultura','R$ 600 mil','2.000 famílias',['Aprov.',20,130,20]],
   ['Drenagem Pluvial Urbana','Infraestrutura','R$ 2,8 mi','10.000 pess.',['Elab.',20,100,190]],
   ['Ampliação do CAPS','Saúde','R$ 750 mil','5.000 pess.',['Capt.',190,130,0]],
   ['Praca Central e Lazer','Infra/Social','R$ 500 mil','67.820 pess.',['Aprov.',20,130,20]],
  ].forEach(([p,a,v,b,[s,sr,sg,sb]],ri)=>{
    if(y>268){return;}
    if(ri%2===0){doc.setFillColor(245,252,245);doc.rect(mx,y,cw,9,'F');}
    cx=mx;
    doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(p,cx+2,y+6); cx+=cols[0];
    doc.setFont('helvetica','normal'); doc.setTextColor(30,123,30); doc.text(a,cx+2,y+6); cx+=cols[1];
    doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(v,cx+2,y+6); cx+=cols[2];
    doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60); doc.text(b,cx+2,y+6); cx+=cols[3];
    doc.setFillColor(sr,sg,sb); doc.roundedRect(cx+1,y+1.5,17,6,1,1,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(255,255,255); doc.text(s,cx+9.5,y+6.2,{align:'center'});
    doc.setDrawColor(210,235,210); doc.setLineWidth(0.2); doc.line(mx,y+9,mx+cw,y+9); y+=9;
  });
  y+=4;
  const sw9=Math.floor((cw-15)/4);
  [['R$16mi+','Total Carteira'],['10','Projetos'],['60.000+','Beneficiados'],['4','Eixos Temáticos']].forEach(([v,l],i)=>{
    const sx=mx+i*(sw9+5); doc.setFillColor(20,82,20); doc.roundedRect(sx,y,sw9,22,2,2,'F');
    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+sw9/2,y+13,{align:'center'});
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+sw9/2,y+20,{align:'center'});
  }); y+=26;
  y=secTitulo('Legenda de Status dos Projetos',y);
  [['Em Elaboracao','Projeto em fase de elaboração de plano de trabalho e documentação técnica.',20,100,190],
   ['Em Captacao','Proposta submetida no Transferegov/SICONV aguardando análise ou aprovação.',190,130,0],
   ['Aprovado / Execucao','Projeto aprovado ou em fase de execução com convênio formalizado.',20,130,20]
  ].forEach(([tit,desc,r,g,b])=>{
    doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,16,2,2,'F'); doc.setFillColor(r,g,b); doc.rect(mx,y,5,16,'F');
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(r,g,b); doc.text(tit,mx+9,y+7);
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60); doc.text(desc,mx+9,y+13); y+=18;
  });

  // P10 — Impacto Social (página completa)
  doc.addPage(); cabecalho('10. Impacto Social dos Investimentos',10,total); rodape();
  y=38;
  const sw10=Math.floor((cw-15)/4);
  [['500+','Empregos Diretos'],['8.000+','Famílias Benef.'],['70%','Cobertura Urbana'],['R$16mi+','Em Projetos']].forEach(([v,l],i)=>{
    const sx=mx+i*(sw10+5); doc.setFillColor(20,82,20); doc.roundedRect(sx,y,sw10,28,2,2,'F');
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+sw10/2,y+16,{align:'center'});
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+sw10/2,y+24,{align:'center'});
  }); y+=32;
  y=secTitulo('Resultados Esperados com a Captação de Recursos',y);
  ['Geração de 500+ empregos diretos e indiretos durante a execução das obras de infraestrutura','Redução das desigualdades sociais e regionais com inclusão de famílias em vulnerabilidade','Fortalecimento da economia local com aumento da circulação de renda no comércio municipal','Inclusão social de 8.000+ famílias beneficiadas com habitação, saúde e educação de qualidade','Desenvolvimento sustentável com energia renovável: painéis solares e eólicos para o município','Melhoria da mobilidade urbana, segurança pública e qualidade de vida da população','Universalização do acesso à água, saúde e educação nas comunidades rurais mais carentes','Ampliação da cobertura de saúde com redução dos indicadores de mortalidade infantil'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; y=secTitulo('Matriz de Impacto por Setor',y);
  [['Infraestrutura','Pavimentação, drenagem e LED beneficiam 37.000+ pessoas','Alta'],
   ['Saúde','Novas UBS e equipamentos atendem 13.000+ moradores','Alta'],
   ['Educação','Creches e escolas beneficiam 2.100+ alunos e famílias','Alta'],
   ['Agricultura','Máquinas e poços assistem toda a zona rural municipal','Média'],
   ['Social','Praças, CAPS e CRAS atendem 67.820 habitantes','Alta']
  ].forEach(([setor,desc,prioridade],i)=>{
    if(y>265){return;}
    if(i%2===0){doc.setFillColor(245,252,245);doc.rect(mx,y,cw,10,'F');}
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(setor,mx+3,y+7);
    doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55); doc.text(desc,mx+40,y+7);
    const pc=prioridade==='Alta'?[20,82,20]:prioridade==='Média'?[30,123,30]:[110,192,46];
    doc.setFillColor(...pc); doc.roundedRect(W-mx-22,y+2,20,7,2,2,'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255); doc.text(prioridade,W-mx-12,y+7,{align:'center'});
    y+=10;
  });

  // P11 — Capacidade Técnica (página completa)
  doc.addPage(); cabecalho('11. Capacidade Técnica da Prefeitura',11,total); rodape();
  y=secTitulo('Estrutura Administrativa e Equipe Técnica',38);
  ['Equipe técnica qualificada com engenheiros, arquitetos, advogados, contadores e assistentes sociais','Setor de Projetos e Engenharia com emissão de ART/RRT para obras e serviços conveniados','Setor de Convênios e Captação de Recursos ativo e especializado em programas federais','Controle Interno Municipal fortalecido, independente e estruturado com equipe dedicada','Portal de Transparência certificado, atualizado diariamente e acessível ao público','Assessoria Jurídica eficiente para análise de contratos e termos de convênio','Contadoria e tesouraria com sistemas integrados e relatórios automatizados'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(20,82,20); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; y=secTitulo('Compromisso com a Legalidade e a Boa Gestão',y);
  ['Prestação de contas em dia com o TCE-PE — sem irregularidades formais','Lei de Responsabilidade Fiscal (LRF) cumprida em todos os quadrimestres fiscais','Execução eficiente dos recursos públicos com 95%+ de execução orçamentária anual','Relatório de Gestão Fiscal publicado e enviado ao SICONFI dentro dos prazos legais','Licitações realizadas com transparência e publicadas no Diário Oficial do Município','CAUC (Certidões e Regularidade) em conformidade para habilitação em convênios','Plano Plurianual (PPA) e Lei Orçamentária Anual (LOA) aprovados pela Câmara Municipal'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  if(y<268){ y+=4; const sw11=Math.floor((cw-15)/4);
    [['CAUC OK','Regularidade'],['TCE-PE','Em dia'],['LRF','Cumprida'],['SEI','Implantado']].forEach(([v,l],i)=>{ const sx=mx+i*(sw11+5); doc.setFillColor(20,82,20); doc.roundedRect(sx,y,sw11,22,2,2,'F'); doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+sw11/2,y+13,{align:'center'}); doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+sw11/2,y+19,{align:'center'}); });}

  // P12 — Parcerias Institucionais (página completa)
  doc.addPage(); cabecalho('12. Parcerias Institucionais',12,total); rodape();
  y=secTitulo('Governo Federal — Ministérios e Autarquias Parceiras',38);
  ['Ministério das Cidades — pavimentação, drenagem, habitação e urbanização','Ministério da Saúde — construção/reforma de UBS, equipamentos e veículos de saúde','Ministério da Educação — FNDE/PAR: creches, escolas, transporte e merenda','Ministério do Desenvolvimento Agrário — máquinas, poços e apoio à agricultura familiar','CODEVASF — infraestrutura hídrica, poços artesianos e desenvolvimento do semiárido','FUNASA — saneamento básico, abastecimento de agua e melhorias sanitárias rurais','BNDES e BNB — financiamentos para infraestrutura e desenvolvimento local'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(20,82,20); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  y+=2; y=secTitulo('Governo Estadual e Parceiros Parlamentares',y);
  ['Governo do Estado de Pernambuco — obras de infraestrutura e transferências voluntárias','Secretaria Estadual de Saúde (SES-PE) — especialidades, regulação e pactuações de saúde','Secretaria Estadual de Educação — gestão compartilhada de escolas estaduais','Deputados Federais com emendas parlamentares destinadas ao município — Transferegov','Deputados Estaduais com emendas no orçamento estadual para projetos específicos','Senadores de Pernambuco com emendas individuais e de bancada para Sertânia','Caixa Econômica Federal e Banco do Brasil — operações de crédito e convênios'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  if(y<268){ y+=4; doc.setFillColor(20,82,20); doc.roundedRect(mx,y,cw,16,2,2,'F'); doc.setFontSize(9.5); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text('A Prefeitura de Sertânia está pronta para construir novas parcerias que',W/2,y+7,{align:'center'}); doc.setFontSize(9.5); doc.setFont('helvetica','italic'); doc.setTextColor(185,245,185); doc.text('promovam o desenvolvimento sustentável e a melhoria da qualidade de vida do nosso povo.',W/2,y+13,{align:'center'});}

  // P13 — Considerações Finais (página completa)
  doc.addPage(); cabecalho('13. Considerações Finais e Compromissos',13,total); rodape();
  y=38;
  doc.setFillColor(20,82,20); doc.roundedRect(mx,y,cw,72,3,3,'F'); doc.setFillColor(110,192,46); doc.rect(mx,y,5,72,'F');
  doc.setFontSize(28); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text('"',mx+10,y+16);
  const fl=doc.splitTextToSize(AD.msgFinal.replace(/^"|"$/g,''),cw-18);
  doc.setFontSize(10.5); doc.setFont('helvetica','italic'); doc.setTextColor(255,255,255); doc.text(fl,mx+10,y+24);
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text('— '+AD.prefeita+', Prefeita Municipal de Sertânia',mx+10,y+66);
  y+=76;
  y=secTitulo('Síntese dos Compromissos Institucionais',y);
  ['Gerir com responsabilidade e eficiência os recursos públicos municipais sem desperdícios','Priorizar a captação de recursos federais para ampliar investimentos sem endividamento','Manter o diálogo permanente com o Governo Federal, Estadual e parlamentares eleitos','Garantir a total transparência dos atos administrativos e financeiros da gestão municipal','Cumprir rigorosamente as exigências legais do TCE-PE, LRF e órgãos de controle externo','Promover o desenvolvimento econômico sustentável com inclusão social e ambiental','Colocar Sertânia no mapa das cidades bem geridas e acessíveis para novos investimentos'
  ].forEach(t=>{ doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,9,1,1,'F'); doc.setFillColor(110,192,46); doc.circle(mx+5,y+4.5,1.5,'F'); doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(45,45,45); doc.text(t,mx+10,y+6); y+=10; });
  if(y<270){ y+=4; doc.setFillColor(245,252,245); doc.roundedRect(mx,y,cw,14,2,2,'F'); doc.setFillColor(20,82,20); doc.rect(mx,y,5,14,'F'); doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text('Sertânia — PE  |  Gestão '+AD.periodo+'  |  Prefeita '+AD.prefeita+'  |  '+AD.site,mx+9,y+9);}

  // P14 — Contatos Oficiais (página completa)
  doc.addPage(); cabecalho('14. Contatos e Informações Oficiais',14,total); rodape();
  y=secTitulo('Prefeitura Municipal de Sertânia — Gabinete da Prefeita',38);
  [['Endereço',AD.endereco],['CEP',AD.cep],['Telefone Geral',AD.telefone],['E-mail Gabinete',AD.email],['Site Oficial','https://'+AD.site],['Instagram',AD.instagram],['Horário de Atendimento','Segunda a Sexta — 8h às 14h']].forEach(([k,v],i)=>{
    if(i%2===0){doc.setFillColor(245,252,245);doc.rect(mx,y,cw,10,'F');}
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(k,mx+3,y+7);
    doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55); doc.text(String(v),mx+60,y+7);
    doc.setDrawColor(200,235,200); doc.setLineWidth(0.2); doc.line(mx,y+10,mx+cw,y+10); y+=10;
  });
  y+=6; y=secTitulo('Setor de Convênios e Captação de Recursos',y);
  [['Responsável','Setor de Projetos e Captação de Recursos — Prefeitura Municipal de Sertânia'],
   ['Plataforma','Transferegov — Sistema do Governo Federal para convênios e transferências'],
   ['CNPJ Municipal','Prefeitura Municipal de Sertânia — Pernambuco — Registro no CAUC ativo'],
   ['Documentação','Disponível para envio imediato: PPA, LOA, RGF, RREO e Certidões negativas']
  ].forEach(([k,v],i)=>{
    if(y>265){return;}
    if(i%2===0){doc.setFillColor(245,252,245);doc.rect(mx,y,cw,10,'F');}
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text(k,mx+3,y+7);
    const vl=doc.splitTextToSize(v,cw-63); doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55); doc.text(vl,mx+60,y+7);
    doc.setDrawColor(200,235,200); doc.setLineWidth(0.2); doc.line(mx,y+10,mx+cw,y+10); y+=10;
  });
  y+=6;
  try {
    const qrUrl='https://api.qrserver.com/v1/create-qr-code/?size=100x100&data='+encodeURIComponent('https://'+AD.site)+'&color=145214&bgcolor=ffffff';
    doc.addImage(qrUrl,'PNG',mx,y,35,35);
    doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text('QR Code — Acesse o Portal Oficial',mx+40,y+8);
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60); doc.text('Escaneie com seu celular para acessar o site oficial da Prefeitura de Sertânia.',mx+40,y+15);
    doc.text('Informações atualizadas, editais, licitações e transparência pública.',mx+40,y+22);
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20); doc.text('www.'+AD.site,mx+40,y+30);
    y+=42;
  } catch(e) { y+=6; }
  if(y<268){ doc.setFillColor(20,82,20); doc.roundedRect(mx,y,cw,14,2,2,'F'); doc.setFontSize(9); doc.setFont('helvetica','italic'); doc.setTextColor(185,245,185); doc.text('"Sertânia está pronta para crescer. Conte conosco para fazer isso acontecer." — '+AD.prefeita,W/2,y+9.5,{align:'center'});}

  doc.save('Apresentacao_Institucional_Sertania_'+AD.ano+'_Completo.pdf');
}

// ─── PDF Resumido (5 páginas) ─────────────────────────────────────────────────
async function apresGerarPdfResumido() {
  if (!window.jspdf) { alert('PDF indisponível.'); return; }
  const lObj = await _imgData('img/logo_sertania.png');
  const logo = lObj ? lObj.data : null;
  const doc = new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210, H=297, mx=18, cw=W-mx*2;

  function bgTextura(y0,y1){
    doc.setFillColor(215,242,215);
    for(let gx=18;gx<=192;gx+=7){for(let gy=y0;gy<=y1;gy+=7){doc.circle(gx,gy,0.28,'F');}}
  }

  function cab(t,p) {
    bgTextura(33,278);
    doc.setFillColor(245,252,245); doc.rect(0,0,W,30,'F');
    doc.setFillColor(20,82,20); doc.rect(0,0,6,30,'F');
    doc.setFillColor(110,192,46); doc.rect(0,27,W,3,'F');
    if(logo){const ls=_lSize(lObj,22,26);doc.addImage(ls.data,'PNG',W-mx-ls.w,1+(26-ls.h)/2,ls.w,ls.h);}
    doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20);
    doc.text(t,mx+10,13);
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(30,123,30);
    doc.text('Prefeitura de Sertânia — PE  •  '+AD.prefeita+'  •  Versão Resumida',mx+10,21);
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46);
    doc.text(p+'/5',W-mx-18,21,{align:'right'});
    doc.setFillColor(20,82,20); doc.rect(0,283,W,14,'F');
    doc.setFillColor(110,192,46); doc.rect(0,283,W,2,'F');
    if(logo){const ls=_lSize(lObj,14,11);doc.addImage(ls.data,'PNG',mx,285+(11-ls.h)/2,ls.w,ls.h);}
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(185,245,185);
    doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA',mx+16,289.5);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(180,240,180);
    doc.text(AD.endereco+'  |  '+AD.telefone,W/2,295,{align:'center'});
    doc.setFontSize(7); doc.setTextColor(110,192,46); doc.setFont('helvetica','bold');
    doc.text(AD.site,W-mx,289.5,{align:'right'});
  }

  // P1 — Capa resumida (fundo branco)
  doc.setFillColor(255,255,255); doc.rect(0,0,W,H,'F');
  bgTextura(62,275);
  doc.setFillColor(20,82,20); doc.rect(0,0,W,58,'F');
  doc.setFillColor(110,192,46); doc.rect(0,54,W,4,'F');
  if(logo){const ls=_lSize(lObj,52,50);doc.addImage(ls.data,'PNG',mx,4+(50-ls.h)/2,ls.w,ls.h);}
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46);
  doc.text('PREFEITURA MUNICIPAL DE',mx+56,14);
  doc.setFontSize(26); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('SERT\u00c2NIA',mx+56,34);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185);
  doc.text('Pernambuco \u2014 Sert\u00e3o do Moxot\u00f3',mx+56,46);
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(30,123,30);
  doc.text('APRESENTAÇÃO INSTITUCIONAL — VERSÃO RESUMIDA',W/2,72,{align:'center'});
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100);
  doc.text('Captação de Recursos Federais  •  5 Páginas',W/2,81,{align:'center'});
  doc.setFillColor(110,192,46); doc.rect(mx+20,85,cw-40,1.5,'F');
  const sw4r=Math.floor((cw-18)/4);
  [['67.820','Habitantes'],['2.885km\u00b2','Territ\u00f3rio'],['0,563','IDH 2010'],['147 anos','Hist\u00f3ria']].forEach(([v,l],i)=>{
    const sx=mx+i*(sw4r+6);
    doc.setFillColor(245,252,245); doc.roundedRect(sx,91,sw4r,26,2,2,'F');
    doc.setDrawColor(110,192,46); doc.setLineWidth(0.5); doc.roundedRect(sx,91,sw4r,26,2,2,'S');
    doc.setFillColor(110,192,46); doc.rect(sx,91,sw4r,3,'F');
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20);
    doc.text(v,sx+sw4r/2,105,{align:'center'});
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
    doc.text(l,sx+sw4r/2,113,{align:'center'});
  });
  doc.setFillColor(20,82,20); doc.roundedRect(mx,130,cw,42,3,3,'F');
  doc.setFillColor(110,192,46); doc.rect(mx,130,5,42,'F');
  if(logo){const ls=_lSize(lObj,32,34);doc.addImage(ls.data,'PNG',mx+8,134+(34-ls.h)/2,ls.w,ls.h);}
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46);
  doc.text('GESTÃO MUNICIPAL',mx+46,141);
  doc.setFontSize(18); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text(AD.prefeita,mx+46,154);
  doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185);
  doc.text('Prefeita Municipal — '+AD.periodo,mx+46,163);
  doc.setFontSize(9); doc.setFont('helvetica','italic'); doc.setTextColor(110,192,46);
  doc.text('"'+AD.slogan+'"',W/2,177,{align:'center'});
  doc.setFillColor(110,192,46); doc.rect(0,185,W,1.5,'F');
  doc.setFillColor(245,252,245); doc.rect(0,187,W,30,'F');
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20);
  doc.text('INFORMAÇÕES DE CONTATO',W/2,196,{align:'center'});
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
  doc.text(AD.endereco,W/2,204,{align:'center'});
  doc.text('Tel: '+AD.telefone+'  |  '+AD.email,W/2,211,{align:'center'});
  doc.text(AD.site+'  |  Instagram: '+AD.instagram,W/2,217,{align:'center'});
  doc.setFillColor(110,192,46); doc.rect(0,221,W,1.5,'F');
  const swCovR=Math.floor((cw-15)/4);
  [['R$16mi+','Em Captacao'],['14','Secretarias'],['2.500+','Servidores'],['100%','Transparencia']].forEach(([v,l],i)=>{
    const sx=mx+i*(swCovR+5); doc.setFillColor(20,82,20); doc.roundedRect(sx,225,swCovR,22,2,2,'F');
    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(110,192,46); doc.text(v,sx+swCovR/2,237,{align:'center'});
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185); doc.text(l,sx+swCovR/2,244,{align:'center'});
  });
  doc.setFillColor(110,192,46); doc.rect(0,250,W,1.5,'F');
  doc.setFillColor(245,252,245); doc.rect(0,252,W,24,'F');
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(20,82,20);
  doc.text('VERSAO RESUMIDA — 5 PAGINAS',mx+4,260);
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(55,55,55);
  doc.text('Esta versão contém os principais dados, indicadores e projetos prioritários',mx+4,267);
  doc.text('da Prefeitura de Sertânia para captação de recursos federais.',mx+4,273);
  doc.setFillColor(110,192,46); doc.rect(0,278,W,1,'F');
  doc.setFillColor(20,82,20); doc.rect(0,H-18,W,18,'F');
  doc.setFillColor(110,192,46); doc.rect(0,H-18,W,2,'F');
  if(logo){const ls=_lSize(lObj,14,12);doc.addImage(ls.data,'PNG',mx,H-15+(12-ls.h)/2,ls.w,ls.h);}
  doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(185,245,185);
  doc.text('www.'+AD.site+'  |  '+AD.instagram,W/2,H-5,{align:'center'});

  // P2 — Município + Econômico
  doc.addPage(); cab('Município & Perfil Econômico',2);
  let y=38;
  doc.setFillColor(30,123,30); doc.roundedRect(mx,y,cw,8,2,2,'F');
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('Dados do Município',mx+3,y+5.5); y+=12;
  [['Município / Estado','Sertânia — Pernambuco'],['Região','Sertão do Moxotó'],['População',`${AD.populacao} (${AD.populacaoFonte})`],['Área',AD.area],['IDH',`${AD.idh} (${AD.idhAno})`],['Acesso',AD.acessos]].forEach(([k,v],i)=>{
    if(i%2===0){doc.setFillColor(240,247,238);doc.rect(mx,y,cw,7,'F');}
    doc.setFontSize(9); doc.setTextColor(20,82,20); doc.setFont('helvetica','bold'); doc.text(k,mx+2,y+5);
    doc.setTextColor(50,50,50); doc.setFont('helvetica','normal'); doc.text(v,mx+58,y+5); y+=7;
  });
  y+=6;
  doc.setFillColor(30,123,30); doc.roundedRect(mx,y,cw,8,2,2,'F');
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('Atividades Econômicas e Potencialidades',mx+3,y+5.5); y+=12;
  ['Comércio, agricultura familiar, pecuária, serviços e empreendedorismo.','Potencial para energia solar/eólica, turismo cultural e eventos tradicionais.','Localização estratégica na BR-232 favorece logística regional.'].forEach(t=>{
    const ls=doc.splitTextToSize('▸  '+t,cw-4);
    doc.setFontSize(9); doc.setTextColor(30,80,30); doc.setFont('helvetica','normal'); doc.text(ls,mx+2,y); y+=ls.length*5+4;
  });

  // P3 — Indicadores + Avanços
  doc.addPage(); cab('Indicadores Sociais & Avanços',3);
  y=38;
  doc.setFillColor(30,123,30); doc.roundedRect(mx,y,cw,8,2,2,'F');
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('Indicadores Sociais',mx+3,y+5.5); y+=12;
  [['Saúde','UBS distribuídas no município, cobertura ESF, CAPS e programas preventivos'],
   ['Educação','Rede escolar pública, transporte, merenda, programas MEC e tecnologia'],
   ['Assistência Social','CRAS ativo, Cadastro Único, Bolsa Família, BPC e serviços de convivência']].forEach(([cat,desc])=>{
    doc.setFontSize(9); doc.setTextColor(20,82,20); doc.setFont('helvetica','bold'); doc.text(cat,mx+2,y); y+=5;
    const ls=doc.splitTextToSize(desc,cw-8);
    doc.setTextColor(60,60,60); doc.setFont('helvetica','normal'); doc.text(ls,mx+6,y); y+=ls.length*5+5;
  });
  y+=4;
  doc.setFillColor(30,123,30); doc.roundedRect(mx,y,cw,8,2,2,'F');
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('Avanços e Modernização',mx+3,y+5.5); y+=12;
  ['Pavimentação, reforma de escolas e ampliação da saúde','Implantação do SEI e sistemas digitais','Controle interno fortalecido e transparência pública','Captação de recursos federais como prioridade de gestão'].forEach(t=>{
    doc.setFontSize(9); doc.setTextColor(20,82,20); doc.setFont('helvetica','bold'); doc.text('▸',mx+2,y);
    doc.setTextColor(50,50,50); doc.setFont('helvetica','normal'); doc.text(t,mx+8,y); y+=7;
  });

  // P4 — Demandas + Projetos
  doc.addPage(); cab('Demandas Estratégicas & Projetos',4);
  y=38;
  doc.setFillColor(30,123,30); doc.roundedRect(mx,y,cw,8,2,2,'F');
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('Top Demandas por Área',mx+3,y+5.5); y+=12;
  [['Infraestrutura','Pavimentação, drenagem, iluminação LED'],['Saúde','Ampliação UBS, equipamentos, veículos'],['Educação','Creches, transporte, tecnologia'],['Agricultura','Máquinas, poços, estradas vicinais']].forEach(([cat,desc])=>{
    doc.setFontSize(9); doc.setTextColor(20,82,20); doc.setFont('helvetica','bold'); doc.text(cat,mx+2,y);
    doc.setTextColor(60,60,60); doc.setFont('helvetica','normal'); doc.text(desc,mx+35,y); y+=7;
  });
  y+=6;
  doc.setFillColor(30,123,30); doc.roundedRect(mx,y,cw,8,2,2,'F');
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('Projetos Prioritários',mx+3,y+5.5); y+=10;
  const pc=[50,38,32,36]; const ph=['Projeto','Área','Valor','Benefic.'];
  doc.setFillColor(20,82,20); doc.rect(mx,y,cw,7,'F');
  let cx2=mx; ph.forEach((h,i)=>{doc.setFontSize(8);doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.text(h,cx2+2,y+5);cx2+=pc[i];}); y+=7;
  [['Pavimentação Urbana','Infra','R$ 3,5 mi','12 mil pess.'],['Nova UBS','Saúde','R$ 1,2 mi','8 mil pess.'],['Creche Municipal','Educ.','R$ 1,8 mi','300 fam.'],['Máquinas Agrícolas','Agric.','R$ 900 mil','Zona Rural'],['Iluminação LED','Infra','R$ 2,1 mi','15 mil pess.']].forEach(([p,a,v,b],ri)=>{
    if(ri%2===0){doc.setFillColor(240,247,238);doc.rect(mx,y,cw,7,'F');}
    cx2=mx; [p,a,v,b].forEach((cell,i)=>{doc.setFontSize(8);doc.setTextColor(30,80,30);doc.setFont('helvetica',i===0?'bold':'normal');doc.text(cell,cx2+2,y+5);cx2+=pc[i];}); y+=7;
  });

  // P5 — Contatos + QR
  doc.addPage(); cab('Contatos Oficiais',5);
  y=38;
  doc.setFillColor(30,123,30); doc.roundedRect(mx,y,cw,8,2,2,'F');
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('Prefeitura Municipal de Sertânia — Gabinete da Prefeita',mx+3,y+5.5); y+=14;
  [['Endereço',AD.endereco],['Telefone',AD.telefone],['E-mail',AD.email],['Site',AD.site],['Instagram',AD.instagram]].forEach(([k,v])=>{
    doc.setFontSize(9); doc.setTextColor(20,82,20); doc.setFont('helvetica','bold'); doc.text(k,mx+2,y);
    doc.setTextColor(50,50,50); doc.setFont('helvetica','normal'); doc.text(v,mx+30,y); y+=8;
  });
  y+=10;
  doc.setFillColor(20,82,20); doc.roundedRect(mx,y,cw,50,3,3,'F');
  const fl=doc.splitTextToSize(AD.msgFinal.replace(/^"|"$/g,''),cw-12);
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','italic');
  doc.text(fl,mx+6,y+12);
  try {
    const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('https://'+AD.site)}&color=145214&bgcolor=f0f7ee`;
    doc.addImage(qrUrl,'PNG',W-mx-32,y+5,28,28);
  } catch(e) {}

  doc.save(`Apresentacao_Sertania_${AD.ano}_Resumida.pdf`);
}
