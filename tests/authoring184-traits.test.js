import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT_PROFILE184,TRAIT_KINDS184,TRAIT_KIND_IDS184,NECROFEAR_CODE184,traitKindOffered184,traitHelp184,ouijaWithoutNecrofear184} from '../authoring184-traits.js';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

// (184) Opponent traits 184 in the studio: the database adds four parameter-free definitions to
// capabilities.trait_form.kinds (shared:false, with Korean help). Decks and chapter encounters offer them;
// character shared traits and starter-deck traits do not (the database rejects them there).
const CHAR='traits184-character';
const typed=kind=>({kind,value:0,threshold:0,sourceId:-1,position:0,entries:[]});
function withTraits184(state){state.bootstrap.capabilities.trait_form.kinds.push(...structuredClone(TRAIT_KINDS184));return state;}
function character(state,skills=[],skill_profiles=[]){
  state.entities.push({entity_type:'character',entity_id:CHAR,version:3,state:'saved',issues:[],content:{name:'특성 확인 캐릭터',portrait:'',skills,skill_profiles}});
}
function mounted(t,state,section,id){
  const document=new Document041(),root=document.createElement('main'),writes=[],errors=[];document.body.append(root);
  const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(structuredClone(args)),onError:error=>errors.push(error)});
  panels.selectEntity065(section,id);if(section==='decks')panels.selectDeck(id);panels.render(section,root,state);t.after(()=>panels.destroy());
  if(section==='characters')for(const selector of ['.au-character-traits','.au-character-trait-profile'])for(const disclosure of root.querySelectorAll(selector)){disclosure.open=true;disclosure.fire('toggle',{bubbles:false});}
  return {root,writes,errors};
}
const addSelects=root=>root.querySelectorAll('select').filter(node=>node.getAttribute('aria-label')==='추가할 특성');
const optionKinds=select=>select.options.map(option=>option.value);

test('184 module: four parameter-free direct traits with Korean labels, help and the route marker',()=>{
  assert.deepEqual(CONTENT_PROFILE184,{schema:1,trait_set:'damage-ouija184'});
  assert.deepEqual(TRAIT_KIND_IDS184,['effect_damage_null','reflect_damage_null','first_damage_null','ouija_board']);
  assert.deepEqual(TRAIT_KINDS184.map(row=>row.label),['효과 데미지 무효','반사 데미지 무효','첫 데미지 무효','위저보드 (다크 네크로피어)']);
  for(const row of TRAIT_KINDS184){
    assert.deepEqual(Object.keys(row),['kind','label','fields','compiled','shared','help']);
    assert.deepEqual([row.fields,row.compiled,row.shared],[{},true,false]);
    assert.match(row.help,/[가-힣]/);assert(row.help.length>=20&&row.help.length<=240,row.kind);
  }
  const ouija=TRAIT_KINDS184.find(row=>row.kind==='ouija_board').help;
  for(const word of ['다크 네크로피어','스탠바이 페이즈','F·I·N·A·L','다섯 번째','승리','멈추'])assert(ouija.includes(word),word);
  assert.equal(NECROFEAR_CODE184,31829185);
});

test('184 offers: shared editors skip shared:false kinds, direct editors keep compiled kinds; old kinds are unchanged',()=>{
  const kinds=withTraits184(fixture041()).bootstrap.capabilities.trait_form.kinds;
  const before=kinds.filter(kind=>!TRAIT_KIND_IDS184.includes(kind.kind));
  // Same result as the old filter (shared||compiled) for every definition the database had before 184.
  for(const shared of [false,true])assert.deepEqual(before.filter(kind=>traitKindOffered184(kind,shared)),before.filter(kind=>shared||kind.compiled));
  assert.deepEqual(kinds.filter(kind=>traitKindOffered184(kind,false)).map(kind=>kind.kind).slice(-4),TRAIT_KIND_IDS184);
  assert(!kinds.filter(kind=>traitKindOffered184(kind,true)).some(kind=>TRAIT_KIND_IDS184.includes(kind.kind)));
  assert.equal(traitKindOffered184(null,false),false);
  assert.equal(traitHelp184({kind:'ouija_board'}),TRAIT_KINDS184[3].help,'built-in help when the database row has none');
  assert.equal(traitHelp184({kind:'ouija_board',help:'DB 도움말'}),'DB 도움말');
  assert.equal(traitHelp184({kind:'heal_once'}),'');
});

test('184 validation: decks accept the four typed kinds once the database offers them; characters never do',()=>{
  const state=withTraits184(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:TRAIT_KIND_IDS184.map(typed)}));
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[...TRAIT_KIND_IDS184.map(typed),{...typed('heal_once'),value:600}]}));
  assert.throws(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typed('ouija_board'),typed('ouija_board')]}));
  const older=fixture041(),olderDeck=older.entities.find(e=>e.entity_type==='deck');
  assert.throws(()=>validateAuthoringChange066(older,'deck',olderDeck.entity_id,{skills:[typed('ouija_board')]}),/현재 지원하지 않는 특성/,'before the migration the database list has no 184 kind');
  character(state);
  assert.throws(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[{kind:'ouija_board'}],skill_profiles:[]}),/현재 지원하지 않는 특성/);
  assert.throws(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[],skill_profiles:[{profile_id:'p184',name:'묶음',skills:[{kind:'first_damage_null'}]}]}),/현재 지원하지 않는 특성/);
});

test('184 deck editor: the add list shows the four kinds with help, and adding one writes the typed default',async t=>{
  const state=withTraits184(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[];
  const before=JSON.stringify(state),ui=mounted(t,state,'decks',deck.entity_id),selects=addSelects(ui.root);
  assert.equal(selects.length,1);const select=selects[0];
  assert.deepEqual(optionKinds(select).slice(-4),TRAIT_KIND_IDS184);
  assert.deepEqual(select.options.map(option=>option.textContent).slice(-4),TRAIT_KINDS184.map(row=>row.label));
  select.value='ouija_board';select.fire('change');
  const help=ui.root.querySelectorAll('p').filter(node=>node.className.includes('au-trait-help184'));
  assert(help.some(node=>!node.hidden&&node.textContent===TRAIT_KINDS184[3].help),'help of the selected kind');
  button041(ui.root,'특성 추가').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.writes.length,1);const [type,id,fields]=ui.writes[0];
  assert.equal(type,'deck');assert.equal(id,deck.entity_id);assert.deepEqual(fields,{skills:[typed('ouija_board')]});
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.equal(JSON.stringify(state),before);assert.deepEqual(ui.errors,[]);
});

test('184 deck editor: a saved 184 trait shows its label and help, and the Ouija board warns without Dark Necrofear',t=>{
  const state=withTraits184(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[typed('effect_damage_null'),typed('ouija_board')];
  const ui=mounted(t,state,'decks',deck.entity_id);
  const legends=ui.root.querySelectorAll('legend').map(node=>node.textContent);
  assert(legends.includes('효과 데미지 무효')&&legends.includes('위저보드 (다크 네크로피어)'));
  const help=ui.root.querySelectorAll('p').filter(node=>node.className.includes('au-trait-help184')).map(node=>node.textContent);
  assert(help.includes(TRAIT_KINDS184[0].help)&&help.includes(TRAIT_KINDS184[3].help));
  const cards=normalizeCatalog039(state),necrofear=cards.find(card=>card.code===NECROFEAR_CODE184);
  assert.equal(ouijaWithoutNecrofear184(deck.content.skills,cards,deck.content.main),!(deck.content.main??[]).some(row=>row.source_id===necrofear?.source_id));
  if(ouijaWithoutNecrofear184(deck.content.skills,cards,deck.content.main))assert(ui.root.querySelectorAll('p').some(node=>node.className.includes('au-ouija-warning184')));
  assert.equal(ouijaWithoutNecrofear184([typed('effect_damage_null')],cards,[]),false);
  if(necrofear)assert.equal(ouijaWithoutNecrofear184([typed('ouija_board')],cards,[{source_id:necrofear.source_id,count:1}]),false);
});

test('184 character shared traits do not offer the four kinds',t=>{
  const state=withTraits184(fixture041());character(state,[{kind:'heal_once',value:800}],[{profile_id:'p184',name:'묶음',skills:[]}]);
  const ui=mounted(t,state,'characters',CHAR),selects=addSelects(ui.root);
  assert(selects.length>=1,'character trait add lists');
  for(const select of selects)assert(!optionKinds(select).some(kind=>TRAIT_KIND_IDS184.includes(kind)),'shared list offers a 184 kind');
  assert.deepEqual(ui.errors,[]);
});

// Production edits opponent traits per chapter encounter (deck_compositions044): the encounter editor offers the four kinds too.
function encounterFixture184(){
  const state=withTraits184(fixture041());state.bootstrap.capabilities.deck_compositions044=true;
  const source=state.entities.find(row=>row.entity_type==='deck'&&row.content.main.reduce((n,r)=>n+r.count,0)===20),deck=structuredClone(source);
  deck.entity_id='shared-deck';deck.content={...deck.content,name:'공유 덱',deck_name:'공유 덱',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};
  const encounter={...structuredClone(source.content),name:'다크 네크로피어 상대',deck_name:'위저보드 상대',lp_bonus:0,banlist_enabled:false,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};delete encounter.main;delete encounter.extra;
  const role={entity_type:'chapter_role',entity_id:'1:battle',version:1,state:'saved',issues:[],content:{chapter:1,role:'battle',lp_bonus:0,entries:[{entry_id:'enc-ouija',deck_id:deck.entity_id,weight:1,encounter},{entry_id:'enc-other',deck_id:deck.entity_id,weight:1,encounter:structuredClone(encounter)}]}};
  const starter={entity_type:'starter_list',entity_id:'main',version:1,state:'saved',issues:[],content:{entries:[{starter_id:'lineage-original',name:'시작 덱',deck_id:deck.entity_id}]}};
  state.entities=state.entities.filter(row=>!['deck','chapter_role','starter_list'].includes(row.entity_type));state.entities.push(deck,role,starter);
  return {state,role};
}

test('184 chapter encounter editor offers the four kinds and writes the typed trait on that encounter only',async t=>{
  const {state}=encounterFixture184(),doc=new Document041(),root=doc.createElement('main'),changes=[],errors=[];doc.body.append(root);
  const panels=createAuthoringPanels039({document:doc,onChange:(...args)=>{changes.push(structuredClone(args));return Promise.resolve();},onError:e=>errors.push(e.message),onNavigate:()=>{}});t.after(()=>panels.destroy());
  panels.render('chapters',root,state);root.querySelectorAll('.au-entry-pick066')[0].click();
  const editor=root.querySelector('.au-encounter-editor066');assert(editor,'encounter editor');
  const selects=addSelects(editor);assert(selects.length>=1);
  for(const select of selects)assert.deepEqual(optionKinds(select).filter(kind=>TRAIT_KIND_IDS184.includes(kind)),TRAIT_KIND_IDS184);
  const select=selects.at(-1);select.value='first_damage_null';select.fire('change');
  assert(editor.querySelectorAll('p').some(node=>node.className.includes('au-trait-help184')&&!node.hidden&&node.textContent===TRAIT_KINDS184[2].help));
  const add=editor.querySelectorAll('button').filter(node=>node.textContent==='특성 추가').at(-1);add.click();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(changes.length,1);const [type,id,fields]=changes[0];
  assert.equal(type,'chapter_role');assert.equal(id,'1:battle');
  assert.deepEqual(fields.entries[0].encounter.skills,[typed('first_damage_null')]);
  assert.deepEqual(fields.entries[1].encounter.skills,[]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(errors,[]);
});

test('184 chapter encounter with a saved 위저보드 notes a deck without Dark Necrofear',t=>{
  const {state,role}=encounterFixture184();role.content.entries[0].encounter.skills=[typed('ouija_board')];
  const doc=new Document041(),root=doc.createElement('main');doc.body.append(root);
  const panels=createAuthoringPanels039({document:doc,onChange:()=>Promise.resolve(),onError:()=>{},onNavigate:()=>{}});t.after(()=>panels.destroy());
  panels.render('chapters',root,state);root.querySelectorAll('.au-entry-pick066')[0].click();
  const editor=root.querySelector('.au-encounter-editor066'),cards=normalizeCatalog039(state),deck=state.entities.find(row=>row.entity_type==='deck');
  const expected=ouijaWithoutNecrofear184(role.content.entries[0].encounter.skills,cards,deck.content.main);
  assert.equal(editor.querySelectorAll('p').some(node=>node.className.includes('au-ouija-warning184')),expected);
  assert(editor.querySelectorAll('legend').some(node=>node.textContent==='위저보드 (다크 네크로피어)'));
});
