const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const supportedTables=new Set(['atividades','items','subitems']);
const collectionFor={atividades:'secretariats',items:'items',subitems:'subitems'};

function extraOf(record){
 try{return typeof record?.extra_fields==='string'?JSON.parse(record.extra_fields):record?.extra_fields||{};}catch{return {};}
}

function groupOf(record,table){
 if(table==='atividades')return record;
 let groupId=record?.atividade_id;
 if(!groupId&&table==='subitems'){
  const parentItem=(window.S?.items||[]).find(item=>item.id===record?.item_id);
  groupId=parentItem?.atividade_id;
 }
 return (window.S?.secs||[]).find(group=>String(group.id)===String(groupId));
}

export function externalGeolocationEnabled(record,table){
 const extra=extraOf(record);
 if(table==='atividades')return extra.show_group_external_geolocation===true;
 if(table!=='items'&&table!=='subitems')return false;
 if(typeof extra.show_external_geolocation==='boolean')return extra.show_external_geolocation;
 return extraOf(groupOf(record,table)).default_external_geolocation===true;
}

export function groupExternalGeolocationDefault(group){
 return extraOf(group).default_external_geolocation===true;
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

const DEFAULT_MAP_POINT=[-8.073,-37.264];
let locationPickerState=null,lastPlaceSearch=0;

function manualLocation(latitude,longitude,label='Ponto escolhido no mapa'){
 const lat=Number(latitude),lng=Number(longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180)throw new Error('Coordenadas inválidas.');
 return {latitude:Number(lat.toFixed(7)),longitude:Number(lng.toFixed(7)),accuracy:0,captured_at:new Date().toISOString(),maps_url:mapsUrl(lat,lng),source:'manual',label};
}

export async function searchPlaces(query,fetcher=fetch){
 const clean=String(query||'').trim();if(clean.length<3)throw new Error('Digite pelo menos 3 caracteres para buscar.');
 const elapsed=Date.now()-lastPlaceSearch;if(elapsed<1000)await new Promise(resolve=>setTimeout(resolve,1000-elapsed));lastPlaceSearch=Date.now();
 const url=new URL('https://nominatim.openstreetmap.org/search');url.searchParams.set('format','jsonv2');url.searchParams.set('limit','5');url.searchParams.set('countrycodes','br');url.searchParams.set('accept-language','pt-BR');url.searchParams.set('q',clean);
 const response=await fetcher(url.toString(),{headers:{Accept:'application/json'}});if(!response.ok)throw new Error('A busca de lugares está indisponível agora.');
 const rows=await response.json();return rows.map(row=>({latitude:Number(row.lat),longitude:Number(row.lon),label:String(row.display_name||clean)})).filter(row=>Number.isFinite(row.latitude)&&Number.isFinite(row.longitude));
}

function setPickerPoint(location,{pan=true}={}){
 if(!locationPickerState)return;locationPickerState.selected=location;
 const point=[location.latitude,location.longitude];
 if(locationPickerState.marker)locationPickerState.marker.setLatLng(point);else if(locationPickerState.map)locationPickerState.marker=window.L.marker(point,{draggable:true}).addTo(locationPickerState.map).on('dragend',event=>setPickerPoint(manualLocation(event.target.getLatLng().lat,event.target.getLatLng().lng)));
 if(pan&&locationPickerState.map)locationPickerState.map.setView(point,Math.max(locationPickerState.map.getZoom(),16));
 const status=document.getElementById('geo-picker-status');if(status)status.innerHTML=`<strong>Ponto selecionado</strong><small>${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}${location.label?` · ${esc(location.label)}`:''}</small>`;
 const confirm=document.getElementById('geo-picker-confirm');if(confirm)confirm.disabled=false;
}

async function initLocationPickerMap(){
 for(let tries=0;tries<20&&!window.L;tries+=1)await new Promise(resolve=>setTimeout(resolve,100));
 const host=document.getElementById('geo-picker-map');if(!host||!locationPickerState)return;
 if(!window.L){host.innerHTML='<div class="geo-picker-map-error">O mapa não carregou. Verifique a internet e tente novamente.</div>';return;}
 const initial=locationPickerState.selected,center=initial?[initial.latitude,initial.longitude]:DEFAULT_MAP_POINT;
 const map=window.L.map(host,{zoomControl:true}).setView(center,initial?16:13);locationPickerState.map=map;
 window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
 map.on('click',event=>setPickerPoint(manualLocation(event.latlng.lat,event.latlng.lng)));
 if(initial)setPickerPoint(initial,{pan:false});setTimeout(()=>map.invalidateSize(),80);
}

function openLocationPicker({prefix='',initial=null,onConfirm=null}={}){
 window.closeLocationPicker?.();
 const overlay=document.createElement('div');overlay.id='geo-picker-overlay';overlay.className='geo-picker-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','geo-picker-title');
 overlay.innerHTML=`<div class="geo-picker-dialog"><header><div><span>LOCALIZAÇÃO DO LANÇAMENTO</span><h2 id="geo-picker-title">Escolha o ponto exato</h2><p>Use o GPS, pesquise um lugar ou toque diretamente no mapa.</p></div><button type="button" class="geo-picker-close" onclick="closeLocationPicker()" aria-label="Fechar">×</button></header><div class="geo-picker-methods"><button type="button" onclick="useGpsInLocationPicker()">⌖ Usar GPS deste aparelho</button><form onsubmit="event.preventDefault();searchLocationPicker()"><label for="geo-picker-query">Buscar lugar ou endereço</label><div><input id="geo-picker-query" autocomplete="off" placeholder="Ex.: Praça João Pereira, Sertânia"><button type="submit">Buscar</button></div></form></div><div id="geo-picker-results" class="geo-picker-results" aria-live="polite"></div><div id="geo-picker-map" class="geo-picker-map"></div><div class="geo-picker-foot"><div id="geo-picker-status"><strong>Nenhum ponto selecionado</strong><small>Toque no mapa, arraste o marcador, use o GPS ou faça uma busca.</small></div><div><button type="button" class="geo-picker-cancel" onclick="closeLocationPicker()">Cancelar</button><button type="button" id="geo-picker-confirm" onclick="confirmLocationPicker()" disabled>Usar esta localização</button></div></div><small class="geo-picker-credit">Busca e mapa por OpenStreetMap. A busca acontece somente ao apertar “Buscar”. Não informe dados pessoais sensíveis.</small></div>`;
 document.body.append(overlay);locationPickerState={prefix,onConfirm,selected:initial,map:null,marker:null,results:[]};overlay.addEventListener('click',event=>{if(event.target===overlay)window.closeLocationPicker();});initLocationPickerMap();setTimeout(()=>document.getElementById('geo-picker-query')?.focus(),80);
}

window.openManualLocationPicker=prefix=>openLocationPicker({prefix,initial:readLocationEditor(prefix)});
window.closeLocationPicker=()=>{locationPickerState?.map?.remove();locationPickerState=null;document.getElementById('geo-picker-overlay')?.remove();};
window.useGpsInLocationPicker=async()=>{const button=document.querySelector('.geo-picker-methods>button');if(button){button.disabled=true;button.textContent='Localizando…';}try{setPickerPoint(await capturePosition());}catch(error){window.toast?.(error.message,'error',7000);}finally{if(button?.isConnected){button.disabled=false;button.textContent='⌖ Usar GPS deste aparelho';}}};
window.searchLocationPicker=async()=>{const input=document.getElementById('geo-picker-query'),host=document.getElementById('geo-picker-results'),button=input?.parentElement?.querySelector('button');if(!input||!host)return;if(button)button.disabled=true;host.innerHTML='<p>Buscando…</p>';try{const rows=await searchPlaces(input.value);if(!locationPickerState)return;locationPickerState.results=rows;host.innerHTML=rows.length?rows.map((row,index)=>`<button type="button" onclick="chooseLocationSearchResult(${index})"><strong>${esc(row.label.split(',')[0])}</strong><small>${esc(row.label)}</small></button>`).join(''):'<p>Nenhum lugar encontrado. Tente incluir cidade e estado.</p>';}catch(error){host.innerHTML=`<p>${esc(error.message)}</p>`;}finally{if(button?.isConnected)button.disabled=false;}};
window.chooseLocationSearchResult=index=>{const result=locationPickerState?.results?.[index];if(!result)return;setPickerPoint(manualLocation(result.latitude,result.longitude,result.label));document.getElementById('geo-picker-results').innerHTML='';};
window.confirmLocationPicker=async()=>{const state=locationPickerState,location=state?.selected,button=document.getElementById('geo-picker-confirm');if(!state||!location)return;if(button){button.disabled=true;button.textContent='Salvando…';}try{if(state.onConfirm)await state.onConfirm(location);else renderEditor(state.prefix,location);document.dispatchEvent(new CustomEvent('geo:changed',{detail:{prefix:state.prefix,location}}));window.closeLocationPicker();window.toast?.('Localização selecionada!','success');}catch(error){window.toast?.(error.message||error,'error',7500);if(button?.isConnected){button.disabled=false;button.textContent='Usar esta localização';}}};

function renderEditor(prefix,location){
 const lat=document.getElementById(prefix+'-lat'),lng=document.getElementById(prefix+'-lng'),accuracy=document.getElementById(prefix+'-accuracy'),captured=document.getElementById(prefix+'-captured');
 if(lat)lat.value=location?.latitude??'';if(lng)lng.value=location?.longitude??'';if(accuracy)accuracy.value=location?.accuracy??'';if(captured)captured.value=location?.captured_at??'';
 const host=document.getElementById(prefix+'-panel');if(!host)return;
 host.innerHTML=location?`<div class="geo-saved"><span>✓</span><div><strong>${location.source==='manual'?'Localização escolhida':'Localização capturada'}</strong><small>${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}${location.accuracy?` · precisão aproximada ${location.accuracy} m`:''}</small></div><a href="${esc(location.maps_url)}" target="_blank" rel="noopener">Google Maps</a><button type="button" onclick="shareGeoLocation('${esc(location.maps_url)}','Localização do lançamento')">Compartilhar</button></div>`:'<div class="geo-empty">Nenhuma localização vinculada a este lançamento.</div>';
}
window.setLocationEditorValue=renderEditor;

export function locationEditorHtml(record,prefix='it-geo'){
 const location=locationOf(record);
 return `<section class="geo-editor"><div class="geo-editor-head"><div><strong>📍 Geolocalização</strong><small>Use o GPS ou escolha manualmente pesquisando e tocando no mapa.</small></div><div class="geo-editor-actions"><button type="button" onclick="captureLocationInto('${prefix}')">⌖ Usar GPS</button><button type="button" class="manual" onclick="openManualLocationPicker('${prefix}')">🗺 Escolher no mapa</button></div></div><input type="hidden" id="${prefix}-lat" value="${location?.latitude??''}"><input type="hidden" id="${prefix}-lng" value="${location?.longitude??''}"><input type="hidden" id="${prefix}-accuracy" value="${location?.accuracy??''}"><input type="hidden" id="${prefix}-captured" value="${esc(location?.captured_at||'')}"><div id="${prefix}-panel">${location?`<div class="geo-saved"><span>✓</span><div><strong>Localização salva</strong><small>${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}${location.accuracy?` · precisão aproximada ${location.accuracy} m`:''}</small></div><a href="${esc(location.maps_url)}" target="_blank" rel="noopener">Google Maps</a><button type="button" onclick="shareGeoLocation('${esc(location.maps_url)}','Localização do lançamento')">Compartilhar</button></div>`:'<div class="geo-empty">Nenhuma localização vinculada a este lançamento.</div>'}</div></section>`;
}

export function readLocationEditor(prefix='it-geo'){
 const latitudeValue=document.getElementById(prefix+'-lat')?.value,longitudeValue=document.getElementById(prefix+'-lng')?.value;
 if(latitudeValue==null||longitudeValue==null||latitudeValue===''||longitudeValue==='')return null;
 const latitude=Number(latitudeValue),longitude=Number(longitudeValue);
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
 if(!supportedTables.has(table)||!externalGeolocationEnabled(record,table))return '';
 const location=locationOf(record),label=esc(record.description||record.name||record.nome||'lançamento');
 return `<div class="geo-quick-actions">${location?`<a href="${esc(location.maps_url)}" target="_blank" rel="noopener" title="Abrir no Google Maps">📍 Mapa</a><button type="button" onclick="event.stopPropagation();shareGeoLocation('${esc(location.maps_url)}','${label}')">↗ Compartilhar</button>`:`<button type="button" class="capture" onclick="event.stopPropagation();captureRecordLocation('${table}','${esc(record.id)}')">⌖ Capturar geolocalização</button>`}</div>`;
};
window.captureRecordLocation=async(table,id)=>{
 if(!supportedTables.has(table))return;
 const entry=[...globalThis.__recordIndex?.values()||[]].find(item=>item.table===table&&String(item.record.id)===String(id));if(!entry)return;
 openLocationPicker({initial:locationOf(entry.record),onConfirm:async location=>{const extra={...extraOf(entry.record),geo_location:location};await window.updateDoc(window.doc(window.db,collectionFor[table],id),{extra_fields:extra,updated_at:window.serverTimestamp()});await window.loadData();window.refreshAuditUI?.();}});
};
window.renderGeneralGeoMap=()=>renderMapPage();
window.openSecretaryGeoMap=secretariaId=>{const secretary=window.S?.secretarias?.find(item=>item.id===secretariaId);renderMapPage({secretariaId,title:`Mapa · ${secretary?.name||'Secretaria'}`,back:`openDemandSecretaria('${String(secretariaId).replace(/'/g,"\\'")}')`});};
