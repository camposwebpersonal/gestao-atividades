# Ativar edição de login, transferência e autoria

O frontend usa a função existente `super-worker` e o banco do projeto
`xwlmpxypjheuhbxyfplo`.

1. No SQL Editor, execute todo `sql/ativar-atendimentos-autoria.sql`.
   Ao terminar, o resultado será `Autoria e transferências ativadas`.
2. Em Edge Functions, abra **super-worker** e o editor de código.
   Substitua o conteúdo de `index.ts` pelo arquivo único preparado em
   `/tmp/admin-create-user.ts` e publique com **Deploy**.
   O código também está versionado em `functions/admin-create-user/handler.js`
   e `functions/admin-create-user/index.ts`, em dois arquivos.
3. Atualize a aplicação com Ctrl + Shift + R.

As permissões administrativas são verificadas no servidor antes de editar login
ou senha. A alteração do nome de usuário mantém o ID da conta e atualiza o e-mail
interno de autenticação. Se o perfil não puder ser salvo, a função tenta restaurar
o login original e informa qualquer falha nessa restauração.

A transferência conserva campos extras, fotos e autoria, adapta poços à
estrutura de perfuradores e solicita localidade/data. Transferir um grupo com
filhos para poços é recusado; mova cada solicitação individualmente. Outras
transferências levam os filhos junto e mantêm a hierarquia. A operação inteira
é uma transação no banco. Histórico de transferências fica nos campos extras.

Autoria é registrada por triggers nas tabelas públicas com ID existentes no
momento da instalação. Cadastros antigos sem histórico não recebem um autor
inventado. Novas tabelas criadas posteriormente exigem reaplicar a instalação.
A planilha de exames do sistema legado Firebase registra autoria por linha
quando a linha é criada ou alterada e salva. Essa gravação usa a identidade já
autenticada no sistema de exames.

Validação: testes JavaScript, navegador local em 1440/390 px e PostgreSQL 16
isolado usando o schema do repositório. Nenhuma conta real foi alterada nos testes.
