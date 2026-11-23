# NEURO UX — neuroarquitetura aplicada às telas (regra permanente do Ricardo, 23/11/2026)

> "Sempre utilizar neuroarquitetura, layout intuitivo, super fácil de usar, despertando uma experiência
> emocional incrível para o usuário, em tudo: projetos, sites, sistemas, cartazes, artes."

A ideia: a tela é um **ambiente**, não uma página. Quem entra precisa se sentir acolhido, entender em
segundos onde está e o que fazer, e sair com sensação de progresso — como num lugar bonito e bem organizado.

## Os 8 princípios e como aplicar

| Princípio | Na prática (o que fazer em toda tela nova) |
|---|---|
| 1. Arquitetura visual | Blocos com respiro, alinhados numa grade; hierarquia clara: **situação → números → ações → detalhes**. Nada apertado, nada sobreposto, nada vazando. |
| 2. Cores com intenção | Azul-petróleo e verde = confiança e calma (base). Âmbar = atenção. Vermelho **só** quando existe problema real (zero não é vermelho). Contraste mínimo AA (4,5:1). |
| 3. Conforto cognitivo | Frase humana no lugar de número solto ("Faltam 3 contas para fechar 100%"). Não repetir o mesmo dado; zeros discretos ("—"); agrupar em vez de repetir nomes em cada linha; revelação progressiva (detalhes recolhíveis). |
| 4. Biofilia digital | Tons de água e folha, formas orgânicas suaves, gradientes leves no topo. Nada pesado ou escuro no tema claro. |
| 5. Iluminação | Fundo claro e macio, sombras leves, cantos arredondados (12–20px). |
| 6. Microinterações | Anel de progresso que se desenha, números que contam até o valor, cartões que levantam 2px no hover, setas que andam. Rápidas (≤ 1 s) e sempre respeitando `prefers-reduced-motion`. |
| 7. Acolhimento | Saudação ("Boa tarde, Ricardo 👋"), linguagem positiva e respeitosa, sem alarme desnecessário; quando há problema, diz o que fazer e oferece o botão para resolver. |
| 8. Descoberta e recompensa | "Portas" grandes para cada tarefa (com o que tem lá dentro); celebrar quando está tudo em dia ("Tudo em dia ✨"); cartões clicáveis que levam direto ao detalhe. |

## Regras técnicas que acompanham

- **Nenhum número sai do card**, em nenhuma largura: `container-type: inline-size` no card + `font-size: clamp(…cqi…)`
  no valor + encaixe automático por JS (diminui a letra até caber, refaz com `ResizeObserver`) + valor completo no
  `title`. Testar varrendo 360 → 1920 px.
- Celular e computador com as mesmas funções (reorganizar, nunca esconder ação).
- Datas sempre dd/mm/aaaa; moeda sempre `R$ 1.234,56`.
- Toda tela passa na auditoria de contraste (`tests/contrast/run.cjs`, 390 e 1366).
- Percentual honesto: só mostra 100% quando está realmente tudo pago (99,96% vira 99,9%).
- **PDFs também seguem a neuroarquitetura** (`js/contas-pdf-neuro.js` › `window.ccnPdf`): cabeçalho compacto e claro
  (`header`), situação em uma frase num quadro calmo (`situation` + `mood`), fichas cujo valor encolhe até caber
  (`kpis` / `fitText`), barra do pago (`progress`), tabelas suaves (`table`) e rodapé "Página X de Y" (`footer`).
  Vermelho só para atraso real; pendente em âmbar; pago em verde.
- Peças de tela reutilizáveis: `window.ccnKpi(cls, ícone, rótulo, valor, sub)`, `window.ccnRing(pct, sub)`,
  classes `.ccn-hero(.ccn-hero-sm)`, `.ccn-intro`, `.ccn-kpis`, `.ccn-mini`, `.ccn-card`, `.ccn-fit` (encaixe automático).

## Onde já está aplicado

- **Controle de Contas › Visão geral** (`js/controle-contas.js` › `_ccOverviewHtml`, `css/contas-neuro.css`,
  teste `tests/contas-neuro.browser.cjs`): faixa de acolhimento com situação em frase + anel de progresso, 4 fichas
  (Total, Pago, Pendente, Vencidas), 4 portas (Lançar e conferir, Vencimentos, Relatório por secretaria, Cadastro dos
  locais), "Onde está o dinheiro" por categoria (clicável → filtra os lançamentos), tipos de conta e detalhamento por
  local agrupado por categoria com busca própria. Ajustes do administrador num menu "⚙️ Ajustes".
- **Controle de Contas › todas as abas e PDFs** (teste `tests/contas-abas-neuro.browser.cjs`):
  - Lançamentos: faixa "Lançar e conferir", passos numerados 1→5, meses em calendário que quebra linha com a situação
    em palavras (✓ tudo pago / ⏳ N pendentes, barra verde ou âmbar), totais do ano e do mês em pílulas.
  - Vencimentos: situação em frase ("2 contas vencidas · R$ … — comece pela mais antiga"), fichas (vencidas, esta
    semana, 30 dias, apólices), grupos por urgência e ação direta "✓ Marcar paga" (preenche a data de pagamento),
    apólices com "📱 Avisar" (WhatsApp) e "✅ Renovado"; celebração quando não há nada vencendo.
  - Relatório por secretaria e Cadastro dos locais: situação em frase + anel + fichas; faixas das secretarias claras.
  - PDFs (geral, por secretaria, cadastro): cabeçalho compacto, situação, fichas, barra do pago e rodapé paginado.
