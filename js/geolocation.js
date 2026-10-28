const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const supportedTables=new Set(['atividades','items','subitems','contas']);
const collectionFor={atividades:'secretariats',items:'items',subitems:'subitems',contas:'contas'};

function extraOf(record){
 try{return typeof record?.extra_fields==='string'?JSON.parse(record.extra_fields):record?.extra_fields||{};}catch{return {};}
}

export function locationOf(record){
 const value=extraOf(record).geo_location||record?.geo_location||(record?.latitude!=null&&record?.longitude!=null?{latitude:record.latitude,longitude:record.longitude,accuracy:record.accuracy_meters,captured_at:record.captured_at,maps_url:record.maps_url}:null);
 const latitude=Number(value?.latitude),longitude=Number(value?.longitude);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
 return {...value,latitude,longitude,maps_url:value.maps_url||mapsUrl(latitude,longitude)};
}

export function mapsUrl(latitude,longitude){
 return `https://www.google.com/maps?q=${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
}

export function capturePosition(){
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(new Error('Este aparelho não oferece geolocalização.'));return;}
  navigator.geolocation.getCurrentPosition(position=>{
   const latitude=Number(position.coords.latitude.toFixed(7)),longitude=Number(position.coords.longitude.toFixed(7));
   resolve({latitude,longitude,accuracy:Math.round(position.coords.accuracy||0),captured_at:new Date(position.timestamp||Date.now()).toISOString(),maps_url:mapsUrl(latitude,longitude)});
  },error=>reject(new Error(error.code===1?'Permissão de localização negada. Ative a localização do navegador.':error.code===2?'Não foi possível determinar sua localização.':'A localização demorou demais. Tente novamente em área aberta.')),{enableHighAccuracy:true,timeout:15000,maximumAge:15000});
 });
}

function renderEditor(prefix,location){
 const host=document.getElementById(prefix+'-panel');if(!host)return;
 const lat=document.getElementById(prefix+'-lat'),lng=document.getElementById(prefix+'-lng'),accuracy=document.getElementById(prefix+'-accuracy'),captured=document.getElementById(prefix+'-captured');
 if(lat)lat.value=location?.latitude??'';if(lng)lng.value=location?.longitude??'';if(accuracy)accuracy.value=location?.accuracy??'';if(captured)captured.value=location?.captured_at??'';
 host.innerHTML=location?`<div class="geo-saved"><span>✓</span><div><strong>Localização capturada</strong><small>${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}${location.accuracy?` · precisão aproximada ${location.accuracy} m`:''}</small></div><a href="${esc(location.maps_url)}" target="_blank" rel="noopener">Google Maps</a><button type="button" onclick="shareGeoLocation('${esc(location.maps_url)}','Localização do lançamento')">Compartilhar</button></div>`:'<div class="geo-empty">Nenhuma localização vinculada a este lançamento.</div>';
}

export function locationEditorHtml(record,prefix='it-geo'){
 const location=locationOf(record);
 return `<section class="geo-editor"><div class="geo-editor-head"><div><strong>📍 Geolocalização</strong><small>Salve o ponto exato deste lançamento e compartilhe pelo Google Maps.</small></div><button type="button" onclick="captureLocationInto('${prefix}')">⌖ Capturar geolocalização</button></div><input type="hidden" id="${prefix}-lat" value="${location?.latitude??''}"><input type="hidden" id="${prefix}-lng" value="${location?.longitude??''}"><input type="hidden" id="${prefix}-accuracy" value="${location?.accuracy??''}"><input type="hidden" id="${prefix}-captured" value="${esc(location?.captured_at||'')}"><div id="${prefix}-panel">${location?`<div class="geo-saved"><span>✓</span><div><strong>Localização capturada</strong><small>${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}${location.accuracy?` · precisão aproximada ${location.accuracy} m`:''}</small></div><a href="${esc(location.maps_url)}" target="_blank" rel="noopener">Google Maps</a><button type="button" onclick="shareGeoLocation('${esc(location.maps_url)}','Localização do lançamento')">Compartilhar</button></div>`:'<div class="geo-empty">Nenhuma localização vinculada a este lançamento.</div>'}</div></section>`;
}

export function readLocationEditor(prefix='it-geo'){
 const latitude=Number(document.getElementById(prefix+'-lat')?.value),longitude=Number(document.getElementById(prefix+'-lng')?.value);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
 return {latitude,longitude,accuracy:Number(document.getElementById(prefix+'-accuracy')?.value)||0,captured_at:document.getElementById(prefix+'-captured')?.value||new Date().toISOString(),maps_url:mapsUrl(latitude,longitude)};
}

export async function shareLocation(url,title='Localização'){ 
 if(navigator.share){try{await navigator.share({title,text:title,url});return;}catch(error){if(error.name==='AbortError')return;}}
 try{await navigator.clipboard.writeText(url);window.toast?.('Link do Google Maps copiado!','success');}
 catch{window.open(url,'_blank','noopener');}
}

export async function optimizePhoto(dataUrl,{location=null,stamp=false,maxDimension=1280,maxBytes=360000}={}){
 const image=await new Promise((resolve,reject)=>{const value=new Image();value.onload=()=>resolve(value);value.onerror=()=>reject(new Error('Imagem inválida ou corrompida'));value.src=dataUrl;});
 let scale=Math.min(1,maxDimension/image.naturalWidth,maxDimension/image.naturalHeight),quality=.62,result='';
 for(let pass=0;pass<5;pass+=1){
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  if(stamp&&location){
   const bar=Math.max(54,Math.round(canvas.height*.105)),font=Math.max(16,Math.round(bar*.29));
   const gradient=context.createLinearGradient(0,canvas.height-bar,0,canvas.height);gradient.addColorStop(0,'rgba(4,18,25,.18)');gradient.addColorStop(1,'rgba(4,18,25,.88)');context.fillStyle=gradient;context.fillRect(0,canvas.height-bar,canvas.width,bar);
   context.fillStyle='#fff';context.font=`700 ${font}px system-ui,sans-serif`;context.fillText(`📍 ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,Math.round(font*.7),canvas.height-Math.round(bar*.49));
   context.font=`500 ${Math.max(12,Math.round(font*.72))}px system-ui,sans-serif`;context.fillStyle='#d9f7ef';context.fillText(new Date(location.captured_at||Date.now()).toLocaleString('pt-BR'),Math.round(font*.7),canvas.height-Math.round(bar*.16));
  }
  result=canvas.toDataURL('image/jpeg',quality);
  if(result.length*.75<=maxBytes)break;
  scale*=.82;quality=Math.max(.38,quality-.07);
 }
 return result;
}

function mapRecords(secretariaId=''){
 const groups=(window.S?.secs||[]).filter(group=>window.userCanGroup?.(group,'acesso')&&(secretariaId?group.demanda_secretaria_id===secretariaId:true));
 const groupById=new Map(groups.map(group=>[group.id,group]));
 const itemById=new Map((window.S?.items||[]).map(item=>[item.id,item]));
 const points=[];
 for(const record of [...(window.S?.items||[]),...(window.S?.subitems||[])]){
  const group=groupById.get(record.atividade_id||itemById.get(record.item_id)?.atividade_id);if(!group)continue;
  const location=locationOf(record);if(!location)continue;
  const secretary=window.S?.secretarias?.find(item=>item.id===group.demanda_secretaria_id);
  points.push({record,group,secretary,location});
 }
 for(const record of window.S?.galeria||[]){
  const group=groupById.get(record.atividade_id);if(!group)continue;const location=locationOf(record);if(!location)continue;
  const secretary=window.S?.secretarias?.find(item=>item.id===group.demanda_secretaria_id);points.push({record:{...record,description:record.titulo||'Foto de campo'},group,secretary,location});
 }
 return points;
}

function renderMapPage({secretariaId='',title='Mapa geral de demandas',back='' }={}){
 const points=mapRecords(secretariaId),id='geo-map-'+Date.now();
 document.getElementById('content').innerHTML=`<section class="geo-map-page"><header><div><span class="workspace-kicker">INTELIGÊNCIA DE CAMPO</span><h1>${esc(title)}</h1><p>${points.length} ponto${points.length===1?'':'s'} com localização cadastrada.</p></div>${back?`<button type="button" onclick="${back}">← Voltar às demandas</button>`:''}</header><div class="geo-map-toolbar"><span><i></i> Clique em um ponto para ver e compartilhar</span><button type="button" onclick="fitGeoMap()">Enquadrar todos os pontos</button></div><div id="${id}" class="geo-map-canvas"></div>${points.length?'':`<div class="geo-map-empty"><span>⌖</span><strong>Nenhuma localização cadastrada aqui ainda</strong><p>Use “Capturar geolocalização” ao criar ou editar um lançamento.</p></div>`}<div class="geo-map-list">${points.map(({record,group,secretary,location},index)=>`<article><b>${String(index+1).padStart(2,'0')}</b><div><strong>${esc(record.description||record.name||'Lançamento')}</strong><span>${esc(group.name||'Grupo')}${secretary?' · '+esc(secretary.name):''}</span></div><a href="${esc(location.maps_url)}" target="_blank" rel="noopener">Abrir mapa</a><button type="button" onclick="shareGeoLocation('${esc(location.maps_url)}','${esc(record.description||'Localização da demanda')}')">Compartilhar</button></article>`).join('')}</div></section>`;
 const create=()=>{
  const host=document.getElementById(id);if(!host||!window.L)return;
  const map=window.L.map(host,{zoomControl:true});window.__geoMap=map;
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
  const bounds=[];points.forEach(({record,group,secretary,location})=>{const point=[location.latitude,location.longitude];bounds.push(point);window.L.marker(point).addTo(map).bindPopup(`<div class="geo-popup"><strong>${esc(record.description||'Lançamento')}</strong><span>${esc(group.name||'')}${secretary?' · '+esc(secretary.name):''}</span><a href="${esc(location.maps_url)}" target="_blank" rel="noopener">Abrir no Google Maps</a><button type="button" onclick="shareGeoLocation('${esc(location.maps_url)}','${esc(record.description||'Localização da demanda')}')">Compartilhar</button></div>`);});
  if(bounds.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:16});else map.setView([-8.073,-37.264],12);
  window.fitGeoMap=()=>bounds.length&&map.fitBounds(bounds,{padding:[35,35],maxZoom:16});
 };
 if(window.L)setTimeout(create,0);else setTimeout(create,900);
}

window.captureLocationInto=async prefix=>{const button=document.querySelector(`button[onclick="captureLocationInto('${prefix}')"]`);if(button){button.disabled=true;button.textContent='Localizando…';}try{const location=await capturePosition();renderEditor(prefix,location);window.toast?.('Localização capturada!','success');}catch(error){window.toast?.(error.message,'error',7500);}finally{if(button?.isConnected){button.disabled=false;button.textContent='⌖ Atualizar localização';}}};
window.shareGeoLocation=shareLocation;
window.recordLocation=locationOf;
window.recordLocationActions=(record,table)=>{
 if(!supportedTables.has(table))return '';
 const location=locationOf(record),label=esc(record.description||record.name||record.nome||'lançamento');
 return `<div class="geo-quick-actions">${location?`<a href="${esc(location.maps_url)}" target="_blank" rel="noopener" title="Abrir no Google Maps">📍 Mapa</a><button type="button" onclick="event.stopPropagation();shareGeoLocation('${esc(location.maps_url)}','${label}')">↗ Compartilhar</button>`:`<button type="button" class="capture" onclick="event.stopPropagation();captureRecordLocation('${table}','${esc(record.id)}')">⌖ Capturar geolocalização</button>`}</div>`;
};
window.captureRecordLocation=async(table,id)=>{
 if(!supportedTables.has(table))return;
 const entry=[...globalThis.__recordIndex?.values()||[]].find(item=>item.table===table&&String(item.record.id)===String(id));if(!entry)return;
 try{const location=await capturePosition(),extra={...extraOf(entry.record),geo_location:location};await window.updateDoc(window.doc(window.db,collectionFor[table],id),{extra_fields:extra,updated_at:window.serverTimestamp()});await window.loadData();window.toast('Localização salva!','success');window.refreshAuditUI?.();}catch(error){window.toast(error.message,'error',7500);}
};
window.renderGeneralGeoMap=()=>renderMapPage();
window.openSecretaryGeoMap=secretariaId=>{const secretary=window.S?.secretarias?.find(item=>item.id===secretariaId);renderMapPage({secretariaId,title:`Mapa · ${secretary?.name||'Secretaria'}`,back:`openDemandSecretaria('${String(secretariaId).replace(/'/g,"\\'")}')`});};
