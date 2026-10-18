import {snapshotCard} from './roguelite-card.js?v=20261014-139';
import {eligibleRewardCards} from './roguelite-rewards.js?v=20261014-139';
import {deterministic163} from './roguelite163-recipes.js?v=20261018-163';
import {pickRelic163,relicMeta163} from './roguelite163-rules.js?v=20261018-163';
import {grant163,acquireRelic163,removeHeld163,removeDeckTwo163,validateDeck163} from './roguelite163-ledger.js?v=20261018-163';
export const EXTRA_EVENTS163=Object.freeze(['relic_choice','card_choice','evolution','mana_furnace','deck_transform']);
const fail=m=>{throw Error(m);},clone=structuredClone,key=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a,b)=>canonical(a)===canonical(b),claim=(id,suffix)=>`n163_${id}_${suffix}`;
const why=fn=>{try{fn();return '';}catch(e){return e.message;}};
const kind=card=>card.type.includes('몬스터')?'monster':card.type==='마법'?'spell':'trap';
function shuffle(pool,seed){const left=[...pool],out=[];for(let i=0;left.length;i++){const row=deterministic163(left,`${seed}|${i}`);out.push(row);left.splice(left.indexOf(row),1);}return out;}
function evolve(run,event,sourceKey,target){
 const row=run.active_deck.groups.main.find(c=>c.identity_key===sourceKey&&c.count>0),source=run.collection.find(c=>c.card.identity_key===sourceKey)?.card;
 if(!row||!source?.type.includes('몬스터')||!Number.isInteger(source.level)||!target||target.level!==source.level+1||!['일반 몬스터','효과 몬스터'].includes(target.type))fail('메인 덱 몬스터와 정확히 한 레벨 높은 일반 소환 후보를 골라줘.');
 grant163(run,target,1,claim(event.node_id,'evolution'));removeHeld163(run,sourceKey,{nodeId:event.node_id,kind:'evolution',id:claim(event.node_id,'evolution_remove'),replacement:target,forceDeck:true});validateDeck163(run);
}
export function buildEventOptions163(run,event,cards){
 if(!EXTRA_EVENTS163.includes(event.kind))return null;
 const seed=event.seed_key,owned=new Map(run.collection.map(e=>[e.card.identity_key,e])),slots=new Map(run.collection.map(e=>[e.card.slot,e.card.identity_key]));
 // The single-card grant preconditions are local metadata/count checks. Do
 // not clone an entire map+history once per catalog card just to quote them.
 const pool=eligibleRewardCards(cards).filter(c=>{const entry=owned.get(c.identity_key);return entry?(entry.count<9999&&same(entry.card,c)):(!slots.has(c.slot)&&run.collection.length<2047);});
 if(event.kind==='relic_choice')return Object.fromEntries(['N','R','SR'].map(tier=>[tier,pickRelic163({...run,gold:Math.max(0,run.gold-{N:0,R:50,SR:100}[tier])},seed+'|relic_choice|'+tier,{rarities:[tier]})]));
 if(event.kind==='card_choice')return Object.fromEntries(['monster','spell','trap'].map(type=>[type,shuffle(pool.filter(c=>kind(c)===type),seed+'|type|'+type).slice(0,5)]));
 if(event.kind==='mana_furnace'){const spells=pool.filter(c=>c.type==='마법');return {random:shuffle(spells,seed+'|random_spell').slice(0,1),select:shuffle(spells,seed+'|spell_three').slice(0,3),sacrifice:shuffle(spells.filter(c=>c.rarity==='SR'),seed+'|sr_spell_three').slice(0,3)};}
 if(event.kind==='deck_transform')return Object.fromEntries(run.theme_book163.themes.map(theme=>[theme.id,shuffle(pool.filter(c=>theme.identities.includes(c.identity_key)),seed+'|theme|'+theme.id).slice(0,3)]));
 const out={};for(const row of run.active_deck.groups.main){const source=run.collection.find(c=>c.card.identity_key===row.identity_key)?.card;if(!source?.type.includes('몬스터')||!Number.isInteger(source.level)||source.level<1||source.level>=12)continue;const targets=shuffle(pool.filter(c=>['일반 몬스터','효과 몬스터'].includes(c.type)&&c.level===source.level+1),seed+'|evolution|'+source.identity_key);out[source.identity_key]=targets.find(target=>!why(()=>evolve(clone(run),event,source.identity_key,target)))??null;}return out;
}
export function expansionReward163(event,option=event.option163){
 if(event.kind==='card_choice')return {count:5,candidates:event.options163[option]};
 if(event.kind==='mana_furnace'&&['select','sacrifice'].includes(option))return {count:3,candidates:event.options163[option]};
 return null;
}
function pending(run,event,option){const spec=expansionReward163(event,option);if(!spec||spec.candidates?.length!==spec.count)fail(`서로 다른 보상 후보 ${spec?.count??3}장이 필요해.`);if(run.nodes163.pending_reward)fail('먼저 대기 중인 보상을 선택해줘.');const id=claim(event.node_id,'event_'+option);run.nodes163.pending_reward={id,kind:event.kind,node_id:event.node_id,candidates:clone(spec.candidates),chosen_identity_key:null};event.pending_reward_id=id;event.status='reward_pending';}
export function applyExpansionEvent163(run,event,args,cards){
 if(!EXTRA_EVENTS163.includes(event.kind))return false;const option=args.option,options=event.options163;
 if(event.kind==='relic_choice'){
  if(!['N','R','SR'].includes(option))fail('무료 N·금화 50 R·금화 100 SR 중 골라줘.');const cost={N:0,R:50,SR:100}[option],id=options[option];if(!id)fail('선택 등급에서 획득할 수 있는 미보유 유물이 없어.');if(run.gold<cost)fail(`원정 금화 ${cost}이 필요해.`);run.gold-=cost;acquireRelic163(run,id,claim(event.node_id,'choice_relic'),cards);event.relic_id=id;
 }else if(event.kind==='card_choice'){
  if(!['monster','spell','trap'].includes(option))fail('몬스터·마법·함정 중 골라줘.');pending(run,event,option);
 }else if(event.kind==='evolution'){
  const target=options[args.identity_key];if(!target)fail('정확히 한 레벨 높은 후보가 있는 메인 덱 몬스터를 골라줘.');evolve(run,event,args.identity_key,target);event.source_keys=[args.identity_key];event.target_key=target.identity_key;
 }else if(event.kind==='mana_furnace'){
  if(option==='random'){if(options.random.length!==1)fail('받을 수 있는 마법 카드가 없어.');grant163(run,options.random[0],1,claim(event.node_id,'random_spell'));}
  else if(option==='select'){if(run.gold<50)fail('원정 금화 50이 필요해.');pending(run,event,option);run.gold-=50;}
  else if(option==='sacrifice'){const source=run.collection.find(c=>c.card.identity_key===args.identity_key);if(source?.card.type!=='마법')fail('보유한 마법 카드 1매를 골라줘.');pending(run,event,option);removeHeld163(run,args.identity_key,{nodeId:event.node_id,kind:'mana_furnace',id:claim(event.node_id,'mana_remove')});validateDeck163(run);event.source_keys=[args.identity_key];}
  else fail('마법 카드 획득·선택·공양 중 골라줘.');
 }else{
  const theme=run.theme_book163.themes.find(t=>t.id===option),targets=options[option];if(!theme||targets?.length!==3)fail('획득 가능한 카드 3장이 있는 등록된 덱 테마를 골라줘.');
  removeDeckTwo163(run,args.identity_keys,event.node_id,{kind:'deck_transform',tag:'transform'});event.source_keys=[...args.identity_keys];targets.forEach((card,i)=>grant163(run,card,1,claim(event.node_id,'theme_'+i)));
 }
 event.option163=option??null;return true;
}
export function cleanExpansionOptions163(event,run,preserve){
 const value=event.options163;if(!EXTRA_EVENTS163.includes(event.kind)){if(value!==null||event.option163!==null)fail('기존 이벤트에 다른 선택 기록을 넣을 수 없어.');return;}
 if(!value||typeof value!=='object'||Array.isArray(value))fail('새 이벤트의 고정 후보 기록이 없어.');
 const keys=event.kind==='relic_choice'?['N','R','SR']:event.kind==='card_choice'?['monster','spell','trap']:event.kind==='mana_furnace'?['random','select','sacrifice']:event.kind==='deck_transform'?run.theme_book163.themes.map(t=>t.id):Object.keys(value);
 if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))fail('이벤트 선택 후보의 종류가 달라.');
 for(const option of keys){const rows=value[option];
  if(event.kind==='relic_choice'){const meta=rows===null?null:relicMeta163(run,rows);if(rows!==null&&(!meta||meta.rarity!==option||!meta.enabled||meta.weight<1))fail('유물 선택 후보의 등급·활성 상태가 달라.');continue;}
  if(event.kind==='evolution'){if(!key(option))fail('진화 원본 카드 식별값이 달라.');if(rows!==null){value[option]=preserve(rows);const source=run.collection.find(e=>e.card.identity_key===option)?.card??run.nodes163.removals.find(e=>e.card.identity_key===option)?.card;if(!source||rows.level!==source.level+1||!['일반 몬스터','효과 몬스터'].includes(rows.type))fail('진화 후보는 정확히 한 레벨 높은 일반 소환 몬스터여야 해.');}continue;}
  const count=event.kind==='card_choice'?5:event.kind==='mana_furnace'&&option==='random'?1:3;
  if(!Array.isArray(rows)||rows.length>count)fail('새 이벤트의 고정 후보 수가 달라.');value[option]=rows.map(preserve);if(new Set(rows.map(c=>c.identity_key)).size!==rows.length)fail('이벤트 보상 후보에 같은 카드가 중복됐어.');
  if(rows.some(c=>c.deck_limit===0||c.speed_limit===0||!['N','R','SR','UR'].includes(c.rarity)||event.kind==='card_choice'&&kind(c)!==option||event.kind==='mana_furnace'&&(c.type!=='마법'||option==='sacrifice'&&c.rarity!=='SR')||event.kind==='deck_transform'&&!run.theme_book163.themes.find(t=>t.id===option).identities.includes(c.identity_key)))fail('새 이벤트 보상 카드의 종류·금제·테마가 달라.');
 }
 if(event.option163!==null&&!keys.includes(event.option163))fail('저장된 이벤트 선택지가 달라.');
 if(event.choice==='accept'&&event.kind!=='evolution'&&event.option163===null)fail('수락한 이벤트의 선택지가 없어.');
}
export function inspectExpansion163(run,event,cards,locked){
 if(!EXTRA_EVENTS163.includes(event.kind))return null;const reasonFor=args=>locked||event.choice!==null&&'이미 선택한 이벤트야.'||why(()=>applyExpansionEvent163(clone(run),clone(event),args,cards));
 const make=(id,name,args={},extras={})=>{const reason=reasonFor({option:id,...args});return {id,name,description:name,disabled:!!reason,reason,...extras};};
 if(event.kind==='relic_choice')return {options163:['N','R','SR'].map(t=>make(t,{N:'무료 N 유물',R:'금화 50 · R 유물',SR:'금화 100 · SR 유물'}[t],{},{relic_id:event.options163[t],price:{N:0,R:50,SR:100}[t]}))};
 if(event.kind==='card_choice')return {options163:['monster','spell','trap'].map(t=>make(t,{monster:'몬스터',spell:'마법',trap:'함정'}[t]+' 5장 중 1장',{},{candidates:clone(event.options163[t])}))};
 if(event.kind==='evolution')return {evolution163:Object.entries(event.options163).map(([identity_key,target])=>{const card=run.collection.find(c=>c.card.identity_key===identity_key)?.card;const reason=reasonFor({identity_key});return {identity_key,card:card?clone(card):null,target:clone(target),disabled:!!reason,reason};}),options163:[]};
 if(event.kind==='mana_furnace'){
  const sources=run.collection.filter(e=>e.card.type==='마법').map(entry=>{const reason=reasonFor({option:'sacrifice',identity_key:entry.card.identity_key});return {...clone(entry),identity_key:entry.card.identity_key,disabled:!!reason,reason};});
  const sacrificeReason=locked||event.choice!==null&&'이미 선택했어.'||!sources.some(c=>!c.disabled)&&'메인 덱 20장을 유지하며 바칠 보유 마법 카드가 없어.'||'';
  return {options163:[make('random','무작위 마법 카드 1장',{},{candidates:clone(event.options163.random)}),make('select','금화 50 · 마법 카드 3장 중 1장',{},{price:50,candidates:clone(event.options163.select)}),{id:'sacrifice',name:'마법 카드 1매 공양 · SR 마법 3장 중 1장',description:'메인 덱 20장을 유지하며 보유 마법 1매를 영구 제거해.',disabled:!!sacrificeReason,reason:sacrificeReason,candidates:clone(event.options163.sacrifice)}],mana_sources163:sources};
 }
 const deck_cards=['main','extra'].flatMap(group=>run.active_deck.groups[group].map(row=>({identity_key:row.identity_key,group,count:row.count,card:clone(run.collection.find(e=>e.card.identity_key===row.identity_key).card)}))),keys=deck_cards.flatMap(c=>Array(c.count).fill(c.identity_key));
 const possible=keys.some((a,i)=>keys.some((b,j)=>j>i&&!why(()=>removeDeckTwo163(clone(run),[a,b],event.node_id,{kind:'deck_transform',tag:'transform'}))));
 return {deck_cards,themes163:run.theme_book163.themes.map(theme=>{const reason=locked||event.choice!==null&&'이미 선택했어.'||!possible&&'메인 덱 20장을 유지하며 바칠 활성 덱 카드 2매가 없어.'||event.options163[theme.id].length!==3&&'해당 테마의 획득 가능한 카드 3장이 없어.'||'';return {id:theme.id,name:theme.name,candidates:clone(event.options163[theme.id]),disabled:!!reason,reason};}),options163:[]};
}
export function validateExpansionReward163(offer,event){
 const spec=expansionReward163(event);if(!spec||offer.kind!==event.kind||offer.id!==claim(event.node_id,'event_'+event.option163)||!same(offer.candidates,spec.candidates)||offer.candidates.length!==spec.count)fail('새 이벤트의 선택 보상과 고정 후보가 달라.');return spec.count;
}
export function cleanExpansionOutcome163(event,run){
 if(!EXTRA_EVENTS163.includes(event.kind)||event.choice!=='accept')return;
 const claimAt=(id,card)=>run.reward_claims.some(r=>r.id===id&&r.identity_key===card?.identity_key&&r.count===1),losses=run.nodes163.removals.filter(r=>r.node_id===event.node_id);
 if(event.kind==='relic_choice'){const id=event.options163[event.option163];if(event.relic_id!==id||!run.nodes163.acquisitions.some(a=>a.id===claim(event.node_id,'choice_relic')&&a.relic_id===id))fail('선택 유물과 획득 기록이 달라.');}
 else if(event.kind==='card_choice'){if(event.pending_reward_id!==claim(event.node_id,'event_'+event.option163))fail('타입 선택 카드 보상이 누락됐어.');}
 else if(event.kind==='evolution'){
  const target=event.options163[event.source_keys[0]],loss=losses.find(r=>r.id===claim(event.node_id,'evolution_remove'));
  if(event.source_keys.length!==1||!target||event.target_key!==target.identity_key||!loss||loss.kind!=='evolution'||loss.deck_group!=='main'||loss.card.identity_key!==event.source_keys[0]||loss.target_key!==target.identity_key||!claimAt(claim(event.node_id,'evolution'),target))fail('진화의 원본 제거·정확 레벨 상승·보상이 달라.');
 }else if(event.kind==='mana_furnace'){
  if(event.option163==='random'){if(!claimAt(claim(event.node_id,'random_spell'),event.options163.random[0]))fail('무작위 마법 카드 지급이 누락됐어.');}
  else if(event.pending_reward_id!==claim(event.node_id,'event_'+event.option163))fail('마나 용광로 선택 보상이 누락됐어.');
  if(event.option163==='sacrifice'){const loss=losses.find(r=>r.id===claim(event.node_id,'mana_remove'));if(event.source_keys.length!==1||loss?.kind!=='mana_furnace'||loss.card.type!=='마법'||loss.card.identity_key!==event.source_keys[0])fail('바친 마법 카드와 영구 제거 기록이 달라.');}
 }else{
  const targets=event.options163[event.option163];if(event.source_keys.length!==2||targets?.length!==3||event.source_keys.some((key,i)=>!losses.some(r=>r.id===claim(event.node_id,'transform_'+i)&&r.kind==='deck_transform'&&r.deck_group&&r.card.identity_key===key))||targets.some((c,i)=>!claimAt(claim(event.node_id,'theme_'+i),c)))fail('덱 변환의 카드2매 제거·테마3매 획득 기록이 달라.');
 }
}
