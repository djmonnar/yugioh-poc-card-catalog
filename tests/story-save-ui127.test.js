import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../story-core.js';
import * as libraryCore from '../story-library.js';
import * as characterCore from '../character-library.js';
import * as online from '../story-online-save.js';
import * as skillCore from '../story-skills.js';
import * as mediaCore from '../story-media.js';

class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.value='';this.textContent='';this.classList={toggle(){}};this.listeners={};this.isConnected=true;}
  append(...children){for(const c of children){if(c){c.parentNode=this;this.children.push(c);}}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  addEventListener(event,fn){this.listeners[event]=fn;}
  setAttribute(name,value){this[name]=value;}
  get firstChild(){return this.children[0];}get lastChild(){return this.children.at(-1);}
  get lastElementChild(){return this.lastChild;}
  querySelector(){return null;}focus(){}showModal(){}close(){}click(){}
}
function harness(source){
  const nodes=new Map(),storage=new Map(),document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:t=>new Element(t)},toolbar=new Element();toolbar.append(document.getElementById('export'));
  const context={...core,...libraryCore,...characterCore,...online,...skillCore,...mediaCore,console,structuredClone,crypto,WeakSet,WeakMap,Map,Set,Intl,JSON,URL,Blob,window:{addEventListener(){},scrollY:0,scrollTo(){}},document,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},requestAnimationFrame:fn=>fn(),createStatFilters:()=>({values:()=>[],reset(){}}),commonCloudError:e=>e.message,CHARACTER_TRANSFER_KEY:'transfer',setTimeout(){},confirm:()=>false};
  vm.createContext(context);
  const code=source.replace(/^import .*?;\r?\n/gm,'').replace(/^start\(\);\r?$/m,'')+`
globalThis.fixture={set(v){doc=v.doc;library=v.library;remoteScenarios=v.remoteScenarios;version=v.version;client=v.client;meta=v.meta;cards=v.cards;decks=v.decks;libraryReady=true;libraryAPI=true;editor=true;charactersReady=true;characters=v.characters||[];characterBases=v.characterBases||[];},state(){return {doc,library,remoteScenarios,version};},refresh(){renderSync();}};`;
  vm.runInContext(code,context);
  return {...context,nodes,storage,toolbar,save:toolbar.children.find(e=>e.textContent==='이 시나리오 온라인 저장').listeners.click};
}
const candidate=fs.readFileSync(new URL('../story.js',import.meta.url),'utf8');
// Exact legacy character helper and save callback, retained for the conflict regression.
// Source story.js SHA256: 9c0372bcca26710072d5dc8612989d2c256e2e305e5b821025f2bca7b634b496
const legacyCharacterSave=[
  "async function saveCharacterChanges(){",
  "  if(!charactersReady)await loadCharacters();",
  "  synchronizeCharacterCopies(doc,characterBases);",
  "  const updates=characterUpdates(doc,characterBases);if(!updates.length)return;",
  "  const reply=await client.rpc('poc_save_characters',{p_characters:updates});if(reply.error)throw reply.error;",
  "  characters=parseCharacters(reply.data);localStorage.setItem(CHARACTER_KEY,JSON.stringify(characters));",
  "  doc=resolveCharacters(doc,characters);",
  "  characterBases=characters.filter(c=>doc.actors.some(a=>a.character_id===c.id));",
  "}"
].join('\n');
const legacyScenarioSave=[
  "toolbar.append(button('이 시나리오 온라인 저장',async()=>{",
  "  try{",
  "    if(!client||!libraryReady)await cloudInit();if(!libraryReady)throw new Error('온라인 시나리오 연결을 확인해줘.');",
  "    if(!editor)throw new Error('카드 도감에서 이메일로 로그인한 뒤 이 페이지를 다시 열어줘.');",
  "    await saveCharacterChanges();",
  "    const value=canonicalStory(doc,meta,cards),issues=validateStory(value,cards,decks).issues;if(issues.length)throw new Error(issues.join(' '));",
  "    if(!libraryAPI)await fetchScenarios();",
  "    if(!libraryAPI&&library.active!=='main')throw new Error('새 시나리오 온라인 저장은 Supabase의 시나리오 추가 SQL 적용 후 사용할 수 있어. 편집본은 브라우저에 보관돼.');",
  "    const {data,error}=libraryAPI?await client.rpc('poc_save_scenario',{p_scenario_id:library.active,p_document:value,p_expected_version:version??0}):await client.rpc('poc_save_story',{p_document:value,p_expected_version:version??0});",
  "    if(error)throw error;version=data.version;entry().version=version;doc=value;",
  "    remoteScenarios=remoteScenarios.filter(s=>s.id!==library.active);remoteScenarios.push(data);persist();",
  "    status(`「${doc.title}」 온라인 저장 완료 · 다음 게임 실행 때 반영돼.`);",
  "  }catch(e){status(e.message?.includes('poc_')?cloudError(e):e.message);}"
].join('\n');
const saveMarker="toolbar.append(button('이 시나리오 온라인 저장',async()=>{";
const loadMarker="}),button('이 시나리오 온라인 불러오기',async()=>{";
const saveAt=candidate.indexOf(saveMarker),loadAt=candidate.indexOf(loadMarker,saveAt);
assert.ok(saveAt>=0&&loadAt>saveAt,'The actual UI save callback must remain identifiable');
const baseline=candidate.slice(0,saveAt)+legacyCharacterSave+'\n'+legacyScenarioSave+'\n'+candidate.slice(loadAt);
const shared={id:'mai',version:1,profile:{name:'메이',portrait:''}};
function story(count,title='메이'){const d=core.emptyStory();d.title=title;d.actors=[{actor_id:'actor',character_id:'mai',name:'내가 편집한 메이',portrait:'',skills:[]}];d.battles=Array.from({length:count},(_,i)=>({...core.newBattle('battle-'+i),name:'전투'+i,actor_id:'actor',recipe:'DLR_000.ydc'}));return d;}
function fixture(doc,client){return {doc,client,library:{active:'mai',entries:[{id:'mai',title:'메이',version:1},{id:'regular',title:'일반',version:4}]},remoteScenarios:[{id:'mai',version:1,document:story(2)}],version:1,meta:{dataset_id:'current'},cards:[],decks:[{name:'덱',ruleset:'duel_links_plan',source_recipe:{filename:'DLR_000.ydc'}}],characters:[shared],characterBases:[shared]};}

test('old actual UI save aborts the scenario RPC after a character conflict; new UI saves four battles independently',async()=>{
  for(const [source,old] of [[baseline,true],[candidate,false]]){
    const calls=[],h=harness(source),client={async rpc(name,args){calls.push(name);return name==='poc_save_characters'?{error:{message:'poc_conflict'}}:{data:{id:args.p_scenario_id,version:2,document:args.p_document}};}};
    h.fixture.set(fixture(story(4),client));await h.save();
    assert.deepEqual(calls,old?['poc_save_characters']:['poc_save_scenario']);assert.equal(h.fixture.state().doc.battles.length,4);
    assert.equal(h.fixture.state().version,old?1:2);
  }
});
test('switching to the seven-battle scenario during network save never replaces it with the four-battle response',async()=>{
  let reply;const h=harness(candidate),client={rpc(){return new Promise(resolve=>reply=resolve);}};
  const state=fixture(story(4),client);h.fixture.set(state);const running=h.save();
  const regular=story(7,'일반');state.library.active='regular';h.fixture.set({...state,doc:regular,version:4});
  reply({data:{id:'mai',version:2,document:story(4)}});await running;
  const result=h.fixture.state();assert.equal(result.doc.title,'일반');assert.equal(result.doc.battles.length,7);assert.equal(result.version,4);
  assert.equal(result.library.entries.find(e=>e.id==='mai').version,2);assert.equal(result.library.entries.find(e=>e.id==='regular').version,4);
});
test('edits during network save stay local and the persistent status reports the unreflected fifth battle',async()=>{
  let reply;const h=harness(candidate),client={rpc(){return new Promise(resolve=>reply=resolve);}},state=fixture(story(4),client);h.fixture.set(state);const running=h.save();
  state.doc.battles.push({...core.newBattle('fifth'),actor_id:'actor',recipe:'DLR_000.ydc'});reply({data:{id:'mai',version:2,document:story(4)}});await running;
  assert.equal(h.fixture.state().doc.battles.length,5);assert.equal(h.fixture.state().version,2);
  assert.match(h.nodes.get('sync-status').textContent,/5전투.*4전투.*미반영/);assert.equal(JSON.parse(h.storage.get(core.STORY_KEY+':mai')||'null')?.battles?.length??JSON.parse(h.storage.get(libraryCore.scenarioKey('mai'))).battles.length,5);
});

const conflict={message:'poc_conflict',code:'P0001'};
const onlineRow=(count=2,version=2)=>({id:'mai',version,document:story(count)});
const chooseDraft=h=>h.nodes.get('save-conflict-draft').onclick();

test('a zero-version browser draft can explicitly save four battles over the displayed online two without losing its draft',async()=>{
  const calls=[],h=harness(candidate),client={async rpc(name,args){calls.push({name,args:structuredClone(args)});if(name==='poc_load_scenarios')return {data:[onlineRow()]};if(name==='poc_save_scenario')return args.p_expected_version===0?{error:conflict}:{data:{id:'mai',version:3,document:args.p_document}};throw new Error(name);}};
  const state=fixture(story(4),client);state.version=0;state.library.entries[0].version=0;h.fixture.set(state);await h.save();
  assert.equal(h.fixture.state().doc.battles.length,4);assert.equal(h.fixture.state().version,0);assert.equal(h.nodes.get('scenario-conflict').hidden,false);
  assert.match(h.nodes.get('conflict-local-title').textContent,/4전투/);assert.match(h.nodes.get('conflict-online-title').textContent,/2전투/);
  assert.equal(h.nodes.get('conflict-local-battles').children.length,4);assert.equal(h.nodes.get('conflict-online-battles').children.length,2);
  assert.deepEqual(calls.map(c=>c.name),['poc_save_scenario','poc_load_scenarios']);
  await chooseDraft(h);
  assert.equal(calls.at(-1).args.p_expected_version,2);assert.equal(calls.at(-1).args.p_document.battles.length,4);assert.equal(h.fixture.state().version,3);
  assert.equal(h.nodes.get('scenario-conflict').hidden,true);assert.match(h.nodes.get('sync-status').textContent,/4전투.*4전투.*반영됨/);
  assert.equal(JSON.parse(h.storage.get(libraryCore.scenarioKey('mai'))).battles.length,4);
});

test('missing historical revision exposes the comparison instead of requiring export or replacing local four battles',async()=>{
  const calls=[],h=harness(candidate),client={async rpc(name,args){calls.push(name);if(name==='poc_save_scenario')return {error:conflict};if(name==='poc_load_scenarios')return {data:[onlineRow()]};if(name==='poc_load_scenario_revision')return {data:null};throw new Error(name);}};
  h.fixture.set(fixture(story(4),client));await h.save();
  assert.equal(calls.filter(n=>n==='poc_save_scenario').length,1);assert.equal(h.fixture.state().doc.battles.length,4);assert.equal(h.fixture.state().version,1);
  assert.equal(h.nodes.get('scenario-conflict').hidden,false);assert.doesNotMatch(h.nodes.get('status').textContent,/내보내기로/);
});

test('a second remote edit rejects the explicit CAS once, keeps the draft, and displays the new revision for another choice',async()=>{
  const calls=[],h=harness(candidate);let latest=onlineRow(),accept=false;
  const client={async rpc(name,args){calls.push({name,args:structuredClone(args)});if(name==='poc_load_scenarios')return {data:[latest]};if(name==='poc_save_scenario')return accept?{data:{id:'mai',version:4,document:args.p_document}}:{error:conflict};throw new Error(name);}};
  const state=fixture(story(4),client);state.version=0;h.fixture.set(state);await h.save();latest=onlineRow(3,3);await chooseDraft(h);
  assert.equal(calls.filter(c=>c.name==='poc_save_scenario').length,2);assert.equal(calls.filter(c=>c.name==='poc_save_scenario').at(-1).args.p_expected_version,2);
  assert.equal(h.fixture.state().version,0);assert.equal(h.fixture.state().doc.battles.length,4);assert.match(h.nodes.get('conflict-online-title').textContent,/3전투/);assert.match(h.nodes.get('status').textContent,/다시 바뀌었어/);
  accept=true;await chooseDraft(h);assert.equal(calls.at(-1).args.p_expected_version,3);assert.equal(h.fixture.state().version,4);
});

test('the explicit choice saves later local edits shown in the comparison and preserves still newer edits during the request',async()=>{
  let response;const calls=[],h=harness(candidate),client={async rpc(name,args){calls.push({name,args:structuredClone(args)});if(name==='poc_load_scenarios')return {data:[onlineRow()]};if(args.p_expected_version===0)return {error:conflict};return new Promise(resolve=>response=resolve);}};
  const state=fixture(story(4),client);state.version=0;h.fixture.set(state);await h.save();
  state.doc.battles.push({...core.newBattle('fifth'),name:'다섯째',actor_id:'actor',recipe:'DLR_000.ydc'});h.fixture.refresh();assert.match(h.nodes.get('conflict-local-title').textContent,/5전투/);
  const running=chooseDraft(h);await chooseDraft(h);assert.equal(calls.filter(c=>c.name==='poc_save_scenario').length,2);assert.equal(calls.at(-1).args.p_document.battles.length,5);
  state.doc.battles.push({...core.newBattle('sixth'),name:'여섯째',actor_id:'actor',recipe:'DLR_000.ydc'});response({data:{id:'mai',version:3,document:calls.at(-1).args.p_document}});await running;
  assert.equal(h.fixture.state().doc.battles.length,6);assert.match(h.nodes.get('sync-status').textContent,/6전투.*5전투.*미반영/);assert.equal(JSON.parse(h.storage.get(libraryCore.scenarioKey('mai'))).battles.length,6);
});

test('switching scenarios while loading the conflict comparison cannot offer to save the new scenario over Mai',async()=>{
  let response,entered;const loading=new Promise(resolve=>entered=resolve),calls=[],h=harness(candidate),client={async rpc(name,args){calls.push(name);if(name==='poc_save_scenario')return {error:conflict};return new Promise(resolve=>{response=resolve;entered();});}};
  const state=fixture(story(4),client);state.version=0;h.fixture.set(state);const running=h.save();await loading;
  state.library.active='regular';h.fixture.set({...state,doc:story(7,'일반'),version:4});response({data:[onlineRow()]});await running;
  assert.equal(h.nodes.get('scenario-conflict').hidden,true);await chooseDraft(h);assert.equal(calls.filter(n=>n==='poc_save_scenario').length,1);assert.equal(h.fixture.state().doc.battles.length,7);
});

test('switching scenarios during the explicit save keeps the selected seven-battle document and records Mai separately',async()=>{
  let response;const h=harness(candidate),client={async rpc(name,args){if(name==='poc_load_scenarios')return {data:[onlineRow()]};if(args.p_expected_version===0)return {error:conflict};return new Promise(resolve=>response=resolve);}};
  const state=fixture(story(4),client);state.version=0;h.fixture.set(state);await h.save();const running=chooseDraft(h);
  state.library.active='regular';h.fixture.set({...state,doc:story(7,'일반'),version:4});response({data:{id:'mai',version:3,document:story(4)}});await running;
  assert.equal(h.fixture.state().doc.battles.length,7);assert.equal(h.fixture.state().version,4);assert.equal(state.library.entries.find(e=>e.id==='mai').version,3);assert.equal(state.library.entries.find(e=>e.id==='regular').version,4);
});

test('continuing to edit dismisses the comparison without saving or loading the remote document',async()=>{
  const calls=[],h=harness(candidate),client={async rpc(name){calls.push(name);return name==='poc_save_scenario'?{error:conflict}:{data:[onlineRow()]};}};
  const state=fixture(story(4),client);state.version=0;h.fixture.set(state);await h.save();h.nodes.get('dismiss-scenario-conflict').onclick();
  assert.equal(h.nodes.get('scenario-conflict').hidden,true);assert.equal(h.fixture.state().doc.battles.length,4);assert.deepEqual(calls,['poc_save_scenario','poc_load_scenarios']);assert.match(h.nodes.get('status').textContent,/아직 완료되지/);
});
