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
