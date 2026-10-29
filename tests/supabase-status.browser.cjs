const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const root=path.join(__dirname,'..');
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f1f6fa;font-family:Arial,sans-serif"><main style="padding:24px"><div id="content"></div></main></body></html>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'css/supabase-status.css'),'utf8')});
  let source=fs.readFileSync(path.join(root,'js/supabase-status.js'),'utf8')
    .replace(/^import[^\n]+\n/,'')
    .replace(/export /g,'');
  source=`const supabase={rpc:async()=>({data:{sampled_at:new Date().toISOString(),project_ref:'xwlmpxypjheuhbxyfplo',region:'ca-central-1',plan:'free',database_bytes:89320595,database_limit_bytes:500000000,storage_bytes:4764542,storage_limit_bytes:1000000000,storage_files:2,image_storage_bytes:0,image_storage_files:0,uncached_egress_limit_bytes:5000000000,cached_egress_limit_bytes:5000000000,database_status:'online',storage_status:'online'},error:null})};\n${source}`;
  await page.addScriptTag({content:source});
  await page.evaluate(()=>{window.S={user:{uid:'rcampos',email:'camposweb.personal@gmail.com'},statusAccess:[]};window.__currentView='supabase-status';renderSupabaseStatus();});
  await page.waitForSelector('.supa-metric-card');
  assert.equal(await page.locator('.supa-metric-card').count(),2);
  assert.equal(await page.locator('.supa-service-strip i').count(),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
  await page.screenshot({path:'/tmp/gestao-supabase-status-desktop.png',fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
  const columns=await page.locator('.supa-metrics-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(columns,1);
  await page.screenshot({path:'/tmp/gestao-supabase-status-mobile.png',fullPage:true});
  await browser.close();
  console.log('PASS browser: painel Supabase premium, sem overflow em desktop e celular');
})().catch(error=>{console.error(error);process.exitCode=1;});

