import {instanceCards163} from './roguelite166-instances.js?v=20261018-166';
import {relicMeta163,eventMeta163} from './roguelite166-rules.js?v=20261018-166';
import {cleanNativeUses166} from './roguelite166-native-uses.js?v=20261018-166';
const copy=structuredClone,fail=m=>{throw Error(m);},ids=['white_dragon_eye','red_dragon_eye','magician_grimoire'];
export const emptyRuntime166=()=>({schema:1,upgrade_claims:[],seal_claims:[],completed_battles:[],native_uses:[]});
export const isEnhanced166=item=>!!(item.atk_bonus||item.def_bonus||item.tribute_required!==null||item.special_spell_search);
export function enhancementOptions166(run,relicId=pendingEnhancement166(run)?.relic_id){
 if(!relicId)return [];
 return instanceCards163(run,{deckOnly:true,monstersOnly:true}).map(item=>{const c=item.card,reason=item.group!=='main'?'메인 덱 몬스터를 골라줘.':item.seal_remaining?'봉인 중인 카드는 강화할 수 없어.':relicId==='white_dragon_eye'&&c.level!==8?'레벨 8 몬스터를 골라줘.':relicId==='white_dragon_eye'&&!['일반 몬스터','효과 몬스터'].includes(c.type)?'어드밴스 소환 가능한 메인 덱 몬스터를 골라줘.':relicId==='white_dragon_eye'&&item.tribute_required===1?'이미 릴리스 1장 강화가 있어.':relicId==='red_dragon_eye'&&c.level!==7?'레벨 7 몬스터를 골라줘.':relicId==='red_dragon_eye'&&item.atk_bonus+relicMeta163(run,relicId).params.atk>9999?'공격력 강화 한도에 도달했어.':relicId==='magician_grimoire'&&(c.race!=='마법사족'||isEnhanced166(item))?'강화되지 않은 마법사족을 골라줘.':'';return {...item,disabled:!!reason,reason};});
}
export function pendingEnhancement166(run){
 if(!run?.runtime166)return null;
 for(const a of run.nodes163.acquisitions){if(!ids.includes(a.relic_id)||run.runtime166.upgrade_claims.some(c=>c.source_id===a.id)||a.grant_ids.length)continue;
  const options=enhancementOptions166(run,a.relic_id);if(!options.some(o=>!o.disabled))continue;
  const meta=relicMeta163(run,a.relic_id);return {claim_id:a.id,relic_id:a.relic_id,name:meta.name,description:meta.effect_text};
 }return null;
}
export function enhancementView166(run){const pending=pendingEnhancement166(run);return pending?{...pending,options:enhancementOptions166(run,pending.relic_id)}:null;}
function recordUpgrade(run,{source_id,kind,instance_id,atk=0,def=0,tribute_required=null,special_spell_search=false}){
 const item=run.instances163.items.find(i=>i.id===instance_id);if(!item||item.seal_remaining)fail('사용 가능한 덱의 카드 1매를 골라줘.');
 if(item.atk_bonus+atk>9999||item.def_bonus+def>9999)fail('카드 강화 한도를 초과해.');
 item.atk_bonus+=atk;item.def_bonus+=def;if(tribute_required!==null)item.tribute_required=tribute_required;if(special_spell_search)item.special_spell_search=true;
 run.runtime166.upgrade_claims.push({source_id,kind,instance_id,atk,def,tribute_required,special_spell_search});
}
export function applyEnhancement166(run,args){
 const prior=run.runtime166.upgrade_claims.find(c=>c.source_id===args.claim_id);if(prior){if(prior.instance_id!==args.instance_id)fail('이미 다른 카드에 적용한 강화야.');return false;}
 const p=pendingEnhancement166(run);if(!p||p.claim_id!==args.claim_id)fail('현재 선택을 기다리는 강화 유물을 골라줘.');
 const row=enhancementOptions166(run,p.relic_id).find(i=>i.instance_id===args.instance_id);if(!row||row.disabled)fail(row?.reason||'강화할 카드 1매를 골라줘.');
 const params=relicMeta163(run,p.relic_id).params;
 recordUpgrade(run,{source_id:p.claim_id,kind:p.relic_id,instance_id:row.id,atk:p.relic_id==='red_dragon_eye'?params.atk:0,tribute_required:p.relic_id==='white_dragon_eye'?1:null,special_spell_search:p.relic_id==='magician_grimoire'});return true;
}
export function eventOptions166(run,kind){
 const eligibleMain=run.instances163.active.main.filter(id=>!run.instances163.items.find(i=>i.id===id).seal_remaining).length;
 return instanceCards163(run,{deckOnly:true,monstersOnly:true}).map(item=>{const reason=item.group!=='main'?'메인 덱 몬스터를 골라줘.':item.seal_remaining?'이미 봉인 중인 카드야.':kind==='card_sealing'&&isEnhanced166(item)?'강화되지 않은 카드만 봉인할 수 있어.':kind==='card_sealing'&&eligibleMain<=20?'봉인 뒤 사용 가능한 메인 덱 20장이 남아야 해.':'';return {...item,disabled:!!reason,reason};});
}
export function applyEnhancementEvent166(run,event,args){
 if(!['card_enhancement','card_sealing'].includes(event.kind))return false;
 const option=eventOptions166(run,event.kind).find(o=>o.instance_id===args.instance_id);if(!option||option.disabled)fail(option?.reason||'이번 이벤트에 맞는 덱 몬스터 1매를 골라줘.');
 const source_id=`n166_${event.node_id}_${event.kind}`,p=eventMeta163(run,event.kind).params;
 if(event.kind==='card_enhancement'){
  if(!['atk','def'].includes(args.stat))fail('공격력 또는 수비력을 골라줘.');
  recordUpgrade(run,{source_id,kind:event.kind,instance_id:option.id,atk:args.stat==='atk'?p.amount:0,def:args.stat==='def'?p.amount:0});
 }else{
  const item=run.instances163.items.find(i=>i.id===option.id);item.seal_remaining=p.battles;
  run.runtime166.seal_claims.push({source_id,node_id:event.node_id,instance_id:item.id,started_after:run.runtime166.completed_battles.length,duration:p.battles,atk:p.atk,def:p.def,finished_at:null});
 }
 // Event outcome is proven by the copy ledger; existing event shape stays stable.
 event.option163=null;return true;
}
export function tickSeals166(run,resultId){
 const state=run.runtime166;if(state.completed_battles.includes(resultId))return false;
 const result=run.bridge147.results.find(r=>r.result_id===resultId);if(!result||run.history.some(h=>h.kind==='lizard_retreat163'&&h.result_id===resultId))fail('완료된 실제 결투 기록이 필요해.');
 state.completed_battles.push(resultId);
 for(const seal of state.seal_claims){if(seal.finished_at!==null)continue;const item=run.instances163.items.find(i=>i.id===seal.instance_id);if(!item)fail('봉인 중인 카드 개체가 사라졌어.');item.seal_remaining=Math.max(0,seal.duration-(state.completed_battles.length-seal.started_after));if(!item.seal_remaining){item.atk_bonus+=seal.atk;item.def_bonus+=seal.def;seal.finished_at=resultId;}}
 return true;
}
export function cleanRuntime166(v,run){
 const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
 const id=s=>typeof s==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(s),n=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
 if(!exact(v,Object.keys(emptyRuntime166()))||v.schema!==1||!['upgrade_claims','seal_claims','completed_battles','native_uses'].every(k=>Array.isArray(v[k])&&v[k].length<=1000))fail('새 강화·봉인 원정 기록이 달라.');
 const expected=run.bridge147?.results.filter(r=>!run.history.some(h=>h.kind==='lizard_retreat163'&&h.result_id===r.result_id)).map(r=>r.result_id)??[];
 if(JSON.stringify(v.completed_battles)!==JSON.stringify(expected))fail('봉인 진행과 실제 완료 전투 기록이 달라.');
 const sourceIds=new Set();for(const c of v.upgrade_claims){
  if(!exact(c,['source_id','kind','instance_id','atk','def','tribute_required','special_spell_search'])||!id(c.source_id)||sourceIds.has(c.source_id)||!/^i163_[1-9][0-9]{0,9}$/.test(c.instance_id)||!n(c.atk,0,9999)||!n(c.def,0,9999)||![null,1].includes(c.tribute_required)||typeof c.special_spell_search!=='boolean')fail('강화 지급 기록이 달라.');sourceIds.add(c.source_id);
  if(ids.includes(c.kind)){const a=run.nodes163.acquisitions.find(a=>a.id===c.source_id&&a.relic_id===c.kind),p=relicMeta163(run,c.kind).params,item=run.instances163.items.find(i=>i.id===c.instance_id),card=item&&run.collection.find(e=>e.card.identity_key===item.identity_key)?.card;if(!a||a.grant_ids.length||c.atk!==(c.kind==='red_dragon_eye'?p.atk:0)||c.def!==0||c.tribute_required!==(c.kind==='white_dragon_eye'?1:null)||c.special_spell_search!==(c.kind==='magician_grimoire')||card&&(c.kind==='white_dragon_eye'&&(card.level!==8||!['일반 몬스터','효과 몬스터'].includes(card.type))||c.kind==='red_dragon_eye'&&card.level!==7||c.kind==='magician_grimoire'&&card.race!=='마법사족'))fail('유물과 강화 지급 기록이 달라.');}
  else if(c.kind==='card_enhancement'){const e=Object.values(run.nodes163.events).find(e=>`n166_${e.node_id}_card_enhancement`===c.source_id),p=eventMeta163(run,c.kind).params;if(e?.kind!==c.kind||e.choice!=='accept'||(c.atk!==p.amount||c.def!==0)&&(c.def!==p.amount||c.atk!==0)||c.tribute_required!==null||c.special_spell_search)fail('카드 강화 이벤트와 지급 기록이 달라.');}
  else fail('등록되지 않은 강화야.');
 }
 const sealed=new Set();for(const s of v.seal_claims){const e=run.nodes163.events[s.node_id],p=eventMeta163(run,'card_sealing').params;if(!exact(s,['source_id','node_id','instance_id','started_after','duration','atk','def','finished_at'])||s.source_id!==`n166_${s.node_id}_card_sealing`||e?.kind!=='card_sealing'||e.choice!=='accept'||sealed.has(s.instance_id)||!n(s.started_after,0,v.completed_battles.length)||s.duration!==p.battles||s.atk!==p.atk||s.def!==p.def)fail('카드 봉인 기록이 달라.');sealed.add(s.instance_id);const end=s.started_after+s.duration,finished=v.completed_battles.length>=end?v.completed_battles[end-1]:null;if(s.finished_at!==finished)fail('봉인 해제 시점과 완료 전투 수가 달라.');}
 for(const e of Object.values(run.nodes163.events)){if(e.choice!=='accept')continue;if(e.kind==='card_enhancement'&&v.upgrade_claims.filter(c=>c.source_id===`n166_${e.node_id}_card_enhancement`).length!==1||e.kind==='card_sealing'&&v.seal_claims.filter(c=>c.source_id===`n166_${e.node_id}_card_sealing`).length!==1)fail('선택한 카드 강화·봉인 이벤트의 지급 기록이 없어.');}
 for(const item of run.instances163.items){const upgrades=v.upgrade_claims.filter(c=>c.instance_id===item.id),seals=v.seal_claims.filter(c=>c.instance_id===item.id),forge=run.runtime163.forge_claims.filter(c=>c.instance_id===item.id),atk=[...upgrades,...forge].reduce((n,c)=>n+c.atk,0)+seals.filter(s=>s.finished_at).reduce((n,s)=>n+s.atk,0),def=[...upgrades,...forge].reduce((n,c)=>n+c.def,0)+seals.filter(s=>s.finished_at).reduce((n,s)=>n+s.def,0),remaining=seals.reduce((n,s)=>n+Math.max(0,s.duration-(v.completed_battles.length-s.started_after)),0);if(item.atk_bonus!==atk||item.def_bonus!==def||item.tribute_required!==(upgrades.some(c=>c.tribute_required===1)?1:null)||item.special_spell_search!==upgrades.some(c=>c.special_spell_search)||item.seal_remaining!==remaining)fail('카드 개체의 능력치·효과·봉인과 지급 근거가 달라.');}
 cleanNativeUses166(v.native_uses,run);return copy(v);
}
