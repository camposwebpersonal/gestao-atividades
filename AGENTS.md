# Preferências do usuário para este projeto

- SEMPRE fazer commit e push (`git push`) de qualquer alteração diretamente para o
  branch `main` no GitHub assim que a mudança for concluída, SEM perguntar ao
  usuário se deve publicar. O usuário quer tudo publicado automaticamente e
  imediatamente, sempre.
- Não perguntar "quer testar local antes ou publicar direto?" — a resposta é
  sempre publicar direto.
- SEMPRE priorizar o método de autenticação que funcionou: `git push origin main`
  com `core.askPass` configurado para `.git/github-askpass.py`. Esse adaptador lê
  a credencial existente do servidor GitHub na configuração MCP local do usuário.
  Não depender do botão de reconexão OAuth para publicar.
- Nunca imprimir, copiar para o repositório ou incluir em commits a credencial.
  O adaptador fica apenas em `.git`, fora do versionamento, e fornece a credencial
  diretamente ao Git. A configuração MCP também não deve ser versionada.
- Em um novo checkout, verificar e configurar esse adaptador antes de publicar,
  usando a configuração MCP local existente. Não presumir que o
  `git-credential-libsecret` está instalado ou configurado.
- Se a credencial expirar ou for revogada, informar o impedimento de autenticação;
  nunca afirmar que publicou sem confirmação de sucesso do GitHub.
