import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateMap} from '../roguelite-map.js';
import {emptyStory,newBattle} from '../story-core.js';
import {LIBRARY_KEY,scenarioKey} from '../story-library.js';
import {CHARACTER_KEY} from '../character-library.js';
import {buildEncounterPool,browserEncounterPool,cleanEncounterPool,assignEncounters,cleanEncounters,recommendedEncounterKinds} from '../roguelite-encounters.js';

const shipped=JSON.parse(readFileSync(new URL('../data/roguelite-opponents.json',import.meta.url),'utf8'));
const {cards}=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url),'utf8'));
const clone=value=>structuredClone(value);
const prepared=()=>cleanEncounterPool(shipped.pool);
function authored(){
  const deck=clone(shipped.pool[0].deck),document=emptyStory();document.title='직접 만든 상대';document.catalog_dataset_id='test-dataset';
  document.actors=[{actor_id:'actor',name:'편집된 캐릭터',portrait:'assets/actors/shared-rex.png',skills:[{kind:'lp_bonus',value:500}],
    skill_profiles:[{profile_id:'opening',name:'시작 특성',skills:[{kind:'opening_draw',value:1}]}]}];
  document.battles=[{...newBattle('battle'),name:'선택한 캐릭터의 덱',actor_id:'actor',recipe:deck.source_recipe.filename,skill_profile:'opening'}];
  return {scenarios:[{id:'authored',version:9,document}],decks:[deck],cards};
}

test('bundled opponent snapshots contain actual authored character/deck links and all three tiers',()=>{
  const pool=prepared();assert.equal(pool.length,40);
  assert.equal(new Set(pool.map(p=>p.source.character_id)).size,13);
  assert.deepEqual(['battle','elite','boss'].map(k=>pool.filter(p=>p.allowed_kinds.includes(k)).length),[36,4,2]);
  for(const entry of pool){assert.equal(entry.recipe,entry.deck.source_recipe.filename);assert.equal(entry.deck_name,entry.deck.name);assert.equal(entry.source.scenario_version,2808);}
  assert.ok(pool.some(e=>e.opponent_name==='메이 쿠자쿠'));
  assert.ok(pool.some(e=>e.opponent_name==='밴디트키스'));
});

test('authored selected skill preset and shared actor are copied without changing inputs',()=>{
  const input=authored();input.scenarios[0].document.actors[0].character_id='shared';
  input.scenarios[0].document.actors[0].use_shared_skills=true;
  input.characters=[{id:'shared',version:3,profile:{name:'공용 상대',portrait:'assets/actors/shared-mai.png',skills:[],
    skill_profiles:[{profile_id:'opening',name:'시작 특성',skills:[{kind:'lp_bonus',value:1500}]}]}}];
  const before=clone(input),result=buildEncounterPool(input);
  assert.deepEqual(input,before);assert.deepEqual(result.issues,[]);assert.equal(result.pool.length,1);
  assert.equal(result.pool[0].opponent_name,'공용 상대');assert.equal(result.pool[0].source.scenario_version,9);
  assert.deepEqual(result.pool[0].skills,[{kind:'lp_bonus',value:1500}]);
  input.characters[0].profile.name='나중에 바꾼 이름';input.decks[0].groups.main[0].count=1;
  assert.equal(result.pool[0].opponent_name,'공용 상대');assert.deepEqual(result.pool[0].deck,before.decks[0]);
});

test('missing actor or recipe is explicit and raid/classic battles are not silently converted',()=>{
  const input=authored(),doc=input.scenarios[0].document;
  doc.battles.push({...clone(doc.battles[0]),battle_id:'wrong-actor',actor_id:'missing'});
  doc.battles.push({...clone(doc.battles[0]),battle_id:'wrong-recipe',recipe:'DLR_999.ydc'});
  doc.battles.push({...clone(doc.battles[0]),battle_id:'raid',raid:{max_hp:20000,milestones:[]}});
  doc.battles.push({...clone(doc.battles[0]),battle_id:'classic',ruleset:'classic',recipe:'cpu_000.ydc'});
  const result=buildEncounterPool(input);assert.equal(result.pool.length,1);assert.equal(result.issues.length,2);
  assert.deepEqual(result.issues.map(e=>e.battle_id),['wrong-actor','wrong-recipe']);
  input.decks[0].groups.main=[];assert.equal(buildEncounterPool(input).pool.length,0);
});

test('seed assigns a complete immutable opponent plan, independent of pool ordering',()=>{
  const pool=prepared(),map=generateMap('opponents-138'),before=clone(pool);
  const first=assignEncounters(map,pool);
  assert.deepEqual(first,assignEncounters(map,[...pool].reverse()));
  assert.deepEqual(pool,before);assert.deepEqual(first,cleanEncounters(JSON.parse(JSON.stringify(first)),map));
  assert.equal(Object.keys(first).length,map.nodes.filter(n=>['battle','elite','boss'].includes(n.kind)).length);
  for(const [id,entry] of Object.entries(first))assert.equal(entry.kind,map.nodes.find(n=>n.id===id).kind);
  assert.throws(()=>assignEncounters(map,pool,{seed:'another'}),/시드/);
  const different=assignEncounters(generateMap('opponents-139'),pool);
  assert.notDeepEqual(Object.values(first).map(e=>e.template_id),Object.values(different).map(e=>e.template_id));
  pool[0].deck.name='changed';assert.deepEqual(first,cleanEncounters(first,map));
});

test('same-floor choices prefer different authored characters when alternatives exist',()=>{
  const map=generateMap('opponent-variety'),assignments=assignEncounters(map,prepared());
  const choices=map.nodes.filter(n=>n.floor===1).map(n=>assignments[n.id]);
  assert.equal(new Set(choices.map(e=>e.source.character_id)).size,choices.length);
});

test('creator tier selections are respected without rewriting any authored deck',()=>{
  const map=generateMap('tier-selection'),pool=prepared().slice(0,3);
  pool[0].allowed_kinds=['battle'];pool[1].allowed_kinds=['elite'];pool[2].allowed_kinds=['boss'];
  const assignments=assignEncounters(map,pool);
  for(const entry of Object.values(assignments)){
    const source=pool.find(e=>e.allowed_kinds.includes(entry.kind));
    assert.equal(entry.template_id,source.template_id);assert.deepEqual(entry.deck,source.deck);
  }
  pool[1].allowed_kinds=[];assert.throws(()=>assignEncounters(map,pool),/엘리트/);
  assert.deepEqual(recommendedEncounterKinds(4),['elite']);assert.deepEqual(recommendedEncounterKinds(5),['elite','boss']);
});

test('saved opponent plans reject missing, extra, mismatched, unsafe or corrupt snapshots',()=>{
  const map=generateMap('encounter-validation'),fresh=()=>assignEncounters(map,prepared());
  const missing=fresh();delete missing[Object.keys(missing)[0]];assert.throws(()=>cleanEncounters(missing,map),/전투마다/);
  const extra=fresh();extra.invalid=clone(Object.values(extra)[0]);assert.throws(()=>cleanEncounters(extra,map));
  const mismatch=fresh();Object.values(mismatch)[0].kind='boss';assert.throws(()=>cleanEncounters(mismatch,map),/종류/);
  const unsafe=fresh();Object.values(unsafe)[0].portrait='javascript:alert(1)';assert.throws(()=>cleanEncounters(unsafe,map),/초상화/);
  const changed=fresh();Object.values(changed)[0].deck_name='unrelated';assert.throws(()=>cleanEncounters(changed,map),/표시 정보/);
  const corrupt=fresh();Object.values(corrupt)[0].deck.groups.main=[];assert.throws(()=>cleanEncounters(corrupt,map),/완성된/);
  assert.deepEqual(cleanEncounters({},null),{});assert.deepEqual(cleanEncounters({},map),{});
  assert.throws(()=>cleanEncounters(fresh(),null),/지도/);
});

test('legacy ten-floor assignments preserve the old map and interpret midboss as elite',()=>{
  const map=generateMap('tower-136',{floors:10}),before=clone(map),result=assignEncounters(map,prepared());
  assert.equal(result['f05-l1'].kind,'elite');assert.equal(result['f10-l1'].kind,'boss');
  assert.deepEqual(map,before);assert.deepEqual(cleanEncounters(result,map),result);
});

test('browser source only reads existing drafts and never writes or invents missing scenarios',()=>{
  const input=authored(),rows=new Map([[LIBRARY_KEY,JSON.stringify({schema:1,active:'authored',entries:[{id:'authored',title:'상대',version:9}]})],
    [scenarioKey('authored'),JSON.stringify(input.scenarios[0].document)],[CHARACTER_KEY,'[]']]);
  const storage={getItem:key=>rows.get(key)??null,setItem:()=>assert.fail('writing a user draft is forbidden')};
  const result=browserEncounterPool(storage,input.decks,cards);assert.equal(result.pool.length,1);assert.deepEqual(result.issues,[]);
  rows.delete(scenarioKey('authored'));assert.deepEqual(browserEncounterPool(storage,input.decks,cards),{pool:[],issues:[]});
  rows.set(LIBRARY_KEY,'not-json');assert.throws(()=>browserEncounterPool(storage,input.decks,cards));
});
