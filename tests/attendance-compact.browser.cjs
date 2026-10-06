// Requer servidor local (porta 8080 por padrão) e Playwright disponível.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const port=process.env.TEST_PORT||'8080';
const testUrl=`http://127.0.0.1:${port}/qa-attendance-compact`;
const head=fs.readFileSync(path.join(root,'index.html'),'utf8').split('</head>')[0].replace(/<script[\s\S]*?<\/script>/g,'');
const fixture=head+`<style>
body{margin:0;background:#eef4f8}#content{padding:16px;max-width:none}main{margin:0!important}.item-row{box-shadow:0 4px 18px #17324a12}
</style></head><body><main><div id="content">
<div class="item-row" data-sort-id="pipa-1" id="ir-pipa-1" style="border-left:4px solid #3b82f6">
 <div class="item-header" onclick="window.headerClicks++">
  <input type="checkbox" onclick="event.stopPropagation()"><span>⣿</span><span>📋</span>
  <div class="item-info"><div class="item-name"><span>1.</span> POVOADO DE CAROLINA</div><div class="item-meta">👤 ANTÔNIO ALMEIDA</div><div class="item-meta">🏛️ AGRICULTURA</div></div>
  <span id="chev-pipa-1">▶</span><button class="card-btn">✏️</button><button class="card-btn">🗑️</button><button class="card-btn">📋</button><button class="card-btn">+ Item</button><button class="card-btn">+ Sub</button>
 </div>
</div></div></main><script type="module">
window.headerClicks=0;window.moves=0;window.isAttendanceRecord=()=>true;window.userCan=()=>true;
window.attendanceBadges=()=>'<div class="attendance-badges"><span class="attendance-urgency vermelho">Urgente</span><span class="attendance-priority-badge">★ Prioritário</span><span class="attendance-requester">Solicitante: EVANDRO</span></div>';
window.openMoveAttendance=()=>window.moves++;
const {initAuditUI,rememberRecords}=await import('/js/autoria.js');
rememberRecords('items',[{id:'pipa-1',created_by_name:'CARLOS EDNAILTON',created_at:'2026-10-06T12:11:00Z',updated_by_name:'CARLOS EDNAILTON',updated_at:'2026-10-06T12:14:00Z'}]);
initAuditUI();window.ready=true;
</script></body></html>`;

(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1536,height:300}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(testUrl,route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.goto(testUrl);await page.waitForFunction(()=>window.ready&&document.querySelector('.attendance-inline-meta'));
 assert.equal(await page.locator('.item-header > .attendance-inline-meta').count(),1);
 assert.equal(await page.locator('.item-row > .record-audit').count(),0);
 const desktopHeight=await page.locator('.item-row').evaluate(element=>element.getBoundingClientRect().height);
 assert.ok(desktopHeight<=75,`card desktop deveria ser compacto, mas mede ${desktopHeight}px`);
 await page.locator('.attendance-move-button').click();assert.equal(await page.evaluate(()=>window.moves),1);assert.equal(await page.evaluate(()=>window.headerClicks),0);
 await page.screenshot({path:'/tmp/attendance-compact-desktop.png'});
 await page.setViewportSize({width:390,height:500});await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'card criou rolagem horizontal no celular');
 assert.ok(await page.locator('.attendance-inline-meta').evaluate(element=>element.getBoundingClientRect().width<=document.querySelector('.item-header').getBoundingClientRect().width));
 await page.screenshot({path:'/tmp/attendance-compact-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log(`PASS browser: card compacto (${desktopHeight}px), botão mover e responsividade`);await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
