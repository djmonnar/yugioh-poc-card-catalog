import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
const clone=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const text=JSON.stringify({catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
async function setup(t,content={name:'Original',deck_name:'Original',main:[],extra:[]}){
 const remote={revision:1,row:{entity_type:'deck',entity_id:'deck',version:1,content:clone(content),state:'saved',issues:[]},calls:[],commits:0,requests:new Map(),nextError:null,nextReadError:null,holdCheck:false,holdAck:false,gates:[]};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  remote.calls.push({name,args:clone(args)});
  if(name==='poc_bootstrap039'){
   if(remote.nextReadError){const error=remote.nextReadError;remote.nextReadError=null;return {error};}
   return {data:{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:remote.row?[clone(remote.row)]:[]},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:remote.revision,metadata_revision:String(remote.revision),identity:IDENTITY039,payload_json:text,source_fingerprint:hash(text)}}};
  }
  if(remote.nextError){const error=remote.nextError;remote.nextError=null;return {error};}
  if(remote.holdCheck){remote.holdCheck=false;await new Promise(resolve=>remote.gates.push(resolve));}
  const body=args.p_intent,change=body.changes[0];
  if(remote.requests.has(body.request_id))return {data:{...clone(remote.requests.get(body.request_id)),replayed:true}};
  if(body.expected_project_revision!==remote.revision||(remote.row?.version??0)!==change.expected_entity_version||change.operation==='create'&&remote.row)return {error:{code:'P0001',message:'unified039_conflict'}};
  const next={entity_type:'deck',entity_id:'deck',version:++remote.revision,content:{...(remote.row?.content??{}),...clone(change.fields)},state:'saved',issues:[]};remote.commits++;remote.row=change.operation==='delete'?null:next;
  const ack={schema:1,kind:'unified039-write-ack',request_id:body.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,entities:[{...clone(next),...(change.operation==='delete'?{deleted:true}:{})}],game_revision:remote.revision,game_source_fingerprint:'0'.repeat(64)};remote.requests.set(body.request_id,clone(ack));
  if(remote.holdAck){remote.holdAck=false;await new Promise(resolve=>remote.gates.push(resolve));}
  return {data:ack};
 }};
 const store=new AuthoringStore039({client,crypto:webcrypto,storage:null,events:{},pollMs:0,debounceMs:100000,idleRefreshMs:100000});await store.start();t.after(()=>{store.stop();for(const release of remote.gates)release();});
 const change=fields=>{remote.revision++;remote.row={...remote.row,version:remote.revision,content:{...remote.row.content,...clone(fields)}};};
 const writes=()=>remote.calls.filter(call=>call.name==='poc_apply_intent039');return {store,remote,change,writes};
}

test('certified CAS plus current desired patch settles without another write or a synthetic server ACK',async t=>{
 const {store,remote,change,writes}=await setup(t);const done=store.patch('deck','deck',{name:'Desired'});change({name:'Desired'});await store.drain();const outcome=await done;
 assert.equal(store.phase,'ready');assert.equal(store.queue.length,0);assert.equal(remote.commits,0);assert.equal(writes().length,1);
 assert.equal(outcome.kind,'already-current');assert.equal(outcome.alreadyCurrent,true);assert.equal(outcome.entity.version,2);assert.equal(outcome.entity.content.name,'Desired');
 for(const field of ['request_id','applied_revision','entities'])assert.equal(Object.hasOwn(outcome,field),false);
});

test('certified CAS for an already missing delete settles without pretending a server mutation',async t=>{
 const {store,remote,writes}=await setup(t);const done=store.patch('deck','deck',{}, {operation:'delete'});remote.row=null;remote.revision++;await store.drain();const outcome=await done;
 assert.equal(outcome.alreadyCurrent,true);assert.equal(outcome.entity,null);assert.equal(store.pendingRevision,null);assert.equal(store.phase,'ready');assert.equal(writes().length,1);assert.equal(remote.commits,0);
});

test('some desired fields and some unchanged baseline fields safely rebase after certified CAS',async t=>{
 const {store,remote,change,writes}=await setup(t);const done=store.patch('deck','deck',{name:'Desired',deck_name:'Next'});change({name:'Desired'});await store.drain();assert.equal(store.phase,'pending');await store.drain();const ack=await done;
 assert.equal(ack.kind,'unified039-write-ack');assert.equal(remote.commits,1);assert.equal(remote.row.content.deck_name,'Next');assert.equal(writes().length,2);assert.notEqual(writes()[0].args.p_intent.request_id,writes()[1].args.p_intent.request_id);assert.equal(writes()[1].args.p_intent.changes[0].expected_entity_version,2);
});

test('recursive object key order does not turn an unchanged field into a collision',async t=>{
 const {store,remote,writes}=await setup(t,{name:'Original',main:[{source_id:1,count:1,metadata:{a:1,b:2}}],extra:[]});const done=store.patch('deck','deck',{main:[{source_id:1,count:2,metadata:{a:1,b:2}}]});remote.revision++;remote.row.content.main=[{metadata:{b:2,a:1},count:1,source_id:1}];await store.drain();assert.equal(store.phase,'pending');await store.drain();await done;assert.equal(remote.commits,1);assert.equal(writes().length,2);
});

test('object key order also recognizes an already-current desired nested value',async t=>{
 const {store,remote,change}=await setup(t);const done=store.patch('deck','deck',{main:[{source_id:1,count:2,metadata:{a:1,b:2}}]});change({main:[{metadata:{b:2,a:1},count:2,source_id:1}]});await store.drain();assert.equal((await done).alreadyCurrent,true);assert.equal(remote.commits,0);
});

test('array order remains significant and a real touched-field collision remains blocked',async t=>{
 const {store,remote,change}=await setup(t,{name:'Original',main:[{source_id:1,count:1},{source_id:2,count:1}],extra:[]});store.patch('deck','deck',{main:[{source_id:1,count:2},{source_id:2,count:1}]});change({main:[{source_id:2,count:1},{source_id:1,count:1}]});await store.drain();assert.equal(store.phase,'conflict');assert.equal(remote.commits,0);assert.equal(store.queue.length,1);
 const info=store.snapshot().writeState.conflict;assert.deepEqual(info.fields,[{field:'main',changedSinceBase:true,alreadyDesired:false}]);assert.equal(info.baselineVersion,1);assert.equal(info.currentVersion,2);assert.ok(!JSON.stringify(store.snapshot().writeState).includes(store.queue[0].requestId));assert.ok(!store.error.includes('다른 창'));assert.ok(!store.snapshot().status.includes('다른 기기'));
});

test('unknown timeout keeps the exact UUID and body even when the error message resembles CAS',async t=>{
 const {store,remote,change,writes}=await setup(t);store.patch('deck','deck',{name:'Desired'});remote.nextError={code:'57014',message:'unified039_conflict'};await store.drain();const original=clone(store.queue[0].body);change({name:'Desired'});remote.nextError={code:'57014',message:'unified039_conflict'};await store.drain();
 assert.equal(store.phase,'error');assert.equal(store.queue.length,1);assert.deepEqual(store.queue[0].body,original);assert.deepEqual(writes()[0].args.p_intent,writes()[1].args.p_intent);assert.equal(remote.calls.filter(call=>call.name==='poc_bootstrap039').length,1);
});

test('an untyped error is not certified CAS and cannot drop an already-desired request',async t=>{
 const {store,remote,change}=await setup(t);store.patch('deck','deck',{name:'Desired'});change({name:'Desired'});remote.nextError={message:'unified039_conflict'};await store.drain();assert.equal(store.phase,'error');assert.ok(store.queue[0].body);assert.equal(store.queue.length,1);
});

test('failed fresh read after certified CAS preserves the original body until its result can be checked',async t=>{
 const {store,remote,change,writes}=await setup(t);const done=store.patch('deck','deck',{name:'Desired'});change({name:'Desired'});remote.nextReadError={code:'57014',message:'statement timeout'};await store.drain();const original=clone(store.queue[0].body);assert.equal(store.phase,'error');await store.drain();assert.equal((await done).alreadyCurrent,true);assert.deepEqual(writes()[0].args.p_intent,original);assert.deepEqual(writes()[1].args.p_intent,original);assert.equal(remote.commits,0);
});

test('missing and empty values remain distinct while valid baseline equality permits a write',async t=>{
 const {store,remote,writes}=await setup(t,{name:'Original',main:[]});const done=store.patch('deck','deck',{extra:[]});remote.revision++;await store.drain();assert.equal(store.phase,'pending');await store.drain();assert.equal((await done).kind,'unified039-write-ack');assert.equal(remote.commits,1);assert.equal(writes().length,2);
});

test('JSON safety remains strict for unsafe keys, undefined and non-JSON class instances',async t=>{
 const {store}=await setup(t);for(const fields of [JSON.parse('{"constructor":{}}'),{name:undefined},{main:[new Date()]},{main:[new Map()]}])assert.throws(()=>store.patch('deck','deck',fields));assert.equal(store.queue.length,0);
});

test('a no-op copied predecessor advances only its own baseline fields for the next pending patch',async t=>{
 const {store,remote,change}=await setup(t);store.patch('deck','deck',{name:'Own first'});remote.holdCheck=true;const flight=store.drain();const next=store.patch('deck','deck',{name:'Own next'});change({name:'Own first'});remote.gates.shift()();await flight;assert.equal(store.phase,'pending');assert.equal(store.queue[0].baseContent.name,'Own first');await store.drain();assert.equal(store.phase,'pending');await store.drain();await next;assert.equal(remote.row.content.name,'Own next');assert.equal(store.phase,'ready');
});

test('a no-op predecessor does not conceal a real collision on an unrelated queued field',async t=>{
 const {store,remote,change}=await setup(t);store.patch('deck','deck',{name:'Own first'});remote.holdCheck=true;const flight=store.drain();store.patch('deck','deck',{main:[{source_id:1,count:1}]});change({name:'Own first',main:[{source_id:2,count:1}]});remote.gates.shift()();await flight;await store.drain();assert.equal(store.phase,'conflict');assert.deepEqual(remote.row.content.main,[{source_id:2,count:1}]);assert.equal(remote.commits,0);
});

test('a safely rebased successful predecessor does not conflict with its own next queued field edit',async t=>{
 const {store,remote,change}=await setup(t);store.patch('deck','deck',{name:'Own first'});remote.holdCheck=true;const flight=store.drain();const next=store.patch('deck','deck',{name:'Own next'});change({main:[{source_id:2,count:1}]});remote.gates.shift()();await flight;assert.equal(store.phase,'pending');await store.drain();assert.equal(remote.row.content.name,'Own first');
 await store.drain();assert.equal(store.phase,'pending','The current name came from our own preceding successful save.');await store.drain();await next;assert.equal(store.phase,'ready');assert.equal(remote.row.content.name,'Own next');assert.deepEqual(remote.row.content.main,[{source_id:2,count:1}]);
});

test('an ACK behind a newer snapshot cannot silently bless unrelated fields in the next queued edit',async t=>{
 const {store,remote,change}=await setup(t);store.patch('deck','deck',{name:'Own first'});remote.holdAck=true;const flight=store.drain();store.patch('deck','deck',{main:[{source_id:1,count:1}]});change({main:[{source_id:2,count:1}]});await store.refresh(true);remote.gates.shift()();await flight;
 assert.equal(store.queue[0].baseVersion,1,'Keep a CAS check for the newer unrelated snapshot.');await store.drain();assert.equal(store.phase,'conflict');assert.deepEqual(remote.row.content.main,[{source_id:2,count:1}]);assert.equal(remote.commits,1);
});
