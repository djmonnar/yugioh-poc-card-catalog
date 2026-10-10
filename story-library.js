import {STORY_KEY,emptyStory,parseStory} from './story-core.js?v=20261010-characters103';

export const LIBRARY_KEY='poc-story-library-v1';
export const scenarioKey=id=>id==='main'?STORY_KEY:`${STORY_KEY}:${id}`;
export function actorTemplates(scenarios,current){
  const content=a=>JSON.stringify([a.name,a.portrait,a.skills,a.skill_profiles||[],a.presentation||null]);
  const seen=new Set(current.actors.map(content)),out=[];
  for(const scenario of scenarios){
    for(const actor of parseStory(scenario.document).actors){
      const fingerprint=content(actor);if(seen.has(fingerprint))continue;seen.add(fingerprint);
      out.push({key:`${scenario.id}:${actor.actor_id}`,source:scenario.document.title,actor:structuredClone(actor)});
    }
  }return out;
}
export function importActor(template,actor_id=crypto.randomUUID()){
  const actor=structuredClone(template.actor);actor.actor_id=actor_id;return actor;
}
export function copyBattle(battle,battle_id=crypto.randomUUID()){
  if(battle_id===battle.battle_id)throw new Error('복사본에는 새 전투 ID가 필요해.');
  const copy=structuredClone(battle);copy.battle_id=battle_id;copy.name=(copy.name+' 복사').slice(0,100);
  return copy;
}
export function createScenario(source,scenario_id=crypto.randomUUID()){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(scenario_id)||scenario_id==='main')throw new Error('시나리오 ID를 확인해줘.');
  const document=emptyStory();document.title='새 시나리오';
  // Character templates are reusable; battle IDs and rewards start separately.
  document.actors=structuredClone(source.actors);document.catalog_dataset_id=source.catalog_dataset_id;
  return {id:scenario_id,document,version:0};
}
export function readLibrary(value){
  if(!value)return {active:'main',entries:[{id:'main',title:'나의 스토리',version:null}]};
  if(value.schema!==1||!Array.isArray(value.entries)||value.entries.length>40)throw new Error('시나리오 목록을 확인해줘.');
  const seen=new Set(),entries=value.entries.map(e=>{
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(e.id)||seen.has(e.id)||typeof e.title!=='string'||e.title.length>200||!(e.version===null||Number.isSafeInteger(e.version)&&e.version>=0))throw new Error('시나리오 목록을 확인해줘.');
    seen.add(e.id);return {id:e.id,title:e.title,version:e.version};
  });
  if(!seen.has('main'))entries.unshift({id:'main',title:'나의 스토리',version:null});
  if(entries.length>40)throw new Error('시나리오 목록을 확인해줘.');
  return {active:seen.has(value.active)?value.active:'main',entries};
}
export function namedRecipeRows(decks,rows){
  const names=new Map();
  for(const row of rows||[]){const saved=row.packet?.deck;if(typeof saved?.name==='string'&&saved.name.trim()&&saved.name.length<=80)names.set(row.filename,saved);}
  for(const deck of decks){const saved=names.get(deck.source_recipe?.filename);if(saved?.ruleset===deck.ruleset)deck.name=saved.name;}
  return decks;
}
export function parseRemoteScenarios(rows){
  if(!Array.isArray(rows)||rows.length>20)throw new Error('온라인 시나리오 목록을 확인해줘.');
  const seen=new Set();return rows.map(row=>{
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(row.id)||seen.has(row.id)||!Number.isSafeInteger(row.version)||row.version<1)throw new Error('온라인 시나리오 목록을 확인해줘.');
    seen.add(row.id);return {...row,document:parseStory(row.document)};
  });
}
