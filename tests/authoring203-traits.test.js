import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAIT_KINDS184} from '../authoring184-traits.js';
import {TRAIT_KINDS196} from '../authoring196-traits.js';
import {TRAIT_KINDS197} from '../authoring197-traits.js';
import {TRAIT_KINDS199, STARTER_KINDS199, CHARACTER_KINDS199, traitKindOffered199} from '../authoring199-traits.js';
import {TRAIT_KINDS203, TRAIT_KIND_IDS203, STARTER_KINDS203, CHARACTER_KINDS203, TRAIT_LABELS203, traitKindOffered203} from '../authoring203-traits.js';
import {traitLabel203, traitValues203} from '../authoring203-trait-summary.js';
import {createAuthoringPanels039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {Document041, fixture041, field041, button041} from './authoring041-test-dom.js';

// (203) 대표님 2026-11-25: 특성 LP배리어(lp_barrier)·하이랜더(highlander). 출처 UnityExpeditionWork/Traits203/traits203-contract.json.
// DB 경로 203 마이그레이션(websync203)이 두 정의를 capabilities.trait_form.kinds 끝에 더한다(compiled, shared, starter, 칸 없음).
// 덱·장별 상대는 typed 모양, 캐릭터 공용 특성·시작 덱은 {kind} 모양이다. 시작 덱 선택지는 제작소가 STARTER_KINDS203으로 정한다.
const CHAR='traits203-character';
const typed=kind=>({kind,value:0,threshold:0,sourceId:-1,position:0,entries:[]});
const sharedTrue=rows=>rows.map(row=>({...structuredClone(row),shared:true}));
function withTraits203(state){state.bootstrap.capabilities.trait_form.kinds.push(...sharedTrue(TRAIT_KINDS184),...sharedTrue(TRAIT_KINDS196),...structuredClone(TRAIT_KINDS197),
  ...structuredClone(TRAIT_KINDS199),...structuredClone(TRAIT_KINDS203));return state;}
function character(state,skills=[],skill_profiles=[]){
  state.entities.push({entity_type:'character',entity_id:CHAR,version:3,state:'saved',issues:[],content:{name:'특성 확인 캐릭터',portrait:'',skills,skill_profiles}});
}
function mounted(t,state,section,id){
  const document=new Document041(),root=document.createElement('main'),writes=[],errors=[];document.body.append(root);
  const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(structuredClone(args)),onError:error=>errors.push(error)});
  panels.selectEntity065(section,id);if(section==='decks')panels.selectDeck(id);panels.render(section,root,state);t.after(()=>panels.destroy());
  if(section==='characters')for(const selector of ['.au-character-traits','.au-character-trait-profile'])for(const disclosure of root.querySelectorAll(selector)){disclosure.open=true;disclosure.fire('toggle',{bubbles:false});}
  return {root,writes,errors,panels};
}
const open=disclosure=>{disclosure.open=true;disclosure.fire('toggle',{bubbles:false});};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const addSelects=root=>root.querySelectorAll('select').filter(node=>node.getAttribute('aria-label')==='추가할 특성');
const optionKinds=select=>select.options.map(option=>option.value);
const addButtonFor=select=>select.parentNode.querySelectorAll('button').find(node=>node.textContent==='특성 추가');

test('203 module: two parameter-free kinds after the 199 lists, with the contract labels and help',()=>{
  assert.deepEqual([...TRAIT_KIND_IDS203],['lp_barrier','highlander']);
  assert.deepEqual(TRAIT_KINDS203.map(row=>row.label),['LP배리어','하이랜더']);
  assert.deepEqual(TRAIT_KINDS203.map(row=>row.help),['전투당 1번, 내 메인 페이즈에 켜면 그 턴이 끝날 때까지 내가 지불하는 LP 비용이 모두 0이 됩니다.',
    '듀얼을 시작할 때 이 전투 덱(메인·엑스트라 덱)에 같은 이름의 카드가 없으면 시작 패가 1장 늘고, 듀얼 동안 내 몬스터의 공격력·수비력이 100 올라갑니다.']);
  for(const row of TRAIT_KINDS203){
    assert.deepEqual(Object.keys(row),['kind','label','help','fields','compiled','shared','starter'],row.kind);
    assert.deepEqual([row.fields,row.compiled,row.shared,row.starter],[{},true,true,true],row.kind);
    assert.deepEqual([traitKindOffered203(row,false),traitKindOffered203(row,true),traitKindOffered203(row,true,true)],[true,true,true],row.kind);
    // 199 목록에는 없다: 203 전의 시작 덱 편집기는 이 종류를 고르지 않았다.
    assert.equal(traitKindOffered199(row,true,true),false,row.kind);
  }
  assert.deepEqual([...STARTER_KINDS203],[...STARTER_KINDS199,'lp_barrier','highlander']);
  assert.deepEqual([...CHARACTER_KINDS203],[...CHARACTER_KINDS199,'lp_barrier','highlander']);
  assert.deepEqual({...TRAIT_LABELS203},{lp_barrier:'LP배리어',highlander:'하이랜더'});
  // 이전 종류는 199 판정과 같다(덱·장별 상대, 캐릭터 공용, 시작 덱).
  for(const row of [...TRAIT_KINDS184,...TRAIT_KINDS196,...TRAIT_KINDS197,...TRAIT_KINDS199])
    for(const args of [[false],[true],[true,true]])assert.equal(traitKindOffered203(row,...args),traitKindOffered199(row,...args),row.kind+' '+args);
});

test('203 trait summary: name from the DB definition, the fallback name without one, no values',()=>{
  for(const kind of TRAIT_KIND_IDS203){
    assert.equal(traitLabel203(typed(kind),TRAIT_KINDS203),TRAIT_LABELS203[kind]);
    assert.equal(traitLabel203({kind},[]),TRAIT_LABELS203[kind],'fallback '+kind);
    assert.deepEqual(traitValues203(typed(kind),{definitions:TRAIT_KINDS203}),[]);
  }
});

test('203 deck editor offers both kinds and writes the typed rows',async t=>{
  const state=withTraits203(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[];
  let ui=mounted(t,state,'decks',deck.entity_id),select=addSelects(ui.root)[0];
  for(const kind of TRAIT_KIND_IDS203)assert(optionKinds(select).includes(kind),kind);
  select.value='lp_barrier';select.fire('change');button041(ui.root,'특성 추가').click();await tick();
  let [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual([type,id,fields],['deck',deck.entity_id,{skills:[typed('lp_barrier')]}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  deck.content.skills=[typed('lp_barrier')];ui.panels.render('decks',ui.root,state);
  select=addSelects(ui.root)[0];
  assert(!optionKinds(select).includes('lp_barrier')&&optionKinds(select).includes('highlander'),'a kind is offered once');
  select.value='highlander';select.fire('change');button041(ui.root,'특성 추가').click();await tick();
  [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual(fields,{skills:[typed('lp_barrier'),typed('highlander')]});
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(ui.errors,[]);
});

test('203 starter editor offers the 199 starter kinds and the two 203 kinds and writes {kind}',async t=>{
  const state=withTraits203(fixture041());state.bootstrap.capabilities.starter_loadout={lp_max:1000000,gold_max:1000000,relics_max:70};
  const starters=state.entities.find(row=>row.entity_type==='starter_list'),first=starters.content.entries[0];
  const ui=mounted(t,state,'starters',starters.entity_id),config=()=>ui.root.querySelector('.au-starter-loadout');
  open(config());
  let select=field041(config(),'추가할 특성');
  assert.deepEqual(optionKinds(select),[...STARTER_KINDS203]);
  select.value='highlander';select.fire('change');button041(config(),'특성 추가').click();await tick();
  let [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual(fields.entries.find(row=>row.starter_id===first.starter_id).start_loadout.traits,[{kind:'highlander'}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  first.start_loadout={lp:4000,gold:0,relic_ids:[],traits:[{kind:'highlander'}]};
  ui.panels.render('starters',ui.root,state);open(config());
  select=field041(config(),'추가할 특성');select.value='lp_barrier';select.fire('change');button041(config(),'특성 추가').click();await tick();
  [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual(fields.entries.find(row=>row.starter_id===first.starter_id).start_loadout.traits,[{kind:'highlander'},{kind:'lp_barrier'}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(ui.errors,[]);
});

test('203 starter check refuses the 203 kinds when the database list does not offer them (before the 203 migration)',()=>{
  const state=fixture041();state.bootstrap.capabilities.trait_form.kinds.push(...sharedTrue(TRAIT_KINDS184),...sharedTrue(TRAIT_KINDS196),...structuredClone(TRAIT_KINDS197),...structuredClone(TRAIT_KINDS199));
  state.bootstrap.capabilities.starter_loadout={lp_max:1000000,gold_max:1000000,relics_max:70};
  const starters=state.entities.find(row=>row.entity_type==='starter_list'),first=starters.content.entries[0];
  const entries=starters.content.entries.map(row=>row.starter_id===first.starter_id?{...row,start_loadout:{lp:4000,gold:0,relic_ids:[],traits:[{kind:'lp_barrier'}]}}:row);
  assert.throws(()=>validateAuthoringChange066(state,'starter_list',starters.entity_id,{entries}));
});

test('203 character shared traits offer both kinds and write {kind}',async t=>{
  const state=withTraits203(fixture041());character(state,[{kind:'destiny_draw'}],[{profile_id:'p203',name:'묶음',skills:[]}]);
  const ui=mounted(t,state,'characters',CHAR),selects=addSelects(ui.root);
  assert.equal(selects.length,2);
  for(const select of selects)for(const kind of TRAIT_KIND_IDS203)assert(optionKinds(select).includes(kind),kind);
  selects[0].value='lp_barrier';selects[0].fire('change');addButtonFor(selects[0]).click();await tick();
  let [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual([type,id],['character',CHAR]);
  assert.deepEqual(fields.skills,[{kind:'destiny_draw'},{kind:'lp_barrier'}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  selects[1].value='highlander';selects[1].fire('change');addButtonFor(selects[1]).click();await tick();
  [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual(fields.skill_profiles,[{profile_id:'p203',name:'묶음',skills:[{kind:'highlander'}]}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(ui.errors,[]);
});
