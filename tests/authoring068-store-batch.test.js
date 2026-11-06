import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
const clone=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const gameText=JSON.stringify({catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
const row=(type,id,content,version=1)=>({entity_type:type,entity_id:id,content:clone(content),version,state:'saved',issues:[]});
const initial=()=>[row('deck','deck',{name:'Original',deck_name:'Original',main:[],extra:[],banlist_enabled:false}),row('chapter_role','1:battle',{chapter:1,role:'battle',lp_bonus:0,entries:[]}),row('chapter_role','2:elite',{chapter:2,role:'elite',lp_bonus:0,entries:[]})];
const entry=id=>({entry_id:id,deck_id:'deck',weight:1,encounter:{name:id,skills:[]}});
const changes=()=>[{type:'chapter_role',id:'2:elite',fields:{entries:[entry('e2')]}},{type:'deck',id:'deck',fields:{name:'Changed',deck_name:'Changed'}},{type:'chapter_role',id:'1:battle',fields:{entries:[entry('e1')]}}];
class Storage{constructor(){this.values=new Map();this.fail=false;}getItem(key){return this.values.get(key)??null;}setItem(key,value){if(this.fail)throw Error('quota');this.values.set(key,String(value));}}
async function setup(t,{storage=new Storage(),existing=null}={}){
 const remote=existing??{revision:1,rows:initial(),calls:[],requests:new Map(),commits:0,nextError:null,user:'owner',hold:null};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:remote.user}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  remote.calls.push({name,args:clone(args),user:remote.user});
  if(name==='poc_bootstrap039')return {data:{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},capabilities:{entities:{deck:{operations:['create','patch'],fields:{}},chapter_role:{operations:['patch'],fields:{}}},trait_form:{kinds:[{kind:'heal_once',compiled:true,fields:{value:{type:'integer',min:100,max:8000}}}]}},authoring:{entities:clone(remote.rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:remote.revision,metadata_revision:String(remote.revision),identity:IDENTITY039,payload_json:gameText,source_fingerprint:hash(gameText)}}};
  if(remote.hold){const hold=remote.hold;remote.hold=null;await hold;}
  if(remote.nextError){const error=remote.nextError;remote.nextError=null;return {error};}
  const intent=args.p_intent;if(remote.requests.has(intent.request_id))return {data:{...clone(remote.requests.get(intent.request_id)),replayed:true}};
  if(intent.expected_project_revision!==remote.revision)return {error:{code:'P0001',message:'unified039_conflict'}};
  // Validate every CAS before preparing any mutation, as the actual transaction does.
  for(const change of intent.changes){const old=remote.rows.find(x=>x.entity_type===change.entity_type&&x.entity_id===change.entity_id);if((old?.version??0)!==change.expected_entity_version||change.operation==='create'&&old)return {error:{code:'P0001',message:'unified039_conflict'}};}
  const revision=remote.revision+1,next=clone(remote.rows),ackRows=[];
  for(const change of intent.changes){const index=next.findIndex(x=>x.entity_type===change.entity_type&&x.entity_id===change.entity_id),old=next[index],updated=row(change.entity_type,change.entity_id,{...(old?.content??{}),...clone(change.fields)},revision);if(index<0)next.push(updated);else next[index]=updated;ackRows.push(clone(updated));}
  remote.rows=next;remote.revision=revision;remote.commits++;
  const ack={schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:revision,observed_project_revision:revision,entities:ackRows,game_source_fingerprint:hash(gameText),issues:[]};remote.requests.set(intent.request_id,clone(ack));return {data:ack};
 }};
 const store=new AuthoringStore039({client,storage,crypto:webcrypto,events:{},debounceMs:100000,idleRefreshMs:100000,pollMs:0});await store.start();t.after(()=>store.stop());
 const writes=()=>remote.calls.filter(call=>call.name==='poc_apply_intent039');
 const edit=(type,id,fields)=>{remote.revision++;const r=remote.rows.find(x=>x.entity_type===type&&x.entity_id===id);r.version=remote.revision;Object.assign(r.content,clone(fields));};
 return {store,remote,storage,client,writes,edit};
}

test('one durable item sends deck first and every selected role in one atomic request and ACK',async t=>{
 const m=await setup(t),done=m.store.patchTogether068(changes());
 assert.equal(m.store.queue.length,1);assert.equal(m.store.snapshot().writeState.changes.length,3);assert.equal(m.store.snapshot().entities[0].content.name,'Changed');assert.equal(m.store.bootstrap.authoring.entities[0].content.name,'Original');
 const durable=JSON.parse(m.storage.getItem(m.store.outboxKey()));assert.equal(durable.schema,1);assert.equal(durable.items.length,1);assert.equal(durable.items[0].changes.length,3);assert.equal(JSON.stringify(durable).includes('payload_json'),false);
 await m.store.drain();const ack=await done;assert.equal(m.writes().length,1);assert.equal(m.remote.commits,1);assert.equal(ack.entities.length,3);assert.deepEqual(m.writes()[0].args.p_intent.changes.map(x=>[x.entity_type,x.entity_id]),[['deck','deck'],['chapter_role','1:battle'],['chapter_role','2:elite']]);assert.equal(m.store.queue.length,0);
});
test('a new deck and its dependent role are submitted together with zero create CAS and deck first',async t=>{
 const m=await setup(t),input=[{type:'chapter_role',id:'1:battle',fields:{entries:[{...entry('new'),deck_id:'new-deck'}]}},{type:'deck',id:'new-deck',operation:'create',fields:{name:'New',deck_name:'New',main:[],extra:[]}}],done=m.store.patchTogether068(input);
 await m.store.drain();await done;const body=m.writes()[0].args.p_intent;assert.equal(body.changes[0].entity_id,'new-deck');assert.equal(body.changes[0].expected_entity_version,0);assert.equal(m.remote.commits,1);
});
test('all local preflight and field CAS checks complete synchronously before any queue or durable mutation',async t=>{
 const m=await setup(t),before=JSON.stringify([...m.storage.values]);const invalid=changes();invalid[0].fields.entries[0].encounter.skills=[{kind:'invalid'}];assert.throws(()=>m.store.patchTogether068(invalid));
 assert.throws(()=>m.store.patchTogether068([changes()[1],changes()[1]]));assert.throws(()=>m.store.patchTogether068([{type:'character',id:'x',operation:'create',fields:{name:'x'}}]));assert.throws(()=>m.store.patchTogether068([{...changes()[1],baseVersion:1,baseContent:{name:'wrong',deck_name:'wrong'}}]));
 assert.equal(m.store.queue.length,0);assert.equal(m.writes().length,0);assert.equal(JSON.stringify([...m.storage.values]),before);
});
test('an accepted batch with a lost ACK retries the exact same complete body and commits once',async t=>{
 const m=await setup(t),actual=m.client.rpc;let lost=true;m.client.rpc=async(name,args)=>{const result=await actual(name,args);if(name==='poc_apply_intent039'&&lost){lost=false;throw Error('lost response');}return result;};
 const done=m.store.patchTogether068(changes());await m.store.drain();assert.equal(m.remote.commits,1);assert.equal(m.store.phase,'error');const frozen=clone(m.store.queue[0].body);assert.equal(frozen.changes.length,3);await m.store.drain();await done;
 assert.equal(m.remote.commits,1);assert.deepEqual(m.writes()[0].args.p_intent,m.writes()[1].args.p_intent);assert.deepEqual(m.writes()[1].args.p_intent,frozen);
});
test('reload restores the complete frozen request and replays it without a second commit',async t=>{
 const m=await setup(t),actual=m.client.rpc;let lost=true;m.client.rpc=async(name,args)=>{const result=await actual(name,args);if(name==='poc_apply_intent039'&&lost){lost=false;throw Error('lost');}return result;};m.store.patchTogether068(changes());await m.store.drain();const frozen=clone(m.store.queue[0].body);m.store.stop();
 const restored=await setup(t,{storage:m.storage,existing:m.remote});assert.equal(restored.store.queue[0].changes.length,3);await restored.store.drain();assert.equal(m.remote.commits,1);assert.deepEqual(restored.writes().at(-1).args.p_intent,frozen);assert.equal(restored.store.queue.length,0);
});
test('a partial ACK cannot clear a queue prefix or update any canonical item',async t=>{
 const m=await setup(t),actual=m.client.rpc;let partial=true;m.client.rpc=async(name,args)=>{const result=await actual(name,args);if(name==='poc_apply_intent039'&&partial){partial=false;result.data.entities=result.data.entities.slice(0,1);}return result;};
 const done=m.store.patchTogether068(changes());await m.store.drain();assert.equal(m.store.queue.length,1);assert.equal(m.store.queue[0].changes.length,3);assert.equal(m.store.bootstrap.authoring.entities[0].content.name,'Original');assert.equal(m.store.phase,'error');await m.store.drain();await done;assert.equal(m.remote.commits,1);
});
test('a complete authoritative ACK accepts normalized deck metadata without retrying a committed batch',async t=>{
 const m=await setup(t),actual=m.client.rpc;m.client.rpc=async(name,args)=>{const result=await actual(name,args);if(name==='poc_apply_intent039'){const deck=result.data.entities.find(row=>row.entity_type==='deck');deck.content.name=deck.content.deck_name;m.remote.rows.find(row=>row.entity_type==='deck').content.name=deck.content.name;m.remote.requests.set(args.p_intent.request_id,clone(result.data));}return result;};
 const input=changes();input[1].fields.name='Legacy opponent label';const done=m.store.patchTogether068(input);await m.store.drain();const ack=await done;assert.equal(ack.entities.find(row=>row.entity_type==='deck').content.name,'Changed');assert.equal(m.store.bootstrap.authoring.entities[0].content.name,'Changed');assert.equal(m.remote.commits,1);assert.equal(m.writes().length,1);assert.equal(m.store.queue.length,0);
});
test('typed rejection keeps every change, refuses single recovery and durably releases only the complete batch',async t=>{
 const m=await setup(t);m.remote.nextError={code:'P0001',message:'unified039_validation',details:JSON.stringify({reason:'unified039_invalid_encounter_settings'})};const done=m.store.patchTogether068(changes());await m.store.drain();
 assert.equal(m.store.phase,'invalid');assert.equal(m.remote.commits,0);assert.equal(m.store.getRejectedBatch068().changes.length,3);assert.throws(()=>m.store.getRejected065());assert.throws(()=>m.store.releaseRejected065({type:'deck',id:'deck'}));assert.throws(()=>m.store.releaseRejectedBatch068({batchId:'different'}));
 const rejected=m.store.getRejectedBatch068();m.storage.fail=true;assert.throws(()=>m.store.releaseRejectedBatch068(rejected));assert.equal(m.store.queue.length,1);m.storage.fail=false;m.store.releaseRejectedBatch068(rejected);assert.equal((await done).discarded,true);assert.equal(m.store.queue.length,0);
});
test('one conflicting role stops the whole batch until explicit whole-batch conflict resolution',async t=>{
 const m=await setup(t),done=m.store.patchTogether068(changes());m.edit('chapter_role','1:battle',{entries:[entry('remote')]});await m.store.drain();assert.equal(m.store.phase,'conflict');assert.equal(m.remote.commits,0);assert.equal(m.store.queue[0].changes.length,3);assert.equal(m.remote.rows[0].content.name,'Original');
 m.store.resolveConflict('retry');await m.store.drain();await done;assert.equal(m.remote.commits,1);assert.equal(m.remote.rows[0].content.name,'Changed');assert.equal(m.remote.rows[1].content.entries[0].entry_id,'e1');
});
test('remote conflict resolution discards the whole batch and returns every caller record to its draft path',async t=>{
 const m=await setup(t),done=m.store.patchTogether068(changes());m.edit('chapter_role','1:battle',{entries:[entry('remote')]});await m.store.drain();m.store.resolveConflict('remote');assert.equal((await done).discarded,true);assert.equal(m.store.queue.length,0);assert.equal(m.remote.commits,0);assert.equal(m.writes().length,1);
});
test('unrelated remote fields rebase all member CAS versions after a definite conflict without dropping desired members',async t=>{
 const m=await setup(t),done=m.store.patchTogether068(changes());m.edit('chapter_role','1:battle',{lp_bonus:900});await m.store.drain();assert.equal(m.store.phase,'pending');assert.equal(m.remote.commits,0);await m.store.drain();await done;
 const calls=m.writes();assert.notEqual(calls[0].args.p_intent.request_id,calls[1].args.p_intent.request_id);assert.equal(calls[1].args.p_intent.changes.length,3);assert.equal(m.remote.rows[1].content.lp_bonus,900);assert.equal(m.remote.commits,1);
});
test('already-current certificate is possible only when all selected desired fields are current',async t=>{
 const m=await setup(t),done=m.store.patchTogether068(changes());for(const change of changes())m.edit(change.type,change.id,change.fields);await m.store.drain();const result=await done;assert.equal(result.kind,'already-current-batch');assert.equal(result.entities.length,3);assert.equal(m.remote.commits,0);assert.equal(m.writes().length,1);
});
test('some desired members do not become a separately cleared prefix',async t=>{
 const m=await setup(t),done=m.store.patchTogether068(changes());m.edit('deck','deck',changes()[1].fields);await m.store.drain();assert.equal(m.store.queue[0].changes.length,3);await m.store.drain();await done;assert.equal(m.writes().at(-1).args.p_intent.changes.length,3);assert.equal(m.remote.commits,1);
});
test('durable storage is required both before enqueue and before sending a request body',async t=>{
 const m=await setup(t);m.storage.fail=true;assert.throws(()=>m.store.patchTogether068(changes()));assert.equal(m.store.queue.length,0);m.storage.fail=false;m.store.patchTogether068(changes());m.storage.fail=true;await m.store.drain();assert.equal(m.writes().length,0);assert.equal(m.store.queue.length,1);assert.equal(m.store.phase,'error');
});
test('failure to durably clear an accepted batch keeps its idempotent body until the entire ACK can settle',async t=>{
 const m=await setup(t),actual=m.client.rpc;m.client.rpc=async(name,args)=>{const result=await actual(name,args);if(name==='poc_apply_intent039')m.storage.fail=true;return result;};const done=m.store.patchTogether068(changes());await m.store.drain();assert.equal(m.remote.commits,1);assert.equal(m.store.queue.length,1);assert.equal(m.store.bootstrap.authoring.entities[0].content.name,'Original');
 m.storage.fail=false;m.client.rpc=actual;await m.store.drain();await done;assert.equal(m.remote.commits,1);assert.equal(m.store.queue.length,0);
});
test('account switch before transmission never sends the previous owner batch',async t=>{
 const m=await setup(t);m.store.patchTogether068(changes());m.remote.user='other';await m.store.acceptSession({user:{id:'other'}});await m.store.drain();assert.equal(m.writes().length,0);assert.equal(m.store.queue.length,0);assert.equal(JSON.parse(m.storage.getItem('poc-authoring039-outbox:owner')).items[0].changes.length,3);
});
test('account switch during a request cannot consume its ACK for the new owner',async t=>{
 const m=await setup(t);let release;m.remote.hold=new Promise(resolve=>release=resolve);m.store.patchTogether068(changes());const flight=m.store.drain();await new Promise(resolve=>setImmediate(resolve));m.remote.user='other';await m.store.acceptSession({user:{id:'other'}});release();await flight;
 assert.equal(m.store.user.id,'other');assert.equal(m.store.bootstrap.authoring.entities[0].content.name,'Original');assert.equal(m.store.queue.length,0);assert.equal(m.writes().length,1);assert.equal(JSON.parse(m.storage.getItem('poc-authoring039-outbox:owner')).items[0].changes.length,3);
});
test('an old owner completion cannot clear a new owner in-flight busy guard or start a duplicate request',async t=>{
 for(const firstKind of ['batch','legacy']){
  const m=await setup(t);let releaseA,releaseB;m.remote.hold=new Promise(resolve=>releaseA=resolve);if(firstKind==='batch')m.store.patchTogether068(changes());else m.store.patch('deck','deck',{name:'From A'});const flightA=m.store.drain();await new Promise(resolve=>setImmediate(resolve));
  m.remote.user='other';await m.store.acceptSession({user:{id:'other'}});m.remote.hold=new Promise(resolve=>releaseB=resolve);const doneB=m.store.patchTogether068([{type:'deck',id:'deck',fields:{banlist_enabled:true}}]),flightB=m.store.drain();await new Promise(resolve=>setImmediate(resolve));assert.equal(m.store.busy,true);assert.equal(m.writes().length,2);
  releaseA();await flightA;assert.equal(m.store.busy,true);await m.store.drain();assert.equal(m.writes().length,2);assert.equal(m.store.queue[0].owner068,'other');releaseB();await flightB;if(m.store.queue.length)await m.store.drain();await doneB;assert.equal(m.remote.rows[0].content.banlist_enabled,true);assert.equal(m.store.queue.length,0);
 }
});
test('later single-item edits retain their field CAS and follow the complete batch ACK',async t=>{
 const m=await setup(t);let release;m.remote.hold=new Promise(resolve=>release=resolve);const first=m.store.patchTogether068(changes()),flight=m.store.drain();await new Promise(resolve=>setImmediate(resolve));const later=m.store.patch('deck','deck',{banlist_enabled:true});release();await flight;await first;await m.store.drain();await later;
 assert.equal(m.remote.commits,2);assert.equal(m.remote.rows[0].content.name,'Changed');assert.equal(m.remote.rows[0].content.banlist_enabled,true);assert.equal(m.writes()[1].args.p_intent.changes[0].expected_entity_version,2);
});
test('tampered or foreign-owner restored batches preserve the raw outbox without sending any member',async t=>{
 const m=await setup(t);m.store.patchTogether068(changes());m.store.stop();const raw=JSON.parse(m.storage.getItem(m.store.outboxKey()));raw.items[0].owner068='other';m.storage.setItem(m.store.outboxKey(),JSON.stringify(raw));const restored=await setup(t,{storage:m.storage,existing:m.remote});assert.equal(restored.store.queue.length,0);assert.equal(restored.writes().length,0);assert.match(restored.store.error,/원본/);assert.throws(()=>restored.store.patchTogether068(changes()));assert.equal(m.storage.getItem(m.store.outboxKey()),JSON.stringify(raw));
});
test('a later legacy patch can wait behind a rejected batch without crashing or releasing any batch member',async t=>{
 const m=await setup(t);m.remote.nextError={code:'P0001',message:'unified039_validation'};const batch=m.store.patchTogether068(changes());await m.store.drain();let later;assert.doesNotThrow(()=>later=m.store.patch('deck','deck',{banlist_enabled:true}));assert.equal(m.store.queue.length,2);assert.equal(m.store.phase,'invalid');assert.equal(m.store.queue[0].changes.length,3);
 m.store.releaseRejectedBatch068(m.store.getRejectedBatch068());assert.equal((await batch).discarded,true);await m.store.drain();await later;assert.equal(m.remote.commits,1);assert.equal(m.remote.rows[0].content.name,'Original');assert.equal(m.remote.rows[0].content.banlist_enabled,true);
});
test('incomplete persisted request pairs never mint a fresh request after reload',async t=>{
 for(const missing of ['body','requestId']){
  const m=await setup(t);m.remote.nextError={code:'57014',message:'statement timeout'};m.store.patchTogether068(changes());await m.store.drain();m.store.stop();const durable=JSON.parse(m.storage.getItem(m.store.outboxKey()));delete durable.items[0][missing];m.storage.setItem(m.store.outboxKey(),JSON.stringify(durable));const before=m.writes().length,restored=await setup(t,{storage:m.storage,existing:m.remote});await restored.store.drain();assert.equal(restored.writes().length,before);assert.equal(restored.store.queue.length,0);assert.match(restored.store.error,/원본/);
 }
});
test('093 two chapter save timeout keeps the same full UUID through reload and commits once after recovery',async t=>{
 const m=await setup(t),input=[{type:'chapter_role',id:'1:battle',fields:{entries:[entry('chapter-one')]}},{type:'chapter_role',id:'2:elite',fields:{entries:[entry('chapter-two')]}}];
 m.remote.nextError={code:'57014',message:'canceling statement due to statement timeout'};m.store.patchTogether068(input);await m.store.drain();
 assert.equal(m.store.phase,'error');assert.equal(m.remote.commits,0);assert.equal(m.store.snapshot().pending,1);assert.equal(m.store.snapshot().writeState.uncertain,true);assert.match(m.store.snapshot().error,/같은 요청/);const frozen=clone(m.store.queue[0].body);assert.equal(frozen.changes.length,2);assert.equal(m.store.bootstrap.authoring.entities[1].content.entries.length,0);m.store.stop();
 const restored=await setup(t,{storage:m.storage,existing:m.remote});assert.deepEqual(restored.store.queue[0].body,frozen);await restored.store.drain();assert.equal(restored.store.phase,'ready');assert.equal(m.remote.commits,1);assert.deepEqual(restored.writes().at(-1).args.p_intent,frozen);assert.equal(restored.store.queue.length,0);assert.equal(m.remote.rows[1].content.entries[0].entry_id,'chapter-one');assert.equal(m.remote.rows[2].content.entries[0].entry_id,'chapter-two');
});
test('a confirmed rejection remains paused even when its durable rejection receipt cannot be written',async t=>{
 const m=await setup(t),actual=m.client.rpc;m.client.rpc=async(name,args)=>{if(name==='poc_apply_intent039'){m.storage.fail=true;return {error:{code:'P0001',message:'unified039_validation'}};}return actual(name,args);};m.store.patchTogether068(changes());await m.store.drain();assert.equal(m.store.phase,'invalid');assert.equal(m.store.queue[0].changes.length,3);assert.equal(m.store.snapshot().writeState.rejected,true);assert.equal(m.store.snapshot().writeState.validation.batch068,true);assert.ok(m.store.snapshot().writeState.validation.fields.includes('entries'));await m.store.drain();assert.equal(m.remote.commits,0);
});
