import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
const clone=structuredClone,payload={catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}};
const text=JSON.stringify(payload),hash=createHash('sha256').update(text).digest('hex');
const row=(id='d')=>({entity_type:'deck',entity_id:id,version:1,content:{name:'원래 덱',deck_name:'원래 덱',main:[]},state:'saved',issues:[]});
function setup(t){
 const state={revision:1,rows:[row(),row('e')],canEdit:true,conditional:false,failRead:false,badRead:false,badAck:false,holdRead:null,holdWrite:null,calls:[],failWrite:false};
 const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:state.revision,unchanged:state.conditional,permissions:{can_edit:state.canEdit},...(!state.conditional?{authoring:{entities:clone(state.rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:state.revision,game_revision:state.revision,metadata_revision:String(state.revision),identity:IDENTITY039,payload_json:state.badRead?text+' ':text,source_fingerprint:hash}}:{})});
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  state.calls.push(clone({name,args}));
  if(name==='poc_bootstrap039'){if(state.holdRead)return state.holdRead;if(state.failRead)throw Error('합성 연결 오류');return {data:wire()};}
  if(state.holdWrite)return state.holdWrite;if(state.failWrite)throw Error('합성 통신 오류');
  const body=args.p_intent,revision=++state.revision,rows=body.changes.map(change=>{const current=state.rows.find(r=>r.entity_type===change.entity_type&&r.entity_id===change.entity_id);const next={...current,version:revision,content:{...current.content,...change.fields}};state.rows[state.rows.indexOf(current)]=next;return clone(next);});
  return {data:{schema:1,kind:'unified039-write-ack',request_id:body.request_id,applied_revision:revision,observed_project_revision:revision,game_source_fingerprint:hash,entities:state.badAck?[]:rows}};
 }};
 const values=new Map(),store=new AuthoringStore039({client,crypto:webcrypto,storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},events:{},pollMs:0,debounceMs:100000,idleRefreshMs:100000});t.after(()=>store.stop());return {store,state,wire};
}
const writes=state=>state.calls.filter(c=>c.name==='poc_apply_intent039');
function fakeTimers(t){const timers=[];t.mock.method(globalThis,'setTimeout',(fn,delay)=>{const timer={fn,delay,unref(){}};timers.push(timer);return timer;});return timers;}

test('confirmed read clocks and checking describe only verified current-account responses',async t=>{
 let now=1000;t.mock.method(Date,'now',()=>now);const {store,state}=setup(t);assert.deepEqual(store.snapshot().sync083,{checking:false,checkedAt:null,savedAt:null,readError:null});await store.start();assert.equal(store.snapshot().sync083.checkedAt,1000);
 let release;state.holdRead=new Promise(resolve=>release=resolve);const seen=[];store.subscribe(s=>seen.push(s.sync083));const refresh=store.refresh(true);assert.equal(seen.at(-1).checking,true);assert.equal(seen.at(-1).checkedAt,1000);
 now=2000;state.conditional=true;state.holdRead=null;release({data:{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:true,permissions:{can_edit:true}}});await refresh;
 assert.equal(seen.at(-1).checking,false);assert.equal(seen.at(-1).checkedAt,2000);assert.equal(seen.at(-1).savedAt,null);
 now=3000;state.conditional=false;state.badRead=true;await assert.rejects(store.refresh(true));assert.equal(store.snapshot().sync083.checkedAt,2000);assert.equal(store.snapshot().sync083.checking,false);assert.ok(store.snapshot().sync083.readError);assert.equal(store.snapshot().sync083.savedAt,null);
 now=4000;state.badRead=false;state.conditional=true;await store.refresh();assert.equal(store.snapshot().sync083.checkedAt,4000);assert.equal(store.snapshot().sync083.readError,null);
});
test('unchanged background polls update verified clock without full-snapshot emission, but permission changes still emit',async t=>{
 let now=1000;t.mock.method(Date,'now',()=>now);const {store,state}=setup(t);await store.start();let emissions=0;store.subscribe(()=>emissions++);emissions=0;state.conditional=true;
 now=2000;await store.refresh();assert.equal(emissions,0);assert.equal(store.snapshot().sync083.checkedAt,2000);
 now=3000;state.canEdit=false;await store.refresh();assert.equal(emissions,1);assert.equal(store.snapshot().canEdit,false);
 now=4000;await store.refresh(true);assert.equal(emissions,3);assert.equal(store.snapshot().sync083.checkedAt,4000);
});
test('explicit flush sends an existing manual queue without the typing debounce or a second request',async t=>{
 const timers=fakeTimers(t),{store,state}=setup(t);await store.start();const pending=store.patch('deck','d',{name:'수동 저장'});assert.equal(timers.at(-1).delay,100000);assert.equal(writes(state).length,0);
 store.flushPending083();assert.equal(timers.at(-1).delay,0);await timers.at(-1).fn();await pending;assert.equal(writes(state).length,1);assert.ok(store.snapshot().sync083.savedAt);assert.equal(store.queue.length,0);
 store.flushPending083();assert.equal(writes(state).length,1);
});
test('an unrelated update during an unchanged poll cannot leave subscribers stuck checking',async t=>{
 fakeTimers(t);const {store,state}=setup(t);await store.start();const seen=[];store.subscribe(s=>seen.push(s.sync083));seen.length=0;let release;state.holdRead=new Promise(resolve=>release=resolve);
 const checking=store.refresh();assert.equal(seen.length,0);store.patch('deck','d',{name:'폴링 도중 보관할 변경'});assert.equal(seen.at(-1).checking,true);
 state.holdRead=null;release({data:{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:true,permissions:{can_edit:true}}});await checking;
 assert.equal(seen.length,2);assert.equal(seen.at(-1).checking,false);assert.equal(store.queue.length,1);assert.equal(writes(state).length,0);
});
test('a directly observed checking snapshot also gets its unchanged completion notification',async t=>{
 const {store,state}=setup(t);await store.start();const seen=[];store.subscribe(s=>seen.push(s.sync083));seen.length=0;let release;state.holdRead=new Promise(resolve=>release=resolve);
 const checking=store.refresh();assert.equal(seen.length,0);assert.equal(store.snapshot().sync083.checking,true);
 state.holdRead=null;release({data:{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:true,permissions:{can_edit:true}}});await checking;
 assert.equal(seen.length,1);assert.equal(seen[0].checking,false);
});
test('flush preserves uncertain request UUID/body and retry backoff; rejected/conflicting requests remain stopped',async t=>{
 const timers=fakeTimers(t),{store,state}=setup(t);await store.start();state.failWrite=true;const pending=store.patch('deck','d',{name:'복구할 저장'});await store.drain();assert.equal(store.phase,'error');assert.equal(store.snapshot().sync083.savedAt,null);
 const frozen=clone(store.queue[0].body),requestId=store.queue[0].requestId;store.flushPending083();assert.ok(timers.at(-1).delay>0);assert.equal(writes(state).length,1);assert.deepEqual(store.queue[0].body,frozen);assert.equal(store.queue[0].requestId,requestId);
 state.failWrite=false;store.retryNotBefore=0;store.flushPending083();assert.equal(timers.at(-1).delay,0);await timers.at(-1).fn();await pending;assert.equal(writes(state).length,2);assert.deepEqual(writes(state)[1].args.p_intent,frozen);
 const next=store.patch('deck','e',{name:'대기'});store.phase='conflict';const count=timers.length;store.flushPending083();assert.equal(timers.length,count);store.phase='invalid';store.flushPending083();assert.equal(timers.length,count);void next;
});
test('an incomplete single ACK never marks saved or drops its idempotent request',async t=>{
 fakeTimers(t);const {store,state}=setup(t);await store.start();state.badAck=true;const pending=store.patch('deck','d',{name:'대상 확인'});await store.drain();assert.equal(store.phase,'error');assert.equal(store.queue.length,1);assert.equal(store.snapshot().sync083.savedAt,null);const body=clone(store.queue[0].body);
 state.badAck=false;await store.drain();await pending;assert.equal(store.queue.length,0);assert.ok(store.snapshot().sync083.savedAt);assert.deepEqual(writes(state)[1].args.p_intent,body);
});
test('complete atomic ACK advances saved clock; incomplete atomic ACK does not',async t=>{
 fakeTimers(t);const {store,state}=setup(t);await store.start();state.badAck=true;const pending=store.patchTogether068([{type:'deck',id:'d',fields:{deck_name:'첫 덱'}},{type:'deck',id:'e',fields:{deck_name:'둘째 덱'}}]);await store.drain();assert.equal(store.queue.length,1);assert.equal(store.snapshot().sync083.savedAt,null);const body=clone(store.queue[0].body);
 state.badAck=false;await store.drain();await pending;assert.equal(store.queue.length,0);assert.ok(store.snapshot().sync083.savedAt);assert.deepEqual(writes(state)[1].args.p_intent,body);
});
test('account switch resets clocks and an old in-flight ACK cannot stamp the new owner',async t=>{
 fakeTimers(t);let now=1000;t.mock.method(Date,'now',()=>now);const {store,state}=setup(t);await store.start();let release;state.holdWrite=new Promise(resolve=>release=resolve);store.patch('deck','d',{name:'이전 계정'});const drain=store.drain(),body=clone(store.queue[0].body);
 now=2000;await store.acceptSession({user:{id:'other'}});assert.equal(store.snapshot().sync083.checkedAt,2000);assert.equal(store.snapshot().sync083.savedAt,null);
 release({data:{schema:1,kind:'unified039-write-ack',request_id:body.request_id,applied_revision:2,observed_project_revision:2,entities:[{...row(),version:2}],game_source_fingerprint:hash}});await drain;assert.equal(store.snapshot().user.id,'other');assert.equal(store.snapshot().sync083.savedAt,null);assert.equal(store.queue.length,0);
});
