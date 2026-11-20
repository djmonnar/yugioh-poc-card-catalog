import test from 'node:test';
import assert from 'node:assert/strict';
import {deckDeletionBlocks153,deckDeletionChanges153,deckDeletionPlan174,deckDeletionSteps174,openDeckDeletion153} from '../authoring153-deck-delete.js';
import {Document041,button041,field041,fixture041} from './authoring041-test-dom.js';
import {createAuthoringPanels039} from '../authoring039-panels.js';

const deck=(id,title,version=1)=>({entity_type:'deck',entity_id:id,version,content:{name:title,deck_name:title}});
const option=(id,title,version=1)=>({id,title,version,search:title});
const assignment=(type,entries)=>({entity_type:type,content:{chapter:2,role:'boss',entries}});

test('only unaffected canonical versions may be deleted, even if a local placement draft removes a live reference',()=>{
  const rows=[deck('one','하나'),deck('two','둘'),deck('three','셋'),deck('four','넷'),assignment('chapter_role',[{deck_id:'two'}]),
    assignment('starter_list',[{deck_id:'three'}]),assignment('starter_list',[])];
  const drafts=[{type:'deck',id:'four'}],blocks=deckDeletionBlocks153(rows,drafts);
  assert.deepEqual([...blocks.get('two')],['2장 보스']);
  assert.deepEqual([...blocks.get('three')],['시작 덱']);
  assert.deepEqual([...blocks.get('four')],['저장 전 변경 있음']);
  assert.deepEqual(deckDeletionChanges153([option('one','하나')],rows,drafts),[
    {type:'deck',id:'one',operation:'delete',fields:{},baseVersion:1}
  ]);
  for(const chosen of [option('two','둘'),option('three','셋'),option('four','넷')])
    assert.throws(()=>deckDeletionChanges153([option('one','하나'),chosen],rows,drafts),/삭제할 수 없습니다/);
  assert.throws(()=>deckDeletionChanges153([option('one','하나',0)],rows,drafts),/바뀌었습니다/);
});

test('checkbox search preserves selections and deletion requires explicit confirmation',()=>{
  const doc=new Document041();
  const el=(tag,value,cls)=>{const node=doc.createElement(tag);if(value!=null)node.textContent=value;if(cls)node.className=cls;return node;};
  const button=(label,action)=>{const node=el('button',label);node.onclick=action;return node;};
  const rows=[option('a','알파'),option('b','베타'),option('c','참조')],writes=[];
  const dialog=openDeckDeletion153({document:doc,el,button,rows,getBlocks:()=>new Map([['c',new Set(['시작 덱'])]]),onDelete:chosen=>writes.push(chosen)});
  assert.equal(dialog.open,true);
  assert.equal(dialog.querySelectorAll('.au-deck-delete-row153').at(-1).querySelector('input').disabled,true);
  const search=field041(dialog,'삭제할 덱 검색');
  search.value='알 파';search.fire('input');
  const first=dialog.querySelectorAll('.au-deck-delete-row153')[0].querySelector('input');
  first.checked=true;first.fire('change');
  search.value='베타';search.fire('input');
  button041(dialog,'검색 결과 선택').click();
  button041(dialog,'선택 확인').click();
  assert.equal(writes.length,0);
  assert.match(dialog.textContent,/알파베타/);
  assert.equal(search.hidden,true);
  button041(dialog,'이전으로').click();
  assert.equal(dialog.querySelectorAll('input:checked').length,1);
  button041(dialog,'선택 확인').click();
  button041(dialog,'2개 삭제').click();
  assert.deepEqual(writes[0].map(row=>row.id),['a','b']);
  assert.equal(dialog.open,false);
});

test('Deck Builder exposes deletion beside the normal deck controls',()=>{
  const doc=new Document041(),root=doc.createElement('main'),state=fixture041(),writes=[];
  state.user={id:'editor'};
  doc.body.append(root);
  const panels=createAuthoringPanels039({document:doc,onChange:()=>{},onDeleteDecks153:rows=>writes.push(rows)});
  panels.render('decks',root,state);
  const entry=button041(root,'덱 삭제');
  assert.equal(entry.closest('.au-toolbar').contains(button041(root,'새 덱')),true);
  entry.click();
  assert.equal(doc.querySelector('.au-deck-delete153').open,true);
  panels.render('decks',root,{...state,canEdit:false,user:null});
  assert.equal(doc.querySelector('.au-deck-delete153'),null);
  assert.equal(button041(root,'덱 삭제').disabled,true);
  assert.equal(writes.length,0);
});

// (174) 대표님 제보 2026-11-20: 편성에 들어 있거나 저장 전 변경이 있는 덱도 창에서 바로 지울 수 있어야 한다.
const pool=(id,role,entries,version=3)=>({entity_type:'chapter_role',entity_id:id,version,content:{chapter:1,role,entries}});
test('a deck used by an opponent pool or with an unsaved draft can be deleted: pool patch first, draft cancelled',()=>{
  const rows=[deck('loid1','로이드 초급'),deck('loid2','로이드 중급'),deck('solo','혼자'),deck('starter','시작'),
    pool('1:battle','battle',[{deck_id:'loid1',weight:1},{deck_id:'other',weight:2},{deck_id:'loid1',weight:1}]),
    pool('1:boss','boss',[{deck_id:'solo'}]),
    {entity_type:'starter_list',entity_id:'main',version:1,content:{entries:[{deck_id:'starter'}]}}];
  const drafts=[{type:'deck',id:'loid2'}],plans=deckDeletionPlan174(rows,drafts);
  assert.deepEqual([...plans.get('loid1').fix],['1장 일반 전투 편성에서 빠져요']);
  assert.equal(plans.get('loid1').hard.size,0);
  assert.deepEqual([...plans.get('loid2').fix],['저장 전 변경은 취소돼요']);
  assert.match([...plans.get('solo').hard][0],/유일한 상대/);
  assert.match([...plans.get('starter').hard][0],/시작 덱 목록/);
  const steps=deckDeletionSteps174([option('loid1','로이드 초급'),option('loid2','로이드 중급')],rows,drafts);
  assert.deepEqual(steps.draftKeys,[{type:'deck',id:'loid2'}]);
  assert.equal(steps.poolPatches.length,1);
  assert.deepEqual(steps.poolPatches[0].fields,{entries:[{deck_id:'other',weight:2}]});
  assert.equal(steps.poolPatches[0].baseVersion,3);
  assert.throws(()=>deckDeletionSteps174([option('solo','혼자')],rows,drafts),/유일한 상대/);
  assert.throws(()=>deckDeletionSteps174([option('starter','시작')],rows,drafts),/시작 덱 목록/);
  // 두 덱을 함께 지우면 편성이 비는 경우
  const both=[deck('a','A'),deck('b','B'),pool('2:elite','elite',[{deck_id:'a'},{deck_id:'b'}])];
  assert.throws(()=>deckDeletionSteps174([option('a','A'),option('b','B')],both,[]),/모두 빠지게/);
  // 편성에 저장 전 변경이 있으면 그 편성의 덱은 막는다
  assert.match([...deckDeletionPlan174(rows,[{type:'chapter_role',id:'1:battle'}]).get('loid1').hard][0],/저장 전 변경/);
});

test('fixable decks are checkable and the review says the pool goes first',()=>{
  const doc=new Document041();
  const el=(tag,value,cls)=>{const node=doc.createElement(tag);if(value!=null)node.textContent=value;if(cls)node.className=cls;return node;};
  const button=(label,action)=>{const node=el('button',label);node.onclick=action;return node;};
  const rows=[option('loid1','로이드 초급'),option('solo','혼자')],writes=[];
  const plan=new Map([['loid1',{hard:new Set(),fix:new Set(['1장 일반 전투 편성에서 빠져요'])}],['solo',{hard:new Set(['1장 보스의 유일한 상대예요']),fix:new Set()}]]);
  const dialog=openDeckDeletion153({document:doc,el,button,rows,getBlocks:()=>plan,onDelete:chosen=>writes.push(chosen)});
  const [first,second]=dialog.querySelectorAll('.au-deck-delete-row153').map(row=>row.querySelector('input'));
  assert.equal(first.disabled,false);
  assert.equal(second.disabled,true);
  assert.match(dialog.textContent,/삭제하면 · 1장 일반 전투 편성에서 빠져요/);
  assert.match(dialog.textContent,/삭제할 수 없음 · 1장 보스의 유일한 상대예요/);
  first.checked=true;first.fire('change');
  button041(dialog,'선택 확인').click();
  assert.match(dialog.textContent,/편성에서 먼저 빼고 삭제합니다/);
  button041(dialog,'1개 삭제').click();
  assert.deepEqual(writes[0].map(row=>row.id),['loid1']);
});

test('Deck Builder removes the deck from its pools, waits for that save, then deletes it',async()=>{
  const doc=new Document041(),root=doc.createElement('main'),state=fixture041(),writes=[];
  state.user={id:'editor'};doc.body.append(root);
  const decks=state.entities.filter(row=>row.entity_type==='deck');
  const starterIds=new Set(state.entities.filter(row=>row.entity_type==='starter_list').flatMap(row=>row.content.entries.map(entry=>entry.deck_id)));
  const target=decks.find((row,index)=>index>=3&&index<12&&!starterIds.has(row.entity_id));
  assert.ok(target,'fixture has a deck used only by battle pools');
  const onDeleteDecks153=changes=>{
    writes.push(changes.map(change=>`${change.operation}:${change.type}:${change.id}`));
    for(const change of changes)if(change.operation==='patch'){const row=state.entities.find(r=>r.entity_type===change.type&&r.entity_id===change.id);row.content={...row.content,...change.fields};row.version++;}
    return Promise.resolve({ok:true});
  };
  const panels=createAuthoringPanels039({document:doc,onChange:()=>{},onDeleteDecks153});
  panels.render('decks',root,state);
  button041(root,'덱 삭제').click();
  const dialog=doc.querySelector('.au-deck-delete153'),search=field041(dialog,'삭제할 덱 검색');
  const label=dialog.querySelectorAll('.au-deck-delete-row153').find(row=>row.textContent.includes('일반 전투 편성에서 빠져요'));
  assert.ok(label,'a pooled deck is offered with what happens to its pools');
  const check=label.querySelector('input');assert.equal(check.disabled,false);
  check.checked=true;check.fire('change');
  button041(dialog,'선택 확인').click();
  button041(dialog,'1개 삭제').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(writes.length,2);
  assert.ok(writes[0].every(entry=>entry.startsWith('patch:chapter_role:')));
  assert.equal(writes[1].length,1);
  assert.match(writes[1][0],/^delete:deck:/);
  void search;
});
