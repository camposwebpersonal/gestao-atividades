# Preferências do usuário para este projeto

- SEMPRE fazer commit e push (`git push`) de qualquer alteração diretamente para o
  branch `main` no GitHub assim que a mudança for concluída, SEM perguntar ao
  usuário se deve publicar. O usuário quer tudo publicado automaticamente e
  imediatamente, sempre.
- Não perguntar "quer testar local antes ou publicar direto?" — a resposta é
  sempre publicar direto.
- Autenticação verificada neste ambiente: GitHub CLI (`gh`) com a conta
  `camposwebpersonal`, credencial no chaveiro e `gh auth setup-git` configurado.
  Priorizar essa conexão para `git push origin main`. Em novo ambiente, verificar
  `gh auth status` antes de presumir que existe autenticação.
- Nunca imprimir, copiar para o repositório ou incluir em commits credenciais.
  Configurações locais de autenticação não devem ser versionadas.
- Se a credencial expirar ou for revogada, informar o impedimento de autenticação;
  nunca afirmar que publicou sem confirmação de sucesso do GitHub.

## Preparação do ambiente e continuidade

- O usuário prefere que o agente instale e configure as ferramentas necessárias
  aos ajustes solicitados e aproveite conexões já autorizadas, sem pedir novamente
  confirmação para etapas rotineiras dentro desse escopo.
- Antecipar verificações de acesso ao GitHub e ao Supabase. Quando login, MFA ou
  consentimento pessoal forem exigidos pelo provedor, iniciar o fluxo e solicitar
  apenas a etapa que depende do usuário. Não afirmar conexão sem verificá-la.
- Projeto Supabase usado pelo site: `xwlmpxypjheuhbxyfplo`.
- Supabase CLI instalado em `~/.local/bin/supabase`; login e vínculo deste
  checkout verificados em 2026-09-30. O vínculo fica em `supabase/.temp/`,
  ignorado pelo Git. Reutilizar o login salvo; confirmar acesso com
  `supabase projects list` quando necessário, sem registrar tokens aqui.
- Esta preferência não autoriza exclusão de dados, gastos ou mudanças sem relação
  com a tarefa solicitada.
- Este arquivo preserva as preferências para sessões que leiam o repositório;
  credenciais podem expirar e precisam ser verificadas novamente quando necessário.

## NEUROARQUITETURA em tudo (regra permanente do usuário, 23/11/2026)

- Toda tela, relatório, PDF, cartaz e arte deste e de qualquer projeto do usuário segue o guia `docs/NEURO-UX.md`:
  ambiente acolhedor (saudação, situação explicada em frase humana), hierarquia situação → números → ações → detalhes,
  cores com intenção (azul/verde calmos; âmbar atenção; vermelho só para problema real; zero nunca vermelho),
  conforto cognitivo (nada repetido, zeros discretos, revelação progressiva), biofilia suave (tons de água/folha),
  microinterações curtas que respeitam `prefers-reduced-motion`, "portas" claras para cada tarefa e celebração quando
  está tudo em dia. Super intuitivo e fácil de usar, com experiência emocional positiva.
- NUNCA um número/texto pode sair do seu card em nenhuma largura: container queries (`cqi`) + encaixe por JS com
  `ResizeObserver` + valor completo no `title`; teste varrendo 360→1920 px (ver `tests/contas-neuro.browser.cjs`).
- PDFs também: usar `window.ccnPdf` (js/contas-pdf-neuro.js) — cabeçalho compacto, situação em frase, fichas que
  encolhem a letra até caber, barra do pago, rodapé "Página X de Y". Controle de Contas já tem TODAS as abas e os 3 PDFs
  neste padrão (`tests/contas-abas-neuro.browser.cjs`); próximas telas seguem o mesmo modelo.
- Primeira tela feita assim: Controle de Contas › Visão geral (23/11/2026). Próximas telas devem seguir o mesmo padrão.
- Regra reforçada pelo usuário (23/11/2026, 18h): neuroarquitetura, layout intuitivo, fácil e agradável de usar em TUDO
  (sites, sistemas, telas, PDFs, projetos, cartazes, artes). Botões sempre organizados e compactos; compactar de forma
  INTELIGENTE quando há muitos itens (pílulas de uma linha + busca + "＋N" em vez de parede de botões).
- Controle de Contas › Lançamentos: seletor de locais compacto (`_ccLocaisCompactos`: bolinha verde/âmbar/cinza, contador
  de pendências, filtro, ＋N locais — 23 no computador, 11 no celular); botão 📄 PDF do topo SEMPRE gera o relatório da aba
  ativa (`ccPdfDaAba`: geral, lançamentos, vencimentos `ccVencimentosPdf`, relatório, cadastro).

## Conclusão "na mesma tela" (regra do usuário, 23/11/2026)

- Grupo com Controle de Conclusão escolhe onde ficam os concluídos: aba Concluídos (padrão) ou "📍 na mesma tela"
  (`extra_fields.conclusao_modo = 'mesma_tela'`, `window.groupDoneInline`). No modo mesma tela o concluído fica na MESMA
  posição, com fundo verde-claro e selo "✅ Concluído" no canto; resumo "X de Y concluídos". Atalho no ⚙️ Mais e opção em
  Editar grupo. Exemplo pedido: EXPOCOSE 52. CSS em `css/neuro-groups.css`; teste `tests/conclusao-mesma-tela.browser.cjs`.

## Link provisório de conferência (regra do usuário, 23/11/2026)

- Todo grupo: ⚙️ Mais › 🔗 Link de conferência (`js/link-conferencia.js`). Modo "✏️ Editar e conferir" (padrão) ou
  "👁 Só visualizar". Página pública `conferir.html?t=TOKEN` (`js/conferir.js`, sem login): pede o nome, ✏️ Corrigir,
  "CONFERIDO" por lançamento (salvou conferido = travado), "CONFERIR TODOS" + "💾 Salvar" com caixa de confirmação.
  Todos conferidos → link expira e o grupo ganha "✓ Grupo conferido". Link novo encerra o anterior e zera a conferência.
- Selo "✓ Conferido" no canto superior direito de cada lançamento conferido (`is-conferido`), faixa "Conferência em
  andamento · X de Y" e campo "Conferência: Conferido em dd/mm/aaaa por Fulano" no PDF (`controlFields`).
- Banco (migração 20261123190000): tabela `share_links` (RLS só leitura para logados com acesso ao grupo); o visitante
  usa só `pms_share_open/save/conferir_todos` (security definer, validam o token de 32 caracteres e o grupo, sem
  WhatsApp, autor gravado como "Nome · link de conferência" via `pms.actor_name`). Criar/encerrar: `pms_share_create`,
  `pms_share_revoke` (logado). Testes: `tests/conferir.browser.cjs` e `tests/link-conferencia.browser.cjs`.

## Secretaria da Mulher (regra do usuário, 23/11/2026)

- Espaço próprio (`js/secretaria-mulher.js` + `css/secretaria-mulher.css`, tema lilás acolhedor), abas 👩 Mulheres
  cadastradas · 🗺️ Levantamento da rede. Grupo MULHERES CADASTRADAS (`mulher_cadastro:1`; deixou de ser o grupo de entrada
  do Registro de Campo) = fichas; ocorrências = subitens da ficha (linha do tempo). Ficha em 4 passos (Identificação,
  Contato e endereço, Vida e família, Situação e rede de proteção) com pílulas, campos condicionais e nomes legíveis.
- PDF da ficha com QR no CABEÇALHO e no RODAPÉ (`js/vendor/qrcode.js`, qrcode-generator MIT) → `mulher.html?t=<mulher_token>`
  somente leitura (ficha + todas as ocorrências) via `pms_mulher_publica` (migração 20261123210000). O usuário escolheu
  "público por link" (sem PIN) em 23/11/2026; token aleatório de 32 caracteres, aviso LGPD no PDF e na página.
- Grupo LEVANTAMENTO DA REDE DE ENFRENTAMENTO (`mulher-levantamento-rede`, `mulher_levantamento:1`): formulário do PDF
  "Levantamento da Rede de Enfrentamento e Atendimento à Mulher" (I município, II OMPM, III–VIII redes com equipamentos
  ilimitados; "Existe? NÃO" recolhe o resto). Dados em `extra_fields.levantamento` (interno) + resumos legíveis; PDF igual.
  Teste: `tests/secretaria-mulher.browser.cjs` (390 e 1366).

## Comportamento dinâmico esperado

- Aplicar lógica preventiva e contextual em toda manutenção deste projeto para
  maximizar produtividade: evitar informação redundante, ocultar em relatórios
  colunas ou seções sem conteúdo útil, redistribuir o espaço preservando a largura
  e destacar automaticamente os dados relevantes. Não omitir dados obrigatórios
  nem alterar regras de negócio sem evidência; manter sempre a solução editável.
- Inferir e preencher automaticamente dados que já estejam determinados pelo
  contexto. Exemplo: itens e subitens de um grupo de Demandas por Secretarias
  devem herdar a secretaria do grupo, sem pedir que o usuário selecione de novo.
- Ao criar recursos hierárquicos, oferecer permissões no mesmo nível de detalhe
  da navegação (módulo, submenu/secretaria e grupo), incluindo uma opção explícita
  para abranger automaticamente registros futuros daquele escopo.

## Regras permanentes de legibilidade e navegação

- Nunca usar texto operacional minúsculo: menus, submenus, status, metadados,
  botões e informações de cards/listas devem permanecer legíveis em notebook,
  tablet, celular e com zoom. O piso visual é 11px para metadados e 12px para
  navegação; não reduzir fontes para conseguir compactação.
- Nunca aceitar elementos sobrepostos, cortados ou vazando do contêiner. Cards,
  listas, badges e barras de ações devem usar `min-width: 0`, quebra controlada e
  reorganização responsiva. Compactar por espaçamento e hierarquia, não esmagando
  texto ou posicionando informações concorrentes na mesma área.
- Status como “Pode aguardar”, urgência e prioridade devem quebrar ou ocupar uma
  nova linha quando faltar espaço, sem cobrir título, responsável ou ações.
- No menu lateral, uma secretaria com apenas Controle de Demandas abre diretamente
  suas demandas. Quando possuir dois ou mais tipos de lançamento, o clique abre
  uma tela de escolha ampla e legível; não listar esses tipos como submenus pequenos.
- Cards de grupos de demandas não exibem quantidade, percentual, barra de progresso
  nem o texto redundante “Abrir grupo”. No modo lista, manter apenas a quantidade e
  remover percentual e barra. O card inteiro deve abrir o grupo, preservando ações.
- Legibilidade obrigatória (regra permanente): fundo escuro exige texto claro e vivo;
  fundo claro exige texto escuro. Contraste mínimo WCAG AA de 4,5:1 (3:1 só para
  texto grande ou botão desativado), inclusive em botões, rótulos, checkboxes,
  campos de digitação, placeholders, avisos vazios e badges de status. O tema do
  sistema é claro: não usar fundos escuros herdados (#0a1222, #0e1729, #0f172a…)
  em telas ou modais, nem embutir fundo escuro em `<input>`, `<select>` ou
  `<textarea>`. `<label>` que funciona como botão precisa de cor própria, porque
  os rótulos de formulário são escuros. Toda alteração visual deve passar em
  `node tests/contrast-source.test.cjs` e na auditoria
  `NODE_PATH=$(npm root -g) node tests/contrast/run.cjs` (390px e `W=1366`),
  com o servidor local `python3 -m http.server 8090` aberto na raiz.
- Registro de Campo: “Gravar coordenadas e data visíveis na foto” vem marcado por
  padrão, e a localização da demanda é registrada automaticamente ao adicionar a
  foto (câmera → GPS; galeria → GPS gravado na foto ou, sem ele, o GPS atual).
- Gravações em tabelas com RLS onde o usuário pode inserir mas não ler (ex.:
  `trash_items`, visível só para quem tem permissão de lixeira) não podem pedir a
  linha de volta (`.select()`): usar `writeRow` em `supabase_compat.js`. Erros do
  banco mostrados ao usuário passam por `friendlyDbError` (português claro, sem
  mensagem técnica). Teste: `NODE_PATH=$(npm root -g) node tests/trash-rls.browser.cjs`.
- Paridade celular × computador: todo card/linha de lançamento (em andamento e
  concluídos) mostra no celular exatamente as mesmas opções do computador
  (Editar, Reabrir, Mover, +Item, +Sub, percentual…). Reorganizar e quebrar
  linha é permitido; esconder não. Verificar com
  `NODE_PATH=$(npm root -g) node tests/mobile-parity.browser.cjs`.
- Avisos por WhatsApp: gatilho em `items`/`subitems` → fila `whatsapp_outbox` → `pg_cron`
  (30 s) → função `whatsapp-notify` (CallMeBot), que junta gravações seguidas e manda resumo
  quando vários lançamentos chegam juntos. Manutenções em massa direto no banco devem rodar com
  `set local pms.whatsapp_off = 'on'` para não disparar avisos. Chaves de envio ficam só no
  banco (coluna sem leitura pelo navegador); nunca versionar ou imprimir.

## Navegação coerente em TODAS as telas (regra permanente)

- Toda tela do site mostra, fixos no topo enquanto o usuário rola, o botão **← Voltar**
  (sempre para a tela PAI, nunca para o "início" genérico) e os **breadcrumbs** completos
  até a **Visão geral** (ex.: Visão geral › SECRETARIA DE AGRICULTURA › Controle de Demandas
  › Grupo). O usuário precisa saber sempre onde está e como subir um nível.
- Implementação central: `js/nav-trail.js` + `css/nav-trail.css`. O caminho sai da rota
  (`#view/…`, `#module/…`, `#activity/…`, `#page/…`, `#secretaria/…`). Tela nova deve
  registrar a rota com `rememberWorkspace(...)` (e `workspacePages[id]` para `#page/`); tela
  que não muda a rota (ex.: mapa de um grupo) chama `setNavLeaf({selector, icon, label, back})`.
  Não criar botões "← Voltar" próprios no topo das telas: a barra já faz isso (os antigos são
  ocultados automaticamente).
- Secretaria com duas ou mais áreas (ex.: Agricultura: Controle de Demandas + Locais de
  Captação de Água) tem a tela de escolha como pai dessas áreas.
- Elementos fixos de cada tela (`.top-actions-fixed`, abas) grudam logo abaixo da barra
  (`--nav-trail-top` + `--nav-trail-h`). No celular o `body` usa `overflow-x:clip`: nunca
  voltar para `overflow-x:hidden`, que quebra todo `position:sticky`.
- Janelas de edição mantêm no topo fixo o contexto (nome + caminho; em usuários, "NOME · login").
- Teste obrigatório: `NODE_PATH=$(npm root -g) W=390 node tests/nav-trail.browser.cjs` (e `W=1366`).

## Esqueci minha senha (e-mail)

- Login usa e-mails sintéticos; por isso o reset é próprio: função `password-reset`
  (verify_jwt=false) envia link de uso único (30 min, hash SHA-256 em `password_reset_tokens`)
  para `users.email_contato`, para `login.html#redefinir-senha/<token>`. Não existe "criar acesso".
- SMTP em `mail_settings` (admin); a senha do e-mail fica só no Vault (`pms_set_smtp_password`),
  lida apenas pela função (`pms_smtp_password`, service_role). Nunca versionar ou imprimir.

## Visibilidade por permissão (regra permanente)

- Nenhuma tela, menu ou atalho mostra secretaria, grupo ou área que o usuário não pode acessar.
  Secretaria visível = permissão na secretaria inteira OU em pelo menos um grupo dela
  (`window.userCanSeeSecretaria`). Usar isso no menu lateral, na tela de escolha, no atalho da
  câmera e em qualquer lista nova. Teste: `tests/restricted-user.browser.cjs`.

## Valores de campos personalizados (regra permanente)

- O mesmo campo existe no banco com grafias diferentes ("Remuneração" × "remuneração",
  "Telefone" × "telefone"…). Nunca ler `extra_fields[nome]` direto: usar `_efv(registro, nome)`
  (index.html / `window._efv`), que ignora maiúsculas, acentos e espaços e aceita JSON em texto.
  Ao salvar, `collectCustomFieldValues` remove as grafias antigas do mesmo campo.
- Somatórios (resumos, PDFs, totais) devem avisar quantos registros ficaram sem valor, em vez de
  somar zero em silêncio. Teste: `tests/quantitativo.browser.cjs` (390 e 1366).
- Breadcrumbs nunca cortam o início de uma palavra: níveis anteriores encolhem com reticências e o
  nível atual aparece inteiro.

## Segurança do banco (regra permanente)

- Toda tabela em `public` tem RLS ligado. Sem login (anon) não lê nem grava nada; logados têm o
  acesso que o site usa; `public.users` só é alterada por administrador (`pms_user_is_admin()`).
  Tabela nova já nasce com RLS e política `to authenticated` — nunca `to anon` nem RLS desligado.
  Conferir com o assistente de segurança do Supabase (get_advisors) após cada migração.
- Fase 2 (12/11/2026): o banco confere as MESMAS permissões do site. `pms_my_group_ids()`
  (espelho de `groupPermission` + `_md.modFor`) decide quais grupos cada usuário lê/grava;
  `items`, `subitems`, `field_templates`, `contas`, `estoque`, `requisicoes`, `chamados`,
  `galeria` e `entity_images` seguem o grupo; extintores seguem o módulo; `users` mostra só a
  própria linha (admin vê todas) e o resto vem de `pms_users_directory()` (sem e-mail de contato
  nem permissões). Ao mudar `access-scope.js`, `NOME_MODULO` ou `_md.modFor`, atualizar as funções
  `pms_group_module`/`pms_group_allows` (migração 20261112180000) e repetir a verificação da
  migração 20261112180500 (Cláudia 1 grupo, admin tudo, Olavo 8, sem login nada).

## Senhas vazadas (regra permanente)

- Toda senha criada ou trocada passa por `js/pwned-check.js` (Pwned Passwords, k-anonimato: só
  5 caracteres do SHA-1 saem do aparelho). Vale em criar usuário, alterar senha e "Esqueci minha
  senha" (também conferido na função `password-reset`). Se a consulta falhar, NÃO bloqueia.
  Teste: `tests/pwned-password.browser.cjs` e `tests/password-reset.browser.cjs`.

## Mapas no celular (regra permanente)

- Todo mapa Leaflet chama `cooperativeGestures(map, host)` (js/geolocation.js): em tela de toque,
  um dedo rola a página e o mapa fica parado; dois dedos movem e dão zoom. Aviso fixo no mapa
  ("Use dois dedos…") e aviso grande ao tentar arrastar com um dedo. No computador a rodinha do
  mouse rola a página; zoom só com Ctrl/⌘ + rodinha (ou + e −) e clicar-arrastar move o mapa.
  Teste: `tests/map-gestures.browser.cjs`.

## Versões automáticas e testes no GitHub (regra permanente)

- Não editar `?v=` nem `CACHE_NAME` à mão. Antes de cada commit rodar
  `node tools/stamp-versions.mjs`: ele calcula a versão de cada arquivo pelo conteúdo (e pelo
  que ele importa) e sobe o `gestao-pms-vN` do `sw.js` quando algo guardado offline mudou.
  Testes não fixam números de versão (usar regex `\?v=[0-9a-f]+` e `gestao-pms-v\d+`).
- `.github/workflows/ci.yml` roda a cada push: confere as versões (`--check`), contraste,
  todos os testes de unidade e as telas principais no navegador (390 e 1366). Não bloqueia a
  publicação do Pages; se falhar, aparece ❌ no commit e o GitHub avisa por e-mail — corrigir já.
  Teste novo de tela entra na lista "Telas principais" do workflow.
- Publicação: `.github/workflows/publicar.yml` publica o site só depois que "Testes automáticos"
  passar (requer Settings → Pages → Source = "GitHub Actions"; enquanto for o branch, não faz
  nada). Com isso, teste falhando = site antigo continua no ar até a correção.
  Origem trocada para "GitHub Actions" pelo usuário em 15/11/2026.

## Recursos por grupo (extra_fields) — regra permanente

- `map_inline: true` mostra o mapa dos locais dentro da tela do grupo (`js/group-extras.js`);
  `map_emoji` troca o pino (ex.: 🐂 em LOCAIS DE PEGA DE BOI, Cultura). Também vale no mapa grande.
- `reserva_destino: <id do grupo>` transforma o grupo em CADASTRO RESERVA: os lançamentos ficam
  fora do relatório do destino até serem enviados (botão "➡ Enviar p/ Solicitações" no card ou
  "Enviar selecionados"), via RPC `move_attendance_record` (subitens vão junto), com Desfazer e
  aviso de possível duplicado (mesmo nome ou telefone). Exemplo: CADASTRO RESERVA DE SOLICITAÇÃO
  DE ÁGUA DE PIPA (Gabinete) → SOLICITAÇÃO DE ÁGUA DE PIPA. Grupo de reserva usa
  `refill_control:false`. Teste: `tests/group-extras.browser.cjs` (390 e 1366).

## Busca do topo sempre mostra o resultado (regra permanente)

- Clicar em um resultado (lista instantânea ou "ver todos os resultados") chama
  `revealRecord(tabela, id)` (`js/search-reveal.js`): abre o grupo e, se filtro salvo, busca
  interna, aba Em andamento/Concluídos, mês do arquivo ou item recolhido esconder o lançamento,
  limpa/ajusta, destaca o card e avisa "filtros limpos". Se o filtro não atrapalha, não mexe nele.
- Módulo com filtros próprios expõe um gancho (`pocoReveal`, `licitacaoReveal`,
  `revealCompletedRecord`) e marca o card com o id (`data-well-id`, `data-driller-id`, `data-cr`…).
  Tela nova com filtro salvo precisa do seu gancho. Teste: `tests/search-reveal.browser.cjs`.

## Busca do topo: GRUPOS primeiro (regra do usuário, 20/11/2026)

- Ordem: 1º grupos de lançamento cujo NOME tem o termo; 2º áreas/secretarias pelo nome; 3º lançamentos (primeiro os
  que têm o termo no nome); por último o que só casou em outros campos. `prioritizeResults` (js/search-results.js),
  aplicado sobre `rankSearch` (limite 3000, para nenhum grupo ficar de fora). Painel instantâneo em seções
  (`dropdownHtml`): 📁 Grupos de lançamento (até 6, com "N lançamentos · X em andamento" ou "sem lançamentos ainda"),
  📝 Lançamentos (até 8), 🏛️ Áreas e secretarias, 👤 Contatos e outros; setas navegam só no que está à vista.
  Página "ver todos": cards dos grupos encontrados no topo, depois Secretaria › Grupo › lançamentos.
  Motivo: "areia" não mostrava o grupo PEDIDOS DE AREIA (sem lançamentos) porque lançamentos pontuavam mais.
  Teste: `tests/search-results.test.mjs`.

## Barra de comandos da tela do grupo (regra do usuário, 20/11/2026)

- `css/group-cmdbar.css` + openActivity (index.html): à vista só o principal — "＋ Criar item" (verde) e "▦ Lançar em
  lote" à esquerda; "🔍 Buscar", "📄 PDF", "📋 Lista" e "⚙️ Mais ▾" à direita. O menu "Mais" (details/summary) tem
  seções: Grupo (Editar grupo, percentual, Concluir/Reabrir, Limpar, BCC), Lançamentos marcados (Tornar subitens,
  Excluir selecionados) e, separado em vermelho, Excluir este grupo. Abaixo do título: "👁 Exibição ▾" (formato de
  tabela, Itens/Subitens Lista|Cards, salvar padrão, expandir/recolher) + resumo em fichas finas (concluídos,
  pendentes, atrasados, total, progresso). Menus fecham ao clicar fora/escolher/Esc; um aberto por vez.
  No celular: Criar + Lote numa linha, ferramentas na outra, nada escondido (tudo continua no menu).
  Resto da tela no mesmo padrão compacto (23/11/2026, fim de group-cmdbar.css): título do grupo menor (sem o texto
  "Detalhes e progresso da atividade"; só mostra observações quando existem), responsável em `.activity-owner`, abas
  Em andamento/Concluídos como seletor fino (36px), Exibição + fichas finas na mesma linha, barra "Selecionar todos"
  de uma linha (dica some no celular) e painel do pipa em faixa: título + "Ver no mapa" numa linha, fichas pequenas.
  Atenção: `#content :is([class*="row"]…)` põe max-width:100% — o popover usa `max-width:none!important`.

## Nada fica "sem secretaria" (regra permanente)

- `window.groupHomeSecretary(grupo, registro)` (js/modulos.js) é a ÚNICA regra de "em qual
  secretaria isto fica": 1) secretaria do próprio grupo (Controle de Demandas); 2) secretaria onde
  a área do grupo mora na navegação (`_homeSecretaryNameForModule`: Extintores → DEFESA CIVIL,
  Frota → TRANSPORTES, demais áreas → ADMINISTRAÇÃO); 3) secretaria marcada no lançamento.
  Busca (caminho "Secretaria › Área › Grupo"), mapa, contexto das janelas e lixeira usam essa
  função. Não gravar `demanda_secretaria_id` em grupo que não é de Demandas (isso travaria a
  secretaria dos itens e mexeria em câmera/avisos); tela nova nunca lê `demanda_secretaria_id`
  direto para exibir secretaria. Mudou a casa de uma área? Alterar só `_homeSecretaryNameForModule`.
  Teste: `tests/home-secretary.browser.cjs` (390 e 1366).

## Cadastro reserva herda a permissão do destino (regra permanente)

- Quem pode no grupo de destino (`reserva_destino`) pode o mesmo na reserva dele, sem cadastro
  extra: `window.userCanGroup` (js/modulos.js) e `pms_my_group_ids()` no banco (migração
  20261116213000). Regra geral do usuário: acesso que é consequência óbvia de outro já concedido
  deve ser dado automaticamente, por regra no código + banco, sem perguntar.

## PDF do módulo e padrão dos relatórios (regra permanente)

- `gerarRelatorioModulo` (js/modulos.js): resumo no topo (grupos, lançamentos, concluídos, em
  andamento, atrasados + barra), bloco por grupo com andamento, colunas SÓ quando têm conteúdo
  (prazo, responsável, itens e até 3 campos personalizados mais preenchidos, lidos com `_efv`),
  situação colorida, grupos vazios juntos no fim e "Página X de Y". Todo relatório novo segue
  esse padrão: resumo antes do detalhe, nada de coluna vazia, atrasados em destaque, total de
  páginas. Teste: `tests/module-pdf.browser.cjs` (precisa de LIBS com jspdf).

## Limpezas no banco (procedimento)

- Só com autorização explícita do usuário. Sempre em transação com
  `set local pms.whatsapp_off = 'on'`, conferindo antes o que há dentro (items, subitems,
  field_templates, contas, estoque, requisicoes, chamados, galeria) e com `not exists` no próprio
  DELETE para não apagar nada que tenha ganhado conteúdo. Em 16/11/2026 foram removidos 9 grupos
  de sobra ("Novo Eventos" ×3, "Novo Frota e Veículos", "Novo Controle de Contas", 3 modelos vazios
  de estoque da Saúde, "TESTE") e a secretaria duplicada "SECMULHER".

## Mover / Redirecionar lançamento: destino por secretaria (regra permanente)

- A janela "Mover atendimento"/"Redirecionar demanda" usa `js/group-picker.js` (+ `css/group-picker.css`):
  grupos agrupados por secretaria (origem primeiro, depois ordem alfabética), cada grupo mostra a
  secretaria pai (via `groupHomeSecretary`) e quantos lançamentos tem em aberto; nomes repetidos
  (ex.: "Demandas Gerais de Campo") nunca aparecem sem a secretaria. Busca por secretaria e/ou
  grupo, sem acento, com destaque; Enter escolhe o 1º; setas navegam; cartão "Destino:
  SECRETARIA › Grupo" com "Trocar"; "Usados recentemente" (localStorage `gestao-move-recentes-v1`).
  Botão de confirmar fica desativado até escolher. Qualquer outra tela que peça "grupo de destino"
  deve reutilizar `groupPickerHtml`/`bindGroupPicker`, nunca um `<select>` solto.
  Teste: `tests/group-picker.browser.cjs` (390 e 1366).

## Planilha de lançamentos em lote: ordem das colunas (regra permanente)

- O usuário escolhe a ordem das colunas arrastando o título (⠿), com Alt + ← / → no título ou pelo
  painel "⇄ Colunas" (↑ ↓ e "↺ Ordem padrão"; é o caminho no celular). A ordem fica salva por grupo e
  por tipo (itens/subitens) em `extra_fields.bulk_column_order` do grupo (vale para todos, quando o
  usuário pode gerenciar o grupo) e sempre no aparelho (`bulk-col-order:<uid>:<grupo>:<tipo>`, que tem
  prioridade). Valores do lote são guardados pela chave da coluna: reordenar nunca embaralha dados.
  Campo novo entra ao lado da vizinha natural. Teste: `tests/bulk-columns.browser.cjs` (390 e 1366).

## Nomes das colunas e campos: flexibilidade total por grupo (regra do usuário, 23/11/2026)

- Planilha de lote › "⚙️ Colunas e campos" (ou ✏️ / duplo clique no título da coluna): renomear QUALQUER coluna,
  ordenar, ocultar (👁/🚫) e criar campo novo (texto, número, data, texto longo, lista, escolha única, múltipla).
- Colunas fixas (Nome/descrição, Data da solicitação, Responsável, Solicitante, Urgência, Prioritário, Prazo, Concluído,
  Data da conclusão, Observação): nome por grupo em `extra_fields.field_labels` (`js/field-labels.js`:
  `fieldLabel`/`customFieldLabel`); vale na planilha, no formulário do item (`applyFieldLabelsToModal`), na tabela
  e no PDF. Nome apagado = volta ao padrão. Nome/descrição continua obrigatório (o * é automático).
- Campos personalizados: renomear chama a RPC `pms_rename_field(grupo, antigo, novo, escopo)` (migração
  20261123100000, security definer com checagem de permissão): troca o modelo, a chave em todos os itens/subitens
  do grupo (inclusive grafias antigas), a ordem salva, o campo do quantitativo e os lotes em rascunho, SEM mudar
  autor/data e SEM aviso de WhatsApp. A tela "Editar grupo" usa a mesma RPC.
- Formulário do item/subitem: cada rótulo tem ✏️ (`decorateFieldLabelEditors`, chamado no openItemModal) — campos fixos
  (Nome, Observação, Urgência, Prioritário, Solicitante, Responsáveis, Data início, Prazo) e personalizados
  (`<label data-ef-field>`); edita ali mesmo (Enter salva, Esc cancela), sem perder o que já foi digitado, e o campo aberto
  passa a gravar no nome novo (data-ef-key/data-ef-choice-key atualizados).
- TIPO e EXCLUSÃO (23/11/2026): no painel, "⋯" de cada coluna abre: trocar o tipo do campo personalizado (texto, número,
  data, texto longo, lista, escolha única, múltipla; opções sugeridas a partir do que já foi lançado) via
  `pms_change_field_type` (converte os valores: dd/mm/aaaa → data, "A, B" → caixinhas, data → dd/mm/aaaa em texto);
  transformar campo fixo convertível (Data da solicitação, Prazo, Responsável, Observação, Solicitante) em campo
  personalizado de qualquer tipo via `pms_convert_builtin_field` (copia valores; o fixo vai para removed_fields);
  excluir campo personalizado via `pms_delete_field` (tira dos lançamentos) ou campo fixo removível (`removed_fields`,
  valores ficam nas colunas). Nome/descrição e Concluído/Data da conclusão não são excluíveis. Tudo com volta: tabela
  `field_history` (RLS leitura por grupo; gravação só pelas RPCs security definer) + `pms_restore_field`; lista
  "🗂 Campos excluídos e alterações" no painel com ↺ Restaurar/Desfazer. Sem WhatsApp, sem trocar autor (migração
  20261123140000). Fixo excluído some da planilha, do formulário (`applyFieldLabelsToModal`), da tabela da tela
  (`removedFieldClasses`, colunas 4/5) e do PDF (`removedFieldLabels` no drop de colunas). Teste: `tests/field-types.browser.cjs`.
- Ocultar: `extra_fields.bulk_hidden_columns{item,subitem}`; o que já foi digitado numa coluna oculta fica guardado
  na linha (`row._hidden`) e vai junto no envio. Teste: `tests/field-labels.browser.cjs` (390 e 1366).

## Lote em grupo com Controle de Conclusão (regra permanente)

- Se o grupo tem "📋 Controle de Conclusão" (`controle_pendencias`), a planilha de lote ganha as colunas
  "Concluído" e "Data da conclusão" e o botão "✓ Concluir selecionadas" (marca/desmarca as linhas
  selecionadas; sem seleção de várias linhas, todas as preenchidas). Preencher a data marca concluído
  sozinho; concluído sem data usa a data de hoje. `bulkConclusion` (js/bulk-entry-core.js) monta
  concluded/status/conclusion_date. A função do banco `submit_bulk_entry_draft` grava conclusion_date
  pela migração 20261117140000 (aplicada em 18/11/2026; o site ainda completa a data após o envio, por garantia).
  Teste: `tests/bulk-conclusion.browser.cjs` (390 e 1366).

## Seleção em massa na tela do grupo (regra permanente)

- `js/mass-select.js` (+ `css/mass-select.css`), chamado no openActivity (`decorateMassSelect`): barra
  acima da lista/cards com "Selecionar todos (N)" (só os visíveis), contagem, Shift + clique para
  intervalo, "✓ Concluir N" e "↺ Reabrir N" (só com Controle de Conclusão), "🗑 Excluir" e "Limpar".
  Com seleção, a barra gruda no topo ao rolar. Concluir pede a data (hoje por padrão, pode ir sem data),
  conclui junto os subitens abertos do item (auto_concluded, igual ao ✓ do card) e oferece Desfazer.
  Usa as caixinhas `.mass-sel` já existentes. Teste: `tests/mass-select.browser.cjs` (390 e 1366).
- Ligar/desligar o "📋 Controle de Conclusão" de um tipo de lançamento é configuração do grupo: fica só
  dentro de "✏️ Editar" (caixa `#s-ctrl-pend`), não como botão na barra da tela do grupo (pedido do
  usuário em 17/11/2026).

## PDFs: cabeçalho COMPACTO e layout escolhido pelo usuário (regra permanente, 19/11/2026)

- Nenhum PDF gasta meia folha no topo. Título, números (itens, concluídos, pendentes, atrasados…) e
  percentual ficam numa faixa fina (`drawCompactHeader` em js/pdf-records.js: ~11 mm, fichas baixas,
  barrinha de 1,2 mm). Cards de resumo têm no máximo ~8 mm de altura (número à esquerda, rótulo à direita):
  `drawKpis`, modulos.js, contas, licitações, extintores, poços, BCC, relatório por campo. Nada de faixa
  "ITENS DA ATIVIDADE" nem bloco grande de "Progresso geral" no fim (só uma linha fina). Vale para todo PDF novo.
- Janela "Opções do PDF" › 🧩 Layout do PDF (`js/pdf-layout.js` + `css/pdf-layout.css`): Orientação
  (Automática/Retrato/Paisagem), Formato (Blocos / Tabela = um campo por coluna), Blocos por linha (1–4) e
  Campos dentro do bloco (corridos ou 1–4 colunas), com miniatura da folha que muda na hora; a escolha fica
  lembrada por grupo (localStorage `pdf-layout:<grupo>`). Motor: `drawRecordsTable` (perRow → `drawRecordsGrid`,
  fieldCols → `recordLayout`). Na Tabela, colunas vazias saem e "Item / Descrição" tem largura garantida.
  Teste: `tests/pdf-layout.browser.cjs` (390 e 1366).

## Colunas e campos internos nunca aparecem (regra permanente, 19/11/2026)

- created_by, created_by_name, updated_by, updated_by_name, audit_*, sync_at, item_show_*, show_*, verba,
  documentacao, licitacao, ligações de cadastro: nunca viram coluna, card ou linha de PDF (a tabela da tela usa
  `isSystemKey` de js/record-fields.js). Verba / Origem da verba / Documentação / Licitação aparecem só com esses
  nomes e SÓ quando estão marcados na edição do grupo (`controlFields`); desmarcados = nunca aparecem, nem "0".

## Controle de Multas (Frota e Veículos, regra permanente, 19/11/2026)

- Grupo `controle-multas` (TRANSPORTES › Frota e Veículos, `extra_fields: {modulo:'frota', controle_multas:1}`),
  tela própria `js/controle-multas.js` + `css/controle-multas.css` (openActivity → `renderControleMultas`).
- O veículo vem SEMPRE do cadastro da frota (itens dos grupos de veículos; sem placa/0 km → identificado pelo
  chassi) e a SECRETARIA vem do cadastro do veículo ("Unidade Vinculada"/"Secretaria" ou o nome do grupo:
  VEÍCULOS DA EDUCAÇÃO → EDUCAÇÃO). Cada multa é um item do grupo: cadastro_id/cadastro_grupo do veículo, Placa,
  Veículo, Secretaria, Data da ocorrência, Hora, Vencimento (= deadline_date), Auto de infração, Órgão autuador,
  Infração, Gravidade, Pontos, Valor, Local, Condutor, Situação (Em aberto, Indicação de condutor, Em recurso,
  Paga, Cancelada), Data do pagamento, Valor pago, Observações. Paga/Cancelada = concluída (conclusion_date).
- Tela: fichas compactas (Em aberto, Vencidas, Vencem em 7 dias, Pagas no ano, Pontos no ano — clicáveis como
  filtro), busca (placa sem hífen, veículo, infração, auto, condutor), filtros por secretaria/situação/ano, abas
  📋 Multas · 🚗 Por veículo (ranking) · 🏛️ Por secretaria; linha fina com placa estilizada, selo da secretaria,
  "🚗 Ficha" (abre o cadastro), valor, prazo colorido (vencida/vence hoje/em N dias), ✓ Paga, ✏️, 🗑️ (lixeira).
- Lançar: escolher o veículo digitando placa/modelo/secretaria (mostra os dados do cadastro, a secretaria
  automática e o histórico de multas do veículo); infração da lista sugere gravidade, pontos e valor do CTB;
  mostra o valor com desconto (−20% até o vencimento, −40% pelo SNE); avisa auto de infração repetido; condutor
  com sugestões do cadastro de PESSOAS. No cadastro do veículo aparece "🔗 Aparece em CONTROLE DE MULTAS ×N".
- PDF paisagem, cabeçalho compacto, por secretaria com subtotal e total, vencidas em vermelho, colunas vazias
  saem. Busca do topo: gancho `multasReveal` + `data-multa-id`. Teste: `tests/controle-multas.browser.cjs`.

## Recebimento de Leite (CEDOCA, regra permanente, 19/11/2026)

- Grupo `cedoca-recebimento-leite` (CEDOCA, `extra_fields: {modulo:'atendimentos', controle_leite:1, produtores_grupo,
  leite_precos:{'AAAA-MM-1|2': preço}, leite_cotas:{…}}`), tela `js/controle-leite.js` + `css/controle-leite.css`
  (openActivity → `renderControleLeite`). Produtores vêm SEMPRE do cadastro PRODUTORES DE LEITE DE CABRA
  (`e370b0ca-…`, campos Nº, Referência / responsável, Chave PIX, Telefone, Localidade, Tipo de leite, Situação).
- Cada DIA de coleta é um item: `Data`, `Preço por litro`, `Resfriador (L)`, `leite_entregas {id do produtor: litros}`
  (chave interna, nunca vira coluna). Importados em 19/11/2026 da planilha "Planilha Recebimento Produtor NOV 2026":
  54 produtores, 26 dias (16–27/10 a R$ 3,51; novembro a R$ 3,69; 1ª quinz. NOV 16.034,5 L, cota 15.930).
- Tela: Semana (seg–dom) / Quinzena (1–15, 16–fim) / Mês com ‹ ›; fichas (litros + variação da média diária, valor,
  produtores que entregaram, média/dia, maior produtor), barra da cota, gráfico por dia; abas 📋 Planilha
  (produtor × dia; no mês, colunas por semana e por quinzena; clique na célula lança/corrige), 🏆 Por produtor
  (ranking, dias, média, %, "sem entregar há N dias"), 📅 Por dia, 🧾 Recibos. Lançar: lista dos ativos, Enter passa,
  total ao vivo, cadastrar produtor novo na hora; mesmo dia = corrige o lançamento existente. ⚙️ preço/cota por quinzena.
  PDF paisagem com cabeçalho compacto; recibos 2 por folha com PIX e assinaturas; "📋 Resumo" copia texto para WhatsApp.
  Teste: `tests/controle-leite.browser.cjs` (390 e 1366).

## Datas: o dia digitado é o dia mostrado, sempre (regra permanente do usuário, 17/11/2026)

- "A data que eu colocar e que estiver aparecendo na tela é a data que vai aparecer em tudo." Fuso
  horário NUNCA pode mudar o dia de uma data de calendário (conclusão, prazo, início, fim).
- No banco essas datas ficam como o dia à meia-noite UTC (convenção de todos os registros). Ao carregar,
  `calendarDate` (supabase_compat.js, em `mergeExtraFields`) converte para meio-dia local do mesmo dia, e
  `fmtD`/`dateLabel` também passam por ela; assim new Date()/toLocaleDateString e agrupamento por mês
  nunca voltam um dia em Recife (UTC-3). Gravar sempre só "AAAA-MM-DD" (sem hora/fuso) nesses campos.
  Tela/relatório novo que mostra data de calendário: usar fmtD/fmtDay ou `calendarDate` antes de `new Date`.
  Teste (navegador em America/Recife): `tests/calendar-dates.browser.cjs`.

## Formato de data: SEMPRE dd/mm/aaaa (regra do usuário, 23/11/2026)

- "Nunca mais mm/dd/aaaa", em tela, formulário, planilha, PDF e relatório. O `<input type="date">` nativo usa o idioma do
  NAVEGADOR (em inglês mostra mm/dd/yyyy), então `js/date-br.js` + `css/date-br.css` (carregados no index) põem em TODO
  campo date/datetime-local (inclusive os criados depois, via MutationObserver) uma caixa de texto dd/mm/aaaa com máscara,
  tecla H = hoje, colar data BR ou ISO e botão 📅 (showPicker do campo nativo). O campo nativo fica escondido no mesmo lugar
  e continua com o valor AAAA-MM-DD: código que lê/grava `.value`, eventos input/change e onchange="" funcionam igual.
  Data impossível (31/02) fica vermelha, avisa e volta ao valor anterior. Planilha de lote mostra datas em dd/mm/aaaa.
  Texto de data em tela/PDF: só `fmtD`/`toLocaleDateString('pt-BR')` — nunca toLocaleDateString() sem idioma nem ISO cru.
  Teste: `tests/date-br.browser.cjs` (roda com o navegador em inglês; 390 e 1366).

## Linhas finas e Concluídos por dia (regra permanente, 17/11/2026)

- Máximo de informação por tela: linhas de lançamento o mais finas possível em todo o site
  (`css/completed-compact.css`, carregado por último): item-row ~44px no computador, selo de pipa
  ("💧 Sem data de abastecimento") na mesma linha do nome (autoria.js põe dentro de `.item-name`).
  Nada de linha extra só para um selo; espaço lateral sobrando = colocar a informação na linha.
- Concluídos (mês aberto): linhas finas agrupadas pelo DIA da conclusão, mais recente primeiro, com
  cabeçalho "📅 04/11/2026 · QUA" + quantidade e rodapé "Total do dia … N lançamentos"; a data não se
  repete em cada linha. A busca do mês esconde dias vazios e mostra "X de N".
- Barra do mês em destaque (verde escuro, fixa ao rolar no computador), botão "← Meses" amarelo e
  grande. Breadcrumbs: Grupo › ✓ Concluídos › 📅 NOV-2026, e o Voltar sobe um nível por vez
  (mês → meses → Em andamento). `setNavLeaf` aceita `crumbs:[...]` (vários níveis) e `parentGo`.
  Toda sub-tela nova dentro de um grupo deve registrar seus níveis assim; nenhuma tela pai fica de fora.
  Teste: `tests/completed-days.browser.cjs` (390 e 1366).

## NUNCA espremer texto (regra permanente e absoluta, 18/11/2026)

- Texto nunca pode virar uma coluna fininha com letras empilhadas, em nenhuma largura (celular,
  tablet, notebook, monitor grande). Todo bloco de texto dentro de uma linha flex precisa de largura
  mínima garantida (`flex:1 1 260px; min-width:min(260px,100%)` no nome do lançamento) e a linha
  precisa de `flex-wrap:wrap`: sem espaço, os BOTÕES descem para a linha de baixo, o texto nunca encolhe.
  Nunca usar `min-width:0` sozinho em bloco de texto que divide a linha com botões/selos.
- Teste obrigatório: `tests/text-squeeze.browser.cjs` varre 12 larguras (360 a 1600px) em lista, cards,
  atendimento e concluídos e falha se algum texto tiver <70px com mais de 2 linhas ou nome <140px.
  Qualquer mudança de layout de linhas/cards deve passar nele.

## Controle de Contas › Relatório por secretaria (regra permanente, 18/11/2026)

- Aba "📑 Relatório por secretaria" (`js/contas-relatorio.js` + `css/contas-relatorio.css`): faixa da
  SECRETARIA (campo "Unidade Vinculada" do local; sem ele, o nome da categoria) › linha título do LOCAL
  com Conta contrato, Relógio e distrito › linhas recuadas por mês (Mês/Ano, tipo/leitura/consumo só se
  houver dado, vencimento, pagamento, valor, situação colorida, observações) › total do local › total da
  secretaria; resumo geral no topo; locais sem conta no período listados no fim de cada secretaria.
  Filtros na própria aba: Ano (padrão = mais recente), Tipo (padrão Luz), Secretaria; respeita a busca e
  Pago/Pendente do topo. "📄 Gerar PDF deste relatório" gera o PDF paisagem com a MESMA estrutura,
  cabeçalho com logo, "Página X de Y". Teste: `tests/contas-relatorio.browser.cjs` (390 e 1366).
- Mês com várias contas no mesmo local: linha pai "🗓️ FEV/2025 · N contas no mês", contas recuadas (↳) e
  "Total de FEV/2025" embaixo (tela e PDF). Aba "🏢 Cadastro dos locais": um local por linha agrupado por
  secretaria, com Conta contrato, Relógio/medidor, Endereço, Distrito, Prédio do município e demais
  campos (grafias diferentes do mesmo campo unificadas; flags internas ocultas), "não informado" em
  vermelho quando falta conta contrato, contas lançadas (quantidade + última) e PDF com a mesma estrutura. Desde 19/11/2026 em BLOCOS COMPACTOS
  (estilo do PDF dos cadastros): número, nome do local e, embaixo, "RÓTULO: valor" corrido; PDF usa o mesmo
  motor de blocos e o último layout escolhido.

## Cadastro único ↔ lançamentos (regra permanente, 18/11/2026)

- "Tudo que for cadastro fica num local de cadastros; lançamentos e relatórios ficam em outro local,
  puxando desses cadastros." Estabelecimentos: ADMINISTRAÇÃO › Cadastros (PRÉDIOS E LOCAIS PÚBLICOS
  `cad-predios-locais-publicos`, EQUIPAMENTOS DA EDUCAÇÃO, EQUIPAMENTOS DE SAÚDE, CEMITÉRIOS). Veículos e
  máquinas: grupos da Frota por secretaria (VEÍCULOS DA EDUCAÇÃO, DA ASSISTÊNCIA SOCIAL, DA ADMINISTRAÇÃO,
  DA SAÚDE `cad-veiculos-saude`, DA AGRICULTURA, GABINETE, MULHER, INFRAESTRUTURA, CEDOCA).
- Ligação nos dois sentidos em `extra_fields`: registro do controle (local do Controle de Contas, veículo do
  SEGUROS) → `cadastro_id` + `cadastro_grupo` (+ "Outro nome" = nome antigo); item do cadastro →
  `contas_local_id`. Resumos sem estabelecimento (OUTROS, ILUMINAÇÃO PÚBLICA, POÇOS…) → `agrupador: true`.
  Essas chaves são internas: nunca aparecem em tabela/card/PDF (`record-fields.js`, `isInternal` do index).
- O CADASTRO É O CORAÇÃO (regra do usuário, 19/11/2026): todo cadastro (prédio, local, escola, veículo,
  trator, caminhão, pessoa…) guarda TODAS as informações daquela coisa, sem faltar nada; Controle de Contas,
  Seguros, multas e qualquer controle PUXAM de lá. Em 19/11/2026 todos os campos preenchidos dos locais e
  veículos ligados foram copiados para os cadastros (conta contrato, relógio, distrito, prédio do município…)
  e cada grupo de cadastro ganhou os modelos de campo (field_templates) que faltavam — assim os campos
  aparecem no formulário, na tabela e na janela do PDF. Salvar um local no controle grava tudo também no
  cadastro (`_ccSyncCadastro`); a janela do local mostra os dados do cadastro.
- `js/cadastro-links.js`: `hydrate(S)` roda no `loadData`; o nome exibido no controle é o do cadastro
  (veículo: "ÔNIBUS - PGG7965"); `fields(rec)` = todos os campos do CADASTRO primeiro + os do controle
  só no que o cadastro não tiver (renovação de apólice e conta contrato gravam nos dois). Ligações ficam em WeakMap (`cad`, `linked`, `ownName`),
  nunca como propriedade do registro (viraria coluna nas tabelas).
- Controle de Contas/Seguros: ligados com selo "🔗 cadastro"; não ligados/resumos com 📦 no fim e, no
  relatório, no bloco "📦 CONTAS SEM ESTABELECIMENTO CADASTRADO". "Novo local/veículo" oferece "Puxar do
  cadastro" (só os ainda sem ligação); sem escolha, cria também no cadastro (sem duplicar: mesmo nome ou
  mesma placa reaproveita). Renomear no controle renomeia o cadastro; conta contrato e renovação de apólice
  gravam nos dois. Reconciliação de 18/11/2026: 156 locais + 44 veículos ligados, 0 duplicados criados.
- PESSOAS (`cad-pessoas`, ADMINISTRAÇÃO › Cadastros): SÓ SERVIDORES EFETIVOS E COMISSIONADOS (regra do
  usuário, 19/11/2026: "as pessoas normais na cidade não entram em cadastro"). Fonte = `pms_pessoas_fontes()`:
  CONTROLE DE EMPREGOS / VEREADORES › itens "FOLHA OFICIAL - …" com Vínculo = 1 (efetivos e cargos CC/AP) e
  vigias com vínculo EFETIVO/COMISSIONADO. BCCS, contratados por secretaria, taxistas e beneficiários NÃO entram.
  Migração 20261118180000 aplicada em 19/11/2026: 1.374 fichas, 1.400 registros ligados (Vínculo 2 = a confirmar com o usuário). Mesma
  pessoa = mesmo CPF ou, sem CPF, mesmo nome (`pms_nome_chave`: sem acento/parênteses). Na ficha só entram
  identificação e contato (CPF, RG, NIS, CNH, telefone, endereço, localidade); salário, função, indicação ficam
  só na lista de origem. `pms_pessoas_sync()` (migração 20261118170000) é idempotente, não dispara WhatsApp e
  roda todo dia 03:10 (pg_cron `pessoas-sync`): pessoa nova lançada numa lista ganha ficha sozinha. Lista nova de
  pessoas = acrescentar uma linha em `fontes` da função. Primeira execução: 1887 fichas, 2353 registros ligados.
- Telas: `decorateCadastroLinks` (no openActivity + MutationObserver) põe na linha do nome "🔗 Aparece em"
  (grupos onde o cadastro é usado, ×N) nos cadastros e "👤/🏢/🚗 Ficha no cadastro" nos registros ligados;
  clique usa `revealRecord`. Só mostra grupos que o usuário pode ver (dados do banco já filtrados + userCanGroup).
- NÃO ligar solicitantes de demandas (água de pipa, saneamento, retro etc.) ao cadastro de PESSOAS: o
  usuário recusou explicitamente em 18/11/2026. O cadastro de pessoas vale só para as listas de pessoas.
- Testes: `tests/contas-relatorio.browser.cjs` e `tests/cadastro-links.browser.cjs` (390 e 1366).
