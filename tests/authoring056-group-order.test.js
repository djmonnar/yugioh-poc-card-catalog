import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveCategoryGroupOrder056,categoryGroupOrderIds056,moveCategoryGroup056,createCategoryGroupOrderEditor056} from '../authoring056-group-order.js';
import {createCategoryGroupManager055} from '../authoring055-category-groups.js';
import {Document041,button041,field041} from './authoring041-test-dom.js';

const clone=structuredClone;
const row=(id,name,archived=false)=>({entity_type:'category_group',entity_id:`category-group-${id}`,version:1,content:{name,categories:['발동-묘지'],archived},state:'saved',issues:[]});
const A='category-group-a',B='category-group-b',C='category-group-c',D='category-group-d';
const groups=[row('c','세 번째'),row('a','첫 번째'),row('d','보관한 묶음',true),row('b','둘째')];
const baseIds=[A,D,B,C];
const order=(ids=baseIds,version=1)=>({entity_type:'category_group_order',entity_id:'main',version,content:{group_ids:[...ids]},state:'saved',issues:[]});
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
const byLabel=(root,label)=>root.querySelectorAll('button').find(node=>node.getAttribute('aria-label')===label);
function mount({canEdit=true,canOrderWrite=true,onSave}={}){
 const document=new Document041(),host=document.createElement('main'),writes=[],errors=[],state={owner:'test-order-editor',canEdit,canOrderWrite,phase:'ready',groups:clone(groups),order:order(),writeState:null};document.body.append(host);
 let editor;
 const persist=(type,id,fields,options)=>{writes.push(clone({type,id,fields,options}));if(onSave)return onSave(type,id,fields,options,state,editor);state.order={...order(fields.group_ids,state.order.version+1),pending:false};return Promise.resolve();};
 editor=createCategoryGroupOrderEditor056({document,getState:()=>state,onSave:persist,onError:error=>errors.push(error)});editor.render(host);
 return {document,host,writes,errors,state,editor};
}
const visibleIds=m=>m.host.querySelector('.au-group-order-list056').children.filter(node=>node.dataset.orderGroupId).map(node=>node.dataset.orderGroupId);
function positions(m){const list=m.host.querySelector('.au-group-order-list056');list.getBoundingClientRect=()=>({top:0,bottom:200,height:200});for(const node of list.children)node.getBoundingClientRect=()=>({top:Number(node.style.order)*64,bottom:Number(node.style.order)*64+64,height:64});return list;}
const transfer=()=>({values:new Map(),setData(type,value){this.values.set(type,value);},getData(type){return this.values.get(type)??'';}});

test('saved stable identities win and missing groups append by name and ID without mutating source rows',()=>{
 const source=clone(groups),before=JSON.stringify(source),result=effectiveCategoryGroupOrder056(source,[C,C,'missing',D]);
 assert.deepEqual(result.map(row=>row.entity_id),[C,D,B,A]);assert.equal(JSON.stringify(source),before);
 assert.deepEqual(categoryGroupOrderIds056([...source,source[0]],[C,C]),[C,B,D,A]);
});

test('moving active groups preserves archived slots and restoration recovers the intended position',()=>{
 const moved=moveCategoryGroup056(groups,baseIds,A,C,true);assert.deepEqual(moved,[B,D,C,A]);
 const restored=clone(groups);restored.find(row=>row.entity_id===D).content.archived=false;
 assert.deepEqual(effectiveCategoryGroupOrder056(restored,moved).map(row=>row.entity_id),[B,D,C,A]);
 assert.deepEqual(moveCategoryGroup056(groups,baseIds,D,A),baseIds);assert.deepEqual(moveCategoryGroup056(groups,baseIds,A,'missing'),baseIds);
});

test('up and down controls only change a local draft until one explicit shared-order patch is saved',async()=>{
 const m=mount();assert.deepEqual(visibleIds(m),[A,B,C]);assert.equal(byLabel(m.host,'첫 번째 위로 이동').disabled,true);
 byLabel(m.host,'첫 번째 아래로 이동').click();assert.deepEqual(visibleIds(m),[B,A,C]);assert.equal(m.writes.length,0);
 button041(m.host,'순서 저장').click();await flush();assert.deepEqual(m.writes,[{type:'category_group_order',id:'main',fields:{group_ids:[B,D,A,C]},options:{operation:'patch'}}]);
 assert.equal(button041(m.host,'순서 저장').disabled,true);assert.match(m.host.textContent,/묶음 순서를 저장했습니다/);
});

test('keyboard movement keeps focus on the same handle and cancel restores the saved order',()=>{
 const m=mount(),grip=byLabel(m.host,'첫 번째 순서 이동');grip.focus();const event=grip.fire('keydown',{key:'ArrowDown'});
 assert.equal(event.defaultPrevented,true);assert.deepEqual(visibleIds(m),[B,A,C]);assert.equal(m.document.activeElement,grip);assert.match(m.host.textContent,/첫 번째 · 2번째로 이동/);
 button041(m.host,'순서 변경 취소').click();assert.deepEqual(visibleIds(m),[A,B,C]);assert.equal(m.writes.length,0);
});

test('native desktop drag previews without reparenting its source and commits only its draft on drop',()=>{
 const m=mount(),list=positions(m),grip=byLabel(m.host,'첫 번째 순서 이동'),before=[...list.children],dataTransfer=transfer();
 grip.fire('dragstart',{dataTransfer});list.fire('dragover',{clientY:180,dataTransfer});assert.deepEqual(list.children,before);assert.equal(grip.getAttribute('aria-pressed'),'true');
 list.fire('drop',{clientY:180,dataTransfer});assert.deepEqual(visibleIds(m),[B,C,A]);assert.equal(grip.getAttribute('aria-pressed'),'false');assert.equal(m.writes.length,0);
 grip.fire('dragend');assert.deepEqual(visibleIds(m),[B,C,A]);assert.equal(button041(m.host,'순서 저장').disabled,false);
});

test('dropping outside the native list or pressing Escape cancels the drag without altering a prior draft',()=>{
 const m=mount();byLabel(m.host,'첫 번째 아래로 이동').click();const list=positions(m),grip=byLabel(m.host,'첫 번째 순서 이동'),dataTransfer=transfer();
 grip.fire('dragstart',{dataTransfer});list.fire('dragover',{clientY:180,dataTransfer});grip.fire('dragend');assert.deepEqual(visibleIds(m),[B,A,C]);
 grip.fire('dragstart',{dataTransfer});list.fire('dragover',{clientY:180,dataTransfer});grip.fire('keydown',{key:'Escape'});assert.deepEqual(visibleIds(m),[B,A,C]);assert.equal(m.writes.length,0);
});

test('touch and pen use their dedicated handle while the list can scroll elsewhere; pointer cancel restores its start',()=>{
 const m=mount(),list=positions(m),grip=byLabel(m.host,'첫 번째 순서 이동');let capture=null;grip.setPointerCapture=id=>capture=id;grip.releasePointerCapture=id=>{if(capture===id)capture=null;};
 const down=grip.fire('pointerdown',{pointerType:'touch',pointerId:7,button:0,isPrimary:true});assert.equal(down.defaultPrevented,true);assert.equal(capture,7);
 const move=grip.fire('pointermove',{pointerType:'touch',pointerId:7,clientY:180});assert.equal(move.defaultPrevented,true);assert.equal(list.children[0].dataset.orderGroupId,A,'Source stays attached during a captured touch.');
 grip.fire('pointerup',{pointerType:'touch',pointerId:7,clientY:180});assert.deepEqual(visibleIds(m),[B,C,A]);assert.equal(capture,null);
 positions(m);grip.fire('pointerdown',{pointerType:'pen',pointerId:8,button:0});grip.fire('pointermove',{pointerId:8,clientY:4});grip.fire('pointercancel',{pointerId:8});assert.deepEqual(visibleIds(m),[B,C,A]);assert.equal(m.writes.length,0);
});

test('a primary mouse pointer can reorder without native HTML drag support and ignores a competing dragstart',()=>{
 const m=mount(),list=positions(m),grip=byLabel(m.host,'첫 번째 순서 이동'),before=[...list.children];let captured=null;
 grip.setPointerCapture=id=>captured=id;grip.releasePointerCapture=id=>{if(captured===id)captured=null;};
 const down=grip.fire('pointerdown',{pointerType:'mouse',pointerId:9,button:0,isPrimary:true});assert.equal(down.defaultPrevented,true);assert.equal(captured,9);
 const native=grip.fire('dragstart',{dataTransfer:transfer()});assert.equal(native.defaultPrevented,true,'A competing native drag must not replace an active captured pointer.');
 grip.fire('pointermove',{pointerType:'mouse',pointerId:9,clientY:180});assert.deepEqual(list.children,before);assert.equal(button041(m.host,'순서 저장').disabled,true);
 grip.fire('pointerup',{pointerType:'mouse',pointerId:9,clientY:180});assert.deepEqual(visibleIds(m),[B,C,A]);assert.equal(captured,null);assert.equal(button041(m.host,'순서 저장').disabled,false);assert.equal(m.writes.length,0);
 const second=grip.fire('pointerdown',{pointerType:'mouse',pointerId:10,button:2,isPrimary:true});assert.equal(second.defaultPrevented,false);assert.equal(captured,null);
});

test('read-only ordering cannot be changed through pointer, keyboard, buttons or save handlers',()=>{
 const m=mount({canEdit:false,canOrderWrite:false}),grip=byLabel(m.host,'첫 번째 순서 이동');assert.equal(grip.disabled,true);assert.equal(grip.draggable,false);
 grip.fire('keydown',{key:'ArrowDown'});grip.fire('dragstart',{dataTransfer:transfer()});grip.fire('pointerdown',{pointerType:'touch',pointerId:2});byLabel(m.host,'첫 번째 아래로 이동').click();
 assert.deepEqual(visibleIds(m),[A,B,C]);assert.equal(m.writes.length,0);assert.match(m.host.textContent,/편집 계정으로 로그인/);
});

test('save refusal keeps the order draft, and the same order can be saved after a connection recovery',async()=>{
 let failure=true;const m=mount({onSave:(_type,_id,fields,_options,state)=>{if(failure)return Promise.reject(Error('연결 실패'));state.order=order(fields.group_ids,2);return Promise.resolve();}});
 byLabel(m.host,'첫 번째 아래로 이동').click();button041(m.host,'순서 저장').click();await flush();assert.deepEqual(visibleIds(m),[B,A,C]);assert.match(m.host.textContent,/연결 실패/);assert.equal(button041(m.host,'순서 저장').disabled,false);
 failure=false;button041(m.host,'순서 저장').click();await flush();assert.deepEqual(m.state.order.content.group_ids,[B,D,A,C]);assert.equal(m.writes.length,2);
});

test('remote version conflicts preserve the local order until the latest order is explicitly reloaded',()=>{
 const m=mount();byLabel(m.host,'첫 번째 아래로 이동').click();m.state.order=order([C,D,A,B],2);m.editor.render(m.host);button041(m.host,'순서 저장').click();
 assert.equal(m.writes.length,0);assert.deepEqual(visibleIds(m),[B,A,C]);assert.match(m.host.textContent,/다른 창/);
 button041(m.host,'최신 순서 불러오기').click();assert.deepEqual(visibleIds(m),[C,A,B]);assert.equal(button041(m.host,'순서 저장').disabled,true);
});

test('a typed store refusal unlocks only its own order draft and invalidates its stale promise completion',async()=>{
 let previousResolve;const m=mount({onSave:(_type,_id,fields,_options,state)=>{
  if(!previousResolve){state.order={...state.order,pending:true};return new Promise(resolve=>previousResolve=resolve);}
  state.order={...order(fields.group_ids,2),pending:false};state.phase='ready';state.writeState=null;return Promise.resolve();
 }});
 byLabel(m.host,'첫 번째 아래로 이동').click();button041(m.host,'순서 저장').click();await flush();m.state.phase='invalid';m.state.error='서버가 순서를 거부했습니다.';m.state.writeState={entityType:'category_group_order',entityId:'main',phase:'invalid',rejected:true};m.editor.render(m.host);
 assert.equal(button041(m.host,'순서 저장').disabled,false);assert.equal(button041(m.host,'순서 변경 취소').disabled,true);assert.match(m.host.textContent,/서버가 순서/);
 byLabel(m.host,'첫 번째 위로 이동').click();byLabel(m.host,'첫 번째 아래로 이동').click();assert.equal(button041(m.host,'순서 저장').disabled,false,'A refused pending patch can still be resubmitted after its local order returns to the same requested value.');
 button041(m.host,'순서 저장').click();await flush();
 previousResolve({discarded:true});await flush();assert.deepEqual(visibleIds(m),[B,A,C]);assert.equal(button041(m.host,'순서 저장').disabled,true);
});

test('an uncertain queued result stays locked and remote conflict discard returns to the DB order',async()=>{
 let resolve;const m=mount({onSave:(_type,_id,_fields,_options,state)=>{state.order={...state.order,pending:true};return new Promise(done=>resolve=done);}});
 byLabel(m.host,'첫 번째 아래로 이동').click();button041(m.host,'순서 저장').click();m.state.phase='error';m.state.writeState={entityType:'category_group_order',entityId:'main',phase:'error',uncertain:true};m.editor.render(m.host);
 assert.equal(button041(m.host,'순서 저장').disabled,true);assert.equal(byLabel(m.host,'첫 번째 순서 이동').disabled,true);assert.match(m.host.textContent,/같은 요청/);assert.equal(m.writes.length,1);
 m.state.phase='ready';m.state.writeState=null;m.state.order=order([C,D,A,B],2);resolve({discarded:true});await flush();assert.deepEqual(visibleIds(m),[C,A,B]);assert.equal(m.writes.length,1);
});

test('account changes clear unfinished private ordering and feature absence removes its controls',()=>{
 const m=mount();byLabel(m.host,'첫 번째 아래로 이동').click();m.state.owner='other-owner';m.state.order=order([C,D,A,B],7);m.editor.render(m.host);assert.deepEqual(visibleIds(m),[C,A,B]);assert.equal(button041(m.host,'순서 저장').disabled,true);
 m.state.order=null;m.state.canOrderWrite=false;m.editor.render(m.host);assert.equal(m.host.querySelector('.au-group-order056'),null);
});

test('the group manager shares the saved order and preserves a separate unfinished group draft during an order save',async()=>{
 const document=new Document041(),host=document.createElement('main'),state={owner:'editor',canEdit:true,canWrite:true,canOrderWrite:true,groups:clone(groups),order:order(),categories:[{name:'발동-묘지'}]},writes=[];document.body.append(host);let manager;
 manager=createCategoryGroupManager055({document,getState:()=>state,onSave:(type,id,fields,options)=>{writes.push(clone({type,id,fields,options}));state.order=order(fields.group_ids,2);manager.render(host);return Promise.resolve();}});manager.render(host);
 const name=field041(host,'묶음 이름');name.value='다른 작업 초안';name.fire('input');
 assert.deepEqual(field041(host,'편집할 카테고리 묶음').options.map(option=>option.textContent),['새 묶음 만들기','첫 번째','둘째','세 번째']);
 byLabel(host,'첫 번째 아래로 이동').click();button041(host,'순서 저장').click();await flush();
 assert.deepEqual(writes[0],{type:'category_group_order',id:'main',fields:{group_ids:[B,D,A,C]},options:{operation:'patch'}});
 assert.deepEqual(field041(host,'편집할 카테고리 묶음').options.map(option=>option.textContent),['새 묶음 만들기','둘째','첫 번째','세 번째']);assert.equal(field041(host,'묶음 이름').value,'다른 작업 초안');
});
