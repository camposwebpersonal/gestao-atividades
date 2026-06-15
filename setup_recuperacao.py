#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         SETUP DE RECUPERAÇÃO — RESTAURA TUDO APÓS FORMATAÇÃO              ║
║                                                                              ║
║  Uso: python setup_recuperacao.py                                           ║
║                                                                              ║
║  O que faz:                                                                  ║
║    1. Clona/verifica o repo gestao-atividades do GitHub                   ║
║    2. Baixa TODOS os arquivos dos sites FTP de volta para as pastas locais ║
║    3. Testa conexão em todos os sites (GitHub + FTP)                      ║
║    4. Deixa tudo pronto para deploy e ajustes                             ║
║                                                                              ║
║  Depois de rodar, use:                                                       ║
║    python deploy.py --check-all   # Verifica conexões                      ║
║    python deploy.py --status      # Status geral                           ║
║    python deploy.py --deploy-all  # Deploy em todos                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import os
import sys
import argparse
import ftplib
import subprocess

# ── CONFIGURAÇÃO — MESMOS DADOS DO deploy.py ────────────────────────────────
SITES_FTP = {
    "pbatransportes": {
        "nome": "PBA Transportes",
        "host": "ftp.pbatransportes.com.br",
        "user": "web@pbatransportes.com.br",
        "pass": "WEBTRUCK74z#",
        "port": 21,
        "dir": "/",
        "url": "https://pbatransportes.com.br/proj",
    },
    "cinterno": {
        "nome": "Controle Interno",
        "host": "ftpupload.net",
        "user": "if0_41513870",
        "pass": "qc8jgrw2",
        "port": 21,
        "dir": "/htdocs",
        "url": "https://controleinterno.free.nf",
    },
    "pracimasertania": {
        "nome": "Pra Cima Sertania",
        "host": "ftpupload.net",
        "user": "if0_41596792",
        "pass": "qc8jgrw4",
        "port": 21,
        "dir": "/htdocs",
        "url": "https://pracimasertania.free.nf",
    },
}

# Raiz: pasta pai deste arquivo (gestaoatividades/) -> sobe um nivel -> proj/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(SCRIPT_DIR) == "gestaoatividades":
    ROOT = os.path.dirname(SCRIPT_DIR)
else:
    ROOT = SCRIPT_DIR

SKIP_FTP = {"__pycache__", ".git", ".vscode", ".claude", ".venv"}
SKIP_FILES_FTP = {"error_log", "upload_ftp.py", "deploy.py"}
SKIP_EXTS_FTP = {".py", ".pyc", ".sh"}


def _log(msg, indent=0):
    print("  " * indent + msg)


def _banner(title):
    print()
    print("=" * 66)
    print(f"  {title}")
    print("=" * 66)


def download_all_from_ftp(site_key, cfg):
    """Baixa TODOS os arquivos do FTP para a pasta local"""
    local_dir = os.path.join(ROOT, site_key)
    os.makedirs(local_dir, exist_ok=True)

    _banner(f"Download FTP — {cfg['nome']}")
    _log(f"Host: {cfg['host']}")
    _log(f"Dir remoto: {cfg['dir']}")
    _log(f"Pasta local: {local_dir}")
    print()

    try:
        ftp = ftplib.FTP()
        ftp.connect(cfg["host"], cfg["port"], timeout=30)
        ftp.login(cfg["user"], cfg["pass"])
        _log("Conectado!")

        downloaded = 0
        skipped = 0

        def walk_ftp(remote_path, local_path):
            nonlocal downloaded, skipped
            ftp.cwd(remote_path)
            items = []
            ftp.retrlines("LIST", items.append)

            for item in items:
                parts = item.split()
                if len(parts) < 9:
                    continue
                name = " ".join(parts[8:])
                if name in (".", ".."):
                    continue
                is_dir = item.startswith("d")
                remote_full = remote_path + "/" + name if remote_path != "/" else "/" + name
                local_full = os.path.join(local_path, name)

                if is_dir:
                    if name in SKIP_FTP:
                        _log(f"Pulando pasta: {name}", 1)
                        continue
                    os.makedirs(local_full, exist_ok=True)
                    walk_ftp(remote_full, local_full)
                    ftp.cwd(remote_path)
                else:
                    if name in SKIP_FILES_FTP or any(name.endswith(e) for e in SKIP_EXTS_FTP):
                        skipped += 1
                        continue
                    with open(local_full, "wb") as f:
                        ftp.retrbinary(f"RETR {remote_full}", f.write)
                    downloaded += 1
                    if downloaded % 50 == 0:
                        _log(f"... {downloaded} arquivos baixados", 1)

        walk_ftp(cfg["dir"], local_dir)
        ftp.quit()
        print()
        _log(f"✅ Concluido: {downloaded} baixados, {skipped} pulados")
        return True
    except Exception as e:
        _log(f"❌ Erro: {e}")
        return False


def check_github_repo():
    """Verifica se o repo GitHub está acessível"""
    git_dir = os.path.join(SCRIPT_DIR, ".git")
    if not os.path.isdir(git_dir):
        _log("❌ Pasta .git nao encontrada — repo nao clonado?")
        return False
    try:
        r = subprocess.run(
            ["git", "ls-remote", "origin", "--heads", "main"],
            cwd=SCRIPT_DIR, capture_output=True, text=True, timeout=15
        )
        if r.returncode == 0 and r.stdout.strip():
            _log("✅ Repo GitHub OK")
            return True
        _log(f"⚠️  GitHub respondeu: {r.stderr.strip() or 'vazio'}")
        return False
    except Exception as e:
        _log(f"❌ Erro: {e}")
        return False


def ensure_local_dirs():
    """Garante que as pastas dos sites existam"""
    _banner("Verificando pastas locais")
    for key in SITES_FTP:
        d = os.path.join(ROOT, key)
        if os.path.isdir(d):
            files = sum(1 for _, _, fn in os.walk(d) for _ in fn)
            _log(f"✅ {key:<20} ({files} arquivos)")
        else:
            _log(f"⬜ {key:<20} (vazio — sera baixado do FTP)")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Setup de Recuperação — Restaura tudo após formatação",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Modos:
  (sem flag)          Pergunta interativamente o que fazer
  --auto              Baixa se não existir, pula se existir (sem perguntar)
  --force-download    Baixa TUDO de novo, mesmo se já existir
  --skip-download     Não baixa nada, só testa conexões
  --yes / -y          Mesmo que --auto

Exemplos:
  python setup_recuperacao.py --auto
  python setup_recuperacao.py --force-download
  python setup_recuperacao.py --skip-download
        """
    )
    parser.add_argument("--auto", action="store_true", help="Modo automatico: baixa se nao existir, pula se existir")
    parser.add_argument("--force-download", action="store_true", help="Forca download de TUDO")
    parser.add_argument("--skip-download", action="store_true", help="Pula download, so testa conexoes")
    parser.add_argument("--yes", "-y", action="store_true", help="Mesmo que --auto")
    args = parser.parse_args()

    auto = args.auto or args.yes
    force = args.force_download
    skip = args.skip_download

    print()
    print("╔════════════════════════════════════════════════════════════════════╗")
    print("║     SETUP DE RECUPERAÇÃO — RESTAURA TUDO APÓS FORMATAÇÃO          ║")
    print("╚════════════════════════════════════════════════════════════════════╝")

    # 1. Verifica pasta do projeto
    _banner("1. Verificando estrutura do projeto")
    _log(f"Raiz do projeto: {ROOT}")
    if not os.path.isdir(ROOT):
        _log("❌ Pasta raiz nao encontrada!")
        sys.exit(1)

    # 2. Verifica repo GitHub
    _banner("2. Verificando conexao com GitHub")
    check_github_repo()

    # 3. Verifica/cria pastas locais
    ensure_local_dirs()

    # 4. Download dos sites FTP
    if skip:
        _banner("3. Download dos sites FTP")
        _log("⏭️  Pulando download (--skip-download)")
    else:
        _banner("3. Download dos sites FTP")
        for key, cfg in SITES_FTP.items():
            local = os.path.join(ROOT, key)
            has_files = os.path.isdir(local) and any(os.scandir(local))

            if has_files and not force:
                if auto:
                    _log(f"{cfg['nome']}: pasta ja existe. Pulando (--auto)")
                else:
                    _log(f"{cfg['nome']}: pasta ja existe com arquivos. Pular download?")
                    resp = input("    (s = sim, n = nao, q = sair) [s]: ").strip().lower()
                    if resp == "q":
                        print("\n  Cancelado.")
                        return
                    if resp == "n":
                        _log(f"  Baixando {cfg['nome']}...")
                        download_all_from_ftp(key, cfg)
                    else:
                        _log(f"  Pulando {cfg['nome']}")
                    print()
                    continue
                print()
                continue

            _log(f"Baixando {cfg['nome']}...")
            download_all_from_ftp(key, cfg)
            print()

    # 5. Testa conexões
    _banner("4. Testando conexões em todos os sites")
    deploy_path = os.path.join(ROOT, "deploy.py")
    if os.path.exists(deploy_path):
        _log("✅ deploy.py encontrado")
        _log("Rodando: python deploy.py --check-all")
        print()
        subprocess.run([sys.executable, deploy_path, "--check-all"])
    else:
        _log("⚠️  deploy.py nao encontrado na raiz do projeto")

    # 6. Resumo final
    _banner("5. RESUMO FINAL — Tudo pronto!")
    _log("Pastas locais:")
    for key in SITES_FTP:
        d = os.path.join(ROOT, key)
        files = sum(1 for _, _, fn in os.walk(d) for _ in fn) if os.path.isdir(d) else 0
        _log(f"  {key:<20} {files} arquivos", 1)
    print()
    _log("Proximos passos:")
    _log("  python deploy.py --check-all    # Verifica conexoes", 1)
    _log("  python deploy.py --status       # Status geral", 1)
    _log("  python deploy.py --deploy-all   # Deploy em todos", 1)
    _log("  python deploy.py                # Menu interativo", 1)
    print()
    _log("✅ PRONTO! Pode pedir os ajustes nos sites.")
    print()


if __name__ == "__main__":
    main()
