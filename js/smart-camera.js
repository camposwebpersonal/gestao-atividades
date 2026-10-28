const FLASH_KEY='gestao-camera-flash-mode';
const DARK_THRESHOLD=72;
let activeInput=null;
let activeStream=null;
let activeTrack=null;
let flashMode='auto';
let torchAvailable=false;

export function averageLuminance(pixels){
  if(!pixels?.length)return 255;
  let total=0,count=0;
  for(let i=0;i<pixels.length;i+=4){total+=(pixels[i]*.2126)+(pixels[i+1]*.7152)+(pixels[i+2]*.0722);count++;}
  return count?total/count:255;
}

export function shouldUseTorch(mode,luminance,available=true){
  return !!available&&(mode==='on'||(mode==='auto'&&Number(luminance)<DARK_THRESHOLD));
}

function el(id){return document.getElementById(id);}
function stopCamera(){
  try{activeTrack?.applyConstraints?.({advanced:[{torch:false}]}).catch(()=>{});}catch(_){}
  activeStream?.getTracks?.().forEach(track=>track.stop());
  activeStream=null;activeTrack=null;torchAvailable=false;
}

function closeCamera(){
  stopCamera();
  el('smart-camera-modal')?.remove();
  activeInput=null;
}

function useNativeCamera(){
  const input=activeInput;
  closeCamera();
  if(!input)return;
  input.dataset.smartCameraBypass='1';
  input.click();
}

function setStatus(message,tone=''){
  const status=el('smart-camera-status');
  if(status){status.textContent=message;status.dataset.tone=tone;}
}

async function setTorch(enabled){
  if(!torchAvailable||!activeTrack)return false;
  try{await activeTrack.applyConstraints({advanced:[{torch:!!enabled}]});return true;}
  catch(_){torchAvailable=false;return false;}
}

function frameLuminance(video){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=48;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(video,0,0,canvas.width,canvas.height);
  return averageLuminance(context.getImageData(0,0,canvas.width,canvas.height).data);
}

function updateFlashButtons(){
  document.querySelectorAll('[data-flash-mode]').forEach(button=>{
    const selected=button.dataset.flashMode===flashMode;
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
}

async function selectFlash(mode){
  flashMode=['auto','on','off'].includes(mode)?mode:'auto';
  try{localStorage.setItem(FLASH_KEY,flashMode);}catch(_){}
  updateFlashButtons();
  if(flashMode==='on'){
    if(await setTorch(true))setStatus('Flash ligado continuamente.','success');
    else setStatus('Este aparelho não liberou a lanterna. A foto continuará normalmente.','warning');
  }else{
    await setTorch(false);
    setStatus(flashMode==='auto'?'Flash automático: a luz será medida no disparo.':'Flash desligado.');
  }
}

function assignCapturedFile(input,blob){
  const file=new File([blob],`foto-${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
  const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

async function takePhoto(){
  const video=el('smart-camera-video'),button=el('smart-camera-shutter');
  if(!video||!activeInput||!video.videoWidth)return;
  button.disabled=true;
  try{
    const luminance=frameLuminance(video);
    const needsTorch=shouldUseTorch(flashMode,luminance,torchAvailable);
    if(flashMode==='auto')setStatus(needsTorch?'Pouca luz detectada: flash automático ativado.':'Iluminação suficiente: captura sem flash.',needsTorch?'success':'');
    if(needsTorch){await setTorch(true);await new Promise(resolve=>setTimeout(resolve,380));}
    const maxWidth=1280,scale=Math.min(1,maxWidth/video.videoWidth);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Falha ao gerar a foto.')),'image/jpeg',.72));
    const input=activeInput;
    try{assignCapturedFile(input,blob);closeCamera();}
    catch(_){closeCamera();input.dataset.smartCameraBypass='1';input.click();}
  }catch(error){
    button.disabled=false;setStatus(error.message||'Não foi possível capturar a foto.','warning');
  }
}

function cameraMarkup(){
  return `<div id="smart-camera-modal" class="smart-camera-modal" role="dialog" aria-modal="true" aria-label="Câmera inteligente">
    <section class="smart-camera-shell">
      <header><div><small>CÂMERA INTELIGENTE</small><strong>Captura leve e otimizada</strong></div><button type="button" id="smart-camera-close" aria-label="Fechar câmera">×</button></header>
      <div class="smart-camera-viewport"><video id="smart-camera-video" autoplay muted playsinline></video><div class="smart-camera-focus" aria-hidden="true"></div></div>
      <div class="smart-camera-flash" role="group" aria-label="Modo do flash">
        <button type="button" data-flash-mode="auto">◉ Automático</button><button type="button" data-flash-mode="on">⚡ Ligado</button><button type="button" data-flash-mode="off">⚡ Desligado</button>
      </div>
      <p id="smart-camera-status" class="smart-camera-status" aria-live="polite">Preparando a câmera…</p>
      <footer><button type="button" id="smart-camera-native" class="smart-camera-secondary">Usar câmera do aparelho</button><button type="button" id="smart-camera-shutter" class="smart-camera-shutter" aria-label="Tirar foto"><span></span></button><span class="smart-camera-size">JPEG leve · até 1280 px</span></footer>
    </section></div>`;
}

async function openCamera(input){
  if(el('smart-camera-modal'))closeCamera();
  activeInput=input;
  try{flashMode=localStorage.getItem(FLASH_KEY)||'auto';}catch(_){flashMode='auto';}
  document.body.insertAdjacentHTML('beforeend',cameraMarkup());
  el('smart-camera-close').onclick=closeCamera;
  el('smart-camera-native').onclick=useNativeCamera;
  el('smart-camera-shutter').onclick=takePhoto;
  document.querySelectorAll('[data-flash-mode]').forEach(button=>button.onclick=()=>selectFlash(button.dataset.flashMode));
  updateFlashButtons();
  try{
    activeStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}}});
    activeTrack=activeStream.getVideoTracks()[0];
    const capabilities=activeTrack.getCapabilities?.()||{};
    torchAvailable=capabilities.torch===true;
    el('smart-camera-video').srcObject=activeStream;
    await el('smart-camera-video').play();
    await selectFlash(flashMode);
    if(!torchAvailable&&flashMode!=='off')setStatus('Câmera pronta. O navegador não liberou a lanterna; a captura continua otimizada.','warning');
  }catch(error){
    setStatus('A câmera interna não pôde ser aberta. Use a câmera segura do aparelho.','warning');
    el('smart-camera-shutter').disabled=true;
  }
}

export function initSmartCamera(){
  if(!navigator.mediaDevices?.getUserMedia)return;
  document.addEventListener('click',event=>{
    const input=event.target?.closest?.('input[type="file"][capture]');
    if(!input)return;
    if(input.dataset.smartCameraBypass==='1'){delete input.dataset.smartCameraBypass;return;}
    event.preventDefault();event.stopImmediatePropagation();openCamera(input);
  },true);
  window.addEventListener('pagehide',stopCamera);
}
