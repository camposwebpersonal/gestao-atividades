<?php
require_once 'config.php';

if (!empty($_SESSION['ci_uid'])) { header('Location: index.php'); exit; }

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    if ($username && $password) {
        try {
            $pdo  = ciGetDb();
            $stmt = $pdo->prepare("SELECT id, name, password, role, active FROM ci_users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch();
            if ($user && $user['active'] && password_verify($password, $user['password'])) {
                session_regenerate_id(true);
                $_SESSION['ci_uid']  = $user['id'];
                $_SESSION['ci_name'] = $user['name'];
                $_SESSION['ci_role'] = $user['role'];
                ciLogAction($pdo, 'login', "Usuário: {$user['name']}");
                header('Location: index.php'); exit;
            } else { $error = 'Nome de usuário ou senha inválidos.'; }
        } catch (Exception $e) { $error = 'Erro de conexão. Tente novamente.'; }
    } else { $error = 'Preencha todos os campos.'; }
}
?><!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Login — CONTROLE PMS</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;min-height:100vh;background:#060D1A;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
.bg-canvas{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse 80% 60% at 20% 20%,#1d3a6e22 0%,transparent 70%),radial-gradient(ellipse 60% 50% at 80% 80%,#0d4a4022 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 50% 50%,#0F172A 0%,#060D1A 100%)}
.bg-orb{position:fixed;border-radius:50%;filter:blur(80px);opacity:.4;animation:orbFloat linear infinite;pointer-events:none}
.bg-orb-1{width:500px;height:500px;background:radial-gradient(circle,#1e40af55,transparent 70%);top:-200px;left:-200px;animation-duration:25s}
.bg-orb-2{width:400px;height:400px;background:radial-gradient(circle,#0d948855,transparent 70%);bottom:-150px;right:-150px;animation-duration:30s;animation-direction:reverse}
.bg-orb-3{width:300px;height:300px;background:radial-gradient(circle,#3b82f633,transparent 70%);top:40%;left:60%;animation-duration:20s}
@keyframes orbFloat{0%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-20px) scale(1.05)}66%{transform:translate(-20px,30px) scale(.95)}100%{transform:translate(0,0) scale(1)}}
.bg-grid{position:fixed;inset:0;z-index:0;background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);background-size:40px 40px}
.login-wrap{position:relative;z-index:10;width:100%;max-width:440px;padding:20px;animation:slideUp .5s cubic-bezier(.16,1,.3,1) both}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.card{background:linear-gradient(145deg,#1a2540ee,#111827ee);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:48px 40px 40px;box-shadow:0 0 0 1px rgba(255,255,255,.04),0 40px 80px rgba(0,0,0,.6),0 0 60px rgba(59,130,246,.06);backdrop-filter:blur(20px)}
.logo{text-align:center;margin-bottom:36px}
.logo-badge{display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#1d4ed8,#0891b2);box-shadow:0 8px 32px rgba(29,78,216,.4),0 0 0 1px rgba(255,255,255,.1);font-size:36px;margin-bottom:18px}
.logo h1{font-size:21px;font-weight:800;color:#F1F5F9;letter-spacing:-.3px;line-height:1.3}
.logo h1 span{background:linear-gradient(90deg,#60a5fa,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.logo p{font-size:12px;color:#475569;margin-top:5px;letter-spacing:.3px;text-transform:uppercase}
.divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);margin-bottom:28px}
.field{margin-bottom:18px}
.field-label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.input-wrap{position:relative}
.input-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none;opacity:.5}
input[type=text],input[type=password]{width:100%;padding:13px 14px 13px 44px;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.08);border-radius:12px;color:#F1F5F9;font-size:14px;font-family:inherit;outline:none;transition:border-color .2s,background .2s,box-shadow .2s}
input:focus{border-color:#3B82F6;background:rgba(59,130,246,.06);box-shadow:0 0 0 4px rgba(59,130,246,.1)}
input::placeholder{color:#334155}
.toggle-pw{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:transparent;border:none;cursor:pointer;color:#475569;font-size:16px;padding:4px;transition:color .15s}
.toggle-pw:hover{color:#94A3B8}
.error-msg{display:flex;align-items:center;gap:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#FCA5A5;border-radius:12px;padding:12px 16px;font-size:13px;font-weight:500;margin-bottom:20px;animation:shake .3s ease}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.btn-login{width:100%;padding:14px;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;margin-top:6px;position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(37,99,235,.35)}
.btn-login:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(37,99,235,.4)}
.card-footer{margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06);text-align:center;font-size:11px;color:#334155;line-height:1.6}
@media(max-width:480px){.card{padding:36px 24px 28px}.login-wrap{padding:16px}}
</style>
</head>
<body>
<div class="bg-canvas"></div><div class="bg-grid"></div>
<div class="bg-orb bg-orb-1"></div><div class="bg-orb bg-orb-2"></div><div class="bg-orb bg-orb-3"></div>
<div class="login-wrap">
  <div class="card">
    <div class="logo">
      <div class="logo-badge">📅</div>
      <h1>CONTROLE<br><span>PMS</span></h1>
      <p>Sistema de Controle de Atividades</p>
    </div>
    <div class="divider"></div>
    <?php if ($error): ?>
      <div class="error-msg"><span>⚠️</span><span><?= htmlspecialchars($error) ?></span></div>
    <?php endif; ?>
    <form method="POST" autocomplete="off" id="login-form">
      <div class="field">
        <div class="field-label">Usuário</div>
        <div class="input-wrap">
          <span class="input-icon">👤</span>
          <input type="text" name="username" placeholder="nome.usuario"
                 value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
                 autocomplete="username" required autofocus>
        </div>
      </div>
      <div class="field">
        <div class="field-label">Senha</div>
        <div class="input-wrap">
          <span class="input-icon">🔒</span>
          <input type="password" name="password" id="pw-input" placeholder="••••••••" required>
          <button type="button" class="toggle-pw" onclick="togglePw()" id="pw-toggle">👁</button>
        </div>
      </div>
      <button type="submit" class="btn-login" id="btn-submit">Entrar →</button>
    </form>
    <div class="card-footer">Acesso restrito · CONTROLE PMS © <?= date('Y') ?></div>
  </div>
</div>
<script>
function togglePw(){var i=document.getElementById('pw-input'),b=document.getElementById('pw-toggle');if(i.type==='password'){i.type='text';b.textContent='🙈';}else{i.type='password';b.textContent='👁';}}
document.getElementById('login-form').addEventListener('submit',function(){var b=document.getElementById('btn-submit');b.textContent='Verificando…';b.style.opacity='.7';});
</script>
</body>
</html>
