<?php
require_once 'config.php';
ciRequireAuth();
$userName     = htmlspecialchars($_SESSION['ci_name'], ENT_QUOTES);
$userRole     = $_SESSION['ci_role'];
$userId       = (int)$_SESSION['ci_uid'];
$pdo          = ciGetDb();
$stmt         = $pdo->prepare('SELECT username FROM ci_users WHERE id=? LIMIT 1');
$stmt->execute([$userId]);
$userRow      = $stmt->fetch() ?: [];
$userUsername = strtoupper((string)($userRow['username'] ?? ''));
$isSuperAdmin = ($userUsername === 'RCAMPOS');
$ciEntryRoute = ['module'=>'secretarias','section'=>$_GET['ci_section']??'','sectionId'=>$_GET['ci_section_id']??null];
?><!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CONTROLE PMS</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#080E1C;--card:#111827;--border:#1e2d45;--text:#F1F5F9;--muted:#94A3B8;--dim:#64748B;--accent:#3B82F6;--accent2:#2563EB;--h:58px;--ok:#10B981;--warn:#F59E0B;--danger:#EF4444;--teal2:#14B8A6;--fg:#F1F5F9;--bg2:#0f1827}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:15px;overflow-x:hidden}
button{cursor:pointer;font-family:inherit}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
#app{display:flex;flex-direction:column;height:100vh}
#navbar{height:var(--h);background:linear-gradient(90deg,#06101f,#0a1830);border-bottom:1px solid rgba(59,130,246,.12);display:flex;align-items:center;padding:0 20px;gap:16px;position:sticky;top:0;z-index:100;flex-shrink:0;box-shadow:0 1px 20px rgba(0,0,0,.4)}
#navbar .brand{font-weight:800;font-size:18px;display:flex;align-items:center;gap:10px;background:linear-gradient(90deg,#60a5fa,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
#navbar .brand span{font-size:26px;-webkit-text-fill-color:initial}
#navbar .spacer{flex:1}
.user-chip{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:5px 14px;font-size:13px;color:var(--muted)}
.user-chip .avatar{width:26px;height:26px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700}
.btn-logout{background:transparent;border:1px solid #EF444430;color:#EF4444;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600}
.btn-logout:hover{background:#EF444415}
#main{flex:1;overflow-y:auto}
.page-title{font-size:clamp(20px,2.2vw,30px);font-weight:800;margin-bottom:4px;background:linear-gradient(90deg,#e2e8f0,#94a3b8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.page-sub{font-size:clamp(12px,1.1vw,15px);color:var(--dim);margin-bottom:24px}
.btn-primary{padding:9px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.btn-primary:hover{opacity:.9}
.btn-secondary{padding:9px 14px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.btn-secondary:hover{color:var(--text);background:#ffffff0a}
.btn-danger{padding:9px 18px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.btn-danger:hover{background:#DC2626}
.btn-danger:disabled{background:#EF444455;cursor:not-allowed}
.btn-save{padding:9px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.btn-save:hover{background:var(--accent2)}
.btn-save:disabled{opacity:.5;cursor:not-allowed}
.btn-cancel{padding:9px 18px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.btn-cancel:hover{color:var(--text);background:#ffffff08}
.btn-icon{background:transparent;border:1px solid var(--border);border-radius:7px;padding:5px 8px;font-size:14px;color:var(--muted)}
.btn-icon:hover{background:#ffffff10;color:var(--text)}
.btn-icon.btn-del{border-color:#EF444430;color:#EF4444}
.btn-icon.btn-del:hover{background:#EF444415}
.dash-card-selectable{outline:2px solid transparent}
.dash-card-selectable:hover{outline:2px solid #3B82F655}
.dash-card-selected{outline:2px solid #3B82F6 !important;background:#1e3a5f !important}
.ci-drag-handle{color:#475569;padding:14px 6px 14px 14px;cursor:grab;font-size:18px;flex-shrink:0;user-select:none}
.ci-drag-handle:active{cursor:grabbing}
.ci-dragging{opacity:.4}
.ci-drag-over{border-top:3px solid #3B82F6 !important}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group.full{grid-column:1/-1}
.form-group label{font-size:12px;font-weight:600;color:var(--muted)}
.form-group select,.form-group input,.form-group textarea{background:#0F172A;border:1px solid var(--border);border-radius:8px;color:var(--text);padding:9px 12px;font-size:13px;font-family:inherit;outline:none;transition:border-color .15s}
.form-group select:focus,.form-group input:focus,.form-group textarea:focus{border-color:var(--accent)}
.form-group textarea{resize:vertical;min-height:80px}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
.cstat-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.cstat-ico{font-size:16px}.cstat-val{font-size:20px;font-weight:800;line-height:1.1}
.cstat-lbl{font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.sec-module-tabs{display:flex;gap:4px;margin-bottom:24px;border-bottom:2px solid var(--border)}
.sec-module-tab{padding:10px 20px;border-radius:8px 8px 0 0;border:none;background:transparent;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:-2px;border-bottom:2px solid transparent}
.sec-module-tab:hover{color:var(--text);background:#ffffff08}
.sec-module-tab.active{color:var(--accent);border-bottom-color:var(--accent);background:#3B82F610}
.loading{text-align:center;padding:60px;color:var(--dim);font-size:15px}
.empty{text-align:center;padding:40px;color:var(--dim);font-size:13px}
.admin-tabs{display:flex;gap:8px;margin-bottom:20px}
.admin-tab{padding:8px 18px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;font-weight:600}
.admin-tab.active{background:var(--accent);border-color:var(--accent);color:#fff}
.usr-stats{display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap}
.usr-stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 20px;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:80px}
.usr-stat-n{font-size:22px;font-weight:700;color:var(--fg)}
.usr-stat span:last-child{font-size:11px;color:var(--muted)}
.usr-add-wrap{margin-bottom:16px}
.usr-add-toggle{background:var(--card);border:1px dashed var(--border);color:var(--muted);border-radius:10px;padding:10px 20px;cursor:pointer;width:100%;text-align:left;font-size:13px}
.usr-add-form{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-top:8px}
.usr-add-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ucard2-list{display:flex;flex-direction:column;gap:10px}
.ucard2{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ucard2:hover{border-color:var(--teal2)}
.ucard2-left{display:flex;align-items:center;gap:14px;flex:1;min-width:0}
.ucard2-ava{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0}
.ucard2-info{min-width:0}
.ucard2-name{font-weight:600;font-size:14px;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ucard2-email{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ucard2-usr{font-size:11px;color:var(--teal2);margin-top:1px}
.ucard2-right{display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap}
.ucard2-role{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap}
.ucard2-status{font-size:11px;font-weight:600;white-space:nowrap}
.ucard2-btns{display:flex;gap:6px}
.ucard2-edit{padding:7px 14px;background:#1d355718;border:1px solid #3B82F640;color:#93C5FD;border-radius:8px;font-size:12px;cursor:pointer}
.ucard2-edit:hover{background:#1d3557}
.ucard2-del{padding:7px 10px;background:transparent;border:1px solid #EF444430;color:#EF4444;border-radius:8px;font-size:12px;cursor:pointer}
.ucard2-del:hover{background:#EF444415}
.table-wrap{overflow-x:auto;border-radius:12px;border:1px solid var(--border)}
.log-table{width:100%;border-collapse:collapse;font-size:12px}
.log-table th{background:#0f172a;padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border)}
.log-table td{padding:9px 12px;border-bottom:1px solid #1e293b;color:var(--text)}
.log-table tr:last-child td{border-bottom:none}
.log-table tr:hover td{background:#ffffff06}
.log-table td.log-action{font-weight:600}
.log-details{font-size:11px;color:var(--muted);max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.log-time{font-size:11px;color:var(--dim);white-space:nowrap}
dialog#euDialog{padding:0;border:none;background:transparent;max-width:520px;width:100%;border-radius:20px}
dialog#euDialog::backdrop{background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
.eu-box{background:linear-gradient(160deg,#1a2540,#111827);border:1px solid rgba(255,255,255,.09);border-radius:20px;overflow:hidden}
.eu-box-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid rgba(255,255,255,.07)}
.eu-box-header h3{margin:0;font-size:15px;font-weight:700;color:#F1F5F9}
.eu-close-btn{background:none;border:none;color:#64748B;font-size:22px;line-height:1;cursor:pointer;padding:0 4px}
.eu-close-btn:hover{color:#fff}
.eu-body{padding:20px 24px;max-height:60vh;overflow-y:auto}
.eu-box .form-group{margin-bottom:14px}
.eu-box label{display:block;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94A3B8;margin-bottom:6px}
.eu-box label span{text-transform:none;letter-spacing:0;font-weight:400;font-size:11px;color:#64748B}
.eu-box input,.eu-box select{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#F1F5F9;padding:10px 13px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box}
.eu-box input:focus,.eu-box select:focus{border-color:#3B82F6;background:rgba(59,130,246,.08)}
.eu-box input::placeholder{color:#64748B}
.eu-box select option{background:#1E293B;color:#F1F5F9}
.eu-hint{font-size:11px;color:#64748B;margin-top:5px}
.eu-footer{display:flex;gap:10px;justify-content:flex-end;padding:16px 24px;border-top:1px solid rgba(255,255,255,.07)}
.btn-cancel-eu{padding:8px 18px;background:transparent;border:1px solid rgba(255,255,255,.12);color:#94A3B8;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer}
.btn-cancel-eu:hover{color:#fff;background:rgba(255,255,255,.06)}
.btn-save-eu{padding:8px 22px;background:linear-gradient(135deg,#2563EB,#1d4ed8);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
.btn-save-eu:hover{background:linear-gradient(135deg,#3b82f6,#2563eb)}
#ham-wrap{display:flex;align-items:center;gap:10px;position:relative;flex-shrink:0}
#ham-btn{background:transparent;border:1px solid var(--border);border-radius:8px;padding:7px 10px;cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:5px;flex-shrink:0}
.ham-line{display:block;width:18px;height:2px;background:var(--muted);border-radius:2px;transition:all .2s}
#ham-btn[aria-expanded="true"] .ham-line:nth-child(1){transform:translateY(7px) rotate(45deg)}
#ham-btn[aria-expanded="true"] .ham-line:nth-child(2){opacity:0;transform:scaleX(0)}
#ham-btn[aria-expanded="true"] .ham-line:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
#ham-menu{position:absolute;top:calc(100% + 10px);left:0;z-index:500;background:#0c1629;border:1px solid var(--border);border-radius:12px;padding:8px;min-width:220px;box-shadow:0 16px 50px rgba(0,0,0,.65)}
.ham-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;color:var(--muted);background:transparent;border:none;width:100%;text-align:left}
.ham-item:hover{background:#ffffff10;color:var(--text)}
.ham-item .hi-icon{font-size:20px;width:26px;text-align:center;flex-shrink:0}
@media(max-width:768px){
  #navbar .brand{font-size:15px}
  .user-chip>span{display:none}
  .form-grid{grid-template-columns:1fr!important}
  .form-group.full{grid-column:1!important}
  .admin-tabs{flex-wrap:wrap;gap:6px}
  .admin-tab{padding:7px 12px;font-size:12px}
  .sec-module-tabs{flex-wrap:wrap}
  .sec-module-tab{padding:8px 12px;font-size:12px}
  .modal-actions{flex-wrap:wrap;gap:8px}
  .modal-actions .btn-save,.modal-actions .btn-cancel{flex:1;min-width:120px;text-align:center}
}
@media(max-width:600px){
  #modal-overlay-cad{padding:0!important;align-items:flex-end!important}
  #modal-overlay-cad > div{border-radius:16px 16px 0 0!important;max-height:92vh!important;width:100%!important;max-width:100%!important}
  .form-grid{grid-template-columns:1fr!important}
  .page-sub{margin-bottom:14px}
  .eu-box{padding:clamp(14px,4vw,28px)}
}
@media(max-width:480px){
  #navbar .brand{font-size:13px}
  .user-chip>span{display:none}
  .btn-logout{padding:5px 8px;font-size:11px}
  .cstat-card{padding:8px 10px}
  .cstat-val{font-size:16px}
  .ham-item{padding:10px 12px;gap:10px}
  .admin-tabs{gap:4px}
  .admin-tab{padding:6px 10px;font-size:11px}
  .modal-actions .btn-save,.modal-actions .btn-cancel{font-size:13px;padding:9px 16px}
}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
</head>
<body>
<div id="app">
  <nav id="navbar">
    <div class="brand"><span>📅</span> CONTROLE PMS</div>
    <div class="spacer"></div>
    <?php if ($isSuperAdmin): ?>
    <div id="ham-wrap">
      <button id="ham-btn" onclick="toggleHamMenu()" aria-expanded="false" title="Menu">
        <span class="ham-line"></span><span class="ham-line"></span><span class="ham-line"></span>
      </button>
      <div id="ham-menu" style="display:none"></div>
    </div>
    <?php endif; ?>
    <div class="user-chip">
      <div class="avatar"><?= htmlspecialchars(mb_substr($_SESSION['ci_name'],0,1),ENT_QUOTES) ?></div>
      <span><?= $userName ?></span>
      <?php if ($isSuperAdmin): ?><span style="font-size:10px;color:#F59E0B;font-weight:700">★</span><?php endif; ?>
      <button class="btn-logout" onclick="location.href='logout.php'">Sair</button>
    </div>
  </nav>
  <main id="main"><div id="content"></div></main>
</div>

<script>
const initialRoute         = <?= json_encode($ciEntryRoute, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?>;
const ciIsSuperAdmin       = <?= $isSuperAdmin ? 'true' : 'false' ?>;
const ciCanEditSecretarias = <?= $userRole === 'admin' ? 'true' : 'false' ?>;
const state = {secs:[],cats:[],items:[],subitems:[],statuses:{},fieldTemplates:[],subitemFields:{},stats:{}};
let currentSection = 'dashboard', currentSecId = null;


function toast(msg,type){const lvl=type==='error'?'error':'success';let w=document.getElementById('ci-toast-wrap');if(!w){w=document.createElement('div');w.id='ci-toast-wrap';w.style.cssText='position:fixed;top:76px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px';document.body.appendChild(w);}const el=document.createElement('div');el.textContent=String(msg||'');el.style.cssText='min-width:240px;max-width:360px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25)';el.style.border='1px solid '+(lvl==='error'?'#7f1d1d':'#064e3b');el.style.background=lvl==='error'?'#7f1d1d':'#065f46';w.appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(-4px)';},2400);setTimeout(()=>el.remove(),2800);}
function showToast(m,t){toast(m,t);}

async function api(action,params){const r=await fetch('api.php?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params||{})});const txt=await r.text();try{return JSON.parse(txt);}catch(e){throw new Error(txt||'Resposta inválida da API');}}

function escHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function formatDate(d){if(!d)return'';const p=String(d).split('-');return p.length===3?p[2].substring(0,2)+'/'+p[1]+'/'+p[0]:d;}
function fmtDate(iso){if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}

function setActiveNav(){}
function ciGoModulePage(mod){if(mod==='admin'){renderAdmin();return;}renderSecretariasSection('',null);}
function toggleHamMenu(){const m=document.getElementById('ham-menu'),b=document.getElementById('ham-btn');if(!m||!b)return;const o=m.style.display==='block';m.style.display=o?'none':'block';b.setAttribute('aria-expanded',o?'false':'true');}
function renderHamMenu(){const m=document.getElementById('ham-menu');if(!m)return;m.innerHTML='<button class="ham-item" onclick="showSection(\'dashboard\');toggleHamMenu()"><span class="hi-icon">📅</span><span>Atividades</span></button>'+(ciIsSuperAdmin?'<button class="ham-item" onclick="renderAdmin();toggleHamMenu()"><span class="hi-icon">⚙️</span><span>Administração</span></button>':'');}

async function loadData(){const[dR,sR]=await Promise.all([api('data'),api('stats')]);if(!dR||!dR.ok)throw new Error((dR&&dR.error)||'Erro ao carregar dados');state.secs=Array.isArray(dR.secretariats)?dR.secretariats:[];state.cats=Array.isArray(dR.categories)?dR.categories:[];state.items=Array.isArray(dR.items)?dR.items:[];state.subitems=Array.isArray(dR.subitems)?dR.subitems:[];state.statuses=dR.statuses||{};state.fieldTemplates=Array.isArray(dR.field_templates)?dR.field_templates:[];state.subitemFields=dR.subitem_fields||{};state.stats=sR&&sR.ok?sR:{total:state.items.length,by_status:{},by_secretariat:[]};}

function secStatusMeta(id){const r=(state.statuses&&state.statuses[id])||{};const s=r.status||'pendente';const M={pendente:{label:'Pendente',bg:'#33415522',color:'#94A3B8'},solicitado:{label:'Solicitado',bg:'#2563EB22',color:'#60A5FA'},recebido:{label:'Recebido',bg:'#0D948822',color:'#2DD4BF'},analisando:{label:'Analisando',bg:'#8B5CF622',color:'#C4B5FD'},aprovado:{label:'Aprovado',bg:'#10B98122',color:'#34D399'},ressalva:{label:'Ressalva',bg:'#F59E0B22',color:'#FBBF24'},reprovado:{label:'Reprovado',bg:'#EF444422',color:'#F87171'}};return{status:s,...(M[s]||M.pendente),notes:r.notes||'',responsible:r.responsible||'',deadline:r.deadline||''};}
function openStatusMenu(itemId,el){document.querySelectorAll('.ci-status-popup').forEach(p=>p.remove());const opts=[{value:'pendente',label:'Pendente',bg:'#33415522',color:'#94A3B8'},{value:'solicitado',label:'Solicitado',bg:'#2563EB22',color:'#60A5FA'},{value:'recebido',label:'Recebido',bg:'#0D948822',color:'#2DD4BF'},{value:'analisando',label:'Analisando',bg:'#8B5CF622',color:'#C4B5FD'},{value:'aprovado',label:'Aprovado',bg:'#10B98122',color:'#34D399'},{value:'ressalva',label:'Ressalva',bg:'#F59E0B22',color:'#FBBF24'},{value:'reprovado',label:'Reprovado',bg:'#EF444422',color:'#F87171'}];const cur=secStatusMeta(itemId).status;const pop=document.createElement('div');pop.className='ci-status-popup';pop.style.cssText='position:fixed;z-index:9999;background:#1e2d47;border:1px solid #334155;border-radius:12px;padding:6px;box-shadow:0 8px 32px #0008;min-width:160px';pop.innerHTML=opts.map(o=>`<div onclick="setItemStatus(${itemId},'${o.value}')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;${o.value===cur?'background:#ffffff11':''}" onmouseover="this.style.background='#ffffff18'" onmouseout="this.style.background='${o.value===cur?'#ffffff11':'transparent'}'"><span style="padding:2px 8px;border-radius:999px;background:${o.bg};color:${o.color};font-size:11px;font-weight:700">${o.label}</span></div>`).join('');document.body.appendChild(pop);const rect=el.getBoundingClientRect();const pw=170;let left=rect.left,top=rect.bottom+6;if(left+pw>window.innerWidth-8)left=window.innerWidth-pw-8;if(top+280>window.innerHeight)top=rect.top-286;pop.style.left=left+'px';pop.style.top=top+'px';setTimeout(()=>{document.addEventListener('click',function _c(e){if(!pop.contains(e.target)){pop.remove();document.removeEventListener('click',_c);}});},10);}
async function setItemStatus(itemId,status){document.querySelectorAll('.ci-status-popup').forEach(p=>p.remove());try{const r=await fetch('api.php?action=update_status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_id:itemId,status})});const j=await r.json();if(!j.ok)throw new Error(j.error||'Erro');if(!state.statuses)state.statuses={};if(!state.statuses[itemId])state.statuses[itemId]={};state.statuses[itemId].status=status;const sec=currentSection||'dashboard';if(sec==='sec'&&currentSecId)renderAtividadeDetail(currentSecId);else if(sec==='cadastros')renderCadastros(currentSecId);else renderDashboard();}catch(e){alert('Erro ao atualizar status: '+e.message);}}

function ensureCadModal(){let m=document.getElementById('modal-overlay-cad');if(m)return m;m=document.createElement('div');m.id='modal-overlay-cad';m.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1200;align-items:center;justify-content:center;padding:20px';m.innerHTML=`<div style="width:100%;max-width:720px;max-height:90vh;overflow-y:auto;background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35)"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border)"><div><div id="modal-title-cad" style="font-size:17px;font-weight:800;color:var(--text)"></div><div id="modal-sub-cad" style="font-size:12px;color:var(--muted);margin-top:4px"></div></div><button onclick="closeCadModal()" style="background:none;border:none;color:var(--muted);font-size:22px;line-height:1;cursor:pointer">×</button></div><div id="modal-body-cad" style="padding:20px"></div></div>`;document.body.appendChild(m);return m;}
function closeCadModal(){const m=document.getElementById('modal-overlay-cad');if(m)m.style.display='none';}

let _dashboardSelectMode=false,_dashboardSelected=new Set();
function toggleDashboardSelectMode(){_dashboardSelectMode=!_dashboardSelectMode;_dashboardSelected.clear();renderDashboard();}
function toggleDashboardCardSelect(id,el){if(_dashboardSelected.has(id)){_dashboardSelected.delete(id);el.classList.remove('dash-card-selected');}else{_dashboardSelected.add(id);el.classList.add('dash-card-selected');}const b=document.getElementById('btn-excluir-selecionadas');if(b)b.disabled=_dashboardSelected.size===0;const l=document.getElementById('lbl-selecionadas');if(l)l.textContent=_dashboardSelected.size===0?'Nenhuma selecionada':_dashboardSelected.size+' selecionada(s)';}
async function excluirAtividadesSelecionadas(){if(_dashboardSelected.size===0)return;if(!confirm('Excluir '+_dashboardSelected.size+' atividade(s) e todos os seus itens?'))return;for(const id of _dashboardSelected)await api('delete_secretariat',{id});_dashboardSelected.clear();_dashboardSelectMode=false;await loadData();renderDashboard();showToast('Atividades excluídas com sucesso.','success');}

function _itemProgress(item){const subs=(state.subitems||[]).filter(s=>String(s.item_id)===String(item.id));if(!subs.length)return{hasSubs:false,total:1,concluded:item.concluded==1?1:0,pct:item.concluded==1?100:0,subs:[]};const done=subs.filter(s=>s.concluded==1).length;return{hasSubs:true,total:subs.length,concluded:done,pct:Math.round((done/subs.length)*100),subs};}

function renderDashboard(){const content=document.getElementById('content');if(!content)return;const secs=state.secs||[];const today=new Date();today.setHours(0,0,0,0);const cards=secs.map(sec=>{const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(sec.id));const total=items.length;const done=items.filter(i=>{const p=_itemProgress(i);return p.hasSubs?p.pct===100:i.concluded==1;}).length;const over=items.filter(i=>{const p=_itemProgress(i);if(p.hasSubs)return p.subs.some(s=>!s.concluded&&s.deadline_date&&new Date(s.deadline_date)<today);return i.deadline_date&&i.concluded!=1&&new Date(i.deadline_date)<today;}).length;const pct=total>0?Math.round((done/total)*100):0;const bc=over>0?'#EF4444':(pct===100&&total>0?'#10B981':'#3B82F6');const isSel=_dashboardSelected.has(sec.id);if(_dashboardSelectMode)return`<div onclick="toggleDashboardCardSelect(${sec.id},this)" class="dash-card-selectable${isSel?' dash-card-selected':''}" style="padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--card);border-top:4px solid ${escHtml(sec.color||'#3B82F6')};cursor:pointer;position:relative;user-select:none"><div style="position:absolute;top:10px;right:12px;font-size:20px">${isSel?'☑️':'⬜'}</div><div style="font-size:16px;font-weight:800;margin-bottom:6px;padding-right:30px">${escHtml(sec.name||'')}</div><div style="font-size:11px;color:var(--muted);margin-bottom:10px">${total} item(ns)${over>0?' · <span style="color:#F87171">'+over+' atrasado(s)</span>':''}</div><div style="background:#1e2d45;border-radius:6px;height:7px;overflow:hidden;margin-bottom:5px"><div style="background:${bc};height:100%;width:${pct}%;border-radius:6px"></div></div><div style="font-size:11px;color:${pct===100&&total>0?'#34D399':'var(--muted)'}">${done}/${total} · ${pct}%</div></div>`;return`<button onclick="renderAtividadeDetail(${sec.id})" style="padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--card);color:var(--text);text-align:left;border-top:4px solid ${escHtml(sec.color||'#3B82F6')}" onmouseover="this.style.boxShadow='0 4px 20px rgba(59,130,246,.15)'" onmouseout="this.style.boxShadow='none'">${_secThumbHtml(sec)}<div style="font-size:16px;font-weight:800;margin-bottom:6px">${escHtml(sec.name||'')}</div><div style="font-size:11px;color:var(--muted);margin-bottom:10px">${total} item(ns)${over>0?' · <span style="color:#F87171">'+over+' atrasado(s)</span>':''}</div><div style="background:#1e2d45;border-radius:6px;height:7px;overflow:hidden;margin-bottom:5px"><div style="background:${bc};height:100%;width:${pct}%;border-radius:6px"></div></div><div style="font-size:11px;color:${pct===100&&total>0?'#34D399':'var(--muted)'}">${done}/${total} · ${pct}%</div></button>`;}).join('');const selTb=_dashboardSelectMode?`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:#1e2d45;border:1px solid var(--border);flex-wrap:wrap;margin-bottom:14px"><span id="lbl-selecionadas" style="font-size:13px;color:var(--muted);flex:1">Nenhuma selecionada</span><button id="btn-excluir-selecionadas" class="btn-danger" onclick="excluirAtividadesSelecionadas()" disabled>🗑️ Excluir Selecionadas</button><button class="btn-secondary" onclick="toggleDashboardSelectMode()">✖ Cancelar</button></div>`:'';content.innerHTML=`<div style="padding:clamp(16px,2.5vw,40px)"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px"><div><div class="page-title">📅 Controle de Atividades</div><div class="page-sub">Acompanhe o progresso de cada atividade.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${ciCanEditSecretarias?`<button class="btn-secondary" onclick="toggleDashboardSelectMode()">${_dashboardSelectMode?'✖ Cancelar':'☑️ Selecionar para Excluir'}</button>`+`<button class="btn-primary" onclick="openSecModal(0)">+ Nova Atividade</button>`:''}<button class="btn-secondary" onclick="showSection('cadastros')">📂 Cadastros</button></div></div>${selTb}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${cards||'<div class="empty">Nenhuma atividade cadastrada.</div>'}</div></div>`;}


function renderCadastros(selectedSecId){const content=document.getElementById('content');if(!content)return;if(!selectedSecId){const cards=(state.secs||[]).map(sec=>{const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(sec.id));const total=items.length;const done=items.filter(i=>{const p=_itemProgress(i);return p.hasSubs?p.pct===100:i.concluded==1;}).length;const pct=total>0?Math.round((done/total)*100):0;const bc=pct===100&&total>0?'#10B981':(pct>0?'#3B82F6':'#334155');return`<div style="padding:20px;border-radius:14px;border:1px solid var(--border);background:var(--card);border-top:4px solid ${escHtml(sec.color||'#3B82F6')}"><div style="font-size:17px;font-weight:800;margin-bottom:3px">${escHtml(sec.name||'')}</div>${sec.responsaveis?`<div style="font-size:11px;color:#818CF8;margin-bottom:3px">👤 ${escHtml(sec.responsaveis)}</div>`:''}<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${total} item(ns)</div><div style="background:#1e2d45;border-radius:6px;height:6px;overflow:hidden;margin-bottom:5px"><div style="background:${bc};height:100%;width:${pct}%;border-radius:6px"></div></div><div style="font-size:11px;color:${pct===100&&total>0?'#34D399':'var(--muted)'};margin-bottom:14px">${done}/${total} · ${pct}%</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-primary" onclick="renderCadastros(${sec.id})">📂 Gerenciar</button>${ciCanEditSecretarias?`<button class="btn-secondary" onclick="openSecModal(${sec.id})">✏️</button><button class="btn-secondary" style="color:#EF4444;border-color:#EF444430" onclick="deleteSec(${sec.id})">🗑️</button>`:''}</div></div>`;}).join('');content.innerHTML=`<div style="padding:clamp(16px,2.5vw,40px)"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px"><div><div class="page-title">📂 Cadastro de Atividade</div><div class="page-sub">Gerencie atividades e seus itens.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-secondary" onclick="showSection('dashboard')">📅 Atividades</button>${ciCanEditSecretarias?'<button class="btn-primary" onclick="openSecModal(0)">+ Nova Atividade</button>':''}</div></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">${cards||'<div class="empty">Nenhuma atividade cadastrada.</div>'}</div></div>`;return;}
const secs=(state.secs||[]).filter(s=>String(s.id)===String(selectedSecId));const today=new Date();today.setHours(0,0,0,0);const cards2=secs.map(sec=>{const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(sec.id));const itemRows=items.map(item=>{const prog=_itemProgress(item);const isDone=prog.hasSubs?prog.pct===100:item.concluded==1;const bc=isDone?'#10B981':(prog.pct>0?'#3B82F6':'#334155');const isCol=window._ciCollapse[String(item.id)]!==false;const subInner=prog.hasSubs?prog.subs.map(s=>{const sD=s.concluded==1,sOv=!sD&&s.deadline_date&&new Date(s.deadline_date)<today,sLt=sD&&s.deadline_date&&s.conclusion_date&&new Date(s.conclusion_date)>new Date(s.deadline_date);return`<div data-ci-sub="${s.id}" data-ci-sub-item="${item.id}" draggable="true" ondragstart="event.stopPropagation();ciSubDragStart(event,${s.id},${item.id})" ondragover="event.stopPropagation();event.preventDefault();ciSubDragOver(event,${s.id},${item.id})" ondragleave="event.stopPropagation();ciSubDragLeave(event,${s.id})" ondrop="event.stopPropagation();ciSubDrop(event,${s.id},${item.id},${sec.id})" ondragend="event.stopPropagation();ciSubDragEnd(event,${s.id})" style="display:flex;align-items:center;border-top:1px solid #ffffff0a"><div ondragstart="return false" onclick="event.stopPropagation()" class="ci-drag-handle" style="padding:8px 5px 8px 10px;font-size:14px">⋯</div><div style="min-width:0;flex:1;padding:7px 8px 7px 0"><span style="font-size:12px;font-weight:600;color:${sD?'#34D399':'var(--text)'}${sD?';text-decoration:line-through;text-decoration-color:#34D39966':''}">${escHtml(s.description)}</span>${s.responsaveis?`<div style="font-size:10px;color:#818CF8;margin-top:2px">👤 ${escHtml(s.responsaveis)}</div>`:''}${s.observacao?`<div style="font-size:10px;color:var(--muted);margin-top:1px;font-style:italic">${escHtml(s.observacao)}</div>`:''}${_renderExtras(s,sec,true)}<div style="font-size:10px;color:var(--muted);margin-top:1px">${s.start_date?'→ '+escHtml(formatDate(s.start_date)):''}${s.deadline_date?(s.start_date?' · ':'')+'Prazo: <span style="color:'+(sOv?'#F87171':'var(--muted)')+'">'+escHtml(formatDate(s.deadline_date))+(sOv?' ⚠️':'')+'</span>':''}${sD&&s.conclusion_date&&s.show_conclusion_date==1?(s.start_date||s.deadline_date?' · ':'')+'<span style="color:'+(sLt?'#FBBF24':'#34D399')+'">✅ '+escHtml(formatDate(s.conclusion_date))+(sLt?' (atrasado)':'')+'</span>':''}</div></div><div onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:5px;flex-shrink:0;padding-right:10px"><span onclick="openSubConclusaoModal(${s.id})" style="padding:3px 8px;border-radius:999px;background:${sD?'#10B98122':'#33415522'};color:${sD?'#34D399':'#94A3B8'};font-size:10px;font-weight:700;cursor:pointer">${sD?'✅':'⏳'}</span>${ciCanEditSecretarias?`<button onclick="openSubitemModal(${item.id},${item.id},${s.id})" style="background:none;border:none;cursor:pointer;padding:3px;font-size:13px;color:#94A3B8">✏️</button><button onclick="deleteSubitem(${s.id},${item.id},${sec.id})" style="background:none;border:none;cursor:pointer;padding:3px;font-size:13px;color:#94A3B8">🗑️</button>`:''}</div></div>`;}).join(''):'';const subRows=`<div id="ci-subs-${item.id}" style="${isCol?'display:none':''}">${subInner}${ciCanEditSecretarias?`<div style="padding:7px 14px 7px 36px;border-top:1px solid #ffffff0a"><button onclick="openSubitemModal(${item.id},${item.id},0)" style="background:none;border:1px dashed #334155;color:var(--muted);border-radius:7px;padding:4px 11px;font-size:11px;cursor:pointer">+ Subitem</button></div>`:''}</div>`;const isOv=!prog.hasSubs&&!isDone&&item.deadline_date&&new Date(item.deadline_date)<today;return`<div data-ci-item="${item.id}" draggable="true" ondragstart="ciItemDragStart(event,${item.id})" ondragover="event.preventDefault();ciItemDragOver(event,${item.id})" ondragleave="ciItemDragLeave(event,${item.id})" ondrop="ciItemDrop(event,${item.id},${sec.id})" ondragend="ciItemDragEnd(event,${item.id})" style="border-top:1px solid var(--border)"><div style="display:flex;align-items:flex-start"><div ondragstart="return false" onclick="event.stopPropagation()" class="ci-drag-handle" style="padding:12px 5px 12px 12px;font-size:16px">⋯</div><span style="font-size:18px;flex-shrink:0;margin-top:11px;margin-right:6px">${escHtml(item.item_icon||'📋')}</span><div style="min-width:0;flex:1;padding:10px 6px"><div style="font-size:13px;font-weight:700;color:${isDone?'#34D399':'var(--text)'}${isDone?';text-decoration:line-through;text-decoration-color:#34D39966':''}">${escHtml(item.description||'')}</div>${item.responsaveis?`<div style="font-size:11px;color:#818CF8;margin-top:2px">👤 ${escHtml(item.responsaveis)}</div>`:''}${item.observacao?`<div style="font-size:11px;color:var(--muted);margin-top:1px;font-style:italic">${escHtml(item.observacao)}</div>`:''}${prog.hasSubs?`<div style="font-size:10px;color:var(--muted);margin-top:3px">${prog.concluded}/${prog.total} · ${prog.pct}%</div><div style="background:#1e2d45;border-radius:4px;height:4px;overflow:hidden;margin-top:4px;max-width:200px"><div style="background:${bc};height:100%;width:${prog.pct}%;border-radius:4px"></div></div>`:`<div style="font-size:11px;color:var(--muted);margin-top:2px">${item.start_date?'Início: '+escHtml(formatDate(item.start_date)):''} ${item.deadline_date?'<span style="color:'+(isOv?'#F87171':'var(--muted)')+'">Prazo: '+escHtml(formatDate(item.deadline_date))+(isOv?' ⚠️':'')+'</span>':''}</div>`}</div><div onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:6px;flex-shrink:0;padding:8px 12px 8px 0">${prog.hasSubs?`<button id="ci-toggle-btn-${item.id}" onclick="ciToggleCollapse(${item.id})" style="background:none;border:1px solid #334155;color:#94A3B8;cursor:pointer;padding:2px 7px;font-size:11px;border-radius:6px">${isCol?'▶':'▼'}</button>`:''}${!prog.hasSubs?`<span onclick="openConclusaoModal(${item.id})" style="padding:3px 9px;border-radius:999px;background:${isDone?'#10B98122':'#33415522'};color:${isDone?'#34D399':'#94A3B8'};font-size:11px;font-weight:700;cursor:pointer">${isDone?'✅':'⏳'}</span>`:''}${ciCanEditSecretarias?`<button onclick="openCiItemModal(${item.id},0,${sec.id})" style="background:none;border:none;cursor:pointer;padding:3px;font-size:14px;color:#94A3B8">✏️</button><button onclick="deleteCiItem(${item.id})" style="background:none;border:none;cursor:pointer;padding:3px;font-size:14px;color:#94A3B8">🗑️</button>`:''}</div></div>${subRows}</div>`;}).join('');const tI=items.length,cI=items.filter(i=>{const p=_itemProgress(i);return p.hasSubs?p.pct===100:i.concluded==1;}).length;return`<div style="padding:18px;border-radius:16px;border:1px solid var(--border);background:var(--card);border-top:4px solid ${escHtml(sec.color||'#3B82F6')}"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px"><div><div style="font-size:19px;font-weight:800">${escHtml(sec.name||'')}</div>${sec.observacoes?`<div style="font-size:11px;color:var(--muted);margin-top:4px;font-style:italic">${escHtml(sec.observacoes)}</div>`:''}<div style="font-size:11px;color:var(--dim);margin-top:5px">${tI} item(ns) · ${cI} concluído(s)</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-secondary" onclick="renderAtividadeDetail(${sec.id})">📊 Progresso</button>${ciCanEditSecretarias?`<button class="btn-primary" onclick="openCiItemModal(0,0,${sec.id})">+ Item</button><button class="btn-secondary" onclick="openSecModal(${sec.id})">✏️</button><button class="btn-secondary" style="color:#EF4444;border-color:#EF444430" onclick="deleteSec(${sec.id})">🗑️</button>`:''}</div></div><div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#0e1729">${itemRows||'<div class="empty" style="padding:18px">Nenhum item.</div>'}${ciCanEditSecretarias?`<div style="padding:10px 14px;border-top:1px solid var(--border)"><button onclick="openCiItemModal(0,0,${sec.id})" style="background:none;border:1px dashed #334155;color:var(--muted);border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;width:100%">+ Adicionar Item</button></div>`:''}</div></div>`;}).join('');content.innerHTML=`<div style="padding:clamp(16px,2.5vw,40px)"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px"><div><div class="page-title">📂 Cadastro de Atividade</div><div class="page-sub">Gerencie atividades e seus itens.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-secondary" onclick="renderCadastros()">← Voltar</button><button class="btn-secondary" onclick="showSection('dashboard')">📅 Atividades</button>${ciCanEditSecretarias&&secs.length?`<button class="btn-primary" onclick="openCiItemModal(0,0,${secs[0].id})">+ Novo Item</button><button class="btn-secondary" onclick="openSecModal(${secs[0].id})">✏️ Editar</button>`:''}</div></div>${cards2||'<div class="empty">Não encontrado.</div>'}</div>`;}

function renderAtividadeDetail(secId){window._ciCollapse={};setActiveNav('nav-secretarias');currentSection='sec';currentSecId=secId;const sec=state.secs.find(r=>String(r.id)===String(secId));if(!sec){renderDashboard();return;}const today=new Date();today.setHours(0,0,0,0);const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(secId));const iProgs=items.map(item=>({item,prog:_itemProgress(item)}));const total=items.length;const done=iProgs.filter(({prog})=>prog.hasSubs?prog.pct===100:prog.concluded===1).length;const pct=total>0?Math.round((done/total)*100):0;const deadlines=[];iProgs.forEach(({item,prog})=>{if(prog.hasSubs){prog.subs.filter(s=>s.deadline_date).forEach(s=>{const sD=s.concluded==1,sOv=!sD&&new Date(s.deadline_date)<today;deadlines.push({label:item.description+' › '+s.description,isDone:sD,isOver:sOv,deadline:s.deadline_date,conclusion_date:s.conclusion_date});});}else if(item.deadline_date){const iD=item.concluded==1,iOv=!iD&&new Date(item.deadline_date)<today;deadlines.push({label:item.description,isDone:iD,isOver:iOv,deadline:item.deadline_date,conclusion_date:item.conclusion_date});}});const overdue=deadlines.filter(e=>e.isOver).length;const barColor=overdue>0?'#EF4444':(pct===100&&total>0?'#10B981':'#3B82F6');const chartHtml=deadlines.length>0?deadlines.map(e=>{const c=e.isDone?'#10B981':(e.isOver?'#EF4444':'#3B82F6');const sl=e.isDone?'✅'+(e.conclusion_date?' '+formatDate(e.conclusion_date):''):(e.isOver?'⚠️ Atrasado':'Prazo: '+formatDate(e.deadline));return`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px"><div style="font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(e.label)}</div><div style="font-size:11px;color:${c};flex-shrink:0">${sl}</div></div><div style="background:#1e2d45;border-radius:4px;height:8px;overflow:hidden"><div style="background:${c};height:100%;width:${e.isDone?100:(e.isOver?100:55)}%;border-radius:4px;opacity:${e.isDone?1:.75}"></div></div></div>`;}).join(''):'<div style="font-size:13px;color:var(--muted);text-align:center;padding:8px 0">Nenhum prazo definido.</div>';const secSubs=(state.subitems||[]).filter(s=>items.some(i=>i.id==s.item_id));const hasBulk=items.some(i=>i.bulk_concluded==1)||secSubs.some(s=>s.bulk_concluded==1);if(!window._ciCollapse)window._ciCollapse={};items.forEach(item=>{if(!Object.prototype.hasOwnProperty.call(window._ciCollapse,String(item.id)))window._ciCollapse[String(item.id)]=false;});
const itemRows2=iProgs.map(({item,prog})=>{const isDone=prog.hasSubs?prog.pct===100:item.concluded==1;const bc=isDone?'#10B981':(prog.pct>0?'#3B82F6':'#334155');const isCol=window._ciCollapse[String(item.id)]!==false;const itemOv=!prog.hasSubs&&!isDone&&item.deadline_date&&new Date(item.deadline_date)<today;const subRows=prog.hasSubs?prog.subs.map(s=>{const sD=s.concluded==1,sOv=!sD&&s.deadline_date&&new Date(s.deadline_date)<today,sLt=sD&&s.deadline_date&&s.conclusion_date&&new Date(s.conclusion_date)>new Date(s.deadline_date);return`<div data-ci-sub="${s.id}" data-ci-sub-item="${item.id}" draggable="true" ondragstart="event.stopPropagation();ciSubDragStart(event,${s.id},${item.id})" ondragover="event.stopPropagation();event.preventDefault();ciSubDragOver(event,${s.id},${item.id})" ondragleave="event.stopPropagation();ciSubDragLeave(event,${s.id})" ondrop="event.stopPropagation();ciSubDrop(event,${s.id},${item.id},${secId})" ondragend="event.stopPropagation();ciSubDragEnd(event,${s.id})" style="display:flex;align-items:flex-start;border-top:1px solid #ffffff0a"><div ondragstart="return false" onclick="event.stopPropagation()" class="ci-drag-handle" style="padding:8px 4px 8px 8px;font-size:13px">⋯</div><div style="min-width:0;flex:1;padding:8px 6px"><div style="font-size:13px;font-weight:600;color:${sD?'#34D399':'var(--text)'}${sD?';text-decoration:line-through;text-decoration-color:#34D39966':''}">${escHtml(s.description)}</div>${s.responsaveis?`<div style="font-size:11px;color:#818CF8;margin-top:2px">👤 ${escHtml(s.responsaveis)}</div>`:''}${s.observacao?`<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:2px">${escHtml(s.observacao)}</div>`:''}${_renderExtras(s,sec,true)}<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:var(--muted)">${s.start_date?'<span>Início: '+escHtml(formatDate(s.start_date))+'</span>':''}${s.deadline_date?'<span style="color:'+(sOv?'#F87171':'var(--muted)')+'">Prazo: '+escHtml(formatDate(s.deadline_date))+(sOv?' ⚠️':'')+'</span>':''}${sD&&s.conclusion_date&&s.show_conclusion_date==1?'<span style="color:'+(sLt?'#FBBF24':'#34D399')+'">✅ '+escHtml(formatDate(s.conclusion_date))+(sLt?' (atrasado)':'')+'</span>':''}</div></div><div onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:6px;flex-shrink:0;padding:8px 14px 8px 0"><span onclick="openSubConclusaoModal(${s.id})" style="padding:3px 8px;border-radius:999px;background:${sD?'#10B98122':'#33415522'};color:${sD?'#34D399':'#94A3B8'};font-size:11px;font-weight:700;cursor:pointer">${sD?'✅ Concluído':'⏳ Pendente'}</span>${ciCanEditSecretarias?`<button onclick="openSubitemModal(${item.id},${item.id},${s.id})" class="btn-icon" title="Editar">✏️</button><button onclick="deleteSubitem(${s.id},${item.id},${secId})" class="btn-icon btn-del" title="Excluir">🗑️</button>`:''}</div></div>`;}).join(''):'';const subWrap=`<div id="ci-subs-${item.id}" style="background:#070e1c;${isCol?'display:none':''}">${subRows}${prog.hasSubs&&ciCanEditSecretarias?`<div style="padding:8px 16px;border-top:1px solid #ffffff08"><button onclick="openSubitemModal(${item.id},${item.id},0)" style="background:none;border:1px dashed #334155;color:var(--muted);border-radius:7px;padding:4px 11px;font-size:11px;cursor:pointer">+ Novo Sub-item</button></div>`:''}</div>`;return`<div data-ci-item="${item.id}" draggable="true" ondragstart="ciItemDragStart(event,${item.id})" ondragover="event.preventDefault();ciItemDragOver(event,${item.id})" ondragleave="ciItemDragLeave(event,${item.id})" ondrop="ciItemDrop(event,${item.id},${secId})" ondragend="ciItemDragEnd(event,${item.id})" style="border-bottom:1px solid var(--border)"><div style="display:flex;align-items:flex-start;padding:12px 0 12px 8px;background:var(--card)"><div ondragstart="return false" onclick="event.stopPropagation()" class="ci-drag-handle" style="padding:4px 6px;font-size:16px">⋯</div><span style="font-size:20px;flex-shrink:0;margin:2px 8px 0">${escHtml(item.item_icon||'📋')}</span><div style="min-width:0;flex:1;padding-right:8px"><div style="font-size:14px;font-weight:800;color:${isDone?'#34D399':'var(--text)'}${isDone?';text-decoration:line-through;text-decoration-color:#34D39966':''}">${escHtml(item.description||'')}</div>${item.responsaveis?`<div style="font-size:11px;color:#818CF8;margin-top:3px">👤 ${escHtml(item.responsaveis)}</div>`:''}${item.observacao?`<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:2px">${escHtml(item.observacao)}</div>`:''}${_renderExtras(item,sec,false)}${prog.hasSubs?`<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><div style="background:#1e2d45;border-radius:4px;height:6px;overflow:hidden;flex:1;max-width:180px"><div style="background:${bc};height:100%;width:${prog.pct}%;border-radius:4px;transition:width .4s"></div></div><span style="font-size:11px;color:var(--muted)">${prog.concluded}/${prog.total} · ${prog.pct}%</span></div>`:`<div style="font-size:11px;color:var(--muted);margin-top:4px">${item.start_date?'Início: '+escHtml(formatDate(item.start_date))+' ':''} ${item.deadline_date?'<span style="color:'+(itemOv?'#F87171':'var(--muted)')+'">Prazo: '+escHtml(formatDate(item.deadline_date))+(itemOv?' ⚠️':'')+'</span>':''}</div>`}</div><div onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:6px;flex-shrink:0;padding-right:16px">${prog.hasSubs?`<button id="ci-toggle-btn-${item.id}" onclick="ciToggleCollapse(${item.id})" style="background:none;border:1px solid #334155;color:#94A3B8;cursor:pointer;padding:3px 9px;font-size:12px;border-radius:6px">${isCol?'▶':'▼'}</button>${sec.show_stats!==0?`<button onclick="openMarkItemConcluded(${item.id})" style="padding:4px 10px;background:${isDone?'#10B98122':'#33415522'};color:${isDone?'#34D399':'#94A3B8'};border:none;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer">${isDone?'✅':'⏳'}</button>`:""}`:`${sec.show_stats!==0?`<span onclick="openConclusaoModal(${item.id})" style="padding:4px 10px;border-radius:999px;background:${isDone?'#10B98122':'#33415522'};color:${isDone?'#34D399':'#94A3B8'};font-size:11px;font-weight:700;cursor:pointer">${isDone?'✅ Concluído':'⏳ Pendente'}</span>`:""}`}${ciCanEditSecretarias?`<button onclick="openCiItemModal(${item.id},0,${secId})" class="btn-icon" title="Editar">✏️</button><button onclick="deleteCiItem(${item.id})" class="btn-icon btn-del" title="Excluir">🗑️</button>`:''}</div></div>${subWrap}</div>`;}).join('');
const content=document.getElementById('content');if(!content)return;content.innerHTML=`<div style="padding:clamp(16px,2.5vw,40px)"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px"><div>${sec.cover_thumb?`<img src="${sec.cover_thumb}" onclick="openGalleryModal('activity',${secId},'${escHtml(sec.name||'').replace(/'/g,"\\'")}')\" style="max-height:70px;max-width:260px;border-radius:10px;object-fit:contain;margin-bottom:8px;cursor:pointer;display:block;background:transparent">`:''}<div class="page-title">${escHtml(sec.name||'')}</div><div class="page-sub">${sec.observacoes?escHtml(sec.observacoes):'Detalhes e progresso da atividade'}</div>${sec.responsaveis?`<div style="font-size:12px;color:#818CF8;margin-top:-16px;margin-bottom:10px">${sec.resp_thumb?`<img src="${sec.resp_thumb}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px;border:2px solid #818CF8">`:''} 👤 ${escHtml(sec.responsaveis)}</div>`:''}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-secondary" onclick="renderDashboard()">← Voltar</button>${ciCanEditSecretarias?`<button class="btn-secondary" onclick="openCiItemModal(0,0,${secId})">+ Item</button><button class="btn-secondary" onclick="openSecModal(${secId})">✏️</button><button onclick="gerarPdfAtividade(${secId})" style="padding:9px 14px;background:#8B5CF6;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">📄 PDF</button><button onclick="abrirBusca(${secId})" style="padding:9px 14px;background:#0e7490;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🔍 Buscar</button><button onclick="openMarkActivityConcluded(${secId})" style="padding:9px 14px;background:#10B981;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">✅ Concluir Tudo</button>${hasBulk?`<button onclick="openUnmarkActivityConcluded(${secId})" style="padding:9px 14px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">↩️ Desmarcar</button>`:''}`:''}</div></div>${sec.show_stats!==0?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:22px"><div class="cstat-card"><span class="cstat-ico">📋</span><span class="cstat-val">${total}</span><span class="cstat-lbl">Total Itens</span></div><div class="cstat-card"><span class="cstat-ico">✅</span><span class="cstat-val" style="color:#34D399">${done}</span><span class="cstat-lbl">Concluídos</span></div><div class="cstat-card"><span class="cstat-ico">${overdue>0?'⚠️':'🕐'}</span><span class="cstat-val" style="color:${overdue>0?'#F87171':'var(--muted)'}">${overdue}</span><span class="cstat-lbl">Atrasados</span></div></div>`:""}${sec.show_stats!==0?`<div style="background:#1e2d45;border-radius:8px;height:10px;overflow:hidden;margin-bottom:20px"><div style="background:${barColor};height:100%;width:${pct}%;border-radius:8px;transition:width .5s"></div></div>${deadlines.length>0?`<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:20px"><div style="font-size:14px;font-weight:800;margin-bottom:14px">📊 Prazos</div>${chartHtml}</div>`:''}`:""}<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden">${itemRows2||'<div class="empty">Nenhum item cadastrado.</div>'}${ciCanEditSecretarias?`<div style="padding:12px 16px;border-top:1px solid var(--border)"><button onclick="openCiItemModal(0,0,${secId})" style="background:none;border:1px dashed #334155;color:var(--muted);border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer;width:100%">+ Adicionar Item</button></div>`:''}</div></div>`;
}


function _imgData(src){return new Promise(r=>{const i=new Image();i.crossOrigin='Anonymous';i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);r({data:c.toDataURL('image/png'),w:i.naturalWidth,h:i.naturalHeight});};i.onerror=()=>r(null);i.src=src;})}
function _lSize(lObj,maxW,maxH){if(!lObj||!lObj.w)return{data:lObj?lObj.data:null,w:maxW,h:maxH};const ar=lObj.w/lObj.h;let w=maxW,h=maxW/ar;if(h>maxH){h=maxH;w=maxH*ar;}return{data:lObj.data,w,h}}
async function _imgDimFromDataUrl(d){return new Promise(r=>{if(!d)return r(null);const i=new Image();i.onload=()=>r({w:i.naturalWidth,h:i.naturalHeight});i.onerror=()=>r(null);i.src=d;});}
async function gerarPdfAtividade(secId){const sec=state.secs.find(s=>String(s.id)===String(secId));if(!sec)return;if(!window.jspdf||!window.jspdf.jsPDF){toast('Aguarde o carregamento da página.','error');return;}const lObj=(typeof _imgData==='function')?await _imgData('img/logo_sertania.png'):null;const logo=lObj?lObj.data:null;const today=new Date();today.setHours(0,0,0,0);const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(secId));const itemProgs=items.map(item=>({item,prog:_itemProgress(item)}));const totalItems=items.length;const concludedItems=itemProgs.filter(({prog})=>prog.hasSubs?prog.pct===100:prog.concluded===1).length;const pendingItems=totalItems-concludedItems;const pctGeral=totalItems>0?Math.round((concludedItems/totalItems)*100):0;const allSubs=(state.subitems||[]).filter(s=>items.some(i=>String(i.id)===String(s.item_id)));const _pKey='activity_'+secId;if(!_imgState[_pKey])await _loadImages('activity',secId);const _pRep=(_imgState[_pKey]||[]).find(i=>i.is_representative==1);const _pCover=(_pRep&&_pRep.image_data)||sec.cover_thumb||null;const _aDims={};if(_pCover)_aDims.c=await _imgDimFromDataUrl(_pCover);if(sec.resp_thumb)_aDims.r=await _imgDimFromDataUrl(sec.resp_thumb);for(const{item}of itemProgs){if(item.cover_thumb)_aDims['ic'+item.id]=await _imgDimFromDataUrl(item.cover_thumb);if(item.resp_thumb)_aDims['ir'+item.id]=await _imgDimFromDataUrl(item.resp_thumb);}for(const s of allSubs){if(s.cover_thumb)_aDims['sc'+s.id]=await _imgDimFromDataUrl(s.cover_thumb);if(s.resp_thumb)_aDims['sr'+s.id]=await _imgDimFromDataUrl(s.resp_thumb);}const subTotal=allSubs.length;const subConc=allSubs.filter(s=>s.concluded==1).length;const now=new Date().toLocaleDateString('pt-BR');const overdueCount=itemProgs.filter(({item,prog})=>{if(prog.hasSubs)return prog.subs.some(s=>!s.concluded&&s.deadline_date&&new Date(s.deadline_date)<today);return!item.concluded&&item.deadline_date&&new Date(item.deadline_date)<today;}).length;const{jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});const W=210,H=297,mx=14,cw=W-mx*2;const HDR_H=32,FTR_Y=281,FTR_H=16,BODY_TOP=HDR_H+6,BODY_BOT=FTR_Y-4;const sf=(sz,bold,clr)=>{doc.setFontSize(sz||9);doc.setFont('helvetica',bold?'bold':'normal');const c=clr||[26,32,44];doc.setTextColor(c[0],c[1],c[2]);};const lhf=pt=>(pt||9)*0.3528*1.5;function bgTextura(){doc.setFillColor(215,242,215);for(let gx=14;gx<=196;gx+=7)for(let gy=HDR_H+4;gy<=FTR_Y-2;gy+=7)doc.circle(gx,gy,0.22,'F');}function cabecalho(){bgTextura();doc.setFillColor(245,252,245);doc.rect(0,0,W,HDR_H,'F');doc.setFillColor(20,82,20);doc.rect(0,0,6,HDR_H,'F');doc.setFillColor(110,192,46);doc.rect(0,HDR_H-3,W,3,'F');if(logo&&lObj){const ls=_lSize(lObj,22,24);doc.addImage(ls.data,'PNG',W-mx-ls.w,3+(24-ls.h)/2,ls.w,ls.h);}sf(13,true,[20,82,20]);doc.text('RELATORIO DE ATIVIDADE',mx+10,14);sf(7,false,[30,123,30]);doc.text('Prefeitura de Sertania — PE  •  Controle PMS  •  '+now,mx+10,23);}function rodape(){doc.setFillColor(20,82,20);doc.rect(0,FTR_Y,W,FTR_H,'F');doc.setFillColor(110,192,46);doc.rect(0,FTR_Y,W,2,'F');if(logo&&lObj){const ls=_lSize(lObj,14,11);doc.addImage(ls.data,'PNG',mx,FTR_Y+2+(11-ls.h)/2,ls.w,ls.h);}sf(7,true,[185,245,185]);doc.text('PREFEITURA MUNICIPAL DE SERTANIA — PE',mx+16,FTR_Y+7);const adInfo=(typeof AD!=='undefined')?(AD.endereco+'  |  '+AD.telefone+'  |  '+AD.email+'  |  '+AD.site):'Sertania — PE  |  (87) 3841-1156  |  www.sertania.pe.gov.br';sf(6.5,false,[180,240,180]);doc.text(adInfo,W/2,FTR_Y+13,{align:'center'});}let y=BODY_TOP,pageNum=1;const chk=n=>{if(y+n>BODY_BOT){rodape();doc.addPage();pageNum++;cabecalho();y=BODY_TOP;}};cabecalho();doc.setFillColor(13,34,64);doc.rect(mx,y,cw,0.7,'F');y+=3;sf(15,true,[13,34,64]);doc.text(sec.name||'ATIVIDADE',mx,y+8);y+=13;if(_pCover&&_aDims.c){const _cd=_aDims.c,_mW=52,_mH=40,_ar=_cd.w/_cd.h;let _iW=_mW,_iH=_mW/_ar;if(_iH>_mH){_iH=_mH;_iW=_mH*_ar;}_iW=Math.round(_iW*10)/10;_iH=Math.round(_iH*10)/10;const _iX=W-mx-_iW;try{doc.addImage(_pCover,'JPEG',_iX,y-13,_iW,_iH);}catch(e){}if(y-13+_iH>y)y=y-13+_iH+3;}if(sec.responsaveis){chk(10);const rL=doc.splitTextToSize('Responsaveis: '+sec.responsaveis,cw-8);const rH=Math.max(8,rL.length*lhf(8)+4);doc.setFillColor(235,240,255);doc.rect(mx,y,cw,rH,'F');doc.setFillColor(99,102,241);doc.rect(mx,y,2.5,rH,'F');sf(7.5,true,[67,56,202]);doc.text('Responsaveis:',mx+5,y+5);sf(7.5,false,[30,30,80]);doc.text(doc.splitTextToSize(sec.responsaveis,cw-38),mx+36,y+5);if(sec.resp_thumb&&_aDims.r){const _rs=Math.min(rH-2,10),_rw=_rs*(_aDims.r.w/_aDims.r.h),_rx=W-mx-_rw-2,_ry=y+(rH-_rs)/2;try{doc.addImage(sec.resp_thumb,'JPEG',_rx,_ry,_rw,_rs);}catch(e){}}y+=rH+2;}if(sec.observacoes){chk(12);const oL=doc.splitTextToSize(sec.observacoes,cw-8);const oH=Math.max(10,oL.length*lhf(8)+6);doc.setFillColor(255,249,230);doc.setDrawColor(245,158,11);doc.setLineWidth(0.2);doc.rect(mx,y,cw,oH,'FD');doc.setFillColor(245,158,11);doc.rect(mx,y,2.5,oH,'F');sf(7.5,true,[146,64,14]);doc.text('Observacoes:',mx+5,y+5);sf(7.5,false,[100,60,10]);doc.text(oL,mx+5,y+5+lhf(7.5));y+=oH+3;}y+=2;chk(18);const cw4=(cw-9)/4;[{v:String(totalItems),l:'Total Itens',c:[59,130,246]},{v:String(concludedItems),l:'Concluidos',c:[16,185,129]},{v:String(pendingItems),l:'Pendentes',c:[96,165,250]},{v:String(overdueCount),l:'Atrasados',c:[239,68,68]}].forEach((card,i)=>{const cx=mx+i*(cw4+3);doc.setFillColor(248,250,252);doc.setDrawColor(215,225,235);doc.setLineWidth(0.2);doc.roundedRect(cx,y,cw4,15,2,2,'FD');doc.setFillColor(...card.c);doc.roundedRect(cx,y,cw4,2.5,1,1,'F');sf(11,true,card.c);doc.text(card.v,cx+cw4/2,y+9,{align:'center'});sf(6.5,false,[100,116,139]);doc.text(card.l,cx+cw4/2,y+13,{align:'center'});});y+=19;if(subTotal>0){chk(7);sf(8,true,[40,60,90]);doc.text('Sub-itens: '+subConc+'/'+subTotal+' concluidos ('+Math.round(subConc/subTotal*100)+'%)',mx,y+5);y+=8;}chk(13);const barClr=pctGeral===100?[16,185,129]:[59,130,246];doc.setFillColor(200,215,235);doc.roundedRect(mx,y,cw,8,2,2,'F');if(pctGeral>0){doc.setFillColor(...barClr);doc.roundedRect(mx,y,cw*pctGeral/100,8,2,2,'F');}const barTxtClr=pctGeral<15?[30,50,90]:[255,255,255];sf(8,true,barTxtClr);doc.text('Progresso Geral: '+pctGeral+'%',W/2,y+5.5,{align:'center'});y+=13;if(itemProgs.length>0){chk(14);doc.setFillColor(20,82,20);doc.roundedRect(mx,y,cw,8,2,2,'F');sf(9,true,[255,255,255]);doc.text('RANKING DE PROGRESSO POR ITEM',mx+5,y+5.5);y+=11;const rBW=60,rLW=cw-rBW-16;itemProgs.forEach(({item,prog})=>{chk(8);const pct=prog.hasSubs?prog.pct:(item.concluded==1?100:0);const isDone=pct===100;const rC=isDone?[16,185,129]:(pct>50?[59,130,246]:(pct>0?[245,158,11]:[200,60,60]));const lbl=doc.splitTextToSize(item.description||'',rLW)[0]||'';doc.setFillColor(245,248,252);doc.rect(mx,y,cw,7,'F');sf(7.5,false,[30,40,60]);doc.text(lbl,mx+2,y+4.8);const bx=mx+rLW+4;doc.setFillColor(210,220,235);doc.roundedRect(bx,y+1.5,rBW,4,1,1,'F');if(pct>0){doc.setFillColor(...rC);doc.roundedRect(bx,y+1.5,rBW*pct/100,4,1,1,'F');}sf(7,true,isDone?[10,120,80]:[30,40,60]);doc.text(pct+'%',bx+rBW+3,y+4.8);y+=7;});y+=3;}y+=3;chk(12);doc.setFillColor(20,82,20);doc.roundedRect(mx,y,cw,9,2,2,'F');sf(10,true,[255,255,255]);doc.text('ITENS DA ATIVIDADE',mx+5,y+6.5);y+=13;
const _pExtras=(it,isSub)=>{const p=[];const fmtM=n=>'R$ '+parseFloat(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2});if(sec.show_verba&&(!isSub||sec.verba_on_subitems)){let _vbL=[];try{const _r=it.verbas_list;_vbL=typeof _r==='string'?JSON.parse(_r||'[]'):Array.isArray(_r)?_r:[];}catch(e){_vbL=[];}if((!_vbL||_vbL.length===0)&&it.verba!=null){_vbL=[{v:it.verba,ov:it.origem_verba||'',obs:it.verba_obs||''}];}_vbL.forEach(e=>{if(e.v!=null&&e.v!='')p.push('Verba: '+fmtM(e.v)+(e.ov?' / '+e.ov:'')+(sec.verba_has_obs&&e.obs?' ('+e.obs+')':''));});}if(sec.show_origem_verba&&(!isSub||sec.origem_verba_on_subitems)&&it.origem_verba)p.push('Origem: '+it.origem_verba+(sec.origem_verba_has_obs&&it.origem_verba_obs?' ('+it.origem_verba_obs+')':''));if(sec.show_documentacao&&(!isSub||sec.documentacao_on_subitems)&&it.documentacao!=null)p.push('Doc: '+(it.documentacao==1?'Concluida':'Pendente')+(sec.documentacao_has_obs&&it.documentacao_obs?' ('+it.documentacao_obs+')':''));if(sec.show_licitacao&&(!isSub||sec.licitacao_on_subitems)&&it.licitacao!=null)p.push('Lic: '+(it.licitacao==1?'Concluida':'Pendente')+(sec.licitacao_has_obs&&it.licitacao_obs?' ('+it.licitacao_obs+')':''));return p.join(' | ');};
const showStats=sec.show_stats!==0;
const iFill=[20,45,95],iTC=[220,235,255];
let tblH,tblB=[],tblEntities=[];
if(showStats){
  tblH=[['#','Item / Observação / Responsáveis','Subs','Prog.','Status','Prazo / Conclusão']];
  itemProgs.forEach(({item,prog},idx)=>{
    const isDone=prog.hasSubs?prog.pct===100:item.concluded==1;
    const pctS=prog.hasSubs?prog.pct+'%':(isDone?'100%':'0%');
    const sS=prog.hasSubs?prog.concluded+'/'+prog.total:'-';
    let pc='';
    if(!prog.hasSubs){if(item.deadline_date)pc='Prazo: '+formatDate(item.deadline_date);if(isDone&&item.conclusion_date)pc+=(pc?'\n':'')+'Conc.: '+formatDate(item.conclusion_date);}
    else{const dC=prog.subs.filter(s=>s.deadline_date).length;if(dC)pc=dC+' prazo(s)';}
    const ex=[];if(item.observacao)ex.push('Obs: '+item.observacao);if(item.responsaveis)ex.push('Resp: '+item.responsaveis);const extras=_pExtras(item,false);if(extras)ex.push(extras);
    tblB.push([
      {content:String(idx+1),styles:{halign:'center',fontStyle:'bold',fillColor:iFill,textColor:iTC}},
      {content:(item.description||'')+(ex.length?'\n'+ex.join('  |  '):''),styles:{textColor:isDone?[100,230,175]:iTC,fillColor:iFill,fontStyle:'bold'}},
      {content:sS,styles:{halign:'center',fillColor:iFill,textColor:iTC}},
      {content:pctS,styles:{halign:'center',textColor:isDone?[100,230,175]:(prog.pct>0?[150,200,255]:iTC),fillColor:iFill}},
      {content:isDone?'Concluído':'Pendente',styles:{textColor:isDone?[100,230,175]:[180,200,240],fillColor:iFill}},
      {content:pc||'',styles:{fillColor:iFill,textColor:iTC}}
    ]);
    if(prog.hasSubs){prog.subs.forEach(s=>{
      const sD=s.concluded==1,sOv=!sD&&s.deadline_date&&new Date(s.deadline_date)<today,sLt=sD&&s.deadline_date&&s.conclusion_date&&new Date(s.conclusion_date)>new Date(s.deadline_date);
      let sP='';if(s.start_date)sP+='Início: '+formatDate(s.start_date);if(s.deadline_date)sP+=(sP?'\n':'')+'Prazo: '+formatDate(s.deadline_date)+(sOv?' (⚠️)':'');if(sD&&s.conclusion_date&&s.show_conclusion_date==1)sP+=(sP?'\n':'')+'Conc.: '+formatDate(s.conclusion_date)+(sLt?' (atrasado)':'');
      const sE=[];if(s.observacao)sE.push('Obs: '+s.observacao);if(s.responsaveis)sE.push('Resp: '+s.responsaveis);const sEx=_pExtras(s,true);if(sEx)sE.push(sEx);
      tblB.push(['',{content:'  › '+(s.description||'')+(sE.length?'\n      '+sE.join('  |  '):''),styles:{textColor:[40,55,75],fontSize:7.5}},'','',{content:sD?'Concluído':'Pendente',styles:{textColor:sD?[16,185,129]:[60,80,100],fontSize:7.5}},{content:sP,styles:{textColor:sOv?[200,30,30]:[50,65,85],fontSize:7.5}}]);
    });}
  });
}else{
  const extraHdrs=[];
  if(sec.show_verba)extraHdrs.push('💰 Verba');if(sec.show_origem_verba)extraHdrs.push('📍 Origem');if(sec.show_documentacao)extraHdrs.push('📁 Doc.');if(sec.show_licitacao)extraHdrs.push('⚖️ Lic.');
  tblH=[['#','Item / Sub-item','Responsáveis','Observação',...extraHdrs]];
  itemProgs.forEach(({item,prog},idx)=>{
    const getExtraCells=(it,isSub)=>{const cells=[];if(sec.show_verba&&(!isSub||sec.verba_on_subitems))cells.push(it.verba!=null?'R$ '+parseFloat(it.verba).toFixed(2):'');if(sec.show_origem_verba&&(!isSub||sec.origem_verba_on_subitems))cells.push(it.origem_verba||'');if(sec.show_documentacao&&(!isSub||sec.documentacao_on_subitems))cells.push(it.documentacao!=null?(it.documentacao==1?'✅ Concluída':'⏳ Pendente'):'');if(sec.show_licitacao&&(!isSub||sec.licitacao_on_subitems))cells.push(it.licitacao!=null?(it.licitacao==1?'✅ Concluída':'⏳ Pendente'):'');return cells;};
    const extraC=getExtraCells(item,false);
    tblB.push([
      {content:String(idx+1),styles:{halign:'center',fontStyle:'bold',fillColor:iFill,textColor:iTC}},
      {content:item.description||'',styles:{fontStyle:'bold',fillColor:iFill,textColor:iTC}},
      {content:item.responsaveis||'',styles:{fillColor:iFill,textColor:iTC,fontSize:7.5}},
      {content:item.observacao||'',styles:{fillColor:iFill,textColor:iTC,fontSize:7.5}},
      ...extraC.map(v=>({content:v,styles:{fillColor:iFill,textColor:iTC,fontSize:7.5}}))
    ]);
    if(prog.hasSubs){prog.subs.forEach(s=>{
      const sExC=getExtraCells(s,true);
      tblB.push(['',{content:'  › '+(s.description||''),styles:{textColor:[40,55,75],fontSize:7.5}},{content:s.responsaveis||'',styles:{textColor:[60,80,100],fontSize:7}},{content:s.observacao||'',styles:{textColor:[60,80,100],fontSize:7}},...sExC.map(v=>({content:v,styles:{textColor:[60,80,100],fontSize:7}}))]);
    });}
  });
}
tblEntities=[];itemProgs.forEach(({item,prog})=>{tblEntities.push({ct:item.cover_thumb,d:_aDims['ic'+item.id],rt:item.resp_thumb,dr:_aDims['ir'+item.id]});if(prog.hasSubs)prog.subs.forEach(s=>tblEntities.push({ct:s.cover_thumb,d:_aDims['sc'+s.id],rt:s.resp_thumb,dr:_aDims['sr'+s.id]}));});doc.autoTable({startY:y,head:tblH,body:tblB,margin:{left:mx,right:mx,top:BODY_TOP,bottom:H-FTR_Y+4},rowPageBreak:'avoid',styles:{fontSize:8,cellPadding:1.8,overflow:'linebreak',textColor:[26,32,44],lineColor:[200,225,200],lineWidth:0.1},headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},columnStyles:{1:{cellWidth:'auto'}},alternateRowStyles:{fillColor:[248,252,248]},columnStyles:{0:{cellWidth:8},2:{cellWidth:14},3:{cellWidth:14},4:{cellWidth:20},5:{cellWidth:28}},didDrawCell:function(dat){if(dat.section!=='body')return;const _e=tblEntities[dat.row.index];if(!_e)return;if(dat.column.index===1&&_e.ct&&_e.d){const _ih=Math.min(dat.cell.height-1.5,10),_iw=_ih*(_e.d.w/_e.d.h),_ix=dat.cell.x+dat.cell.width-_iw-1.5,_iy=dat.cell.y+(dat.cell.height-_ih)/2;try{doc.addImage(_e.ct,'JPEG',_ix,_iy,_iw,_ih);}catch(er){}}if(_e.rt&&_e.dr){const _rs=Math.min(dat.cell.height-1.5,9),_rw=_rs*(_e.dr.w/_e.dr.h);if(!showStats&&dat.column.index===2){const _rx=dat.cell.x+1,_ry=dat.cell.y+(dat.cell.height-_rs)/2;try{doc.addImage(_e.rt,'JPEG',_rx,_ry,_rw,_rs);}catch(er){}}else if(showStats&&dat.column.index===1){const _covW=_e.ct&&_e.d?Math.min(dat.cell.height-1.5,10)*(_e.d.w/_e.d.h)+2:0,_rx=dat.cell.x+dat.cell.width-_rw-1.5-_covW,_ry=dat.cell.y+(dat.cell.height-_rs)/2;try{doc.addImage(_e.rt,'JPEG',_rx,_ry,_rw,_rs);}catch(er){}}}},didDrawPage:data=>{if(data.pageNumber>1){cabecalho();pageNum=data.pageNumber;}rodape();}});y=doc.lastAutoTable.finalY+5;const dlE=[];itemProgs.forEach(({item,prog})=>{if(prog.hasSubs){prog.subs.filter(s=>s.deadline_date).forEach(s=>{const iD=s.concluded==1,iOv=!iD&&new Date(s.deadline_date)<today;dlE.push({label:item.description+' > '+s.description,isDone:iD,isOver:iOv,deadline:s.deadline_date,conclusion_date:s.conclusion_date});});}else if(item.deadline_date){const iD=item.concluded==1,iOv=!iD&&new Date(item.deadline_date)<today;dlE.push({label:item.description,isDone:iD,isOver:iOv,deadline:item.deadline_date,conclusion_date:item.conclusion_date});}});if(dlE.length>0){chk(22);doc.setFillColor(20,82,20);doc.roundedRect(mx,y,cw,9,2,2,'F');sf(10,true,[255,255,255]);doc.text('PRAZOS DE ENTREGA',mx+5,y+6.5);y+=13;doc.autoTable({startY:y,head:[['Item / Sub-item','Prazo','Conclusao','Status']],body:dlE.map(e=>[e.label,formatDate(e.deadline),e.conclusion_date?formatDate(e.conclusion_date):'-',{content:e.isDone?'Concluido':(e.isOver?'Atrasado':'Pendente'),styles:{textColor:e.isDone?[16,185,129]:(e.isOver?[200,30,30]:[60,80,100])}}]),margin:{left:mx,right:mx,top:BODY_TOP,bottom:H-FTR_Y+4},styles:{fontSize:8,cellPadding:1.8,overflow:'linebreak',lineColor:[200,225,200],lineWidth:0.1},headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},alternateRowStyles:{fillColor:[248,252,248]},didDrawPage:data=>{if(data.pageNumber>pageNum){cabecalho();pageNum=data.pageNumber;}rodape();}});y=doc.lastAutoTable.finalY+5;}chk(22);const blkC=pctGeral===100?[5,150,105]:[13,34,64];doc.setFillColor(...blkC);doc.roundedRect(mx,y,cw,16,3,3,'F');doc.setFillColor(110,192,46);doc.rect(mx,y,5,16,'F');sf(9,true,[255,255,255]);doc.text('PROGRESSO GERAL DA ATIVIDADE',mx+9,y+7);sf(7.5,false,[185,245,185]);doc.text(sec.name||'',mx+9,y+12.5);sf(16,true,pctGeral===100?[100,235,210]:[110,192,46]);doc.text(pctGeral+'%',W-mx,y+11,{align:'right'});y+=19;const totalPages=doc.internal.getNumberOfPages();for(let p=1;p<=totalPages;p++){doc.setPage(p);sf(8,true,[185,245,185]);doc.text(p+'/'+totalPages,W-mx,FTR_Y+7,{align:'right'});}doc.save('atividade_'+(sec.name||'relatorio').replace(/\s+/g,'_').toLowerCase()+'_'+now.replace(/\//g,'-')+'.pdf');}

function _sfChk(field,label,sec){const icons={verba:"💰",origem_verba:"📍",documentacao:"📁",licitacao:"⚖️"};const fid=field.replace(/_/g,"-");const show=sec&&sec["show_"+field];const extraHtml=field==="verba"?`<label style="display:flex;align-items:center;gap:7px;margin-bottom:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="s-verba-sum" ${sec&&sec.verba_sum_subitems?"checked":""} style="width:13px;height:13px;accent-color:var(--accent)"> Somar verbas dos sub-itens no total do item</label>`:"";return `<div style="background:#0e1729;border-radius:10px;padding:10px 12px;margin-bottom:8px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:700;color:var(--text)"><input type="checkbox" id="s-show-${fid}" ${show?"checked":""} onchange="document.getElementById('so-${fid}').style.display=this.checked?'block':'none'" style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent)"> ${icons[field]} ${label}</label><div id="so-${fid}" style="margin-top:8px;padding-left:22px;display:${show?"block":"none"}"><label style="display:flex;align-items:center;gap:7px;margin-bottom:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="s-${fid}-subs" ${sec&&sec[field+"_on_subitems"]?"checked":""} style="width:13px;height:13px;accent-color:var(--accent)"> Exibir também nos sub-itens</label>${extraHtml}<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer"><input type="checkbox" id="s-${fid}-obs" ${sec&&sec[field+"_has_obs"]?"checked":""} style="width:13px;height:13px;accent-color:var(--accent)"> Campo de observação individual</label></div></div>`;}
function _itemFieldsHtml(item,sec,isSub){if(!sec)return "";let h="";const pfx=isSub?"si":"i";const ov=escHtml(item?.origem_verba||""),ovob=escHtml(item?.origem_verba_obs||""),dv=item?.documentacao,dob=escHtml(item?.documentacao_obs||""),lv=item?.licitacao,lob=escHtml(item?.licitacao_obs||"");
if(sec.show_verba&&(!isSub||sec.verba_on_subitems)){
  // Build verbas_list from item, migrating legacy single verba if needed
  let vbRaw=item?.verbas_list;
  let vbArr=[];
  try{vbArr=typeof vbRaw==='string'?JSON.parse(vbRaw||'[]'):Array.isArray(vbRaw)?vbRaw:[];}catch(e){vbArr=[];}
  if((!vbArr||vbArr.length===0)&&item?.verba!=null){vbArr=[{v:item.verba,ov:item.origem_verba||'',obs:item.verba_obs||''}];}
  const vbRows=vbArr.map((e,i)=>`<div id="${pfx}-vb-row-${i}" style="display:flex;gap:6px;align-items:flex-start;margin-bottom:6px;background:#0e1729;padding:8px;border-radius:8px;border:1px solid #1e3a5f">
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div><label style="font-size:10px;color:var(--muted)">💰 Valor (R$)</label><input type="number" step="0.01" min="0" id="${pfx}-vb-v-${i}" value="${e.v??''}" placeholder="0,00" style="width:100%;padding:6px 8px;background:#0a1222;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"></div>
      <div><label style="font-size:10px;color:var(--muted)">📍 Origem da Verba</label><input type="text" id="${pfx}-vb-ov-${i}" value="${escHtml(e.ov||'')}" placeholder="Ex: Emenda, Recurso próprio..." style="width:100%;padding:6px 8px;background:#0a1222;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"></div>
      ${sec.verba_has_obs?`<div style="grid-column:1/-1"><label style="font-size:10px;color:var(--muted)">📝 Observação da Verba</label><input type="text" id="${pfx}-vb-obs-${i}" value="${escHtml(e.obs||'')}" placeholder="Observação opcional..." style="width:100%;padding:6px 8px;background:#0a1222;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"></div>`:''}
    </div>
    <button type="button" onclick="_vbRemoveRow('${pfx}',${i})" style="background:#EF444420;color:#EF4444;border:1px solid #EF444444;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:16px;margin-top:16px;flex-shrink:0" title="Remover verba">✕</button>
  </div>`).join('');
  h+=`<div class="form-group" style="grid-column:1/-1" id="${pfx}-vb-section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <label style="margin:0">💰 Verbas <span id="${pfx}-vb-total-label" style="font-size:11px;color:#F59E0B;font-weight:600"></span></label>
      <button type="button" onclick="_vbAddRow('${pfx}',${sec.verba_has_obs?'true':'false'})" style="background:#F59E0B20;color:#F59E0B;border:1px solid #F59E0B44;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px;font-weight:700">+ Adicionar Verba</button>
    </div>
    <div id="${pfx}-vb-rows">${vbRows||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:12px">Nenhuma verba adicionada. Clique em "+ Adicionar Verba".</div>'}</div>
  </div>`;
}
if(sec.show_origem_verba&&(!isSub||sec.origem_verba_on_subitems)&&!sec.show_verba){h+=`<div class="form-group"><label>📍 Origem da Verba</label><input type="text" id="${pfx}-ov" value="${ov}" placeholder="Ex: Recurso próprio"></div>`;if(sec.origem_verba_has_obs)h+=`<div class="form-group"><label>Obs. Origem da Verba</label><textarea id="${pfx}-ov-obs">${ovob}</textarea></div>`;}
if(sec.show_documentacao&&(!isSub||sec.documentacao_on_subitems)){h+=`<div class="form-group"><label>📁 Documentação</label><select id="${pfx}-doc"><option value="">— Não definido —</option><option value="0"${dv==0?" selected":""}>⏳ Pendente</option><option value="1"${dv==1?" selected":""}>✅ Concluída</option></select></div>`;if(sec.documentacao_has_obs)h+=`<div class="form-group"><label>Obs. Documentação</label><textarea id="${pfx}-doc-obs">${dob}</textarea></div>`;}
if(sec.show_licitacao&&(!isSub||sec.licitacao_on_subitems)){h+=`<div class="form-group"><label>⚖️ Licitação</label><select id="${pfx}-lic"><option value="">— Não definido —</option><option value="0"${lv==0?" selected":""}>⏳ Pendente</option><option value="1"${lv==1?" selected":""}>✅ Concluída</option></select></div>`;if(sec.licitacao_has_obs)h+=`<div class="form-group"><label>Obs. Licitação</label><textarea id="${pfx}-lic-obs">${lob}</textarea></div>`;}
if(!h)return "";return `<div style="background:#0a1222;border-radius:12px;padding:14px;margin-top:10px;border:1px solid var(--border)"><div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:10px">⚙️ Campos Adicionais</div><div class="form-grid">${h}</div></div>`;}
function _vbAddRow(pfx,hasObs){const cont=document.getElementById(pfx+'-vb-rows');const idx=cont.querySelectorAll('[id^="'+pfx+'-vb-row-"]').length;const obsField=hasObs?`<div style="grid-column:1/-1"><label style="font-size:10px;color:var(--muted)">📝 Observação da Verba</label><input type="text" id="${pfx}-vb-obs-${idx}" placeholder="Observação opcional..." style="width:100%;padding:6px 8px;background:#0a1222;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"></div>`:'';const d=document.createElement('div');d.id=pfx+'-vb-row-'+idx;d.style.cssText='display:flex;gap:6px;align-items:flex-start;margin-bottom:6px;background:#0e1729;padding:8px;border-radius:8px;border:1px solid #1e3a5f';d.innerHTML=`<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px"><div><label style="font-size:10px;color:var(--muted)">💰 Valor (R$)</label><input type="number" step="0.01" min="0" id="${pfx}-vb-v-${idx}" value="" placeholder="0,00" style="width:100%;padding:6px 8px;background:#0a1222;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"></div><div><label style="font-size:10px;color:var(--muted)">📍 Origem da Verba</label><input type="text" id="${pfx}-vb-ov-${idx}" value="" placeholder="Ex: Emenda, Recurso próprio..." style="width:100%;padding:6px 8px;background:#0a1222;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"></div>${obsField}</div><button type="button" onclick="_vbRemoveRow('${pfx}',${idx})" style="background:#EF444420;color:#EF4444;border:1px solid #EF444444;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:16px;margin-top:16px;flex-shrink:0" title="Remover verba">✕</button>`;if(cont.querySelector('div[style*="Nenhuma verba"]'))cont.innerHTML='';cont.appendChild(d);setTimeout(()=>document.getElementById(pfx+'-vb-v-'+idx)?.focus(),50);}
function _vbRemoveRow(pfx,idx){const row=document.getElementById(pfx+'-vb-row-'+idx);if(row)row.remove();const cont=document.getElementById(pfx+'-vb-rows');if(cont&&!cont.children.length)cont.innerHTML='<div style="font-size:12px;color:var(--muted);text-align:center;padding:12px">Nenhuma verba adicionada.</div>';}
function _vbCollect(pfx){const rows=document.querySelectorAll('[id^="'+pfx+'-vb-row-"]');const arr=[];rows.forEach(row=>{const idx=row.id.replace(pfx+'-vb-row-','');const v=parseFloat(document.getElementById(pfx+'-vb-v-'+idx)?.value||'');const ov=(document.getElementById(pfx+'-vb-ov-'+idx)?.value||'').trim();const obs=(document.getElementById(pfx+'-vb-obs-'+idx)?.value||'').trim();if(!isNaN(v)&&v>0)arr.push({v,ov,obs});});return arr;}
function _renderExtras(obj,sec,isSub){if(!sec)return "";let h="";
  const eType=isSub?"subitem":"item";const imgKey=eType+"_"+obj.id;
  const _repImg=(_imgState[imgKey]||[]).find(i=>i.is_representative==1||i.is_representative===true);
  const _thumbSrc=(_repImg&&_repImg.image_data)||obj.cover_thumb||null;
  const _respSrc=obj.resp_thumb||null;
  if(_thumbSrc){h+=`<img src="${_thumbSrc}" title="Imagem representativa" style="width:52px;height:40px;object-fit:contain;border-radius:6px;margin-right:6px;vertical-align:middle;flex-shrink:0;cursor:pointer;background:transparent;border:1px solid #1e3a5f" onclick="event.stopPropagation();openGalleryModal('${isSub?'subitem':'item'}',${obj.id})">`;} 
  if(_respSrc){h+=`<img src="${_respSrc}" title="Responsável" style="width:32px;height:32px;object-fit:cover;border-radius:50%;margin-right:4px;vertical-align:middle;border:2px solid #818CF8">`;}  
const fmtR=n=>parseFloat(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});if(sec.show_verba&&(!isSub||sec.verba_on_subitems)){let vbArr=[];try{const r=obj.verbas_list;vbArr=typeof r==="string"?JSON.parse(r||"[]"):Array.isArray(r)?r:[];}catch(e){vbArr=[];}if((!vbArr||vbArr.length===0)&&obj.verba!=null){vbArr=[{v:obj.verba,ov:obj.origem_verba||"",obs:obj.verba_obs||""}];}if(!isSub&&sec.verba_sum_subitems&&vbArr.length===0){const ss=(state.subitems||[]).filter(s=>String(s.item_id)===String(obj.id));const sm=ss.reduce((t,s)=>t+(parseFloat(s.verba)||0),0);if(sm>0)vbArr=[{v:sm,ov:"",obs:""}];}vbArr.forEach(e=>{if(e.v!=null&&e.v!=="")h+=`<span style="font-size:10px;background:#F59E0B18;color:#F59E0B;border-radius:6px;padding:2px 7px;margin-right:3px">💰 R$ ${fmtR(e.v)}${e.ov?" · "+escHtml(e.ov):""}${sec.verba_has_obs&&e.obs?" ("+escHtml(e.obs)+")":""}</span>`;});}if(sec.show_origem_verba&&(!isSub||sec.origem_verba_on_subitems)&&obj.origem_verba){h+=`<span style="font-size:10px;background:#A78BFA18;color:#A78BFA;border-radius:6px;padding:2px 7px;margin-right:3px">📍 ${escHtml(obj.origem_verba)}${sec.origem_verba_has_obs&&obj.origem_verba_obs?" · "+escHtml(obj.origem_verba_obs):""}</span>`;}if(sec.show_documentacao&&(!isSub||sec.documentacao_on_subitems)&&obj.documentacao!=null){const dok=obj.documentacao==1;h+=`<span style="font-size:10px;background:${dok?"#10B98118":"#F59E0B18"};color:${dok?"#10B981":"#F59E0B"};border-radius:6px;padding:2px 7px;margin-right:3px">📁 ${dok?"✅ Concluída":"⏳ Pendente"}${sec.documentacao_has_obs&&obj.documentacao_obs?" · "+escHtml(obj.documentacao_obs):""}</span>`;}if(sec.show_licitacao&&(!isSub||sec.licitacao_on_subitems)&&obj.licitacao!=null){const lok=obj.licitacao==1;h+=`<span style="font-size:10px;background:${lok?"#10B98118":"#EF444418"};color:${lok?"#10B981":"#EF4444"};border-radius:6px;padding:2px 7px;margin-right:3px">⚖️ ${lok?"✅ Concluída":"⏳ Pendente"}${sec.licitacao_has_obs&&obj.licitacao_obs?" · "+escHtml(obj.licitacao_obs):""}</span>`;}return h?`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">${h}</div>`:"";}
function openSecModal(id){ensureCadModal();const sec=id?state.secs.find(s=>s.id==id):null;document.getElementById('modal-title-cad').textContent=sec?'✏️ Editar Atividade':'➕ Nova Atividade';document.getElementById('modal-sub-cad').textContent='';document.getElementById('modal-body-cad').innerHTML=`<div class="form-grid"><div class="form-group full"><label>Nome da Atividade *</label><input type="text" id="s-name" value="${escHtml(sec?.name||'')}"></div><div class="form-group full"><label>Observações</label><textarea id="s-obs" rows="3">${escHtml(sec?.observacoes||'')}</textarea></div><div class="form-group full"><label>Responsáveis <span style="color:var(--muted);font-size:10px">(opcional)</span></label><input type="text" id="s-resp" placeholder="Ex: João, Maria…" value="${escHtml(sec?.responsaveis||'')}"></div>${_respThumbSectionHtml('activity',id||0,sec?.resp_thumb||null)}<div class="form-group"><label>Data de Início</label><input type="date" id="s-start" value="${escHtml(sec?.start_date||'')}"></div></div><div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px"><div style="font-size:13px;font-weight:800;margin-bottom:12px;color:var(--accent)">⚙️ Configurações de Exibição</div><label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;font-size:13px;background:#0e1729;border-radius:10px;padding:10px 12px"><input type="checkbox" id="s-show-stats" ${sec?.show_stats!=0?"checked":""} style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent)"> 📊 Mostrar estatísticas (concluídos / pendentes / atrasados)</label>${_sfChk("verba","Campo Verba",sec)}${_sfChk("origem_verba","Origem da Verba",sec)}${_sfChk("documentacao","Documentação (Concluída / Pendente)",sec)}${_sfChk("licitacao","Licitação (Concluída / Pendente)",sec)}</div>${id?_fieldTplSection('activity',id,'Campos padrão para sub-itens desta atividade'):''}${_imgSectionHtml('activity',id||0)}<div class="modal-actions"><button class="btn-cancel" onclick="closeCadModal()">Cancelar</button><button class="btn-save" onclick="saveSec(${id||0})">💾 Salvar</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';setTimeout(()=>{document.getElementById('s-name')?.focus();if(id)_imgSectionInit('activity',id);},100);}

async function saveSec(id){const name=document.getElementById('s-name').value.trim();if(!name){toast('Nome é obrigatório','error');return;}const body={id,name,icon:'📅',color:'#3B82F6',description:'',observacoes:document.getElementById('s-obs')?.value.trim()||'',responsaveis:document.getElementById('s-resp')?.value.trim()||'',start_date:document.getElementById('s-start')?.value||null,show_stats:document.getElementById('s-show-stats')?.checked?1:0,show_verba:document.getElementById('s-show-verba')?.checked?1:0,verba_on_subitems:document.getElementById('s-verba-subs')?.checked?1:0,verba_sum_subitems:document.getElementById('s-verba-sum')?.checked?1:0,verba_has_obs:document.getElementById('s-verba-obs')?.checked?1:0,show_origem_verba:document.getElementById('s-show-origem-verba')?.checked?1:0,origem_verba_on_subitems:document.getElementById('s-origem-verba-subs')?.checked?1:0,origem_verba_has_obs:document.getElementById('s-origem-verba-obs')?.checked?1:0,show_documentacao:document.getElementById('s-show-documentacao')?.checked?1:0,documentacao_on_subitems:document.getElementById('s-documentacao-subs')?.checked?1:0,documentacao_has_obs:document.getElementById('s-documentacao-obs')?.checked?1:0,show_licitacao:document.getElementById('s-show-licitacao')?.checked?1:0,licitacao_on_subitems:document.getElementById('s-licitacao-subs')?.checked?1:0,licitacao_has_obs:document.getElementById('s-licitacao-obs')?.checked?1:0};const r=await api(id?'edit_secretariat':'add_secretariat',body);if(r.ok){const _ssId=id||r.id;if(_ssId){await _saveImages('activity',_ssId);await _saveRespThumb('activity',_ssId);}closeCadModal();await loadData();renderCadastros();toast(id?'Atividade atualizada!':'Atividade criada!');}else toast(r.error||'Erro','error');}

async function deleteSec(id){const sec=state.secs.find(s=>s.id==id);const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(id));const msg=items.length?`Excluir atividade "${sec?.name}"? Isso removerá ${items.length} item(s)!`:`Excluir atividade "${sec?.name}"?`;if(!confirm(msg))return;const r=await api('delete_secretariat',{id});if(r.ok){await loadData();renderCadastros();toast('Atividade excluída.');}else toast(r.error||'Erro','error');}

function openCiItemModal(id,catId,atividadeId){const item=id?state.items.find(i=>i.id==id):null;const aid=atividadeId||item?.atividade_id;const sec=state.secs.find(s=>String(s.id)===String(aid));ensureCadModal();document.getElementById('modal-title-cad').textContent=item?'✏️ Editar Item':'➕ Novo Item';document.getElementById('modal-sub-cad').textContent=sec?'📅 '+sec.name:'';const subs=item?(state.subitems||[]).filter(s=>String(s.item_id)===String(item.id)):[];const subsHtml=subs.map(s=>`<div id="subrow-${s.id}" style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:8px;background:#0e1729;margin-bottom:6px"><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">${escHtml(s.description)}</div>${s.responsaveis?`<div style="font-size:10px;color:#818CF8;margin-top:2px">👤 ${escHtml(s.responsaveis)}</div>`:''}${s.observacao?`<div style="font-size:10px;color:var(--muted);margin-top:1px;font-style:italic">${escHtml(s.observacao)}</div>`:''}</div><button class="btn-icon" onclick="openSubitemModal(0,${id||0},${s.id})">✏️</button><button class="btn-icon btn-del" onclick="deleteSubitem(${s.id},${id||0},${aid||0})">🗑️</button></div>`).join('');document.getElementById('modal-body-cad').innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn-save" onclick="saveCiItem(${id||0},${aid||0})" style="padding:6px 18px;font-size:12px">💾 Salvar Item</button></div><div class="form-grid"><div class="form-group full"><label>Nome do Item *</label><input type="text" id="i-desc" value="${escHtml(item?.description||'')}" placeholder="Ex: Relatório de gestão"></div><div class="form-group"><label>Ícone</label><input type="text" id="i-icon" value="${escHtml(item?.item_icon||'📋')}"></div><div class="form-group"><label>Cor</label><input type="color" id="i-color" value="${escHtml(item?.item_color||'#3B82F6')}"></div>${!item||subs.length===0?`<div class="form-group"><label>Data de Início</label><input type="date" id="i-start" value="${escHtml(item?.start_date||'')}"></div><div class="form-group"><label>Prazo de Entrega</label><input type="date" id="i-deadline" value="${escHtml(item?.deadline_date||'')}"></div>`:'<input type="hidden" id="i-start" value=""><input type="hidden" id="i-deadline" value="">'}<div class="form-group"><label>Observação</label><input type="text" id="i-obs" value="${escHtml(item?.observacao||'')}"></div><div class="form-group"><label>Responsáveis</label><input type="text" id="i-resp" value="${escHtml(item?.responsaveis||'')}"></div></div>${_respThumbSectionHtml('item',id||0,item?.resp_thumb||null)}${item?`<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div style="font-size:13px;font-weight:800">📌 Sub-itens</div><button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="openSubitemModal(${id},${id},0)">+ Sub-item</button></div><div id="subitems-list-modal">${subsHtml||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px">Nenhum sub-item.</div>'}</div></div>`:''} ${id?_fieldTplSection('item',id,'Aplicam-se a todos os sub-itens'):''}${_imgSectionHtml('item',id||0)}<div class="modal-actions">${_itemFieldsHtml(item,sec)}<button class="btn-cancel" onclick="closeCadModal()">Cancelar</button><button class="btn-save" id="btn-save-ciitem" onclick="saveCiItem(${id||0},${aid||0})">💾 Salvar Item</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';setTimeout(()=>{document.getElementById('i-desc')?.focus();if(id)_imgSectionInit('item',id);},100);}

async function saveCiItem(id,atividadeId){const desc=document.getElementById('i-desc').value.trim();if(!desc){toast('Nome do item é obrigatório','error');return;}const btn=document.getElementById('btn-save-ciitem');if(btn){btn.disabled=true;btn.textContent='Salvando…';}const body={id,atividade_id:atividadeId,description:desc,item_icon:document.getElementById('i-icon').value.trim()||'📋',item_color:document.getElementById('i-color').value,start_date:document.getElementById('i-start')?.value||null,deadline_date:document.getElementById('i-deadline')?.value||null,observacao:document.getElementById('i-obs').value.trim(),responsaveis:document.getElementById('i-resp')?.value.trim()||'',verbas_list:_vbCollect('i'),verba:(_vbCollect('i')[0]?.v??null),verba_obs:(_vbCollect('i')[0]?.obs??null),origem_verba:(_vbCollect('i')[0]?.ov??null),origem_verba_obs:null,documentacao:(document.getElementById('i-doc')&&document.getElementById('i-doc').value!=='')?parseInt(document.getElementById('i-doc').value):null,documentacao_obs:document.getElementById('i-doc-obs')?.value.trim()||null,licitacao:(document.getElementById('i-lic')&&document.getElementById('i-lic').value!=='')?parseInt(document.getElementById('i-lic').value):null,licitacao_obs:document.getElementById('i-lic-obs')?.value.trim()||null};const r=await api(id?'edit_atividade_item':'add_atividade_item',body);if(btn){btn.disabled=false;btn.textContent='💾 Salvar Item';}if(r.ok){const _sciId=id||r.id;if(_sciId){await _saveImages('item',_sciId);await _saveRespThumb('item',_sciId);}await loadData();const sid=currentSecId||atividadeId;if(currentSection==='sec'&&sid){closeCadModal();renderAtividadeDetail(sid);toast(id?'Item atualizado!':'Item adicionado!');}else{if(id)openCiItemModal(id,0,atividadeId);else closeCadModal();renderCadastros(sid);toast(id?'Item atualizado!':'Item adicionado!');}}else toast(r.error||'Erro','error');}

async function deleteCiItem(id){const item=state.items.find(i=>i.id==id);if(!confirm(`Excluir "${item?.description?.substring(0,60)}"?`))return;const r=await api('delete_ci_item',{id});if(r.ok){await loadData();if(currentSection==='sec'&&currentSecId)renderAtividadeDetail(currentSecId);else renderCadastros(currentSecId);toast('Item excluído.');}else toast(r.error||'Erro','error');}

window._siFields=[];
function _siRenderFields(){const el=document.getElementById('si-custom-fields');if(!el)return;if(!window._siFields.length){el.innerHTML='<div style="font-size:11px;color:var(--muted);font-style:italic;padding:4px 0">Nenhum campo adicional.</div>';return;}el.innerHTML=window._siFields.map((f,i)=>{const badge=f.from==='activity'?`<span style="font-size:9px;background:#6366F122;color:#818CF8;border-radius:4px;padding:1px 5px">Atividade</span>`:f.from==='item'?`<span style="font-size:9px;background:#0D948822;color:#2DD4BF;border-radius:4px;padding:1px 5px">Item</span>`:`<span style="font-size:9px;background:#33415533;color:#94A3B8;border-radius:4px;padding:1px 5px">Custom</span>`;const inp=f.field_type==='textarea'?`<textarea id="sif-val-${i}" rows="2" style="flex:1;padding:5px 9px;border:1px solid var(--border);border-radius:7px;background:#0e1729;color:var(--text);font-size:12px;resize:vertical">${escHtml(f.field_value||'')}</textarea>`:`<input type="${f.field_type||'text'}" id="sif-val-${i}" value="${escHtml(f.field_value||'')}" style="flex:1;padding:5px 9px;border:1px solid var(--border);border-radius:7px;background:#0e1729;color:var(--text);font-size:12px">`;return`<div style="margin-bottom:8px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><input type="text" id="sif-name-${i}" value="${escHtml(f.field_name)}" style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:#0e1729;color:var(--text);font-size:11px;font-weight:600">${badge}<button onclick="_siRemoveField(${i})" style="background:none;border:none;cursor:pointer;color:#F87171;font-size:14px;padding:2px 4px">✕</button></div><div style="display:flex;gap:6px">${inp}</div></div>`;}).join('');}
function _siRemoveField(i){window._siFields.splice(i,1);_siRenderFields();}
function _siAddCustomField(){const n=document.getElementById('si-new-field-name');const t=document.getElementById('si-new-field-type');const name=n?.value.trim();if(!name){toast('Nome do campo é obrigatório','error');return;}window._siFields.push({template_id:null,field_name:name,field_type:t?.value||'text',field_value:'',from:'custom'});if(n)n.value='';_siRenderFields();}
function _siCollectFields(){return window._siFields.map((f,i)=>{const nE=document.getElementById('sif-name-'+i);const vE=document.getElementById('sif-val-'+i);return{template_id:f.template_id||null,field_name:nE?nE.value.trim():f.field_name,field_value:vE?vE.value:f.field_value};}).filter(f=>f.field_name);}

function openSubitemModal(itemId,parentItemId,editId){const sub=editId?(state.subitems||[]).find(s=>s.id==editId):null;const item=state.items.find(i=>i.id==(parentItemId||itemId));const atId=item?.atividade_id;const actTpls=(state.fieldTemplates||[]).filter(t=>String(t.atividade_id)===String(atId)&&!t.item_id);const itemTpls=(state.fieldTemplates||[]).filter(t=>String(t.item_id)===String(item?.id));const saved=editId?((state.subitemFields||{})[editId]||[]):[];window._siFields=[];actTpls.forEach(t=>{const sv=saved.find(s=>String(s.template_id)===String(t.id));window._siFields.push({template_id:t.id,field_name:t.field_name,field_type:t.field_type||'text',field_value:sv?(sv.field_value||''):'',from:'activity'});});itemTpls.forEach(t=>{const sv=saved.find(s=>String(s.template_id)===String(t.id));window._siFields.push({template_id:t.id,field_name:t.field_name,field_type:t.field_type||'text',field_value:sv?(sv.field_value||''):'',from:'item'});});saved.filter(s=>!s.template_id).forEach(s=>{window._siFields.push({template_id:null,field_name:s.field_name,field_type:'text',field_value:s.field_value||'',from:'custom'});});ensureCadModal();document.getElementById('modal-title-cad').textContent=sub?'✏️ Editar Sub-item':'➕ Novo Sub-item';document.getElementById('modal-sub-cad').textContent=item?item.description:'';document.getElementById('modal-body-cad').innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn-save" onclick="saveSubitem(${editId||0},${parentItemId||itemId})" style="padding:6px 18px;font-size:12px">💾 Salvar</button></div><div class="form-grid"><div class="form-group full"><label>Nome do Sub-item *</label><input type="text" id="si-desc" value="${escHtml(sub?.description||'')}" placeholder="Ex: Ofício de solicitação"></div><div class="form-group"><label>Data de Início</label><input type="date" id="si-start" value="${escHtml(sub?.start_date||'')}"></div><div class="form-group"><label>Prazo de Entrega</label><input type="date" id="si-deadline" value="${escHtml(sub?.deadline_date||'')}"></div><div class="form-group"><label>Observações</label><textarea id="si-obs" rows="2" style="resize:vertical;width:100%;box-sizing:border-box">${escHtml(sub?.observacao||'')}</textarea></div><div class="form-group"><label>Responsáveis</label><input type="text" id="si-resp" value="${escHtml(sub?.responsaveis||'')}"></div>${_respThumbSectionHtml('subitem',editId||0,sub?.resp_thumb||null)}<div class="form-group full" style="display:flex;align-items:center;gap:10px"><input type="checkbox" id="si-show-conc" ${!sub||sub.show_conclusion_date==1?'checked':''} style="width:16px;height:16px"><label for="si-show-conc" style="cursor:pointer;margin:0">Mostrar data de conclusão quando concluído</label></div></div><div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px"><div style="font-size:13px;font-weight:800;margin-bottom:10px">📝 Dados Adicionais</div><div id="si-custom-fields" style="margin-bottom:10px"></div><div style="display:flex;gap:6px"><input type="text" id="si-new-field-name" placeholder="Nome do campo…" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:#0e1729;color:var(--text);font-size:12px"><select id="si-new-field-type" style="padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:#0e1729;color:var(--text);font-size:12px">${_ftTypeOptions('text')}</select><button onclick="_siAddCustomField()" style="padding:6px 12px;background:#6366F1;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer;white-space:nowrap">+ Campo</button></div></div>${_imgSectionHtml('subitem',editId||0)}<div class="modal-actions"><button class="btn-cancel" onclick="currentSection==='sec'?closeCadModal():openCiItemModal(${parentItemId||itemId},0,0)">← Voltar</button><button class="btn-save" onclick="saveSubitem(${editId||0},${parentItemId||itemId})">${_itemFieldsHtml(sub,state.secs.find(s=>String(s.id)===String(item?.atividade_id)),true)}💾 Salvar</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';setTimeout(()=>{document.getElementById('si-desc')?.focus();if(editId)_imgSectionInit('subitem',editId);_siRenderFields();},50);}

async function saveSubitem(editId,itemId){const desc=document.getElementById('si-desc').value.trim();if(!desc){toast('Nome do sub-item é obrigatório','error');return;}const btn=document.querySelector('#modal-body-cad .btn-save');if(btn){btn.disabled=true;btn.textContent='Salvando…';}const body={id:editId||undefined,item_id:itemId,description:desc,start_date:document.getElementById('si-start').value||null,deadline_date:document.getElementById('si-deadline').value||null,observacao:document.getElementById('si-obs')?.value.trim()||'',responsaveis:document.getElementById('si-resp')?.value.trim()||'',show_conclusion_date:document.getElementById('si-show-conc').checked?1:0,verbas_list:_vbCollect('si'),verba:(_vbCollect('si')[0]?.v??null),verba_obs:(_vbCollect('si')[0]?.obs??null),origem_verba:(_vbCollect('si')[0]?.ov??null),origem_verba_obs:null,documentacao:(document.getElementById('si-doc')&&document.getElementById('si-doc').value!=='')?parseInt(document.getElementById('si-doc').value):null,documentacao_obs:document.getElementById('si-doc-obs')?.value.trim()||null,licitacao:(document.getElementById('si-lic')&&document.getElementById('si-lic').value!=='')?parseInt(document.getElementById('si-lic').value):null,licitacao_obs:document.getElementById('si-lic-obs')?.value.trim()||null};const r=await api(editId?'edit_subitem':'add_subitem',body);if(r.ok){const sid=editId||r.id;if(sid){await _saveImages('subitem',sid);await _saveRespThumb('subitem',sid);}const fields=_siCollectFields();if(sid&&fields.length)await api('save_subitem_fields',{subitem_id:sid,fields});else if(sid)await api('save_subitem_fields',{subitem_id:sid,fields:[]});await loadData();if(currentSection==='sec'&&currentSecId){closeCadModal();renderAtividadeDetail(currentSecId);}else{const it=state.items.find(i=>i.id==itemId);openCiItemModal(itemId,0,it?.atividade_id||currentSecId);renderCadastros(currentSecId);}toast(editId?'Sub-item atualizado!':'Sub-item adicionado!');}else{const b2=document.querySelector('#modal-body-cad .btn-save');if(b2){b2.disabled=false;b2.textContent='💾 Salvar';}toast(r.error||'Erro','error');}}

async function deleteSubitem(subId,itemId,atividadeId){if(!confirm('Excluir este sub-item?'))return;const r=await api('delete_subitem',{id:subId});if(r.ok){await loadData();if(currentSection==='sec'&&currentSecId)renderAtividadeDetail(currentSecId);else{openCiItemModal(itemId,0,atividadeId||currentSecId);renderCadastros(currentSecId);}toast('Sub-item excluído.');}else toast(r.error||'Erro','error');}


function _ftTypeOptions(sel){return['text','number','date','textarea','url','email'].map(t=>`<option value="${t}"${sel===t?' selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('');}

function _fieldTplSection(scope,scopeId,helpText){const isAct=scope==='activity';const tpls=isAct?(state.fieldTemplates||[]).filter(t=>String(t.atividade_id)===String(scopeId)&&!t.item_id):(state.fieldTemplates||[]).filter(t=>String(t.item_id)===String(scopeId));const rows=tpls.map(t=>`<div id="ftrow-${t.id}" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:#0e1729;margin-bottom:5px"><span style="flex:1;font-size:12px;font-weight:600">${escHtml(t.field_name)}</span><span style="font-size:10px;color:var(--muted)">${t.field_type||'text'}</span><button onclick="delFieldTpl(${t.id},'${scope}',${scopeId})" style="background:none;border:none;cursor:pointer;color:#F87171;font-size:14px;padding:2px 4px">✕</button></div>`).join('');return`<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px"><div style="font-size:13px;font-weight:800;margin-bottom:4px">🗂️ Campos Padrão</div><div style="font-size:11px;color:var(--muted);margin-bottom:10px">${helpText}</div><div id="ftpl-list-${scope}-${scopeId}">${rows||'<div style="font-size:11px;color:var(--muted);font-style:italic">Nenhum campo cadastrado.</div>'}</div><div style="display:flex;gap:6px;margin-top:8px"><input type="text" id="ftpl-name-${scope}" placeholder="Nome do campo…" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:#0e1729;color:var(--text);font-size:12px"><select id="ftpl-type-${scope}" style="padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:#0e1729;color:var(--text);font-size:12px">${_ftTypeOptions('text')}</select><button onclick="saveFieldTpl('${scope}',${scopeId})" style="padding:6px 12px;background:#6366F1;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer;white-space:nowrap">+ Campo</button></div></div>`;}

async function saveFieldTpl(scope,scopeId){const nE=document.getElementById('ftpl-name-'+scope);const tE=document.getElementById('ftpl-type-'+scope);const name=nE?.value.trim();if(!name){toast('Nome do campo é obrigatório','error');return;}const body=scope==='activity'?{atividade_id:scopeId,field_name:name,field_type:tE?.value||'text'}:{item_id:scopeId,field_name:name,field_type:tE?.value||'text'};const r=await api('add_field_template',body);if(r.ok){await loadData();if(nE)nE.value='';const item=scope==='item'?state.items.find(i=>i.id==scopeId):null;const aid=scope==='activity'?scopeId:(item?.atividade_id||currentSecId);if(scope==='activity')openSecModal(scopeId);else openCiItemModal(scopeId,0,aid);}else toast(r.error||'Erro','error');}

async function delFieldTpl(id,scope,scopeId){if(!confirm('Remover este campo padrão?'))return;const r=await api('delete_field_template',{id});if(r.ok){await loadData();const item=scope==='item'?state.items.find(i=>i.id==scopeId):null;const aid=scope==='activity'?scopeId:(item?.atividade_id||currentSecId);if(scope==='activity')openSecModal(scopeId);else openCiItemModal(scopeId,0,aid);}else toast(r.error||'Erro','error');}

function openConclusaoModal(itemId){const item=state.items.find(i=>i.id==itemId);if(!item)return;if(item.concluded==1){openUnmarkItemConcluded(itemId);return;}const today=new Date().toISOString().split('T')[0];ensureCadModal();document.getElementById('modal-title-cad').textContent='✅ Marcar como Concluído';document.getElementById('modal-sub-cad').textContent=item.description||'';document.getElementById('modal-body-cad').innerHTML=`<div class="form-group"><label>Data de Conclusão</label><input type="date" id="conc-date" value="${today}"></div><div class="form-group"><label>Mostrar data de conclusão?</label><div style="display:flex;align-items:center;gap:8px;margin-top:4px"><input type="checkbox" id="conc-show" checked style="width:16px;height:16px"><label for="conc-show" style="cursor:pointer">Sim, exibir a data</label></div></div><div class="modal-actions"><button class="btn-cancel" onclick="closeCadModal()">Cancelar</button><button class="btn-save" onclick="saveConclusao(${itemId})">✅ Confirmar</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';}

async function saveConclusao(itemId){const d=document.getElementById('conc-date')?.value||null;const r=await api('toggle_concluded',{id:itemId,concluded:1,conclusion_date:d});if(r.ok){closeCadModal();await loadData();if(currentSection==='sec'&&currentSecId)renderAtividadeDetail(currentSecId);else if(currentSection==='cadastros')renderCadastros(currentSecId);else renderDashboard();toast('Item marcado como concluído!');}else toast(r.error||'Erro','error');}

function openSubConclusaoModal(subId){const sub=(state.subitems||[]).find(s=>s.id==subId);if(!sub)return;if(sub.concluded==1){openUnmarkItemConcluded(subId,'sub');return;}const today=new Date().toISOString().split('T')[0];ensureCadModal();document.getElementById('modal-title-cad').textContent='✅ Marcar Sub-item';document.getElementById('modal-sub-cad').textContent=sub.description||'';document.getElementById('modal-body-cad').innerHTML=`<div class="form-group"><label>Data de Conclusão</label><input type="date" id="conc-date" value="${today}"></div><div class="form-group"><div style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="conc-show" checked style="width:16px;height:16px"><label for="conc-show" style="cursor:pointer">Mostrar data de conclusão</label></div></div><div class="modal-actions"><button class="btn-cancel" onclick="closeCadModal()">Cancelar</button><button class="btn-save" onclick="saveSubConclusao(${subId})">✅ Confirmar</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';}

async function saveSubConclusao(subId){const d=document.getElementById('conc-date')?.value||null;const r=await api('toggle_subitem_concluded',{id:subId,concluded:1,conclusion_date:d});if(r.ok){closeCadModal();await loadData();if(currentSection==='sec'&&currentSecId)renderAtividadeDetail(currentSecId);else if(currentSection==='cadastros')renderCadastros(currentSecId);else renderDashboard();toast('Sub-item concluído!');}else toast(r.error||'Erro','error');}

function openUnmarkItemConcluded(id,type){ensureCadModal();document.getElementById('modal-title-cad').textContent='↩️ Desmarcar Conclusão';document.getElementById('modal-sub-cad').textContent='';document.getElementById('modal-body-cad').innerHTML=`<p style="color:var(--muted);margin-bottom:16px">Deseja remover a marcação de conclusão deste ${type==='sub'?'sub-item':'item'}?</p><div class="modal-actions"><button class="btn-cancel" onclick="closeCadModal()">Cancelar</button><button class="btn-danger" onclick="confirmUnmarkItem(${id},'${type||'item'}')">↩️ Desmarcar</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';}

async function confirmUnmarkItem(id,type){const action=type==='sub'?'toggle_subitem_concluded':'toggle_concluded';const body={id,concluded:0,conclusion_date:null};const r=await api(action,body);if(r.ok){closeCadModal();await loadData();if(currentSection==='sec'&&currentSecId)renderAtividadeDetail(currentSecId);else if(currentSection==='cadastros')renderCadastros(currentSecId);else renderDashboard();toast('Desmarcado.');}else toast(r.error||'Erro','error');}

function openMarkActivityConcluded(secId){const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(secId));const pending=items.filter(i=>{const p=_itemProgress(i);return p.hasSubs?p.pct<100:i.concluded!=1;}).length;ensureCadModal();document.getElementById('modal-title-cad').textContent='✅ Concluir Toda a Atividade';document.getElementById('modal-sub-cad').textContent='';document.getElementById('modal-body-cad').innerHTML=`<p style="color:var(--muted);margin-bottom:8px">Marcar ${items.length} item(s) como concluídos?${pending>0?` <strong style="color:#F59E0B">(${pending} ainda pendente(s))</strong>`:''}</p><div class="form-group"><label>Data de Conclusão</label><input type="date" id="bulk-conc-date" value="${new Date().toISOString().split('T')[0]}"></div><div class="modal-actions"><button class="btn-cancel" onclick="closeCadModal()">Cancelar</button><button class="btn-save" onclick="confirmMarkActivityConcluded(${secId})">✅ Confirmar</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';}

async function confirmMarkActivityConcluded(secId){const d=document.getElementById('bulk-conc-date')?.value||new Date().toISOString().split('T')[0];const r=await api('mark_activity_concluded',{atividade_id:secId,conclusion_date:d,apply_date_to_children:1});if(r.ok){closeCadModal();await loadData();renderAtividadeDetail(secId);toast('Atividade concluída!');}else toast(r.error||'Erro','error');}

function openMarkItemConcluded(itemId){const item=state.items.find(i=>i.id==itemId);if(!item)return;const prog=_itemProgress(item);if(prog.hasSubs&&prog.pct===100){openUnmarkActivityConcluded(itemId,'item-bulk');return;}const pending=prog.hasSubs?prog.subs.filter(s=>s.concluded!=1).length:0;ensureCadModal();document.getElementById('modal-title-cad').textContent=prog.pct===100&&prog.hasSubs?'↩️ Desmarcar Item':'✅ Concluir Item e Sub-itens';document.getElementById('modal-sub-cad').textContent=item.description||'';document.getElementById('modal-body-cad').innerHTML=`<p style="color:var(--muted);margin-bottom:8px">Marcar todos os ${prog.total} sub-itens como concluídos?${pending>0?` <strong style="color:#F59E0B">(${pending} pendente(s))</strong>`:''}</p><div class="form-group"><label>Data de Conclusão</label><input type="date" id="bulk-item-conc-date" value="${new Date().toISOString().split('T')[0]}"></div><div class="modal-actions"><button class="btn-cancel" onclick="closeCadModal()">Cancelar</button><button class="btn-save" onclick="confirmMarkItemConcluded(${itemId})">✅ Confirmar</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';}

async function confirmMarkItemConcluded(itemId){const d=document.getElementById('bulk-item-conc-date')?.value||new Date().toISOString().split('T')[0];const r=await api('mark_item_concluded',{item_id:itemId,conclusion_date:d,apply_date_to_children:1});if(r.ok){closeCadModal();await loadData();if(currentSection==='sec'&&currentSecId)renderAtividadeDetail(currentSecId);else renderDashboard();toast('Item concluído!');}else toast(r.error||'Erro','error');}

function openUnmarkActivityConcluded(secId,type){ensureCadModal();document.getElementById('modal-title-cad').textContent='↩️ Desmarcar Conclusão';document.getElementById('modal-sub-cad').textContent='';const isItem=type==='item-bulk';document.getElementById('modal-body-cad').innerHTML=`<p style="color:var(--muted);margin-bottom:16px">Deseja desmarcar a conclusão de ${isItem?'todos os sub-itens deste item':'todos os itens desta atividade'}?</p><div class="modal-actions"><button class="btn-cancel" onclick="closeCadModal()">Cancelar</button><button class="btn-danger" onclick="confirmUnmarkActivityConcluded(${secId},'${type||'activity'}')">↩️ Desmarcar</button></div>`;document.getElementById('modal-overlay-cad').style.display='flex';}

async function confirmUnmarkActivityConcluded(secId,type){const isItem=type==='item-bulk';const action=isItem?'unmark_item_concluded':'unmark_activity_concluded';const body=isItem?{item_id:secId}:{atividade_id:secId};const r=await api(action,body);if(r.ok){closeCadModal();await loadData();if(currentSection==='sec'&&currentSecId)renderAtividadeDetail(currentSecId);else renderDashboard();toast('Desmarcado.');}else toast(r.error||'Erro','error');}

function ciToggleCollapse(itemId){if(!window._ciCollapse)window._ciCollapse={};window._ciCollapse[String(itemId)]=window._ciCollapse[String(itemId)]!==false?false:true;const el=document.getElementById('ci-subs-'+itemId);const btn=document.getElementById('ci-toggle-btn-'+itemId);if(el)el.style.display=window._ciCollapse[String(itemId)]?'none':'';if(btn)btn.textContent=window._ciCollapse[String(itemId)]?'▶':'▼';}

let _ciDragItem=null,_ciDragSub=null;
function ciItemDragStart(e,id){_ciDragItem=id;const el=document.querySelector('[data-ci-item="'+id+'"]');if(el)el.classList.add('ci-dragging');e.dataTransfer.effectAllowed='move';}
function ciItemDragOver(e,id){e.preventDefault();if(id===_ciDragItem)return;const el=document.querySelector('[data-ci-item="'+id+'"]');if(el)el.classList.add('ci-drag-over');}
function ciItemDragLeave(e,id){const el=document.querySelector('[data-ci-item="'+id+'"]');if(el)el.classList.remove('ci-drag-over');}
async function ciItemDrop(e,targetId,secId){e.preventDefault();const el=document.querySelector('[data-ci-item="'+targetId+'"]');if(el)el.classList.remove('ci-drag-over');if(!_ciDragItem||_ciDragItem===targetId)return;const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(secId));const fI=items.findIndex(i=>i.id==_ciDragItem);const tI=items.findIndex(i=>i.id==targetId);if(fI<0||tI<0)return;const newOrder=items.map(i=>i.id);newOrder.splice(fI,1);newOrder.splice(tI,0,_ciDragItem);const r=await api('reorder_items',{items:newOrder.map((id,i)=>({id,order_num:i+1}))});if(r.ok){await loadData();if(currentSection==='sec')renderAtividadeDetail(currentSecId);else renderCadastros(currentSecId);}else toast(r.error||'Erro ao reordenar','error');}
function ciItemDragEnd(e,id){const el=document.querySelector('[data-ci-item="'+id+'"]');if(el)el.classList.remove('ci-dragging');_ciDragItem=null;document.querySelectorAll('.ci-drag-over').forEach(x=>x.classList.remove('ci-drag-over'));}

function ciSubDragStart(e,subId,itemId){_ciDragSub={subId,itemId};const el=document.querySelector('[data-ci-sub="'+subId+'"]');if(el)el.classList.add('ci-dragging');e.dataTransfer.effectAllowed='move';}
function ciSubDragOver(e,subId,itemId){e.preventDefault();if(!_ciDragSub||_ciDragSub.subId===subId)return;const el=document.querySelector('[data-ci-sub="'+subId+'"]');if(el)el.classList.add('ci-drag-over');}
function ciSubDragLeave(e,subId){const el=document.querySelector('[data-ci-sub="'+subId+'"]');if(el)el.classList.remove('ci-drag-over');}
async function ciSubDrop(e,targetSubId,itemId,secId){e.preventDefault();const el=document.querySelector('[data-ci-sub="'+targetSubId+'"]');if(el)el.classList.remove('ci-drag-over');if(!_ciDragSub||_ciDragSub.subId===targetSubId||_ciDragSub.itemId!==itemId)return;const subs=(state.subitems||[]).filter(s=>String(s.item_id)===String(itemId));const fI=subs.findIndex(s=>s.id==_ciDragSub.subId);const tI=subs.findIndex(s=>s.id==targetSubId);if(fI<0||tI<0)return;const newOrder=subs.map(s=>s.id);newOrder.splice(fI,1);newOrder.splice(tI,0,_ciDragSub.subId);const r=await api('reorder_subitems',{subitems:newOrder.map((id,i)=>({id,order_num:i+1}))});if(r.ok){await loadData();if(currentSection==='sec')renderAtividadeDetail(currentSecId);else renderCadastros(currentSecId);}else toast(r.error||'Erro ao reordenar','error');}
function ciSubDragEnd(e,subId){const el=document.querySelector('[data-ci-sub="'+subId+'"]');if(el)el.classList.remove('ci-dragging');_ciDragSub=null;document.querySelectorAll('.ci-drag-over').forEach(x=>x.classList.remove('ci-drag-over'));}


var adminTab='users';
var roleLabel={admin:'Admin',auditor:'Auditor',viewer:'Visualizador'};
var roleColor={admin:'#EF4444',auditor:'#F59E0B',viewer:'#22D3EE'};
var roleBg   ={admin:'#EF444418',auditor:'#F59E0B18',viewer:'#22D3EE18'};

async function renderAdmin(){const el=document.getElementById('content');el.innerHTML=`<div style="padding:clamp(16px,2.5vw,40px)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px"><div><div class="page-title">⚙️ Administração</div><div class="page-sub">Gerenciamento de usuários e auditoria</div></div><button class="btn-secondary" onclick="renderDashboard()">← Atividades</button></div><div class="admin-tabs"><button class="admin-tab${adminTab==='users'?' active':''}" onclick="switchAdminTab('users')">👥 Usuários</button><button class="admin-tab${adminTab==='log'?' active':''}" onclick="switchAdminTab('log')">📜 Auditoria</button></div><div id="admin-content"><div class="loading">Carregando…</div></div></div>`;loadAdminTab();}

function switchAdminTab(tab){adminTab=tab;renderAdmin();}
async function loadAdminTab(){if(adminTab==='users')await loadUsersTab();else await loadLogTab();}

async function loadUsersTab(){const ac=document.getElementById('admin-content');if(!ac)return;const r=await api('users');if(!r.ok){ac.innerHTML='<div class="empty">Erro ao carregar usuários.</div>';return;}window._adminUsers={};r.users.forEach(u=>{window._adminUsers[String(u.id)]=u;});const total=r.users.length,admins=r.users.filter(u=>u.role==='admin').length,actives=r.users.filter(u=>u.active).length;const stats=`<div class="usr-stats"><div class="usr-stat"><span class="usr-stat-n">${total}</span><span>Total</span></div><div class="usr-stat"><span class="usr-stat-n" style="color:#EF4444">${admins}</span><span>Admins</span></div><div class="usr-stat"><span class="usr-stat-n" style="color:#22C55E">${actives}</span><span>Ativos</span></div></div>`;let cards='';r.users.forEach(u=>{const ini=(u.name||'?').charAt(0).toUpperCase();const rc=roleColor[u.role]||'#64748B';const rb=roleBg[u.role]||'#64748B18';const rl=roleLabel[u.role]||u.role;const ac2=u.active?'#22C55E':'#EF4444';const at=u.active?'Ativo':'Inativo';cards+=`<div class="ucard2"><div class="ucard2-left"><div class="ucard2-ava" style="background:${rb};color:${rc};border:2px solid ${rc}40">${ini}</div><div class="ucard2-info"><div class="ucard2-name">${escHtml(u.name||'—')}</div><div class="ucard2-email">${escHtml(u.email||'')}</div>${u.username?`<div class="ucard2-usr">@${escHtml(u.username)}</div>`:''}</div></div><div class="ucard2-right"><span class="ucard2-role" style="color:${rc};background:${rb};border:1px solid ${rc}30">${rl}</span><span class="ucard2-status" style="color:${ac2}">${at}</span><div class="ucard2-btns"><button class="ucard2-edit" onclick="openEditUser(${u.id})">✏️ Editar</button><button class="ucard2-del" onclick="confirmDeleteUser(${u.id})">🗑️</button></div></div></div>`;});const addForm=`<div class="usr-add-wrap"><button class="usr-add-toggle" onclick="toggleAddUser()">➕ Adicionar novo usuário</button><div class="usr-add-form" id="usr-add-form" style="display:none"><div class="usr-add-grid"><div class="form-group" style="margin:0"><label>Nome *</label><input type="text" id="nu-name" placeholder="Nome completo"></div><div class="form-group" style="margin:0"><label>E-mail *</label><input type="email" id="nu-email" placeholder="email@dominio.com"></div><div class="form-group" style="margin:0"><label>Usuário (login)</label><input type="text" id="nu-username" placeholder="nome.sobrenome" autocomplete="off"></div><div class="form-group" style="margin:0"><label>Senha *</label><input type="password" id="nu-pass" placeholder="mínimo 6 chars"></div></div><div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:10px"><div class="form-group" style="margin:0"><label>Perfil</label><select id="nu-role"><option value="viewer">Visualizador</option><option value="auditor">Auditor</option><option value="admin">Admin</option></select></div><button class="btn-save" onclick="addUser()">Criar Usuário</button></div></div></div>`;document.getElementById('admin-content').innerHTML=stats+addForm+'<div class="ucard2-list">'+cards+'</div>';}

function toggleAddUser(){const f=document.getElementById('usr-add-form');if(f)f.style.display=f.style.display==='none'?'block':'none';}
async function addUser(){const name=document.getElementById('nu-name').value.trim(),email=document.getElementById('nu-email').value.trim(),username=document.getElementById('nu-username').value.trim()||null,pass=document.getElementById('nu-pass').value,role=document.getElementById('nu-role').value;if(!name||!email||!pass){toast('Preencha Nome, E-mail e Senha','error');return;}const r=await api('add_user',{name,email,username,password:pass,role});if(r.ok){toast('Usuário criado!');loadUsersTab();}else toast(r.error||'Erro ao criar usuário','error');}

function openEditUser(id){const u=window._adminUsers[String(id)];if(!u){toast('Usuário não encontrado. Recarregue a página.','error');return;}document.getElementById('eu-id').value=String(u.id);document.getElementById('eu-name').value=u.name||'';document.getElementById('eu-email').value=u.email||'';document.getElementById('eu-username').value=u.username||'';document.getElementById('eu-role').value=u.role||'viewer';document.getElementById('eu-pass').value='';document.getElementById('euDialog').showModal();}
function closeEditUser(){document.getElementById('euDialog').close();}
async function saveEditUser(){const id=parseInt(document.getElementById('eu-id').value,10),name=document.getElementById('eu-name').value.trim(),email=document.getElementById('eu-email').value.trim(),username=document.getElementById('eu-username').value.trim()||null,role=document.getElementById('eu-role').value,pass=document.getElementById('eu-pass').value;if(!name||!email){toast('Nome e e-mail são obrigatórios','error');return;}if(pass&&pass.length<6){toast('Senha muito curta (mínimo 6 caracteres)','error');return;}if(username&&!/^[a-zA-Z0-9._-]{3,60}$/.test(username)){toast('Usuário: 3-60 chars, letras/números/ponto/traço/underscore','error');return;}const body={user_id:id,name,email,username,role};if(pass)body.new_password=pass;const r=await api('edit_user',body);if(r.ok){toast('Usuário atualizado!');closeEditUser();loadUsersTab();}else toast(r.error||'Erro ao salvar','error');}

function confirmDeleteUser(id){const u=window._adminUsers[String(id)];const name=u?(u.name||''):'';if(!confirm('Deletar o usuário "'+name+'"?\n\nEsta ação não pode ser desfeita.'))return;api('delete_user',{user_id:id}).then(r=>{if(r.ok){toast('Usuário removido!');loadUsersTab();}else toast(r.error||'Erro ao deletar','error');});}

async function loadLogTab(){const r=await api('audit_log&limit=200');if(!r.ok)return;const rows=(r.logs||[]).map(l=>`<tr><td style="font-size:12px;color:var(--muted)">${escHtml(l.user_name||'–')}</td><td class="log-action">${escHtml(l.action)}</td><td class="log-details">${escHtml(l.details||'')}</td><td class="log-time">${fmtDate(l.created_at)}</td><td style="font-size:11px;color:var(--dim)">${escHtml(l.ip_address||'')}</td></tr>`).join('');document.getElementById('admin-content').innerHTML=`<div class="table-wrap"><table class="log-table"><thead><tr><th>Usuário</th><th>Ação</th><th>Detalhes</th><th>Data/Hora</th><th>IP</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="empty">Nenhum registro</td></tr>'}</tbody></table></div>`;}

function showSection(section){currentSection=section;if(!window._ciCollapse)window._ciCollapse={};if(section==='dashboard')renderDashboard();else if(section==='cadastros')renderCadastros(null);else renderDashboard();}

function renderSecretariasSection(section,sectionId){currentSection=section||'dashboard';currentSecId=sectionId||null;if(section==='sec'&&sectionId)renderAtividadeDetail(sectionId);else if(section==='cadastros')renderCadastros(sectionId||null);else renderDashboard();}

async function init(){if(!window._ciCollapse)window._ciCollapse={};if(ciIsSuperAdmin)renderHamMenu();const content=document.getElementById('content');content.innerHTML='<div class="loading">Carregando dados…</div>';try{await loadData();}catch(e){content.innerHTML='<div class="empty" style="color:#F87171">Erro ao carregar dados: '+escHtml(String(e.message||e))+'</div>';return;}renderSecretariasSection(initialRoute.section,initialRoute.sectionId);}

document.addEventListener('click',function(e){const menu=document.getElementById('ham-menu');if(menu&&menu.style.display!=='none'&&!e.target.closest('#ham-wrap')){menu.style.display='none';const btn=document.getElementById('ham-btn');if(btn)btn.setAttribute('aria-expanded','false');}});

init();





</script>

<dialog id="euDialog">
  <div class="eu-box">
    <div class="eu-box-header"><h3>✏️ Editar Usuário</h3><button class="eu-close-btn" onclick="closeEditUser()">×</button></div>
    <div class="eu-body">
      <input type="hidden" id="eu-id">
      <div class="form-group"><label>Nome completo</label><input type="text" id="eu-name" placeholder="Nome completo"></div>
      <div class="form-group"><label>E-mail</label><input type="email" id="eu-email" placeholder="email@dominio.com"></div>
      <div class="form-group"><label>Usuário (login) <span>(opcional)</span></label><input type="text" id="eu-username" placeholder="nome.sobrenome" autocomplete="off"><div class="eu-hint">3–60 caracteres: letras, números, ponto, hífen, underscore</div></div>
      <div class="form-group"><label>Perfil</label><select id="eu-role"><option value="viewer">Visualizador</option><option value="auditor">Auditor</option><option value="admin">Admin</option></select></div>
      <div class="form-group"><label>Nova senha <span>(opcional)</span></label><input type="password" id="eu-pass" placeholder="Deixe em branco para não alterar" autocomplete="new-password"><div class="eu-hint">Mínimo 6 caracteres se preencher</div></div>
    </div>
    <div class="eu-footer"><button class="btn-cancel-eu" onclick="closeEditUser()">Cancelar</button><button class="btn-save-eu" onclick="saveEditUser()">💾 Salvar alterações</button></div>
  </div>
</dialog>

<div id="busca-overlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:3000;padding:16px;box-sizing:border-box;overflow-y:auto">
<div style="max-width:900px;margin:0 auto;background:var(--card);border-radius:16px;padding:24px;position:relative">
  <button onclick="fecharBusca()" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer">✕</button>
  <div style="font-size:18px;font-weight:800;color:var(--accent);margin-bottom:18px">🔍 Busca Inteligente</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
    <input id="busca-input" type="text" placeholder="Digite o texto a buscar..." onkeydown="if(event.key==='Enter')executarBusca()" style="flex:1;min-width:200px;padding:10px 14px;background:#0e1729;border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px">
    <select id="busca-campo" style="padding:10px 14px;background:#0e1729;border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;min-width:190px" onchange="atualizarCamposBusca()">
      <option value="todos">📋 Todos os campos</option>
      <option value="nome">🏷️ Nome do Item</option>
      <option value="obs">📝 Observação</option>
      <option value="resp">👤 Responsáveis</option>
    </select>
    <button onclick="executarBusca()" style="padding:10px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🔍 Buscar</button>
    <button onclick="limparBusca()" style="padding:10px 18px;background:#334155;color:var(--text);border:none;border-radius:8px;font-size:13px;cursor:pointer">✕ Limpar</button>
  </div>
  <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px;padding:10px 14px;background:#0a1222;border-radius:8px;border:1px solid #1e3a5f"><label style="display:flex;align-items:center;gap:7px;font-size:12px;color:#94A3B8;cursor:pointer"><input type="checkbox" id="bchk-allsubs-item" style="accent-color:#0e7490;width:14px;height:14px" onchange="if(window._buscaResultados)executarBusca()"><span><strong style="color:#60A5FA">Item encontrado</strong> → mostrar todos os subitens desse item</span></label><label style="display:flex;align-items:center;gap:7px;font-size:12px;color:#94A3B8;cursor:pointer"><input type="checkbox" id="bchk-show-parent" style="accent-color:#8B5CF6;width:14px;height:14px" onchange="if(window._buscaResultados)executarBusca()"><span><strong style="color:#A78BFA">Subitem encontrado</strong> → exibir o item pai (mesmo sem match)</span></label><label style="display:flex;align-items:center;gap:7px;font-size:12px;color:#94A3B8;cursor:pointer"><input type="checkbox" id="bchk-allsubs-sub" style="accent-color:#F59E0B;width:14px;height:14px" onchange="if(window._buscaResultados)executarBusca()"><span><strong style="color:#FCD34D">Subitem encontrado</strong> → mostrar todos os subitens irmãos</span></label></div><div id="busca-resultados" style="margin-top:12px"></div>
</div>
</div>

<script>

let _buscaSecId=null;
function abrirBusca(secId){
  _buscaSecId=secId;
  const sec=state.secs.find(s=>String(s.id)===String(secId));
  if(!sec)return;
  // Build custom field options
  const sel=document.getElementById('busca-campo');
  // Remove custom options beyond the first 4
  while(sel.options.length>4)sel.remove(4);
  // Add activity-specific extra fields if enabled
  if(sec.show_origem_verba){const o=new Option('📍 Origem da Verba','origem_verba');sel.add(o);}
  if(sec.show_verba){const o=new Option('💰 Verba','verba');sel.add(o);}
  if(sec.show_documentacao){const o=new Option('📁 Documentação','documentacao');sel.add(o);}
  if(sec.show_licitacao){const o=new Option('⚖️ Licitação','licitacao');sel.add(o);}
  // Add custom field templates for this activity
  const tpls=(state.fieldTemplates||[]).filter(t=>String(t.atividade_id)===String(secId));
  tpls.forEach(t=>{const o=new Option('📋 '+t.name,'custom_'+t.id);sel.add(o);});
  document.getElementById('busca-input').value='';
  document.getElementById('busca-resultados').innerHTML='';
  document.getElementById('busca-overlay').style.display='block';
  setTimeout(()=>document.getElementById('busca-input').focus(),80);
}
function fecharBusca(){document.getElementById('busca-overlay').style.display='none';}
function limparBusca(){document.getElementById('busca-input').value='';document.getElementById('busca-resultados').innerHTML='';}
function atualizarCamposBusca(){/* dynamic - future */}
function executarBusca(){
  const _norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const q=_norm(document.getElementById('busca-input').value.trim());
  const campo=document.getElementById('busca-campo').value;
  const secId=_buscaSecId;
  const sec=state.secs.find(s=>String(s.id)===String(secId));
  if(!q||!sec){document.getElementById('busca-resultados').innerHTML='<div style="color:var(--muted);text-align:center;padding:20px">Digite um termo para buscar.</div>';return;}
  const items=(state.items||[]).filter(i=>String(i.atividade_id)===String(secId));
  const _match=(val)=>val&&_norm(String(val)).includes(q);
  const _matchItem=(it,isSub)=>{
    if(campo==='todos'){
      return _match(it.description)||_match(it.observacao)||_match(it.responsaveis)||_match(it.origem_verba)||_match(it.verba_obs)||_match(it.documentacao_obs)||_match(it.licitacao_obs);
    }
    if(campo==='nome')return _match(it.description);
    if(campo==='obs')return _match(it.observacao)||_match(it.verba_obs)||_match(it.documentacao_obs)||_match(it.licitacao_obs);
    if(campo==='resp')return _match(it.responsaveis);
    if(campo==='origem_verba')return _match(it.origem_verba);
    if(campo==='verba')return _match(String(it.verba||''));
    if(campo==='documentacao')return _match(it.documentacao_obs);
    if(campo==='licitacao')return _match(it.licitacao_obs);
    if(campo.startsWith('custom_')){const fid=campo.replace('custom_','');const fields=(state.subitemFields||[]).filter(sf=>String(sf.item_id)===(isSub?String(it.id):String(it.id))&&String(sf.template_id)===fid);return fields.some(f=>_match(f.value));}
    return false;
  };
  const hl=(txt)=>{if(!txt)return '';const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');return escHtml(String(txt)).replace(re,'<mark style="background:#F59E0B44;color:#FCD34D;border-radius:3px;padding:0 2px">$1</mark>');};
  const chkAllSubsItem=document.getElementById('bchk-allsubs-item').checked;
  const chkShowParent=document.getElementById('bchk-show-parent').checked;
  const chkAllSubsSub=document.getElementById('bchk-allsubs-sub').checked;
  const results=[];
  items.forEach(item=>{
    const subs=(state.subitems||[]).filter(s=>String(s.item_id)===String(item.id));
    const itemMatch=_matchItem(item,false);
    const matchSubs=subs.filter(s=>_matchItem(s,true));
    if(itemMatch||matchSubs.length>0){results.push({item,subs:matchSubs,allSubs:subs,itemMatch});}
    else if(chkShowParent&&matchSubs.length===0){
      // check if any sub matches and item doesn't — already handled above
    }
  });
  // Compute display subs per result based on checkbox options
  const displayResults=results.map(r=>{
    let displaySubs=r.subs;
    let showParentBadge=false;
    if(r.itemMatch&&chkAllSubsItem){
      // Item matched: show ALL subitems (not just those that matched)
      displaySubs=r.allSubs;
    }
    if(!r.itemMatch&&r.subs.length>0){
      // Subitems matched but parent item didn't
      showParentBadge=chkShowParent;
      if(chkAllSubsSub) displaySubs=r.allSubs;
    }
    return {...r,displaySubs,showParentBadge};
  });
  const total=displayResults.reduce((t,r)=>t+(r.itemMatch?1:0)+r.subs.length,0);
  let html=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">`;
  html+=`<div style="font-size:13px;color:var(--muted)"><strong style="color:var(--accent)">${total}</strong> resultado(s) para "<strong>${escHtml(q)}</strong>"</div>`;
  html+=`<button onclick="gerarPdfBusca()" style="padding:8px 14px;background:#8B5CF6;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📄 Gerar PDF dos Resultados</button></div>`;
  html+='<div style="display:flex;flex-direction:column;gap:10px">';
  displayResults.forEach(({item,subs,displaySubs,allSubs,itemMatch,showParentBadge})=>{
    const isDone=item.concluded==1;
    // Border color: accent=item matched, purple=only subitems matched
    const borderColor=itemMatch?'var(--accent)':'#7C3AED';
    html+=`<div style="background:#0e1729;border-radius:12px;padding:14px;border:1px solid ${borderColor}">`;
    html+=`<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">`;
    html+=`<div style="flex:1;min-width:0">`;
    // If item didn't match but showParentBadge is on, show a label indicating it's the parent
    if(!itemMatch&&showParentBadge){
      html+=`<div style="font-size:10px;font-weight:700;color:#A78BFA;margin-bottom:4px;letter-spacing:.5px">📌 ITEM PAI DO SUBITEM ENCONTRADO</div>`;
    }
    html+=`<div style="font-size:14px;font-weight:700;color:${isDone?'#34D399':(itemMatch?'var(--text)':'#94A3B8')}">${itemMatch?hl(item.description):escHtml(item.description||'')}</div>`;
    if(item.responsaveis)html+=`<div style="font-size:11px;color:#A78BFA;margin-top:3px">👤 ${itemMatch?hl(item.responsaveis):escHtml(item.responsaveis)}</div>`;
    if(item.observacao)html+=`<div style="font-size:11px;color:var(--muted);margin-top:3px;font-style:italic">📝 ${itemMatch?hl(item.observacao):escHtml(item.observacao)}</div>`;
    html+=`${_renderExtras(item,sec,false)}`;
    html+='</div>';
    html+=`<span style="font-size:11px;background:${isDone?'#10B98122':'#33415522'};color:${isDone?'#34D399':'#94A3B8'};border-radius:999px;padding:3px 10px;flex-shrink:0">${isDone?'✅ Concluído':'⏳ Pendente'}</span>`;
    html+='</div>';
    if(displaySubs.length>0){
      // Show count hint if showing all subs beyond what matched
      const extraCount=displaySubs.length-subs.length;
      if(extraCount>0){
        const label=itemMatch?'Exibindo todos os subitens deste item':'Exibindo subitens irmãos do subitem encontrado';
        html+=`<div style="font-size:10px;color:#F59E0B;margin-top:6px;margin-bottom:2px;font-weight:600">📂 ${label} (${displaySubs.length} no total, ${subs.length} com match)</div>`;
      }
      html+='<div style="margin-top:8px;padding-left:12px;border-left:2px solid #334155;display:flex;flex-direction:column;gap:6px">';
      displaySubs.forEach(s=>{
        const sD=s.concluded==1;
        const sMatched=subs.some(ms=>ms.id===s.id);
        html+=`<div style="background:#0a1222;border-radius:8px;padding:8px 12px;border-left:2px solid ${sMatched?'#0e7490':'transparent'}">`;
        html+=`<div style="font-size:12px;font-weight:600;color:${sD?'#34D399':'var(--text)'}">  › ${sMatched?hl(s.description):escHtml(s.description||'')}</div>`;
        if(s.responsaveis)html+=`<div style="font-size:10px;color:#A78BFA;margin-top:2px">👤 ${sMatched?hl(s.responsaveis):escHtml(s.responsaveis)}</div>`;
        if(s.observacao)html+=`<div style="font-size:10px;color:var(--muted);margin-top:2px;font-style:italic">📝 ${sMatched?hl(s.observacao):escHtml(s.observacao)}</div>`;
        html+=`${_renderExtras(s,sec,true)}`;
        html+='</div>';
      });
      html+='</div>';
    }
    html+='</div>';
  });
  html+='</div>';
  window._buscaResultados={results:displayResults,query:q,campo,secId};
  window._buscaResultados={results,query:q,campo,secId};
  document.getElementById('busca-resultados').innerHTML=html;
}
async function gerarPdfBusca(){
  if(!window._buscaResultados)return;
  const {results,query,campo,secId}=window._buscaResultados;
  const sec=state.secs.find(s=>String(s.id)===String(secId));
  if(!sec||!window.jspdf||!window.jspdf.jsPDF){toast('Aguarde o carregamento da biblioteca PDF.','error');return;}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight();
  const mx=14,BODY_TOP=28,FTR_Y=H-10;
  const addPageDecor=()=>{
    doc.setFillColor(13,34,64);doc.rect(0,0,W,BODY_TOP-2,'F');
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
    doc.text(sec.name+' — Resultados da Busca',mx,10);
    doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(180,210,255);
    doc.text('Campo: '+(campo==='todos'?'Todos os campos':campo)+' | Busca: "'+query+'"',mx,17);
    doc.text('Gerado em '+new Date().toLocaleDateString('pt-BR')+' '+new Date().toLocaleTimeString('pt-BR'),W-mx,17,{align:'right'});
    doc.setFillColor(13,34,64);doc.rect(0,H-14,W,14,'F');
    doc.setFontSize(7.5);doc.setTextColor(180,210,255);
    const pg=doc.getCurrentPageInfo().pageNumber;
    doc.text('Página '+pg,W-mx,H-5,{align:'right'});
  };
  addPageDecor();
  const iFill=[20,45,95],iTC=[220,235,255];
  const tblH=[['#','Item / Sub-item','Status','Responsáveis','Observação']];
  const tblB=[];
  let c=1;
  const _pdfChkAllSubsItem=document.getElementById('bchk-allsubs-item')?.checked||false;
  const _pdfChkAllSubsSub=document.getElementById('bchk-allsubs-sub')?.checked||false;
  const _pdfChkShowParent=document.getElementById('bchk-show-parent')?.checked||false;
  results.forEach(({item,subs,displaySubs,allSubs,itemMatch})=>{
    // Re-compute display subs using current checkbox state (real-time)
    let _subsToRender=subs;
    if(itemMatch&&_pdfChkAllSubsItem) _subsToRender=allSubs||subs;
    else if(!itemMatch&&subs.length>0&&_pdfChkAllSubsSub) _subsToRender=allSubs||subs;
    else _subsToRender=displaySubs||subs;
    const isDone=item.concluded==1;
    const ex=[];if(item.observacao)ex.push(item.observacao);const extras=[];
    if(sec.show_verba){let _bvl=[];try{_bvl=typeof item.verbas_list==='string'?JSON.parse(item.verbas_list||'[]'):Array.isArray(item.verbas_list)?item.verbas_list:[];}catch(e){_bvl=[];}if(!_bvl.length&&item.verba!=null)_bvl=[{v:item.verba,ov:item.origem_verba||'',obs:''}];_bvl.forEach(e=>{if(e.v!=null)extras.push('Verba: R$ '+parseFloat(e.v).toFixed(2)+(e.ov?' / '+e.ov:''));});}
    if(sec.show_origem_verba&&item.origem_verba)extras.push('📍 '+item.origem_verba);
    if(sec.show_documentacao&&item.documentacao!=null)extras.push('📁 '+(item.documentacao==1?'Concluída':'Pendente'));
    if(sec.show_licitacao&&item.licitacao!=null)extras.push('⚖️ '+(item.licitacao==1?'Concluída':'Pendente'));
    const obsCell=[...ex,...extras].join(' | ');
    tblB.push([
      {content:String(c++),styles:{halign:'center',fontStyle:'bold',fillColor:iFill,textColor:iTC}},
      {content:item.description||'',styles:{fontStyle:'bold',fillColor:iFill,textColor:iTC}},
      {content:isDone?'✅ Concluído':'⏳ Pendente',styles:{fillColor:iFill,textColor:isDone?[100,230,175]:[180,200,240]}},
      {content:item.responsaveis||'',styles:{fillColor:iFill,textColor:iTC,fontSize:7.5}},
      {content:obsCell,styles:{fillColor:iFill,textColor:iTC,fontSize:7.5}}
    ]);
    _subsToRender.forEach(s=>{
      const sD=s.concluded==1;
      const sEx=[];if(s.observacao)sEx.push(s.observacao);
      if(sec.show_verba&&sec.verba_on_subitems){let _svl=[];try{_svl=typeof s.verbas_list==='string'?JSON.parse(s.verbas_list||'[]'):Array.isArray(s.verbas_list)?s.verbas_list:[];}catch(e){_svl=[];}if(!_svl.length&&s.verba!=null)_svl=[{v:s.verba,ov:s.origem_verba||'',obs:''}];_svl.forEach(e=>{if(e.v!=null)sEx.push('Verba: R$ '+parseFloat(e.v).toFixed(2)+(e.ov?' / '+e.ov:''));});}
      if(sec.show_origem_verba&&sec.origem_verba_on_subitems&&s.origem_verba)sEx.push('📍 '+s.origem_verba);
      const sObs=sEx.join(' | ');
      tblB.push(['',{content:'  › '+(s.description||''),styles:{textColor:[40,55,75],fontSize:7.5}},{content:sD?'✅ Concluído':'⏳ Pendente',styles:{textColor:sD?[16,185,129]:[60,80,100],fontSize:7.5}},{content:s.responsaveis||'',styles:{textColor:[60,80,100],fontSize:7}},{content:sObs,styles:{textColor:[60,80,100],fontSize:7}}]);
    });
  });
  doc.autoTable({startY:BODY_TOP+2,head:tblH,body:tblB,margin:{left:mx,right:mx,top:BODY_TOP,bottom:H-FTR_Y+4},rowPageBreak:'avoid',styles:{fontSize:8,cellPadding:1.8,overflow:'linebreak',textColor:[26,32,44],lineColor:[200,225,200],lineWidth:0.1},headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},columnStyles:{1:{cellWidth:'auto'}},didDrawPage:()=>addPageDecor()});
  doc.save((sec.name||'busca').replace(/[^a-zA-Z0-9À-ú ]/g,'_')+'_busca.pdf');
  toast('PDF gerado com sucesso!','success');
}


// ════════════════════════════════════════════════════════════════════════════
// IMAGE MANAGER – Imagens representativas e galeria
// ════════════════════════════════════════════════════════════════════════════
const _imgState = {}; // {entityKey: [{id,is_representative,title,obs,image_data,_new,_del}]}

function _imgKey(type,id){return type+'_'+id;}

async function _loadImages(type,id){
  const key=_imgKey(type,id);
  try{
    const r=await fetch(`api.php?action=get_entity_images&entity_type=${type}&entity_id=${id}`);
    const d=await r.json();
    _imgState[key]=(d.images||[]).map(img=>({...img,_new:false,_del:false}));
  }catch(e){_imgState[key]=[];}
  return _imgState[key];
}

async function _makeThumb(dataUrl,w,h,q){return new Promise(res=>{const i=new Image();i.onload=()=>{const ar=i.naturalWidth/i.naturalHeight;let sw=w,sh=Math.round(w/ar);if(sh>h){sh=h;sw=Math.round(h*ar);}const c=document.createElement('canvas');c.width=sw;c.height=sh;c.getContext('2d').drawImage(i,0,0,sw,sh);res(c.toDataURL('image/jpeg',q||0.65));};i.onerror=()=>res(dataUrl);i.src=dataUrl;});}
async function _saveImages(type,id){
  const key=_imgKey(type,id);
  const list=_imgState[key]||[];
  for(const img of list){
    if(img._del&&img.id){
      await api('delete_entity_image',{id:img.id});
    } else if(img._new&&!img._del&&img.image_data){
      let extra={};
      if(img.is_representative)extra.cover_thumb=await _makeThumb(img.image_data,120,90,0.65);
      const r=await api('add_entity_image',{entity_type:type,entity_id:id,is_representative:img.is_representative,title:img.title||'',obs:img.obs||'',image_data:img.image_data,order_num:img.order_num||0,...extra});
      if(r.ok){img.id=r.id;img._new=false;
        if(img.is_representative){const s=state.secs.find(x=>type==='activity'&&String(x.id)===String(id));if(s)s.cover_thumb=extra.cover_thumb;const it=state.items.find(x=>type==='item'&&String(x.id)===String(id));if(it)it.cover_thumb=extra.cover_thumb;const sub=(state.subitems||[]).find(x=>type==='subitem'&&String(x.id)===String(id));if(sub)sub.cover_thumb=extra.cover_thumb;}
      }
    } else if(!img._new&&!img._del&&img.id){
      await api('update_entity_image',{id:img.id,entity_type:type,entity_id:id,is_representative:img.is_representative,title:img.title||'',obs:img.obs||'',order_num:img.order_num||0});
    }
  }
  _imgState[key]=list.filter(i=>!i._del);
}

function _resizeImg(file,maxW,maxH,quality){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height;
        if(w>maxW||h>maxH){const ar=w/h;if(w/maxW>h/maxH){w=maxW;h=w/ar;}else{h=maxH;w=h*ar;}}
        const c=document.createElement('canvas');c.width=Math.round(w);c.height=Math.round(h);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        res(c.toDataURL('image/jpeg',quality||0.75));
      };
      img.src=e.target.result;
    };
    r.readAsDataURL(file);
  });
}

async function _renderImgSection(containerId,entityType,entityId){
  const key=_imgKey(entityType,entityId);
  if(!_imgState[key]) await _loadImages(entityType,entityId);
  const cont=document.getElementById(containerId);
  if(!cont) return;
  _drawImgSection(containerId,entityType,entityId);
}

function _drawImgSection(containerId,entityType,entityId){
  const key=_imgKey(entityType,entityId);
  const imgs=(_imgState[key]||[]).filter(i=>!i._del);
  const rep=imgs.find(i=>i.is_representative==1||i.is_representative===true);
  const gallery=imgs.filter(i=>!(i.is_representative==1||i.is_representative===true));
  const cont=document.getElementById(containerId);
  if(!cont) return;
  cont.innerHTML=`
  <div style="background:#0a1222;border-radius:12px;padding:14px;margin-top:10px;border:1px solid var(--border)">
    <div style="font-size:12px;font-weight:700;color:#A78BFA;margin-bottom:12px">🖼️ Imagens</div>
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:6px">📌 Imagem Representativa (Logo/Capa)</div>
      ${rep?`
        <div style="display:flex;align-items:flex-start;gap:10px;background:#0e1729;border-radius:8px;padding:10px;border:1px solid #A78BFA44">
          <img src="${rep.image_data}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0">
          <div style="flex:1">
            <input type="text" value="${escHtml(rep.title||'')}" placeholder="Título da imagem (opcional)" onchange="_imgSetProp('${entityType}','${entityId}',${rep.id||('_r_'+JSON.stringify(rep.image_data).slice(0,8))},'title',this.value)" style="width:100%;padding:5px 8px;background:#0a1222;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;margin-bottom:4px">
            <input type="text" value="${escHtml(rep.obs||'')}" placeholder="Descrição (opcional)" onchange="_imgSetProp('${entityType}','${entityId}','_rep','obs',this.value)" style="width:100%;padding:5px 8px;background:#0a1222;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
          </div>
          <button onclick="_imgDelete('${entityType}','${entityId}','_rep','${containerId}')" style="background:#EF444420;color:#EF4444;border:1px solid #EF444444;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:14px;flex-shrink:0">✕</button>
        </div>
      `:`
        <label style="display:flex;align-items:center;justify-content:center;gap:8px;background:#0e1729;border-radius:8px;padding:16px;border:2px dashed #A78BFA44;cursor:pointer;color:#A78BFA;font-size:12px">
          <input type="file" accept="image/*" style="display:none" onchange="_imgUpload(event,'${entityType}','${entityId}',true,'${containerId}')">
          📷 Clique para adicionar imagem representativa
        </label>
      `}
    </div>
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:11px;color:var(--muted);font-weight:600">🗂️ Galeria de Imagens (${gallery.length})</div>
        <label style="background:#A78BFA20;color:#A78BFA;border:1px solid #A78BFA44;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px;font-weight:700">
          <input type="file" accept="image/*" multiple style="display:none" onchange="_imgUploadMulti(event,'${entityType}','${entityId}','${containerId}')">
          + Adicionar
        </label>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${gallery.map(g=>`
          <div style="position:relative;width:80px">
            <img src="${g.image_data}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
            <button onclick="_imgDelete('${entityType}','${entityId}','${g.id||'_g_'+g.order_num}','${containerId}')" style="position:absolute;top:2px;right:2px;background:#EF4444cc;color:#fff;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:10px;line-height:1;padding:0">✕</button>
            <input type="text" value="${escHtml(g.title||'')}" placeholder="Título" onchange="_imgSetGalleryProp('${entityType}','${entityId}','${g.id||'_g_'+g.order_num}','title',this.value)" style="width:80px;padding:2px 4px;background:#0a1222;border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:9px;margin-top:3px">
          </div>
        `).join('')}
        ${gallery.length===0?'<div style="font-size:11px;color:var(--muted);padding:8px">Nenhuma imagem na galeria</div>':''}
      </div>
    </div>
  </div>`;
}

async function _imgUpload(event,entityType,entityId,isRep,containerId){
  const file=event.target.files[0];if(!file)return;
  const data=await _resizeImg(file,isRep?300:800,isRep?300:600,0.80);
  const key=_imgKey(entityType,entityId);
  if(!_imgState[key])_imgState[key]=[];
  if(isRep){
    _imgState[key]=_imgState[key].filter(i=>!(i.is_representative==1||i.is_representative===true));
    _imgState[key].unshift({id:null,is_representative:1,title:'',obs:'',image_data:data,order_num:0,_new:true,_del:false});
  }
  _drawImgSection(containerId,entityType,entityId);
}

async function _imgUploadMulti(event,entityType,entityId,containerId){
  const files=Array.from(event.target.files);if(!files.length)return;
  const key=_imgKey(entityType,entityId);
  if(!_imgState[key])_imgState[key]=[];
  const existing=_imgState[key].filter(i=>!i.is_representative&&!i._del).length;
  for(let idx=0;idx<files.length;idx++){
    const data=await _resizeImg(files[idx],800,600,0.78);
    _imgState[key].push({id:null,is_representative:0,title:'',obs:'',image_data:data,order_num:existing+idx,_new:true,_del:false});
  }
  _drawImgSection(containerId,entityType,entityId);
}

function _imgDelete(entityType,entityId,imgRef,containerId){
  const key=_imgKey(entityType,entityId);
  const list=_imgState[key]||[];
  if(imgRef==='_rep'){
    const rep=list.find(i=>i.is_representative==1||i.is_representative===true);
    if(rep){if(rep.id)rep._del=true;else{const idx=list.indexOf(rep);list.splice(idx,1);}}
  } else {
    const item=list.find(i=>String(i.id)===String(imgRef)||String(i.order_num)===String(imgRef));
    if(item){if(item.id)item._del=true;else{const idx=list.indexOf(item);list.splice(idx,1);}}
  }
  _imgState[key]=list;
  _drawImgSection(containerId,entityType,entityId);
}

function _imgSetProp(entityType,entityId,imgRef,prop,val){
  const key=_imgKey(entityType,entityId);
  const list=_imgState[key]||[];
  if(imgRef==='_rep'){
    const rep=list.find(i=>i.is_representative==1||i.is_representative===true);
    if(rep) rep[prop]=val;
  } else {
    const item=list.find(i=>String(i.id)===String(imgRef));
    if(item) item[prop]=val;
  }
}

function _imgSetGalleryProp(entityType,entityId,imgRef,prop,val){
  _imgSetProp(entityType,entityId,imgRef,prop,val);
}

function _imgSectionHtml(entityType,entityId){
  return `<div id="img-section-${entityType}-${entityId}"></div>`;
}

function _imgSectionInit(entityType,entityId){
  const containerId=`img-section-${entityType}-${entityId}`;
  setTimeout(()=>_renderImgSection(containerId,entityType,entityId),100);
}

function _respThumbSectionHtml(type,id,existing){const k='rtp-'+type+'-'+(id||0);const f='rtf-'+type+'-'+(id||0);const hasEx=existing&&existing.length>10;const imgHtml=hasEx?'<img src="'+existing+'" style="width:100%;height:100%;object-fit:cover">':"👤";const btnRem=hasEx?'<button type="button" onclick="_respThumbClear(\''+type+'\','+( id||0)+')" style="background:#EF444420;color:#EF4444;border:1px solid #EF444444;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:11px">\u2715 Remover</button>':'';return '<div style="background:#0a1222;border-radius:12px;padding:12px;margin-top:10px;border:1px solid var(--border)"><div style="font-size:12px;font-weight:700;color:#818CF8;margin-bottom:10px">\ud83d\udc64 Foto do Respons\u00e1vel</div><div style="display:flex;align-items:center;gap:14px"><div id="'+k+'" style="width:56px;height:56px;border-radius:50%;border:2px solid #818CF8;overflow:hidden;background:#1e3a5f;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:24px">'+imgHtml+'</div><div style="display:flex;flex-direction:column;gap:6px"><input type="file" id="'+f+'" accept="image/*" style="display:none" onchange="_respThumbPreview(this,\''+type+'\','+( id||0)+')"><button type="button" onclick="document.getElementById(\''+f+'\').click()" style="background:#818CF820;color:#818CF8;border:1px solid #818CF844;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600">\ud83d\udcf7 Escolher Foto</button>'+btnRem+'</div></div></div>';}
function _respThumbPreview(input,type,id){const file=input.files[0];if(!file)return;const rd=new FileReader();rd.onload=async e=>{const th=await _makeThumb(e.target.result,160,160,0.82);const prev=document.getElementById('rtp-'+type+'-'+id);if(prev)prev.innerHTML=`<img src="${th}" style="width:100%;height:100%;object-fit:cover">`;window._pendingRespThumb=window._pendingRespThumb||{};window._pendingRespThumb[type+'_'+id]=th;};rd.readAsDataURL(file);}
function _respThumbClear(type,id){const prev=document.getElementById('rtp-'+type+'-'+id);if(prev)prev.innerHTML='👤';window._pendingRespThumb=window._pendingRespThumb||{};window._pendingRespThumb[type+'_'+id]=null;}
async function _saveRespThumb(type,id){if(!window._pendingRespThumb)return;const k=type+'_'+(id||0),k0=type+'_0',ak=(k in window._pendingRespThumb)?k:((k0 in window._pendingRespThumb)?k0:null);if(!ak)return;const th=window._pendingRespThumb[ak];if(id)await api('save_resp_thumb',{entity_type:type,entity_id:id,thumb_data:th||''});delete window._pendingRespThumb[ak];}

// ── GALERIA MODAL ─────────────────────────────────────────────────────────────
async function openGalleryModal(entityType,entityId,entityName){
  const key=_imgKey(entityType,entityId);
  if(!_imgState[key]){
    const m=document.getElementById('gallery-modal');
    if(m){m.style.display='flex';m.innerHTML='<div style="background:#1e2d47;border-radius:16px;padding:40px;color:#94a3b8;font-size:14px">⏳ Carregando imagens...</div>';}
    await _loadImages(entityType,entityId);
  }
  const imgs=(_imgState[key]||[]).filter(i=>!i._del);
  const rep=imgs.find(i=>i.is_representative==1||i.is_representative===true);
  const gallery=imgs.filter(i=>!(i.is_representative==1||i.is_representative===true));
  let galleryModal=document.getElementById('gallery-modal');
  if(!galleryModal){galleryModal=document.createElement('div');galleryModal.id='gallery-modal';galleryModal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9000;align-items:center;justify-content:center;padding:20px';document.body.appendChild(galleryModal);}
  if(!imgs.length){galleryModal.style.display='flex';galleryModal.innerHTML=`<div style="background:#1e2d47;border-radius:16px;padding:32px;max-width:400px;text-align:center"><div style="font-size:40px;margin-bottom:12px">🖼️</div><div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#e2e8f0">Sem imagens</div><div style="font-size:13px;color:#94a3b8;margin-bottom:20px">Nenhuma imagem cadastrada para este item.</div><button onclick="document.getElementById('gallery-modal').style.display='none'" style="padding:10px 24px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700">Fechar</button></div>`;return;}
  const title=entityName||'Galeria de Imagens';
  const repHtml=rep?`<div style="margin-bottom:24px"><div style="font-size:11px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">📌 Imagem Representativa</div><div style="text-align:center"><img src="${rep.image_data}" style="max-width:100%;max-height:280px;border-radius:12px;object-fit:contain;box-shadow:0 8px 32px #0006" onclick="openImgLightbox(this.src)"><div style="margin-top:8px;font-size:12px;color:#94a3b8">${escHtml(rep.title||'')}${rep.obs?'<br><em>'+escHtml(rep.obs)+'</em>':''}</div></div></div>`:'';
  const galHtml=gallery.length?`<div><div style="font-size:11px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🖼️ Galeria (${gallery.length})</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(140px,100%),1fr));gap:10px">${gallery.slice(0,24).map(g=>`<div style="border-radius:10px;overflow:hidden;background:#0f1f3d;cursor:pointer" onclick="openImgLightbox('${g.image_data.replace(/'/g,"\\'")}')"><img src="${g.image_data}" style="width:100%;height:100px;object-fit:contain;display:block;background:transparent"><div style="padding:6px 8px;font-size:10px;color:#94a3b8">${escHtml(g.title||'')}${g.obs?'<div style="color:#64748b;font-style:italic">'+escHtml(g.obs)+'</div>':''}</div></div>`).join('')}</div>${gallery.length>24?`<div style="text-align:center;margin-top:12px;font-size:12px;color:#64748b">+${gallery.length-24} mais</div>`:''}</div>`:'';
  galleryModal.style.display='flex';
  galleryModal.innerHTML=`<div style="background:#0f1f3d;border:1px solid #1e3a5f;border-radius:20px;max-width:720px;width:100%;max-height:90vh;overflow-y:auto;padding:28px;position:relative"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div style="font-size:18px;font-weight:800;color:#e2e8f0">🖼️ ${escHtml(title)}</div><button onclick="document.getElementById('gallery-modal').style.display='none'" style="background:none;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1">×</button></div>${repHtml}${galHtml}</div>`;
  galleryModal.addEventListener('click',function(e){if(e.target===galleryModal)galleryModal.style.display='none';},{once:true});
}

function openImgLightbox(src){
  let lb=document.getElementById('img-lightbox');
  if(!lb){lb=document.createElement('div');lb.id='img-lightbox';lb.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out';lb.innerHTML='<img id="lb-img" style="max-width:95vw;max-height:95vh;border-radius:8px;object-fit:contain">';lb.addEventListener('click',()=>lb.style.display='none');document.body.appendChild(lb);}
  document.getElementById('lb-img').src=src;
  lb.style.display='flex';
}

// Miniatura no card do dashboard — chamada ao renderizar
function _secThumbHtml(sec){if(!sec.cover_thumb)return'';return`<img src="${sec.cover_thumb}" alt="" style="max-width:100%;max-height:100px;object-fit:contain;border-radius:8px;margin-bottom:10px;display:block" onclick="event.stopPropagation();openGalleryModal('activity',${sec.id},'${escHtml(sec.name||'')}')">`;}    

</script>

</body>
</html>
