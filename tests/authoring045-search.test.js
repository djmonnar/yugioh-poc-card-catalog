import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoringPanels039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const BLUE='푸른 눈의 백룡',RED='붉은 눈의 흑룡',FLAME='푸른 화염의 검사',TRAP='함정 속으로';
const all=[BLUE,RED,FLAME,TRAP];
function mounted(t,section='decks'){
  const state=fixture041();state.bootstrap.capabilities.deck_compositions044=true;
  // Four real public cards make each search result unambiguous, independently
  // of unrelated catalog additions, page order, or a second search algorithm.
  state.bootstrap.catalog.cards=state.bootstrap.catalog.cards.filter(card=>[0,81,297,1002].includes(card.source_id));
  const deck=state.entities.find(row=>row.entity_type==='deck');deck.content.main=[];deck.content.extra=[];
  state.entities=state.entities.filter(row=>row.entity_type!=='deck'||row===deck);
  const document=new Document041(),root=document.createElement('main');document.body.append(root);const changes=[];
  const panels=createAuthoringPanels039({document,onChange:(...args)=>changes.push(args),onError:error=>{throw error;}});
  panels.render(section,root,state);t.after(()=>panels.destroy());
  return {document,root,state,panels,changes,search:field041(root,'카드 검색'),section};
}
function expectCards(m,expected){
  const results=m.root.querySelector('.au-catalog-results');
  const names=results.querySelectorAll('.au-card-tile').map(tile=>tile.querySelector('strong').textContent);
  assert.deepEqual(names.sort(),[...expected].sort());
  assert.match(results.querySelector('[role="status"]').textContent,new RegExp(`^${expected.length}종`));
}
function enter(m,value,{event='input',isComposing=false,caret=value.length}={}){
  m.search.value=value;m.search.setSelectionRange(caret,caret);m.search.fire(event,{isComposing});
}
function expectEditing(m,value,caret=value.length){
  assert.equal(field041(m.root,'카드 검색'),m.search,'Search results must not replace the IME input.');
  assert.equal(m.document.activeElement,m.search);assert.equal(m.search.value,value);
  if(caret!==null){assert.equal(m.search.selectionStart,caret);assert.equal(m.search.selectionEnd,caret);}
  assert.equal(m.changes.length,0,'Searching is local browsing, not a DB edit.');
}

for(const section of ['cards','decks'])test(`${section}: Korean search narrows immediately before compositionend and retains its caret`,t=>{
  const m=mounted(t,section);expectCards(m,all);m.search.focus();m.search.fire('compositionstart');
  for(const [query,expected] of [['푸',[BLUE,FLAME]],['푸른',[BLUE,FLAME]],['푸른 눈',[BLUE]]]){
    enter(m,query,{isComposing:true});expectCards(m,expected);expectEditing(m,query);
  }
  // A caret move within the live composition must survive result refresh too.
  enter(m,'푸른 눈',{isComposing:true,caret:1});expectCards(m,[BLUE]);expectEditing(m,'푸른 눈',1);
});

test('compositionend commits its final search value and composing backspace expands results immediately',t=>{
  const m=mounted(t);m.search.focus();m.search.fire('compositionstart');
  enter(m,'푸른 눈',{isComposing:true});expectCards(m,[BLUE]);
  enter(m,'붉은 눈의 흑룡',{event:'compositionend'});expectCards(m,[RED]);expectEditing(m,RED);
  m.search.fire('compositionstart');enter(m,'푸른 눈',{isComposing:true});expectCards(m,[BLUE]);
  enter(m,'푸',{isComposing:true});expectCards(m,[BLUE,FLAME]);expectEditing(m,'푸');
  enter(m,'',{isComposing:true});expectCards(m,all);expectEditing(m,'');
});

test('search clear returns focus and keeps the selected rarity filter during Korean composition',t=>{
  const m=mounted(t),rarity=field041(m.root,'등급');rarity.value='SR';rarity.fire('change');
  expectCards(m,[RED,FLAME,TRAP]);m.search.focus();m.search.fire('compositionstart');
  enter(m,'붉은',{isComposing:true});expectCards(m,[RED]);
  const clear=button041(m.root,'검색 지우기');assert.equal(clear.hidden,false);clear.click();
  // The DOM fixture does not clamp selection when a click handler clears value.
  expectCards(m,[RED,FLAME,TRAP]);expectEditing(m,'',null);assert.equal(rarity.value,'SR');
  assert.equal(field041(m.root,'등급'),rarity,'Clearing a query must preserve the filter controls.');
});

test('native search clear and change fallback events refresh the same search input',t=>{
  const m=mounted(t,'cards');m.search.focus();enter(m,'푸른 눈');expectCards(m,[BLUE]);
  enter(m,'',{event:'search'});expectCards(m,all);expectEditing(m,'');
  enter(m,'붉은',{event:'change'});expectCards(m,[RED]);expectEditing(m,'붉은');
});

test('a deferred catalog refresh cannot leave later composing input results stale',t=>{
  const m=mounted(t);m.search.focus();m.search.fire('compositionstart');enter(m,'푸',{isComposing:true});
  assert.equal(m.panels.render(m.section,m.root,structuredClone(m.state)),false);
  expectCards(m,[BLUE,FLAME]);expectEditing(m,'푸');
  enter(m,'푸른 눈',{isComposing:true});expectCards(m,[BLUE]);expectEditing(m,'푸른 눈');
  enter(m,'붉은',{event:'compositionend'});expectCards(m,[RED]);expectEditing(m,'붉은');
});
