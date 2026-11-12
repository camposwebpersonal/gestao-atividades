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
