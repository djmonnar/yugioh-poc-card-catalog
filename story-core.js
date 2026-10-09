export const STORY_KEY='poc-story-authoring-v1';
import {NUMERIC_SKILLS,battleSkills} from './story-skills.js?v=20261009-73';
import {parsePresentation} from './story-media.js?v=20261009-media88';
export const SKILLS={lp_bonus:'시작 LP 추가',heal_once:'전투당 1회 LP 회복',opening_draw:'시작 패 장수 추가',start_hand:'지정 카드를 패에 들고 시작',start_field:'마법·함정을 놓고 시작',start_monster:'몬스터를 필드에 놓고 시작',start_grave:'지정 카드를 묘지에 두고 시작',parasite_deck:'상대 덱에 발동된 기생충 파라사이드 넣기',add_hand_once:'전투당 1회 지정 카드 받기',draw_once:'위기 상황에서 1회 추가 드로우'};
export const REWARD_TIERS=['ANY','N','R','SR','UR'];
const fail=msg=>{throw new Error(msg);};
const text=(v,max)=>typeof v==='string'&&v.length<=max?v:fail('글자 수나 문서 형식을 확인해줘.');
const id=v=>/^[a-zA-Z0-9_-]{1,100}$/.test(v)?v:fail('항목 ID를 확인해줘.');
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max?n:fail('숫자 범위를 확인해줘.');
export function cardRef(c){return {slot:c.slot,internal_id:c.internal_id,identity_key:c.identity_key,name_ko:c.name_ko};}
export function resolveRef(ref,cards){return ref&&cards.find(c=>c.slot===ref.slot&&c.internal_id===ref.internal_id&&
  (c.identity_key===ref.identity_key||(c.previous_identity_keys?.includes(ref.identity_key)&&c.name_ko===ref.name_ko)));}
function ref(v){if(!v||!Number.isInteger(v.slot)||!Number.isInteger(v.internal_id)||!/^[a-f0-9]{64}$/.test(v.identity_key))fail('카드 식별값을 확인해줘.');return {...cardRef(v),name_ko:text(v.name_ko,200)};}
export function safePortrait(v){return typeof v==='string'&&(v===''||/^(?:assets|content-packs)\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)$/.test(v)&&!v.includes('..')||/^https:\/\/[a-z]{20}\.supabase\.co\/storage\/v1\/object\/public\/poc-story-assets\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)$/.test(v)&&!v.includes('..'));}
export function newActor(actor_id=crypto.randomUUID()){return {actor_id,name:'새 캐릭터',portrait:'',skills:[]};}
export function newBattle(battle_id=crypto.randomUUID()){return {battle_id,name:'새 전투',actor_id:'',recipe:'',ruleset:'duel_links_plan',intro:'',win:'',loss:'',rewards:{first:[],repeat:[]}};}
export function emptyStory(){return {schema_version:1,kind:'poc-story-authoring',title:'나의 스토리',catalog_dataset_id:'',actors:[],battles:[]};}
function reward(r){
  if(r.kind==='gold')return {kind:'gold',amount:integer(r.amount,1,100000)};
  if(r.kind==='card')return {kind:'card',card:ref(r.card),count:integer(r.count,1,3)};
  if(r.kind==='card_pool'){
    if(!Array.isArray(r.entries)||!r.entries.length||r.entries.length>100)fail('랜덤 후보 카드는 1~100종을 골라줘.');
    const seen=new Set();return {kind:'card_pool',count:integer(r.count,1,3),entries:r.entries.map(e=>{
      const card=ref(e.card);if(seen.has(card.slot))fail('랜덤 후보에 같은 카드가 두 번 있어.');seen.add(card.slot);
      return {card,weight:integer(e.weight,1,10000)};
    })};
  }
  if(r.kind==='random'&&REWARD_TIERS.includes(r.rarity))return {kind:'random',rarity:r.rarity,count:integer(r.count,1,3)};
  fail('보상 종류를 확인해줘.');
}
export function parseRaid(v){
  const max_hp=integer(v?.max_hp,1,60000);
  if(!Array.isArray(v.milestones)||v.milestones.length>10)fail('체력 구간 보상은 10개까지야.');
  const ids=new Set(),hps=new Set();
  const milestones=v.milestones.map(m=>{
    const milestone_id=id(m.milestone_id),hp=integer(m.hp,1,max_hp-1);
    if(ids.has(milestone_id)||hps.has(hp))fail('체력 구간이나 ID가 중복돼.');ids.add(milestone_id);hps.add(hp);
    const rewards={};for(const k of ['first','repeat']){
      if(!Array.isArray(m.rewards?.[k])||m.rewards[k].length>20)fail('체력 구간 보상을 확인해줘.');
      rewards[k]=m.rewards[k].map(reward);
    }
    return {milestone_id,hp,rewards};
  });return {max_hp,milestones};
}
export function battleRewardLists(b){return [b.rewards,...(b.raid?.milestones||[]).map(m=>m.rewards)];}
export function parseSkills(values){
  if(!Array.isArray(values)||values.length>10)fail('특성은 종류별 한 개씩, 최대 10개까지야.');
  const kinds=new Set();return values.map(s=>{
    if(!s||!Object.hasOwn(SKILLS,s.kind)||kinds.has(s.kind))fail('중복 또는 알 수 없는 스킬이 있어.');kinds.add(s.kind);
    if(s.kind==='parasite_deck')return {kind:s.kind};
    if(s.kind==='start_grave'){
      if(!Array.isArray(s.entries)||!s.entries.length||s.entries.length>12)fail('시작 묘지 카드는 1~12장을 골라줘.');
      const seen=new Set(),entries=s.entries.map(e=>{const card=ref(e.card);if(seen.has(card.slot))fail('같은 묘지 카드는 장수로 설정해줘.');seen.add(card.slot);return {card,count:integer(e.count,1,12)};});
      if(entries.reduce((n,e)=>n+e.count,0)>12)fail('시작 묘지 카드는 합쳐서 12장까지야.');
      return {kind:s.kind,entries};
    }
    const bounds=NUMERIC_SKILLS[s.kind],out=bounds?{kind:s.kind,value:integer(s.value,bounds[0],bounds[1])}:{kind:s.kind,card:ref(s.card)};
    if(s.kind==='draw_once')out.threshold=integer(s.threshold,100,16000);
    if(s.kind==='start_monster'){if(!['attack','defense','set'].includes(s.position))fail('시작 몬스터의 표시 형식을 골라줘.');out.position=s.position;}
    return out;
  });
}
export function parsePreset(v){
  if(v?.schema_version!==1||v.kind!=='poc-skill-preset')fail('특성 묶음 JSON을 골라줘.');
  return {name:text(v.name,100),skills:parseSkills(v.skills)};
}
export function parseStory(v){
  if(v?.schema_version!==1||v.kind!=='poc-story-authoring'||!Array.isArray(v.actors)||!Array.isArray(v.battles)||v.actors.length>100||v.battles.length>100)fail('스토리 편집기에서 내보낸 JSON을 골라줘.');
  const doc={...emptyStory(),title:text(v.title,200),catalog_dataset_id:text(v.catalog_dataset_id,100)};
  const seen=new Set();doc.actors=v.actors.map(a=>{
    id(a.actor_id);if(seen.has(a.actor_id)||!safePortrait(a.portrait))fail('캐릭터 ID·초상화를 확인해줘.');seen.add(a.actor_id);
    const out={actor_id:a.actor_id,name:text(a.name,100),portrait:a.portrait,skills:parseSkills(a.skills)};
    if(a.presentation!==undefined)out.presentation=parsePresentation(a.presentation);
    if(a.skill_profiles!==undefined){if(!Array.isArray(a.skill_profiles)||a.skill_profiles.length>10)fail('특성 묶음은 캐릭터별 10개까지야.');const ids=new Set();out.skill_profiles=a.skill_profiles.map(p=>{id(p.profile_id);if(ids.has(p.profile_id))fail('특성 묶음 ID가 중복돼.');ids.add(p.profile_id);return {profile_id:p.profile_id,name:text(p.name,100),skills:parseSkills(p.skills)};});}return out;
  });
  const battles=new Set();doc.battles=v.battles.map(b=>{
    id(b.battle_id);if(battles.has(b.battle_id)||!['classic','duel_links_plan'].includes(b.ruleset)||!(b.recipe===''||/^(?:cpu|DLR)_\d{3}\.ydc$/.test(b.recipe)))fail('전투 ID·덱·규칙을 확인해줘.');battles.add(b.battle_id);
    const out={battle_id:b.battle_id,name:text(b.name,100),actor_id:text(b.actor_id,100),recipe:b.recipe,ruleset:b.ruleset,
      intro:text(b.intro,6000),win:text(b.win,6000),loss:text(b.loss,6000),rewards:{}};
    for(const k of ['first','repeat']){if(!Array.isArray(b.rewards?.[k])||b.rewards[k].length>20)fail('전투 보상을 확인해줘.');out.rewards[k]=b.rewards[k].map(reward);}
    if(b.skill_profile!==undefined)out.skill_profile=b.skill_profile===''?'':id(b.skill_profile);
    if(b.requires_previous!==undefined){if(typeof b.requires_previous!=='boolean')fail('이전 전투 클리어 필요 설정을 확인해줘.');out.requires_previous=b.requires_previous;}
    if(b.raid!==undefined){out.raid=parseRaid(b.raid);out.requires_previous=false;
      for(const k of ['first','repeat'])if(battleRewardLists(out).reduce((n,list)=>n+list[k].reduce((s,r)=>s+(r.count||0),0),0)>60)fail('한 회차에 받는 카드는 체력 구간·처치 보상을 합쳐 60장까지야.');}
    return out;
  });return doc;
}
export function validateStory(doc,cards,decks){
  const issues=[];
  try{parseStory(doc);}catch(e){issues.push(e.message);}
  if(!doc.title.trim())issues.push('시나리오 이름을 입력해줘.');if(!doc.battles.length)issues.push('전투를 한 개 이상 추가해줘.');
  for(const a of doc.actors){
    if(!a.name.trim())issues.push('캐릭터 이름을 입력해줘.');
    for(const profile of [{name:'기본 특성',skills:a.skills},...(a.skill_profiles||[])]){if(!profile.name.trim())issues.push(`${a.name}: 특성 이름을 입력해줘.`);for(const skill of profile.skills){
      if(skill.kind==='start_grave')for(const e of skill.entries||[]){const c=resolveRef(e.card,cards);if(!c||c.special||c.type==='융합 몬스터')issues.push(`${a.name}: 시작 묘지 카드를 현재 도감에서 다시 골라줘.`);}
      if(skill.kind==='parasite_deck'&&!cards.some(c=>c.slot===197&&c.internal_id===762))issues.push(`${a.name}: 기생충 파라사이드 카드 자료가 없어.`);
      if(skill.card){const card=resolveRef(skill.card,cards);if(!card||card.special||card.type==='융합 몬스터')issues.push(`${a.name}: 스킬의 카드를 현재 도감에서 다시 골라줘.`);
        else if(skill.kind==='start_field'&&!['마법','함정'].includes(card.type))issues.push(`${a.name}: 시작 필드는 마법·함정 카드를 골라줘.`);}
      if(skill.kind==='start_monster'){const c=resolveRef(skill.card,cards);if(!c||!c.type.includes('몬스터')||c.type==='융합 몬스터')issues.push(`${a.name}: 시작 몬스터는 메인 덱 몬스터를 골라줘.`);}
    }}
  }
  for(const b of doc.battles){
    if(!b.name.trim())issues.push('전투 이름을 입력해줘.');
    const actor=doc.actors.find(a=>a.actor_id===b.actor_id),deck=decks.find(d=>d.source_recipe.filename===b.recipe);
    if(!actor)issues.push(`${b.name}: 전투 상대를 골라줘.`);
    else try{battleSkills(actor,b);}catch(e){issues.push(`${b.name}: ${e.message}`);}
    if(!deck||deck.ruleset!==b.ruleset)issues.push(`${b.name}: 규칙에 맞는 AI 덱을 골라줘.`);
    for(const list of battleRewardLists(b))for(const k of ['first','repeat'])for(const r of list[k]){
      if(r.kind==='card'){const c=resolveRef(r.card,cards);if(!c||c.special||(!c.reward_eligible&&c.rarity!=='L'))issues.push(`${b.name}: 보상 카드를 현재 도감에서 다시 골라줘.`);}
      if(r.kind==='card_pool')for(const e of r.entries||[]){const c=resolveRef(e.card,cards);if(!c||c.special||(!c.reward_eligible&&c.rarity!=='L'))issues.push(`${b.name}: 랜덤 후보 카드를 현재 도감에서 다시 골라줘.`);}
      if(r.kind==='random'&&!cards.some(c=>!c.special&&c.reward_eligible&&c.rarity!=='L'&&c.draw_enabled!==false&&(r.rarity==='ANY'||c.rarity===r.rarity)))issues.push(`${b.name}: ${r.rarity} 무작위 보상 카드풀이 비어 있어.`);
    }
  }
  return {issues,authoring_ready:!issues.length,engine_applied:false};
}
export function canonicalStory(doc,meta,cards){
  const clean=parseStory(doc);clean.catalog_dataset_id=meta.dataset_id;
  const current=ref=>{const c=resolveRef(ref,cards);if(!c)fail('카드가 변경됐어. 현재 도감에서 다시 골라줘.');return cardRef(c);};
  for(const a of clean.actors)for(const p of [{skills:a.skills},...(a.skill_profiles||[])])for(const s of p.skills){if(s.card)s.card=current(s.card);if(s.kind==='start_grave')for(const e of s.entries)e.card=current(e.card);}
  for(const b of clean.battles)for(const list of battleRewardLists(b))for(const k of ['first','repeat'])for(const r of list[k]){
    if(r.kind==='card')r.card=current(r.card);
    if(r.kind==='card_pool')for(const e of r.entries)e.card=current(e.card);
  }
  return clean;
}
export async function reviewFiles(doc,meta,cards,decks){
  const clean=canonicalStory(doc,meta,cards);
  const check=validateStory(clean,cards,decks);if(check.issues.length)fail(check.issues.join('\n'));
  const source=JSON.stringify(clean,null,2)+'\n';
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source))),b=>b.toString(16).padStart(2,'0')).join('');
  const used=[...new Set(clean.battles.map(b=>b.recipe))],ids=new Map(used.map((name,i)=>[name,`deck-${i}`]));
  const actors=clean.actors.filter(a=>clean.battles.some(b=>b.actor_id===a.actor_id)).map((a,i)=>({id:`actor-${i}`,name:a.name,portrait:null,decks:[...new Set(clean.battles.filter(b=>b.actor_id===a.actor_id).map(b=>ids.get(b.recipe)))]}));
  const actorId=new Map(clean.actors.filter(a=>clean.battles.some(b=>b.actor_id===a.actor_id)).map((a,i)=>[a.actor_id,`actor-${i}`]));
  const nodes=[];
  clean.battles.forEach((b,i)=>{
    const actor=actorId.get(b.actor_id);nodes.push({id:`intro-${i}`,kind:'dialogue',actor,text:b.intro||`${b.name} 시작`,next:`duel-${i}`},
      {id:`duel-${i}`,kind:'duel',actor,deck:ids.get(b.recipe),on_win:`win-${i}`,on_loss:`loss-${i}`},
      {id:`win-${i}`,kind:'dialogue',actor,text:b.win||'승리!',next:i+1<clean.battles.length?`intro-${i+1}`:'end'},
      {id:`loss-${i}`,kind:'end',text:b.loss||'다시 도전해 보자.'});
  });nodes.push({id:'end',kind:'end',text:'시나리오 완료'});
  const pack={schema_version:1,kind:'poc-content-pack',id:'story-authoring',name:clean.title,status:'draft',catalog_dataset_id:meta.dataset_id,
    assets:[],implementations:[{id:'authoring-data',kind:'story_event',source:'story-source.json',sha256:digest}],cards:[],
    decks:used.map(name=>({id:ids.get(name),ruleset:decks.find(d=>d.source_recipe.filename===name).ruleset,source_recipe:name})),actors,
    story:[{id:'chapter-1',title:clean.title,start:'intro-0',nodes}],roguelite:[]};
  return {source,pack};
}
