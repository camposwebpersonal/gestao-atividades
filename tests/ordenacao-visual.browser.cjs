// Gera uma página de teste com os handlers reais, sem acessar o banco de produção.
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const part=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const handlers=part('const fieldTypeLabels=','// ── VERBAS LIST')+part('let _listaDragSrc=','window.moverSubParaItemLista=')+part('window.reorderItems=','window.__b64Cache=')+part('let _dragItemId=','window.moverSubParaSub=');
const setup=String.raw`
const S={items:[],subitems:[],fieldTemplates:[]};window.S=S;const db={},writes=[];
const esc=s=>String(s),_tplOpts=t=>t.options||[],toast=()=>{},doc=(db,col,id)=>({col,id}),loadData=async()=>{},pushUndo=()=>{};
async function updateDoc(ref,data){writes.push({ref,data});Object.assign(S[ref.col].find(x=>x.id===ref.id),data);}
const ordered=rows=>rows.slice().sort((a,b)=>a.order_num-b.order_num);
function renderCards(){document.querySelector('#fixture').innerHTML=ordered(S.items).map(x=>'<div class="item-row" data-sort-id="'+x.id+'" id="ir-'+x.id+'" draggable="true" ondragstart="onDrItemStart(event,\''+x.id+'\')" ondragover="onDrItemOver(event,\''+x.id+'\')" ondrop="onDrItemDrop(event,\''+x.id+'\',\'s\')">'+x.id+'</div>').join('');}
function openActivity(){renderCards();}
function renderCadastros(){document.querySelector('#fixture').innerHTML='<table><tbody>'+ordered(S.items).map(x=>'<tr draggable="true" data-lista-type="item" data-lista-id="'+x.id+'" ondragstart="listaDragStart(event,\'item\',\''+x.id+'\')" ondragover="listaDragOver(event,\'item\',\''+x.id+'\')" ondrop="listaDrop(event,\'item\',\''+x.id+'\',\'s\')"><td>'+x.id+'</td></tr>').join('')+'</tbody></table>';}
`;
const tests=String.raw`
const wait=()=>new Promise(r=>setTimeout(r,210));
const check=(ok,message)=>{if(!ok)throw Error(message);};
const fire=(el,type,dt)=>el.dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:dt,clientY:el.getBoundingClientRect().top+1}));
const ids=selector=>[...document.querySelectorAll(selector)].map(x=>x.dataset.sortId||x.dataset.listaId||x.dataset.tplId).join(',');
async function drag(source,target,expected){const dt=new DataTransfer();fire(source,'dragstart',dt);await wait();fire(target,'dragenter',dt);await wait();check(document.querySelector('.sort-live-placeholder'),expected+' espaço ausente');fire(target,'dragover',dt);await wait();check(writes.length===0,expected+' gravou antes de soltar');fire(document.querySelector('.sort-live-placeholder'),'drop',dt);await wait();}
(async()=>{try{
 S.fieldTemplates=['A','B','C'].map((id,i)=>({id,atividade_id:'s',scope:'item',field_name:id,field_type:'text',order_num:i}));
 document.querySelector('#fixture').innerHTML='<div id="ftpl-item-list-s">'+renderFieldTplList('s','item')+'</div>';
 await drag(document.querySelector('.ftpl-grip'),document.querySelectorAll('.ftpl-row')[2],'campos');check(getFieldTpls('s','item').map(x=>x.id).join(',')==='B,C,A','Campos: ordem salva incorreta');
 writes.length=0;document.querySelector('#fixture').innerHTML='<div id="ftpl-edit-opts-t"></div>';['UM','DOIS','TRÊS'].forEach(value=>addFieldOption('t',value));
 await drag(document.querySelector('.ftpl-grip'),document.querySelectorAll('.ftpl-option')[2],'opções');check([...document.querySelectorAll('input')].map(x=>x.value).join(',')==='DOIS,TRÊS,UM','Opções: ordem incorreta');
 S.items=['A','B','C'].map((id,i)=>({id,atividade_id:'s',order_num:i}));writes.length=0;renderCards();await drag(document.querySelector('.item-row'),document.querySelectorAll('.item-row')[2],'cartões');check(ids('.item-row')==='B,C,A','Cartões: ordem salva incorreta');
 // Inverter o sentido mantém a posição da prévia, mesmo antes de um alvo que era posterior.
 writes.length=0;const dt=new DataTransfer(),cards=[...document.querySelectorAll('.item-row')];fire(cards[0],'dragstart',dt);await wait();fire(cards[2],'dragenter',dt);await wait();fire(document.querySelector('.sort-live-placeholder'),'dragover',dt);fire(cards[1],'dragenter',dt);await wait();fire(document.querySelector('.sort-live-placeholder'),'drop',dt);await wait();check(ids('.item-row')==='B,C,A','Inversão: salvou posição diferente da prévia');
 writes.length=0;renderCadastros();await drag(document.querySelector('tr'),document.querySelectorAll('tr')[2],'tabela');check(ids('tr[data-lista-id]')==='C,A,B','Tabela: ordem salva incorreta');
 // Cancelar restaura a aparência e não grava.
 writes.length=0;const cancel=new DataTransfer();fire(document.querySelector('tr'),'dragstart',cancel);await wait();fire(document.querySelectorAll('tr[data-lista-id]')[2],'dragenter',cancel);await wait();fire(document.querySelector('.sort-live-source'),'dragend',cancel);check(!document.querySelector('.sort-live-placeholder,.sort-live-source'),'Cancelar deixou artefatos');check(writes.length===0,'Cancelar gravou');
 // A movimentação de um pai inclui seus descendentes na prévia da tabela.
 S.subitems=[{id:'child',item_id:'C',parent_id:'C',parent_type:'item'}];document.querySelector('tr[data-lista-id="C"]').insertAdjacentHTML('afterend','<tr draggable="true" data-lista-id="child" data-lista-type="subitem"><td>FILHO</td></tr>');
 const tree=new DataTransfer();fire(document.querySelector('tr[data-lista-id="C"]'),'dragstart',tree);await wait();check(document.querySelector('tr[data-lista-id="child"]').classList.contains('sort-live-source'),'Descendente não acompanhou o pai');fire(document.querySelector('.sort-live-source'),'dragend',tree);
 // Subitens em cartões e tabela usam os mesmos handlers e persistem a prévia.
 S.items=[{id:'P',atividade_id:'s',order_num:0}];S.subitems=['X','Y','Z'].map((id,i)=>({id,item_id:'P',parent_id:'P',parent_type:'item',order_num:i}));
 document.querySelector('#fixture').innerHTML=S.subitems.map(x=>'<div class="sub-row" data-sort-id="'+x.id+'" draggable="true" ondragstart="onDrSubStart(event,\''+x.id+'\',\'P\')" ondragover="onDrSubOver(event,\''+x.id+'\',\'P\',\'s\')" ondrop="onDrSubDrop(event,\''+x.id+'\',\'P\',\'s\')"><button onclick="openItemModal(\''+x.id+'\')">'+x.id+'</button></div>').join('');
 writes.length=0;await drag(document.querySelector('.sub-row'),document.querySelectorAll('.sub-row')[2],'subitens');check(ordered(S.subitems).map(x=>x.id).join(',')==='Y,Z,X','Subitens: persistência incorreta');
 // Segurar sobre o espaço continua permitindo aninhar.
 S.items=['A','B'].map((id,i)=>({id,atividade_id:'s',order_num:i}));S.subitems=[];renderCards();let nested=false;window.converterItemEmSubitem=async()=>{nested=true;};
 const hold=new DataTransfer();fire(document.querySelector('.item-row'),'dragstart',hold);await wait();fire(document.querySelectorAll('.item-row')[1],'dragover',hold);await wait();fire(document.querySelector('.sort-live-placeholder'),'dragover',hold);await new Promise(r=>setTimeout(r,900));fire(document.querySelector('.sort-live-placeholder'),'drop',hold);await wait();check(nested,'Segurar para aninhar parou de funcionar');
 document.querySelector('#result').textContent='PASS: campos, combobox, cartões, tabelas, inversão, cancelamento, descendentes, subitens e aninhamento';
}catch(e){document.querySelector('#result').textContent='FAIL: '+e.stack;}})();
`;
fs.writeFileSync('/tmp/ordenacao-visual-browser.html','<!doctype html><html><head><meta charset="utf-8"><style>.item-row,.ftpl-row,.ftpl-option{padding:16px;border:1px solid #aaa;margin:4px}td{padding:16px}table{width:100%}</style></head><body><div id="fixture"></div><pre id="result">WAIT</pre><script>'+setup+'</script><script>'+handlers+'</script><script>'+fs.readFileSync(path.join(root,'js/ordenacao-visual.js'),'utf8')+'</script><script>'+tests+'</script></body></html>');
console.log('/tmp/ordenacao-visual-browser.html');
