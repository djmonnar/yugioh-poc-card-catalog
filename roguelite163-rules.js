import * as legacy157 from './roguelite157-rules.js?v=20261017-157';
import * as legacy158 from './roguelite159-rules.js?v=20261017-159';
import {defaultContent163,migrateContent158To163,registeredEffects163,FIELD_OPTIONS163,relicEffectText163,eventEffectText163} from './expedition-content163-core.js?v=20261018-163';
export const MAX_RUN_LP=60000;
export const REST_CHOICES=legacy157.REST_CHOICES;
export const RELICS=Object.freeze(registeredEffects163().relics.map(Object.freeze));
export const EVENTS163=Object.freeze(registeredEffects163().events.map(Object.freeze));
export const EVENTS150=legacy157.EVENTS150,EVENTS154=legacy157.EVENTS154;
export const SHOP_PRICES150=legacy157.SHOP_PRICES150;
export const BATTLE_REWARDS=legacy157.BATTLE_REWARDS;
export const destinyChoice154=legacy157.destinyChoice154;
export const contentPolicy163=run=>run?.content163?.document??run?.content159?.document??(run?.content158?.document?migrateContent158To163(run.content158.document):defaultContent163());
export const contentPolicy157=contentPolicy163;
export const weighted157=legacy157.weighted157;
export function relicMeta163(run,id){const row=contentPolicy163(run).relics.find(r=>r.id===id);return row?{...row,effect_text:relicEffectText163(row)}:null;}
export const relicMeta157=relicMeta163;
export function eventMeta163(run,id){const row=contentPolicy163(run).events.find(r=>r.id===id);return row?{...row,effect_text:eventEffectText163(row)}:null;}
export const eventMeta157=eventMeta163;
export function relicValue163(run,id,key){return run.relics.includes(id)?relicMeta163(run,id)?.params?.[key]??0:0;}
export function pickRelic163(run,seed,{shop=false,excluded=[],rarities=null}={}){
 if(!run.content163)return legacy158.pickRelic159(run,seed,{shop,excluded,rarities});
 const pool=contentPolicy163(run).relics.filter(row=>row.enabled&&row.weight>0&&(!shop||row.shop_enabled)&&(!rarities||rarities.includes(row.rarity))&&!run.relics.includes(row.id)&&!excluded.includes(row.id)&&(row.id!=='life_fragment'||run.max_lp+row.params.max_lp<=MAX_RUN_LP)&&(row.id!=='golden_pot'||run.gold+row.params.gold<=2e9));
 return weighted157(pool,seed)?.id??null;
}
export const pickRelic157=pickRelic163;
export function rewardPolicy(kind,source=[]){
 if(Array.isArray(source)||!source?.content163)return legacy158.rewardPolicy(kind,source);
 const base=BATTLE_REWARDS[kind==='midboss'?'elite':kind];if(!base)throw Error('전투 종류를 확인해줘.');
 const key=kind==='midboss'?'elite':kind,baseGold=Object.hasOwn(contentPolicy163(source).battle_rewards,key)?contentPolicy163(source).battle_rewards[key]:base.gold;
 return {...base,gold:Math.min(2e9,baseGold+relicValue163(source,'golden_scarab','gold')),heal:relicValue163(source,'restoring_ankh','lp'),card_choices:base.card_choices+relicValue163(source,'card_slate','extra_choices')};
}
export function shopPrice163(base,run){if(!Number.isSafeInteger(base)||base<0||base>2e9)throw Error('상점 기본 가격을 확인해줘.');return Math.floor(base*(100-relicValue163(run,'merchant_seal','discount_percent'))/100);}
export const shopPrice150=(base,relics=[])=>legacy157.shopPrice150(base,relics);
export function restOutcome(options,choice){
 const {lp,max_lp,gold,relics=[],seed,nodeId,content163}=options;
 if(!content163)return legacy158.restOutcome(options,choice);
 if(!Number.isSafeInteger(lp)||lp<1||!Number.isSafeInteger(max_lp)||max_lp>MAX_RUN_LP||lp>max_lp)throw Error('휴식 전 LP를 확인해줘.');
 const out={lp,max_lp,relics:[...relics],relic_id:null};
 if(choice==='max_lp'){if(max_lp>MAX_RUN_LP-500)throw Error('최대 LP가 한계에 도달했어.');out.max_lp+=500;}
 else if(choice==='heal'){if(lp===max_lp)throw Error('이미 LP가 가득 차 있어.');out.lp=max_lp;}
 else if(choice==='relic'){out.relic_id=pickRelic163({lp,max_lp,gold,relics,content163},`rest163|${seed}|${nodeId}`);if(!out.relic_id)throw Error('받을 수 있는 유물이 없어.');out.relics.push(out.relic_id);out.max_lp+=out.relic_id==='life_fragment'?content163.document.relics.find(r=>r.id===out.relic_id).params.max_lp:0;}
 else throw Error('휴식 선택지를 확인해줘.');return out;
}
export function cleanRestClaims(claims,map,relics){
 if(!Array.isArray(claims)||claims.length>100)throw Error('휴식 기록을 확인해줘.');const seen=new Set();
 return claims.map(claim=>{const node=map?.nodes.find(n=>n.id===claim.node_id);if(!node||node.kind!=='rest'||seen.has(node.id)||!REST_CHOICES.some(c=>c.id===claim.choice)||claim.choice==='relic'&&(!RELICS.some(r=>r.id===claim.relic_id)||!relics.includes(claim.relic_id))||claim.choice!=='relic'&&claim.relic_id!==null)throw Error('휴식 유물 기록이 일치하지 않아.');seen.add(node.id);return {node_id:node.id,choice:claim.choice,relic_id:claim.relic_id};});
}
export function validateDuelRelics154(run){
 if(!run.content163)return legacy158.validateDuelRelics154(run);
 legacy157.validateDuelRelics154(run);
 const chosen=run.relic_choices163??{},guaranteed=new Set();
 if(run.relics.includes('destiny_draw'))guaranteed.add(run.relic_choices154.destiny_draw);
 for(const [id,type] of [['prepared_trap','함정'],['prepared_spell','마법'],['prepared_monster','몬스터'],['wise_burial',null]]){if(!run.relics.includes(id))continue;const key=chosen[id],row=run.active_deck.groups.main.find(c=>c.identity_key===key&&c.count>0),card=run.collection.find(c=>c.card.identity_key===key)?.card;if(!row||!card||type&&(type==='몬스터'?!card.type.includes('몬스터'):card.type!==type))throw Error(`${relicMeta163(run,id).name}에 현재 메인 덱의 해당 카드 1장을 지정해줘.`);if(id!=='wise_burial')guaranteed.add(key);}
 if(run.relics.includes('wise_burial')&&guaranteed.has(chosen.wise_burial)&&run.active_deck.groups.main.find(c=>c.identity_key===chosen.wise_burial).count<2)throw Error('시작 묘지와 첫 패에 같은 카드를 지정하면 메인 덱에 2매 이상 필요해.');
 if(run.relics.includes('field_legacy')){const chosen=run.relic_choices163?.field_legacy,allowed=relicMeta163(run,'field_legacy').params.fields;if(!FIELD_OPTIONS163.some(row=>row.id===chosen)||!allowed.includes(chosen))throw Error('태고의 지형에서 이번 원정의 시작 필드를 한 번 골라줘.');}
}
export function relicChoiceOptions163(run,id){
 const types={wise_burial:null,prepared_trap:'함정',prepared_spell:'마법',prepared_monster:'몬스터',destiny_draw:null};if(!Object.hasOwn(types,id)||!run.relics.includes(id))return [];
 return run.active_deck.groups.main.flatMap(row=>{const card=run.collection.find(e=>e.card.identity_key===row.identity_key)?.card,type=types[id];if(!card||type&&(type==='몬스터'?!card.type.includes('몬스터'):card.type!==type))return [];
  const chosen={...(run.relic_choices163??{})},destiny=id==='destiny_draw'?row.identity_key:run.relic_choices154?.destiny_draw;chosen[id]=row.identity_key;
  const opening=new Set(run.relics.includes('destiny_draw')?[destiny]:[]);for(const key of ['prepared_trap','prepared_spell','prepared_monster'])if(run.relics.includes(key)&&chosen[key])opening.add(chosen[key]);
  const wise=run.relics.includes('wise_burial')?chosen.wise_burial:null,needed=wise&&opening.has(wise)?run.active_deck.groups.main.find(e=>e.identity_key===wise)?.count??0:2,reason=needed<2?'시작 묘지와 첫 패에 같은 카드를 지정하면 메인 덱에 2매 이상 필요해.':'';
  return [{identity_key:row.identity_key,card:structuredClone(card),count:row.count,disabled:!!reason,reason}];
 });
}
