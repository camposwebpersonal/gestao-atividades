import {supabase} from '../supabase_compat.js?v=8';
import {FIELD_GROUP_KEY,isFieldDemandGroup,fieldDemandTitle,cameraInputAttributes} from './camera-capture-core.js?v=1';
import {capturePosition,optimizePhoto} from './geolocation.js?v=3';

export {FIELD_GROUP_KEY,isFieldDemandGroup,cameraInputAttributes};
const MAX_FIELD_PHOTOS=20;
let selectedPhotos=[];
let fieldLocation=null;

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function allowedSecretarias(){
  return (window.S?.secretarias||[])
    .filter(secretaria=>window.S.isAdmin||window.userCanDemandSecretaria?.(secretaria.id,'editar'))
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
}

function allowedGroups(secretaria){
  return (window.S?.secs||[]).filter(group=>String(group.demanda_secretaria_id||'')===String(secretaria||'')&&!isFieldDemandGroup(group)&&(window.S.isAdmin||window.userCanGroup?.(group,'editar'))).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
}

function releasePreviews(){
  selectedPhotos.forEach(entry=>URL.revokeObjectURL(entry.preview));
  selectedPhotos=[];
  fieldLocation=null;
}

function renderFieldPhotos(){
  const host=document.getElementById('field-photo-preview');
  const count=document.getElementById('field-photo-count');
  if(count)count.textContent=`${selectedPhotos.length}/${MAX_FIELD_PHOTOS} foto${selectedPhotos.length===1?'':'s'}`;
  if(!host)return;
  host.innerHTML=selectedPhotos.map((entry,index)=>`<figure class="field-photo-card"><img src="${esc(entry.preview)}" alt="Foto ${index+1} selecionada"><button type="button" onclick="removeFieldPhoto(${index})" aria-label="Remover foto ${index+1}">×</button><figcaption>${esc(entry.file.name||`Foto ${index+1}`)}${entry.location?'<span>📍 Localizada</span>':''}</figcaption></figure>`).join('')||'<p>Nenhuma foto adicionada ainda.</p>';
}

async function addFiles(input,source='gallery'){
  const files=Array.from(input?.files||[]).filter(file=>String(file.type||'').startsWith('image/'));
  input.value='';
  if(!files.length){window.toast('Escolha uma imagem válida.','error');return;}
  const free=MAX_FIELD_PHOTOS-selectedPhotos.length;
  if(free<=0){window.toast(`Limite de ${MAX_FIELD_PHOTOS} fotos por registro.`, 'info');return;}
  let location=null;
  if(source==='camera'){
   try{location=await capturePosition();fieldLocation=location;window.toast('Foto localizada com sucesso!','success',3500);}catch(error){window.toast(error.message+' A foto ainda será adicionada.','info',6500);}
  }
  files.slice(0,free).forEach(file=>selectedPhotos.push({file,preview:URL.createObjectURL(file),location}));
  if(files.length>free)window.toast(`Foram mantidas as primeiras ${MAX_FIELD_PHOTOS} fotos.`, 'info',6000);
  renderFieldPhotos();
}

export function initFieldCapture(){
  window.isFieldDemandGroup=isFieldDemandGroup;
  if(!window.__fieldLocationEventBound){document.addEventListener('geo:changed',event=>{if(event.detail?.prefix!=='field-geo')return;fieldLocation=event.detail.location;selectedPhotos.forEach(photo=>{photo.location=fieldLocation;});const status=document.getElementById('field-location-status');if(status)status.innerHTML=`<strong>✓ Localização escolhida no mapa</strong><small>${fieldLocation.latitude.toFixed(6)}, ${fieldLocation.longitude.toFixed(6)}</small>`;renderFieldPhotos();});window.__fieldLocationEventBound=true;}
  window.openFieldCapture=function(){
    const secretarias=allowedSecretarias();
    if(!secretarias.length){window.toast('Seu usuário não possui secretaria liberada para registrar demandas de campo.','error',7000);return;}
    releasePreviews();
    window.openModal('📷 Registro de Campo','Fotografe, localize e encaminhe sem sair da Visão Geral.',`<form onsubmit="event.preventDefault();saveFieldCapture()">
      <div class="field-capture-intro"><span>1</span><div><strong>Adicione quantas fotos precisar</strong><small>As fotos são reduzidas automaticamente para carregarem rápido.</small></div></div>
      <div class="field-photo-actions"><label class="field-camera-button">📸 Tirar foto<input id="field-camera" type="file" ${cameraInputAttributes()} onchange="addFieldCapturePhotos(this,'camera')"></label><label class="field-gallery-button">🖼️ Escolher da galeria<input id="field-gallery" type="file" accept="image/*" multiple onchange="addFieldCapturePhotos(this,'gallery')"></label><b id="field-photo-count">0/${MAX_FIELD_PHOTOS} fotos</b></div>
      <label class="field-stamp-option"><input id="field-stamp-location" type="checkbox"> Gravar coordenadas e data visíveis na foto</label>
      <div class="field-location-bar"><div id="field-location-status"><strong>📍 Geolocalização</strong><small>Use o GPS ou escolha manualmente no mapa.</small></div><div class="field-location-actions"><button type="button" onclick="captureFieldLocation()">⌖ Usar GPS</button><button type="button" class="manual" onclick="openManualLocationPicker('field-geo')">🗺 Escolher no mapa</button></div></div>
      <input type="hidden" id="field-geo-lat"><input type="hidden" id="field-geo-lng"><input type="hidden" id="field-geo-accuracy"><input type="hidden" id="field-geo-captured"><div id="field-geo-panel"></div>
      <div id="field-photo-preview" class="field-photo-preview"><p>Nenhuma foto adicionada ainda.</p></div>
      <div class="form-grid field-capture-fields"><div class="form-group full"><label for="field-observation">Observação da demanda *</label><textarea id="field-observation" maxlength="4000" rows="5" required placeholder="Descreva o local, o problema, a referência e o que precisa ser feito."></textarea><small>Essa observação acompanhará todas as fotos e ajudará no redirecionamento.</small></div><div class="form-group full"><label for="field-secretaria">Enviar para qual secretaria? *</label><select id="field-secretaria" required onchange="updateFieldCaptureGroups()"><option value="">Selecione a secretaria…</option>${secretarias.map(secretaria=>`<option value="${esc(secretaria.id)}">${esc(secretaria.name)}</option>`).join('')}</select></div><div class="form-group full field-group-target"><label for="field-group">Enviar diretamente para um grupo? <span>Opcional</span></label><select id="field-group" disabled><option value="">Primeiro escolha a secretaria…</option></select><small id="field-group-help">Se não escolher um grupo, a demanda seguirá para “Demandas Gerais de Campo”.</small></div></div>
      <div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button id="field-save" type="submit" class="btn-save">Enviar demanda de campo</button></div></form>`);
    window.bulkModalClosing=releasePreviews;
  };
  window.addFieldCapturePhotos=addFiles;
  window.updateFieldCaptureGroups=function(){const secretaria=document.getElementById('field-secretaria')?.value||'',select=document.getElementById('field-group'),help=document.getElementById('field-group-help');if(!select)return;const groups=allowedGroups(secretaria);select.disabled=!secretaria;select.innerHTML=!secretaria?'<option value="">Primeiro escolha a secretaria…</option>':`<option value="">Demandas Gerais de Campo (triagem automática)</option>${groups.map(group=>`<option value="${esc(group.id)}">${esc(group.name||'Grupo sem nome')}</option>`).join('')}`;if(help)help.textContent=groups.length?'Escolha um grupo específico ou deixe na triagem automática.':'Esta secretaria ainda não possui outros grupos; será usada a triagem automática.';};
  window.captureFieldLocation=async function(){
   const status=document.getElementById('field-location-status');try{if(status)status.innerHTML='<strong>📍 Localizando…</strong><small>Aguarde a precisão do aparelho.</small>';fieldLocation=await capturePosition();selectedPhotos.forEach(photo=>{photo.location=fieldLocation;});window.setLocationEditorValue?.('field-geo',fieldLocation);if(status)status.innerHTML=`<strong>✓ Localização capturada pelo GPS</strong><small>${fieldLocation.latitude.toFixed(6)}, ${fieldLocation.longitude.toFixed(6)} · ${fieldLocation.accuracy||0} m</small>`;renderFieldPhotos();}catch(error){if(status)status.innerHTML=`<strong>Localização não capturada</strong><small>${esc(error.message)}</small>`;window.toast(error.message,'error',7000);}
  };
  window.removeFieldPhoto=function(index){
    const [removed]=selectedPhotos.splice(index,1);if(removed)URL.revokeObjectURL(removed.preview);renderFieldPhotos();
  };
  window.saveFieldCapture=async function(){
    if(window.__fieldCaptureBusy)return;
    const observation=document.getElementById('field-observation')?.value.trim()||'';
    const secretaria=document.getElementById('field-secretaria')?.value||'';
    const requestedGroup=document.getElementById('field-group')?.value||'';
    if(!selectedPhotos.length){window.toast('Tire ou escolha ao menos uma foto.','error');return;}
    if(!observation){window.toast('Escreva a observação da demanda.','error');return;}
    if(!secretaria){window.toast('Escolha a secretaria de destino.','error');return;}
    if(!window.userCanDemandSecretaria?.(secretaria,'editar')){window.toast('Você não pode registrar demandas nesta secretaria.','error');return;}
    const selectedGroup=requestedGroup?(window.S?.secs||[]).find(group=>String(group.id)===String(requestedGroup)):null;
    if(requestedGroup&&(!selectedGroup||String(selectedGroup.demanda_secretaria_id)!==String(secretaria)||!(window.S.isAdmin||window.userCanGroup?.(selectedGroup,'editar')))){window.toast('O grupo escolhido não pertence à secretaria ou não está liberado para seu usuário.','error');return;}
    const button=document.getElementById('field-save');window.__fieldCaptureBusy=true;button.disabled=true;
    try{
      const urls=[],locations=[];const stamp=document.getElementById('field-stamp-location')?.checked===true;const offline=navigator.onLine===false;let deferredUpload=false;
      for(let index=0;index<selectedPhotos.length;index+=1){
        button.textContent=`Otimizando foto ${index+1}/${selectedPhotos.length}…`;
        const raw=await window.readFileAsDataUrl(selectedPhotos[index].file);
        const location=selectedPhotos[index].location||fieldLocation;
        const compact=await optimizePhoto(raw,{location,stamp,maxDimension:1280,maxBytes:360000});
        const stored=await window.imgbbUp(compact);urls.push(stored);if(stored.startsWith('data:image/'))deferredUpload=true;
        locations.push(location);
      }
      button.textContent='Organizando a demanda…';
      if(offline||deferredUpload){
        const group=selectedGroup||(window.S?.secs||[]).find(entry=>isFieldDemandGroup(entry)&&entry.demanda_secretaria_id===secretaria);
        if(!group)throw new Error('Abra esta secretaria uma vez com internet para preparar o grupo de entrada no aparelho.');
        const primary=locations.find(Boolean)||fieldLocation;
        const previousForce=globalThis.__forceOfflinePersistence;globalThis.__forceOfflinePersistence=true;
        try{const item=await window.addDoc(window.collection(window.db,'items'),{atividade_id:group.id,description:fieldDemandTitle(observation)||'Demanda de campo',observacao:observation,secretaria_id:secretaria,item_icon:'📷',item_color:'#0f8a73',concluded:0,status:'pendente',order_num:(window.S?.items||[]).filter(entry=>entry.atividade_id===group.id).length,extra_fields:{registro_tipo:'demanda_campo',origem:'captura_rapida',captured_at:new Date().toISOString(),geo_location:primary||null},created_at:window.serverTimestamp(),updated_at:window.serverTimestamp()});
          for(let index=0;index<urls.length;index+=1){const location=locations[index]||primary;await window.addDoc(window.collection(window.db,'entity_images'),{entity_type:'item',entity_id:item.id,is_representative:index===0,imgbb_url:urls[index],title:'',obs:observation,order_num:index,latitude:location?.latitude??null,longitude:location?.longitude??null,accuracy_meters:location?.accuracy||null,maps_url:location?.maps_url||null,captured_at:location?.captured_at||new Date().toISOString(),created_at:window.serverTimestamp()});}
        }finally{globalThis.__forceOfflinePersistence=previousForce;}
        await window.loadData();window.closeModal();window.toast(`Demanda e ${urls.length} foto(s) salvas com segurança neste aparelho. A sincronização será automática${offline?' quando a internet voltar':' assim que o armazenamento responder'}.`,'success',10000);window.openActivity(group.id);return;
      }
      const {data,error}=await supabase.rpc('create_field_demand',{target_secretaria:secretaria,observation,photo_urls:urls});
      if(error)throw error;
      const primary=locations.find(Boolean)||fieldLocation;
      const itemUpdate={updated_at:window.serverTimestamp()};if(selectedGroup)itemUpdate.atividade_id=selectedGroup.id;if(primary)itemUpdate.extra_fields={registro_tipo:'demanda_campo',origem:'captura_rapida',captured_at:new Date().toISOString(),geo_location:primary};if(selectedGroup||primary)await window.updateDoc(window.doc(window.db,'items',data.item_id),itemUpdate);
      const images=await window.getDocs(window.query(window.collection(window.db,'entity_images'),window.where('entity_type','==','item'),window.where('entity_id','==',data.item_id)));
      for(const image of images.docs){const row=image.data(),location=locations[Number(row.order_num)||0]||primary;if(location)await window.updateDoc(window.doc(window.db,'entity_images',image.id),{latitude:location.latitude,longitude:location.longitude,accuracy_meters:location.accuracy||0,maps_url:location.maps_url,captured_at:location.captured_at});}
      const finalGroup=selectedGroup?.id||data.group_id;await window.loadData();window.closeModal();window.toast(`Demanda enviada com ${data?.photos||urls.length} foto(s)${selectedGroup?' diretamente para '+selectedGroup.name:''}!`,'success',6500);window.openActivity(finalGroup);
    }catch(error){window.toast('Não foi possível enviar a demanda: '+(error.message||error),'error',9000);}
    finally{window.__fieldCaptureBusy=false;if(button?.isConnected){button.disabled=false;button.textContent='Enviar demanda de campo';}}
  };
}

export function fieldCaptureDashboardCard(){
  const enabled=allowedSecretarias().length>0;
  return `<section class="field-capture-banner ${enabled?'':'disabled'}"><div class="field-capture-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/><path d="M18 3v4m-2-2h4"/></svg></div><div><span>ATALHO DE CAMPO</span><h2>Viu uma demanda? Registre agora.</h2><p>Fotografe, descreva e encaminhe para a secretaria responsável.</p></div><button type="button" ${enabled?'onclick="openFieldCapture()"':'disabled'}><span>▣</span> Abrir câmera <b>›</b></button></section>`;
}
