import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoringPanels039,publicEntities039,compositionMode044,deckCompositionKey044,normalizeCatalog039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const clone=structuredClone;
function fixture044(){
  const state=fixture041();state.bootstrap.capabilities.deck_compositions044=true;
  const source=state.entities.find(row=>row.entity_type==='deck'&&row.content.main.reduce((n,r)=>n+r.count,0)===20),deck=clone(source);deck.entity_id='shared-deck';deck.content={...deck.content,name:'공유 덱',deck_name:'공유 덱',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};
  const encounter={...clone(source.content),name:'카이바',deck_name:'푸른 눈 상대',lp_bonus:500,banlist_enabled:false,shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};delete encounter.main;delete encounter.extra;
  const role={entity_type:'chapter_role',entity_id:'1:battle',version:1,state:'saved',issues:[],content:{chapter:1,role:'battle',lp_bonus:0,entries:[{entry_id:'enc-first',deck_id:deck.entity_id,weight:1,encounter:clone(encounter)},{entry_id:'enc-second',deck_id:deck.entity_id,weight:3,encounter:{...clone(encounter),lp_bonus:2000}}]}};
  const starter={entity_type:'starter_list',entity_id:'main',version:1,state:'saved',issues:[],content:{entries:[{starter_id:'lineage-original',name:'시작 덱',deck_id:deck.entity_id}]}};
  state.entities=state.entities.filter(row=>!['deck','chapter_role','starter_list'].includes(row.entity_type));state.entities.push(deck,role,starter);
  return {state,deck,role,starter};
}
function mount(state){const doc=new Document041(),root=doc.createElement('main');doc.body.append(root);const changes=[],errors=[],navigations=[];const panels=createAuthoringPanels039({document:doc,onChange:(...args)=>{changes.push(args);return Promise.resolve();},onError:e=>errors.push(e.message),onNavigate:(...args)=>navigations.push(args)});return {doc,root,panels,changes,errors,navigations,state};}
function input(node,value){node.value=String(value);node.fire('input');}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('shared deck editor has only card settings and synchronizes its neutral name',async()=>{
  const {state}=fixture044(),ui=mount(state);ui.panels.render('decks',ui.root,state);
  assert.equal(compositionMode044(state),true);
  for(const label of ['상대 이름','덱의 추가 LP','상대 추가 LP','연출 캐릭터','시작 패 추가 장수','공용 특성 연결'])assert.equal(field041(ui.root,label),undefined,label);
  assert.equal(button041(ui.root,'덱 복사'),undefined);
  input(field041(ui.root,'덱 이름'),'새 공유 덱');await flush();
  assert.deepEqual(ui.changes[0].slice(0,3),['deck','shared-deck',{deck_name:'새 공유 덱',name:'새 공유 덱'}]);
});

test('each encounter edits LP independently even when two entries share one deck',async()=>{
  const {state,role}=fixture044(),ui=mount(state);ui.panels.render('chapters',ui.root,state);
  const rows=ui.root.querySelectorAll('.au-encounter-row');assert.equal(rows.length,2);
  assert.equal(rows[0].dataset.deckId,rows[1].dataset.deckId);
  input(field041(rows[0],'상대 추가 LP'),1500);await flush();
  const [type,id,fields]=ui.changes[0];assert.equal(type,'chapter_role');assert.equal(id,'1:battle');
  assert.equal(fields.entries[0].encounter.lp_bonus,1500);assert.equal(fields.entries[1].encounter.lp_bonus,2000);
  assert.deepEqual(fields.entries[0].encounter.skills,role.content.entries[0].encounter.skills);
  assert.equal(ui.changes.some(row=>row[0]==='deck'),false);
});

test('weight and removal target encounter IDs rather than every use of a shared deck',async()=>{
  const {state}=fixture044(),ui=mount(state);ui.panels.render('chapters',ui.root,state);
  const rows=ui.root.querySelectorAll('.au-encounter-row');input(field041(rows[1],'가중치'),9);await flush();
  assert.deepEqual(ui.changes[0][2].entries.map(entry=>entry.weight),[1,9]);
  button041(rows[0],'후보에서 제외').click();await flush();
  assert.deepEqual(ui.changes[1][2].entries.map(entry=>entry.entry_id),['enc-second']);
});

test('inline skill changes stay on one encounter and keep the other opponent untouched',async()=>{
  const {state,role}=fixture044(),skill=value=>({kind:'heal_once',value,threshold:0,sourceId:-1,position:0,entries:[]});role.content.entries[0].encounter.skills=[skill(1000)];role.content.entries[1].encounter.skills=[skill(1500)];
  const ui=mount(state);ui.panels.render('chapters',ui.root,state);const rows=ui.root.querySelectorAll('.au-encounter-row');input(field041(rows[0],'LP 수치'),700);await flush();
  const [type,id,fields]=ui.changes[0];assert.equal(type,'chapter_role');assert.equal(id,'1:battle');assert.equal(fields.entries[0].encounter.skills[0].value,700);assert.equal(fields.entries[1].encounter.skills[0].value,1500);assert.equal(ui.changes.some(row=>row[0]==='deck'),false);
});

test('another opponent gets a new encounter ID and reuses the existing deck and effects',async()=>{
  const {state}=fixture044(),ui=mount(state);ui.panels.render('chapters',ui.root,state);
  button041(ui.root.querySelectorAll('.au-encounter-row')[0],'같은 덱으로 상대 추가').click();await flush();
  const [type,,fields]=ui.changes[0],entry=fields.entries.at(-1);assert.equal(type,'chapter_role');assert.equal(entry.deck_id,'shared-deck');assert.match(entry.entry_id,/^enc-/);
  assert.equal(new Set(fields.entries.map(row=>row.entry_id)).size,3);assert.deepEqual(entry.encounter,fields.entries[0].encounter);
  assert.equal(ui.changes.some(row=>row[0]==='deck'),false);
});

test('public authoring graph preserves shared IDs without reconstructing runtime copies',()=>{
  const {state,deck,role,starter}=fixture044(),payload=state.bootstrap.game;
  const guest={canEdit:false,gamePayload:payload,bootstrap:{authoring044:{schema:1,decks:[deck],chapter_roles:[role],starter_list:starter}}};
  const rows=publicEntities039(guest);assert.equal(compositionMode044(guest),true);
  assert.equal(rows.filter(row=>row.entity_type==='deck').length,1);
  assert.equal(rows.find(row=>row.entity_type==='starter_list').content.entries[0].deck_id,'shared-deck');
  assert.deepEqual(rows.find(row=>row.entity_type==='chapter_role').content.entries.map(entry=>entry.entry_id),['enc-first','enc-second']);
});

test('restriction labels appear on catalog cards, owned cards and card details',()=>{
  const {state,deck}=fixture044(),id=deck.content.main[0].source_id;
  const original=state.bootstrap.catalog.cards.find(card=>card.source_id===id);original.normal_limit=1;original.speed_limit=2;
  const limit=state.entities.find(row=>row.entity_type==='card_limit'&&row.entity_id===String(id));if(limit)limit.content={...limit.content,normal_limit:1,speed_limit:2};
  const card=normalizeCatalog039(state).find(row=>row.source_id===id),ui=mount(state);ui.panels.render('decks',ui.root,state);
  const owned=ui.root.querySelector('.au-deck-owned');assert.ok(owned.textContent.includes('스피드 제한 2'));assert.ok(owned.textContent.includes('제한'));
  const search=field041(ui.root,'카드 검색');input(search,String(card.code));
  const tile=ui.root.querySelectorAll('.au-card-tile').find(row=>row.textContent.includes(card.name_ko));assert.ok(tile?.textContent.includes('스피드 제한 2'));
  ui.panels.openCard(card);const dialog=ui.doc.querySelector('dialog');assert.ok(dialog.textContent.includes('스피드 제한 2'));assert.ok(dialog.textContent.includes('제한'));
});

test('same compositions compare card identities and counts while ignoring encounter metadata',()=>{
  const {deck}=fixture044(),other=clone(deck.content);other.lp_bonus=8000;other.skills=[{kind:'draw_once'}];other.main.reverse();
  assert.equal(deckCompositionKey044(deck.content),deckCompositionKey044(other));other.main[0].count++;
  assert.notEqual(deckCompositionKey044(deck.content),deckCompositionKey044(other));
});

test('recreating an existing full composition is stopped before a deck write',async()=>{
  const {state,deck}=fixture044(),draft=clone(deck);draft.entity_id='other-deck';draft.content.deck_name='편집 중인 덱';const removed=draft.content.main[0];removed.count--;const source=removed.source_id;if(!removed.count)draft.content.main.shift();state.entities.push(draft);
  const ui=mount(state);ui.panels.selectDeck(draft.entity_id);ui.panels.render('decks',ui.root,state);
  const card=normalizeCatalog039(state).find(row=>row.source_id===source);ui.panels.openCard(card);button041(ui.doc.querySelector('dialog'),'「편집 중인 덱」에 추가').click();await flush();
  assert.equal(ui.changes.length,0);assert.ok(ui.errors.some(message=>message.includes('같은 카드 구성')));
});
