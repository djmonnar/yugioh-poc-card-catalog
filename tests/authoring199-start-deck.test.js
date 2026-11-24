import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {STARTER_KINDS197, CHARACTER_KINDS197} from '../authoring197-traits.js';
import {START_DECK_DEFINITION199, TRAIT_KINDS199, TRAIT_KIND_IDS199, STARTER_KINDS199, CHARACTER_KINDS199, traitKindOffered199} from '../authoring199-traits.js';
import {normalizeBootstrap039, PROJECT039, IDENTITY039} from '../authoring039-store.js';
import {createAuthoringPanels039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {Document041, fixture041} from './authoring041-test-dom.js';

// (199) 대표님 2026-11-24: trait "시작 덱에 카드 추가" (start_deck) and category groups up to 512 members.
// The 199 migration appends START_DECK_DEFINITION199 to capabilities.trait_form.kinds (compiled, shared) and raises the
// database group limit (unified055_validate_group) to 512; the studio reads both from the bootstrap.
const clone=structuredClone;
const withDeck199=state=>{state.bootstrap.capabilities.trait_form.kinds.push(clone(START_DECK_DEFINITION199));return state;};
const typedDeck=(entries)=>({kind:'start_deck',value:0,threshold:0,sourceId:-1,position:0,entries});

test('199 trait lists add start_deck after the 197 lists',()=>{
  assert.deepEqual([...TRAIT_KIND_IDS199],['start_deck']);
  assert.deepEqual([...STARTER_KINDS199],[...STARTER_KINDS197,'start_deck']);
  assert.deepEqual([...CHARACTER_KINDS199],[...CHARACTER_KINDS197,'start_deck']);
  assert.equal(TRAIT_KINDS199[0],START_DECK_DEFINITION199);
  assert.deepEqual(START_DECK_DEFINITION199.fields.entries,{type:'counted-source-cards',filter:'playable-main',max_rows:12,min_rows:1,count_max:12,count_min:1,total_max:12,distinct_source:true},
    'the same entry list as 시작 묘지');
  assert.deepEqual([traitKindOffered199(START_DECK_DEFINITION199,false),traitKindOffered199(START_DECK_DEFINITION199,true),traitKindOffered199(START_DECK_DEFINITION199,true,true)],[true,true,true]);
  assert.equal(traitKindOffered199({kind:'union_power',compiled:true,shared:true},true,true),false,'starters still refuse union_power');
  assert.equal(traitKindOffered199(null,false),false);
});

test('199 validation: decks take start_deck once the database offers it (12-card total, at least one card)',()=>{
  const state=withDeck199(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');
  const card=state.bootstrap.game?.catalog?.find?.(c=>c.playable!==false)??null;
  const source=card?.source_id??deck.content.main?.[0];
  assert(Number.isSafeInteger(source),'a fixture card');
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typedDeck([{sourceId:source,count:3}])]}));
  assert.throws(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typedDeck([{sourceId:source,count:13}])]}),/시작 덱에 카드 추가는 중복 카드 없이 합계 1~12장/);
  assert.throws(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typedDeck([])]}),/시작 덱에 카드 추가는/);
  const before=fixture041(),beforeDeck=before.entities.find(e=>e.entity_type==='deck');
  assert.throws(()=>validateAuthoringChange066(before,'deck',beforeDeck.entity_id,{skills:[typedDeck([{sourceId:source,count:1}])]}),/현재 지원하지 않는 특성/,'before the migration the database list has no start_deck');
});

test('199 deck editor shows the saved start_deck with its own label and the 12-card total',t=>{
  const state=withDeck199(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');
  const source=deck.content.main?.[0];
  deck.content.skills=[typedDeck([{sourceId:source,count:2}])];
  const document=new Document041(),root=document.createElement('main'),errors=[];document.body.append(root);
  const panels=createAuthoringPanels039({document,onChange:()=>{},onError:error=>errors.push(error)});
  panels.selectEntity065('decks',deck.entity_id);panels.selectDeck(deck.entity_id);panels.render('decks',root,state);t.after(()=>panels.destroy());
  const legend=root.querySelectorAll('legend').find(node=>node.textContent==='시작 덱에 카드 추가');
  assert(legend,'legend');
  assert(legend.parentNode.querySelectorAll('p').some(node=>node.textContent==='시작 덱에 카드 추가 · 2/12장'),'the counted list uses the trait label');
  assert(!legend.parentNode.querySelectorAll('p').some(node=>node.textContent.startsWith('시작 묘지')),'not the 시작 묘지 label');
  assert.deepEqual(errors,[]);
});

// Store: a category group may hold up to 512 categories (the database check moves from 128 to 512 in the same migration).
const payload={catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}};
const payloadText=JSON.stringify(payload),hash=value=>createHash('sha256').update(value).digest('hex');
const groupRow=(categories)=>({entity_type:'category_group',entity_id:'category-group-support199',version:1,content:{name:'지원',categories,archived:false},state:'saved',issues:[]});
const wire=rows=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:1,unchanged:false,permissions:{can_edit:true},authoring:{entities:[]},
  category_groups055:{schema:1,groups:clone(rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:1,game_revision:1,metadata_revision:'1',identity:IDENTITY039,source_fingerprint:hash(payloadText),payload_json:payloadText}});

test('199 store accepts a category group of 512 members and refuses 513',async()=>{
  const names=n=>Array.from({length:n},(_,i)=>`지원-분류${i+1}`);
  for(const n of [129,300,512]){
    const normalized=await normalizeBootstrap039(wire([groupRow(names(n))]),webcrypto);
    assert.equal(normalized.authoring.entities[0].content.categories.length,n,String(n));
  }
  await assert.rejects(normalizeBootstrap039(wire([groupRow(names(513))]),webcrypto));
});
