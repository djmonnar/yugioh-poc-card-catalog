// A copy has a run-local identity. Catalog identities remain unchanged.
const fail=m=>{throw Error(m);},copy=structuredClone;
const key=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const iid=v=>typeof v==='string'&&/^i163_[1-9][0-9]{0,9}$/.test(v);
const integer=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
export function createInstances163(run){
 const value={schema:1,next_id:1,items:[],active:{main:[],extra:[]}};
 for(const entry of run.collection)for(let i=0;i<entry.count;i++)value.items.push({id:`i163_${value.next_id++}`,identity_key:entry.card.identity_key,slot:entry.card.slot,internal_id:entry.card.internal_id,atk_bonus:0,def_bonus:0,purchase_price:null});
 run.instances163=value;reconcileInstances163(run);return value;
}
export function reconcileInstances163(run){
 const value=run.instances163;if(!value)return;
 const used=new Set();for(const group of ['main','extra']){
  const selected=[];for(const row of run.active_deck.groups[group]){
   const old=value.active[group].filter(id=>value.items.some(item=>item.id===id&&item.identity_key===row.identity_key)&&!used.has(id));
   if(row.count<old.length)old.sort((a,b)=>{const left=value.items.find(i=>i.id===a),right=value.items.find(i=>i.id===b);return (right.atk_bonus+right.def_bonus)-(left.atk_bonus+left.def_bonus);});
   const extra=value.items.filter(item=>item.identity_key===row.identity_key&&!old.includes(item.id)&&!used.has(item.id)).sort((a,b)=>(b.atk_bonus+b.def_bonus)-(a.atk_bonus+a.def_bonus));
   const pool=[...old,...extra.map(item=>item.id)];
   if(pool.length<row.count)fail('활성 덱에 배치할 카드 개체가 부족해.');for(const id of pool.slice(0,row.count)){selected.push(id);used.add(id);}
  }value.active[group]=selected;
 }return value;
}
export function cleanInstances163(value,run){
 if(!value||Object.keys(value).sort().join(',')!=='active,items,next_id,schema'||value.schema!==1||!integer(value.next_id,1,1e10)||!Array.isArray(value.items)||value.items.length>20000||!value.active||Object.keys(value.active).sort().join(',')!=='extra,main')fail('원정 카드 개체 기록을 확인해줘.');
 const ids=new Set(),counts=new Map();for(const item of value.items){
  if(!item||Object.keys(item).sort().join(',')!=='atk_bonus,def_bonus,id,identity_key,internal_id,purchase_price,slot'||!iid(item.id)||ids.has(item.id)||Number(item.id.slice(5))>=value.next_id||!key(item.identity_key)||!integer(item.atk_bonus,0,9999)||!integer(item.def_bonus,0,9999)||!(item.purchase_price===null||integer(item.purchase_price,0,2e9)))fail('카드 개체·제련 수치가 올바르지 않아.');
  const card=run.collection.find(e=>e.card.identity_key===item.identity_key)?.card;if(!card||item.slot!==card.slot||item.internal_id!==card.internal_id||(!card.type.includes('몬스터')&&(item.atk_bonus||item.def_bonus)))fail('카드 개체와 도감 정보가 달라.');
  ids.add(item.id);counts.set(item.identity_key,(counts.get(item.identity_key)||0)+1);
 }if(run.collection.some(e=>counts.get(e.card.identity_key)!==e.count))fail('카드 개체 수와 보유 매수가 달라.');
 const active=new Set();for(const group of ['main','extra']){const list=value.active[group];if(!Array.isArray(list)||list.length>35)fail('활성 카드 개체 목록을 확인해줘.');const use=new Map();for(const id of list){const item=value.items.find(i=>i.id===id);if(!item||active.has(id))fail('같은 카드 개체가 중복 배치됐어.');active.add(id);use.set(item.identity_key,(use.get(item.identity_key)||0)+1);}if(use.size!==run.active_deck.groups[group].length||run.active_deck.groups[group].some(r=>use.get(r.identity_key)!==r.count))fail('활성 카드 개체와 덱 매수가 달라.');}
 return copy(value);
}
export function addInstances163(run,card,count){if(!run.instances163)return;const value=run.instances163;if(value.items.length+count>20000)fail('원정 카드 개체 한도에 도달했어.');for(let i=0;i<count;i++)value.items.push({id:`i163_${value.next_id++}`,identity_key:card.identity_key,slot:card.slot,internal_id:card.internal_id,atk_bonus:0,def_bonus:0,purchase_price:null});}
export function chooseRemovalInstance163(run,key,{instanceId=null,forceDeck=false}={}){
 if(!run.instances163)return null;const value=run.instances163,active=new Set([...value.active.main,...value.active.extra]);
 if(instanceId){const item=value.items.find(i=>i.id===instanceId&&i.identity_key===key);if(!item||forceDeck&&!active.has(item.id))fail('선택한 카드 개체가 현재 덱에 없어.');return item;}
 const pool=value.items.filter(i=>i.identity_key===key&&(!forceDeck||active.has(i.id)));
 return [...pool].sort((a,b)=>(active.has(a.id)?1:0)-(active.has(b.id)?1:0)||(a.atk_bonus+a.def_bonus)-(b.atk_bonus+b.def_bonus)||Number(b.id.slice(5))-Number(a.id.slice(5)))[0]??null;
}
export function removeInstance163(run,item){if(!item)return;const value=run.instances163;value.items.splice(value.items.findIndex(i=>i.id===item.id),1);for(const group of ['main','extra'])value.active[group]=value.active[group].filter(id=>id!==item.id);}
export function instanceCards163(run,{deckOnly=false,monstersOnly=false}={}){
 const active=new Set([...run.instances163.active.main,...run.instances163.active.extra]);return run.instances163.items.filter(i=>(!deckOnly||active.has(i.id))&&(!monstersOnly||run.collection.find(e=>e.card.identity_key===i.identity_key).card.type.includes('몬스터'))).map(item=>({...copy(item),instance_id:item.id,card:copy(run.collection.find(e=>e.card.identity_key===item.identity_key).card),group:run.instances163.active.main.includes(item.id)?'main':run.instances163.active.extra.includes(item.id)?'extra':null,upgrade_text:[item.atk_bonus?`공격력 +${item.atk_bonus}`:'',item.def_bonus?`수비력 +${item.def_bonus}`:''].filter(Boolean).join(' · ')}));
}
export function launchInstances163(run){const seen=new Map();return run.instances163.active.main.map(id=>{const item=run.instances163.items.find(i=>i.id===id),occurrence=seen.get(item.internal_id)||0;seen.set(item.internal_id,occurrence+1);return {...copy(item),instance_id:item.id,occurrence};});}
