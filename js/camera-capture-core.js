export const FIELD_GROUP_KEY='demandas-gerais-campo';

const extraOf=record=>{try{return typeof record?.extra_fields==='string'?JSON.parse(record.extra_fields):record?.extra_fields||{};}catch{return {};}};

export function isFieldDemandGroup(group){
  return extraOf(group).system_group===FIELD_GROUP_KEY;
}

export function fieldDemandTitle(observation){
  return String(observation||'').trim().replace(/\s+/g,' ').slice(0,140);
}

export function cameraInputAttributes({multiple=false}={}){
  return `accept="image/*" capture="environment"${multiple?' multiple':''}`;
}
