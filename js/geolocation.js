import {isRefillGroup,recordRefillStatus,refillMarkerHtml,REFILL_STATES} from './pipa-refill.js?v=3';
import {parseGoogleLocation,shortLinkIn,googleMapsPickUrl} from './google-location.js?v=1';
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
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||(latitude===0&&longitude===0))return null; // 0,0 = sem localização (registro antigo vazio)
 return {...value,latitude,longitude,maps_url:mapsUrl(latitude,longitude)};
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

// Lê as coordenadas GPS gravadas pela câmera dentro da foto (EXIF de arquivos JPEG).
// Retorna null quando a foto não tem localização (muitos aparelhos removem esse dado ao compartilhar).
export async function readPhotoLocation(file){
 try{
  if(!file||!/jpe?g$/i.test(String(file.type||file.name||'')))return null;
  const view=new DataView(await file.slice(0,262144).arrayBuffer());
  if(view.byteLength<4||view.getUint16(0)!==0xFFD8)return null;
  let offset=2;
  while(offset+4<=view.byteLength){
   const marker=view.getUint16(offset),size=view.getUint16(offset+2);
   if(marker===0xFFE1&&view.getUint32(offset+4)===0x45786966)return parseExifGps(view,offset+10);
   if((marker&0xFF00)!==0xFF00||size<2)return null;
   offset+=2+size;
  }
 }catch(_){}
 return null;
}
function parseExifGps(view,tiff){
 const little=view.getUint16(tiff)===0x4949,u16=o=>view.getUint16(o,little),u32=o=>view.getUint32(o,little);
 const entries=dir=>{const list=[];const count=u16(dir);for(let i=0;i<count;i+=1){const e=dir+2+i*12;list.push({tag:u16(e),type:u16(e+2),count:u32(e+4),value:e+8});}return list;};
 const gpsEntry=entries(tiff+u32(tiff+4)).find(entry=>entry.tag===0x8825);if(!gpsEntry)return null;
 const gps=new Map(entries(tiff+u32(gpsEntry.value)).map(entry=>[entry.tag,entry]));
 const ref=tag=>{const e=gps.get(tag);return e?String.fromCharCode(view.getUint8(e.value)):'';};
 const coord=tag=>{const e=gps.get(tag);if(!e||e.type!==5||e.count<3)return NaN;const at=tiff+u32(e.value);const part=i=>{const d=u32(at+i*8+4);return d?u32(at+i*8)/d:0;};return part(0)+part(1)/60+part(2)/3600;};
 let latitude=coord(2),longitude=coord(4);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||(latitude===0&&longitude===0))return null;
 if(ref(1)==='S')latitude=-latitude;if(ref(3)==='W')longitude=-longitude;
 latitude=Number(latitude.toFixed(7));longitude=Number(longitude.toFixed(7));
 if(Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
 return {latitude,longitude,accuracy:0,captured_at:new Date().toISOString(),maps_url:mapsUrl(latitude,longitude),source:'exif'};
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
 overlay.innerHTML=`<div class="geo-picker-dialog"><header><div><span>LOCALIZAÇÃO DO LANÇAMENTO</span><h2 id="geo-picker-title">Escolha o ponto exato</h2><p>Use o GPS, pesquise, toque no mapa — ou marque no Google Maps e cole aqui.</p></div><button type="button" class="geo-picker-close" onclick="closeLocationPicker()" aria-label="Fechar">×</button></header><div class="geo-picker-methods"><button type="button" onclick="useGpsInLocationPicker()">⌖ Usar GPS deste aparelho</button><form onsubmit="event.preventDefault();searchLocationPicker()"><label for="geo-picker-query">Buscar lugar, endereço ou colar do Google Maps</label><div><input id="geo-picker-query" autocomplete="off" placeholder="Ex.: Praça João Pereira, Sertânia" onpaste="setTimeout(()=>searchLocationPicker(),30)"><button type="submit">Buscar</button><button type="button" class="geo-picker-google" onclick="openGoogleMapsPicker('picker',document.getElementById('geo-picker-query').value.trim())" title="Pesquisar no Google Maps"><span class="g-mark" aria-hidden="true">G</span> Google</button></div></form></div><div id="geo-picker-results" class="geo-picker-results" aria-live="polite"></div><div id="geo-picker-map" class="geo-picker-map"></div><div class="geo-picker-foot"><div id="geo-picker-status"><strong>Nenhum ponto selecionado</strong><small>Toque no mapa, arraste o marcador, use o GPS ou faça uma busca.</small></div><div><button type="button" class="geo-picker-cancel" onclick="closeLocationPicker()">Cancelar</button><button type="button" id="geo-picker-confirm" onclick="confirmLocationPicker()" disabled>Usar esta localização</button></div></div><small class="geo-picker-credit">Mapa rápido e busca por OpenStreetMap. Para a busca do Google, toque em “Google”, marque o ponto, copie as coordenadas e volte: o ponto entra sozinho. A busca acontece somente ao apertar “Buscar”. Não informe dados pessoais sensíveis.</small></div>`;
 document.body.append(overlay);locationPickerState={prefix,onConfirm,selected:initial,map:null,marker:null,results:[]};overlay.addEventListener('click',event=>{if(event.target===overlay)window.closeLocationPicker();});initLocationPickerMap();setTimeout(()=>document.getElementById('geo-picker-query')?.focus(),80);
}

window.openManualLocationPicker=prefix=>openLocationPicker({prefix,initial:readLocationEditor(prefix)});
window.closeLocationPicker=()=>{locationPickerState?.map?.remove();locationPickerState=null;document.getElementById('geo-picker-overlay')?.remove();};
window.useGpsInLocationPicker=async()=>{const button=document.querySelector('.geo-picker-methods>button');if(button){button.disabled=true;button.textContent='Localizando…';}try{setPickerPoint(await capturePosition());}catch(error){window.toast?.(error.message,'error',7000);}finally{if(button?.isConnected){button.disabled=false;button.textContent='⌖ Usar GPS deste aparelho';}}};
window.searchLocationPicker=async()=>{const input=document.getElementById('geo-picker-query'),host=document.getElementById('geo-picker-results'),button=input?.parentElement?.querySelector('button');if(!input||!host)return;if(parseGoogleLocation(input.value)||shortLinkIn(input.value)){host.innerHTML='';if(await applyGoogleText('picker',input.value))input.value='';return;}if(button)button.disabled=true;host.innerHTML='<p>Buscando…</p>';try{const rows=await searchPlaces(input.value);if(!locationPickerState)return;locationPickerState.results=rows;host.innerHTML=rows.length?rows.map((row,index)=>`<button type="button" onclick="chooseLocationSearchResult(${index})"><strong>${esc(row.label.split(',')[0])}</strong><small>${esc(row.label)}</small></button>`).join(''):'<p>Nenhum lugar encontrado. Tente incluir cidade e estado.</p>';}catch(error){host.innerHTML=`<p>${esc(error.message)}</p>`;}finally{if(button?.isConnected)button.disabled=false;}};
window.chooseLocationSearchResult=index=>{const result=locationPickerState?.results?.[index];if(!result)return;setPickerPoint(manualLocation(result.latitude,result.longitude,result.label));document.getElementById('geo-picker-results').innerHTML='';};
window.confirmLocationPicker=async()=>{const state=locationPickerState,location=state?.selected,button=document.getElementById('geo-picker-confirm');if(!state||!location)return;if(button){button.disabled=true;button.textContent='Salvando…';}try{if(state.onConfirm)await state.onConfirm(location);else renderEditor(state.prefix,location);document.dispatchEvent(new CustomEvent('geo:changed',{detail:{prefix:state.prefix,location}}));window.closeLocationPicker();window.toast?.('Localização selecionada!','success');}catch(error){window.toast?.(error.message||error,'error',7500);if(button?.isConnected){button.disabled=false;button.textContent='Usar esta localização';}}};

const SOURCE_TITLES={manual:'Localização escolhida no mapa','google-link':'Localização marcada no Google Maps','google-coords':'Localização marcada no Google Maps','google-dms':'Localização marcada no Google Maps','google-pluscode':'Localização marcada no Google Maps',exif:'Localização lida da foto'};
function savedPanelHtml(location,title='Localização salva',prefix=''){
 if(!location)return '<div class="geo-empty">Nenhuma localização vinculada a este lançamento.</div>';
 const url=mapsUrl(location.latitude,location.longitude),coords=`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
 return `<div class="geo-saved"><span>✓</span><div><strong>${esc(title)}</strong><small><b class="geo-coords">${coords}</b>${location.accuracy?` · precisão aproximada ${location.accuracy} m`:''}</small></div><a href="${esc(url)}" target="_blank" rel="noopener" title="Abrir este ponto no Google Maps">Google Maps</a><button type="button" onclick="copyGeoCoordinates('${coords}')" title="Copiar coordenadas">Copiar</button><button type="button" onclick="shareGeoLocation('${esc(url)}','Localização do lançamento')">Compartilhar</button>${prefix?`<button type="button" class="geo-remove" onclick="clearGeoLocation('${esc(prefix)}')" title="Apagar esta localização (para marcar a certa depois)">🗑 Apagar</button>`:''}</div>`;
}
function renderEditor(prefix,location){
 const lat=document.getElementById(prefix+'-lat'),lng=document.getElementById(prefix+'-lng'),accuracy=document.getElementById(prefix+'-accuracy'),captured=document.getElementById(prefix+'-captured'),source=document.getElementById(prefix+'-source');
 if(lat)lat.value=location?.latitude??'';if(lng)lng.value=location?.longitude??'';if(accuracy)accuracy.value=location?.accuracy??'';if(captured)captured.value=location?.captured_at??'';if(source)source.value=location?.source||'';
 const host=document.getElementById(prefix+'-panel');if(!host)return;
 host.innerHTML=savedPanelHtml(location,location?(SOURCE_TITLES[location.source]||'Localização capturada pelo GPS'):undefined,prefix);
 host.querySelector('.geo-saved')?.classList.add('geo-saved-fresh');
}
// Aplica uma nova localização no editor e avisa quem estiver ouvindo (ex.: Registro de Campo).
function applyEditorLocation(prefix,location){
 renderEditor(prefix,location);
 document.dispatchEvent(new CustomEvent('geo:changed',{detail:{prefix,location}}));
}

// ── Google Maps: marcar o ponto lá e trazer de volta sozinho ──
// Sem chave paga do Google não é possível embutir o mapa do Google com clique; por isso o
// sistema abre o Google Maps (site ou aplicativo), e o ponto volta por cópia/compartilhamento:
// coordenadas, link (inclusive maps.app.goo.gl), graus/minutos/segundos ou Plus Code.
let googlePick=null,lastAppliedGoogleText='';
async function resolveGoogleText(text,reference){
 const direct=parseGoogleLocation(text,reference);if(direct)return direct;
 const short=shortLinkIn(text);if(!short)return null;
 if(navigator.onLine===false)throw new Error('Sem internet para abrir o link curto do Google Maps. Copie as coordenadas do ponto.');
 const {supabase}=await import('../supabase_compat.js?v=11');
 const {data,error}=await supabase.functions.invoke('resolve-maps-link',{body:{url:short}});
 if(error){let message='';try{message=(await error.context?.json?.())?.error||'';}catch(_){}throw new Error(message||'Não foi possível ler esse link do Google Maps. Copie as coordenadas do ponto.');}
 return data&&Number.isFinite(Number(data.latitude))?{latitude:Number(data.latitude),longitude:Number(data.longitude),source:'google-link'}:null;
}
function googleLocation(found){return {...manualLocation(found.latitude,found.longitude,'Marcado no Google Maps'),source:found.source||'google-link'};}
function googleTarget(target){return target==='picker'?{picker:true}:{prefix:target};}
async function applyGoogleText(target,text,{silent=false}={}){
 const clean=String(text||'').trim();if(!clean)return false;
 const reference=target==='picker'?(locationPickerState?.selected||null):readLocationEditor(target);
 const status=document.getElementById(target==='picker'?'geo-picker-status':target+'-gguide');
 try{
  if(shortLinkIn(clean)&&status)status.innerHTML='<strong>Lendo o link do Google Maps…</strong><small>Um instante.</small>';
  const found=await resolveGoogleText(clean,reference?[reference.latitude,reference.longitude]:undefined);
  if(!found){if(!silent)window.toast?.('Não encontrei coordenadas. No Google Maps, toque e segure o ponto e copie as coordenadas (ou use Compartilhar → Copiar link).','error',9000);return false;}
  const location=googleLocation(found);lastAppliedGoogleText=clean;googlePick=null;
  if(googleTarget(target).picker)setPickerPoint(location);
  else{applyEditorLocation(target,location);const input=document.getElementById(target+'-gpaste');if(input)input.value='';hideGoogleGuide(target);}
  window.toast?.('📍 Localização do Google Maps salva: '+location.latitude.toFixed(6)+', '+location.longitude.toFixed(6),'success',5000);
  return true;
 }catch(error){if(!silent)window.toast?.(error.message||String(error),'error',9000);return false;}
}
function showGoogleGuide(prefix){
 const host=document.getElementById(prefix+'-gguide');if(!host)return;host.hidden=false;
 host.innerHTML='<strong>No Google Maps, marque o ponto:</strong><ol><li>Pesquise o lugar ou <b>toque e segure</b> no ponto exato (aparece um alfinete vermelho).</li><li>Toque nas <b>coordenadas</b> para copiar — ou em <b>Compartilhar → Copiar link</b>.</li><li>Volte para esta tela: a localização é salva sozinha. Se não for, toque em <b>Colar</b>.</li></ol>';
}
function hideGoogleGuide(prefix){const host=document.getElementById(prefix+'-gguide');if(host){host.hidden=true;host.innerHTML='';}}
async function readClipboardInto(target,{silent=true}={}){
 if(!navigator.clipboard?.readText){if(!silent)window.toast?.('Cole o link ou as coordenadas no campo (segure o dedo no campo → Colar).','info',7000);return false;}
 try{const text=await navigator.clipboard.readText();if(!text||text.trim()===lastAppliedGoogleText)return false;return await applyGoogleText(target,text,{silent});}
 catch(_){if(!silent)window.toast?.('O navegador não liberou a área de transferência. Cole no campo (segure o dedo → Colar).','info',7000);return false;}
}
function onReturnFromGoogle(){
 if(!googlePick||document.visibilityState==='hidden')return;
 if(Date.now()-googlePick.at>30*60*1000){googlePick=null;return;}
 const target=googlePick.target;setTimeout(()=>readClipboardInto(target,{silent:true}).then(ok=>{if(!ok&&target!=='picker')document.getElementById(target+'-gpaste')?.focus();}),350);
}
if(!globalThis.__googlePickBound&&typeof document.addEventListener==='function'&&typeof window.addEventListener==='function'){globalThis.__googlePickBound=true;document.addEventListener('visibilitychange',onReturnFromGoogle);window.addEventListener('focus',onReturnFromGoogle);}
window.openGoogleMapsPicker=(target,query='')=>{
 const current=target==='picker'?locationPickerState?.selected:readLocationEditor(target);
 const url=query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:googleMapsPickUrl(current);
 googlePick={target,at:Date.now()};if(target!=='picker')showGoogleGuide(target);
 window.open(url,'_blank','noopener');
};
window.pasteGoogleLocation=async target=>{const input=document.getElementById(target+'-gpaste');if(input?.value.trim())return applyGoogleText(target,input.value);const ok=await readClipboardInto(target,{silent:false});if(!ok)input?.focus();return ok;};
window.googlePasteChanged=(target,input)=>{clearTimeout(input.__gt);input.__gt=setTimeout(()=>{if(input.value.trim())applyGoogleText(target,input.value,{silent:!/https?:|[°+]|-?\d+\.\d+\s*,/.test(input.value)});},450);};
window.copyGeoCoordinates=async coords=>{try{await navigator.clipboard.writeText(coords);window.toast?.('Coordenadas copiadas: '+coords,'success');}catch(_){window.prompt?.('Copie as coordenadas:',coords);}};
export function googlePasteHtml(prefix){
 return `<div class="geo-google-paste"><label for="${prefix}-gpaste">Marcou no Google Maps? Cole aqui o link ou as coordenadas</label><div><input id="${prefix}-gpaste" type="text" autocomplete="off" placeholder="Ex.: -8.071234, -37.263456 ou link maps.app.goo.gl" onpaste="setTimeout(()=>pasteGoogleLocation('${prefix}'),30)" oninput="googlePasteChanged('${prefix}',this)"><button type="button" onclick="pasteGoogleLocation('${prefix}')">Colar</button></div></div><div class="geo-google-guide" id="${prefix}-gguide" hidden></div>`;
}
window.setLocationEditorValue=renderEditor;
// Apaga a localização do editor. Só vale de verdade ao salvar o lançamento — dá para desfazer.
window.clearGeoLocation=prefix=>{
 const previous=readLocationEditor(prefix);if(!previous)return;
 applyEditorLocation(prefix,null);
 const host=document.getElementById(prefix+'-panel');
 if(host){host.innerHTML='<div class="geo-empty geo-removed"><span>Localização apagada. Ela some do lançamento ao <b>salvar</b>. Marque a certa com o GPS, o Google Maps ou o mapa rápido.</span><button type="button" class="geo-undo">↩ Desfazer</button></div>';
  host.querySelector('.geo-undo').onclick=()=>{applyEditorLocation(prefix,previous);window.toast?.('Localização restaurada.','success');};}
 window.toast?.('Localização apagada. Salve o lançamento para confirmar.','info',5000);
};

export function locationEditorHtml(record,prefix='it-geo'){
 const location=locationOf(record);
 return `<section class="geo-editor"><div class="geo-editor-head"><div><strong>📍 Geolocalização</strong><small>Use o GPS, marque o ponto no Google Maps ou escolha no mapa rápido.</small></div><div class="geo-editor-actions"><button type="button" onclick="captureLocationInto('${prefix}')">⌖ Usar GPS</button><button type="button" class="google" onclick="openGoogleMapsPicker('${prefix}')"><span class="g-mark" aria-hidden="true">G</span> Marcar no Google Maps</button><button type="button" class="manual" onclick="openManualLocationPicker('${prefix}')">🗺 Mapa rápido</button></div></div>${googlePasteHtml(prefix)}<input type="hidden" id="${prefix}-lat" value="${location?.latitude??''}"><input type="hidden" id="${prefix}-lng" value="${location?.longitude??''}"><input type="hidden" id="${prefix}-accuracy" value="${location?.accuracy??''}"><input type="hidden" id="${prefix}-captured" value="${esc(location?.captured_at||'')}"><input type="hidden" id="${prefix}-source" value="${esc(location?.source||'')}"><div id="${prefix}-panel">${savedPanelHtml(location,undefined,prefix)}</div></section>`;
}

export function readLocationEditor(prefix='it-geo'){
 const latitudeValue=document.getElementById(prefix+'-lat')?.value,longitudeValue=document.getElementById(prefix+'-lng')?.value;
 if(latitudeValue==null||longitudeValue==null||latitudeValue===''||longitudeValue==='')return null;
 const latitude=Number(latitudeValue),longitude=Number(longitudeValue);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||(latitude===0&&longitude===0))return null;
 const source=document.getElementById(prefix+'-source')?.value||undefined;
 return {latitude,longitude,...(source?{source}:{}),accuracy:Number(document.getElementById(prefix+'-accuracy')?.value)||0,captured_at:document.getElementById(prefix+'-captured')?.value||new Date().toISOString(),maps_url:mapsUrl(latitude,longitude)};
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

function mapRecords(secretariaId='',groupId=''){
 const groups=(window.S?.secs||[]).filter(group=>window.userCanGroup?.(group,'acesso')&&(secretariaId?group.demanda_secretaria_id===secretariaId:true)&&(groupId?String(group.id)===String(groupId):true));
 const groupById=new Map(groups.map(group=>[group.id,group]));
 const itemById=new Map((window.S?.items||[]).map(item=>[item.id,item]));
 const points=[];
 const subIds=new Set((window.S?.subitems||[]).map(sub=>sub.id));
 for(const record of [...(window.S?.items||[]),...(window.S?.subitems||[])]){
  const group=groupById.get(record.atividade_id||itemById.get(record.item_id)?.atividade_id);if(!group)continue;
  const location=locationOf(record);if(!location)continue;
  const secretary=window.S?.secretarias?.find(item=>item.id===group.demanda_secretaria_id);
  const table=subIds.has(record.id)&&!itemById.has(record.id)?'subitems':'items';
  points.push({record,group,secretary,location,table,parent:table==='subitems'?itemById.get(record.item_id):null,refill:isRefillGroup(group)?recordRefillStatus(record):null});
 }
 for(const record of window.S?.galeria||[]){
  const group=groupById.get(record.atividade_id);if(!group)continue;const location=locationOf(record);if(!location)continue;
  const secretary=window.S?.secretarias?.find(item=>item.id===group.demanda_secretaria_id);points.push({record:{...record,description:record.titulo||'Foto de campo'},group,secretary,location,table:'galeria'});
 }
 return points;
}

const REFILL_FILTERS=[['todos','Todos'],['vencido','Vencidos'],['alerta','Vencem em até 5 dias'],['em-dia','Em dia'],['sem-dados','Sem data']];
function refillFilterMatch(point,filter){return filter==='todos'||(point.refill&&point.refill.state===filter);}
function refillPopupLine(point){return point.refill?`<em class="geo-popup-refill is-${point.refill.state}">💧 ${esc(point.refill.detail||point.refill.text)}</em>`:'';}

// Ações de um ponto: nome clicável (abre o lançamento), ver no grupo, como chegar, centralizar.
const keyOf=point=>point.table+':'+point.record.id;
const jsArg=value=>esc(String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'"));
const directionsUrl=location=>`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
function pointTitleHtml(point,tag='strong'){
 const name=esc(point.record.description||point.record.name||'Lançamento');
 if(point.table==='galeria')return `<${tag}>${name}</${tag}>`;
 return `<button type="button" class="geo-record-link" onclick="geoOpenRecord('${point.table}','${jsArg(point.record.id)}')" title="Abrir este lançamento">${name}<i aria-hidden="true">↗</i></button>`;
}
function pointContextHtml(point){
 const parent=point.parent?`<span class="geo-parent">↳ dentro de <b>${esc(point.parent.description||'item')}</b></span>`:'';
 return `<span>${esc(point.group.name||'Grupo')}${point.secretary?' · '+esc(point.secretary.name):''}</span>${parent}`;
}
const focusButton=point=>`<button type="button" class="geo-goto" onclick="geoFocusRecord('${point.table}','${jsArg(point.record.id)}')" title="Abrir o grupo com todos os lançamentos, já neste">📋 Ver no grupo</button>`;
let mapReturn=null;
function renderMapPage({secretariaId='',groupId='',title='Mapa geral de demandas',back='',filter='todos',focus=''}={}){
 mapReturn={secretariaId,groupId,title,back,filter};
 document.getElementById('geo-back-pill')?.remove();
 const points=mapRecords(secretariaId,groupId),id='geo-map-'+Date.now();
 const refillPoints=points.filter(point=>point.refill);
 const counts=Object.fromEntries(REFILL_FILTERS.map(([key])=>[key,key==='todos'?points.length:refillPoints.filter(point=>point.refill.state===key).length]));
 let current=REFILL_FILTERS.some(([key])=>key===filter)?filter:'todos';
 const filters=refillPoints.length?`<div class="geo-refill-filters" role="group" aria-label="Filtrar pela situação do abastecimento de pipa">${REFILL_FILTERS.map(([key,label])=>`<button type="button" class="geo-refill-filter is-${key}${key===current?' active':''}" data-refill-filter="${key}" aria-pressed="${key===current}"><i aria-hidden="true"></i>${esc(label)}<b>${counts[key]}</b></button>`).join('')}</div>`:'';
 const listHtml=list=>list.map((point,index)=>{const {record,location,refill}=point;return `<article class="${refill?'has-refill is-'+refill.state:''}" data-geo-key="${esc(keyOf(point))}"><button type="button" class="geo-num" onclick="geoFlyTo('${jsArg(keyOf(point))}')" title="Mostrar no mapa">${String(index+1).padStart(2,'0')}</button><div>${pointTitleHtml(point)}${pointContextHtml(point)}${refill?`<em class="geo-list-refill is-${refill.state}">💧 ${esc(refill.detail||refill.text)}</em>`:''}</div><div class="geo-list-actions">${point.table==='galeria'?'':focusButton(point)}<button type="button" onclick="geoFlyTo('${jsArg(keyOf(point))}')">📍 No mapa</button><a href="${esc(location.maps_url)}" target="_blank" rel="noopener">Abrir mapa</a><a href="${esc(directionsUrl(location))}" target="_blank" rel="noopener" title="Rota até o local no Google Maps">🧭 Como chegar</a><button type="button" onclick="shareGeoLocation('${esc(location.maps_url)}','${jsArg(record.description||'Localização da demanda')}')">Compartilhar</button></div></article>`;}).join('');
 const visible=()=>points.filter(point=>refillFilterMatch(point,current));
 document.getElementById('content').innerHTML=`<section class="geo-map-page"><header><div><span class="workspace-kicker">INTELIGÊNCIA DE CAMPO</span><h1>${esc(title)}</h1><p>${points.length} ponto${points.length===1?'':'s'} com localização cadastrada.${refillPoints.length?` ${counts.vencido} vencido${counts.vencido===1?'':'s'} · ${counts.alerta} vence${counts.alerta===1?'':'m'} em até 5 dias.`:''}</p></div>${back?`<button type="button" onclick="${back}">← Voltar</button>`:''}</header>${filters}<div class="geo-map-toolbar"><span><i></i> ${refillPoints.length?'Cores: vermelho vencido · amarelo até 5 dias · verde em dia':'Clique em um ponto para ver e compartilhar'}</span><button type="button" onclick="fitGeoMap()">Enquadrar pontos</button></div><div id="${id}" class="geo-map-canvas"></div>${points.length?'':`<div class="geo-map-empty"><span>⌖</span><strong>Nenhuma localização cadastrada aqui ainda</strong><p>Use “Capturar geolocalização” ao criar ou editar um lançamento.</p></div>`}<div class="geo-map-list" id="${id}-list">${listHtml(visible())}</div></section>`;
 let map=null,layer=null,bounds=[];const markers=new Map();
 const draw=()=>{
  if(!map)return;layer.clearLayers();bounds=[];markers.clear();
  const popupWidth=Math.max(200,Math.min(290,(document.getElementById(id)?.clientWidth||400)-70));
  visible().forEach(point=>{
   const {record,group,secretary,location,refill}=point;const latlng=[location.latitude,location.longitude];bounds.push(latlng);
   const options=refill?{icon:window.L.divIcon({className:'pipa-pin-wrap',html:refillMarkerHtml(refill.state),iconSize:[34,44],iconAnchor:[17,42],popupAnchor:[0,-38]}),zIndexOffset:refill.state==='vencido'?900:refill.state==='alerta'?600:0,title:`${record.description||'Lançamento'} · ${(REFILL_STATES[refill.state]||{}).label||''}`}:{};
   const marker=window.L.marker(latlng,options).addTo(layer).bindPopup(`<div class="geo-popup">${pointTitleHtml(point)}${pointContextHtml(point)}${refillPopupLine(point)}<div class="geo-popup-actions">${point.table==='galeria'?'':focusButton(point)}<a href="${esc(location.maps_url)}" target="_blank" rel="noopener">Abrir no Google Maps</a><a class="geo-route" href="${esc(directionsUrl(location))}" target="_blank" rel="noopener">🧭 Como chegar</a><button type="button" class="geo-share" onclick="shareGeoLocation('${esc(location.maps_url)}','${jsArg(record.description||'Localização da demanda')}')">Compartilhar</button></div></div>`,{maxWidth:popupWidth,minWidth:Math.min(220,popupWidth),autoPanPaddingTopLeft:[12,72],autoPanPaddingBottomRight:[12,24]});
   marker.on('popupopen',()=>markListCard(keyOf(point)));
   markers.set(keyOf(point),marker);
  });
  window.fitGeoMap();
 };
 window.fitGeoMap=()=>{if(!map)return;if(bounds.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:16});else map.setView(DEFAULT_MAP_POINT,12);};
 // Card da lista ↔ ponto do mapa: um destaca o outro.
 const markListCard=key=>{document.querySelectorAll('.geo-map-list article.is-current').forEach(card=>card.classList.remove('is-current'));document.querySelector(`.geo-map-list article[data-geo-key="${CSS.escape(key)}"]`)?.classList.add('is-current');};
 window.geoFlyTo=key=>{const marker=markers.get(key);if(!map||!marker)return;document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'center'});map.flyTo(marker.getLatLng(),Math.max(map.getZoom(),17),{duration:.6});setTimeout(()=>marker.openPopup(),650);markListCard(key);};
 document.querySelectorAll('[data-refill-filter]').forEach(button=>button.addEventListener('click',()=>{
  current=button.dataset.refillFilter;
  document.querySelectorAll('[data-refill-filter]').forEach(other=>{const on=other===button;other.classList.toggle('active',on);other.setAttribute('aria-pressed',String(on));});
  const list=document.getElementById(id+'-list');if(list)list.innerHTML=listHtml(visible())||'<p class="geo-refill-empty">Nenhum local nesta situação.</p>';
  draw();
 }));
 const create=()=>{
  const host=document.getElementById(id);if(!host||!window.L)return;
  map=window.L.map(host,{zoomControl:true});window.__geoMap=map;layer=window.L.layerGroup().addTo(map);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
  draw();
  if(focus&&markers.has(focus)){const marker=markers.get(focus);map.setView(marker.getLatLng(),17);setTimeout(()=>{marker.openPopup();document.querySelector(`.geo-map-list article[data-geo-key="${CSS.escape(focus)}"]`)?.scrollIntoView({block:'nearest'});},120);}
 };
 if(window.L)setTimeout(create,0);else setTimeout(create,900);
}

// ── Do mapa para o lançamento ──
function findPointRecord(table,id){
 const list=table==='subitems'?window.S?.subitems:table==='items'?window.S?.items:window.S?.galeria;
 const record=(list||[]).find(item=>String(item.id)===String(id));if(!record)return null;
 const item=table==='subitems'?(window.S?.items||[]).find(entry=>entry.id===record.item_id):record;
 const group=(window.S?.secs||[]).find(entry=>entry.id===(record.atividade_id||item?.atividade_id));
 return {record,item,group};
}
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,30)));
const recordElement=id=>{const value=CSS.escape(String(id));return document.querySelector(`#content [data-sort-id="${value}"],#content [data-audit-id="${value}"],#content [data-lista-id="${value}"],#content #ir-${value}`);};
function showBackToMap(focus){
 if(!mapReturn)return;
 const state={...mapReturn,focus};
 document.getElementById('geo-back-pill')?.remove();
 const pill=document.createElement('div');pill.id='geo-back-pill';pill.className='geo-back-pill';pill.setAttribute('role','status');
 pill.innerHTML='<button type="button" class="geo-back-go">🗺 Voltar ao mapa</button><button type="button" class="geo-back-x" aria-label="Fechar">✕</button>';
 pill.querySelector('.geo-back-go').onclick=()=>{pill.remove();renderMapPage(state);};
 pill.querySelector('.geo-back-x').onclick=()=>pill.remove();
 document.body.appendChild(pill);
}
// Nome do ponto → abre o próprio lançamento (quem não pode editar vai direto para ele no grupo).
window.geoOpenRecord=(table,id)=>{
 const found=findPointRecord(table,id);if(!found?.group){window.toast?.('Lançamento não encontrado. Ele pode ter sido excluído.','error');return;}
 const {record,group}=found;
 const canEdit=window.S?.isAdmin||window.userCanGroup?.(group,'editar');
 if(!canEdit||typeof window.openItemModal!=='function'){window.geoFocusRecord(table,id);return;}
 window.__geoMap?.closePopup();
 if(table==='subitems')window.openItemModal(record.id,group.id,true,record.parent_id||record.item_id);
 else window.openItemModal(record.id,group.id,false,null);
};
// "Ver no grupo" → abre o grupo com todos os lançamentos, rola até este e o destaca.
window.geoFocusRecord=async(table,id)=>{
 const found=findPointRecord(table,id);if(!found?.group){window.toast?.('Lançamento não encontrado. Ele pode ter sido excluído.','error');return;}
 const {record,item,group}=found,focusKey=table+':'+id;
 window.openActivity(group.id);await frame();
 let element=recordElement(record.id);
 if(!element&&item&&(Number(item.concluded)===1||String(item.status||'').toLowerCase()==='concluido')&&window.setActivityLane){window.setActivityLane(group.id,'completed');await frame();element=recordElement(record.id);}
 if(table==='subitems'&&item){const body=document.getElementById('ib-'+item.id);if(body&&body.style.display==='none'){window.togItem?.(item.id);await frame();}element=recordElement(record.id);}
 if(!element){window.toast?.('O lançamento está neste grupo, mas não aparece na visão atual (filtro ou histórico). Abrindo o cadastro.','info',6000);showBackToMap(focusKey);window.geoOpenRecord(table,id);return;}
 document.querySelectorAll('.geo-spotlight').forEach(el=>el.classList.remove('geo-spotlight'));
 element.classList.add('geo-spotlight');element.setAttribute('data-from-map','📍 Você veio do mapa');
 element.scrollIntoView({behavior:'smooth',block:'center'});
 setTimeout(()=>{element.classList.remove('geo-spotlight');element.removeAttribute('data-from-map');},6500);
 showBackToMap(focusKey);
};

window.captureLocationInto=async prefix=>{const button=document.querySelector(`button[onclick="captureLocationInto('${prefix}')"]`);if(button){button.disabled=true;button.textContent='Localizando…';}try{const location=await capturePosition();applyEditorLocation(prefix,location);window.toast?.('Localização capturada!','success');}catch(error){window.toast?.(error.message,'error',7500);}finally{if(button?.isConnected){button.disabled=false;button.textContent='⌖ Atualizar localização';}}};
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
// Link #mapa/<tabela>/<id>: mapa geral já no ponto, com o quadro aberto.
window.openGeoMapFocus=(table,id)=>{window.rememberWorkspace?.({kind:'view',id:'map'},true);renderMapPage({focus:table+':'+id});};
window.openGroupGeoMap=(groupId,filter='todos')=>{const group=window.S?.secs?.find(item=>String(item.id)===String(groupId));renderMapPage({groupId,filter,title:`Mapa · ${group?.name||'Grupo'}`,back:`openActivity('${String(groupId).replace(/'/g,"\\'")}')`});};
window.openSecretaryGeoMap=secretariaId=>{const secretary=window.S?.secretarias?.find(item=>item.id===secretariaId);renderMapPage({secretariaId,title:`Mapa · ${secretary?.name||'Secretaria'}`,back:`openDemandSecretaria('${String(secretariaId).replace(/'/g,"\\'")}')`});};
