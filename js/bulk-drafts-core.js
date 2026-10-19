const TABLE='bulk_entry_drafts';

function assertClient(client){if(!client?.from)throw new Error('Conexão com o banco indisponível.');}
function throwIfError(error){if(error)throw new Error(error.message||String(error));}

export async function listBulkDrafts(client,groupId){
 assertClient(client);
 const {data,error}=await client.from(TABLE).select('*').eq('group_id',groupId).order('updated_at',{ascending:false});
 throwIfError(error);return Array.isArray(data)?data:[];
}

export async function createBulkDraft(client,{groupId,title,rowCount=12,columnSignature=[]}){
 assertClient(client);
 const payload={group_id:groupId,title:String(title||'').trim(),row_count:rowCount,column_signature:columnSignature,grid_data:{version:1,rows:Array.from({length:rowCount},()=>({}))}};
 if(!payload.title)throw new Error('Informe um título para o lote.');
 const {data,error}=await client.from(TABLE).insert(payload).select('*').single();
 throwIfError(error);if(!data?.id)throw new Error('O banco não confirmou a criação do rascunho.');return data;
}

export async function updateBulkDraft(client,id,patch){
 assertClient(client);
 const payload={...patch,updated_at:new Date().toISOString()};delete payload.id;delete payload.owner_id;delete payload.created_at;
 const {data,error}=await client.from(TABLE).update(payload).eq('id',id).select('*').single();
 throwIfError(error);if(!data?.id)throw new Error('O banco não confirmou o salvamento do rascunho.');return data;
}

export async function deleteBulkDraft(client,id){
 assertClient(client);
 const {error}=await client.from(TABLE).delete().eq('id',id);throwIfError(error);return true;
}

export async function submitBulkDraft(client,id,payloads){
 if(!client?.rpc)throw new Error('Conexão com o banco indisponível.');
 if(!id||!Array.isArray(payloads)||!payloads.length)throw new Error('Rascunho ou lançamentos inválidos.');
 const {data,error}=await client.rpc('submit_bulk_entry_draft',{p_draft_id:id,p_items:payloads});
 throwIfError(error);
 if(!Array.isArray(data)||data.length!==payloads.length)throw new Error(`O banco confirmou ${Array.isArray(data)?data.length:0} de ${payloads.length} lançamentos. O rascunho foi preservado.`);
 return data;
}
