# 📱 Como Instalar o Gestão PMS no Celular

O sistema é um **PWA** (Progressive Web App), ou seja, funciona como um app nativo no celular sem precisar da Play Store nem da App Store. Basta instalar diretamente pelo navegador.

---

## 🤖 ANDROID (Chrome)

### Passo 1 — Acessar o site
Abra o **Chrome** no celular e acesse:
```
https://camposwebpersonal.github.io/gestao-atividades/
```

### Passo 2 — Abrir o menu
Toque nos **3 pontinhos** (⋮) no canto superior direito do Chrome.

### Passo 3 — "Adicionar à tela inicial"
Toque em **"Adicionar à tela inicial"** ou **"Instalar app"**.

### Passo 4 — Confirmar
Toque em **"Adicionar"** ou **"Instalar"**.

### Pronto! 🎉
O ícone do **Gestão PMS** aparecerá na sua tela inicial, igual a um app normal. Ao abrir, ele abre em tela cheia (sem barra de endereço do Chrome).

---

## 🍎 iOS (Safari iPhone/iPad)

### Passo 1 — Acessar o site
Abra o **Safari** e acesse:
```
https://camposwebpersonal.github.io/gestao-atividades/
```

> ⚠️ **IMPORTANTE:** Use obrigatoriamente o Safari. O Chrome no iOS não permite instalar PWAs.

### Passo 2 — Compartilhar
Toque no botão **Compartilhar** (📤 quadrado com seta para cima), na barra inferior do Safari.

### Passo 3 — "Adicionar à Tela de Início"
Role para baixo na lista e toque em **"Adicionar à Tela de Início"**.

### Passo 4 — Confirmar
Toque em **"Adicionar"** no canto superior direito.

### Pronto! 🎉
O ícone aparece na tela inicial do iPhone/iPad. Ao abrir, funciona como app nativo em tela cheia.

---

## 🔄 Como atualizar o app

O app se atualiza automaticamente quando você abre com internet. Não precisa fazer nada manualmente.

Se quiser forçar a atualização:
- **Android:** Fechar o app completamente e abrir de novo
- **iOS:** Fechar o app (arrastar para cima no multitarefa) e abrir novamente

---

## ❓ Problemas comuns

| Problema | Solução |
|---|---|
| Não aparece "Adicionar à tela inicial" | Certifique-se de acessar pelo **Chrome** (Android) ou **Safari** (iOS) |
| App abre no navegador, não em tela cheia | No iOS, certifique-se de abrir pelo ícone da tela inicial, não pelo Safari |
| Dados não carregam offline | O cache funciona para páginas estáticas. Dados do Firebase precisam de internet |
| Quer remover o app | Segure o ícone → "Remover" (igual a qualquer outro app) |

---

## 📋 Resumo para compartilhar com a equipe

**Android:** Chrome → 3 pontos → "Adicionar à tela inicial" → Adicionar

**iPhone/iPad:** Safari → Compartilhar (📤) → "Adicionar à Tela de Início" → Adicionar

---

## 🔧 Configuração técnica (para desenvolvedores)

Os arquivos que tornam isso possível:
- `manifest.json` — Define nome, ícone, cor e comportamento do app
- `sw.js` — Service Worker que habilita cache offline
- Meta tags no `<head>` de `index.html` e `login.html` — Configuração iOS

Não é necessário fazer download de APK ou usar a App Store.
