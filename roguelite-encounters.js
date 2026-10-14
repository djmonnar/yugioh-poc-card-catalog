import {parseBundle,validateDeck,groupCount,harpieCount,umiCount} from './ai-deck-core.js';
import {parseStory,parseSkills,safePortrait,resolveRef,cardRef} from './story-core.js';
import {battleSkills} from './story-skills.js';
import {parseCharacters,resolveCharacters,CHARACTER_KEY} from './character-library.js';
import {readLibrary,scenarioKey,LIBRARY_KEY} from './story-library.js';
import {validateMap} from './roguelite-map.js?v=20261014-138';

export const ENCOUNTER_VERSION='tower-encounters-v1';
export const ENCOUNTER_KINDS=Object.freeze(['battle','elite','boss']);
const fail=message=>{throw new Error(message);};
const text=(value,max,label)=>typeof value==='string'&&value.trim()&&value.length<=max?value:fail(`${label}을 확인해줘.`);
const identifier=(value,label)=>/^[A-Za-z0-9_-]{1,100}$/.test(value)?value:fail(`${label}을 확인해줘.`);
const nodeKind=kind=>kind==='midboss'?'elite':kind;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);

export function recommendedEncounterKinds(difficulty){
  if(!Number.isInteger(difficulty)||difficulty<1||difficulty>7)fail('상대 덱 난이도를 확인해줘.');
  return difficulty>=5?['elite','boss']:difficulty===4?['elite']:['battle'];
}

function cleanDeck(value){
  const [deck]=parseBundle({schema_version:1,kind:'poc-ai-deck-bundle',decks:[value]},[]);
  if(deck.ruleset!=='duel_links_plan'||!deck.source_recipe||!deck.name.trim()||
    groupCount(deck,'main')<20||groupCount(deck,'main')>30||groupCount(deck,'extra')>15||groupCount(deck,'side')>15)fail('상대는 완성된 스피드 듀얼 덱을 골라줘.');
  const identities=new Map(),slots=new Map(),identitySlots=new Map();
  for(const group of ['main','extra','side'])for(const row of deck.groups[group]){
    if(row.slot>2047)fail('상대 덱 카드 번호를 확인해줘.');
    const prior=slots.get(row.slot);
    if(prior&&(prior.identity_key!==row.identity_key||prior.internal_id!==row.internal_id))fail('상대 덱의 카드 식별값이 중복돼.');
    if(identitySlots.has(row.identity_key)&&identitySlots.get(row.identity_key)!==row.slot)fail('상대 덱의 카드 식별값이 중복돼.');
    slots.set(row.slot,row);
    identitySlots.set(row.identity_key,row.slot);
    identities.set(row.identity_key,(identities.get(row.identity_key)||0)+row.count);
  }
  if([...identities.values()].some(n=>n>3)||harpieCount(deck)>3||umiCount(deck)>3)fail('상대 덱의 같은 카드 매수를 확인해줘.');
  return deck;
}

function cleanTemplate(value){
  if(!plain(value))fail('상대 후보 형식을 확인해줘.');
  const template_id=text(value.template_id,210,'상대 후보 ID');
  if(!/^[A-Za-z0-9_:-]+$/.test(template_id))fail('상대 후보 ID를 확인해줘.');
  const source=value.source;
  if(!plain(source)||!Number.isSafeInteger(source.scenario_version)||source.scenario_version<0)fail('상대 후보 출처를 확인해줘.');
  const cleanSource={scenario_id:identifier(source.scenario_id,'시나리오 ID'),scenario_name:text(source.scenario_name,200,'시나리오 이름'),
    scenario_version:source.scenario_version,battle_id:identifier(source.battle_id,'전투 ID'),actor_id:identifier(source.actor_id,'캐릭터 ID'),
    catalog_dataset_id:typeof source.catalog_dataset_id==='string'&&source.catalog_dataset_id.length<=100?source.catalog_dataset_id:fail('상대 카드 버전을 확인해줘.')};
  if(source.character_id!==undefined)cleanSource.character_id=identifier(source.character_id,'공용 캐릭터 ID');
  if(source.skill_profile!==undefined)cleanSource.skill_profile=source.skill_profile===''?'':identifier(source.skill_profile,'특성 묶음 ID');
  if(template_id!==`${cleanSource.scenario_id}:${cleanSource.battle_id}`)fail('상대 후보와 출처 ID가 달라.');
  const deck=cleanDeck(value.deck);
  if(value.recipe!==deck.source_recipe.filename||value.deck_name!==deck.name||value.difficulty!==deck.difficulty)fail('상대 표시 정보와 덱이 달라.');
  if(!safePortrait(value.portrait))fail('상대 초상화 경로를 확인해줘.');
  if(!Array.isArray(value.allowed_kinds)||value.allowed_kinds.some(k=>!ENCOUNTER_KINDS.includes(k))||new Set(value.allowed_kinds).size!==value.allowed_kinds.length)fail('상대 등장 종류를 확인해줘.');
  return {template_id,opponent_name:text(value.opponent_name,100,'상대 이름'),battle_name:text(value.battle_name,100,'전투 이름'),
    portrait:value.portrait,deck_name:deck.name,recipe:deck.source_recipe.filename,difficulty:deck.difficulty,
    allowed_kinds:ENCOUNTER_KINDS.filter(k=>value.allowed_kinds.includes(k)),deck,skills:parseSkills(value.skills),source:cleanSource};
}

export function cleanEncounterPool(values){
  if(!Array.isArray(values)||values.length>200)fail('상대 후보는 200개까지 골라줘.');
  const seen=new Set();return values.map(value=>{
    const clean=cleanTemplate(value);
    if(seen.has(clean.template_id))fail('같은 상대 후보가 두 번 있어.');
    seen.add(clean.template_id);return clean;
  });
}

// Only explicit authored actor/recipe links become candidates. No character is
// inferred from a deck title. Invalid/raid/classic rows never become substitutes.
export function buildEncounterPool({scenarios,characters=[],decks,cards}={}){
  if(!Array.isArray(scenarios)||scenarios.length>40||!Array.isArray(decks))fail('상대의 시나리오와 덱 목록을 확인해줘.');
  const shared=parseCharacters(characters),pool=[],issues=[],seen=new Set();
  for(const row of scenarios){
    let document;
    try{
      identifier(row.id,'시나리오 ID');
      document=shared.length?resolveCharacters(row.document,shared):parseStory(row.document);
    }catch(error){issues.push({scenario_id:row?.id||'',message:error.message});continue;}
    for(const battle of document.battles){
      if(battle.ruleset!=='duel_links_plan'||battle.raid)continue;
      try{
        const actor=document.actors.find(a=>a.actor_id===battle.actor_id);
        if(!actor)fail('연결된 캐릭터가 없어.');
        const matches=decks.filter(d=>d.source_recipe?.filename===battle.recipe&&d.ruleset===battle.ruleset);
        if(matches.length!==1)fail('연결된 상대 덱을 하나로 확인할 수 없어.');
        const deck=cleanDeck(matches[0]);
        if(cards){const check=validateDeck(deck,cards);if(check.issues.length)fail(check.issues.join(' '));}
        const skills=structuredClone(battleSkills(actor,battle));
        if(cards)for(const skill of skills){
          const current=ref=>{const card=resolveRef(ref,cards);if(!card||card.special)fail('특성의 카드를 현재 도감에서 다시 확인해줘.');return cardRef(card);};
          if(skill.card)skill.card=current(skill.card);
          if(skill.kind==='start_grave')for(const entry of skill.entries)entry.card=current(entry.card);
        }
        const source={scenario_id:row.id,scenario_name:document.title,scenario_version:row.version??0,
          battle_id:battle.battle_id,actor_id:actor.actor_id,catalog_dataset_id:document.catalog_dataset_id};
        if(actor.character_id)source.character_id=actor.character_id;
        if(battle.skill_profile!==undefined)source.skill_profile=battle.skill_profile;
        const entry=cleanTemplate({template_id:`${row.id}:${battle.battle_id}`,opponent_name:actor.name,battle_name:battle.name,
          portrait:actor.portrait,deck_name:deck.name,recipe:battle.recipe,difficulty:deck.difficulty,
          allowed_kinds:recommendedEncounterKinds(deck.difficulty),deck,skills,source});
        if(seen.has(entry.template_id))fail('같은 상대 후보 ID가 두 번 있어.');
        seen.add(entry.template_id);pool.push(entry);
      }catch(error){issues.push({scenario_id:row.id,battle_id:battle.battle_id,battle_name:battle.name,message:error.message});}
    }
  }
  return {pool,issues};
}

export function browserEncounterPool(storage,decks,cards){
  const library=readLibrary(JSON.parse(storage.getItem(LIBRARY_KEY)||'null'));
  const characters=parseCharacters(JSON.parse(storage.getItem(CHARACTER_KEY)||'[]'));
  const scenarios=library.entries.flatMap(row=>{
    const raw=storage.getItem(scenarioKey(row.id));return raw?[{id:row.id,version:row.version??0,document:JSON.parse(raw)}]:[];
  });
  return buildEncounterPool({scenarios,characters,decks,cards});
}

function random(seed){
  if(typeof seed!=='string'||!seed.trim()||seed.length>128)fail('원정 시드를 확인해줘.');
  let state=2166136261;
  for(const ch of `${ENCOUNTER_VERSION}:${seed.normalize('NFC').trim()}`){state^=ch.codePointAt(0);state=Math.imul(state,16777619)>>>0;}
  if(!state)state=0x9e3779b9;
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
}

export function assignEncounters(map,values,{seed=map?.seed}={}){
  if(!validateMap(map).valid)fail('상대를 배치할 지도를 확인해줘.');
  if(seed!==map.seed)fail('상대 배치 시드와 원정 지도가 달라.');
  const pool=cleanEncounterPool(values).sort((a,b)=>a.template_id.localeCompare(b.template_id,'en'));
  const next=random(seed),assignments={},uses=new Map(),floorActors=new Map();
  const battleNodes=map.nodes.filter(n=>ENCOUNTER_KINDS.includes(nodeKind(n.kind))).sort((a,b)=>a.floor-b.floor||a.lane-b.lane);
  for(const node of battleNodes){
    const kind=nodeKind(node.kind),eligible=pool.filter(e=>e.allowed_kinds.includes(kind));
    if(!eligible.length)fail(`${{battle:'일반',elite:'엘리트',boss:'보스'}[kind]} 전투의 상대를 하나 이상 골라줘.`);
    // Prefer distinct opponents on the same floor, then rotate the eligible
    // authored decks. Selection order and later pool edits cannot alter a save.
    const usedActors=floorActors.get(node.floor)||new Set();
    const actorKey=e=>e.source.character_id||e.opponent_name;
    const diverse=eligible.filter(e=>!usedActors.has(actorKey(e))),candidates=diverse.length?diverse:eligible;
    const least=Math.min(...candidates.map(e=>uses.get(`${kind}:${e.template_id}`)||0));
    const choices=candidates.filter(e=>(uses.get(`${kind}:${e.template_id}`)||0)===least);
    const chosen=choices[Math.floor(next()*choices.length)];
    uses.set(`${kind}:${chosen.template_id}`,least+1);usedActors.add(actorKey(chosen));floorActors.set(node.floor,usedActors);
    assignments[node.id]={...structuredClone(chosen),kind};
  }
  return cleanEncounters(assignments,map);
}

export function cleanEncounters(assignments,map){
  if(!plain(assignments)||Object.keys(assignments).length>200)fail('저장된 상대 배치를 확인해줘.');
  if(!Object.keys(assignments).length)return {};
  if(!map||!validateMap(map).valid)fail('상대 배치에 연결된 지도가 없어.');
  const expected=map.nodes.filter(n=>ENCOUNTER_KINDS.includes(nodeKind(n.kind))),byId=new Map(expected.map(n=>[n.id,n]));
  if(Object.keys(assignments).length!==expected.length)fail('전투마다 상대가 정해져 있어야 해.');
  const clean={};
  for(const [nodeId,value] of Object.entries(assignments)){
    const node=byId.get(nodeId);
    if(!node||value?.kind!==nodeKind(node.kind))fail('상대 배치와 전투 종류가 달라.');
    const template=cleanTemplate(value);
    if(!template.allowed_kinds.includes(value.kind))fail('허용되지 않은 종류에 상대가 배치됐어.');
    clean[nodeId]={...template,kind:value.kind};
  }
  return clean;
}
