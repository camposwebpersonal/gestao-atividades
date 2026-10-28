import {supabase} from '../supabase_compat.js?v=5';
import {FIELD_GROUP_KEY,isFieldDemandGroup,cameraInputAttributes} from './camera-capture-core.js?v=1';

export {FIELD_GROUP_KEY,isFieldDemandGroup,cameraInputAttributes};
const MAX_FIELD_PHOTOS=20;
let selectedPhotos=[];

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function allowedSecretarias(){
  return (window.S?.secretarias||[])
    .filter(secretaria=>window.S.isAdmin||window.userCanDemandSecretaria?.(secretaria.id,'editar'))
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
}

function releasePreviews(){
  selectedPhotos.forEach(entry=>URL.revokeObjectURL(entry.preview));
  selectedPhotos=[];
}

function renderFieldPhotos(){
  const host=document.getElementById('field-photo-preview');
  const count=document.getElementById('field-photo-count');
  if(count)count.textContent=`${selectedPhotos.length}/${MAX_FIELD_PHOTOS} foto${selectedPhotos.length===1?'':'s'}`;
  if(!host)return;
  host.innerHTML=selectedPhotos.map((entry,index)=>`<figure class="field-photo-card"><img src="${esc(entry.preview)}" alt="Foto ${index+1} selecionada"><button type="button" onclick="removeFieldPhoto(${index})" aria-label="Remover foto ${index+1}">×</button><figcaption>${esc(entry.file.name||`Foto ${index+1}`)}</figcaption></figure>`).join('')||'<p>Nenhuma foto adicionada ainda.</p>';
}

function addFiles(input){
  const files=Array.from(input?.files||[]).filter(file=>String(file.type||'').startsWith('image/'));
  input.value='';
  if(!files.length){window.toast('Escolha uma imagem válida.','error');return;}
  const free=MAX_FIELD_PHOTOS-selectedPhotos.length;
  if(free<=0){window.toast(`Limite de ${MAX_FIELD_PHOTOS} fotos por registro.`, 'info');return;}
  files.slice(0,free).forEach(file=>selectedPhotos.push({file,preview:URL.createObjectURL(file)}));
  if(files.length>free)window.toast(`Foram mantidas as primeiras ${MAX_FIELD_PHOTOS} fotos.`, 'info',6000);
  renderFieldPhotos();
}

export function initFieldCapture(){
  window.isFieldDemandGroup=isFieldDemandGroup;
  window.openFieldCapture=function(){
    if(navigator.onLine===false){window.toast('A captura de campo precisa de internet para enviar as fotos com segurança.','info',7000);return;}
    const secretarias=allowedSecretarias();
    if(!secretarias.length){window.toast('Seu usuário não possui secretaria liberada para registrar demandas de campo.','error',7000);return;}
    releasePreviews();
    window.openModal('📷 Registro de Campo','Fotografe, descreva e encaminhe sem sair da Visão Geral.',`<form onsubmit="event.preventDefault();saveFieldCapture()"><div class="field-capture-intro"><span>1</span><div><strong>Adicione quantas fotos precisar</strong><small>A câmera pode ser aberta novamente após cada foto.</small></div></div><div class="field-photo-actions"><label class="field-camera-button">📸 Tirar foto<input id="field-camera" type="file" ${cameraInputAttributes()} onchange="addFieldCapturePhotos(this)"></label><label class="field-gallery-button">🖼️ Escolher da galeria<input id="field-gallery" type="file" accept="image/*" multiple onchange="addFieldCapturePhotos(this)"></label><b id="field-photo-count">0/${MAX_FIELD_PHOTOS} fotos</b></div><div id="field-photo-preview" class="field-photo-preview"><p>Nenhuma foto adicionada ainda.</p></div><div class="form-grid field-capture-fields"><div class="form-group full"><label for="field-observation">Observação da demanda *</label><textarea id="field-observation" maxlength="4000" rows="5" required placeholder="Descreva o local, o problema, a referência e o que precisa ser feito."></textarea><small>Essa observação acompanhará todas as fotos e ajudará no redirecionamento.</small></div><div class="form-group full"><label for="field-secretaria">Enviar para qual secretaria? *</label><select id="field-secretaria" required><option value="">Selecione a secretaria…</option>${secretarias.map(secretaria=>`<option value="${esc(secretaria.id)}">${esc(secretaria.name)}</option>`).join('')}</select><small>O registro entrará em “Demandas Gerais de Campo” e poderá ser movido depois para o grupo correto.</small></div></div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button id="field-save" type="submit" class="btn-save">Enviar demanda de campo</button></div></form>`);
    window.bulkModalClosing=releasePreviews;
  };
  window.addFieldCapturePhotos=addFiles;
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
      const urls=[];
      for(let index=0;index<selectedPhotos.length;index+=1){
        button.textContent=`Enviando foto ${index+1}/${selectedPhotos.length}…`;
        const raw=await window.readFileAsDataUrl(selectedPhotos[index].file);
        const compact=await window.mkThumb(raw,1600,1600,.78);
        urls.push(await window.imgbbUp(compact,{forceOnline:true}));
      }
      button.textContent='Organizando a demanda…';
      const {data,error}=await supabase.rpc('create_field_demand',{target_secretaria:secretaria,observation,photo_urls:urls});
      if(error)throw error;
      await window.loadData();window.closeModal();window.toast(`Demanda enviada com ${data?.photos||urls.length} foto(s)!`,'success',6500);window.openActivity(data.group_id);
    }catch(error){window.toast('Não foi possível enviar a demanda: '+(error.message||error),'error',9000);}
    finally{window.__fieldCaptureBusy=false;if(button?.isConnected){button.disabled=false;button.textContent='Enviar demanda de campo';}}
  };
}

export function fieldCaptureDashboardCard(){
  const enabled=allowedSecretarias().length>0;
  return `<section class="field-capture-banner ${enabled?'':'disabled'}"><div class="field-capture-icon">📸</div><div><span>ATALHO DE CAMPO</span><h2>Viu uma demanda? Registre agora.</h2><p>Tire várias fotos, escreva uma observação e encaminhe direto para a secretaria responsável.</p></div><button type="button" ${enabled?'onclick="openFieldCapture()"':'disabled'}>Abrir câmera <b>→</b></button></section>`;
}
