import {attendanceFields,readAttendance,attendanceBadges,recordExtra} from './atendimento-meta.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function isAttendanceSection(section){return !!section&&(window.modForSec?.(section)==='atendimentos'||recordExtra(section).modulo==='atendimentos'||section.controle_pocos==1||recordExtra(section).controle_pocos==1);}
export function initAttendanceUI(moveRecord){
 window.attendanceFields=attendanceFields;window.readAttendance=readAttendance;window.attendanceBadges=attendanceBadges;
 window.isAttendanceRecord=record=>isAttendanceSection(window.S?.secs.find(s=>s.id===record.atividade_id))&&record.registro_tipo!=='perfurador'&&recordExtra(record).registro_tipo!=='perfurador';
 window.openMoveAttendance=function(id,table){
  if(!window.userCan?.('atendimentos','editar')||!window.userCan?.('atendimentos','criar')){window.toast('Você precisa de permissão para editar e criar atendimentos.','error');return;}
  const records=table==='items'?window.S.items:window.S.subitems;const record=records.find(r=>r.id===id);if(!record)return;
  window.__movingAttendance={id,table,record};
  const targets=window.S.secs.filter(isAttendanceSection).filter(s=>s.id!==record.atividade_id);
  window.openModal('Mover atendimento',record.description||'',`<p class="attendance-move-hint">O lançamento será transferido mantendo seus dados e autoria. Escolha o grupo e confira o destino.</p><div class="form-group"><label for="move-group">Grupo de destino</label><select id="move-group" onchange="updateMoveAttendanceTarget()"><option value="">Selecione o grupo</option>${targets.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div><div id="move-target-fields"></div><div class="modal-actions"><button type="button" class="users-button" onclick="closeModal()">Cancelar</button><button id="move-attendance-submit" type="button" class="users-button users-button-primary" onclick="confirmMoveAttendance()">Mover atendimento</button></div>`);
 };
 window.updateMoveAttendanceTarget=function(){
  const section=window.S.secs.find(s=>s.id===document.getElementById('move-group').value);const record=window.__movingAttendance.record;
  if(!section){document.getElementById('move-target-fields').innerHTML='';return;}
  const well=section.controle_pocos==1||recordExtra(section).controle_pocos==1;
  const parents=window.S.items.filter(item=>item.atividade_id===section.id&&(!well||item.registro_tipo==='perfurador'||recordExtra(item).registro_tipo==='perfurador'));
  document.getElementById('move-target-fields').innerHTML=`<div class="form-grid attendance-move-target"><div class="form-group full"><label for="move-parent">${well?'Empresa / perfurador':'Item do grupo de destino'}</label><select id="move-parent"><option value="">${well?'Não informado':'Sem item: manter como item principal'}</option>${parents.map(p=>`<option value="${esc(p.id)}">${esc(p.description)}</option>`).join('')}</select></div>${well?`<div class="form-group full"><label for="move-local">Localidade do poço *</label><input id="move-local" value="${esc(record.description||'')}" placeholder="Informe a localidade"><small>Confira a localidade antes da transferência.</small></div><div class="form-group"><label for="move-date">Data da solicitação *</label><input id="move-date" type="date" value="${esc((record.start_date||new Date().toISOString()).slice(0,10))}"></div><div class="form-group"><label for="move-execution">Perfuração</label><select id="move-execution"><option value="solicitada">Solicitada</option><option value="executada" ${record.concluded==1?'selected':''}>Executada</option></select></div>`:''}</div>`;
 };
 window.confirmMoveAttendance=async function(){
  if(window.__attendanceMoveBusy)return;
  const moving=window.__movingAttendance;const target=document.getElementById('move-group').value;if(!target){window.toast('Escolha o grupo de destino.','error');return;}
  const section=window.S.secs.find(s=>s.id===target);const well=section.controle_pocos==1||recordExtra(section).controle_pocos==1;
  const local=document.getElementById('move-local')?.value.trim();const date=document.getElementById('move-date')?.value;
  if(well&&(!local||!date)){window.toast('Informe a localidade e a data da solicitação.','error');return;}
  window.__attendanceMoveBusy=true;const button=document.getElementById('move-attendance-submit');button.disabled=true;button.textContent='Movendo…';
  try{
   await moveRecord({source_id:moving.id,source_table:moving.table,target_group:target,target_parent:document.getElementById('move-parent')?.value||null,well_local:local||null,well_date:date||null,well_execution:document.getElementById('move-execution')?.value||'solicitada'});
   await window.loadData();window.closeModal();window.toast('Atendimento transferido!');window.openActivity(target);
  }catch(error){window.toast('Erro ao mover: '+error.message,'error',8000);}finally{window.__attendanceMoveBusy=false;if(button.isConnected){button.disabled=false;button.textContent='Mover atendimento';}}
 };
}
