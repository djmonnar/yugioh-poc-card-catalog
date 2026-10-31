import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,normalizeBootstrap039,IDENTITY039,PROJECT039} from '../authoring039-store.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {entities039,createAuthoringPanels039} from '../authoring039-panels.js';
import {groupCategories054} from '../authoring054-categories.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';
const clone=structuredClone;
const ids=['category-group-a','category-group-b'];
const group=(id,name)=>({entity_type:'category_group',entity_id:id,version:3,content:{name,categories:['지원-공용'],archived:false},state:'saved',issues:[]});
const order=(list=ids,version=3)=>({entity_type:'category_group_order',entity_id:'main',version,content:{group_ids:[...list]},state:'saved',issues:[]});
const payloadText=JSON.stringify({catalog:[],deck_rules035:{},opponents:{opponents:[]},starters:{starters:[]},content022:{},meta017:{},characters:[],shop_rules:{}});
const hash=value=>createHash('sha256').update(value).digest('hex');
function wire(entity=order(),groups=[group(ids[0],'첫 묶음'),group(ids[1],'둘째 묶음')],revision=9){return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:[]},category_groups055:{schema:1,groups:clone(groups)},category_group_order056:{schema:1,entity:clone(entity)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:9,game_revision:9,metadata_revision:'9',identity:IDENTITY039,payload_json:payloadText,source_fingerprint:hash(payloadText)}};}
test('order metadata stays outside old entities on the wire and merges without changing game payload bytes',async()=>{
 const raw=wire(),before=JSON.stringify(raw),parsed=await normalizeBootstrap039(raw,webcrypto);
 assert.deepEqual(parsed.authoring.entities.map(row=>row.entity_type),['category_group','category_group','category_group_order']);assert.equal(parsed.game.payload_json,payloadText);assert.equal(JSON.stringify(raw),before);
 delete raw.category_group_order056;assert.equal((await normalizeBootstrap039(raw,webcrypto)).authoring.entities.length,2);
 raw.category_group_order056={schema:1,entity:null};assert.equal((await normalizeBootstrap039(raw,webcrypto)).authoring.entities.length,2);
});
test('order envelope rejects wrong kinds, duplicate or unknown-shape IDs and more than64 group references',async()=>{
 const changes=[raw=>raw.category_group_order056.schema=2,raw=>raw.category_group_order056.extra=true,raw=>raw.category_group_order056.entity.entity_type='category_group',raw=>raw.category_group_order056.entity.entity_id='other',raw=>raw.category_group_order056.entity.deleted=true,raw=>raw.category_group_order056.entity.content={group_ids:[ids[0],ids[0]]},raw=>raw.category_group_order056.entity.content={group_ids:['bad-id']},raw=>raw.category_group_order056.entity.content={group_ids:Array.from({length:65},(_,i)=>'category-group-'+i)},raw=>raw.category_group_order056.entity.content={group_ids:[],extra:true}];
 for(const change of changes){const raw=wire();change(raw);await assert.rejects(normalizeBootstrap039(raw,webcrypto));}
});
test('picker order follows shared saved IDs while multi-group category selection remains a single value',()=>{
 const groups=[{id:ids[0],name:'A',categories:['지원-공용']},{id:ids[1],name:'B',categories:['지원-공용']}];
 const grouped=groupCategories054(['지원-공용'],['지원-공용'],groups,[ids[1],ids[0]]);assert.deepEqual(grouped.map(row=>row.label),['B','A']);assert.equal(grouped[0].items[0].name,grouped[1].items[0].name);
});
test('guest order metadata does not replace the existing public deck, chapter and starter projections',()=>{
 const state=fixture041();state.canEdit=false;state.entities=[group(ids[0],'첫 묶음'),order()];
 const rows=entities039(state);for(const kind of ['deck','chapter_role','starter_list','category_group','category_group_order'])assert.ok(rows.some(row=>row.entity_type===kind),kind);
});
async function setup(t){
 const remote={revision:9,order:order(),groups:[group(ids[0],'첫 묶음'),group(ids[1],'둘째 묶음')],calls:[],once:null,requests:new Map()};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'order-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  remote.calls.push(clone({name,args}));if(name==='poc_bootstrap039')return {data:wire(remote.order,remote.groups,remote.revision)};
  if(remote.once){const once=remote.once;remote.once=null;return once(args);}
  const intent=args.p_intent;if(remote.requests.has(intent.request_id))return {data:clone(remote.requests.get(intent.request_id))};const c=intent.changes[0],old=c.entity_type==='category_group_order'?remote.order:remote.groups.find(row=>row.entity_id===c.entity_id);
  if(intent.expected_project_revision!==remote.revision||c.expected_entity_version!==old.version)return {error:{message:'unified039_conflict'}};
  const next={...old,content:{...old.content,...clone(c.fields)},version:++remote.revision};if(c.entity_type==='category_group_order')remote.order=next;else remote.groups[remote.groups.findIndex(row=>row.entity_id===c.entity_id)]=next;
  const ack={schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,entities:[],category_groups055:{schema:1,groups:c.entity_type==='category_group'?[clone(next)]:[]},category_group_order056:{schema:1,entity:c.entity_type==='category_group_order'?clone(next):null},game_revision:9,game_source_fingerprint:hash(payloadText)};remote.requests.set(intent.request_id,ack);return {data:ack};
 }};
 const store=new AuthoringStore039({client,storage:null,events:{},crypto:webcrypto,debounceMs:100000,idleRefreshMs:100000,pollMs:0});await store.start();t.after(()=>store.stop());return {store,remote};
}
test('order save uses the established entity/project CAS and null order ACK keeps the last saved order',async t=>{
 const m=await setup(t),done=m.store.patch('category_group_order','main',{group_ids:[ids[1],ids[0]]});await m.store.drain();await done;
 const write=m.remote.calls.find(call=>call.name==='poc_apply_intent039').args.p_intent;assert.equal(write.expected_project_revision,9);assert.equal(write.changes[0].expected_entity_version,3);assert.deepEqual(m.store.getRow('category_group_order','main').content.group_ids,[ids[1],ids[0]]);
 const rename=m.store.patch('category_group',ids[0],{name:'새 이름'});await m.store.drain();await rename;assert.deepEqual(m.store.getRow('category_group_order','main').content.group_ids,[ids[1],ids[0]]);assert.equal(m.store.snapshot().pending,0);
 assert.throws(()=>m.store.patch('category_group_order','main',{}, {operation:'create'}));assert.throws(()=>m.store.patch('category_group_order','main',{group_ids:[ids[0],ids[0]]}));
});
test('uncertain order writes keep the same request identity and a remote order conflict preserves the pending choice',async t=>{
 const m=await setup(t);m.remote.once=()=>({error:{message:'response lost'}});const done=m.store.patch('category_group_order','main',{group_ids:[ids[1],ids[0]]});await m.store.drain();assert.equal(m.store.phase,'error');const request=m.store.queue[0].body.request_id;await m.store.drain();await done;
 assert.equal(m.remote.calls.filter(call=>call.name==='poc_apply_intent039')[1].args.p_intent.request_id,request);
 const pending=m.store.patch('category_group_order','main',{group_ids:[ids[0],ids[1]]});m.remote.order={...order([ids[1]],m.remote.revision+1)};m.remote.revision++;await m.store.drain();assert.equal(m.store.phase,'conflict');assert.equal(m.store.snapshot().pending,1);m.store.resolveConflict('remote');await pending;assert.deepEqual(m.store.getRow('category_group_order','main').content.group_ids,[ids[1]]);
});
test('shell refreshes a group form for a transport-only rejection instead of leaving the save button locked',async t=>{
 const doc=new Document041(),root=doc.createElement('main');doc.body.append(root);let state=fixture041(),listener;
 state.user={id:'shell-editor'};state.entities.push(group(ids[0],'첫 묶음'));state.bootstrap.capabilities.entities.category_group={operations:['create','patch']};
 const store={snapshot:()=>clone(state),subscribe(fn){listener=fn;fn(clone(state));return()=>{};},patch(type,id,fields){const row=state.entities.find(row=>row.entity_type===type&&row.entity_id===id);row.content={...row.content,...fields};row.pending=true;state.pending=1;state.phase='pending';state.writeState={entityType:type,entityId:id,operation:'patch',phase:'pending',rejected:false,uncertain:false};listener(clone(state));return new Promise(()=>{});}};
 const win={location:{href:'https://example.test/index.html?section=cards'},history:{pushState(){}},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,scrollTo(){}};
 const shell=mountAuthoringShell039({root,store,document:doc,window:win});t.after(()=>shell.destroy());assert.match(root.textContent,/원정 제작소 · \d{3}/);
 root.querySelector('.au-category-manager055').open=true;root.querySelector('.au-category-manager055').fire('toggle');let choice=field041(root,'편집할 카테고리 묶음');choice.value=ids[0];choice.fire('change');const name=field041(root,'묶음 이름');name.value='새 이름';name.fire('input');button041(root,'변경 사항 저장').click();
 assert.equal(field041(root,'묶음 이름').disabled,true);state.phase='invalid';state.error='서버가 저장을 거부했습니다.';state.writeState={...state.writeState,phase:'invalid',rejected:true};listener(clone(state));assert.equal(field041(root,'묶음 이름').disabled,false);assert.ok(root.textContent.includes(state.error));
});
test('an immediate editor-account change reloads an identical shared snapshot and clears the previous unsaved group name',t=>{
 const doc=new Document041(),root=doc.createElement('main');doc.body.append(root);let state=fixture041(),listener;state.user={id:'editor-a'};state.bootstrap.capabilities.entities.category_group={operations:['create','patch']};
 const store={snapshot:()=>clone(state),subscribe(fn){listener=fn;fn(clone(state));return()=>{};},patch(){throw Error('A draft must not be saved');}};
 const win={location:{href:'https://example.test/index.html?section=cards'},history:{pushState(){}},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,scrollTo(){}};
 const shell=mountAuthoringShell039({root,store,document:doc,window:win});t.after(()=>shell.destroy());const manager=root.querySelector('.au-category-manager055');manager.open=true;manager.fire('toggle');const name=field041(root,'묶음 이름');name.focus();name.value='이전 계정의 미저장 초안';name.fire('input');
 const next=clone(state);listener({...clone(state),user:{id:'editor-b'},bootstrap:null,entities:[],canEdit:false,phase:'loading'});state={...next,user:{id:'editor-b'}};listener(clone(state));
 assert.ok(root.querySelector('.au-category-manager055'),'The new ready snapshot must replace the temporary loading view');assert.equal(field041(root,'묶음 이름').value,'');assert.ok(!root.textContent.includes('이전 계정의 미저장 초안'));
});
