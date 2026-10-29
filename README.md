# Gestão de Atividades — PMS

Sistema de gestão de atividades da **Prefeitura Municipal de Sertânia**.

## Stack
- **Frontend:** HTML + CSS + JavaScript puro (sem framework)
- **Banco de dados:** Supabase Postgres + Realtime
- **Autenticação:** Supabase Auth
- **Imagens:** Supabase Storage com CDN e fila offline persistente
- **Hospedagem:** GitHub Pages
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

### 1. Armazenamento de imagens
As imagens são enviadas ao bucket `gestao-imagens` do Supabase Storage. Em falhas temporárias, a cópia otimizada permanece na fila offline do navegador e é sincronizada automaticamente; nenhuma chave externa de hospedagem de imagens é necessária.

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
