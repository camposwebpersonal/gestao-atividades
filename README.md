# Gestão de Atividades — PMS

Sistema de gestão de atividades da **Prefeitura Municipal de Sertânia**.

## Stack
- **Frontend:** HTML + CSS + JavaScript puro (sem framework)
- **Banco de dados:** Firebase Firestore (realtime, sem servidor)
- **Autenticação:** Firebase Authentication
- **Imagens:** ImgBB API (sem base64 no banco)
- **Hospedagem:** GitHub Pages (gratuito, sem limites de CPU)
- **Mobile:** PWA (Progressive Web App) — funciona como app nativo no Android e iOS

## Funcionalidades

| Módulo | Descrição |
|---|---|
| 📅 **Atividades** | Gestão de atividades com itens, subitens e sub-subitens |
| 🔢 **Numeração Hierárquica** | Itens numerados automaticamente (1, 1.1, 1.1.1) na web e PDF |
| 🖱️ **Drag & Drop** | Reordenação de itens e subitens por arrastar e soltar |
| 🏛️ **Secretarias** | Cadastro de secretarias municipais |
| 👤 **Responsáveis** | Cadastro de responsáveis com cargo, setor e contato |
| 🎫 **Chamados** | Solicitações entre setores com filtros e prioridade |
| 🖼️ **Galeria** | Registro fotográfico com metadados e PDF espetacular |
| 📇 **Contatos** | Cartilha de contatos municipais com PDF A4 |
| 🔐 **Login** | Níveis de acesso (Admin, Gestor, Usuário) + recuperação de senha |
| 📱 **Mobile** | PWA instalável em Android e iOS |
| 📊 **Planilha Pendências** | Planilha de exames com ANO automático |

## Instalação no Celular (PWA)

Veja o arquivo **[INSTALAR_PWA.md](INSTALAR_PWA.md)** para instruções detalhadas com prints.

**Resumo rápido:**
- **Android:** Chrome → 3 pontos → "Adicionar à tela inicial"
- **iPhone/iPad:** Safari → Compartilhar (📤) → "Adicionar à Tela de Início"

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
   - Campos: `email`, `displayName`, `role: "admin"`, `setor: "TI"`

### 4. GitHub Pages
Settings → Pages → Source: `main` branch → `/` (root)

URL: `https://camposwebpersonal.github.io/gestao-atividades/`

### 5. Deploy, recuperação e bootstrap legado
Os scripts `deploy.py` e `setup_recuperacao.py` usam estas variáveis de ambiente para as conexões FTP:

- `FTP_PBATRANSPORTES_USER` e `FTP_PBATRANSPORTES_PASS`
- `FTP_CINTERNO_USER` e `FTP_CINTERNO_PASS`
- `FTP_PRACIMASERTANIA_USER` e `FTP_PRACIMASERTANIA_PASS`

O bootstrap do app PHP legado só cria o primeiro administrador quando `CI_BOOTSTRAP_ADMIN_PASSWORD` estiver definida.

## Coleções Firestore

| Coleção | Descrição |
|---|---|
| `secretariats` | Atividades |
| `items` | Itens das atividades |
| `subitems` | Sub-itens |
| `fieldTemplates` | Campos extras dinâmicos |
| `secretarias` | Secretarias municipais |
| `responsaveis` | Responsáveis |
| `users` | Usuários com role e setor |
| `chamados` | Chamados entre setores |
| `galeria` | Fotos com metadados |
| `contatos` | Cartilha de contatos |
