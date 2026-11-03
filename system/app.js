const SETTINGS_KEY='nu-simulacao-configuracoes-v1';

function showToast(message){
  let toast=document.querySelector('.toast');
  if(!toast){toast=document.createElement('div');toast.className='toast';toast.setAttribute('role','status');document.body.appendChild(toast);}
  toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),3600);
}

function setupPayments(){
  const options=[...document.querySelectorAll('.payment-option')],installments=document.querySelector('.installments'),button=document.querySelector('[data-confirm-payment]');
  if(!options.length)return;
  const select=option=>{options.forEach(item=>item.classList.toggle('selected',item===option));option.querySelector('input').checked=true;installments?.classList.toggle('visible',option.dataset.method==='Parcelado');};
  options.forEach(option=>option.addEventListener('click',()=>select(option)));
  button?.addEventListener('click',()=>{
    const chosen=document.querySelector('.payment-option input:checked')?.closest('.payment-option');
    if(!chosen){showToast('Escolha Pix, boleto ou parcelamento para continuar.');return;}
    const detail=chosen.dataset.method==='Parcelado'?` em ${document.querySelector('#installment-count')?.value||'parcelas'}`:'';
    showToast(`Simulação: pagamento por ${chosen.dataset.method}${detail} selecionado. Nenhuma operação financeira real foi realizada.`);
  });
}

function readSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');}catch{return {};}}
function setupSettings(state){
  const inputs=[...document.querySelectorAll('[data-setting]')];if(!inputs.length)return;
  inputs.forEach(input=>{if(Object.hasOwn(state,input.dataset.setting))input.checked=Boolean(state[input.dataset.setting]);input.addEventListener('change',()=>{state[input.dataset.setting]=input.checked;localStorage.setItem(SETTINGS_KEY,JSON.stringify(state));applySettings(state);showToast('Configuração salva neste dispositivo.');});});
  applySettings({...Object.fromEntries(inputs.map(input=>[input.dataset.setting,input.checked])),...state});
}

function applySettings(state){
  document.body.classList.toggle('dark',Boolean(state.darkTheme));
  const showValues=state.showValues!==false;
  document.querySelectorAll('[data-sensitive],.card-limit-value,.limit-info strong,.invoice-total,.tx-value,.summary-value').forEach(element=>{
    element.dataset.originalValue ||= element.textContent;
    element.textContent=showValues?element.dataset.originalValue:'••••';
  });
}
document.addEventListener('DOMContentLoaded',()=>{const state=readSettings();applySettings(state);setupPayments();setupSettings(state);});
