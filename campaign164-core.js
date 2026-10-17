import {cleanEncounterPool,ENCOUNTER_KINDS} from './roguelite-encounters.js?v=20261014-138';
import {parseSkills} from './story-core.js?v=20261012-shared127';

export const CAMPAIGN_KIND164='poc-expedition-campaign';
export const CAMPAIGN_LIBRARY_KIND164='poc-expedition-campaign-library';
export const CAMPAIGN_KINDS164=Object.freeze(['battle','elite','boss']);
export const CAMPAIGN_CHAPTERS164=3,CAMPAIGN_FLOORS164=15,CAMPAIGN_BYTES164=1500000;
export const CAMPAIGN_DRAFT_KEY164='yugioh-classic-campaign164-draft';
const clone=structuredClone,fail=m=>{throw Error(m);};
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys,label)=>{if(!plain(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail(`${label} 형식을 확인해줘.`);};
const text=(v,max,label)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail(`${label} 내용을 확인해줘.`);return v.normalize('NFC').trim();};
function bonus(v){if(!Number.isSafeInteger(v)||!(v===0||v>=100&&v<=8000))fail('추가 LP는 0 또는 100~8,000 사이 정수로 입력해줘.');return v;}
function validateSkillCards(skills,cards){
 if(!cards)return;const by=new Map(cards.map(c=>[c.identity_key,c]));
 const check=(ref,kind)=>{const c=by.get(ref.identity_key);if(!c||c.special||c.slot!==ref.slot||c.internal_id!==ref.internal_id||c.type==='융합 몬스터')fail('특성의 카드를 현재 도감에서 다시 골라줘.');if(kind==='start_monster'&&!c.type.includes('몬스터')||kind==='start_field'&&!['마법','함정'].includes(c.type))fail('특성에 맞는 종류의 카드를 골라줘.');};
 for(const s of skills){if(s.card)check(s.card,s.kind);for(const e of s.entries||[])check(e.card,'start_grave');if(s.kind==='parasite_deck'&&!cards.some(c=>c.slot===197&&c.internal_id===762))fail('기생충 파라사이드 카드 자료가 없어.');}
}
export function mergeCampaignTraits164(base,overrides){
 const initial=parseSkills(base),add=parseSkills(overrides),by=new Map(add.map(s=>[s.kind,s]));
 return parseSkills([...initial.map(s=>by.get(s.kind)||s),...add.filter(s=>!initial.some(p=>p.kind===s.kind))]);
}
export function classifyCampaignTemplate164(template,kind){
 if(!CAMPAIGN_KINDS164.includes(kind))fail('전투 종류를 확인해줘.');
 const [clean]=cleanEncounterPool([template]);
 return {...clean,allowed_kinds:CAMPAIGN_KINDS164.filter(k=>k===kind||clean.allowed_kinds.includes(k))};
}
export function effectiveTemplate164(template,category){
 const [clean]=cleanEncounterPool([template]);let skills=mergeCampaignTraits164(clean.skills,category.traits);
 const extra=bonus(category.lp_bonus),lp=(skills.find(s=>s.kind==='lp_bonus')?.value||0)+extra;
 if(lp>8000)fail(`${clean.opponent_name}: 기본 특성과 구역 보정을 합친 추가 LP는 8,000 이하여야 해.`);
 if(lp){const row={kind:'lp_bonus',value:lp};skills=skills.some(s=>s.kind==='lp_bonus')?skills.map(s=>s.kind==='lp_bonus'?row:s):[...skills,row];}
 return {...clone(clean),skills:parseSkills(skills)};
}
export function campaignCategoryLP164(template,category){return 4000+(effectiveTemplate164(template,category).skills.find(s=>s.kind==='lp_bonus')?.value||0);}
export function cleanCampaign164(value,cards){
 exact(value,['schema_version','kind','chapters'],'원정 구성');
 if(value.schema_version!==1||value.kind!==CAMPAIGN_KIND164||!Array.isArray(value.chapters)||value.chapters.length!==3)fail('원정은 15층으로 된 세 장으로 구성해줘.');
 if(new TextEncoder().encode(JSON.stringify(value)).length>CAMPAIGN_BYTES164)fail('원정 구성은 1.5MB 이하로 저장해줘.');
 const chapters=value.chapters.map((chapter,index)=>{
  exact(chapter,['id','name','description','floors','battle','elite','boss'],'구역');
  if(chapter.id!==`chapter-${index+1}`||chapter.floors!==15)fail('1~3장 순서와 각 15층을 유지해줘.');
  const out={id:chapter.id,name:text(chapter.name,100,'구역 이름'),description:typeof chapter.description==='string'&&chapter.description.length<=2000?chapter.description:fail('구역 설명은 2,000자 이하로 적어줘.'),floors:15};
  for(const kind of CAMPAIGN_KINDS164){
   const item=chapter[kind];exact(item,['pool','lp_bonus','traits'],'전투 후보');
   const pool=cleanEncounterPool(item.pool),traits=parseSkills(item.traits);
   if(pool.some(t=>!t.allowed_kinds.includes(kind)))fail('상대 후보의 전투 종류를 확인해줘. 후보를 다시 고르면 선택한 종류에 맞게 저장돼.');
   if(kind==='battle'&&traits.length)fail('일반 전투는 상대의 기본 특성을 사용해. 추가 특성은 엘리트·보스에서 설정해줘.');
   validateSkillCards(traits,cards);
   if(cards){const by=new Map(cards.map(c=>[c.identity_key,c]));for(const t of pool){for(const [group,rows]of Object.entries(t.deck.groups))for(const ref of rows){const c=by.get(ref.identity_key);if(!c||c.special||c.slot!==ref.slot||c.internal_id!==ref.internal_id||c.name_ko!==ref.name_ko||c.name_en!==ref.name_en||(c.type==='융합 몬스터')!==(group==='extra'))fail(`${t.deck_name}: 상대 덱을 현재 카드로 다시 불러와줘.`);}validateSkillCards(t.skills,cards);}}
   out[kind]={pool,lp_bonus:bonus(item.lp_bonus),traits};
   for(const t of pool)effectiveTemplate164(t,out[kind]);
  }
  return out;
 });
 return {schema_version:1,kind:CAMPAIGN_KIND164,chapters};
}
export function campaignReady164(value){
 try{const d=cleanCampaign164(value),issues=[];for(const ch of d.chapters)for(const kind of CAMPAIGN_KINDS164)if(!ch[kind].pool.length)issues.push(`${ch.name} · ${{battle:'일반',elite:'엘리트',boss:'보스'}[kind]} 상대를 한 명 이상 골라줘.`);return {valid:!issues.length,issues};}
 catch(error){return {valid:false,issues:[error.message]};}
}
export function defaultCampaign164(pool){
 const clean=cleanEncounterPool(pool);
 return cleanCampaign164({schema_version:1,kind:CAMPAIGN_KIND164,chapters:[1,2,3].map(n=>({id:`chapter-${n}`,name:`제${n}장`,description:'봉인된 탑의 새로운 시련을 향해 오른다.',floors:15,...Object.fromEntries(CAMPAIGN_KINDS164.map(k=>[k,{pool:clone(clean.filter(t=>t.allowed_kinds.includes(k))),lp_bonus:0,traits:[]}]))}))});
}
export function cleanCampaignLibrary164(value,cards){
 exact(value,['schema','kind','version','document','updated_at'],'온라인 원정 구성');
 if(value.schema!==1||value.kind!==CAMPAIGN_LIBRARY_KIND164||!Number.isSafeInteger(value.version)||value.version<0)fail('원정 구성의 온라인 버전을 확인해줘.');
 const document=cleanCampaign164(value.document,cards),ready=campaignReady164(document);if(!ready.valid)fail(ready.issues[0]);
 if(value.version===0?value.updated_at!==null:typeof value.updated_at!=='string'||!Number.isFinite(Date.parse(value.updated_at)))fail('원정 구성의 저장 시각을 확인해줘.');
 return {schema:1,kind:CAMPAIGN_LIBRARY_KIND164,version:value.version,document,updated_at:value.updated_at};
}
