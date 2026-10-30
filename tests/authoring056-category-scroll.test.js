import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const clone=structuredClone,pause=()=>new Promise(resolve=>setTimeout(resolve,20));
function mounted(t,{onChange}={}){
  const state=fixture041(),document=new Document041(),main=document.createElement('main'),root=document.createElement('div'),errors=[],writes=[];
  state.user={id:'scroll-editor056'};state.entities.push({entity_type:'category',entity_id:'지원-공용',version:1,content:{name:'지원-공용',archived:false},state:'saved',issues:[]});
  document.scrollingElement=document.body;document.body.scrollTop=0;document.body.scrollLeft=0;main.scrollTop=0;main.scrollLeft=0;document.body.append(main);main.append(root);
  const panels=createAuthoringPanels039({document,onChange:(...args)=>{writes.push(clone(args));return onChange?.(...args,{state,document,main,root,panels});},onError:error=>errors.push(error)});
  const replace=root.replaceChildren.bind(root);root.replaceChildren=(...nodes)=>{replace(...nodes);document.scrollingElement.scrollTop=0;main.scrollTop=0;};
  panels.render('cards',root,state);t.after(()=>panels.destroy());
  const management=()=>[...root.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent==='카테고리 관리');
  return {state,document,main,root,panels,errors,writes,management};
}
function openManagement(m){const box=m.management();box.open=true;box.fire('toggle');return box;}
function typeNew(m,value){const input=field041(m.root,'새 카테고리 이름');input.focus();input.value=value;input.fire('input');return input;}

test('category create keeps the expanded editor, button focus and page position through optimistic render and ACK',async t=>{
  let complete;
  const m=mounted(t,{onChange:(type,id,fields,options,{state,panels,root})=>{
    assert.deepEqual([type,id,fields,options],['category','테스트 새 분류',{name:'테스트 새 분류'},{operation:'create'}]);
    state.entities.push({entity_type:type,entity_id:id,version:0,content:{...fields,archived:false},pending:true,state:'draft',issues:[]});
    panels.render('cards',root,state);
    return new Promise(resolve=>{complete=()=>{const row=state.entities.at(-1);row.version=2;row.pending=false;panels.render('cards',root,state);resolve({applied_revision:2});};});
  }});
  openManagement(m);typeNew(m,'테스트 새 분류');m.document.body.scrollTop=6200;m.main.scrollTop=330;
  button041(m.root,'카테고리 추가').click();
  assert.equal(m.document.body.scrollTop,6200);assert.equal(m.main.scrollTop,330);assert.equal(m.management().open,true);
  assert.equal(m.document.activeElement,button041(m.root,'카테고리 추가'));assert.equal(field041(m.root,'새 카테고리 이름').value,'테스트 새 분류');
  complete();await pause();assert.equal(m.management().open,true);assert.equal(m.document.body.scrollTop,6200);assert.equal(m.main.scrollTop,330);
  assert.equal(field041(m.root,'새 카테고리 이름').value,'');assert.equal(m.writes.length,1);
});

test('an unrelated refresh during Korean category-name composition keeps the input node, newest scroll and draft',async t=>{
  const m=mounted(t);openManagement(m);const input=typeNew(m,'새 분');input.fire('compositionstart');input.value='새 분류';input.fire('input',{isComposing:true});
  m.document.body.scrollTop=5100;m.panels.render('cards',m.root,m.state);assert.equal(field041(m.root,'새 카테고리 이름'),input);
  assert.equal(m.document.activeElement,input);assert.equal(m.writes.length,0);
  m.document.body.scrollTop=5700;input.fire('compositionend');input.blur();await pause();
  assert.equal(m.management().open,true);assert.equal(field041(m.root,'새 카테고리 이름').value,'새 분류');assert.equal(m.document.body.scrollTop,5700);
});

test('a failed create preserves the typed name and open management, while known categories cannot be queued twice',async t=>{
  const m=mounted(t,{onChange:()=>Promise.reject(Error('연결 실패'))});openManagement(m);typeNew(m,'이어 쓸 분류');
  m.document.body.scrollTop=4000;button041(m.root,'카테고리 추가').click();await pause();m.panels.render('cards',m.root,m.state);
  assert.equal(m.errors[0].message,'연결 실패');assert.equal(m.management().open,true);assert.equal(field041(m.root,'새 카테고리 이름').value,'이어 쓸 분류');assert.equal(m.document.body.scrollTop,4000);
  typeNew(m,'지원-공용');button041(m.root,'카테고리 추가').click();await pause();assert.equal(m.writes.length,1);assert.match(m.errors.at(-1).message,/같은 이름/);
});

test('card category toggles keep the current modal and document scroll when their metadata is redrawn',async t=>{
  const m=mounted(t,{onChange:(type,id,fields,_options,{state,panels,root})=>{
    state.entities.push({entity_type:type,entity_id:id,version:2,content:fields,state:'saved',issues:[]});panels.render('cards',root,state);return {applied_revision:2};
  }});
  m.panels.openCard(normalizeCatalog039(m.state).find(card=>card.source_id===0));
  const dialog=m.document.body.querySelector('.au-card-detail');assert.ok(dialog);dialog.scrollTop=1400;dialog.scrollLeft=0;m.document.body.scrollTop=4100;
  const replace=dialog.replaceChildren.bind(dialog);dialog.replaceChildren=(...nodes)=>{replace(...nodes);dialog.scrollTop=0;};
  const checkbox=field041(dialog,'지원-공용');assert.ok(checkbox);checkbox.checked=true;checkbox.fire('change');await pause();
  assert.equal(dialog.scrollTop,1400);assert.equal(m.document.body.scrollTop,4100);assert.equal(field041(dialog,'지원-공용').checked,true);
});

test('navigation can move to a new section while account changes discard unfinished category names',t=>{
  const m=mounted(t);openManagement(m);typeNew(m,'첫 계정 분류');m.document.body.scrollTop=3000;
  m.panels.render('decks',m.root,m.state,{force:true});assert.equal(m.document.body.scrollTop,0,'New-section layout is not restored to the old catalog position.');
  m.state.user={id:'another-editor056'};m.panels.render('cards',m.root,m.state,{force:true});
  assert.equal(m.management().open,false);assert.equal(field041(m.root,'새 카테고리 이름').value,'');
});

test('transport-only render updates keep an expanded editor and current position without changing the category rows',t=>{
  const m=mounted(t);openManagement(m);typeNew(m,'보존할 초안');button041(m.root,'카테고리 추가').focus();
  m.document.body.scrollTop=7000;m.main.scrollTop=120;const entities=JSON.stringify(m.state.entities);
  for(const phase of ['pending','error','invalid','conflict','ready']){
    m.state.phase=phase;m.state.error=phase==='ready'?null:'전송 상태 변경';m.state.writeState={entityType:'category',entityId:'보존할 초안',phase};
    m.panels.render('cards',m.root,m.state,{force:true});
    assert.equal(m.document.body.scrollTop,7000);assert.equal(m.main.scrollTop,120);assert.equal(m.management().open,true);assert.equal(field041(m.root,'새 카테고리 이름').value,'보존할 초안');
  }
  assert.equal(JSON.stringify(m.state.entities),entities);assert.equal(m.writes.length,0);
});
