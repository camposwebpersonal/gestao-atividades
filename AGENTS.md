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
- Esta preferência não autoriza exclusão de dados, gastos ou mudanças sem relação
  com a tarefa solicitada.
- Este arquivo preserva as preferências para sessões que leiam o repositório;
  credenciais podem expirar e precisam ser verificadas novamente quando necessário.
