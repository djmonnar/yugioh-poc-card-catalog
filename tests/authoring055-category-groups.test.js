import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {groupCategories054,createCategoryPicker054} from '../authoring054-categories.js';
import {normalizeBootstrap039,AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {Document041,field041,button041} from './authoring041-test-dom.js';
import {createCategoryGroupManager055} from '../authoring055-category-groups.js';
import {createAuthoringPanels039,normalizeCatalog039,entities039} from '../authoring039-panels.js';
import {fixture041} from './authoring041-test-dom.js';

const clone=structuredClone;
const categories=[{name:'덱-백룡',aliases:['category-blue']},{name:'효과-공격력 상승',aliases:['category-boost']},'면역-파괴','소환-묘지'];
const groups=[{id:'category-group-dragons',name:'드래곤 지원',categories:['category-blue','효과-공격력 상승']},{id:'category-group-favorites',name:'즐겨찾기',categories:['덱-백룡','면역-파괴']}];
function mount(options={}){const document=new Document041(),writes=[],errors=[],picker=createCategoryPicker054({document,categories,groups,selected:[],onChange:values=>writes.push(values),onError:error=>errors.push(error),...options});document.body.append(picker.root);return {document,writes,errors,...picker};}
const boxes=(root,name)=>root.querySelectorAll('input').filter(node=>node.type==='checkbox'&&node.getAttribute('aria-label')===name);
const choose=(root,name,value,index=0)=>{const box=boxes(root,name)[index];assert.ok(box,`${name} checkbox ${index}`);box.checked=value;box.fire('change');return box;};
const selectedChips=root=>root.querySelector('.au-category-selected054').querySelectorAll('button');
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('custom memberships reuse categories across groups without changing the original category or group data',()=>{
 const before=JSON.stringify({categories,groups}),result=groupCategories054(categories,[],groups);
 assert.deepEqual(result.filter(group=>group.key!=='ungrouped').map(group=>group.label),['드래곤 지원','즐겨찾기']);
 for(const name of ['드래곤 지원','즐겨찾기'])assert.equal(result.find(group=>group.label===name).items.filter(row=>row.name==='덱-백룡').length,1);
 assert.deepEqual(result.find(group=>group.key==='ungrouped').items.map(row=>row.name),['소환-묘지']);
 assert.equal(JSON.stringify({categories,groups}),before);
});

test('an explicitly empty custom group list shows unassigned categories instead of recreating automatic prefix groups',()=>{
 const result=groupCategories054(categories,[],[]);
 assert.equal(result.length,1);assert.equal(result[0].key,'ungrouped');assert.equal(result[0].items.length,4);
 assert.ok(groupCategories054(categories).some(group=>group.label==='덱'),'An old bootstrap without group data keeps its existing fallback.');
});

test('one category in two groups has synchronized checkboxes but only one selected chip and one selected count',()=>{
 const m=mount();assert.equal(boxes(m.root,'덱-백룡').length,2);
 choose(m.root,'덱-백룡',true,1);
 assert.equal(boxes(m.root,'덱-백룡').every(box=>box.checked),true);assert.deepEqual(m.writes.at(-1),['덱-백룡']);
 assert.equal(selectedChips(m.root).length,1);assert.match(m.root.querySelector('.au-category-selected-heading054').textContent,/1개/);
 const summaries=m.root.querySelectorAll('summary');assert.equal(summaries.filter(node=>node.textContent.includes('1개 선택')).length,2);
 choose(m.root,'덱-백룡',false,0);assert.equal(boxes(m.root,'덱-백룡').some(box=>box.checked),false);assert.deepEqual(m.writes.at(-1),[]);assert.equal(selectedChips(m.root).length,0);
});

test('legacy aliases refer to the same checkbox family and toggling removes all representations of that category',()=>{
 const m=mount({selected:['category-blue','덱-백룡','소환-묘지']});
 assert.equal(selectedChips(m.root).length,2);assert.equal(boxes(m.root,'덱-백룡').every(box=>box.checked),true);
 choose(m.root,'덱-백룡',false,1);assert.deepEqual(m.writes.at(-1),['소환-묘지']);
 choose(m.root,'덱-백룡',true);assert.deepEqual(m.writes.at(-1),['소환-묘지','덱-백룡']);assert.equal(selectedChips(m.root).length,2);
});

test('a rejected write restores every occurrence and the summary without losing unrelated category selections',async()=>{
 const m=mount({selected:['소환-묘지'],onChange:()=>Promise.reject(Error('저장 실패'))});
 choose(m.root,'덱-백룡',true,1);await flush();
 assert.equal(boxes(m.root,'덱-백룡').some(box=>box.checked),false);assert.equal(boxes(m.root,'소환-묘지')[0].checked,true);
 assert.deepEqual(m.selected(),['소환-묘지']);assert.equal(selectedChips(m.root).length,1);assert.equal(m.errors.length,1);
});

test('archived groups disappear while their categories remain selectable and unresolved selected tags remain removable',()=>{
 const m=mount({groups:[{...groups[0],archived:true}],selected:['예전-보관된 태그']});
 assert.ok(!m.root.querySelectorAll('summary').some(node=>node.textContent.includes('드래곤 지원')));
 assert.equal(boxes(m.root,'덱-백룡').length,1);assert.equal(boxes(m.root,'예전-보관된 태그')[0].checked,true);
 button041(m.root,'예전-보관된 태그 ×').click();assert.deepEqual(m.writes.at(-1),[]);assert.equal(m.document.activeElement,field041(m.root,'카테고리 검색'));
});

test('Korean category search keeps its own node, focus and cross-group selected value while groups change',()=>{
 const memory={},m=mount({selected:['덱-백룡'],memory}),first=m.root.querySelector('details');first.open=true;first.fire('toggle');
 const input=field041(m.root,'카테고리 검색');input.focus();input.fire('compositionstart');input.value='공격';input.setSelectionRange(2,2);input.fire('input',{isComposing:true});
 assert.equal(field041(m.root,'카테고리 검색'),input);assert.equal(m.document.activeElement,input);assert.equal(input.selectionStart,2);assert.equal(selectedChips(m.root).length,1);
 m.setSelected(['덱-백룡','소환-묘지']);assert.equal(field041(m.root,'카테고리 검색'),input);assert.equal(input.value,'공격');assert.equal(m.document.activeElement,input);
 input.fire('compositionend');input.value='';input.fire('input');assert.equal(m.root.querySelector('details').open,true);assert.equal(boxes(m.root,'덱-백룡').every(box=>box.checked),true);assert.equal(m.writes.length,0);
});

test('group and category names render as text and never create executable markup',()=>{
 const name='<img src=x onerror=alert(1)>',m=mount({categories:[name],groups:[{id:'category-group-html-name',name,categories:[name]}]});
 assert.equal(m.root.querySelectorAll('img').length,0);assert.ok(m.root.textContent.includes(name));
});

const payload={catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}};
const payloadText=JSON.stringify(payload),hash=value=>createHash('sha256').update(value).digest('hex');
const groupRow=(id='category-group-favorites',version=1,content={name:'즐겨찾기',categories:['덱-백룡'],archived:false})=>({entity_type:'category_group',entity_id:id,version,content:clone(content),state:'saved',issues:[]});
function wire(rows=[],revision=1,legacyRows=[]){return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:clone(legacyRows)},category_groups055:{schema:1,groups:clone(rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:revision,game_revision:revision,metadata_revision:String(revision),identity:IDENTITY039,source_fingerprint:hash(payloadText),payload_json:payloadText}};}

test('optional group bootstrap envelope projects only typed group rows without replacing old authoring entities or game bytes',async()=>{
 const raw=wire([groupRow()]),category={entity_type:'category',entity_id:'덱-백룡',version:1,content:{name:'덱-백룡',archived:false},state:'saved',issues:[]};raw.authoring.entities.push(category);const before=JSON.stringify(raw),normalized=await normalizeBootstrap039(raw,webcrypto);
 assert.deepEqual(normalized.authoring.entities,[category,groupRow()]);assert.equal(normalized.game.payload_json,payloadText);assert.equal(JSON.stringify(raw),before);
 delete raw.category_groups055;assert.deepEqual((await normalizeBootstrap039(raw,webcrypto)).authoring.entities,[category]);
});

test('guest game bootstraps can expose shared category groups without exposing private authoring rows',async()=>{
 const raw=wire([groupRow()]);raw.permissions.can_edit=false;raw.view='game';delete raw.authoring;
 const normalized=await normalizeBootstrap039(raw,webcrypto);assert.deepEqual(normalized.authoring.entities,[groupRow()]);assert.equal(normalized.permissions.can_edit,false);assert.equal(normalized.game.payload_json,payloadText);
});

test('group bootstrap envelope rejects malformed kinds, duplicate identities and unsafe object values',async()=>{
 const variants=[
  value=>value.category_groups055.schema=2,
  value=>value.category_groups055.groups=[groupRow(),groupRow()],
  value=>value.category_groups055.groups[0].entity_type='deck',
  value=>value.category_groups055.groups[0].content=JSON.parse('{"__proto__":{}}'),
  value=>value.category_groups055.groups[0].content.categories=['덱-백룡','덱-백룡'],
  value=>value.category_groups055.groups[0].content.name=' ',
  value=>value.category_groups055.groups[0].content.archived='false',
  value=>value.category_groups055.groups[0].entity_id='x'.repeat(101),
  value=>value.category_groups055.groups=Array.from({length:65},(_,index)=>groupRow('category-group-'+index))
 ];
 for(const mutate of variants){const raw=wire([groupRow()]);mutate(raw);await assert.rejects(normalizeBootstrap039(raw,webcrypto));}
});

class MemoryStorage055{constructor(){this.values=new Map();}getItem(key){return this.values.get(key)??null;}setItem(key,value){this.values.set(key,String(value));}}
async function storeFixture(t,{canEdit=true,rows=[groupRow()],legacyRows=[]}={}){
 const remote={revision:1,rows:clone(rows),legacyRows:clone(legacyRows),calls:[],once:null,requests:new Map()},storage=new MemoryStorage055();
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'groups-editor',email:'groups@example.test'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  remote.calls.push(clone({name,args}));if(name==='poc_bootstrap039'){const result=wire(remote.rows,remote.revision,remote.legacyRows);result.permissions.can_edit=canEdit;return {data:result};}
  if(remote.once){const once=remote.once;remote.once=null;return once(name,args);}
  const intent=args.p_intent;if(remote.requests.has(intent.request_id))return {data:{...clone(remote.requests.get(intent.request_id)),replayed:true}};
  const change=intent.changes[0],index=remote.rows.findIndex(row=>row.entity_type===change.entity_type&&row.entity_id===change.entity_id),old=remote.rows[index];
  if(intent.expected_project_revision!==remote.revision||(old?.version??0)!==change.expected_entity_version)return {error:{code:'P0001',message:'unified039_conflict'}};
  const next={entity_type:change.entity_type,entity_id:change.entity_id,version:(old?.version??0)+1,state:'saved',issues:[],content:{...(old?.content??{}),...clone(change.fields)}};
  if(index<0)remote.rows.push(next);else remote.rows[index]=next;remote.revision++;
  const ack={schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,replayed:false,entities:[],category_groups055:{schema:1,groups:[clone(next)]},game_revision:1,game_source_fingerprint:hash(payloadText),state:'saved'};remote.requests.set(intent.request_id,ack);return {data:ack};
 }};
 const store=new AuthoringStore039({client,storage,crypto:webcrypto,events:{},pollMs:0,debounceMs:100000,idleRefreshMs:100000});await store.start();t.after(()=>store.stop());return {store,remote,storage,client};
}

test('group changes use the existing versioned serial intent queue and preserve a category in multiple group records',async t=>{
 const m=await storeFixture(t,{rows:[groupRow(),groupRow('category-group-dragons',1,{name:'드래곤',categories:['덱-백룡'],archived:false})]});
 const done=m.store.patch('category_group','category-group-favorites',{name:'내 즐겨찾기',categories:['덱-백룡','면역-파괴']});await m.store.drain();await done;
 const intent=m.remote.calls.find(call=>call.name==='poc_apply_intent039').args.p_intent;
 assert.equal(intent.expected_project_revision,1);assert.equal(intent.changes[0].expected_entity_version,1);assert.equal(intent.changes[0].entity_type,'category_group');assert.equal(intent.changes[0].entity_id,'category-group-favorites');
 assert.equal(m.remote.rows[0].content.name,'내 즐겨찾기');assert.deepEqual(m.remote.rows[1].content.categories,['덱-백룡']);assert.equal(m.store.snapshot().pending,0);
 assert.ok(![...m.storage.values.values()].some(text=>text.includes('payload_json')));
});

test('empty group creation and soft archive use stable group identities without deleting category data',async t=>{
 const m=await storeFixture(t,{rows:[]});
 const created=m.store.patch('category_group','category-group-custom-new',{name:'나만의 묶음',categories:[],archived:false},{operation:'create'});await m.store.drain();await created;
 assert.equal(m.store.getRow('category_group','category-group-custom-new').version,1);assert.deepEqual(m.remote.rows[0].content.categories,[]);
 const archived=m.store.patch('category_group','category-group-custom-new',{archived:true});await m.store.drain();await archived;
 assert.equal(m.remote.rows[0].entity_id,'category-group-custom-new');assert.equal(m.remote.rows[0].content.archived,true);assert.equal(m.store.getRow('category_group','category-group-custom-new').content.archived,true);
 const restored=m.store.patch('category_group','category-group-custom-new',{archived:false});await m.store.drain();await restored;
 assert.equal(m.remote.rows.length,1);assert.equal(m.remote.rows[0].content.archived,false);assert.equal(m.remote.rows[0].version,3);
});

test('a malformed group acknowledgement cannot partially update the local snapshot or discard its pending request',async t=>{
 const m=await storeFixture(t),before=clone(m.store.getRow('category_group','category-group-favorites'));
 m.remote.once=(_name,args)=>({data:{schema:1,kind:'unified039-write-ack',request_id:args.p_intent.request_id,applied_revision:2,observed_project_revision:2,entities:[],category_groups055:{schema:1,groups:[groupRow('category-group-favorites',2,{name:'잘못된 응답',categories:[],archived:'false'})]},game_revision:1,game_source_fingerprint:hash(payloadText)}});
 const done=m.store.patch('category_group','category-group-favorites',{name:'내 편집'});await m.store.drain();
 assert.equal(m.store.phase,'error');assert.equal(m.store.queue.length,1);assert.deepEqual(m.store.getRow('category_group','category-group-favorites'),before);
 const requestId=m.store.queue[0].body.request_id;await m.store.drain();await done;
 const writes=m.remote.calls.filter(call=>call.name==='poc_apply_intent039');assert.equal(writes[1].args.p_intent.request_id,requestId);assert.equal(m.store.getRow('category_group','category-group-favorites').content.name,'내 편집');
});

test('same-field remote group membership conflicts keep the unsaved local selection until explicit resolution',async t=>{
 const m=await storeFixture(t);const done=m.store.patch('category_group','category-group-favorites',{categories:['면역-파괴']});
 m.remote.rows[0].content.categories=['소환-묘지'];m.remote.rows[0].version++;m.remote.revision++;
 await m.store.drain();assert.equal(m.store.phase,'conflict');assert.deepEqual(m.store.snapshot().entities[0].content.categories,['면역-파괴']);assert.deepEqual(m.remote.rows[0].content.categories,['소환-묘지']);
 m.store.resolveConflict('retry');await m.store.drain();await done;assert.deepEqual(m.remote.rows[0].content.categories,['면역-파괴']);
});

test('read-only accounts cannot enqueue group edits and validation failures retain recoverable unfinished group data',async t=>{
 const viewer=await storeFixture(t,{canEdit:false});assert.throws(()=>viewer.store.patch('category_group','category-group-favorites',{name:'수정'}));assert.equal(viewer.store.queue.length,0);
 const m=await storeFixture(t);m.remote.once=()=>({error:{message:'unified039_validation'}});m.store.patch('category_group','category-group-favorites',{name:'오류 이름'});await m.store.drain();
 assert.equal(m.store.phase,'invalid');assert.equal(m.store.snapshot().entities[0].content.name,'오류 이름');assert.equal(m.remote.rows[0].content.name,'즐겨찾기');assert.ok(m.storage.getItem('poc-authoring039-outbox:groups-editor').includes('category_group'));
});

test('a legacy category rename acknowledgement updates affected groups through its optional envelope and their new CAS versions',async t=>{
 const category={entity_type:'category',entity_id:'덱-백룡',version:1,content:{name:'덱-백룡',archived:false},state:'saved',issues:[]};
 const m=await storeFixture(t,{legacyRows:[category]});
 m.remote.once=(_name,args)=>{
  m.remote.legacyRows[0]={...category,version:2,content:{name:'덱-푸른눈',archived:false}};
  m.remote.rows[0]=groupRow('category-group-favorites',2,{name:'즐겨찾기',categories:['덱-푸른눈'],archived:false});m.remote.revision++;
  return {data:{schema:1,kind:'unified039-write-ack',request_id:args.p_intent.request_id,applied_revision:m.remote.revision,observed_project_revision:m.remote.revision,entities:clone(m.remote.legacyRows),category_groups055:{schema:1,groups:clone(m.remote.rows)},game_revision:1,game_source_fingerprint:hash(payloadText),state:'saved'}};
 };
 const renamed=m.store.patch('category','덱-백룡',{name:'덱-푸른눈'});await m.store.drain();await renamed;
 assert.equal(m.store.getRow('category_group','category-group-favorites').version,2);assert.deepEqual(m.store.getRow('category_group','category-group-favorites').content.categories,['덱-푸른눈']);
 const edited=m.store.patch('category_group','category-group-favorites',{name:'새 묶음 이름'});await m.store.drain();await edited;
 const last=m.remote.calls.filter(call=>call.name==='poc_apply_intent039').at(-1).args.p_intent;
 assert.equal(last.changes[0].expected_entity_version,2);assert.deepEqual(m.remote.rows[0].content.categories,['덱-푸른눈']);
});

function mountManager({canEdit=true,canWrite=true,onSave}={}){
 const document=new Document041(),host=document.createElement('main'),writes=[],errors=[],state={owner:'owner-1',canEdit,canWrite,groups:[groupRow(),groupRow('category-group-dragons',1,{name:'드래곤 지원',categories:['덱-백룡'],archived:false})],categories:[{name:'덱-백룡',archived:false},{name:'면역-파괴',archived:false},{name:'예전-보관',archived:true}]};document.body.append(host);
 const persist=(type,id,fields,options)=>{writes.push(clone({type,id,fields,options}));if(onSave)return onSave(type,id,fields,options);const index=state.groups.findIndex(row=>row.entity_id===id),old=state.groups[index],next=groupRow(id,(old?.version??0)+1,{...(old?.content??{}),...clone(fields)});if(index<0)state.groups.push(next);else state.groups[index]=next;return Promise.resolve();};
 const manager=createCategoryGroupManager055({document,getState:()=>state,onSave:persist,onError:error=>errors.push(error),newId:()=> 'category-group-custom-created'});manager.render(host);return {document,host,state,writes,errors,manager};
}
function selectGroup(m,id){const control=field041(m.host,'편집할 카테고리 묶음');control.value=id;control.fire('change');}
function typeName(m,name){const control=field041(m.host,'묶음 이름');control.value=name;control.fire('input');return control;}
function member(m,name,value){const box=field041(m.host,`묶음에 포함: ${name}`);assert.ok(box,name);box.checked=value;box.fire('change');return box;}

test('group manager creates one shared DB group and edits its own memberships without changing the same category in another group',async()=>{
 const m=mountManager();typeName(m,'공격 보조');member(m,'덱-백룡',true);member(m,'면역-파괴',true);assert.equal(m.writes.length,0);
 button041(m.host,'묶음 만들기').click();await flush();
 assert.deepEqual(m.writes[0],{type:'category_group',id:'category-group-custom-created',fields:{name:'공격 보조',categories:['덱-백룡','면역-파괴'],archived:false},options:{operation:'create'}});
 assert.equal(field041(m.host,'편집할 카테고리 묶음').value,'category-group-custom-created');assert.equal(field041(m.host,'묶음 이름').value,'공격 보조');
 member(m,'덱-백룡',false);button041(m.host,'변경 사항 저장').click();await flush();assert.deepEqual(m.state.groups.find(row=>row.entity_id==='category-group-custom-created').content.categories,['면역-파괴']);
 assert.deepEqual(m.state.groups.find(row=>row.entity_id==='category-group-dragons').content.categories,['덱-백룡']);assert.equal(m.errors.length,0);
});

test('group manager preserves separate unsaved drafts when switching groups and only saves after the explicit action',()=>{
 const m=mountManager();selectGroup(m,'category-group-favorites');typeName(m,'고치는 중');member(m,'면역-파괴',true);selectGroup(m,'category-group-dragons');typeName(m,'다른 초안');
 selectGroup(m,'category-group-favorites');assert.equal(field041(m.host,'묶음 이름').value,'고치는 중');assert.equal(field041(m.host,'묶음에 포함: 면역-파괴').checked,true);assert.equal(m.writes.length,0);
 button041(m.host,'편집 취소').click();assert.equal(field041(m.host,'묶음 이름').value,'즐겨찾기');assert.equal(field041(m.host,'묶음에 포함: 면역-파괴').checked,false);
 selectGroup(m,'category-group-dragons');assert.equal(field041(m.host,'묶음 이름').value,'다른 초안');
});

test('group manager refuses duplicate names and preserves the recoverable draft after a failed save',async()=>{
 const m=mountManager({onSave:()=>Promise.reject(Error('연결 실패'))});typeName(m,'  즐겨찾기  ');button041(m.host,'묶음 만들기').click();await flush();assert.equal(m.writes.length,0);assert.match(m.host.textContent,/같은 이름/);
 typeName(m,'새 사용자 묶음');member(m,'덱-백룡',true);button041(m.host,'묶음 만들기').click();await flush();assert.equal(m.writes.length,1);assert.equal(m.errors.length,1);
 assert.equal(field041(m.host,'묶음 이름').value,'새 사용자 묶음');assert.equal(field041(m.host,'묶음에 포함: 덱-백룡').checked,true);assert.equal(button041(m.host,'묶음 만들기').disabled,false);assert.match(m.host.textContent,/연결 실패/);
});

test('group manager detects remote version changes before overwriting a local draft and can reload the current DB group',()=>{
 const m=mountManager();selectGroup(m,'category-group-favorites');typeName(m,'내 초안');m.state.groups[0]=groupRow('category-group-favorites',2,{name:'다른 창의 이름',categories:['면역-파괴'],archived:false});m.manager.render(m.host);
 button041(m.host,'변경 사항 저장').click();assert.equal(m.writes.length,0);assert.equal(field041(m.host,'묶음 이름').value,'내 초안');assert.match(m.host.textContent,/저장 기준과 최신 내용/);
 button041(m.host,'최신 내용 불러오기').click();assert.equal(field041(m.host,'묶음 이름').value,'다른 창의 이름');assert.equal(field041(m.host,'묶음에 포함: 면역-파괴').checked,true);assert.equal(field041(m.host,'묶음에 포함: 덱-백룡').checked,false);
});

test('group manager archives and restores groups while retaining archived category references until explicitly removed',async()=>{
 const m=mountManager();m.state.groups[0].content.categories=['덱-백룡','예전-보관'];selectGroup(m,'category-group-favorites');
 assert.equal(field041(m.host,'묶음에 포함: 예전-보관'),undefined);assert.ok(button041(m.host,'예전-보관 제외'));typeName(m,'보관 연결 유지');button041(m.host,'변경 사항 저장').click();await flush();
 assert.deepEqual(m.writes.at(-1).fields.categories,['덱-백룡','예전-보관']);button041(m.host,'묶음 보관').click();await flush();assert.equal(m.state.groups[0].content.archived,true);
 button041(m.host,'보관 연결 유지 복원').click();await flush();assert.equal(m.state.groups[0].content.archived,false);assert.deepEqual(m.state.groups[0].content.categories,['덱-백룡','예전-보관']);
});

test('group manager read-only controls cannot save and changing editor accounts clears unfinished private drafts',()=>{
 const viewer=mountManager({canEdit:false});assert.equal(field041(viewer.host,'묶음 이름').disabled,true);assert.equal(button041(viewer.host,'묶음 만들기').disabled,true);button041(viewer.host,'묶음 만들기').click();assert.equal(viewer.writes.length,0);
 const noContract=mountManager({canWrite:false});assert.equal(button041(noContract.host,'묶음 만들기').disabled,true);
 const m=mountManager();typeName(m,'이전 계정의 초안');m.state.owner='owner-2';m.manager.render(m.host);assert.equal(field041(m.host,'묶음 이름').value,'');assert.ok(!m.host.textContent.includes('이전 계정의 초안'));assert.equal(m.writes.length,0);
});

test('group membership search keeps Korean composition focus and checked values while filtering choices',()=>{
 const m=mountManager();selectGroup(m,'category-group-favorites');const search=field041(m.host,'묶음에 넣을 카테고리 검색');search.focus();search.fire('compositionstart');search.value='파괴';search.setSelectionRange(2,2);search.fire('input',{isComposing:true});
 assert.equal(field041(m.host,'묶음에 넣을 카테고리 검색'),search);assert.equal(m.document.activeElement,search);assert.equal(search.selectionStart,2);assert.equal(field041(m.host,'묶음에 포함: 덱-백룡'),undefined);
 member(m,'면역-파괴',true);search.fire('compositionend');search.value='';search.fire('input');assert.equal(field041(m.host,'묶음에 포함: 덱-백룡').checked,true);assert.equal(field041(m.host,'묶음에 포함: 면역-파괴').checked,true);assert.equal(m.writes.length,0);
});

test('guest group-only projections retain public deck, starter and chapter data and expose unused grouped categories',t=>{
 const state=fixture041();state.canEdit=false;state.entities=[groupRow('category-group-unused',1,{name:'아직 미사용',categories:['미사용-카테고리'],archived:false})];state.bootstrap.category_groups055={schema:1,groups:clone(state.entities)};
 const all=entities039(state);assert.ok(all.some(row=>row.entity_type==='deck'));assert.ok(all.some(row=>row.entity_type==='chapter_role'));assert.ok(all.some(row=>row.entity_type==='starter_list'));
 const document=new Document041(),host=document.createElement('main');document.body.append(host);const writes=[],panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(args)});t.after(()=>panels.destroy());panels.render('cards',host,state);
 assert.equal(boxes(host,'미사용-카테고리').length,1);choose(host,'미사용-카테고리',true);assert.equal(writes.length,0);assert.match(host.querySelector('.au-card-results-summary').textContent,/^0종/);assert.equal(normalizeCatalog039(state).length,state.bootstrap.catalog.cards.length);
});

async function mountManagerStore(t,{rows=[]}={}){
 const backend=await storeFixture(t,{rows}),document=new Document041(),host=document.createElement('main'),errors=[];document.body.append(host);
 const manager=createCategoryGroupManager055({document,getState:()=>{const state=backend.store.snapshot();return {owner:state.user?.id,canEdit:state.canEdit,canWrite:true,groups:state.entities.filter(row=>row.entity_type==='category_group'),categories:[{name:'덱-백룡',archived:false},{name:'면역-파괴',archived:false}],writeState:state.writeState,phase:state.phase,error:state.error};},onSave:(...args)=>backend.store.patch(...args),onError:error=>errors.push(error),newId:()=> 'category-group-real-create'});
 const unsubscribe=backend.store.subscribe(()=>manager.render(host));t.after(unsubscribe);return {...backend,document,host,errors,manager};
}

test('the real serial store can reject a group create, unlock its manager draft and correct the same pending creation once',async t=>{
 const m=await mountManagerStore(t);m.remote.once=()=>({error:{message:'unified039_validation'}});
 typeName(m,'거부된 묶음');member(m,'덱-백룡',true);button041(m.host,'묶음 만들기').click();await m.store.drain();await flush();
 assert.equal(m.store.phase,'invalid');assert.equal(m.store.snapshot().writeState.entityId,'category-group-real-create');assert.equal(m.store.snapshot().writeState.rejected,true);
 assert.equal(field041(m.host,'묶음 이름').disabled,false);assert.equal(field041(m.host,'묶음 이름').value,'거부된 묶음');assert.equal(m.store.queue.length,1);assert.equal(m.remote.rows.length,0);
 typeName(m,'바로잡은 묶음');member(m,'면역-파괴',true);button041(m.host,'묶음 만들기').click();await m.store.drain();await flush();
 assert.equal(m.store.queue.length,0);assert.equal(m.remote.rows.length,1);assert.equal(m.remote.rows[0].entity_id,'category-group-real-create');assert.equal(m.remote.rows[0].content.name,'바로잡은 묶음');assert.deepEqual(m.remote.rows[0].content.categories,['덱-백룡','면역-파괴']);
 assert.equal(field041(m.host,'편집할 카테고리 묶음').value,'category-group-real-create');assert.equal(field041(m.host,'묶음 이름').value,'바로잡은 묶음');assert.equal(m.remote.calls.filter(call=>call.name==='poc_apply_intent039').length,2);
});

test('an uncertain network result keeps the real group manager locked while the same idempotent request is retried',async t=>{
 const m=await mountManagerStore(t),rpc=m.client.rpc;let loseResponse=true;
 m.client.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='poc_apply_intent039'&&loseResponse){loseResponse=false;throw new TypeError('response lost');}return result;};
 typeName(m,'응답 대기 묶음');member(m,'덱-백룡',true);button041(m.host,'묶음 만들기').click();await m.store.drain();await flush();
 assert.equal(m.store.phase,'error');assert.equal(m.store.snapshot().writeState.uncertain,true);assert.equal(m.remote.rows.length,1);assert.equal(field041(m.host,'묶음 이름').disabled,true);assert.equal(button041(m.host,'묶음 만들기').disabled,true);
 const first=m.remote.calls.find(call=>call.name==='poc_apply_intent039').args.p_intent;await m.store.drain();await flush();
 const writes=m.remote.calls.filter(call=>call.name==='poc_apply_intent039');assert.deepEqual(writes[1].args.p_intent,first);assert.equal(m.remote.rows.length,1);assert.equal(m.store.queue.length,0);assert.equal(field041(m.host,'묶음 이름').value,'응답 대기 묶음');assert.equal(field041(m.host,'묶음 이름').disabled,false);
});

test('real-store archive and restore refusals expose a retry that corrects the same queued patch without losing members',async t=>{
 const m=await mountManagerStore(t,{rows:[groupRow()]});selectGroup(m,'category-group-favorites');m.remote.once=()=>({error:{message:'unified039_validation'}});
 button041(m.host,'묶음 보관').click();await m.store.drain();await flush();assert.equal(m.store.phase,'invalid');assert.equal(m.remote.rows[0].content.archived,false);
 let retry=button041(m.host,'저장 요청 다시 시도');assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);retry.click();await m.store.drain();await flush();
 assert.equal(m.store.queue.length,0);assert.equal(m.remote.rows[0].content.archived,true);assert.deepEqual(m.remote.rows[0].content.categories,['덱-백룡']);
 m.remote.once=()=>({error:{message:'unified039_validation'}});button041(m.host,'즐겨찾기 복원').click();await m.store.drain();await flush();assert.equal(m.store.phase,'invalid');assert.equal(m.remote.rows[0].content.archived,true);
 retry=button041(m.host,'저장 요청 다시 시도');assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);retry.click();await m.store.drain();await flush();
 assert.equal(m.store.queue.length,0);assert.equal(m.remote.rows[0].content.archived,false);assert.deepEqual(m.remote.rows[0].content.categories,['덱-백룡']);assert.equal(m.remote.rows.length,1);
});

test('real-store conflict resolution can discard the queued write and return to the current DB membership',async t=>{
 const m=await mountManagerStore(t,{rows:[groupRow()]});selectGroup(m,'category-group-favorites');member(m,'면역-파괴',true);
 m.remote.rows[0]=groupRow('category-group-favorites',2,{name:'즐겨찾기',categories:[],archived:false});m.remote.revision++;
 button041(m.host,'변경 사항 저장').click();await m.store.drain();await flush();assert.equal(m.store.phase,'conflict');assert.equal(field041(m.host,'묶음 이름').disabled,true);assert.match(m.host.textContent,/충돌/);
 m.store.resolveConflict('remote');await flush();assert.equal(m.store.queue.length,0);assert.deepEqual(m.remote.rows[0].content.categories,[]);assert.equal(field041(m.host,'묶음 이름').disabled,false);assert.match(m.host.textContent,/취소/);
 button041(m.host,'편집 취소').click();assert.equal(field041(m.host,'묶음에 포함: 덱-백룡').checked,false);assert.equal(field041(m.host,'묶음에 포함: 면역-파괴').checked,false);
});
