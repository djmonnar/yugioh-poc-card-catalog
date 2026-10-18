import * as legacy157 from './roguelite157-rules.js?v=20261017-157';
import {defaultContent158,migrateContent157To158,registeredEffects158,FIELD_OPTIONS158,relicEffectText158,eventEffectText158} from './expedition-content158-core.js?v=20261017-158';
export const MAX_RUN_LP=60000;
export const REST_CHOICES=legacy157.REST_CHOICES;
export const RELICS=Object.freeze(registeredEffects158().relics.map(Object.freeze));
export const EVENTS158=Object.freeze(registeredEffects158().events.map(Object.freeze));
export const EVENTS150=legacy157.EVENTS150,EVENTS154=legacy157.EVENTS154;
export const SHOP_PRICES150=legacy157.SHOP_PRICES150;
export const BATTLE_REWARDS=legacy157.BATTLE_REWARDS;
export const destinyChoice154=legacy157.destinyChoice154;
export const contentPolicy158=run=>run?.content158?.document??(run?.content157?.document?migrateContent157To158(run.content157.document):defaultContent158());
export const contentPolicy157=contentPolicy158;
export const weighted157=legacy157.weighted157;
export function relicMeta158(run,id){const row=contentPolicy158(run).relics.find(r=>r.id===id);return row?{...row,effect_text:relicEffectText158(row)}:null;}
export const relicMeta157=relicMeta158;
export function eventMeta158(run,id){const row=contentPolicy158(run).events.find(r=>r.id===id);return row?{...row,effect_text:eventEffectText158(row)}:null;}
export const eventMeta157=eventMeta158;
export function relicValue158(run,id,key){return run.relics.includes(id)?relicMeta158(run,id)?.params?.[key]??0:0;}
export function pickRelic158(run,seed,{shop=false,excluded=[],rarities=null}={}){
 const pool=contentPolicy158(run).relics.filter(row=>row.enabled&&row.weight>0&&(!shop||row.shop_enabled)&&(!rarities||rarities.includes(row.rarity))&&!run.relics.includes(row.id)&&!excluded.includes(row.id)&&(row.id!=='life_fragment'||run.max_lp+row.params.max_lp<=MAX_RUN_LP));
 return weighted157(pool,seed)?.id??null;
}
export const pickRelic157=pickRelic158;
export function rewardPolicy(kind,source=[]){
 if(Array.isArray(source))return legacy157.rewardPolicy(kind,source);
 const base=BATTLE_REWARDS[kind==='midboss'?'elite':kind];if(!base)throw Error('전투 종류를 확인해줘.');
 return {...base,gold:Math.min(2e9,base.gold+relicValue158(source,'golden_scarab','gold')),heal:relicValue158(source,'restoring_ankh','lp'),card_choices:base.card_choices+relicValue158(source,'card_slate','extra_choices')};
}
export function shopPrice158(base,run){if(!Number.isSafeInteger(base)||base<0||base>2e9)throw Error('상점 기본 가격을 확인해줘.');return Math.floor(base*(100-relicValue158(run,'merchant_seal','discount_percent'))/100);}
export const shopPrice150=(base,relics=[])=>legacy157.shopPrice150(base,relics);
export function restOutcome({lp,max_lp,relics=[],seed,nodeId,content158,content157},choice){
 if(!content158)return legacy157.restOutcome({lp,max_lp,relics,seed,nodeId,content157},choice);
 if(!Number.isSafeInteger(lp)||lp<1||!Number.isSafeInteger(max_lp)||max_lp>MAX_RUN_LP||lp>max_lp)throw Error('휴식 전 LP를 확인해줘.');
 const out={lp,max_lp,relics:[...relics],relic_id:null};
 if(choice==='max_lp'){if(max_lp>MAX_RUN_LP-500)throw Error('최대 LP가 한계에 도달했어.');out.max_lp+=500;}
 else if(choice==='heal'){if(lp===max_lp)throw Error('이미 LP가 가득 차 있어.');out.lp=max_lp;}
 else if(choice==='relic'){out.relic_id=pickRelic158({lp,max_lp,relics,content158},`rest158|${seed}|${nodeId}`);if(!out.relic_id)throw Error('받을 수 있는 유물이 없어.');out.relics.push(out.relic_id);out.max_lp+=out.relic_id==='life_fragment'?content158.document.relics.find(r=>r.id===out.relic_id).params.max_lp:0;}
 else throw Error('휴식 선택지를 확인해줘.');return out;
}
export function cleanRestClaims(claims,map,relics){
 if(!Array.isArray(claims)||claims.length>100)throw Error('휴식 기록을 확인해줘.');const seen=new Set();
 return claims.map(claim=>{const node=map?.nodes.find(n=>n.id===claim.node_id);if(!node||node.kind!=='rest'||seen.has(node.id)||!REST_CHOICES.some(c=>c.id===claim.choice)||claim.choice==='relic'&&(!RELICS.some(r=>r.id===claim.relic_id)||!relics.includes(claim.relic_id))||claim.choice!=='relic'&&claim.relic_id!==null)throw Error('휴식 유물 기록이 일치하지 않아.');seen.add(node.id);return {node_id:node.id,choice:claim.choice,relic_id:claim.relic_id};});
}
export function validateDuelRelics154(run){
 legacy157.validateDuelRelics154(run);
 if(run.relics.includes('field_legacy')){const chosen=run.relic_choices158?.field_legacy,allowed=relicMeta158(run,'field_legacy').params.fields;if(!FIELD_OPTIONS158.some(row=>row.id===chosen)||!allowed.includes(chosen))throw Error('태고의 지형에서 이번 원정의 시작 필드를 한 번 골라줘.');}
}
