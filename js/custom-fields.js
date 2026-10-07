const CHOICE_TYPES=new Set(['combobox','checkboxes','radio']);

export function fieldTypeHasOptions(type){return CHOICE_TYPES.has(type);}

export function normalizeChoiceValues(value){
 if(Array.isArray(value))return value.map(item=>String(item).trim()).filter(Boolean);
 if(value===null||value===undefined||value==='')return [];
 return String(value).split(/\s*(?:;|\||,)\s*/).map(item=>item.trim()).filter(Boolean);
}

export function customFieldControl(template,raw,escapeHtml=value=>String(value??'')){
 const type=template?.field_type||'text',key=String(template?.field_name||''),options=Array.isArray(template?.options)?template.options.map(String):[],value=raw===null||raw===undefined?'':raw;
 if(type!=='checkboxes'&&type!=='radio')return '';
 const selected=normalizeChoiceValues(value),allOptions=[...options];selected.forEach(option=>{if(!allOptions.includes(option))allOptions.push(option);});
 const inputType=type==='checkboxes'?'checkbox':'radio',label=type==='checkboxes'?'Marque uma ou mais opções':'Escolha uma opção';
 return `<div class="custom-choice-field" data-ef-choice-group data-ef-choice-key="${escapeHtml(key)}" data-ef-choice-type="${type}" role="${type==='radio'?'radiogroup':'group'}" aria-label="${escapeHtml(key)}"><small>${label}</small><div>${allOptions.map(option=>`<label><input type="${inputType}" name="ef-choice-${escapeHtml(key)}" value="${escapeHtml(option)}" ${selected.includes(option)?'checked':''}><span>${escapeHtml(option)}${!options.includes(option)?' (valor anterior)':''}</span></label>`).join('')}</div></div>`;
}

export function collectCustomFieldValues(root,base={}){
 const values={...base};
 root.querySelectorAll('[data-ef-key]').forEach(element=>{const value=String(element.value??'').trim();if(value)values[element.dataset.efKey]=value;else delete values[element.dataset.efKey];});
 root.querySelectorAll('[data-ef-choice-group]').forEach(group=>{
  const key=group.dataset.efChoiceKey,type=group.dataset.efChoiceType,checked=[...group.querySelectorAll('input:checked')].map(input=>input.value);
  if(!checked.length)delete values[key];
  else values[key]=type==='checkboxes'?checked:checked[0];
 });
 return values;
}

export function formatCustomFieldValue(value){return Array.isArray(value)?value.join(', '):String(value??'');}
