const SYNONYM_GROUPS=[
 ['responsavel','responsaveis','resp','representante'],
 ['telefone','tel','fone','celular','whatsapp'],
 ['secretaria','secretarias','setor','pasta'],
 ['demanda','demandas','solicitacao','solicitacoes','pedido','pedidos','chamado','chamados'],
 ['endereco','local','localidade'],
 ['prazo','vencimento','validade'],
 ['nome','descricao','titulo'],
 ['urgencia','urgente','prioridade','prioritario'],
 ['email','correio'],
 ['concluido','finalizado','feito'],
 ['pendente','aberto','aguardando']
];

const SYNONYMS=new Map();
for(const group of SYNONYM_GROUPS){
 const normalized=group.map(value=>normalizeSearchText(value));
 normalized.forEach(word=>SYNONYMS.set(word,normalized));
}

export function normalizeSearchText(value){
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}

export function flattenSearchValues(value,seen=new Set()){
 if(value==null||typeof value==='boolean')return '';
 if(typeof value==='string'||typeof value==='number'||value instanceof Date)return String(value);
 if(typeof value!=='object'||seen.has(value))return '';
 seen.add(value);
 if(Array.isArray(value))return value.map(entry=>flattenSearchValues(entry,seen)).filter(Boolean).join(' ');
 return Object.entries(value).filter(([key])=>!['cover_url','resp_url','url','password'].includes(key)).map(([key,entry])=>`${key} ${flattenSearchValues(entry,seen)}`).join(' ');
}

export function searchTokens(query){
 return [...new Set(normalizeSearchText(query).split(' ').filter(Boolean))];
}

function editDistance(a,b,limit=2){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let previous=Array.from({length:b.length+1},(_,index)=>index);
 for(let i=1;i<=a.length;i++){
  const current=[i];let rowMin=i;
  for(let j=1;j<=b.length;j++){
   current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
   rowMin=Math.min(rowMin,current[j]);
  }
  if(rowMin>limit)return limit+1;
  previous=current;
 }
 return previous[b.length];
}

function tokenScore(token,text,words){
 if(!token)return 0;
 if(text===token)return 120;
 if(text.startsWith(token+' '))return 105;
 if(words.includes(token))return 95;
 if(text.includes(token))return token.length>=3?82:68;
 const alternatives=SYNONYMS.get(token)||[];
 for(const alternative of alternatives){
  if(words.includes(alternative))return 76;
  if(alternative.length>=4&&text.includes(alternative))return 66;
 }
 if(token.length<4)return 0;
 const limit=token.length>=7?2:1;
 for(const word of words){
  if(word.length<3||Math.abs(word.length-token.length)>limit)continue;
  const distance=editDistance(token,word,limit);
  if(distance<=limit)return 58-(distance*8);
 }
 return 0;
}

export function searchText(value,query){
 const text=normalizeSearchText(flattenSearchValues(value)),tokens=searchTokens(query);
 if(!tokens.length)return {matched:true,score:0,tokens,normalized:text};
 if(!text)return {matched:false,score:0,tokens,normalized:text};
 const words=[...new Set(text.split(' ').filter(Boolean))];
 let score=text.includes(tokens.join(' '))?85:0;
 for(const token of tokens){
  const part=tokenScore(token,text,words);
  if(!part)return {matched:false,score:0,tokens,normalized:text};
  score+=part;
 }
 return {matched:true,score:score+Math.max(0,25-words.length*.12),tokens,normalized:text};
}

export function searchRecord(record,query,fields=[]){
 const values=fields.length?fields.map(field=>typeof field==='function'?field(record):record?.[field]):record;
 return searchText(values,query);
}

export function rankSearch(records,query,textForRecord,limit=30){
 return records.map((record,index)=>({record,index,match:searchText(textForRecord(record),query)}))
  .filter(entry=>entry.match.matched)
  .sort((a,b)=>b.match.score-a.match.score||a.index-b.index)
  .slice(0,limit);
}

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function highlightSearchText(value,query){
 const source=String(value??''),tokens=searchTokens(query).filter(token=>token.length>1);
 if(!source||!tokens.length)return escapeHtml(source);
 const normalized=[],sourceIndexes=[];
 for(let index=0;index<source.length;index++){
  const plain=source[index].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  for(const char of plain){normalized.push(char);sourceIndexes.push(index);}
 }
 const ranges=[];
 for(const token of tokens){
  let start=0,position;
  while((position=normalized.join('').indexOf(token,start))!==-1){ranges.push([sourceIndexes[position],sourceIndexes[position+token.length-1]+1]);start=position+token.length;}
 }
 if(!ranges.length)return escapeHtml(source);
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
 let html='',cursor=0;
 for(const [start,end] of merged){html+=escapeHtml(source.slice(cursor,start))+`<mark>${escapeHtml(source.slice(start,end))}</mark>`;cursor=end;}
 return html+escapeHtml(source.slice(cursor));
}
