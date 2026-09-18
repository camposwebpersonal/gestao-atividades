// Campos compartilhados por todos os grupos de atendimento, inclusive poços.
export const URGENCIAS={verde:'Pode aguardar',amarelo:'Necessita de atenção',vermelho:'Urgente'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function recordExtra(record){try{return typeof record?.extra_fields==='string'?JSON.parse(record.extra_fields):record?.extra_fields||{};}catch{return {};}}
export function attendanceValue(record,key,fallback){return record?.[key]??recordExtra(record)[key]??fallback;}
export function attendanceFields(record,prefix='at'){
 const urgency=attendanceValue(record,'urgencia',record?'':'verde');
 return `<fieldset class="attendance-fields"><legend>Atendimento</legend><div class="form-grid"><div class="form-group"><label for="${prefix}-urgencia">Urgência</label><select id="${prefix}-urgencia">${urgency===''?'<option value="">Selecione a urgência</option>':''}${Object.entries(URGENCIAS).map(([key,label])=>`<option value="${key}" ${urgency===key?'selected':''}>${{verde:'🟢',amarelo:'🟡',vermelho:'🔴'}[key]} ${label}</option>`).join('')}</select></div><div class="form-group"><label class="attendance-priority"><input type="checkbox" id="${prefix}-prioritario" ${attendanceValue(record,'prioritario',false)?'checked':''}> Atendimento prioritário</label></div><div class="form-group full"><label for="${prefix}-solicitante">Solicitante da demanda <small>(opcional)</small></label><input id="${prefix}-solicitante" value="${esc(attendanceValue(record,'solicitante',''))}" placeholder="Pessoa que solicitou o atendimento"></div></div></fieldset>`;
}
export function readAttendance(prefix='at',documentRef=document){
 const urgency=documentRef.getElementById(prefix+'-urgencia');
 if(!urgency)return {};
 return {urgencia:Object.hasOwn(URGENCIAS,urgency.value)?urgency.value:null,prioritario:!!documentRef.getElementById(prefix+'-prioritario')?.checked,solicitante:documentRef.getElementById(prefix+'-solicitante')?.value.trim()||''};
}
export function attendanceBadges(record){
 const urgency=attendanceValue(record,'urgencia',null),requester=attendanceValue(record,'solicitante','');
 return `<div class="attendance-badges">${URGENCIAS[urgency]?`<span class="attendance-urgency ${urgency}">${URGENCIAS[urgency]}</span>`:'<span class="attendance-urgency unset">Urgência não informada</span>'}${attendanceValue(record,'prioritario',false)?'<span class="attendance-priority-badge">★ Prioritário</span>':''}${requester?`<span class="attendance-requester">Solicitante: ${esc(requester)}</span>`:''}</div>`;
}
