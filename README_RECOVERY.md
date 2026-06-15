# Recuperação Rápida — Após Formatação

## 1 Comando para recuperar TUDO

Depois de formatar o Linux e instalar o VS Code / Devin:

```bash
# Clone o repo (já vem com deploy.py + setup_recuperacao.py)
git clone https://github.com/camposwebpersonal/gestao-atividades.git
cd gestao-atividades

# Modo automatico: baixa se nao existir, pula se existir (sem perguntar)
python setup_recuperacao.py --auto
```

## Modos do setup_recuperacao.py

| Flag | O que faz |
|------|-----------|
| `--auto` ou `-y` | Baixa se não existir, pula se existir. **Recomendado.** |
| `--force-download` | Baixa TUDO de novo, mesmo se já existir. |
| `--skip-download` | Não baixa nada, só testa conexões. |
| (sem flag) | Pergunta interativamente o que fazer. |

## O que acontece

1. **Verifica** o repo GitHub
2. **Baixa** todos os arquivos dos sites FTP para as pastas locais:
   - `../pbatransportes/`  (HostGator)
   - `../cinterno/`        (InfinityFree)
   - `../pracimasertania/` (InfinityFree)
3. **Testa** conexão em todos os sites
4. Mostra o **resumo final** com tudo pronto

## Depois do setup

```bash
cd ..                          # vai para pasta proj/
python deploy.py --check-all   # testa todas as conexoes
python deploy.py --status      # resumo geral
python deploy.py --deploy-all  # deploy em todos
python deploy.py               # menu interativo
```

## Sites

| Site | Tipo | URL | Status |
|------|------|-----|--------|
| Gestão de Atividades | GitHub/Vercel | gestao-atividades.vercel.app | OK |
| PBA Transportes | FTP (HostGator) | pbatransportes.com.br/proj | OK |
| Controle Interno | FTP (InfinityFree) | controleinterno.free.nf | OK |
| Pra Cima Sertânia | FTP (InfinityFree) | pracimasertania.free.nf | FALHA — senha |
| Controle de Vendas | Reservado | — | — |

## Notas

- O `deploy.py` tem **todas as credenciais embutidas** — não precisa de arquivos externos.
- Se a senha do **Pra Cima Sertânia** mudar, atualize no `deploy.py` e no `setup_recuperacao.py`.
- O `gestaoatividades/` já vem do GitHub. Os outros 3 sites vêm do FTP.

## Como pedir no Devin (Cascade) após formatar

Depois que o VS Code abrir e o Devin estiver ativo, **QUALQUER uma dessas frases funciona**:

```
Leia o deploy.py
```

```
Leia o deploy.py no meu GitHub
```

```
Leia o deploy.py no meu GitHub e voce sabera o que fazer
```

```
Conecte em todos os meus sites
```

```
Deixe tudo pronto para eu pedir ajustes nos sites
```

Todas fazem a mesma coisa. O deploy.py contém instruções para o próprio Devin.

Ele vai:
1. Clonar o repo (se necessario)
2. Rodar `setup_recuperacao.py --auto`
3. Testar todas as conexoes
4. Dizer que esta pronto para os ajustes
