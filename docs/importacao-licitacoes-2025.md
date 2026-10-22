# Importação das licitações de 2025

Status: **Comprovado no Supabase de produção em 22/10/2026**.

- Origem: `2025 RELAÇAO DE PROCESSOS (LICITAÇÃO).xlsx`
- SHA-256: `e98b6cfc9584ba0cd59363bb9a3a7df2eac9a5c2cd2658155b05feb6bfbeebe3`
- Linhas de origem importadas: 420
- Lançamentos gerados: 489
- Fundo Geral: 118
- Secretaria de Educação: 149
- Secretaria de Saúde: 156
- Secretaria de Assistência Social: 66
- Registros da aba `ADESÃO ATA`: 6
- Registros revogados preservados na observação: 2

Os lançamentos destinados a mais de uma secretaria foram replicados nos grupos correspondentes. Dez linhas que continham somente um número de processo, sem objeto, fornecedor, modalidade ou secretaria, foram preservadas fora da importação para evitar cadastros vazios: 035/2025, 142/2025, 158/2025, 166/2025, 168/2025, 175/2025, 182/2025, 198/2025, 206/2025 e 249/2025.

Cada registro possui `import_hash`, `import_sheet`, `import_row` e `import_key` em `extra_fields`. Os IDs são determinísticos e a inserção usa conflito por ID, permitindo reexecução sem duplicidades. A reversão pode selecionar exclusivamente o `import_hash` acima, sem atingir lançamentos manuais.
