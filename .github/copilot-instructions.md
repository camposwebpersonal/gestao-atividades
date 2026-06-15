# Instrucoes para o Cascade / Devin / Copilot

## Se o usuario disser algo como:
- "Leia o deploy.py no meu GitHub"
- "Leia o deploy.py no meu GitHub e voce sabera o que fazer"
- "Conecte em todos os meus sites"
- "Deixe tudo pronto para eu pedir ajustes"

## FACA Imediatamente (sem perguntar confirmacao):

1. Clone o repo `camposwebpersonal/gestao-atividades` se ainda nao estiver clonado
2. Va para a pasta `gestao-atividades/`
3. Rode: `python setup_recuperacao.py --auto`
   - Isso baixa todos os sites FTP (pbatransportes, cinterno, pracimasertania) para as pastas locais
4. Rode: `python deploy.py --check-all`
   - Testa conexao em TODOS os sites (GitHub + FTP)
5. Diga: "Tudo pronto! Pode pedir os ajustes nos sites."

## Sites e credenciais (tudo ja esta no deploy.py):

| Site | Tipo | URL |
|------|------|-----|
| Gestao de Atividades | GitHub/Vercel | gestao-atividades.vercel.app |
| PBA Transportes | FTP HostGator | pbatransportes.com.br/proj |
| Controle Interno | FTP InfinityFree | controleinterno.free.nf |
| Pra Cima Sertania | FTP InfinityFree | pracimasertania.free.nf |
| Controle de Vendas | Reservado | — |

## NUNCA faca sem permissao explicita:
- `deploy.py --deploy-all` (deploy em producao)
- `git push` no GitHub
- Alterar senhas no deploy.py

## SE O USUARIO PEDIR AJUSTES EM UM SITE ESPECIFICO:
- Confirme qual site (pbatransportes, cinterno, pracimasertania, gestaoatividades)
- NUNCA confunda um site FTP com GitHub
- NUNCA mexa em pastas nao pedidas
