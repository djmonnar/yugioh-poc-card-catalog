import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
const copy=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const native={setTimeout,clearTimeout,setInterval,clearInterval,setImmediate,now:Date.now};
const settle=async()=>{await new Promise(native.setImmediate);await new Promise(native.setImmediate);};
// WebCrypto digests finish on their own schedule; wait for the store's read itself.
const idle=async store=>{while(store.refreshTask)await store.refreshTask.promise.catch(()=>{});await settle();};

class Clock171{
 constructor(){this.now=0;this.next=1;this.tasks=new Map();}
 install(){globalThis.setTimeout=(fn,ms=0)=>this.add(fn,ms,0);globalThis.setInterval=(fn,ms)=>this.add(fn,ms,ms);globalThis.clearTimeout=globalThis.clearInterval=handle=>this.tasks.delete(handle?.id??handle);Date.now=()=>this.now;}
 add(fn,ms,interval){const handle={id:this.next++,unref(){}};this.tasks.set(handle.id,{fn,due:this.now+Math.max(0,ms),interval,handle});return handle;}
 async advance(ms){const end=this.now+ms;for(let count=0;;){const task=[...this.tasks.values()].filter(t=>t.due<=end).sort((a,b)=>a.due-b.due||a.handle.id-b.handle.id)[0];if(!task)break;assert.ok(++count<1000,'Unexpected timer loop');this.now=task.due;if(task.interval)task.due+=task.interval;else this.tasks.delete(task.handle.id);task.fn();await settle();}this.now=end;await settle();}
 restore(){Object.assign(globalThis,{setTimeout:native.setTimeout,clearTimeout:native.clearTimeout,setInterval:native.setInterval,clearInterval:native.clearInterval});Date.now=native.now;}
}

class Page171{
 constructor(hidden=false){this.hidden=hidden;this.listeners=new Set();}
 addEventListener(type,fn){assert.equal(type,'visibilitychange');this.listeners.add(fn);}
 removeEventListener(type,fn){assert.equal(type,'visibilitychange');this.listeners.delete(fn);}
 show(){this.hidden=false;for(const fn of this.listeners)fn();}
 hide(){this.hidden=true;for(const fn of this.listeners)fn();}
}

async function setup(t,{hidden=false}={}){
 const clock=new Clock171();clock.install();
 const payload=JSON.stringify({catalog:[{source_id:7,identity_key:'7|card'}],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
 const remote={revision:1,reads:[],row:{entity_type:'deck',entity_id:'deck',version:1,content:{name:'Original',deck_name:'Original',main:[],extra:[]},state:'saved',issues:[]}};
 // Mirrors poc_bootstrap039: a matching p_known_revision answers without entities or game payload.
 const wire=known=>known===remote.revision
  ?{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:true,permissions:{can_edit:true},authoring:null,game:null}
  :{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:[copy(remote.row)]},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:remote.revision,metadata_revision:String(remote.revision),identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'editor-one'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  assert.equal(name,'poc_bootstrap039');remote.reads.push({at:clock.now,known:args.p_known_revision});return {data:wire(args.p_known_revision)};
 }};
 const page=new Page171(hidden),store=new AuthoringStore039({client,storage:null,events:{},visibility:page,crypto:webcrypto,pollMs:15000});await store.start();
 const emits=[];const unsubscribe=store.subscribe(state=>emits.push(state.phase));emits.length=0;
 t.after(async()=>{unsubscribe();store.stop();await settle();clock.restore();});
 return {store,remote,clock,page,emits};
}

test('a visible tab keeps the 15 second conditional poll and an unchanged answer emits nothing',async t=>{
 const {remote,clock,emits}=await setup(t);
 assert.deepEqual(remote.reads.map(r=>r.known),[null]);
 await clock.advance(45000);
 assert.deepEqual(remote.reads.map(r=>[r.at,r.known]),[[0,null],[15000,1],[30000,1],[45000,1]]);
 assert.deepEqual(emits,[]);
});

test('a hidden tab skips the poll and checks once immediately when shown again',async t=>{
 const {store,remote,clock,page}=await setup(t);
 page.hide();await clock.advance(60000);
 assert.equal(remote.reads.length,1,'no periodic read while hidden');
 remote.revision=2;remote.row={...remote.row,version:2,content:{...remote.row.content,name:'Changed elsewhere'}};
 clock.now+=5000;page.show();await idle(store);
 assert.deepEqual(remote.reads.slice(1).map(r=>[r.at,r.known]),[[65000,1]]);
 assert.equal(store.getRow('deck','deck').content.name,'Changed elsewhere');assert.equal(store.fetchedRevision,2);
 await clock.advance(10000);
 assert.deepEqual(remote.reads.slice(2).map(r=>[r.at,r.known]),[[75000,2]],'the regular interval continues');
});

test('a tab opened in the background waits until it is shown, and stop() removes the listener',async t=>{
 const {store,remote,clock,page}=await setup(t,{hidden:true});
 assert.equal(remote.reads.length,1,'the first load still happens');
 await clock.advance(30000);assert.equal(remote.reads.length,1);
 page.hide();await settle();assert.equal(remote.reads.length,1,'hiding never reads');
 page.show();await idle(store);assert.equal(remote.reads.length,2);
 store.stop();assert.equal(page.listeners.size,0);page.show();await settle();assert.equal(remote.reads.length,2);
});

test('a pending edit still blocks the visibility check like the periodic poll',async t=>{
 const {store,remote,clock,page}=await setup(t);
 store.debounceMs=100000;store.patch('deck','deck',{name:'Unsaved'});
 page.hide();page.show();await settle();await clock.advance(15000);
 assert.equal(remote.reads.length,1);
});

test('snapshots share one payload copy and never expose the store state',async t=>{
 const {store}=await setup(t);
 const first=store.snapshot();
 assert.equal(first.gamePayload,first.bootstrap.gamePayload);
 assert.deepEqual(first.gamePayload,store.bootstrap.gamePayload);
 assert.notEqual(first.gamePayload,store.bootstrap.gamePayload);
 first.gamePayload.catalog.push({source_id:8});first.bootstrap.authoring.entities.length=0;
 const second=store.snapshot();
 assert.equal(second.gamePayload.catalog.length,1);assert.equal(store.bootstrap.gamePayload.catalog.length,1);assert.equal(second.bootstrap.authoring.entities.length,1);
});
