#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              CENTRAL DE DEPLOY — TODOS OS PROJETOS  (v2.0)                 ║
║       Unificado: FTP + GitHub | Check | Deploy | Status | Recuperação       ║
╚══════════════════════════════════════════════════════════════════════════════╝

USO RAPIDO (sem menu):
    python deploy.py --check-all          # Testa conexao em TODOS os sites
    python deploy.py --status             # Mostra status geral
    python deploy.py --deploy-all           # Deploy em TODOS os sites FTP + Git
    python deploy.py --deploy cinterno    # Deploy em um site especifico
    python deploy.py --check cinterno     # Testa um site especifico
    python deploy.py                      # Menu interativo (modo antigo)

SITES:
    1. gestaoatividades  - GitHub/Vercel/Firebase
    2. controlevendas    - Reservado
    3. pbatransportes    - FTP HostGator
    4. cinterno          - FTP InfinityFree
    5. pracimasertania   - FTP InfinityFree

REGRA ABSOLUTA — INFINITYFREE:
    1. JAMAIS usar Promise.all() com mais de 2 chamadas API simultaneas
    2. JAMAIS disparar fetch/api() dentro de forEach, map, filter ou loops paralelos
    3. SEMPRE usar for...of com await sequencial para multiplas chamadas
    4. JAMAIS fazer preload automatico em massa
    5. Lazy load SEMPRE: so carregar dados extras quando o usuario pedir
    6. Maximo aceitavel: 2 chamadas simultaneas
    7. Qualquer feature nova com multiplos registros: SEMPRE sequencial
"""

import os
import sys
import argparse
import ftplib
import subprocess
import time

# ── RAIZ DO PROJETO ───────────────────────────────────────────────────────────
# Se rodar de dentro de gestaoatividades/, sobe um nivel para achar as pastas
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(_SCRIPT_DIR) == "gestaoatividades":
    ROOT = os.path.dirname(_SCRIPT_DIR)
else:
    ROOT = _SCRIPT_DIR

# ── CONFIGURACAO CENTRALIZADA — TODOS OS SITES ──────────────────────────────
SITES = {
    "gestaoatividades": {
        "nome": "Gestao de Atividades",
        "url": "https://gestao-atividades.vercel.app",
        "pasta": "gestaoatividades",
        "tipo": "github",
        "repo": "camposwebpersonal/gestao-atividades",
        "branch": "main",
        "desc": "HTML/CSS/JS + Firebase Firestore — deploy via git push",
    },
    "controlevendas": {
        "nome": "Controle de Vendas",
        "url": "(reservado)",
        "pasta": "controlevendas",
        "tipo": "reservado",
        "desc": "Aguardando desenvolvimento",
    },
    "pbatransportes": {
        "nome": "PBA Transportes",
        "url": "https://pbatransportes.com.br/proj",
        "pasta": "pbatransportes",
        "tipo": "ftp",
        "host": "ftp.pbatransportes.com.br",
        "user": "web@pbatransportes.com.br",
        "pass": "WEBTRUCK74z#",
        "port": 21,
        "dir": "/",
        "desc": "Vanilla JS ES6 + PHP + MySQL — HostGator",
    },
    "cinterno": {
        "nome": "Controle Interno",
        "url": "https://controleinterno.free.nf",
        "pasta": "cinterno",
        "tipo": "ftp",
        "host": "ftpupload.net",
        "user": "if0_41513870",
        "pass": "qc8jgrw2",
        "port": 21,
        "dir": "/htdocs",
        "mysql_host": "sql100.infinityfree.com",
        "mysql_db": "if0_41513870_db",
        "desc": "PHP + MySQL — InfinityFree",
    },
    "pracimasertania": {
        "nome": "Pra Cima Sertania",
        "url": "https://pracimasertania.free.nf",
        "pasta": "pracimasertania",
        "tipo": "ftp",
        "host": "ftpupload.net",
        "user": "if0_41596792",
        "pass": "qc8jgrw4",
        "port": 21,
        "dir": "/htdocs",
        "mysql_host": "sql111.infinityfree.com",
        "mysql_db": "if0_41596792_db",
        "desc": "PHP + MySQL — InfinityFree",
    },
}

# ══════════════════════════════════════════════════════════════════════════════
#  CORE — FUNCOES INTERNAS
# ══════════════════════════════════════════════════════════════════════════════

def _site_dir(pasta):
    return os.path.join(ROOT, pasta)

def _log(msg, indent=0):
    print("  " * indent + msg)

def _banner(title):
    print()
    print("=" * 62)
    print(f"  {title}")
    print("=" * 62)

# ── FTP — CHECK / DEPLOY ─────────────────────────────────────────────────────

def check_ftp(site_key):
    """Testa conexao FTP de um site"""
    s = SITES[site_key]
    try:
        ftp = ftplib.FTP()
        ftp.connect(s["host"], s["port"], timeout=15)
        ftp.login(s["user"], s["pass"])
        pwd = ftp.pwd()
        ftp.quit()
        return True, f"OK  (dir: {pwd})"
    except Exception as e:
        return False, str(e)

def _ensure_remote_dir(ftp, remote_dir):
    dirs = [d for d in remote_dir.replace("\\", "/").split("/") if d]
    current = ""
    for d in dirs:
        current += "/" + d
        try:
            ftp.cwd(current)
        except:
            try:
                ftp.mkd(current)
            except:
                pass

def _upload_file(ftp, local_path, remote_path):
    try:
        with open(local_path, "rb") as f:
            ftp.storbinary(f"STOR {remote_path}", f)
        return True
    except Exception:
        return False

def deploy_ftp_site(site_key, file_list=None):
    """Deploy FTP completo ou seletivo"""
    s = SITES[site_key]
    local_dir = _site_dir(s["pasta"])
    if not os.path.isdir(local_dir):
        _log(f"❌ Pasta nao encontrada: {local_dir}")
        return False

    # Coleta arquivos
    SKIP_DIRS = {"__pycache__", ".git", ".vscode", ".claude", ".venv"}
    SKIP_EXTS = {".py", ".pyc", ".sh", ".zip"}
    SKIP_FILES = {"error_log", "upload_ftp.py", "deploy.py", "deploy_new.py"}

    if file_list is None:
        files = []
        for root, dirs, filenames in os.walk(local_dir):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for fname in filenames:
                if fname in SKIP_FILES or any(fname.endswith(e) for e in SKIP_EXTS):
                    continue
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, local_dir).replace("\\", "/")
                files.append(rel)
    else:
        files = file_list

    if not files:
        _log("⚠️  Nenhum arquivo para enviar")
        return True

    _banner(f"Deploy FTP — {s['nome']}")
    _log(f"Host: {s['host']}")
    _log(f"Dir remoto: {s['dir']}")
    _log(f"Arquivos: {len(files)}")
    print()

    try:
        ftp = ftplib.FTP()
        ftp.connect(s["host"], s["port"], timeout=30)
        ftp.login(s["user"], s["pass"])
        ftp.cwd(s["dir"])
        _log("🔌 Conectado!")

        ok = fail = 0
        for rel in files:
            local = os.path.join(local_dir, rel)
            if not os.path.exists(local):
                _log(f"⚠️  Nao encontrado: {rel}", 1)
                fail += 1
                continue
            remote = (s["dir"] + "/" + rel).replace("//", "/")
            rdir = os.path.dirname(remote)
            if rdir and rdir != s["dir"]:
                _ensure_remote_dir(ftp, rdir)
                ftp.cwd(s["dir"])
            if _upload_file(ftp, local, remote):
                _log(f"✅ {rel}", 1)
                ok += 1
            else:
                _log(f"❌ {rel}", 1)
                fail += 1

        ftp.quit()
        print()
        _log(f"✅ Concluido: {ok} enviados, {fail} falhas")
        _log(f"🌐 {s['url']}")
        return fail == 0
    except Exception as e:
        _log(f"❌ Erro fatal: {e}")
        return False

# ── GITHUB — CHECK / DEPLOY ──────────────────────────────────────────────────

def check_github(site_key):
    """Testa se o repo GitHub esta acessivel"""
    s = SITES[site_key]
    site_dir = _site_dir(s["pasta"])
    if not os.path.isdir(site_dir):
        return False, "Pasta nao encontrada"
    git_dir = os.path.join(site_dir, ".git")
    if not os.path.isdir(git_dir):
        return False, "Nao eh repo git"
    try:
        r = subprocess.run(
            ["git", "ls-remote", "origin", "--heads", s.get("branch", "main")],
            cwd=site_dir, capture_output=True, text=True, timeout=15
        )
        if r.returncode == 0 and r.stdout.strip():
            return True, "Repo OK"
        return False, f"git ls-remote falhou: {r.stderr.strip() or 'sem saida'}"
    except Exception as e:
        return False, str(e)

def deploy_github(site_key, message="update"):
    """Git add + commit + push"""
    s = SITES[site_key]
    site_dir = _site_dir(s["pasta"])
    if not os.path.isdir(site_dir):
        _log(f"❌ Pasta nao encontrada: {s['pasta']}")
        return False

    _banner(f"Deploy GitHub — {s['nome']}")
    _log(f"Repo: {s['repo']}")
    _log(f"Branch: {s.get('branch', 'main')}")
    print()

    try:
        # Verifica alteracoes
        r = subprocess.run(
            ["git", "status", "--short"],
            cwd=site_dir, capture_output=True, text=True
        )
        if r.stdout.strip():
            _log("Arquivos modificados:")
            for line in r.stdout.strip().split("\n"):
                _log(line, 1)
        else:
            _log("Nenhuma alteracao local.")

        # Add + commit + push
        subprocess.run(["git", "add", "."], cwd=site_dir, check=True)
        subprocess.run(["git", "commit", "-m", message], cwd=site_dir, check=True)
        subprocess.run(
            ["git", "push", "origin", s.get("branch", "main")],
            cwd=site_dir, check=True
        )
        _log("✅ Push realizado com sucesso!")
        return True
    except subprocess.CalledProcessError as e:
        _log(f"❌ Erro: {e}")
        return False

# ══════════════════════════════════════════════════════════════════════════════
#  COMANDOS DE ALTO NIVEL
# ══════════════════════════════════════════════════════════════════════════════

def do_check(site_key=None):
    """Testa conexao de um ou todos os sites"""
    if site_key:
        keys = [site_key] if site_key in SITES else []
        if not keys:
            print(f"❌ Site nao encontrado: {site_key}")
            print(f"   Validos: {', '.join(SITES.keys())}")
            return
    else:
        keys = list(SITES.keys())

    _banner("CHECK — Status de Conexao")
    results = []
    for k in keys:
        s = SITES[k]
        tipo = s["tipo"]
        nome = s["nome"]
        if tipo == "ftp":
            ok, msg = check_ftp(k)
        elif tipo == "github":
            ok, msg = check_github(k)
        else:
            ok, msg = None, "Reservado"
        results.append((nome, tipo, ok, msg))

    print()
    print(f"{'Site':<28} {'Tipo':<10} {'Status':<8} {'Detalhe'}")
    print("-" * 72)
    for nome, tipo, ok, msg in results:
        if ok is True:
            status = "✅ OK"
        elif ok is False:
            status = "❌ FALHA"
        else:
            status = "➖ ---"
        print(f"{nome:<28} {tipo:<10} {status:<8} {msg}")
    print()

def do_deploy(site_key=None, message="update", files=None):
    """Deploy de um ou todos os sites"""
    if site_key:
        keys = [site_key] if site_key in SITES else []
        if not keys:
            print(f"❌ Site nao encontrado: {site_key}")
            print(f"   Validos: {', '.join(SITES.keys())}")
            return
    else:
        # Deploy em todos (exceto reservados)
        keys = [k for k, v in SITES.items() if v["tipo"] != "reservado"]

    ok_count = 0
    fail_count = 0
    for k in keys:
        s = SITES[k]
        print()
        if s["tipo"] == "ftp":
            ok = deploy_ftp_site(k, files)
        elif s["tipo"] == "github":
            ok = deploy_github(k, message)
        else:
            continue
        if ok:
            ok_count += 1
        else:
            fail_count += 1
        time.sleep(0.5)

    print()
    _banner("RESUMO DO DEPLOY")
    _log(f"✅ Sucesso: {ok_count}")
    _log(f"❌ Falhas:  {fail_count}")
    print()

def do_status():
    """Mostra resumo completo de todos os sites"""
    _banner("STATUS GERAL — Todos os Sites")
    print()
    for k, s in SITES.items():
        tipo = s["tipo"]
        pasta = _site_dir(s["pasta"])
        existe = "✅" if os.path.isdir(pasta) else "❌"
        tag = {"github": "[GitHub]", "ftp": "[FTP]", "reservado": "[---]"}.get(tipo, "[?]")
        print(f"  {existe}  {tag:<10}  {s['nome']:<28}  {s['url']:<35}")
        print(f"      Pasta: {s['pasta']}")
        if tipo == "ftp":
            print(f"      FTP:   {s['user']}@{s['host']}:{s['port']}  →  {s['dir']}")
        elif tipo == "github":
            print(f"      Repo:  github.com/{s['repo']}")
        print()

# ══════════════════════════════════════════════════════════════════════════════
#  MENU INTERATIVO (modo legado)
# ══════════════════════════════════════════════════════════════════════════════

def menu():
    while True:
        print()
        print("╔════════════════════════════════════════════════════════════╗")
        print("║      CENTRAL DE DEPLOY — TODOS OS SITES (v2.0)             ║")
        print("╠════════════════════════════════════════════════════════════╣")
        print("║  Comandos rapidos (sem menu):                              ║")
        print("║    python deploy.py --check-all                            ║")
        print("║    python deploy.py --status                               ║")
        print("║    python deploy.py --deploy-all                           ║")
        print("╠════════════════════════════════════════════════════════════╣")
        print("║  Menu interativo:                                          ║")
        for i, (k, s) in enumerate(SITES.items(), 1):
            tag = {"github": "[GitHub]", "ftp": "[FTP]", "reservado": "[---]"}.get(s["tipo"], "[?]")
            print(f"║  [{i}]  {s['nome']:<26} {tag:<10} {s['url']:<26} ║")
        print("║  [c]  Check rapido (todos)                                 ║")
        print("║  [s]  Status geral                                         ║")
        print("║  [0]  Sair                                                 ║")
        print("╚════════════════════════════════════════════════════════════╝")

        esc = input("\n  Escolha: ").strip().lower()
        if esc == "0":
            print("\n  Ate logo!\n")
            break
        if esc == "c":
            do_check()
            input("\n  Pressione Enter...")
            continue
        if esc == "s":
            do_status()
            input("\n  Pressione Enter...")
            continue

        keys = list(SITES.keys())
        try:
            idx = int(esc) - 1
            if idx < 0 or idx >= len(keys):
                raise ValueError
        except ValueError:
            print("  Opcao invalida.")
            continue

        key = keys[idx]
        s = SITES[key]
        tipo = s["tipo"]

        if tipo == "reservado":
            print("  Reservado — nenhuma acao disponivel.")
            input("\n  Pressione Enter...")
            continue

        print()
        print(f"  Site: {s['nome']}")
        if tipo == "github":
            print("  [1] Git add + commit + push")
            print("  [0] Voltar")
            m = input("  Modo: ").strip()
            if m == "1":
                msg = input("  Mensagem do commit: ").strip()
                if msg:
                    deploy_github(key, msg)
        elif tipo == "ftp":
            print("  [1] Enviar TODOS os arquivos")
            print("  [2] Enviar arquivos especificos")
            print("  [0] Voltar")
            m = input("  Modo: ").strip()
            if m == "1":
                deploy_ftp_site(key)
            elif m == "2":
                ent = input("  Arquivos (separados por virgula): ").strip()
                if ent:
                    files = [a.strip() for a in ent.split(",") if a.strip()]
                    deploy_ftp_site(key, files)
        input("\n  Pressione Enter...")

# ══════════════════════════════════════════════════════════════════════════════
#  CLI PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Central de Deploy — Todos os Projetos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python deploy.py --check-all
  python deploy.py --status
  python deploy.py --deploy-all --message "fix bug"
  python deploy.py --deploy cinterno
  python deploy.py --check pbatransportes
        """
    )
    parser.add_argument("--check-all", action="store_true", help="Testa conexao em todos os sites")
    parser.add_argument("--status", action="store_true", help="Mostra status geral")
    parser.add_argument("--deploy-all", action="store_true", help="Deploy em todos os sites")
    parser.add_argument("--deploy", metavar="SITE", help="Deploy em um site especifico")
    parser.add_argument("--check", metavar="SITE", help="Testa um site especifico")
    parser.add_argument("--message", "-m", default="update", help="Mensagem do commit (GitHub)")
    parser.add_argument("--files", help="Arquivos especificos para FTP (separados por virgula)")

    args = parser.parse_args()

    # Se nenhum argumento, abre menu interativo
    if len(sys.argv) == 1:
        menu()
        return

    if args.status:
        do_status()
        return

    if args.check_all:
        do_check()
        return

    if args.check:
        do_check(args.check)
        return

    files = None
    if args.files:
        files = [f.strip() for f in args.files.split(",") if f.strip()]

    if args.deploy_all:
        do_deploy(message=args.message, files=files)
        return

    if args.deploy:
        do_deploy(args.deploy, message=args.message, files=files)
        return

    parser.print_help()

if __name__ == "__main__":
    main()
