import {snapshotCard} from './roguelite-card.js?v=20261014-139';
import {eligibleRewardCards} from './roguelite-rewards.js?v=20261014-139';
import {validatePlayerDeck} from './roguelite-core.js?v=20261015-147';
import {cardLine,placementError} from './ai-deck-core.js';
import {RELICS,MAX_RUN_LP,SHOP_PRICES150,shopPrice150,EVENTS150,EVENTS154} from './roguelite154-rules.js?v=20261017-154';

// This module has no storage, clock, RNG globals or account-gold access. The
// authenticated host journals a returned transition as one checkpoint.
const fail=message=>{throw new Error(message);},clone=value=>structuredClone(value);
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const integer=(value,min,max,label)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail(`${label} 값을 확인해줘.`);return value;};
const key=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function exact(value,keys,label){if(!record(value)||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(value,k)))fail(`${label} 형식을 확인해줘.`);}
function hash(text){let value=2166136261;for(const c of text)value=Math.imul(value^c.codePointAt(0),16777619)>>>0;return value;}
function rng(seed){let value=hash(seed);return ()=>{value+=0x6d2b79f5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function shuffled(items,seed){const out=[...items],random=rng(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function nodeSeed(run,node,area=run.area??1){return `nodes150|${run.seed}|${node.id}|${area}`;}
function claimId(nodeId,suffix){const id=`n150_${nodeId}_${suffix}`;if(!identifier(id))fail('상점·이벤트 번호가 너무 길어.');return id;}
function mapNode(run,nodeId,kind){const node=run.map?.nodes.find(n=>n.id===nodeId);if(!node||kind&&node.kind!==kind)fail('지도에 없는 상점·이벤트야.');return node;}
const emptyRecord=value=>record(value)&&Object.keys(value).length===0;
export const emptyNodes150=()=>({schema:1,shops:{},events:{},removals:[]});
export const isEmptyNodes150=value=>value?.schema===1&&emptyRecord(value.shops)&&emptyRecord(value.events)&&Array.isArray(value.removals)&&value.removals.length===0;
const phases=['open','resolved','left'];
const eventDefinition=id=>EVENTS154.find(e=>e.id===id);
const gradeUp={N:'R',R:'SR',SR:'UR'};

// Validate the extension independently of the current catalog. Merchandise and
// exchange targets are snapshots from entry, so later catalog edits cannot
// reroll a visit. Public bind separately requires this entire extension empty.
export function cleanNodes150(value,run){
  exact(value,['schema','shops','events','removals'],'상점·이벤트 기록');
  if(value.schema!==1||!record(value.shops)||!record(value.events)||!Array.isArray(value.removals)||value.removals.length>1000)fail('상점·이벤트 저장 버전을 확인해줘.');
  const result=emptyNodes150(),seenLosses=new Set(),snapshots=new Map();
  const preserveCard=source=>{
    const card=snapshotCard(source),previous=snapshots.get(card.identity_key);
    if(previous&&!equal(previous,card))fail('상점·제거 기록의 같은 카드 정보가 달라.');
    const owned=run.collection?.find(e=>e.card.identity_key===card.identity_key);
    if(owned&&!equal(snapshotCard(owned.card),card))fail('저장된 상품과 원정 카드함 정보가 달라.');
    snapshots.set(card.identity_key,card);return card;
  };
  const visit=(source,id,kind)=>{
    if(!identifier(id)||source.node_id!==id)fail('방문 기록 번호가 일치하지 않아.');
    const node=mapNode(run,id,kind);
    if(!phases.includes(source.status)||node.floor>run.floor||node.floor===run.floor&&id!==run.current_node_id)fail('방문 기록과 현재 위치가 일치하지 않아.');
    if(node.floor<run.floor&&source.status!=='left')fail('떠나지 않은 상점·이벤트를 지나갈 수 없어.');
    const area=integer(source.area,1,10000,'방문 구역');
    if(source.seed_key!==nodeSeed(run,node,area))fail('상점·이벤트의 고정 시드가 일치하지 않아.');
    return {node,area};
  };
  if(Object.keys(value.shops).length+Object.keys(value.events).length>500)fail('방문 기록이 너무 많아.');
  for(const [id,source] of Object.entries(value.shops)){
    exact(source,['node_id','area','seed_key','status','cards','relic','removal_used'],'상점 기록');
    const {area}=visit(source,id,'shop');
    if(!Array.isArray(source.cards)||source.cards.length!==5||typeof source.removal_used!=='boolean'||source.status==='resolved')fail('상점 재고를 확인해줘.');
    const seen=new Set(),cards=source.cards.map((item,index)=>{
      exact(item,['id','card','base_price','purchased','claim_id'],'상점 카드');
      const card=preserveCard(item.card),price=SHOP_PRICES150[card.rarity];
      if(!price||item.id!==`card_${index}`||seen.has(card.identity_key)||item.base_price!==price||typeof item.purchased!=='boolean')fail('상점 카드 재고가 잘못됐어.');
      seen.add(card.identity_key);
      const expected=claimId(id,item.id);
      if(item.claim_id!==(item.purchased?expected:null))fail('상품 구매 기록이 잘못됐어.');
      if(item.purchased&&!run.reward_claims?.some(c=>c.id===expected&&c.identity_key===card.identity_key&&c.count===1))fail('상품 구매와 카드 지급 기록이 일치하지 않아.');
      return {...item,card};
    });
    let relic=null;
    if(source.relic!==null){
      exact(source.relic,['id','relic_id','base_price','purchased'],'상점 유물');
      if(source.relic.id!=='relic'||!RELICS.some(r=>r.id===source.relic.relic_id)||source.relic.base_price!==250||typeof source.relic.purchased!=='boolean'||source.relic.purchased&&!run.relics.includes(source.relic.relic_id))fail('상점 유물 기록이 잘못됐어.');
      relic={...source.relic};
    }
    result.shops[id]={node_id:id,area,seed_key:source.seed_key,status:source.status,cards,relic,removal_used:source.removal_used};
  }
  for(const [id,source] of Object.entries(value.events)){
    exact(source,['node_id','area','seed_key','status','kind','targets','relic_id','choice','source_key','target_key',...(source.event_version===undefined?[]:['event_version'])],'이벤트 기록');
    if(source.event_version!==undefined&&source.event_version!==154)fail('이벤트 저장 버전을 확인해줘.');
    const {node,area}=visit(source,id,'event');
    const definitions=source.event_version===154?EVENTS154:EVENTS150,suffix=source.event_version===154?'|event154':'|event';
    if(!eventDefinition(source.kind)||source.kind!==definitions[hash(nodeSeed(run,node,area)+suffix)%definitions.length].id)fail('이벤트 종류와 고정 시드가 일치하지 않아.');
    exact(source.targets,['N','R','SR','UR'],'이벤트 교환 후보');
    const targets={};
    for(const tier of Object.keys(source.targets)){
      const list=source.targets[tier];
      if(!Array.isArray(list)||list.length>2)fail('이벤트 교환 후보가 잘못됐어.');
      targets[tier]=list.map(preserveCard);
      if(targets[tier].some(c=>c.rarity!==tier)||new Set(targets[tier].map(c=>c.identity_key)).size!==list.length)fail('이벤트 후보 등급이 잘못됐어.');
    }
    if(source.relic_id!==null&&!RELICS.some(r=>r.id===source.relic_id))fail('이벤트 유물을 확인해줘.');
    if(![null,'accept','skip'].includes(source.choice)||(source.status==='open')!==(source.choice===null))fail('이벤트 선택과 해결 상태가 일치하지 않아.');
    const exchange=['mirror_exchange','card_reforge'].includes(source.kind);
    if(source.choice==='accept'&&exchange){
      if(!key(source.source_key)||!key(source.target_key)||source.source_key===source.target_key)fail('이벤트 교환 기록을 확인해줘.');
      const candidate=Object.values(targets).flat().find(c=>c.identity_key===source.target_key);
      if(!candidate||!run.reward_claims?.some(c=>c.id===claimId(id,'event')&&c.identity_key===candidate.identity_key&&c.count===1))fail('교환 카드와 지급 기록이 일치하지 않아.');
    }else if(source.choice==='accept'&&source.kind==='card_duplication'){
      if(!key(source.source_key)||source.source_key!==source.target_key||!run.reward_claims?.some(c=>c.id===claimId(id,'event')&&c.identity_key===source.source_key&&c.count===1))fail('복제 카드와 지급 기록이 일치하지 않아.');
    }else if(source.source_key!==null||source.target_key!==null)fail('카드를 교환하지 않은 이벤트에 교환 기록이 있어.');
    if(source.choice==='accept'&&source.kind==='relic_bargain'&&(!source.relic_id||!run.relics.includes(source.relic_id)))fail('이벤트 유물 지급 기록이 일치하지 않아.');
    result.events[id]={node_id:id,area,seed_key:source.seed_key,status:source.status,kind:source.kind,targets,relic_id:source.relic_id,choice:source.choice,source_key:source.source_key,target_key:source.target_key,...(source.event_version===154?{event_version:154}:{})};
  }
  for(const source of value.removals){
    exact(source,['id','node_id','kind','card','count','before_count','after_count','deck_group','target_key'],'영구 제거 기록');
    if(!identifier(source.id)||seenLosses.has(source.id)||source.count!==1||!['shop_remove','event_exchange'].includes(source.kind)||![null,'main','extra'].includes(source.deck_group))fail('영구 제거 기록을 확인해줘.');
    seenLosses.add(source.id);
    const card=preserveCard(source.card),before=integer(source.before_count,1,9999,'제거 전 매수');
    if(source.after_count!==before-1)fail('제거 전후 카드 매수가 일치하지 않아.');
    if(source.kind==='shop_remove'){
      if(source.id!==claimId(source.node_id,'remove')||!result.shops[source.node_id]?.removal_used||source.target_key!==null)fail('상점 제거와 영구 기록이 일치하지 않아.');
    }else{
      const event=result.events[source.node_id];
      if(source.id!==claimId(source.node_id,'exchange')||event?.choice!=='accept'||event.source_key!==card.identity_key||event.target_key!==source.target_key)fail('이벤트 교환과 영구 제거 기록이 일치하지 않아.');
      const target=Object.values(event.targets).flat().find(c=>c.identity_key===source.target_key);
      const tier=event.kind==='card_reforge'?gradeUp[card.rarity]:card.rarity;
      if(!target||target.rarity!==tier)fail('이벤트 교환 전후 등급이 일치하지 않아.');
    }
    result.removals.push({...source,card});
  }
  for(const shop of Object.values(result.shops))if(shop.removal_used!==result.removals.some(r=>r.kind==='shop_remove'&&r.node_id===shop.node_id))fail('상점 카드 제거 기록이 누락됐어.');
  for(const event of Object.values(result.events))if(event.choice==='accept'&&['mirror_exchange','card_reforge'].includes(event.kind)&&!result.removals.some(r=>r.kind==='event_exchange'&&r.node_id===event.node_id))fail('이벤트 교환의 제거 기록이 누락됐어.');
  const active=[...Object.values(result.shops),...Object.values(result.events)].filter(v=>v.status!=='left');
  if(active.length>1||active.some(v=>run.state!=='at_node'||v.node_id!==run.current_node_id))fail('상점·이벤트의 열린 방문 위치가 잘못됐어.');
  return result;
}

function pickRelic(run,seed){const pool=RELICS.filter(r=>!run.relics.includes(r.id)&&run.max_lp+(r.max_lp||0)<=MAX_RUN_LP);return pool.length?pool[hash(seed)%pool.length].id:null;}
function poolFor(run,cards){
  return eligibleRewardCards(cards).filter(card=>!run.collection.some(e=>e.card.slot===card.slot&&e.card.identity_key!==card.identity_key||e.card.identity_key===card.identity_key&&!equal(e.card,card)));
}
function makeShop(run,node,cards){
  const pool=poolFor(run,cards),seed=nodeSeed(run,node);
  if(pool.length<5)fail('상점에 등록할 서로 다른 판매 가능 카드가 5장 이상 필요해.');
  return {node_id:node.id,area:run.area??1,seed_key:seed,status:'open',cards:shuffled(pool,seed+'|cards').slice(0,5).map((card,i)=>({id:`card_${i}`,card,base_price:SHOP_PRICES150[card.rarity],purchased:false,claim_id:null})),
    relic:pickRelic(run,seed+'|relic')?{id:'relic',relic_id:pickRelic(run,seed+'|relic'),base_price:250,purchased:false}:null,removal_used:false};
}
function makeEvent(run,node,cards){
  const seed=nodeSeed(run,node),pool=poolFor(run,cards),targets={};
  for(const tier of ['N','R','SR','UR'])targets[tier]=shuffled(pool.filter(c=>c.rarity===tier),seed+'|target|'+tier).slice(0,2);
  return {node_id:node.id,area:run.area??1,seed_key:seed,status:'open',event_version:154,kind:EVENTS154[hash(seed+'|event154')%EVENTS154.length].id,targets,
    relic_id:pickRelic(run,seed+'|relic'),choice:null,source_key:null,target_key:null};
}
function grant(run,card,rewardId){
  if(run.reward_claims.some(c=>c.id===rewardId))fail('이미 지급한 카드야.');
  const entry=run.collection.find(e=>e.card.identity_key===card.identity_key);
  if(entry){if(!equal(entry.card,card))fail('카드의 저장 정보가 달라.');entry.count=integer(entry.count+1,1,9999,'카드 보유 매수');}
  else{if(run.collection.some(e=>e.card.slot===card.slot))fail('같은 카드 번호가 다른 카드로 교체됐어.');run.collection.push({card:clone(card),count:1});}
  run.reward_claims.push({id:rewardId,identity_key:card.identity_key,count:1});
}
function acquireRelic(run,relicId){
  const relic=RELICS.find(r=>r.id===relicId);if(!relic||run.relics.includes(relicId))fail('아직 보유하지 않은 유물을 골라줘.');
  if(run.max_lp+(relic.max_lp||0)>MAX_RUN_LP)fail('최대 LP 한계 때문에 이 유물을 받을 수 없어.');
  run.relics.push(relicId);run.max_lp+=relic.max_lp||0;
}
function removeOne(run,identityKey,{nodeId,kind,replacement=null}={}){
  const entry=run.collection.find(e=>e.card.identity_key===identityKey);if(!entry)fail('원정에서 보유한 카드를 골라줘.');
  const before=entry.count,card=clone(entry.card),used=['main','extra'].reduce((n,g)=>n+run.active_deck.groups[g].filter(r=>r.identity_key===identityKey).reduce((n,r)=>n+r.count,0),0);
  if(used>before)fail('활성 덱이 원정 보유 매수를 초과했어.');
  let deckGroup=null;
  if(used>before-1){
    deckGroup=['main','extra'].find(g=>run.active_deck.groups[g].some(r=>r.identity_key===identityKey));
    const rows=run.active_deck.groups[deckGroup],row=rows.find(r=>r.identity_key===identityKey);row.count--;if(!row.count)rows.splice(rows.indexOf(row),1);
    if(replacement){
      const problem=placementError(replacement,deckGroup);if(problem)fail('활성 덱의 마지막 복사본은 다른 덱 위치 카드로 교환할 수 없어. 여분 카드를 골라줘.');
      const next=rows.find(r=>r.identity_key===replacement.identity_key);if(next)next.count++;else rows.push(cardLine(replacement));
    }
  }
  entry.count--;if(!entry.count)run.collection.splice(run.collection.indexOf(entry),1);
  const owned=new Map(run.collection.map(e=>[e.card.identity_key,e.count]));
  const totals=new Map();for(const group of ['main','extra'])for(const row of run.active_deck.groups[group])totals.set(row.identity_key,(totals.get(row.identity_key)||0)+row.count);
  if([...totals].some(([id,count])=>count>(owned.get(id)||0)))fail('제거 후 활성 덱이 카드 보유 매수를 초과해.');
  const validation=validatePlayerDeck(run.active_deck,run.collection.map(e=>e.card));
  if(!validation.valid)fail(validation.issues.join(' '));
  const loss={id:claimId(nodeId,kind==='shop_remove'?'remove':'exchange'),node_id:nodeId,kind,card,count:1,before_count:before,after_count:before-1,deck_group:deckGroup,target_key:replacement?.identity_key??null};
  run.nodes150.removals.push(loss);return loss;
}
const why=callback=>{try{callback();return '';}catch(error){return error.message;}};
function exchangeTarget(event,card){const tier=event.kind==='card_reforge'?gradeUp[card.rarity]:card.rarity;return (event.targets[tier]||[]).find(c=>c.identity_key!==card.identity_key)||null;}
function quoteRemoval(run,shop,card){return why(()=>{if(shop.removal_used)fail('이 상점에서는 이미 1매를 제거했어.');const price=shopPrice150(75+25*run.nodes150.removals.filter(r=>r.kind==='shop_remove').length,run.relics);if(run.gold<price)fail('원정 금화가 부족해.');removeOne(clone(run),card.identity_key,{nodeId:shop.node_id,kind:'shop_remove'});});}
function applyEvent(run,event,identityKey){
  if(event.choice!==null)fail('이 이벤트에서는 이미 선택을 마쳤어.');
  if(event.kind==='healing_pool'){
    if(run.gold<50)fail('원정 금화가 부족해.');if(run.lp>=run.max_lp)fail('이미 LP가 가득 차 있어.');run.gold-=50;run.lp=Math.min(run.max_lp,run.lp+1000);
  }else if(event.kind==='life_inscription'){
    if(run.lp<=300)fail('LP 300을 지불한 뒤에도 LP가 1 이상 남아야 해.');if(run.max_lp>MAX_RUN_LP-500)fail('최대 LP 한계 때문에 비문을 읽을 수 없어.');run.lp-=300;run.max_lp+=500;
  }else if(event.kind==='golden_idol'){
    if(run.lp<=500)fail('LP 500을 지불한 뒤에도 LP가 1 이상 남아야 해.');run.lp-=500;run.gold=integer(run.gold+120,0,2000000000,'원정 금화');
  }else if(['mirror_exchange','card_reforge'].includes(event.kind)){
    const entry=run.collection.find(e=>e.card.identity_key===identityKey);if(!entry)fail('교환할 보유 카드를 1장 골라줘.');
    const target=exchangeTarget(event,entry.card);if(!target)fail('이 카드 등급에 맞는 교환 후보가 없어. 다른 카드를 골라줘.');
    if(event.kind==='card_reforge'){if(run.gold<75)fail('원정 금화가 부족해.');run.gold-=75;}
    // Grant and loss are committed together. If deck legality fails, the caller
    // discards this clone and neither cost, card, history nor revision is saved.
    grant(run,target,claimId(event.node_id,'event'));
    removeOne(run,identityKey,{nodeId:event.node_id,kind:'event_exchange',replacement:target});
    event.source_key=identityKey;event.target_key=target.identity_key;
  }else if(event.kind==='card_duplication'){
    const entry=run.collection.find(e=>e.card.identity_key===identityKey);if(!entry)fail('복제할 보유 카드를 1장 골라줘.');
    grant(run,entry.card,claimId(event.node_id,'event'));event.source_key=identityKey;event.target_key=identityKey;
  }else if(event.kind==='relic_bargain'){
    if(run.lp<=800)fail('LP 800을 지불한 뒤에도 LP가 1 이상 남아야 해.');acquireRelic(run,event.relic_id);run.lp-=800;
  }else fail('지원하지 않는 이벤트야.');
  event.choice='accept';event.status='resolved';
}
function reachable(run){
  if(run.state!=='between_nodes'||run.lp<1||!['idle','resolved'].includes(run.bridge147?.phase))return [];
  return run.current_node_id===null?run.map.nodes.filter(n=>n.floor===1).map(n=>n.id):run.map.nodes.find(n=>n.id===run.current_node_id)?.next||[];
}

export function applyNodeAction150(input,action,args,cards,{normalize}={}){
  const run=clone(input),node=mapNode(run,args.node_id),extension=run.nodes150??emptyNodes150();run.nodes150=extension;
  if(!['shop','event'].includes(node.kind))fail('상점이나 이벤트 칸을 선택해줘.');
  if(!['idle','resolved'].includes(run.bridge147?.phase)||run.lp<1)fail('전투·보상 처리 중이거나 LP가 없어 이 칸을 사용할 수 없어.');
  const bucket=node.kind==='shop'?extension.shops:extension.events;
  if(action==='enter_node'){
    if(run.state==='at_node'&&run.current_node_id===node.id&&bucket[node.id]&&bucket[node.id].status!=='left')return {run:input,changed:false};
    if(!reachable(run).includes(node.id)||bucket[node.id])fail('이어지는 다음 상점·이벤트를 선택해줘.');
    bucket[node.id]=node.kind==='shop'?makeShop(run,node,cards):makeEvent(run,node,cards);
    run.floor=node.floor;run.current_node_id=node.id;run.state='at_node';run.bridge147.phase='resolved';
    run.history.push({kind:'enter_node150',node_id:node.id,node_kind:node.kind});
    return {run,changed:true};
  }
  const visit=bucket[node.id];
  if(!visit||visit.status==='left'||run.state!=='at_node'||run.current_node_id!==node.id)fail('현재 도착한 상점·이벤트에서만 사용할 수 있어.');
  if(action==='leave_node'){
    if(node.kind==='event'&&visit.choice===null)fail('이벤트에서 선택하거나 건너뛰기를 눌러줘.');
    visit.status='left';run.state='between_nodes';run.history.push({kind:'leave_node150',node_id:node.id,node_kind:node.kind});
  }else if(action==='buy_card'){
    if(node.kind!=='shop')fail('상점에서만 구매할 수 있어.');
    if(args.item_id==='relic'){
      const item=visit.relic;if(!item||item.purchased)fail('구매할 수 있는 유물이 없어.');
      const price=shopPrice150(item.base_price,run.relics);if(run.gold<price)fail('원정 금화가 부족해.');
      acquireRelic(run,item.relic_id);run.gold-=price;item.purchased=true;
      run.history.push({kind:'shop_relic150',node_id:node.id,relic_id:item.relic_id,price});
    }else{
      const item=visit.cards.find(i=>i.id===args.item_id);if(!item||item.purchased)fail('이미 판매됐거나 없는 상품이야.');
      const price=shopPrice150(item.base_price,run.relics);if(run.gold<price)fail('원정 금화가 부족해.');
      grant(run,item.card,claimId(node.id,item.id));run.gold-=price;item.purchased=true;item.claim_id=claimId(node.id,item.id);
      run.history.push({kind:'shop_card150',node_id:node.id,item_id:item.id,identity_key:item.card.identity_key,price});
    }
  }else if(action==='remove_card'){
    if(node.kind!=='shop'||args.count!==undefined&&args.count!==1)fail('상점 한 번 방문당 카드 1매만 제거할 수 있어.');
    if(visit.removal_used)fail('이 상점에서는 이미 카드를 1매 제거했어.');
    const price=shopPrice150(75+25*extension.removals.filter(r=>r.kind==='shop_remove').length,run.relics);
    if(run.gold<price)fail('원정 금화가 부족해.');
    removeOne(run,args.identity_key,{nodeId:node.id,kind:'shop_remove'});visit.removal_used=true;run.gold-=price;
    run.history.push({kind:'shop_remove150',node_id:node.id,identity_key:args.identity_key,price});
  }else if(action==='event_choice'){
    if(node.kind!=='event'||visit.choice!==null)fail('선택을 기다리는 이벤트가 아니야.');
    if(args.choice==='skip'){visit.choice='skip';visit.status='resolved';}
    else if(args.choice==='accept')applyEvent(run,visit,args.identity_key);
    else fail('이벤트에서 선택하거나 건너뛰기를 눌러줘.');
    run.history.push({kind:'event_choice150',node_id:node.id,event_kind:visit.kind,choice:visit.choice,source_key:visit.source_key,target_key:visit.target_key});
  }else fail('지원하지 않는 상점·이벤트 명령이야.');
  if(normalize)normalize(run);return {run,changed:true};
}

// Read-only UI projection; current catalog is intentionally unused once entered.
// Return null for unentered nodes rather than generating a speculative reroll.
export function inspectNode150(run,nodeId,cards){
  const node=run.map?.nodes.find(n=>n.id===nodeId);if(!node)return null;
  const visit=run.nodes150?.[node.kind==='shop'?'shops':'events']?.[nodeId];if(!visit)return null;
  const active=run.current_node_id===nodeId&&run.state==='at_node'&&visit.status!=='left'&&['idle','resolved'].includes(run.bridge147?.phase)&&run.lp>0;
  const locked=active?'':'지금 방문 중인 상점·이벤트가 아니야.';
  const result={node_id:nodeId,kind:node.kind,status:visit.status,gold:run.gold,cards:[],relic:null,removal:null,event:null,can_leave:active&&(node.kind==='shop'||visit.choice!==null),leave_reason:locked||(node.kind==='event'&&visit.choice===null?'이벤트를 선택하거나 건너뛰어줘.':'')};
  if(node.kind==='shop'){
    result.cards=visit.cards.map(item=>{
      const price=shopPrice150(item.base_price,run.relics),reason=locked||item.purchased&&'이미 구매한 카드야.'||run.gold<price&&'원정 금화가 부족해.'||why(()=>grant(clone(run),item.card,claimId(nodeId,item.id)));
      return {...clone(item),price,disabled:!!reason,reason};
    });
    if(visit.relic){const item=visit.relic,relic=RELICS.find(r=>r.id===item.relic_id),price=shopPrice150(item.base_price,run.relics),reason=locked||item.purchased&&'이미 구매한 유물이야.'||run.gold<price&&'원정 금화가 부족해.'||why(()=>acquireRelic(clone(run),item.relic_id));result.relic={...clone(item),name:relic.name,description:relic.description,price,disabled:!!reason,reason};}
    const price=shopPrice150(75+25*run.nodes150.removals.filter(r=>r.kind==='shop_remove').length,run.relics);
    const choices=run.collection.map(e=>{const reason=locked||quoteRemoval(run,visit,e.card);return {identity_key:e.card.identity_key,card:clone(e.card),count:e.count,disabled:!!reason,reason};});
    const reason=locked||visit.removal_used&&'이번 방문에서 이미 1매를 제거했어.'||run.gold<price&&'원정 금화가 부족해.'||!choices.some(c=>!c.disabled)&&'메인 덱 20장을 유지하며 제거할 카드가 없어.'||'';
    result.removal={price,used:visit.removal_used,choices,disabled:!!reason,reason};
  }else{
    const definition=eventDefinition(visit.kind),exchange=['mirror_exchange','card_reforge'].includes(visit.kind),resolved=visit.choice!==null;
    const selectCard=exchange||visit.kind==='card_duplication';
    const choices=selectCard?run.collection.map(e=>{const target=visit.kind==='card_duplication'?e.card:exchangeTarget(visit,e.card),reason=locked||resolved&&'이미 선택을 마쳤어.'||why(()=>{const trial=clone(run);applyEvent(trial,trial.nodes150.events[nodeId],e.card.identity_key);});return {identity_key:e.card.identity_key,card:clone(e.card),count:e.count,target:target?clone(target):null,disabled:!!reason,reason};}):[];
    const reason=locked||resolved&&'이미 선택을 마쳤어.'||(selectCard?(!choices.some(c=>!c.disabled)?'현재 선택할 수 있는 보유 카드가 없어.':''):why(()=>{const trial=clone(run);applyEvent(trial,trial.nodes150.events[nodeId]);}));
    result.event={id:visit.kind,title:definition.title,description:definition.description,choice:visit.choice,choices:[{id:'accept',name:definition.name,description:definition.effect,disabled:!!reason,reason},{id:'skip',name:'그냥 지나간다',description:'카드·금화·LP를 그대로 유지해.',disabled:!active||resolved,reason:locked||resolved&&'이미 선택을 마쳤어.'||''}],cards:choices};
  }
  return result;
}
