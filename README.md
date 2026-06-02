# Gestão de Atividades — PMS

Sistema de gestão de atividades da Prefeitura Municipal de Sertânia.

## Stack
- **Frontend:** HTML + CSS + JavaScript puro (sem framework)
- **Banco de dados:** Firebase Firestore (realtime, sem servidor)
- **Autenticação:** Firebase Authentication
- **Imagens:** ImgBB API (sem base64 no banco)
- **Hospedagem:** GitHub Pages (gratuito, sem limites de CPU)

## Configuração

### 1. ImgBB API Key
Em `index.html`, localize e substitua:
```js
let IMGBB_KEY="COLOQUE_SUA_CHAVE_IMGBB_AQUI";
```

### 2. Firebase
O projeto já está configurado em `gestao-atividades-26257`.

Ative no Console Firebase:
- **Authentication** → Sign-in methods → Email/Password ✅
- **Firestore Database** → Crie o banco (modo produção)
- Aplique as regras de `firestore.rules`

### 3. Criar primeiro usuário Admin
1. Firebase Console → Authentication → Add user
2. Firestore → Coleção `/users` → Novo documento:
   - ID: (UID do usuário criado)
   - Campos: `email`, `displayName`, `role: "admin"`

### 4. GitHub Pages
Settings → Pages → Source: `main` branch → `/` (root)

URL: `https://camposwebpersonal.github.io/gestao-atividades/`

## Coleções Firestore

| Coleção | Descrição |
|---|---|
| `secretariats` | Atividades |
| `items` | Itens das atividades |
| `subitems` | Sub-itens |
| `entity_images` | Galeria de imagens (URL ImgBB) |
| `users` | Usuários do sistema |
