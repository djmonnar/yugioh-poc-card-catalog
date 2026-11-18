import test from 'node:test';
import assert from 'node:assert/strict';
import {deckDeletionBlocks153,deckDeletionChanges153,openDeckDeletion153} from '../authoring153-deck-delete.js';
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
