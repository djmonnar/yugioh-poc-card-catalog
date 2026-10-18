import {snapshotCard} from './roguelite-card.js?v=20261014-139';
import {eligibleRewardCards} from './roguelite-rewards.js?v=20261014-139';
import {validatePlayerDeck} from './roguelite163-core.js?v=20261018-163';
import {relicMeta163,MAX_RUN_LP} from './roguelite163-rules.js?v=20261018-163';
import {recipePools163,deterministic163,fusionGrant163} from './roguelite163-recipes.js?v=20261018-163';
import {registerConsumable163} from './roguelite163-consumables.js?v=20261018-163';
import {addInstances163,chooseRemovalInstance163,removeInstance163,reconcileInstances163} from './roguelite163-instances.js?v=20261018-163';
const fail=message=>{throw new Error(message);},clone=structuredClone;
const ident=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
export function grant163(run,source,count,rewardId){
 const card=snapshotCard(source);if(!ident(rewardId)||!Number.isSafeInteger(count)||count<1||count>99)fail('카드 지급 번호와 매수를 확인해줘.');
 const prior=run.reward_claims.find(row=>row.id===rewardId);if(prior){if(prior.identity_key!==card.identity_key||prior.count!==count)fail('같은 지급 번호의 카드가 달라.');return false;}
 const entry=run.collection.find(row=>row.card.identity_key===card.identity_key);
 if(entry){if(JSON.stringify(entry.card)!==JSON.stringify(card)||entry.count+count>9999)fail('받을 카드의 정보나 보유 매수가 달라.');entry.count+=count;}
 else{if(run.collection.some(row=>row.card.slot===card.slot)||run.collection.length>=2047)fail('카드함의 식별값을 확인해줘.');run.collection.push({card,count});}
 addInstances163(run,card,count);run.reward_claims.push({id:rewardId,identity_key:card.identity_key,count});return true;
}
export function validateDeck163(run){
 const owned=new Map(run.collection.map(row=>[row.card.identity_key,row.count])),used=new Map();
 for(const group of ['main','extra'])for(const row of run.active_deck.groups[group])used.set(row.identity_key,(used.get(row.identity_key)||0)+row.count);
 if([...used].some(([key,count])=>count>(owned.get(key)||0)))fail('활성 덱의 카드 수가 보유 매수를 초과해.');
 const check=validatePlayerDeck(run.active_deck,run.collection.map(row=>row.card));if(!check.valid)fail(check.issues.join(' '));
}
export function removeHeld163(run,key,{nodeId,kind,id,replacement=null,forceDeck=false,instanceId=null}={}){
 const entry=run.collection.find(row=>row.card.identity_key===key);if(!entry)fail('원정에서 보유한 카드를 골라줘.');
 if(!ident(id)||run.nodes163.removals.some(row=>row.id===id))fail('이미 처리한 카드 제거 요청이야.');
 const instance=chooseRemovalInstance163(run,key,{instanceId,forceDeck}),activeInstance=instance&&['main','extra'].some(g=>run.instances163.active[g].includes(instance.id));
 const used=['main','extra'].reduce((n,g)=>n+run.active_deck.groups[g].filter(row=>row.identity_key===key).reduce((n,row)=>n+row.count,0),0),before=entry.count,card=clone(entry.card);
 const group=['main','extra'].find(g=>run.active_deck.groups[g].some(row=>row.identity_key===key));let deckGroup=null;
 if(forceDeck||activeInstance||used>before-1){
  if(!group)fail('활성 덱에 있는 카드를 골라줘.');deckGroup=group;const rows=run.active_deck.groups[group],row=rows.find(r=>r.identity_key===key);row.count--;if(!row.count)rows.splice(rows.indexOf(row),1);
  if(replacement){const extra=replacement.type==='융합 몬스터';if((group==='extra')!==extra)fail('활성 덱 카드는 같은 덱 위치의 카드로 교환해야 해.');const target=rows.find(r=>r.identity_key===replacement.identity_key);if(target)target.count++;else rows.push({...Object.fromEntries(['identity_key','slot','internal_id','name_ko','name_en'].map(k=>[k,replacement[k]])),count:1});}
 }
 entry.count--;if(!entry.count)run.collection.splice(run.collection.indexOf(entry),1);removeInstance163(run,instance);reconcileInstances163(run);
 const loss={id,node_id:nodeId,kind,card,count:1,before_count:before,after_count:before-1,deck_group:deckGroup,target_key:replacement?.identity_key??null};run.nodes163.removals.push(loss);return loss;
}
export function removeDeckTwo163(run,keys,nodeId,{kind='twin_sacrifice',tag='twin'}={}){
 if(!Array.isArray(keys)||keys.length!==2||keys.some(key=>typeof key!=='string'))fail('활성 덱에서 바칠 카드 정확히 2매를 골라줘.');
 const chosen=new Map();for(const key of keys)chosen.set(key,(chosen.get(key)||0)+1);
 for(const [key,count] of chosen){const used=['main','extra'].reduce((n,g)=>n+run.active_deck.groups[g].filter(row=>row.identity_key===key).reduce((n,row)=>n+row.count,0),0);if(used<count)fail('선택한 매수만큼 활성 덱에 있는 카드를 골라줘.');}
 keys.forEach((key,index)=>removeHeld163(run,key,{nodeId,kind,id:`n163_${nodeId}_${tag}_${index}`,forceDeck:true}));validateDeck163(run);
}
export function acquireRelic163(run,relicId,sourceId,cards){
 if(!ident(sourceId)||run.nodes163.acquisitions.some(row=>row.id===sourceId))fail('이미 처리한 유물 획득이야.');
 const meta=relicMeta163(run,relicId);if(!meta||run.relics.includes(relicId))fail('아직 보유하지 않은 유물을 골라줘.');
 const max=meta.id==='life_fragment'?meta.params.max_lp:0;if(run.max_lp+max>MAX_RUN_LP)fail('최대 LP 한계 때문에 이 유물을 받을 수 없어.');
 const grants=[];
 if(relicId==='rare_cache'){
  const pool=eligibleRewardCards(cards).filter(card=>card.rarity==='R');if(!pool.length)fail('받을 수 있는 R 카드가 없어.');
  for(let i=0;i<meta.params.count;i++)grants.push({card:deterministic163(pool,`${run.seed}|${sourceId}|rare|${i}`),count:1});
 }else if(relicId==='fusion_cache'){
  const pair=deterministic163(recipePools163(run.recipe_book163,cards).fusions,`${run.seed}|${sourceId}|fusion`);if(!pair)fail('설치된 정식 융합 식에 맞는 지급 후보가 없어.');grants.push(...fusionGrant163(pair,meta.params.material_copies));
 }
 const gold=meta.id==='golden_pot'?meta.params.gold:0;if(run.gold+gold>2e9)fail('금화 한계 때문에 황금 단지를 받을 수 없어.');
 run.relics.push(relicId);run.max_lp+=max;run.gold+=gold;
 const claims=[];grants.forEach(({card,count},index)=>{const id=`${sourceId}_g${index}`;grant163(run,card,count,id);claims.push(id);});
 registerConsumable163(run,relicId,sourceId,meta.params);
 run.nodes163.acquisitions.push({id:sourceId,relic_id:relicId,max_lp_added:max,gold_added:gold,grant_ids:claims});return meta;
}
export function loseRelic163(run,relicId,nodeId){
 if(!run.relics.includes(relicId))fail('지금 보유한 유물 1개를 골라줘.');
 const acquisition=[...run.nodes163.acquisitions].reverse().find(row=>row.relic_id===relicId&&!run.nodes163.relic_losses.some(loss=>loss.acquisition_id===row.id));
 if(!acquisition)fail('유물의 획득 기록이 없어.');
 if(run.nodes163.uses.some(row=>row.item_id===relicId&&['reserved','accepted'].includes(row.status)))fail('사용 처리 중인 소모품은 바칠 수 없어.');
 run.relics.splice(run.relics.indexOf(relicId),1);run.nodes163.relic_losses.push({id:`n163_${nodeId}_relic_loss`,node_id:nodeId,relic_id:relicId,acquisition_id:acquisition.id,kind:'relic_recovery',use_id:null});run.lp=run.max_lp;
}
