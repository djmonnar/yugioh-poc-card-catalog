import test from 'node:test';
import assert from 'node:assert/strict';
import {createCategoryMemberOrderEditor057,moveCategoryMember057} from '../authoring057-member-order.js';
import {groupCategories054,createCategoryPicker054} from '../authoring054-categories.js';
import {createCategoryGroupManager055} from '../authoring055-category-groups.js';
import {Document041,field041,button041} from './authoring041-test-dom.js';

const A='지원-융합',B='발동-묘지',C='덱-백룡',D='예전-보관';
const clone=structuredClone,flush=async()=>{await Promise.resolve();await Promise.resolve();};
const byLabel=(root,label)=>root.querySelectorAll('button').find(node=>node.getAttribute('aria-label')===label);
const listOf=root=>root.querySelector('.au-member-order-list057');
const namesOf=root=>listOf(root).children.filter(node=>node.dataset.orderCategory).map(node=>node.dataset.orderCategory);
function geometry(root){const list=listOf(root);list.getBoundingClientRect=()=>({top:0,bottom:240,height:240});for(const row of list.children)row.getBoundingClientRect=()=>({top:Number(row.style.order)*60,bottom:Number(row.style.order)*60+60,height:60});return list;}
const transfer=()=>({setData(){},getData(){return '';}});
function mount(options={}){const document=new Document041(),changes=[],interactions=[];const editor=createCategoryMemberOrderEditor057({document,values:[A,B,C],onChange:next=>changes.push(next),onInteraction:active=>interactions.push(active),...options});document.body.append(editor.root);return {document,changes,interactions,...editor};}

test('moving one group member preserves its relative neighbors without mutating its source',()=>{
 const source=[A,D,B,C],before=clone(source);assert.deepEqual(moveCategoryMember057(source,A,C,true),[D,B,C,A]);assert.deepEqual(source,before);
 assert.deepEqual(moveCategoryMember057(source,A,'missing'),source);assert.deepEqual(moveCategoryMember057(source,A,A),source);
});

test('custom category groups use their independent stored member order while fallback groups stay alphabetic',()=>{
 const groups=[{id:'a',name:'첫 묶음',categories:[A,B,C]},{id:'b',name:'둘째 묶음',categories:[C,A]}],before=clone(groups);
 const result=groupCategories054([C,B,A,D],[],groups);assert.deepEqual(result[0].items.map(row=>row.name),[A,B,C]);assert.deepEqual(result[1].items.map(row=>row.name),[C,A]);assert.deepEqual(result[2].items.map(row=>row.name),[D]);assert.deepEqual(groups,before);
 const alias=groupCategories054([{name:C,aliases:['old-blue']},A],[],[{id:'a',name:'별칭',categories:['old-blue',A,C]}]);assert.deepEqual(alias[0].items.map(row=>row.name),[C,A]);
});

test('the picker retains saved order through a Korean search and keeps shared category selections synchronized',()=>{
 const document=new Document041(),changes=[],picker=createCategoryPicker054({document,categories:[C,B,A],groups:[{id:'a',name:'첫 묶음',categories:[A,B,C]},{id:'b',name:'둘째 묶음',categories:[C,A]}],onChange:next=>changes.push(next)});document.body.append(picker.root);
 const search=field041(picker.root,'카테고리 검색');search.value='지원';search.fire('input');assert.equal(picker.root.querySelectorAll('input').filter(row=>row.type==='checkbox').length,2);search.value='';search.fire('compositionend');
 const first=picker.root.querySelectorAll('.au-category-options054')[0];assert.deepEqual(first.querySelectorAll('input').map(row=>row.getAttribute('aria-label')),[A,B,C]);
 const checks=picker.root.querySelectorAll('input').filter(row=>row.getAttribute('aria-label')===A);checks[1].checked=true;checks[1].fire('change');assert.equal(checks.every(row=>row.checked),true);assert.deepEqual(changes,[[A]]);
});

test('keyboard and step controls change a member draft and keep focus on its handle',()=>{
 const m=mount(),grip=byLabel(m.root,`${A} 카테고리 순서 이동`);grip.focus();grip.fire('keydown',{key:'ArrowDown'});
 assert.deepEqual(namesOf(m.root),[B,A,C]);assert.deepEqual(m.changes,[[B,A,C]]);assert.equal(m.document.activeElement,grip);assert.match(m.root.textContent,/2번째로 이동/);
 byLabel(m.root,`${A} 카테고리 아래로 이동`).click();assert.deepEqual(namesOf(m.root),[B,C,A]);assert.equal(byLabel(m.root,`${A} 카테고리 아래로 이동`).disabled,true);
});

test('mouse pointer drag previews in place and emits one complete group order only on release',()=>{
 const m=mount(),list=geometry(m.root),grip=byLabel(m.root,`${A} 카테고리 순서 이동`),before=[...list.children];let capture=null;grip.setPointerCapture=id=>capture=id;grip.releasePointerCapture=()=>capture=null;
 const down=grip.fire('pointerdown',{pointerType:'mouse',pointerId:1,button:0,isPrimary:true});assert.equal(down.defaultPrevented,true);assert.equal(capture,1);assert.equal(m.isDragging(),true);
 assert.equal(grip.fire('dragstart',{dataTransfer:transfer()}).defaultPrevented,true,'Native drag cannot steal a captured pointer.');grip.fire('pointermove',{pointerId:1,clientY:175});assert.deepEqual(list.children,before);assert.deepEqual(m.changes,[]);
 grip.fire('pointerup',{pointerId:1,clientY:175});assert.deepEqual(namesOf(m.root),[B,C,A]);assert.deepEqual(m.changes,[[B,C,A]]);assert.deepEqual(m.interactions,[true,false]);assert.equal(capture,null);
 assert.equal(grip.fire('pointerdown',{pointerType:'mouse',pointerId:2,button:2}).defaultPrevented,false);
});

test('touch and pen cancellation restore the original draft without emitting a change',()=>{
 const m=mount(),grip=byLabel(m.root,`${A} 카테고리 순서 이동`);geometry(m.root);
 for(const [pointerId,pointerType] of [[3,'touch'],[4,'pen']]){grip.fire('pointerdown',{pointerId,pointerType,button:0});grip.fire('pointermove',{pointerId,clientY:175});grip.fire('pointercancel',{pointerId});assert.deepEqual(namesOf(m.root),[A,B,C]);}
 assert.deepEqual(m.changes,[]);assert.equal(m.isDragging(),false);
});

test('HTML drag fallback commits only a drop and Escape or an outside drop cancels preview',()=>{
 const m=mount(),grip=byLabel(m.root,`${A} 카테고리 순서 이동`),list=geometry(m.root),dataTransfer=transfer();
 grip.fire('dragstart',{dataTransfer});list.fire('dragover',{clientY:175,dataTransfer});grip.fire('dragend');assert.deepEqual(namesOf(m.root),[A,B,C]);assert.deepEqual(m.changes,[]);
 grip.fire('dragstart',{dataTransfer});list.fire('dragover',{clientY:175,dataTransfer});grip.fire('keydown',{key:'Escape'});assert.deepEqual(namesOf(m.root),[A,B,C]);
 grip.fire('dragstart',{dataTransfer});list.fire('drop',{clientY:175,dataTransfer});assert.deepEqual(namesOf(m.root),[B,C,A]);assert.deepEqual(m.changes,[[B,C,A]]);
});

test('read-only and pending member editors do not accept pointer, keyboard or button changes',()=>{
 const m=mount({disabled:true}),grip=byLabel(m.root,`${A} 카테고리 순서 이동`);assert.equal(grip.disabled,true);assert.equal(grip.draggable,false);
 grip.fire('pointerdown',{pointerId:1,button:0});grip.fire('keydown',{key:'ArrowDown'});byLabel(m.root,`${A} 카테고리 아래로 이동`).click();assert.deepEqual(namesOf(m.root),[A,B,C]);assert.deepEqual(m.changes,[]);
 m.setDisabled(false);geometry(m.root);grip.fire('pointerdown',{pointerId:1,button:0});grip.fire('pointermove',{pointerId:1,clientY:175});m.setDisabled(true);assert.deepEqual(namesOf(m.root),[A,B,C]);assert.equal(m.isDragging(),false);assert.deepEqual(m.changes,[]);
});

const group=(id,name,members,version=1)=>({entity_type:'category_group',entity_id:id,version,content:{name,categories:clone(members),archived:false},state:'saved',issues:[]});
function managerFixture({onSave,canEdit=true}={}){
 const document=new Document041(),host=document.createElement('main'),writes=[],errors=[],state={owner:'first-editor',canEdit,canWrite:true,phase:'ready',categories:[{name:A},{name:B},{name:C},{name:D,archived:true}],groups:[group('group-a','첫 묶음',[A,B,C]),group('group-b','둘째 묶음',[C,A])]};document.body.append(host);
 const manager=createCategoryGroupManager055({document,getState:()=>state,onError:error=>errors.push(error),onSave:(type,id,fields,options)=>{writes.push(clone({type,id,fields,options}));if(onSave)return onSave(type,id,fields,options,state);const index=state.groups.findIndex(row=>row.entity_id===id),old=state.groups[index];state.groups[index]=group(id,fields.name??old.content.name,fields.categories??old.content.categories,old.version+1);return Promise.resolve();}});manager.render(host);
 const select=id=>{const control=field041(host,'편집할 카테고리 묶음');control.value=id;control.fire('change');};select('group-a');return {document,host,writes,errors,state,manager,select};
}

test('a member reorder saves only its group array using the existing explicit patch action',async()=>{
 const m=managerFixture();byLabel(m.host,`${A} 카테고리 아래로 이동`).click();assert.deepEqual(namesOf(m.host),[B,A,C]);assert.equal(m.writes.length,0);
 button041(m.host,'변경 사항 저장').click();await flush();assert.deepEqual(m.writes,[{type:'category_group',id:'group-a',fields:{name:'첫 묶음',categories:[B,A,C],archived:false},options:{operation:'patch'}}]);assert.deepEqual(m.state.groups[1].content.categories,[C,A]);
 const view=groupCategories054([A,B,C],[],m.state.groups);assert.deepEqual(view[0].items.map(row=>row.name),[B,A,C]);assert.equal(button041(m.host,'변경 사항 저장').disabled,true);
});

test('membership search never hides reorder targets or resets the saved member order',()=>{
 const m=managerFixture(),search=field041(m.host,'묶음에 넣을 카테고리 검색');search.value='지원';search.fire('compositionstart');search.fire('input');assert.deepEqual(namesOf(m.host),[A,B,C]);assert.equal(m.host.querySelector('.au-group-member-list055').querySelectorAll('input').length,1);
 byLabel(m.host,`${C} 카테고리 위로 이동`).click();assert.deepEqual(namesOf(m.host),[A,C,B]);assert.equal(search.value,'지원');search.value='';search.fire('compositionend');assert.deepEqual(namesOf(m.host),[A,C,B]);
 const box=field041(m.host,`묶음에 포함: ${A}`);box.checked=false;box.fire('change');assert.deepEqual(namesOf(m.host),[C,B]);box.checked=true;box.fire('change');assert.deepEqual(namesOf(m.host),[C,B,A]);assert.equal(m.writes.length,0);
});

test('different groups retain independent unfinished orders and cancel restores only the current group',()=>{
 const m=managerFixture();byLabel(m.host,`${A} 카테고리 아래로 이동`).click();m.select('group-b');byLabel(m.host,`${C} 카테고리 아래로 이동`).click();m.select('group-a');assert.deepEqual(namesOf(m.host),[B,A,C]);
 button041(m.host,'편집 취소').click();assert.deepEqual(namesOf(m.host),[A,B,C]);m.select('group-b');assert.deepEqual(namesOf(m.host),[A,C]);assert.equal(m.writes.length,0);
});

test('remote group changes block an old local order until reloading and account switches discard private drafts',()=>{
 const m=managerFixture();byLabel(m.host,`${A} 카테고리 아래로 이동`).click();m.state.groups[0]=group('group-a','첫 묶음',[C,B,A],2);m.manager.render(m.host);button041(m.host,'변경 사항 저장').click();assert.equal(m.writes.length,0);assert.deepEqual(namesOf(m.host),[B,A,C]);assert.match(m.host.textContent,/다른 창/);
 button041(m.host,'최신 내용 불러오기').click();assert.deepEqual(namesOf(m.host),[C,B,A]);byLabel(m.host,`${C} 카테고리 아래로 이동`).click();m.state.owner='second-editor';m.manager.render(m.host);m.select('group-a');assert.deepEqual(namesOf(m.host),[C,B,A]);assert.equal(button041(m.host,'변경 사항 저장').disabled,true);
});

test('a failed save retains the member order draft and archived references are never dropped by reordering',async()=>{
 const m=managerFixture({onSave:()=>Promise.reject(Error('연결 실패'))});m.state.groups[0]=group('group-a','첫 묶음',[A,D,B,C],2);m.manager.render(m.host);byLabel(m.host,`${A} 카테고리 아래로 이동`).click();assert.deepEqual(namesOf(m.host),[D,A,B,C]);
 button041(m.host,'변경 사항 저장').click();await flush();assert.deepEqual(m.writes[0].fields.categories,[D,A,B,C]);assert.deepEqual(namesOf(m.host),[D,A,B,C]);assert.match(m.host.textContent,/연결 실패/);assert.equal(button041(m.host,'변경 사항 저장').disabled,false);assert.deepEqual(m.state.groups[0].content.categories,[A,D,B,C]);
});

test('group save stays unavailable while a pointer preview is active and cancellation stays clean',()=>{
 const m=managerFixture(),grip=byLabel(m.host,`${A} 카테고리 순서 이동`);geometry(m.host);grip.fire('pointerdown',{pointerId:8,button:0,pointerType:'touch'});grip.fire('pointermove',{pointerId:8,clientY:175});assert.equal(button041(m.host,'변경 사항 저장').disabled,true);assert.equal(field041(m.host,'편집할 카테고리 묶음').disabled,true);
 grip.fire('pointercancel',{pointerId:8});assert.deepEqual(namesOf(m.host),[A,B,C]);assert.equal(button041(m.host,'변경 사항 저장').disabled,true);assert.equal(field041(m.host,'편집할 카테고리 묶음').disabled,false);assert.equal(m.writes.length,0);
});

test('a typed group refusal unlocks its own ordering draft while a stale save completion cannot discard it',async()=>{
 let oldResolve;const m=managerFixture({onSave:(_type,_id,fields,_options,state)=>{
  if(!oldResolve){state.groups[0].pending=true;return new Promise(resolve=>oldResolve=resolve);}
  state.groups[0]=group('group-a','첫 묶음',fields.categories,2);state.phase='ready';state.writeState=null;return Promise.resolve();
 }});
 byLabel(m.host,`${A} 카테고리 아래로 이동`).click();button041(m.host,'변경 사항 저장').click();m.state.phase='invalid';m.state.error='순서 요청 거부';m.state.writeState={entityType:'category_group',entityId:'group-a',phase:'invalid',rejected:true};m.manager.render(m.host);
 assert.deepEqual(namesOf(m.host),[B,A,C]);assert.equal(button041(m.host,'변경 사항 저장').disabled,false);byLabel(m.host,`${C} 카테고리 위로 이동`).click();button041(m.host,'변경 사항 저장').click();await flush();oldResolve({discarded:true});await flush();
 assert.deepEqual(namesOf(m.host),[B,C,A]);assert.deepEqual(m.state.groups[0].content.categories,[B,C,A]);assert.equal(button041(m.host,'변경 사항 저장').disabled,true);
});

test('an uncertain queued member-order result stays locked instead of creating another save request',()=>{
 const m=managerFixture({onSave:(_type,_id,_fields,_options,state)=>{state.groups[0].pending=true;return new Promise(()=>{});}});byLabel(m.host,`${A} 카테고리 아래로 이동`).click();button041(m.host,'변경 사항 저장').click();m.state.phase='error';m.state.error='연결 확인 중';m.state.writeState={entityType:'category_group',entityId:'group-a',phase:'error',uncertain:true};m.manager.render(m.host);
 assert.deepEqual(namesOf(m.host),[B,A,C]);assert.equal(button041(m.host,'변경 사항 저장').disabled,true);assert.equal(byLabel(m.host,`${A} 카테고리 순서 이동`).disabled,true);button041(m.host,'변경 사항 저장').click();assert.equal(m.writes.length,1);assert.match(m.host.textContent,/같은 요청/);
});
