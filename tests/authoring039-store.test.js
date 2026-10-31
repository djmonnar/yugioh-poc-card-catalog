import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,normalizeBootstrap039,PROJECT039,IDENTITY039,LEGACY_CREATION_KEYS039} from '../authoring039-store.js';
const clone=structuredClone,hash=v=>createHash('sha256').update(v).digest('hex');
const payload={catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}};
function wire(rows=[],revision=1){const text=JSON.stringify(payload);return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:clone(rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:revision,game_revision:revision,metadata_revision:String(revision),identity:IDENTITY039,source_fingerprint:hash(text),payload_json:text}};}
const row=(id='deck',version=1,content={name:'원래 덱',main:[]})=>({entity_type:'deck',entity_id:id,version,content:clone(content),state:'draft',issues:['20장 필요']});
class Storage {constructor(values={}){this.values=new Map(Object.entries(values));}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}}
function remote({rows=[row()],canEdit=true}={}){
 const state={rows:clone(rows),revision:1,calls:[],requests:new Map(),once:null,canEdit};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'editor',email:'editor@example.test'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},rpc:async(name,args)=>{
  state.calls.push(clone({name,args}));
  if(name==='poc_bootstrap039'){const data=wire(state.rows,state.revision);data.permissions.can_edit=state.canEdit;return {data};}
  if(state.once){const once=state.once;state.once=null;return once(name,args);}
  const body=args.p_intent;if(state.requests.has(body.request_id))return {data:{...clone(state.requests.get(body.request_id)),replayed:true}};
  if(body.expected_project_revision!==state.revision)return {error:{code:'P0001',message:'unified039_conflict'}};
  const change=body.changes[0],i=state.rows.findIndex(r=>r.entity_type===change.entity_type&&r.entity_id===change.entity_id),old=state.rows[i];
  if((old?.version??0)!==change.expected_entity_version)return {error:{code:'P0001',message:'unified039_conflict'}};
  const next={entity_type:change.entity_type,entity_id:change.entity_id,version:(old?.version??0)+1,content:{...(old?.content??{}),...clone(change.fields)},state:'draft',issues:[]};
  if(change.operation==='delete'){state.rows.splice(i,1);next.deleted=true;}else if(i<0)state.rows.push(next);else state.rows[i]=next;
  state.revision++;const ack={schema:1,kind:'unified039-write-ack',request_id:body.request_id,applied_revision:state.revision,observed_project_revision:state.revision,replayed:false,entities:[clone(next)],game_revision:state.revision,game_source_fingerprint:'0'.repeat(64),state:'saved'};state.requests.set(body.request_id,ack);return {data:clone(ack)};
 }};return {state,client};
}
async function setup(options={}){const r=remote(options),storage=options.storage??new Storage(),store=new AuthoringStore039({client:r.client,storage,crypto:webcrypto,pollMs:0,debounceMs:100000,idleRefreshMs:options.idleRefreshMs??400,events:{}});await store.start();return {...r,storage,store};}
test('verifies exact UTF8 payload, immutable native identities and complete section set',async()=>{
 const w=wire();assert.equal((await normalizeBootstrap039(w,webcrypto)).game.catalog.length,0);
 for(const mutate of [v=>v.game.payload_json+=' ',v=>v.game.identity={...IDENTITY039,native_manifest_sha256:'0'.repeat(64)},v=>v.game.authoring_revision=99,v=>v.authoring.entities=[row(),row()]]){const bad=clone(w);mutate(bad);await assert.rejects(normalizeBootstrap039(bad,webcrypto));}
 const bad=wire();bad.game.payload_json='{"catalog":[]}';bad.game.source_fingerprint=hash(bad.game.payload_json);await assert.rejects(normalizeBootstrap039(bad,webcrypto));
});
test('saves incomplete drafts and coalesces typing without making local data authoritative',async t=>{
 const {state,store,storage}=await setup();t.after(()=>store.stop());
 const a=store.patch('deck','deck',{name:''}),b=store.patch('deck','deck',{main:[]});assert.equal(store.snapshot().pending,1);assert.equal(store.snapshot().entities[0].content.name,'');assert.equal(store.snapshot().bootstrap.authoring.entities[0].content.name,'원래 덱');
 await store.drain();await Promise.all([a,b]);assert.equal(state.revision,2);assert.equal(store.snapshot().pending,0);assert.equal(state.rows[0].content.name,'');assert.ok(!JSON.stringify([...storage.values]).includes('payload_json'));
});
test('uncertain network retry reuses identical UUID and exact intent after server accepted it',async t=>{
 const {state,client,store}=await setup();t.after(()=>store.stop());const actual=client.rpc;let lost=true;
 client.rpc=async(name,args)=>{const result=await actual(name,args);if(name==='poc_apply_intent039'&&lost){lost=false;throw new TypeError('connection lost');}return result;};
 const done=store.patch('deck','deck',{name:'새 이름'});await store.drain();assert.equal(state.revision,2);assert.equal(store.snapshot().pending,1);const body=clone(store.queue[0].body);await store.drain();await done;assert.equal(state.revision,2);const calls=state.calls.filter(c=>c.name==='poc_apply_intent039');assert.deepEqual(calls[0].args.p_intent,calls[1].args.p_intent);assert.deepEqual(calls[1].args.p_intent,body);
});
test('unrelated remote edit safely rebases; same-field conflict keeps input until explicit resolution',async t=>{
 const {state,store}=await setup({rows:[row(),row('other')]});t.after(()=>store.stop());let done=store.patch('deck','deck',{name:'내 수정'});state.rows[1].version++;state.revision++;await store.drain();assert.equal(store.phase,'pending');await store.drain();await done;assert.equal(state.rows[0].content.name,'내 수정');
 done=store.patch('deck','deck',{name:'충돌 입력'});state.rows[0].content.name='다른 수정';state.rows[0].version++;state.revision++;await store.drain();assert.equal(store.phase,'conflict');assert.equal(store.snapshot().entities[0].content.name,'충돌 입력');assert.equal(state.rows[0].content.name,'다른 수정');store.resolveConflict('retry');await store.drain();await done;assert.equal(state.rows[0].content.name,'충돌 입력');
});
test('queued edits during an in-flight request keep server versions and preserve both fields',async t=>{
 const {store,client,state}=await setup();t.after(()=>store.stop());const actual=client.rpc;let release,first=true;
 client.rpc=async(name,args)=>{if(name==='poc_apply_intent039'&&first){first=false;await new Promise(r=>release=r);}return actual(name,args);};
 const a=store.patch('deck','deck',{name:'이름'}),flight=store.drain();await new Promise(r=>setImmediate(r));const b=store.patch('deck','deck',{main:[{source_id:0,count:1}]});release();await flight;await store.drain();await Promise.all([a,b]);assert.equal(state.rows[0].version,3);assert.equal(state.rows[0].content.name,'이름');assert.equal(state.rows[0].content.main[0].source_id,0);
});
test('reload recovers only unfinished typed write and uses database baseline',async t=>{
 const storage=new Storage(),first=await setup({storage});first.store.patch('deck','deck',{name:'복구'});first.store.stop();const second=await setup({storage});t.after(()=>second.store.stop());assert.equal(second.store.snapshot().entities[0].content.name,'복구');assert.equal(second.store.snapshot().bootstrap.authoring.entities[0].content.name,'원래 덱');await second.store.drain();assert.equal(second.state.rows[0].content.name,'복구');
});
test('legacy recovery never reads auth/session/player keys and leaves originals intact',async t=>{
 const storage=new Storage({'poc-ai-decks-v1':'{"draft":[]}', 'poc-ai-editor-auth-v1':'PRIVATE_AUTH','yugioh-classic-roguelite-v1':'PLAYER_SAVE'}),{store,state}=await setup({storage});t.after(()=>store.stop());assert.equal(store.queue.length,1);assert.equal(store.queue[0].type,'recovery_archive');assert.equal(store.queue[0].fields.raw_json,'{"draft":[]}');await store.drain();assert.equal(state.rows.find(r=>r.entity_type==='recovery_archive').content.origin,'browser');assert.equal(storage.getItem('poc-ai-editor-auth-v1'),'PRIVATE_AUTH');assert.ok(!JSON.stringify(store.snapshot()).includes('PRIVATE_AUTH'));assert.ok(!LEGACY_CREATION_KEYS039.includes('yugioh-classic-roguelite-v1'));
});
test('read-only account cannot enqueue or upload recovery; unsafe property rejected',async t=>{
 const storage=new Storage({'poc-ai-decks-v1':'[]'}),{store}=await setup({canEdit:false,storage});t.after(()=>store.stop());assert.equal(store.queue.length,0);assert.throws(()=>store.patch('deck','deck',{name:'x'}));
 const other=await setup();t.after(()=>other.store.stop());assert.throws(()=>other.store.patch('deck','deck',JSON.parse('{"__proto__":{}}')));assert.equal(other.store.queue.length,0);
});
test('authoring game refresh is not skipped after a minimal successful ACK',async t=>{
 const {store,state}=await setup();t.after(()=>store.stop());store.patch('deck','deck',{name:'최신'});await store.drain();assert.equal(store.bootstrap.project_revision,2);assert.equal(store.fetchedRevision,1);await store.refresh();assert.equal(store.fetchedRevision,2);assert.equal(state.calls.at(-1).args.p_known_revision,1);
});
test('dependent readiness refreshes once after the complete write queue becomes idle',async t=>{
 const {store,state,client}=await setup({rows:[row(),row('dependent')],idleRefreshMs:10});t.after(()=>store.stop());const rpc=client.rpc;let writes=0,release;
 client.rpc=async(name,args)=>{if(name==='poc_apply_intent039'&&++writes===2)await new Promise(r=>release=r);return rpc(name,args);};
 store.patch('deck','deck',{name:'첫 수정'});store.patch('deck','dependent',{name:'둘째 수정'});await store.drain();
 const second=store.drain();
 await new Promise(r=>setTimeout(r,25));assert.equal(state.calls.filter(c=>c.name==='poc_bootstrap039').length,1);assert.equal(store.pendingRevision,2);
 // The server projection also changed a dependent row that was not in the minimal ACK.
 release();await second;state.rows[0].state='ready';state.rows[0].issues=[];
 await new Promise(r=>setTimeout(r,30));
 assert.equal(state.calls.filter(c=>c.name==='poc_bootstrap039').length,2);assert.equal(store.fetchedRevision,3);assert.equal(store.pendingRevision,null);assert.equal(store.getRow('deck','deck').state,'ready');assert.equal(store.snapshot().pending,0);
});
test('failed idle snapshot refresh retries reads without replaying committed writes',async t=>{
 const {store,state,client}=await setup({idleRefreshMs:10});t.after(()=>store.stop());const rpc=client.rpc;let fail=true;
 client.rpc=async(name,args)=>name==='poc_bootstrap039'&&fail?{error:{message:'연결 오류'}}:rpc(name,args);
 const done=store.patch('deck','deck',{name:'저장된 수정'});await store.drain();await done;await new Promise(r=>setTimeout(r,30));
 assert.equal(store.phase,'error');assert.equal(store.snapshot().pending,0);assert.equal(store.pendingRevision,2);fail=false;await store.retry();assert.equal(store.phase,'ready');assert.equal(store.pendingRevision,null);assert.equal(state.calls.filter(c=>c.name==='poc_apply_intent039').length,1);assert.equal(state.rows[0].content.name,'저장된 수정');
});
test('unchanged game ACK avoids a full read unless projection issues need refreshing',async t=>{
 const {store,state,client}=await setup({idleRefreshMs:10});t.after(()=>store.stop());const rpc=client.rpc;let issues=[];
 client.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='poc_apply_intent039'){result.data.game_source_fingerprint=store.bootstrap.game.source_fingerprint;result.data.issues=clone(issues);}return result;};
 store.patch('deck','deck',{name:'같은 게임 투영'});await store.drain();await new Promise(r=>setTimeout(r,25));assert.equal(state.calls.filter(c=>c.name==='poc_bootstrap039').length,1);assert.equal(store.pendingRevision,null);
 issues=[{entity_type:'chapter_role',entity_id:'1:normal',reason:'needs_review'}];store.patch('deck','deck',{name:'연결된 편성 확인'});await store.drain();await new Promise(r=>setTimeout(r,30));assert.equal(state.calls.filter(c=>c.name==='poc_bootstrap039').length,2);assert.equal(store.fetchedRevision,3);assert.equal(store.pendingRevision,null);
});
test('confirmed validation rejection pauses and can be corrected without replaying invalid input',async t=>{
 const {store,state}=await setup();t.after(()=>store.stop());state.once=()=>({error:{message:'unified039_validation',details:'invalid_name'}});const a=store.patch('deck','deck',{name:'x'.repeat(101)});await store.drain();assert.equal(store.phase,'invalid');assert.equal(store.queue[0].body,undefined);assert.equal(state.revision,1);const b=store.patch('deck','deck',{name:'정상 이름'});await store.drain();await Promise.all([a,b]);assert.equal(state.rows[0].content.name,'정상 이름');assert.equal(state.revision,2);
});
test('account switch does not send previous account pending writes',async t=>{
 const {store,state,storage}=await setup();t.after(()=>store.stop());store.patch('deck','deck',{name:'이전 계정의 대기분'});await store.acceptSession({user:{id:'other-editor'}});assert.equal(store.queue.length,0);assert.ok(storage.getItem('poc-authoring039-outbox:editor').includes('이전 계정의 대기분'));assert.equal(state.calls.filter(x=>x.name==='poc_apply_intent039').length,0);
});
test('correcting a rejected head also works with later unrelated queued edits',async t=>{
 const {store,state}=await setup({rows:[row(),row('other')]});t.after(()=>store.stop());state.once=()=>({error:{message:'unified039_validation'}});const a=store.patch('deck','deck',{name:'x'.repeat(101)});store.patch('deck','other',{name:'다른 덱'});await store.drain();assert.equal(store.phase,'invalid');const b=store.patch('deck','deck',{name:'수정 완료'});assert.equal(store.queue.length,2);await store.drain();await Promise.all([a,b]);await store.drain();assert.equal(state.rows[0].content.name,'수정 완료');assert.equal(state.rows[1].content.name,'다른 덱');assert.equal(store.queue.length,0);
});
test('initial auth failure shows a retryable error instead of leaving the shell loading',async t=>{
 const {client}=remote();let subscriptions=0,failed=true;const get=client.auth.getSession;client.auth.getSession=async()=>failed?{error:{message:'세션 연결 오류'}}:get();client.auth.onAuthStateChange=()=>{subscriptions++;return {};};const store=new AuthoringStore039({client,crypto:webcrypto,storage:new Storage(),pollMs:0,events:{}});t.after(()=>store.stop());await assert.rejects(store.start());assert.equal(store.phase,'error');failed=false;await store.retry();assert.equal(store.phase,'ready');assert.equal(store.snapshot().canEdit,true);assert.equal(subscriptions,1);
});
