import {supabase} from '../supabase_compat.js?v=7';
import {FIELD_GROUP_KEY,isFieldDemandGroup,fieldDemandTitle,cameraInputAttributes} from './camera-capture-core.js?v=1';
import {capturePosition,optimizePhoto} from './geolocation.js?v=1';

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
  window.openFieldCapture=function(){
    const secretarias=allowedSecretarias();
    if(!secretarias.length){window.toast('Seu usuário não possui secretaria liberada para registrar demandas de campo.','error',7000);return;}
    releasePreviews();
    window.openModal('📷 Registro de Campo','Fotografe, localize e encaminhe sem sair da Visão Geral.',`<form onsubmit="event.preventDefault();saveFieldCapture()"><div class="field-capture-intro"><span>1</span><div><strong>Adicione quantas fotos precisar</strong><small>As fotos são reduzidas automaticamente para carregarem rápido.</small></div></div><div class="field-photo-actions"><label class="field-camera-button">📸 Tirar foto<input id="field-camera" type="file" ${cameraInputAttributes()} onchange="addFieldCapturePhotos(this,'camera')"></label><label class="field-gallery-button">🖼️ Escolher da galeria<input id="field-gallery" type="file" accept="image/*" multiple onchange="addFieldCapturePhotos(this,'gallery')"></label><b id="field-photo-count">0/${MAX_FIELD_PHOTOS} fotos</b></div><label class="field-stamp-option"><input id="field-stamp-location" type="checkbox"> Gravar coordenadas e data visíveis na foto</label><div class="field-location-bar"><div id="field-location-status"><strong>📍 Geolocalização</strong><small>A câmera tenta localizar cada nova foto automaticamente.</small></div><button type="button" onclick="captureFieldLocation()">⌖ Capturar agora</button></div><div id="field-photo-preview" class="field-photo-preview"><p>Nenhuma foto adicionada ainda.</p></div><div class="form-grid field-capture-fields"><div class="form-group full"><label for="field-observation">Observação da demanda *</label><textarea id="field-observation" maxlength="4000" rows="5" required placeholder="Descreva o local, o problema, a referência e o que precisa ser feito."></textarea><small>Essa observação acompanhará todas as fotos e ajudará no redirecionamento.</small></div><div class="form-group full"><label for="field-secretaria">Enviar para qual secretaria? *</label><select id="field-secretaria" required><option value="">Selecione a secretaria…</option>${secretarias.map(secretaria=>`<option value="${esc(secretaria.id)}">${esc(secretaria.name)}</option>`).join('')}</select><small>O registro entrará em “Demandas Gerais de Campo” e poderá ser movido depois para o grupo correto.</small></div></div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button id="field-save" type="submit" class="btn-save">Enviar demanda de campo</button></div></form>`);
    window.bulkModalClosing=releasePreviews;
  };
  window.addFieldCapturePhotos=addFiles;
  window.captureFieldLocation=async function(){
   const status=document.getElementById('field-location-status');try{if(status)status.innerHTML='<strong>📍 Localizando…</strong><small>Aguarde a precisão do aparelho.</small>';fieldLocation=await capturePosition();selectedPhotos.forEach(photo=>{if(!photo.location)photo.location=fieldLocation;});if(status)status.innerHTML=`<strong>✓ Localização capturada</strong><small>${fieldLocation.latitude.toFixed(6)}, ${fieldLocation.longitude.toFixed(6)} · ${fieldLocation.accuracy||0} m</small>`;renderFieldPhotos();}catch(error){if(status)status.innerHTML=`<strong>Localização não capturada</strong><small>${esc(error.message)}</small>`;window.toast(error.message,'error',7000);}
  };
  window.removeFieldPhoto=function(index){
    const [removed]=selectedPhotos.splice(index,1);if(removed)URL.revokeObjectURL(removed.preview);renderFieldPhotos();
  };
  window.saveFieldCapture=async function(){
    if(window.__fieldCaptureBusy)return;
    const observation=document.getElementById('field-observation')?.value.trim()||'';
    const secretaria=document.getElementById('field-secretaria')?.value||'';
    if(!selectedPhotos.length){window.toast('Tire ou escolha ao menos uma foto.','error');return;}
    if(!observation){window.toast('Escreva a observação da demanda.','error');return;}
    if(!secretaria){window.toast('Escolha a secretaria de destino.','error');return;}
    if(!window.userCanDemandSecretaria?.(secretaria,'editar')){window.toast('Você não pode registrar demandas nesta secretaria.','error');return;}
    const button=document.getElementById('field-save');window.__fieldCaptureBusy=true;button.disabled=true;
    try{
      const urls=[],locations=[];const stamp=document.getElementById('field-stamp-location')?.checked===true;const offline=navigator.onLine===false;
      for(let index=0;index<selectedPhotos.length;index+=1){
        button.textContent=`Otimizando foto ${index+1}/${selectedPhotos.length}…`;
        const raw=await window.readFileAsDataUrl(selectedPhotos[index].file);
        const location=selectedPhotos[index].location||fieldLocation;
        const compact=await optimizePhoto(raw,{location,stamp,maxDimension:1280,maxBytes:360000});
        urls.push(await window.imgbbUp(compact,{forceOnline:!offline}));
        locations.push(location);
      }
      button.textContent='Organizando a demanda…';
      if(offline){
        const group=(window.S?.secs||[]).find(entry=>isFieldDemandGroup(entry)&&entry.demanda_secretaria_id===secretaria);
        if(!group)throw new Error('Abra esta secretaria uma vez com internet para preparar o grupo permanente no aparelho.');
        const primary=locations.find(Boolean)||fieldLocation;
        const item=await window.addDoc(window.collection(window.db,'items'),{atividade_id:group.id,description:fieldDemandTitle(observation)||'Demanda de campo',observacao:observation,secretaria_id:secretaria,item_icon:'📷',item_color:'#0f8a73',concluded:0,status:'pendente',order_num:(window.S?.items||[]).filter(entry=>entry.atividade_id===group.id).length,extra_fields:{registro_tipo:'demanda_campo',origem:'captura_rapida',captured_at:new Date().toISOString(),geo_location:primary||null},created_at:window.serverTimestamp(),updated_at:window.serverTimestamp()});
        for(let index=0;index<urls.length;index+=1){const location=locations[index]||primary;await window.addDoc(window.collection(window.db,'entity_images'),{entity_type:'item',entity_id:item.id,is_representative:index===0,imgbb_url:urls[index],title:'',obs:observation,order_num:index,latitude:location?.latitude??null,longitude:location?.longitude??null,accuracy_meters:location?.accuracy||null,maps_url:location?.maps_url||null,captured_at:location?.captured_at||new Date().toISOString(),created_at:window.serverTimestamp()});}
        await window.loadData();window.closeModal();window.toast(`Demanda salva neste aparelho com ${urls.length} foto(s). Ela será enviada automaticamente quando a internet voltar.`,'success',8500);window.openActivity(group.id);return;
      }
      const {data,error}=await supabase.rpc('create_field_demand',{target_secretaria:secretaria,observation,photo_urls:urls});
      if(error)throw error;
      const primary=locations.find(Boolean)||fieldLocation;
      if(primary)await window.updateDoc(window.doc(window.db,'items',data.item_id),{extra_fields:{registro_tipo:'demanda_campo',origem:'captura_rapida',captured_at:new Date().toISOString(),geo_location:primary},updated_at:window.serverTimestamp()});
      const images=await window.getDocs(window.query(window.collection(window.db,'entity_images'),window.where('entity_type','==','item'),window.where('entity_id','==',data.item_id)));
      for(const image of images.docs){const row=image.data(),location=locations[Number(row.order_num)||0]||primary;if(location)await window.updateDoc(window.doc(window.db,'entity_images',image.id),{latitude:location.latitude,longitude:location.longitude,accuracy_meters:location.accuracy||0,maps_url:location.maps_url,captured_at:location.captured_at});}
      await window.loadData();window.closeModal();window.toast(`Demanda enviada com ${data?.photos||urls.length} foto(s)!`,'success',6500);window.openActivity(data.group_id);
    }catch(error){window.toast('Não foi possível enviar a demanda: '+(error.message||error),'error',9000);}
    finally{window.__fieldCaptureBusy=false;if(button?.isConnected){button.disabled=false;button.textContent='Enviar demanda de campo';}}
  };
}

export function fieldCaptureDashboardCard(){
  const enabled=allowedSecretarias().length>0;
  return `<section class="field-capture-banner ${enabled?'':'disabled'}"><div class="field-capture-icon">📸</div><div><span>ATALHO DE CAMPO</span><h2>Viu uma demanda? Registre agora.</h2><p>Tire várias fotos, escreva uma observação e encaminhe direto para a secretaria responsável.</p></div><button type="button" ${enabled?'onclick="openFieldCapture()"':'disabled'}>Abrir câmera <b>→</b></button></section>`;
}
