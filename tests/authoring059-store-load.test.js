import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
const copy=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const native={setTimeout,clearTimeout,setInterval,clearInterval,setImmediate,now:Date.now};
const settle=async()=>{await new Promise(native.setImmediate);await new Promise(native.setImmediate);};

class Clock059{
 constructor(){this.now=0;this.next=1;this.tasks=new Map();}
 install(){globalThis.setTimeout=(fn,ms=0)=>this.add(fn,ms,0);globalThis.setInterval=(fn,ms)=>this.add(fn,ms,ms);globalThis.clearTimeout=globalThis.clearInterval=handle=>this.tasks.delete(handle?.id??handle);Date.now=()=>this.now;}
 add(fn,ms,interval){const handle={id:this.next++,unref(){}};this.tasks.set(handle.id,{fn,due:this.now+Math.max(0,ms),interval,handle});return handle;}
 async advance(ms){const end=this.now+ms;let count=0;for(;;){const task=[...this.tasks.values()].filter(t=>t.due<=end).sort((a,b)=>a.due-b.due||a.handle.id-b.handle.id)[0];if(!task)break;assert.ok(++count<1000,'Unexpected timer loop');this.now=task.due;if(task.interval)task.due+=task.interval;else this.tasks.delete(task.handle.id);task.fn();await settle();}this.now=end;await settle();}
 restore(){Object.assign(globalThis,{setTimeout:native.setTimeout,clearTimeout:native.clearTimeout,setInterval:native.setInterval,clearInterval:native.clearInterval});Date.now=native.now;}
}

async function setup(t,{pollMs=0}={}){
 const clock=new Clock059();clock.install();
 const payload=JSON.stringify({catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
 const remote={revision:1,row:{entity_type:'deck',entity_id:'deck',version:1,content:{name:'Original',deck_name:'Original',main:[],extra:[]},state:'saved',issues:[]},calls:[],holdRead:false,holdWrite:false,gates:[],sqlTimeout:false,active:{read:0,write:0},max:{read:0,write:0}};
 const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:[copy(remote.row)]},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:remote.revision,metadata_revision:String(remote.revision),identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}});
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'editor-one'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  const kind=name==='poc_bootstrap039'?'read':'write',call={kind,at:clock.now,args:copy(args)};remote.calls.push(call);remote.active[kind]++;remote.max[kind]=Math.max(remote.max[kind],remote.active[kind]);const snapshot=kind==='read'?wire():null;
  try{
   let override;if((kind==='read'&&remote.holdRead)||(kind==='write'&&remote.holdWrite))override=await new Promise(resolve=>remote.gates.push({kind,resolve}));
   if(override)return override;
   if(kind==='read')return {data:snapshot};
   if(remote.sqlTimeout)return {error:{code:'57014',message:'canceling statement due to statement timeout'}};
   const body=args.p_intent,change=body.changes[0];assert.equal(body.expected_project_revision,remote.revision);assert.equal(change.expected_entity_version,remote.row.version);
   remote.row={...remote.row,version:remote.row.version+1,content:{...remote.row.content,...copy(change.fields)}};remote.revision++;
   return {data:{schema:1,kind:'unified039-write-ack',request_id:body.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,entities:[copy(remote.row)],game_revision:remote.revision,game_source_fingerprint:'0'.repeat(64)}};
  }finally{remote.active[kind]--;call.finishedAt=clock.now;}
 }};
 remote.release=(kind,result)=>{const index=remote.gates.findIndex(g=>g.kind===kind);assert.ok(index>=0,'Expected held '+kind);remote.gates.splice(index,1)[0].resolve(result);};
 const store=new AuthoringStore039({client,storage:null,events:{},crypto:webcrypto,pollMs});await store.start();
 t.after(async()=>{store.stop();for(const gate of remote.gates)gate.resolve();await settle();clock.restore();});
 return {store,remote,clock};
}

test('conditional reads and repeated polls share one in-flight bootstrap RPC',async t=>{
 const {store,remote,clock}=await setup(t,{pollMs:15000});remote.holdRead=true;
 const first=store.refresh(),second=store.refresh();await clock.advance(30000);
 assert.equal(remote.calls.filter(c=>c.kind==='read').length,2);assert.equal(remote.active.read,1);assert.equal(remote.max.read,1);
 remote.holdRead=false;remote.release('read');await Promise.all([first,second]);assert.equal(remote.active.read,0);
});

test('forced requests coalesce into one unconditional follow-up even when the conditional read fails',async t=>{
 const {store,remote}=await setup(t);remote.holdRead=true;
 const ordinary=store.refresh().then(()=>null,error=>error),forced=store.refresh(true),alsoForced=store.refresh(true);
 assert.equal(remote.active.read,1);remote.holdRead=false;remote.release('read',{error:{code:'57014',message:'statement timeout'}});
 assert.equal((await ordinary).code,'57014');await Promise.all([forced,alsoForced]);
 const reads=remote.calls.filter(c=>c.kind==='read');assert.equal(reads.length,3);assert.equal(reads[1].args.p_known_revision,1);assert.equal(reads[2].args.p_known_revision,null);assert.equal(remote.max.read,1);
});

test('an already forced in-flight bootstrap serves additional forced and ordinary callers',async t=>{
 const {store,remote}=await setup(t);remote.holdRead=true;
 const first=store.refresh(true),second=store.refresh(true),ordinary=store.refresh();
 remote.holdRead=false;remote.release('read');await Promise.all([first,second,ordinary]);
 assert.equal(remote.calls.filter(c=>c.kind==='read').length,2);assert.equal(remote.max.read,1);
});

test('account replacement ignores the prior read error and performs a fresh serialized bootstrap',async t=>{
 const {store,remote}=await setup(t);remote.holdRead=true;const old=store.refresh();
 const replacement=store.acceptSession({user:{id:'editor-two'}});
 assert.equal(store.user.id,'editor-two');assert.equal(store.bootstrap,null);assert.equal(store.phase,'loading');assert.equal(remote.active.read,1);
 remote.row.content.name='Second account snapshot';remote.holdRead=false;remote.release('read',{error:{message:'Old account request failed'}});
 await Promise.all([old,replacement]);
 assert.equal(store.user.id,'editor-two');assert.equal(store.getRow('deck','deck').content.name,'Second account snapshot');assert.equal(store.phase,'ready');assert.equal(store.error,null);assert.equal(remote.max.read,1);
 assert.equal(remote.calls.filter(c=>c.kind==='read').at(-1).args.p_known_revision,null);
});

test('a delayed prior-account successful snapshot cannot populate the replacement account',async t=>{
 const {store,remote}=await setup(t);remote.holdRead=true;const old=store.refresh(true),seen=[];
 const unsubscribe=store.subscribe(state=>seen.push({owner:state.user?.id,name:state.entities[0]?.content.name}));t.after(unsubscribe);
 const replacement=store.acceptSession({user:{id:'editor-two'}});remote.row.content.name='New owner';remote.holdRead=false;remote.release('read');await Promise.all([old,replacement]);
 assert.ok(!seen.some(state=>state.owner==='editor-two'&&state.name==='Original'));assert.equal(store.getRow('deck','deck').content.name,'New owner');assert.equal(remote.max.read,1);
});

test('editing after a timeout preserves the uncertain head backoff, UUID and exact body',async t=>{
 const {store,remote,clock}=await setup(t);remote.sqlTimeout=true;
 store.patch('deck','deck',{name:'Uncertain'});await clock.advance(400);assert.equal(store.phase,'error');const original=copy(store.queue[0].body);
 await clock.advance(100);store.patch('deck','deck',{deck_name:'Queued next edit'});await clock.advance(1899);
 assert.equal(remote.calls.filter(c=>c.kind==='write').length,1);assert.equal(store.queue.length,2);assert.deepEqual(store.queue[0].body,original);
 await clock.advance(1);const writes=remote.calls.filter(c=>c.kind==='write');assert.deepEqual(writes.map(call=>call.at),[400,2400]);assert.deepEqual(writes[0].args.p_intent,writes[1].args.p_intent);
 store.retry();await clock.advance(0);assert.equal(remote.calls.filter(c=>c.kind==='write').length,3);assert.deepEqual(remote.calls.at(-1).args.p_intent,original);assert.equal(remote.max.write,1);
});

test('an existing read does not delay a write and cannot overwrite its newer ACK',async t=>{
 const {store,remote,clock}=await setup(t);remote.holdRead=true;const old=store.refresh().then(()=>null,error=>error);
 const done=store.patch('deck','deck',{name:'Saved while reading'});await clock.advance(400);await done;
 assert.equal(remote.active.read,1);assert.equal(store.bootstrap.project_revision,2);assert.equal(store.queue.length,0);
 remote.holdRead=false;remote.release('read');assert.match((await old).message,/이전 DB 개정/);
 assert.equal(store.getRow('deck','deck').content.name,'Saved while reading');await store.refresh(true);assert.equal(store.fetchedRevision,2);assert.equal(remote.max.read,1);assert.equal(remote.max.write,1);
});

test('idle refresh and a simultaneous periodic refresh fetch the latest graph only once',async t=>{
 const {store,remote,clock}=await setup(t,{pollMs:15000});await clock.advance(14200);
 store.patch('deck','deck',{name:'Latest'});await clock.advance(400);assert.equal(store.pendingRevision,2);
 remote.holdRead=true;await clock.advance(400);await clock.advance(15000);
 const reads=remote.calls.filter(c=>c.kind==='read');assert.equal(reads.length,2);assert.equal(reads.at(-1).args.p_known_revision,1);assert.equal(remote.active.read,1);assert.equal(remote.max.read,1);
 const finished=store.refresh();remote.holdRead=false;remote.release('read');await finished;assert.equal(store.fetchedRevision,2);assert.equal(store.pendingRevision,null);
});

const unchanged059=revision=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:revision,unchanged:true,permissions:{can_edit:true},authoring:null,game:null});

test('an idle refresh absorbed by a pre-ACK unchanged read fetches the new graph afterward without polling',async t=>{
 const {store,remote,clock}=await setup(t);remote.holdRead=true;const old=store.refresh();
 const done=store.patch('deck','deck',{name:'New ACK'});await clock.advance(400);await done;assert.equal(store.pendingRevision,2);
 await clock.advance(400);assert.equal(remote.calls.filter(c=>c.kind==='read').length,2);
 remote.holdRead=false;remote.release('read',{data:unchanged059(1)});await old;assert.equal(store.fetchedRevision,1);assert.equal(store.pendingRevision,2);
 remote.holdRead=true;await clock.advance(400);assert.equal(remote.calls.filter(c=>c.kind==='read').length,3);
 const latest=store.refresh();remote.holdRead=false;remote.release('read');await latest;
 assert.equal(store.fetchedRevision,2);assert.equal(store.pendingRevision,null);assert.equal(store.getRow('deck','deck').content.name,'New ACK');assert.equal(remote.max.read,1);
 await clock.advance(2000);assert.equal(remote.calls.filter(c=>c.kind==='read').length,3);
});

test('a pre-ACK full snapshot rejected as obsolete also preserves the absorbed latest-graph read',async t=>{
 const {store,remote,clock}=await setup(t);remote.holdRead=true;const old=store.refresh().then(()=>null,error=>error);
 store.patch('deck','deck',{name:'Newest ACK'});await clock.advance(800);assert.equal(store.pendingRevision,2);
 remote.holdRead=false;remote.release('read');assert.equal((await old).code,'authoring039_stale_read');assert.equal(store.getRow('deck','deck').content.name,'Newest ACK');
 remote.holdRead=true;await clock.advance(400);assert.equal(remote.calls.filter(c=>c.kind==='read').length,3);
 const latest=store.refresh();remote.holdRead=false;remote.release('read');await latest;assert.equal(store.fetchedRevision,2);assert.equal(store.pendingRevision,null);assert.equal(remote.max.read,1);
 await clock.advance(2000);assert.equal(remote.calls.filter(c=>c.kind==='read').length,3);
});

test('failure of an absorbed read does not start a short automatic retry loop',async t=>{
 const {store,remote,clock}=await setup(t);remote.holdRead=true;const old=store.refresh().then(()=>null,error=>error);
 store.patch('deck','deck',{name:'Saved'});await clock.advance(800);remote.holdRead=false;remote.release('read',{error:{code:'57014',message:'statement timeout'}});assert.equal((await old).code,'57014');await settle();
 await clock.advance(10000);assert.equal(remote.calls.filter(c=>c.kind==='read').length,2);assert.equal(store.pendingRevision,2);assert.equal(store.queue.length,0);assert.equal(store.phase,'error');
 await store.retry();assert.equal(store.pendingRevision,null);assert.equal(store.fetchedRevision,2);assert.equal(remote.calls.filter(c=>c.kind==='write').length,1);
});

test('completing an absorbed read does not shorten an uncertain subsequent write backoff',async t=>{
 const {store,remote,clock}=await setup(t);remote.holdRead=true;const old=store.refresh();
 store.patch('deck','deck',{name:'First saved'});await clock.advance(500);remote.sqlTimeout=true;store.patch('deck','deck',{deck_name:'Next uncertain'});await clock.advance(400);
 assert.equal(store.phase,'error');const original=copy(store.queue[0].body);assert.equal(remote.calls.filter(c=>c.kind==='write').length,2);
 remote.holdRead=false;remote.release('read',{data:unchanged059(1)});await old;await clock.advance(1999);
 assert.equal(remote.calls.filter(c=>c.kind==='write').length,2);assert.equal(remote.calls.filter(c=>c.kind==='read').length,2);assert.deepEqual(store.queue[0].body,original);
 await clock.advance(1);const writes=remote.calls.filter(c=>c.kind==='write');assert.deepEqual(writes.map(call=>call.at),[400,900,2900]);assert.deepEqual(writes[1].args.p_intent,writes[2].args.p_intent);assert.equal(remote.max.read,1);assert.equal(remote.max.write,1);
});
