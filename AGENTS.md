# Preferências do usuário para este projeto

- SEMPRE fazer commit e push (`git push`) de qualquer alteração diretamente para o
  branch `main` no GitHub assim que a mudança for concluída, SEM perguntar ao
  usuário se deve publicar. O usuário quer tudo publicado automaticamente e
  imediatamente, sempre.
- Não perguntar "quer testar local antes ou publicar direto?" — a resposta é
  sempre publicar direto.
- O token do GitHub do usuário já está salvo com segurança no chaveiro do
  sistema (git-credential-libsecret), configurado como credential.helper
  deste repositório. NÃO é mais necessário pedir o token ao usuário: basta
  rodar `git push origin main` normalmente que a autenticação acontece
  sozinha via chaveiro. Só peça o token novamente se o push falhar por
  autenticação (ex.: token expirado/revogado).
