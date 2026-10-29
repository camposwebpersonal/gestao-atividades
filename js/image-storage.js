export const IMAGE_BUCKET='gestao-imagens';

export function hasLocalImage(value,depth=0){
  if(depth>8||value==null)return false;
  if(typeof value==='string')return value.startsWith('data:image/');
  if(Array.isArray(value))return value.some(item=>hasLocalImage(item,depth+1));
  if(typeof value==='object')return Object.values(value).some(item=>hasLocalImage(item,depth+1));
  return false;
}

export function transientStorageError(error,online=globalThis.navigator?.onLine!==false){
  if(!online||error instanceof TypeError)return true;
  const rawStatus=error?.statusCode??error?.status??error?.cause?.statusCode;
  const status=rawStatus==null||rawStatus===''?null:Number(rawStatus);
  if(status!=null&&([0,408,425,429].includes(status)||status>=500))return true;
  const text=[error?.name,error?.message,error?.error,error?.statusText,error?.cause?.message].filter(Boolean).join(' ').toLowerCase();
  return ['failed to fetch','network error','networkerror','load failed','service unavailable','temporarily unavailable','maintenance','timeout','timed out'].some(marker=>text.includes(marker));
}

export function dataUrlToBlob(dataUrl){
  const match=String(dataUrl||'').match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i);
  if(!match)throw new Error('Formato de imagem inválido.');
  const bytes=atob(match[2].replace(/\s/g,'')),buffer=new Uint8Array(bytes.length);
  for(let index=0;index<bytes.length;index+=1)buffer[index]=bytes.charCodeAt(index);
  return new Blob([buffer],{type:match[1].toLowerCase()});
}

function extensionFor(type){return type==='image/png'?'png':type==='image/webp'?'webp':'jpg';}
function uniqueId(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;}

export async function uploadDurableImage(client,dataUrl,{forceOnline=false}={}){
  const blob=dataUrlToBlob(dataUrl);
  if(!forceOnline&&globalThis.navigator?.onLine===false)return dataUrl;
  try{
    const {data:{session},error:sessionError}=await client.auth.getSession();
    if(sessionError)throw sessionError;
    const userId=session?.user?.id;
    if(!userId)throw Object.assign(new Error('Sua sessão expirou. Entre novamente para enviar imagens.'),{status:401});
    const date=new Date(),folder=`${date.getUTCFullYear()}/${String(date.getUTCMonth()+1).padStart(2,'0')}`;
    const path=`${userId}/${folder}/${Date.now()}-${uniqueId()}.${extensionFor(blob.type)}`;
    const {error}=await client.storage.from(IMAGE_BUCKET).upload(path,blob,{contentType:blob.type,cacheControl:'31536000',upsert:false});
    if(error)throw error;
    const {data}=client.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    if(!data?.publicUrl)throw new Error('O armazenamento não retornou o endereço da imagem.');
    return data.publicUrl;
  }catch(error){
    // Na primeira tentativa, qualquer indisponibilidade externa conserva a
    // imagem original no IndexedDB. A fila só remove a cópia após um upload real.
    if(!forceOnline)return dataUrl;
    throw error;
  }
}
