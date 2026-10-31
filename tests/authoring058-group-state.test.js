import test from 'node:test';
import assert from 'node:assert/strict';
import {createCategoryGroupManager055} from '../authoring055-category-groups.js';
import {Document041,field041,button041} from './authoring041-test-dom.js';

const clone=structuredClone;
const A='지원-융합',B='발동-묘지',C='덱-푸른눈';
const ID='category-group-local-editor';
const row=(version=1,content={name:'내 묶음',categories:[A],archived:false})=>({entity_type:'category_group',entity_id:ID,version,content:clone(content),state:'saved',issues:[]});
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function mount(onSave,{onRetry}={}){
 const document=new Document041(),host=document.createElement('main'),calls=[],errors=[],state={owner:'editor-058',canEdit:true,canWrite:true,phase:'ready',groups:[row()],categories:[A,B,C].map(name=>({name,archived:false}))};document.body.append(host);
 const manager=createCategoryGroupManager055({document,getState:()=>clone(state),onRetry,onError:error=>errors.push(error),onSave:(...args)=>{calls.push(clone(args));if(onSave)return onSave(...args,state);const next=row(state.groups[0].version+1,args[2]);state.groups[0]=next;return Promise.resolve({category_groups055:{schema:1,groups:[clone(next)]}});}});
 const render=()=>manager.render(host);render();const select=field041(host,'편집할 카테고리 묶음');select.value=ID;select.fire('change');
 return {document,host,calls,errors,state,manager,render};
}
function choose(m,name,value){const box=field041(m.host,`묶음에 포함: ${name}`);assert.ok(box);assert.equal(box.disabled,false);box.checked=value;box.fire('change');return box;}
const members=m=>m.host.querySelectorAll('.au-member-order-row057').map(item=>item.dataset.orderCategory);

test('a version-only refresh does not falsely reject an unsaved group membership change',async()=>{
 const m=mount();choose(m,B,true);m.state.groups[0]=row(7);m.render();
 assert.equal(field041(m.host,`묶음에 포함: ${B}`).checked,true);button041(m.host,'변경 사항 저장').click();await flush();
 assert.equal(m.calls.length,1);assert.deepEqual(m.state.groups[0].content.categories,[A,B]);assert.doesNotMatch(m.host.textContent,/저장 기준과 최신 내용/);
});

test('a save ACK remains authoritative while the UI snapshot is one render behind it',async()=>{
 let acknowledged;
 const m=mount((_type,_id,fields)=>{acknowledged=row(9,fields);return Promise.resolve({schema:1,kind:'unified039-write-ack',category_groups055:{schema:1,groups:[clone(acknowledged)]}});});
 choose(m,B,true);button041(m.host,'변경 사항 저장').click();await flush();
 assert.equal(field041(m.host,`묶음에 포함: ${B}`).checked,true,'The stale version1 snapshot cannot undo the acknowledged checkbox.');
 assert.deepEqual(members(m),[A,B]);choose(m,C,true);m.state.groups[0]=clone(acknowledged);m.render();
 assert.equal(field041(m.host,`묶음에 포함: ${C}`).checked,true);button041(m.host,'변경 사항 저장').click();await flush();
 assert.equal(m.calls.length,2);assert.deepEqual(m.calls[1][2].categories,[A,B,C]);assert.doesNotMatch(m.host.textContent,/저장 기준과 최신 내용/);
});

test('genuine concurrent membership edits still preserve the local choices and require a reload',()=>{
 const m=mount();choose(m,B,true);m.state.groups[0]=row(8,{name:'내 묶음',categories:[C,A],archived:false});m.render();
 button041(m.host,'변경 사항 저장').click();assert.equal(m.calls.length,0);assert.equal(field041(m.host,`묶음에 포함: ${B}`).checked,true);assert.match(m.host.textContent,/저장 기준과 최신 내용/);
 button041(m.host,'최신 내용 불러오기').click();assert.equal(field041(m.host,`묶음에 포함: ${B}`).checked,false);assert.deepEqual(members(m),[C,A]);
});

test('genuine concurrent names cannot be silently overwritten by a membership save',()=>{
 const m=mount();choose(m,B,true);m.state.groups[0]=row(5,{name:'다른 곳에서 바꾼 이름',categories:[A],archived:false});m.render();button041(m.host,'변경 사항 저장').click();
 assert.equal(m.calls.length,0);assert.equal(field041(m.host,`묶음에 포함: ${B}`).checked,true);assert.match(m.host.textContent,/저장 기준과 최신 내용/);
});

test('checkbox additions and removals stay in sync with the order draft across snapshot refreshes',()=>{
 const m=mount();for(const name of [B,C]){choose(m,name,true);m.render();assert.equal(field041(m.host,`묶음에 포함: ${name}`).checked,true);}
 assert.deepEqual(members(m),[A,B,C]);choose(m,B,false);m.render();assert.equal(field041(m.host,`묶음에 포함: ${B}`).checked,false);assert.deepEqual(members(m),[A,C]);assert.equal(m.calls.length,0);
});

test('a pending group write explains the nearby checkbox lock and keeps selections for conflict resolution',()=>{
 const m=mount();choose(m,B,true);m.state.groups[0]={...row(1,{name:'내 묶음',categories:[A,B],archived:false}),pending:true};m.state.phase='conflict';m.state.writeState={entityType:'category_group',entityId:ID,phase:'conflict'};m.render();
 assert.equal(field041(m.host,`묶음에 포함: ${B}`).checked,true);assert.equal(field041(m.host,`묶음에 포함: ${B}`).disabled,true);assert.match(m.host.querySelector('.au-group-member-count055').textContent,/저장 확인 중에는 선택할 수 없습니다/);assert.match(m.host.textContent,/저장 대기 중인 수정과 최신 내용/);assert.doesNotMatch(m.host.textContent,/다른 창/);
 m.state.phase='ready';m.state.writeState=null;m.state.groups[0]=row(2,{name:'내 묶음',categories:[A,B],archived:false});m.render();assert.equal(field041(m.host,`묶음에 포함: ${B}`).disabled,false);assert.doesNotMatch(m.host.querySelector('.au-group-member-count055').textContent,/선택할 수 없습니다/);
});

test('a timed-out earlier card edit is explained next to the16 selected members and retry calls the existing queue with no new intent',async()=>{
 let resolveSave;const retries=[],initial=[A,B,...Array.from({length:13},(_,i)=>`지원-${i}`)];
 const m=mount((_type,_id,fields,_options,state)=>{state.groups[0]={...row(156,fields),pending:true};return new Promise(resolve=>resolveSave=resolve);},{onRetry:(...args)=>retries.push(args)});
 m.state.groups[0]=row(156,{name:'내 묶음',categories:initial,archived:false});m.state.categories=[...initial,C].map(name=>({name,archived:false}));m.render();choose(m,C,true);button041(m.host,'변경 사항 저장').click();
 m.state.phase='error';m.state.error='canceling statement due to statement timeout';m.state.writeState={entityType:'card_annotation',entityId:'131',phase:'error',uncertain:true,requestId:'private-request-identity',body:{private:'never-render-this'}};m.render();
 const error=m.host.querySelector('.au-group-error055'),retry=button041(m.host,'저장 결과 다시 확인'),fieldsBefore=clone(m.calls[0]);
 assert.match(error.textContent,/앞선 카드 편집의 저장 결과를 확인한 뒤 이 묶음을 저장합니다/);assert.ok(error.textContent.includes(m.state.error));assert.doesNotMatch(m.host.textContent,/private-request-identity|never-render-this|다른 창/);
 assert.equal(m.host.querySelectorAll('input').filter(input=>input.type==='checkbox'&&input.checked).length,16);assert.equal(field041(m.host,`묶음에 포함: ${C}`).disabled,true);assert.equal(retry.parentNode.hidden,false);assert.equal(retry.disabled,false);
 const siblings=retry.parentNode.parentNode.children;assert.ok(siblings.indexOf(error)<siblings.indexOf(m.host.querySelector('.au-group-member-count055')));assert.ok(siblings.indexOf(retry.parentNode)<siblings.indexOf(m.host.querySelector('.au-group-member-count055')));
 retry.click();assert.deepEqual(retries,[[]]);assert.equal(m.calls.length,1);assert.deepEqual(m.calls[0],fieldsBefore);assert.equal(m.state.writeState.requestId,'private-request-identity');assert.equal(m.state.groups[0].version,156);
 const saved=row(171,m.calls[0][2]);m.state.groups[0]=saved;m.state.phase='ready';m.state.error=null;m.state.writeState=null;resolveSave({category_groups055:{schema:1,groups:[saved]}});await flush();
 assert.equal(field041(m.host,`묶음에 포함: ${C}`).checked,true);assert.equal(field041(m.host,`묶음에 포함: ${C}`).disabled,false);assert.equal(button041(m.host,'저장 결과 다시 확인').parentNode.hidden,true);
});

test('an uncertain group request shows only the current plaintext error and does not offer queue retry for a confirmed conflict',()=>{
 const retries=[],m=mount(null,{onRetry:(...args)=>retries.push(args)});m.state.groups[0]={...row(),pending:true};m.state.phase='error';m.state.error='요청 시간이 초과되었습니다. <img src=x onerror=alert(1)>';m.state.writeState={entityType:'category_group',entityId:ID,phase:'error',uncertain:true};m.render();
 const error=m.host.querySelector('.au-group-error055');assert.match(error.textContent,/묶음 저장 결과/);assert.ok(error.textContent.includes(m.state.error));assert.equal(m.host.querySelectorAll('img').length,0);assert.equal(button041(m.host,'저장 결과 다시 확인').parentNode.hidden,false);
 m.state.phase='conflict';m.state.writeState.phase='conflict';m.render();const retry=button041(m.host,'저장 결과 다시 확인');assert.equal(retry.parentNode.hidden,true);retry.click();assert.equal(retries.length,0);assert.equal(field041(m.host,`묶음에 포함: ${A}`).disabled,true);
});
