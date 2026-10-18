import {EXTRA_EVENTS163,buildEventOptions163,applyExpansionEvent163,cleanExpansionOptions163,cleanExpansionOutcome163,inspectExpansion163,validateExpansionReward163} from './roguelite166-events.js?v=20261018-166';
import {applyEnhancementEvent166,eventOptions166} from './roguelite166-enhancement.js?v=20261018-166';
import * as legacyNodes157 from './roguelite157-nodes.js?v=20261017-157';
import * as legacyNodes158 from './roguelite159-nodes.js?v=20261017-159';
import {snapshotCard} from './roguelite-card.js?v=20261014-139';
import {eligibleRewardCards} from './roguelite-rewards.js?v=20261014-139';
import {contentPolicy163,relicMeta163,eventMeta163,pickRelic163,weighted157,shopPrice163,RELICS} from './roguelite166-rules.js?v=20261018-166';
import {grant163,removeHeld163,removeDeckTwo163,validateDeck163,acquireRelic163,loseRelic163} from './roguelite166-ledger.js?v=20261018-166';
import {recipePools163,deterministic163,aggregateCards163,fusionGrant163,ritualGrant163} from './roguelite163-recipes.js?v=20261018-163';
import {instanceCards163} from './roguelite166-instances.js?v=20261018-166';
import * as frozen163 from './roguelite164-nodes.js?v=20261018-164';
export const emptyNodes150=legacyNodes157.emptyNodes150,cleanNodes150=legacyNodes157.cleanNodes150,isEmptyNodes150=legacyNodes157.isEmptyNodes150;
const fail=m=>{throw Error(m);},clone=structuredClone,eq=(a,b)=>canonical163(a)===canonical163(b),record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
// Python's durable JSON writer sorts object keys. Key order is not card or encounter identity.
function canonical163(value){return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),key=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const int=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
function exact(v,keys,label){if(!record(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail(`${label} 형식을 확인해줘.`);}
export const emptyNodes163=()=>({schema:1,shops:{},events:{},removals:[],acquisitions:[],relic_losses:[],race_bias:null,pending_reward:null,reward_offers:[],consumables:{},uses:[]});
export const isEmptyNodes163=v=>eq(v,emptyNodes163());
export const nodeSeed163=(run,node)=>`nodes163|${run.seed}|${node.id}|${run.area??1}`;
export const claim163=(node,suffix)=>`n163_${node}_${suffix}`;
export function shuffled163(items,seed){const pool=[...items],out=[];for(let i=0;pool.length;i++){const chosen=deterministic163(pool,`${seed}|${i}`);out.push(chosen);pool.splice(pool.indexOf(chosen),1);}return out;}
const poolFor=(run,cards)=>eligibleRewardCards(cards).filter(card=>!run.collection.some(e=>e.card.slot===card.slot&&e.card.identity_key!==card.identity_key||e.card.identity_key===card.identity_key&&!eq(e.card,card)));
const eventId=(run,seed)=>weighted157(contentPolicy163(run).events.filter(row=>row.enabled),seed+'|event163')?.id??null;
const findNode=(run,nodeId)=>{const node=run.map?.nodes.find(n=>n.id===nodeId);if(!node||!['shop','event'].includes(node.kind))fail('지도에 있는 상점·이벤트를 골라줘.');return node;};
const reachable=run=>run.state!=='between_nodes'||run.lp<1||!['idle','resolved'].includes(run.bridge147?.phase)?[]:run.current_node_id===null?run.map.nodes.filter(n=>n.floor===1).map(n=>n.id):run.map.nodes.find(n=>n.id===run.current_node_id)?.next||[];
const why=fn=>{try{fn();return '';}catch(error){return error.message;}};
export function cleanNodes163(value,run){
 if(run.content_version!=='campaign166-v1')return frozen163.cleanNodes163(value,run);
 exact(value,Object.keys(emptyNodes163()),'확장 원정 기록');if(value.schema!==1||!record(value.shops)||!record(value.events)||!record(value.consumables)||!['removals','acquisitions','relic_losses','reward_offers','uses'].every(k=>Array.isArray(value[k])&&value[k].length<=1000)||Object.keys(value.shops).length+Object.keys(value.events).length>500)fail('확장 원정 기록의 크기·버전을 확인해줘.');
 const out=clone(value),policy=contentPolicy163(run),acq=new Map(),losses=new Set(),lossIds=new Set();
 const snapshotMap=new Map();
 const preserve=source=>{const card=snapshotCard(source),old=snapshotMap.get(card.identity_key),owned=run.collection.find(e=>e.card.identity_key===card.identity_key);if(old&&!eq(old,card)||owned&&!eq(owned.card,card)||run.collection.some(e=>e.card.slot===card.slot&&e.card.identity_key!==card.identity_key))fail('저장된 카드 스냅샷·식별값이 달라.');snapshotMap.set(card.identity_key,card);return card;};
 const visit=(nodeId,status)=>{const node=findNode(run,nodeId);if(!id(nodeId)||node.floor>run.floor||node.floor===run.floor&&run.current_node_id!==nodeId||node.floor<run.floor&&status!=='left')fail('방문 기록과 현재 위치가 일치하지 않아.');return node;};
 for(const row of out.acquisitions){exact(row,['id','relic_id','max_lp_added','gold_added','grant_ids'],'유물 획득');const meta=policy.relics.find(r=>r.id===row.relic_id);if(!id(row.id)||acq.has(row.id)||!meta||row.gold_added!==(row.relic_id==='golden_pot'?meta.params.gold:0)||row.max_lp_added!==(['life_fragment','bone'].includes(row.relic_id)?meta.params.max_lp:0)||!Array.isArray(row.grant_ids)||row.grant_ids.some(k=>!run.reward_claims.some(c=>c.id===k)))fail('유물 획득과 카드 지급이 일치하지 않아.');acq.set(row.id,row);}
 for(const row of out.relic_losses){
  exact(row,['id','node_id','relic_id','acquisition_id','kind','use_id'],'유물 공양·소진');const gain=acq.get(row.acquisition_id),event=out.events[row.node_id],use=out.uses.find(u=>u.use_id===row.use_id);
  const recovery=row.kind==='relic_recovery'&&row.use_id===null&&event?.kind==='relic_recovery'&&event.choice==='accept'&&event.removed_relic_id===row.relic_id;
  const consumed=row.kind==='consumed'&&row.id===row.use_id&&use?.charged===true&&use.item_id===row.relic_id&&use.acquisition_id===row.acquisition_id&&out.uses.filter(u=>u.acquisition_id===row.acquisition_id&&u.charged).length===policy.relics.find(r=>r.id===row.relic_id)?.params.charges;
  if(!id(row.id)||lossIds.has(row.id)||losses.has(row.acquisition_id)||!gain||gain.relic_id!==row.relic_id||(!recovery&&!consumed))fail('유물을 잃거나 소진한 기록이 일치하지 않아.');lossIds.add(row.id);losses.add(row.acquisition_id);
 }
 const held=out.acquisitions.filter(row=>!losses.has(row.id)).map(row=>row.relic_id);if(new Set(held).size!==held.length||held.length!==run.relics.length||held.some(id=>!run.relics.includes(id)))fail('유물 획득·공양과 현재 보유 유물이 일치하지 않아.');
 const removalIds=new Set();for(const row of out.removals){exact(row,['id','node_id','kind','card','count','before_count','after_count','deck_group','target_key'],'영구 카드 제거');row.card=preserve(row.card);if(!id(row.id)||removalIds.has(row.id)||row.count!==1||!int(row.before_count,1,9999)||row.after_count!==row.before_count-1||![null,'main','extra'].includes(row.deck_group)||!['shop_remove','shop_sell','event_exchange','twin_sacrifice','evolution','mana_furnace','deck_transform'].includes(row.kind)||row.target_key!==null&&!key(row.target_key))fail('영구 카드 제거의 전후 매수가 달라.');removalIds.add(row.id);}
 const uses=new Set();for(const row of out.uses){exact(row,['use_id','item_id','target_id','acquisition_id','attempt_id','session_id','launch_nonce','launch_sha256','status','charged','receipt_sha256','reason'],'소모품 사용');const gain=acq.get(row.acquisition_id);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.use_id)||uses.has(row.use_id)||(['destruction_scroll','reload'].includes(row.item_id)?!key(row.target_id):row.target_id!==null)||!gain||gain.relic_id!==(['reload','reload_skip'].includes(row.item_id)?'reload':row.item_id)||!['draw_scroll','draw_tome','healing_potion','greater_healing_potion','destruction_scroll','flame_scroll','lizard_tail','reload','reload_skip'].includes(row.item_id)||!['reserved','rejected','accepted','applied','interrupted'].includes(row.status)||row.charged!==['accepted','applied','interrupted'].includes(row.status)||!['attempt_id','session_id','launch_nonce'].every(k=>typeof row[k]==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(row[k]))||!key(row.launch_sha256)||(row.status==='reserved'?row.receipt_sha256!==null:!key(row.receipt_sha256))||typeof row.reason!=='string'||row.reason.length>1000)fail('소모품 영수증과 차감 기록이 달라.');uses.add(row.use_id);}
 if(out.uses.filter(row=>['reserved','accepted'].includes(row.status)).length>1)fail('소모품 요청이 겹쳐 있어.');
 for(const [itemId,item] of Object.entries(out.consumables)){exact(item,['acquisition_id','total','remaining'],'소모품 횟수');const gain=acq.get(item.acquisition_id),meta=policy.relics.find(r=>r.id===itemId);if(!gain||gain.relic_id!==itemId||!meta||item.total!==meta.params.charges||!int(item.remaining,0,item.total)||item.remaining!==item.total-out.uses.filter(row=>row.acquisition_id===item.acquisition_id&&row.charged).length)fail('소모품의 남은 횟수가 영수증과 달라.');}
 for(const itemId of ['draw_scroll','draw_tome','healing_potion','greater_healing_potion','destruction_scroll','flame_scroll','lizard_tail']){const latest=[...out.acquisitions].reverse().find(a=>a.relic_id===itemId);if(latest&&out.consumables[itemId]?.acquisition_id!==latest.id)fail('최근 소모품 획득과 남은 횟수가 달라.');}
 if(out.race_bias!==null){exact(out.race_bias,['race','multiplier','node_id'],'종족 문장');if(typeof out.race_bias.race!=='string'||!out.race_bias.race||out.race_bias.multiplier!==eventMeta163(run,'race_blessing').params.multiplier||out.events[out.race_bias.node_id]?.kind!=='race_blessing'||out.events[out.race_bias.node_id].race!==out.race_bias.race)fail('종족 문장과 선택한 이벤트가 달라.');}
 for(const [nodeId,shop] of Object.entries(out.shops)){
  exact(shop,['node_id','area','seed_key','status','shop_version','cards','relics','pair_groups','removal_used','refresh_count','past_offers'],'상점 재고');const node=visit(nodeId,shop.status);if(node.kind!=='shop'||shop.node_id!==nodeId||shop.shop_version!==164||!['open','left'].includes(shop.status)||shop.seed_key!==nodeSeed163({...run,area:shop.area},node)||!int(shop.area,1,10000)||!Array.isArray(shop.cards)||shop.cards.length>160||!Array.isArray(shop.relics)||shop.relics.length>RELICS.length||!Array.isArray(shop.pair_groups)||shop.pair_groups.length!==2||typeof shop.removal_used!=='boolean'||!int(shop.refresh_count,0,1000)||!Array.isArray(shop.past_offers)||shop.past_offers.length!==shop.refresh_count)fail('상점 방문 기록을 확인해줘.');
  const itemIds=new Set();for(const item of shop.cards){exact(item,['id','group','card','base_price','stock','remaining','claim_ids'],'상점 카드');item.card=preserve(item.card);if(!id(item.id)||itemIds.has(item.id)||!['random','fixed','fusion','ritual'].includes(item.group)||item.base_price!==policy.shop.card_prices[item.card.rarity]||!int(item.stock,1,99)||!int(item.remaining,0,item.stock)||!Array.isArray(item.claim_ids)||item.claim_ids.length!==item.stock-item.remaining||item.claim_ids.some((claim,i)=>claim!==claim163(nodeId,`${item.id}_${i}`)||!run.reward_claims.some(r=>r.id===claim&&r.identity_key===item.card.identity_key&&r.count===1)))fail('상점 카드 가격·재고·지급 기록이 달라.');itemIds.add(item.id);}
  const relicIds=new Set();for(const item of shop.relics){exact(item,['id','group','relic_id','base_price','purchased'],'상점 유물');const meta=policy.relics.find(r=>r.id===item.relic_id);if(!id(item.id)||itemIds.has(item.id)||relicIds.has(item.relic_id)||!['random','fixed'].includes(item.group)||!meta||!meta.enabled||!meta.shop_enabled||item.base_price!==policy.shop.relic_prices[meta.rarity]||typeof item.purchased!=='boolean'||item.purchased&&!acq.has(claim163(nodeId,item.id)))fail('상점 유물과 획득 기록이 달라.');itemIds.add(item.id);relicIds.add(item.relic_id);}
  if(new Set(shop.pair_groups.map(g=>g.id)).size!==2)fail('정식 소환 진열 그룹이 중복됐어.');
  for(const group of shop.pair_groups){exact(group,['id','title','recipe','item_ids','reason'],'정식 소환 진열');if(!['fusion','ritual'].includes(group.id)||typeof group.title!=='string'||typeof group.reason!=='string'||!Array.isArray(group.item_ids)||group.item_ids.some(id=>!shop.cards.some(item=>item.id===id&&item.group===group.id)))fail('정식 소환 진열 카드가 누락됐어.');
   const rows=shop.cards.filter(c=>c.group===group.id);if(rows.length!==group.item_ids.length||new Set(group.item_ids).size!==rows.length)fail('정식 소환 진열 재고가 달라.');
   if(group.recipe===null){if(rows.length||!group.reason)fail('빈 소환 후보의 재고가 잘못됐어.');}
   else{
    const book=run.recipe_book163,known=group.id==='fusion'?book.fusions.some(r=>eq(r,group.recipe)):book.rituals.some(r=>eq(r,group.recipe));
    if(!known||group.reason)fail('설치된 정식 소환 식과 진열이 달라.');
    const keys=group.id==='fusion'?[group.recipe.fusion,book.fusion_spell,...group.recipe.materials]:[group.recipe.monster,group.recipe.spell],counts=new Map();for(const k of keys)counts.set(k,(counts.get(k)||0)+1);
    const actual=new Map();for(const row of rows)actual.set(row.card.identity_key,(actual.get(row.card.identity_key)||0)+row.stock);
    if(rows.some(r=>r.stock!==1)||actual.size!==counts.size||[...counts].some(([key,n])=>actual.get(key)!==n))fail('정식 소환 소재 매수와 진열 재고가 달라.');
   }
  }
  if(shop.removal_used!==out.removals.some(row=>row.kind==='shop_remove'&&row.node_id===nodeId))fail('상점 카드 제거 기록이 누락됐어.');
  if(shop.cards.some(item=>item.stock!==1))fail('새 원정 상점의 상품은 한 번 구매하면 품절돼.');
  const claims=new Set(shop.cards.flatMap(item=>item.claim_ids)),oldRelics=new Set(shop.relics.filter(item=>item.purchased).map(item=>claim163(nodeId,item.id)));
  for(const [round,offer]of shop.past_offers.entries()){
   exact(offer,['round','cost','cards','relics'],'이전 상점 상품');
   const paid=run.history.filter(h=>h.kind==='shop_refresh164'&&h.node_id===nodeId&&h.round===round+1);
   if(offer.round!==round||offer.cost!==25*(round+1)||paid.length!==1||paid[0].cost!==offer.cost||!Array.isArray(offer.cards)||offer.cards.length>160||!Array.isArray(offer.relics)||offer.relics.length>RELICS.length)fail('상점 새로고침 횟수·비용 기록이 달라.');
   for(const item of offer.cards){exact(item,['id','group','card','base_price','stock','remaining','claim_ids'],'이전 상점 카드');item.card=preserve(item.card);const claim=claim163(nodeId,`${item.id}_0`);if(!id(item.id)||item.group==='fixed'||!['random','fusion','ritual'].includes(item.group)||item.stock!==1||item.remaining!==0||item.base_price!==policy.shop.card_prices[item.card.rarity]||!eq(item.claim_ids,[claim])||claims.has(claim)||!run.reward_claims.some(r=>r.id===claim&&r.identity_key===item.card.identity_key&&r.count===1))fail('이전 상점 구매 기록이 달라.');claims.add(claim);}
   for(const item of offer.relics){exact(item,['id','group','relic_id','base_price','purchased'],'이전 상점 유물');const meta=policy.relics.find(r=>r.id===item.relic_id),claim=claim163(nodeId,item.id);if(!id(item.id)||item.group!=='random'||!meta||item.base_price!==policy.shop.relic_prices[meta.rarity]||item.purchased!==true||oldRelics.has(claim)||acq.get(claim)?.relic_id!==item.relic_id)fail('이전 상점 유물 구매 기록이 달라.');oldRelics.add(claim);}
  }
 }
 for(const [nodeId,event] of Object.entries(out.events)){
  exact(event,['node_id','area','seed_key','status','event_version','kind','targets','sr_candidates','relic_id','choice','source_keys','target_key','race','challenge','pending_reward_id','removed_relic_id','options163','option163'],'이벤트 기록');const node=visit(nodeId,event.status);if(node.kind!=='event'||event.node_id!==nodeId||event.event_version!==163||event.seed_key!==nodeSeed163({...run,area:event.area},node)||!['open','battle_pending','reward_pending','resolved','left'].includes(event.status)||event.kind!==eventId(run,event.seed_key)||![null,'accept','skip'].includes(event.choice)||!Array.isArray(event.source_keys)||event.source_keys.length>2||event.source_keys.some(k=>!key(k))||!int(event.area,1,10000)||(event.status==='open')!==(event.choice===null)||event.kind===null&&event.choice==='accept')fail('이벤트의 고정 선택 기록이 달라.');
  exact(event.targets,['N','R','SR','UR'],'교환 후보');for(const [tier,list] of Object.entries(event.targets)){if(!Array.isArray(list)||list.length>2)fail('교환 후보가 달라.');event.targets[tier]=list.map(preserve);if(event.targets[tier].some(c=>c.rarity!==tier))fail('교환 후보 등급이 달라.');}
  if(!Array.isArray(event.sr_candidates)||event.sr_candidates.length>5)fail('SR 후보 기록을 확인해줘.');event.sr_candidates=event.sr_candidates.map(preserve);if(event.sr_candidates.some(c=>c.rarity!=='SR')||new Set(event.sr_candidates.map(c=>c.identity_key)).size!==event.sr_candidates.length)fail('특별 SR 후보가 중복됐어.');
  cleanExpansionOptions163(event,{...run,nodes163:out},preserve);
  if(event.choice==='accept'){
   if(['mirror_exchange','card_reforge'].includes(event.kind)){
    const removed=out.removals.filter(r=>r.node_id===nodeId&&r.kind==='event_exchange'),target=Object.values(event.targets).flat().find(c=>c.identity_key===event.target_key);
    if(event.source_keys.length!==1||removed.length!==1||removed[0].card.identity_key!==event.source_keys[0]||removed[0].target_key!==event.target_key||!target||!run.reward_claims.some(c=>c.id===claim163(nodeId,'event')&&c.identity_key===event.target_key&&c.count===1)||target.rarity!==(event.kind==='card_reforge'?{N:'R',R:'SR',SR:'UR'}[removed[0].card.rarity]:removed[0].card.rarity))fail('이벤트 교환·제거·지급이 일치하지 않아.');
   }else if(event.kind==='card_duplication'){if(event.source_keys.length!==1||event.target_key!==event.source_keys[0]||!run.reward_claims.some(c=>c.id===claim163(nodeId,'event')&&c.identity_key===event.target_key&&c.count===1))fail('카드 복제와 지급 기록이 달라.');}
   else if(event.kind==='twin_sacrifice'){
    const removed=out.removals.filter(r=>r.node_id===nodeId&&r.kind==='twin_sacrifice');if(event.source_keys.length!==2||removed.length!==2||removed.some((r,i)=>r.id!==claim163(nodeId,`twin_${i}`)||r.card.identity_key!==event.source_keys[i]||!r.deck_group)||!event.pending_reward_id)fail('두 카드 공양과 특별 보상이 일치하지 않아.');
   }else if(event.kind==='relic_bargain'&&!acq.has(claim163(nodeId,'event_relic')))fail('이벤트 유물 획득이 누락됐어.');
  }
  if(!['mirror_exchange','card_reforge','card_duplication','twin_sacrifice','evolution','mana_furnace','deck_transform'].includes(event.kind)&&event.source_keys.length||!['mirror_exchange','card_reforge','card_duplication','evolution'].includes(event.kind)&&event.target_key!==null||event.kind!=='race_blessing'&&event.race!==null||event.kind!=='relic_recovery'&&event.removed_relic_id!==null||!['challenge_duel','twin_sacrifice','card_choice','mana_furnace'].includes(event.kind)&&event.pending_reward_id!==null)fail('이벤트 종류와 선택한 보상이 달라.');
  cleanExpansionOutcome163(event,{...run,nodes163:out});
  if(event.kind==='race_blessing'&&event.choice==='accept'&&(typeof event.race!=='string'||!event.race.length||event.race.length>50))fail('선택한 몬스터 종족을 확인해줘.');
  if(event.status==='battle_pending'&&(event.kind!=='challenge_duel'||!['accepted','in_battle','draw'].includes(event.challenge?.status)))fail('특별 결투 대기 상태가 달라.');
  if(event.status==='reward_pending'&&out.pending_reward?.node_id!==nodeId)fail('이벤트의 대기 보상이 없어.');
  if(event.kind==='challenge_duel'&&event.choice==='accept'&&event.challenge===null)fail('수락한 특별 결투의 상대가 없어.');
  if(event.challenge!==null){const c=event.challenge;exact(c,['source_node_id','template_id','encounter','status','attempt_id','result_id'],'특별 결투');if(event.kind!=='challenge_duel'||event.choice!=='accept'||!run.encounters[c.source_node_id]||!eq(c.encounter,run.encounters[c.source_node_id])||c.template_id!==c.encounter.template_id||!['accepted','in_battle','won','lost','draw'].includes(c.status)||!(c.attempt_id===null||typeof c.attempt_id==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(c.attempt_id))||!(c.result_id===null||typeof c.result_id==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(c.result_id))||eventMeta163(run,event.kind).params.encounter_key!==null&&eventMeta163(run,event.kind).params.encounter_key!==c.template_id)fail('등록된 특별 결투 상대와 저장된 상대가 달라.');}
 }
 const offerIds=new Set();for(const offer of [...out.reward_offers,...(out.pending_reward?[out.pending_reward]:[])]){
  exact(offer,['id','kind','node_id','candidates','chosen_identity_key'],'특별 보상');const event=out.events[offer.node_id],expanded=['card_choice','mana_furnace'].includes(offer.kind);
  const count=expanded?validateExpansionReward163(offer,event):offer.kind==='challenge_duel'?3:offer.kind==='twin_sacrifice'?5:0;
  if(!id(offer.id)||offerIds.has(offer.id)||!count||event?.pending_reward_id!==offer.id||event?.kind!==offer.kind||event?.choice!=='accept'||!Array.isArray(offer.candidates)||offer.candidates.length!==count||!expanded&&(offer.id!==claim163(offer.node_id,offer.kind==='challenge_duel'?'challenge_SR':'twin_SR')||!eq(offer.candidates,event.sr_candidates.slice(0,count))))fail('특별 보상 후보 수가 달라.');
  offer.candidates=offer.candidates.map(preserve);if(!expanded&&offer.candidates.some(c=>c.rarity!=='SR')||new Set(offer.candidates.map(c=>c.identity_key)).size!==count)fail('특별 보상은 서로 다른 고정 후보여야 해.');
  if(offer===out.pending_reward?offer.chosen_identity_key!==null:!offer.candidates.some(c=>c.identity_key===offer.chosen_identity_key)||!run.reward_claims.some(c=>c.id===offer.id&&c.identity_key===offer.chosen_identity_key&&c.count===1))fail('특별 보상 선택과 지급 기록이 달라.');offerIds.add(offer.id);
 }

 for(const row of out.acquisitions){
  const meta=policy.relics.find(r=>r.id===row.relic_id),claims=row.grant_ids.map(k=>run.reward_claims.find(c=>c.id===k));
  if(new Set(row.grant_ids).size!==row.grant_ids.length||row.grant_ids.some((k,i)=>k!==`${row.id}_g${i}`))fail('유물 카드 지급 번호가 달라.');
  const getCard=k=>run.collection.find(e=>e.card.identity_key===k)?.card??snapshotMap.get(k);
  if(row.relic_id==='rare_cache'){if(claims.length!==meta.params.count||claims.some(c=>c.count!==1||getCard(c.identity_key)?.rarity!=='R'))fail('R 보급함의 카드·매수가 달라.');}
  else if(row.relic_id==='fusion_cache'){
   const actual=new Map(claims.map(c=>[c.identity_key,c.count]));
   if(actual.size!==claims.length||!run.recipe_book163.fusions.some(recipe=>{const wanted=new Map([[recipe.fusion,1],[run.recipe_book163.fusion_spell,1]]);for(const k of recipe.materials)wanted.set(k,(wanted.get(k)||0)+meta.params.material_copies);return wanted.size===actual.size&&[...wanted].every(([k,n])=>actual.get(k)===n);}))fail('융합 보급함의 정식 소재 지급이 달라.');
  }else if(['white_dragon_eye','red_dragon_eye','magician_grimoire'].includes(row.relic_id)){if(claims.length>1||claims.some(c=>c.count!==1||getCard(c.identity_key)?.internal_id!=={white_dragon_eye:0,red_dragon_eye:81,magician_grimoire:34}[row.relic_id]))fail('대체 카드 지급이 달라.');}else if(claims.length)fail('이 유물은 카드 지급 효과가 없어.');
 }
 for(const row of out.removals){const visit=['shop_remove','shop_sell'].includes(row.kind)?out.shops[row.node_id]:out.events[row.node_id];if(!visit||row.kind==='shop_remove'&&row.id!==claim163(row.node_id,'remove')||row.kind==='shop_sell'&&!row.id.startsWith(claim163(row.node_id,'sell_')))fail('영구 제거 기록의 방문이 없어.');}
 for(const gain of out.acquisitions.filter(a=>['draw_scroll','draw_tome','healing_potion','greater_healing_potion','destruction_scroll','flame_scroll','lizard_tail'].includes(a.relic_id))){const total=policy.relics.find(r=>r.id===gain.relic_id).params.charges,charged=out.uses.filter(u=>u.acquisition_id===gain.id&&u.charged).length,consumed=out.relic_losses.some(l=>l.acquisition_id===gain.id&&l.kind==='consumed');if(charged>total||(charged===total)!==consumed)fail('소모품 소진과 총 사용 횟수가 달라.');}
 return out;
}
function makeShop(run,node,cards,round=0){
 const policy=contentPolicy163(run),seedBase=nodeSeed163(run,node),seed=`${seedBase}|refresh164|${round}`,items=[],relics=[],pool=poolFor(run,cards),chosen=[];
 let available=pool.filter(c=>policy.shop.rarity_weights[c.rarity]>0&&(policy.shop.card_pool_mode==='all'||policy.shop.card_pool.includes(c.identity_key)));
 for(let i=0;i<policy.shop.card_count&&available.length;i++){const tiers=['N','R','SR','UR'].filter(id=>available.some(c=>c.rarity===id)).map(id=>({id,weight:policy.shop.rarity_weights[id]})),tier=weighted157(tiers,seed+'|tier|'+i)?.id;if(!tier)break;const card=deterministic163(available.filter(c=>c.rarity===tier),seed+'|random|'+i);chosen.push(card);available=available.filter(c=>c.identity_key!==card.identity_key);}
 const add=(card,count,group,suffix)=>{const ids=[];for(let copy=0;copy<count;copy++){const id=`${group}_g${group==='fixed'?0:round}_${suffix}_${copy}`;items.push({id,group,card:clone(card),base_price:policy.shop.card_prices[card.rarity],stock:1,remaining:1,claim_ids:[]});ids.push(id);}return ids;};
 chosen.forEach((card,i)=>add(card,1,'random',i));policy.shop.fixed_cards.forEach((identity,i)=>{const card=pool.find(c=>c.identity_key===identity);if(card)add(card,1,'fixed',i);});
 const pairs=recipePools163(run.recipe_book163,cards),pair_groups=[];
 for(const kind of ['fusion','ritual']){const pair=deterministic163(pairs[kind==='fusion'?'fusions':'rituals'],seed+'|'+kind),entries=pair?(kind==='fusion'?fusionGrant163(pair,1):ritualGrant163(pair)):[];pair_groups.push({id:kind,title:kind==='fusion'?'정식 융합 소환 카드':'정식 의식 소환 카드',recipe:pair?clone(pair.recipe):null,item_ids:entries.flatMap(({card,count},i)=>add(card,count,kind,i)),reason:pair?'':'설치된 소환 식에 맞는 판매 가능한 카드가 없어.'});}
 for(const relicId of policy.shop.fixed_relics){const meta=relicMeta163(run,relicId);if(meta?.enabled&&meta.shop_enabled&&!run.relics.includes(relicId))relics.push({id:`relic_fixed_${relics.length}`,group:'fixed',relic_id:relicId,base_price:policy.shop.relic_prices[meta.rarity],purchased:false});}
 for(let i=0;i<policy.shop.relic_count;i++){const relicId=pickRelic163(run,seed+'|relic|'+i,{shop:true,excluded:relics.map(r=>r.relic_id)});if(!relicId)break;relics.push({id:`relic_random_g${round}_${i}`,group:'random',relic_id:relicId,base_price:policy.shop.relic_prices[relicMeta163(run,relicId).rarity],purchased:false});}
 return {node_id:node.id,area:run.area??1,seed_key:seedBase,status:'open',shop_version:164,cards:items,relics,pair_groups,removal_used:false,refresh_count:round,past_offers:[]};
}
function makeEvent(run,node,cards){const seed=nodeSeed163(run,node),pool=poolFor(run,cards),targets={};for(const tier of ['N','R','SR','UR'])targets[tier]=shuffled163(pool.filter(c=>c.rarity===tier),seed+'|target|'+tier).slice(0,2);const event={node_id:node.id,area:run.area??1,seed_key:seed,status:'open',event_version:163,kind:eventId(run,seed),targets,sr_candidates:shuffled163(pool.filter(c=>c.rarity==='SR'),seed+'|specialSR').slice(0,5),relic_id:pickRelic163(run,seed+'|relic'),choice:null,source_keys:[],target_key:null,race:null,challenge:null,pending_reward_id:null,removed_relic_id:null,options163:null,option163:null};event.options163=buildEventOptions163(run,event,cards);return event;}

const up={N:'R',R:'SR',SR:'UR'};
function exchangeTarget(event,card){const tier=event.kind==='card_reforge'?up[card.rarity]:card.rarity;return event.targets[tier]?.find(c=>c.identity_key!==card.identity_key);}
export function makeSpecialReward163(run,event,kind){const count=kind==='challenge_duel'?3:5;if(event.sr_candidates.length<count)fail(`서로 다른 SR 보상 카드 ${count}장이 필요해.`);if(run.nodes163.pending_reward)fail('먼저 대기 중인 특별 보상 1장을 골라줘.');const offer={id:claim163(event.node_id,kind==='challenge_duel'?'challenge_SR':'twin_SR'),kind,node_id:event.node_id,candidates:clone(event.sr_candidates.slice(0,count)),chosen_identity_key:null};run.nodes163.pending_reward=offer;event.pending_reward_id=offer.id;event.status='reward_pending';return offer;}
function applyEvent(run,event,args,cards){
 if(event.choice!==null)fail('이미 선택을 마친 이벤트야.');const kind=event.kind,source=run.collection.find(e=>e.card.identity_key===args.identity_key);
 if(kind==='healing_pool'){if(run.gold<50)fail('원정 금화 50이 필요해.');if(run.lp===run.max_lp)fail('이미 LP가 가득 차 있어.');run.gold-=50;run.lp=Math.min(run.max_lp,run.lp+1000);}
 else if(kind==='life_inscription'){if(run.lp<=300)fail('LP 300을 지불한 뒤에도 1 이상 남아야 해.');if(run.max_lp>59500)fail('최대 LP 한계 때문에 비문을 읽을 수 없어.');run.lp-=300;run.max_lp+=500;}
 else if(kind==='golden_idol'){if(run.lp<=500)fail('LP 500을 지불한 뒤에도 1 이상 남아야 해.');if(run.gold>2e9-120)fail('원정 금화 한계에 도달했어.');run.lp-=500;run.gold+=120;}
 else if(['mirror_exchange','card_reforge'].includes(kind)){if(!source)fail('교환할 보유 카드 1장을 골라줘.');const target=exchangeTarget(event,source.card);if(!target)fail('현재 등급에 맞는 교환 후보가 없어.');if(kind==='card_reforge'){if(run.gold<75)fail('원정 금화 75가 필요해.');run.gold-=75;}grant163(run,target,1,claim163(event.node_id,'event'));removeHeld163(run,args.identity_key,{nodeId:event.node_id,kind:'event_exchange',id:claim163(event.node_id,'exchange'),replacement:target});validateDeck163(run);event.source_keys=[args.identity_key];event.target_key=target.identity_key;}
 else if(kind==='card_duplication'){if(!source)fail('복제할 보유 카드 1장을 골라줘.');grant163(run,source.card,1,claim163(event.node_id,'event'));event.source_keys=[args.identity_key];event.target_key=args.identity_key;}
 else if(kind==='relic_bargain'){if(run.lp<=800)fail('LP 800을 지불한 뒤에도 1 이상 남아야 해.');acquireRelic163(run,event.relic_id,claim163(event.node_id,'event_relic'),cards);run.lp-=800;}
 else if(kind==='race_blessing'){const races=new Set(poolFor(run,cards).filter(c=>c.type.includes('몬스터')&&c.race).map(c=>c.race));if(!races.has(args.race))fail('이 원정 보상에 있는 몬스터 종족을 골라줘.');event.race=args.race;run.nodes163.race_bias={race:args.race,multiplier:eventMeta163(run,kind).params.multiplier,node_id:event.node_id};}
 else if(kind==='relic_recovery'){loseRelic163(run,args.relic_id,event.node_id);event.removed_relic_id=args.relic_id;}
 else if(kind==='twin_sacrifice'){if(event.sr_candidates.length<5)fail('서로 다른 SR 보상 후보 5장이 없어. 카드 도감의 보상 설정을 확인해줘.');removeDeckTwo163(run,args.identity_keys,event.node_id);event.source_keys=[...args.identity_keys];makeSpecialReward163(run,event,kind);}
 else if(kind==='challenge_duel'){if(event.sr_candidates.length<3)fail('서로 다른 SR 보상 후보 3장이 없어.');const encounter=run.encounters[args.source_node_id],configured=eventMeta163(run,kind).params.encounter_key;if(!encounter||configured!==null&&configured!==encounter.template_id)fail('현재 원정에 등록된 특별 결투 상대를 골라줘.');event.challenge={source_node_id:args.source_node_id,template_id:encounter.template_id,encounter:clone(encounter),status:'accepted',attempt_id:null,result_id:null};event.status='battle_pending';}
 else if(applyEnhancementEvent166(run,event,args)){}
 else if(applyExpansionEvent163(run,event,args,cards)){}
 else fail('사용할 수 있는 이벤트가 없어. 그냥 지나갈 수 있어.');event.choice='accept';if(!['battle_pending','reward_pending'].includes(event.status))event.status='resolved';
}
const removalPrice=(run)=>{const p=contentPolicy163(run).shop;return shopPrice163(Math.min(2e9,p.removal_price+p.removal_increase*run.nodes163.removals.filter(r=>r.kind==='shop_remove').length),run);};
export function applyNodeAction150(input,action,args,cards,{normalize}={}){
 if(input.content_version!=='campaign166-v1')return frozen163.applyNodeAction150(input,action,args,cards,{normalize});
 if(!input.content163)return legacyNodes158.applyNodeAction150(input,action,args,cards,{normalize});const run=clone(input),node=findNode(run,args.node_id),bucket=run.nodes163[node.kind==='shop'?'shops':'events'];
 if(!['idle','resolved'].includes(run.bridge147?.phase)||run.lp<1||run.nodes163.pending_reward||run.runtime163.rest_reward||run.opening163.status!=='chosen')fail('먼저 진행 중인 전투·보상을 마쳐줘.');
 if(action==='enter_node'){if(run.state==='at_node'&&run.current_node_id===node.id&&bucket[node.id]&&bucket[node.id].status!=='left')return {run:input,changed:false};if(!reachable(run).includes(node.id)||bucket[node.id])fail('이어지는 다음 칸을 골라줘.');const checkpoint={node_id:node.id,floor:run.floor,current_node_id:run.current_node_id,state:run.state},previous=run.runtime163.node_entries.findIndex(e=>e.node_id===node.id);if(previous<0)run.runtime163.node_entries.push(checkpoint);else run.runtime163.node_entries[previous]=checkpoint;bucket[node.id]=node.kind==='shop'?makeShop(run,node,cards):makeEvent(run,node,cards);run.floor=node.floor;run.current_node_id=node.id;run.state='at_node';run.bridge147.phase='resolved';run.history.push({kind:'enter_node163',node_id:node.id,node_kind:node.kind});return {run,changed:true};}
 const visit=bucket[node.id];if(!visit||visit.status==='left'||run.current_node_id!==node.id||run.state!=='at_node')fail('현재 도착한 칸에서만 사용할 수 있어.');
 if(action==='leave_node'){if(node.kind==='event'&&visit.status!=='resolved')fail('선택과 특별 보상·전투를 먼저 마쳐줘.');visit.status='left';run.state='between_nodes';}
 else if(action==='buy_card'){if(node.kind!=='shop')fail('상점에서만 구매할 수 있어.');const relic=visit.relics.find(item=>item.id===args.item_id);if(relic){if(relic.purchased)fail('이미 판매된 유물이야.');const price=shopPrice163(relic.base_price,run);if(run.gold<price)fail('원정 금화가 부족해.');acquireRelic163(run,relic.relic_id,claim163(node.id,relic.id),cards);run.gold-=price;relic.purchased=true;}else{const item=visit.cards.find(item=>item.id===args.item_id);if(!item||item.remaining<1)fail('판매할 카드 재고가 없어.');const price=shopPrice163(item.base_price,run);if(run.gold<price)fail('원정 금화가 부족해.');const claim=claim163(node.id,`${item.id}_${item.stock-item.remaining}`);grant163(run,item.card,1,claim);run.instances163.items.at(-1).purchase_price=price;run.gold-=price;item.remaining--;item.claim_ids.push(claim);}}
 else if(action==='refresh_shop'){
  if(node.kind!=='shop')fail('방문 중인 상점에서만 새로고침할 수 있어.');
  const round=visit.refresh_count+1,cost=25*round;if(round>1000)fail('이 상점의 기록 한도에 도달했어.');if(run.gold<cost)fail('상점 새로고침에 필요한 원정 금화가 부족해.');
  const next=makeShop(run,node,cards,round);
  // Always-stocked purchases stay sold out for this visit. Only the random
  // stock and summon pairs reroll, with fresh claim IDs for every offer.
  next.cards=[...next.cards.filter(i=>i.group!=='fixed'),...clone(visit.cards.filter(i=>i.group==='fixed'))];
  next.relics=[...next.relics.filter(i=>i.group!=='fixed'),...clone(visit.relics.filter(i=>i.group==='fixed'))];
  next.past_offers=[...clone(visit.past_offers),{round:round-1,cost,cards:clone(visit.cards.filter(i=>i.group!=='fixed'&&i.remaining===0)),relics:clone(visit.relics.filter(i=>i.group!=='fixed'&&i.purchased))}];
  run.nodes163.shops[node.id]=next;run.gold-=cost;run.history.push({kind:'shop_refresh164',node_id:node.id,round,cost});
 }
 else if(action==='sell_card'){if(node.kind!=='shop'||args.count!==undefined&&args.count!==1)fail('상점에서 카드 1매를 골라 판매해줘.');const option=saleOptions163(run,node.id).find(r=>r.instance_id===args.instance_id);if(!option||option.disabled)fail(option?.reason||'판매할 카드 1매를 골라줘.');const saleId=claim163(node.id,`sell_${args.instance_id}`);removeHeld163(run,option.identity_key,{nodeId:node.id,kind:'shop_sell',id:saleId,instanceId:args.instance_id});validateDeck163(run);run.gold+=option.price;run.history.push({kind:'shop_sell163',id:saleId,node_id:node.id,instance_id:args.instance_id,identity_key:option.identity_key,price:option.price,basis_price:option.basis_price,atk_bonus:option.atk_bonus,def_bonus:option.def_bonus});}
 else if(action==='event_choice'){if(node.kind!=='event'||visit.choice!==null)fail('선택을 기다리는 이벤트가 아니야.');if(args.choice==='skip'){visit.choice='skip';visit.status='resolved';}else if(args.choice==='accept')applyEvent(run,visit,args,cards);else fail('선택하거나 그냥 지나가기를 골라줘.');}
 else fail('지원하지 않는 상점·이벤트 작업이야.');run.history.push({kind:'node_action163',node_id:node.id,action,choice:args.choice??null,item_id:args.item_id??null});if(normalize)normalize(run);return {run,changed:true};
}
export function inspectNode150(run,nodeId,cards){
 if(run.content_version!=='campaign166-v1')return frozen163.inspectNode150(run,nodeId,cards);
 if(!run.content163)return legacyNodes158.inspectNode150(run,nodeId,cards);const node=run.map?.nodes.find(n=>n.id===nodeId),visit=node&&run.nodes163[node.kind==='shop'?'shops':'events']?.[nodeId];if(!visit)return null;
 const active=run.current_node_id===nodeId&&run.state==='at_node'&&['idle','resolved'].includes(run.bridge147?.phase)&&visit.status!=='left'&&!run.nodes163.pending_reward,locked=active?'':'현재 방문 중이거나 처리 가능한 칸이 아니야.';
 const out={node_id:nodeId,kind:node.kind,status:visit.status,gold:run.gold,cards:[],relics:[],pair_groups:[],removal:null,event:null,can_leave:active&&(node.kind==='shop'||visit.status==='resolved'),leave_reason:locked||(visit.status!=='resolved'&&node.kind==='event'?'선택·특별 결투·보상을 마쳐줘.':'')};
 if(node.kind==='shop'){
  out.refresh={count:visit.refresh_count,price:25*(visit.refresh_count+1),disabled:!!locked||visit.refresh_count>=1000||run.gold<25*(visit.refresh_count+1),reason:locked||(visit.refresh_count>=1000?'이 상점의 기록 한도에 도달했어.':run.gold<25*(visit.refresh_count+1)?'원정 금화가 부족해.':'')};
  out.cards=visit.cards.map(item=>{const price=shopPrice163(item.base_price,run),reason=locked||item.remaining===0&&'판매 완료'||run.gold<price&&'원정 금화가 부족해.'||why(()=>grant163(clone(run),item.card,1,claim163(nodeId,`${item.id}_${item.stock-item.remaining}`)));return {...clone(item),price,purchased:item.remaining===0,disabled:!!reason,reason};});
  out.relics=visit.relics.map(item=>{const meta=relicMeta163(run,item.relic_id),price=shopPrice163(item.base_price,run),reason=locked||item.purchased&&'판매 완료'||run.gold<price&&'원정 금화가 부족해.'||why(()=>acquireRelic163(clone(run),item.relic_id,claim163(nodeId,item.id),cards));return {...meta,...clone(item),description:meta.effect_text,price,disabled:!!reason,reason};});out.pair_groups=clone(visit.pair_groups);
  const choices=saleOptions163(run,nodeId,locked);const reason=locked||!choices.some(c=>!c.disabled)&&'메인 덱 20장을 유지하며 판매할 수 있는 카드가 없어.'||'';out.removal={price:0,used:false,choices,disabled:!!reason,reason,selling:true};out.sale=out.removal;
 }else{
  const meta=eventMeta163(run,visit.kind)??{title:'고요한 방',description:'만날 수 있는 이벤트가 없어. 그대로 지나갈 수 있어.',name:'등록된 이벤트 없음',effect_text:'현재 진행은 그대로 유지돼.'},resolved=visit.choice!==null,selectCard=['mirror_exchange','card_reforge','card_duplication'].includes(visit.kind),cardChoices=selectCard?run.collection.map(entry=>{const reason=locked||resolved&&'이미 선택했어.'||why(()=>{const trial=clone(run);applyEvent(trial,trial.nodes163.events[nodeId],{identity_key:entry.card.identity_key},cards);});return {...clone(entry),identity_key:entry.card.identity_key,target:visit.kind==='card_duplication'?clone(entry.card):exchangeTarget(visit,entry.card)??null,disabled:!!reason,reason};}):[];
  const races=visit.kind==='race_blessing'?[...new Set(poolFor(run,cards).filter(c=>c.type.includes('몬스터')&&c.race).map(c=>c.race))].sort():[];
  const encounters=visit.kind==='challenge_duel'?Object.entries(run.encounters).filter(([,e])=>meta.params.encounter_key===null||e.template_id===meta.params.encounter_key).map(([source_node_id,e])=>({source_node_id,template_id:e.template_id,name:e.opponent_name,deck_name:e.deck_name,difficulty:e.difficulty})):[];
  const relics=visit.kind==='relic_recovery'?run.relics.map(id=>relicMeta163(run,id)):[];
  const deck_cards=visit.kind==='twin_sacrifice'?['main','extra'].flatMap(group=>run.active_deck.groups[group].map(row=>({identity_key:row.identity_key,group,count:row.count,card:clone(run.collection.find(e=>e.card.identity_key===row.identity_key).card)}))):[];
  let reason=locked||resolved&&'이미 선택했어.'||'';if(!reason){if(selectCard)reason=cardChoices.some(c=>!c.disabled)?'':'선택할 수 있는 보유 카드가 없어.';else if(visit.kind==='race_blessing')reason=races.length?'':'보상에 사용할 몬스터 종족이 없어.';else if(visit.kind==='challenge_duel')reason=visit.sr_candidates.length<3?'서로 다른 SR 후보 3장이 필요해.':encounters.length?'':'현재 원정에 등록된 해당 상대가 없어.';else if(visit.kind==='relic_recovery')reason=relics.length?'':'바칠 보유 유물이 없어.';else if(visit.kind==='twin_sacrifice'){const keys=deck_cards.flatMap(c=>Array(c.count).fill(c.identity_key));reason=visit.sr_candidates.length<5?'서로 다른 SR 후보 5장이 필요해.':keys.some((a,i)=>keys.some((b,j)=>j>i&&!why(()=>removeDeckTwo163(clone(run),[a,b],nodeId))))?'':'활성 메인 덱 20장을 유지하며 바칠 카드 2매가 없어.';}else reason=why(()=>{const trial=clone(run);applyEvent(trial,trial.nodes163.events[nodeId],{},cards);});}
  out.event={id:visit.kind,title:meta.title,description:meta.description,effect:meta.effect_text,choice:visit.choice,cards:cardChoices,races,encounters,relics,deck_cards,challenge:clone(visit.challenge),choices:[{id:'accept',name:meta.name,description:meta.effect_text,disabled:!!reason,reason},{id:'skip',name:'그냥 지나간다',description:'카드·유물·금화·LP를 그대로 유지해.',disabled:!active||resolved,reason:locked||resolved&&'이미 선택했어.'||''}]};
  if(['card_enhancement','card_sealing'].includes(visit.kind)){out.event.enhancement166=true;out.event.deck_cards=eventOptions166(run,visit.kind);out.event.instances=out.event.deck_cards;const can=out.event.deck_cards.some(c=>!c.disabled);out.event.choices[0].disabled=!!locked||resolved||!can;out.event.choices[0].reason=locked||(resolved?'이미 선택했어.':!can?'선택 가능한 몬스터 카드가 없어.':'');}
  const expansion=inspectExpansion163(run,visit,cards,locked);if(expansion){Object.assign(out.event,expansion);out.event.choices[0].disabled=true;out.event.choices[0].reason='아래 선택지를 골라줘.';}
 }
 return out;
}

// Purchase provenance is per physical run copy. Non-purchased cards use today's
// displayed rarity price (including the current merchant discount).
export function saleOptions163(run,nodeId,locked=''){
 const mainCount=run.active_deck.groups.main.reduce((n,r)=>n+r.count,0);
 return instanceCards163(run).map(item=>{
  const basis_price=item.purchase_price??shopPrice163(contentPolicy163(run).shop.card_prices[item.card.rarity],run),price=Math.floor(basis_price/4);
  const reason=locked||(mainCount<=20?'메인 덱이 20장 이하면 카드를 판매할 수 없어.':'')||(run.gold>2e9-price?'원정 금화 한계에 도달했어.':'')||why(()=>{const trial=clone(run);removeHeld163(trial,item.identity_key,{nodeId,kind:'shop_sell',id:claim163(nodeId,`sell_${item.instance_id}`),instanceId:item.instance_id});validateDeck163(trial);});
  return {...item,count:1,basis_price,price,disabled:!!reason,reason};
 });
}
