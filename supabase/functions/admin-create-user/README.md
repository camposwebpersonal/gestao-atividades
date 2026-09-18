Cadastro administrativo sem o fluxo público de signup e sem e-mail de confirmação.
A função valida a sessão e exige role=admin ou is_admin=true no perfil da tabela users.
A chave de serviço é lida das variáveis internas do Supabase e não é enviada ao navegador.

Publicar no projeto existente:

```sh
supabase functions deploy admin-create-user --project-ref xwlmpxypjheuhbxyfplo
```

O formulário usa essa função quando não existe chave administrativa legada salva no navegador.
