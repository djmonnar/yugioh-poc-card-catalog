import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {AuthoringDrafts060,createAuthoringDrafts060,draftKey060} from '../authoring060-drafts.js';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
const clone=structuredClone;
const row=(type,id,content,version=1)=>({entity_type:type,entity_id:id,version,state:'saved',issues:[],content:clone(content)});
const deck=(id,name=id)=>row('deck',id,{name,deck_name:name,main:[{source_id:81,identity_key:'card81',count:1}],extra:[],banlist_enabled:false});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function memory(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
function mount({rows=[deck('a'),deck('b')],owner='owner-a',storage=memory(),onSave=null,observeOnChange=false,allowedKinds=['deck','card_annotation','card_display','card_setting','card_limit'],maxBytes}={}){
  let canonical=clone(rows),currentOwner=owner,phase='ready',pending=0,error=null,canEdit=true,changes=0;
  const calls=[],snapshot=()=>({user:currentOwner?{id:currentOwner}:null,canEdit:Boolean(currentOwner&&canEdit),phase,pending,error,bootstrap:{authoring:{entities:clone(canonical)}},entities:clone(canonical)});
  let drafts;
  const commit=(type,id,fields,operation='patch')=>{let existing=canonical.find(item=>item.entity_type===type&&item.entity_id===id);if(!existing){existing=row(type,id,{},0);canonical.push(existing);}existing.content={...existing.content,...clone(fields)};existing.version++;pending=0;phase='ready';error=null;drafts.observe(snapshot());return {schema:1,kind:'unified039-write-ack',entities:[clone(existing)]};};
  drafts=createAuthoringDrafts060({storage,allowedKinds,...(maxBytes?{maxBytes}:{}),onChange:()=>{changes++;if(observeOnChange)drafts.observe(snapshot());},onSave:(type,id,fields,options)=>{calls.push({type,id,fields:clone(fields),options:clone(options)});return onSave?onSave({type,id,fields,options,commit,drafts,snapshot}):commit(type,id,fields,options.operation);}});drafts.observe(snapshot());
  return {drafts,calls,storage,snapshot,commit,get changes(){return changes;},setRow(type,id,fields,version){const existing=canonical.find(item=>item.entity_type===type&&item.entity_id===id);assert.ok(existing);existing.content={...existing.content,...clone(fields)};existing.version=version??existing.version+1;drafts.observe(snapshot());},deleteRow(type,id){canonical=canonical.filter(item=>item.entity_type!==type||item.entity_id!==id);drafts.observe(snapshot());},setState(next){if('owner'in next)currentOwner=next.owner;if('phase'in next)phase=next.phase;if('pending'in next)pending=next.pending;if('error'in next)error=next.error;if('canEdit'in next)canEdit=next.canEdit;drafts.observe(snapshot());}};
}

test('field edits stay local and one explicit save sends one merged canonical diff',async()=>{
  const h=mount({observeOnChange:true}),d=h.drafts;
  assert.ok(d instanceof AuthoringDrafts060);d.stage('deck','a',{deck_name:'내 덱'});d.stage('deck','a',{main:[{source_id:81,identity_key:'card81',count:2}]});d.stage('deck','a',{banlist_enabled:true});
  assert.equal(h.calls.length,0);assert.equal(d.summary().dirtyCount,1);assert.equal(d.overlay(h.snapshot()).entities[0].content.main[0].count,2);assert.equal(h.snapshot().bootstrap.authoring.entities[0].content.main[0].count,1);
  const result=await d.saveAll();assert.equal(result.saved,1);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].fields,{deck_name:'내 덱',main:[{source_id:81,identity_key:'card81',count:2}],banlist_enabled:true});assert.deepEqual(h.calls[0].options,{operation:'patch'});assert.equal(d.summary().dirtyCount,0);assert.equal(d.summary().saving,false);
});

test('returning a field to its baseline removes the diff and a no-op sends nothing',async()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'바꿈'});d.stage('deck','a',{name:'a'});assert.equal(d.summary().dirtyCount,0);assert.equal((await d.saveAll()).saved,0);assert.equal(h.calls.length,0);
});

test('undo and cancel affect only unsent local changes and selected scope',()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'첫 수정'});d.stage('deck','a',{name:'두 번째'});assert.equal(d.undo('deck','a'),true);assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'첫 수정');d.stage('deck','b',{name:'다른 덱'});d.cancel({keys:[{type:'deck',id:'a'}]});assert.equal(d.summary().dirtyCount,1);assert.equal(d.summary().items[0].id,'b');assert.equal(h.calls.length,0);
});

test('a first edit can be undone without creating or sending a request',()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'수정'});assert.equal(d.undo('deck','a'),true);assert.equal(d.summary().items.length,0);assert.equal(h.calls.length,0);
});

test('drafts persist across selection, snapshot refresh and session storage restoration',()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'A 초안'});d.stage('deck','b',{name:'B 초안'});d.observe(h.snapshot());assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'A 초안');assert.equal(d.overlay(h.snapshot()).entities[1].content.name,'B 초안');
  const restored=mount({storage:h.storage});assert.equal(restored.drafts.summary().dirtyCount,2);assert.equal(restored.drafts.overlay(restored.snapshot()).entities[0].content.name,'A 초안');assert.equal(restored.calls.length,0);
});

test('account IDs isolate drafts and returning to an account restores its own draft',()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'A 계정만'});h.setState({owner:'owner-b'});assert.equal(d.summary().dirtyCount,0);assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'a');d.stage('deck','a',{name:'B 계정만'});h.setState({owner:'owner-a'});assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'A 계정만');assert.notEqual(d.storageKey('owner-a'),d.storageKey('owner-b'));
});

test('unrelated canonical changes merge while local edits survive a version refresh',async()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'내 수정'});h.setRow('deck','a',{banlist_enabled:true},8);assert.deepEqual(d.summary().items[0].conflicts,[]);assert.equal(d.summary().items[0].baseVersion,8);const view=d.overlay(h.snapshot()).entities[0].content;assert.equal(view.name,'내 수정');assert.equal(view.banlist_enabled,true);await d.saveAll();assert.deepEqual(h.calls[0].fields,{name:'내 수정'});
});

test('same-content version changes do not create false conflicts',async()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'수정'});h.setRow('deck','a',{},30);assert.deepEqual(d.summary().items[0].conflicts,[]);await d.saveAll();assert.equal(h.calls.length,1);
});

test('a desired value already present in canonical data clears locally without a write',async()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'서버와 같음'});h.setRow('deck','a',{name:'서버와 같음'});assert.equal(d.summary().dirtyCount,0);await d.saveAll();assert.equal(h.calls.length,0);
});

test('JSONB object-key ordering never creates a false changed-field conflict or duplicate save',async()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{main:[{source_id:81,identity_key:'card81',count:2}]});h.setRow('deck','a',{main:[{count:1,identity_key:'card81',source_id:81}]},2);assert.deepEqual(d.summary().items[0].conflicts,[]);h.setRow('deck','a',{main:[{count:2,source_id:81,identity_key:'card81'}]},3);assert.equal(d.summary().items.length,0);await d.saveAll();assert.equal(h.calls.length,0);
});

test('restored submitted nested values are recognized after server JSONB key reordering',async()=>{
  const waiting=deferred(),h=mount({onSave:()=>waiting.promise}),d=h.drafts;const main=[{source_id:81,identity_key:'card81',count:2}];d.stage('deck','a',{main});const saving=d.saveAll();await tick();const restored=mount({storage:h.storage,rows:[{...deck('a'),version:9,content:{...deck('a').content,main:[{count:2,identity_key:'card81',source_id:81}]}},deck('b')]});assert.equal(restored.drafts.summary().items.length,0);waiting.resolve(h.commit('deck','a',{main}));await saving;
});

test('genuine touched-field conflicts preserve local fields and require explicit resolution',async()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'내 이름',deck_name:'내 덱 이름'});h.setRow('deck','a',{name:'다른 이름'},2);assert.deepEqual(d.summary().items[0].conflicts,['name']);assert.match(d.summary().blockedReason,/같은 필드/);assert.throws(()=>d.saveAll(),/같은 필드/);assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'내 이름');
  d.resolveConflicts({keys:[d.key('deck','a')],choice:'remote'});assert.equal(h.calls.length,0);assert.equal(d.summary().items[0].fields.name,undefined);assert.equal(d.summary().items[0].fields.deck_name,'내 덱 이름');await d.saveAll();assert.deepEqual(h.calls[0].fields,{deck_name:'내 덱 이름'});
});

test('explicit local conflict resolution rebases without an immediate RPC',async()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'내 이름'});h.setRow('deck','a',{name:'DB 이름'},3);d.resolveConflicts({choice:'local'});assert.equal(h.calls.length,0);assert.deepEqual(d.summary().items[0].conflicts,[]);assert.equal(d.summary().items[0].baseVersion,3);assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'내 이름');await d.saveAll();assert.deepEqual(h.calls[0].fields,{name:'내 이름'});
});

test('creating and then editing a local entity sends one create with merged fields',async()=>{
  const h=mount(),d=h.drafts;d.stage('deck','new',{name:'새 덱',main:[],extra:[]},{operation:'create'});d.stage('deck','new',{main:[{source_id:81,identity_key:'card81',count:3}]});assert.equal(h.calls.length,0);assert.equal(h.snapshot().bootstrap.authoring.entities.length,2);assert.equal(d.overlay(h.snapshot()).entities.length,3);await d.saveEntity('deck','new');assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.operation,'create');assert.equal(h.calls[0].fields.main[0].count,3);
});

test('structural create collisions and deletion never silently recreate DB entities',()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'충돌 새 항목'},{operation:'create'});assert.match(d.summary().blockedReason,/같은 ID/);assert.throws(()=>d.saveAll(),/같은 ID/);assert.throws(()=>d.resolveConflicts({choice:'local'}),/같은 ID/);d.cancel();d.stage('deck','b',{name:'삭제 후 초안'});h.deleteRow('deck','b');assert.match(d.summary().blockedReason,/삭제/);assert.throws(()=>d.saveAll(),/삭제/);assert.equal(h.calls.length,0);assert.equal(d.overlay(h.snapshot()).entities.find(item=>item.entity_id==='b').content.name,'삭제 후 초안');
});

test('scoped saves retain unrelated drafts and follow original staging order',async()=>{
  const h=mount({rows:[deck('a'),row('card_annotation','81',{tags:[],links:[]}),row('card_display','81',{name:'이름'})]}),d=h.drafts;d.stage('card_annotation','81',{tags:['지원-공용']});d.stage('deck','a',{name:'미저장 덱'});d.stage('card_display','81',{name:'새 이름'});await d.saveAll({keys:[d.key('card_display','81'),d.key('card_annotation','81')]});assert.deepEqual(h.calls.map(call=>call.type),['card_annotation','card_display']);assert.equal(d.summary().dirtyCount,1);assert.equal(d.summary().items[0].type,'deck');assert.equal(d.summary({keys:[d.key('card_display','81')]}).dirtyCount,0);
});

test('global queued/error/conflict states block new requests without touching existing state',()=>{
  for(const next of [{pending:1},{phase:'error',error:'statement timeout'},{phase:'conflict',error:'conflict'},{phase:'invalid',error:'invalid'}]){const h=mount(),d=h.drafts;d.stage('deck','a',{name:'로컬'});h.setState(next);const before=JSON.stringify(h.snapshot());assert.throws(()=>d.saveAll(),/기존 저장|연결/);assert.equal(JSON.stringify(h.snapshot()),before);assert.equal(h.calls.length,0);assert.equal(d.summary().dirtyCount,1);}
});

test('double Save shares one promise and adds no duplicate write',async()=>{
  const waiting=deferred(),h=mount({onSave:()=>waiting.promise}),d=h.drafts;d.stage('deck','a',{name:'전송'});const first=d.saveAll(),second=d.saveAll();assert.equal(first,second);await tick();assert.equal(h.calls.length,1);waiting.resolve(h.commit('deck','a',{name:'전송'}));await first;assert.equal(d.summary().dirtyCount,0);
});

test('edits made while an entity saves remain as a new unsent draft after ACK',async()=>{
  const waiting=deferred();let first=true;const h=mount({observeOnChange:true,onSave:({commit,type,id,fields})=>{if(first){first=false;return waiting.promise;}return commit(type,id,fields);}}),d=h.drafts;
  d.stage('deck','a',{name:'저장할 값'});const saving=d.saveAll();await tick();d.stage('deck','a',{name:'저장 중 새 값'});assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'저장 중 새 값');assert.throws(()=>d.cancel(),/전송한/);waiting.resolve(h.commit('deck','a',{name:'저장할 값'}));await saving;assert.equal(d.summary().dirtyCount,1);assert.deepEqual(d.summary().items[0].conflicts,[]);assert.deepEqual(d.summary().items[0].fields,{name:'저장 중 새 값'});await d.saveAll();assert.equal(h.calls.length,2);assert.deepEqual(h.calls[1].fields,{name:'저장 중 새 값'});
});

test('reverting to the old canonical value during submission is preserved as a later edit',async()=>{
  const waiting=deferred(),h=mount({onSave:()=>waiting.promise}),d=h.drafts;d.stage('deck','a',{name:'보낸 값'});const saving=d.saveAll();await tick();d.stage('deck','a',{name:'a'});waiting.resolve(h.commit('deck','a',{name:'보낸 값'}));await saving;assert.equal(d.summary().dirtyCount,1);assert.deepEqual(d.summary().items[0].fields,{name:'a'});
});

test('a later external edit remains a real conflict when an older own ACK finally arrives',async()=>{
  const waiting=deferred(),h=mount({onSave:()=>waiting.promise}),d=h.drafts;d.stage('deck','a',{name:'보낸 값'});const saving=d.saveAll();await tick();d.stage('deck','a',{name:'나중 로컬 값'});h.setRow('deck','a',{name:'더 최신 DB 값'},5);waiting.resolve({kind:'unified039-write-ack',entities:[row('deck','a',{...deck('a').content,name:'보낸 값'},3)]});await saving;assert.deepEqual(d.summary().items[0].conflicts,['name']);assert.equal(d.summary().items[0].fields.name,'나중 로컬 값');assert.equal(h.snapshot().entities[0].content.name,'더 최신 DB 값');assert.throws(()=>d.saveAll(),/같은 필드/);
});

test('a multi-entity save freezes its initial fields and retains later edits to a waiting entity',async()=>{
  const waiting=deferred();let index=0;const h=mount({onSave:({commit,type,id,fields})=>++index===1?waiting.promise:commit(type,id,fields)}),d=h.drafts;d.stage('deck','a',{name:'A 저장'});d.stage('deck','b',{name:'B 저장'});const saving=d.saveAll();await tick();d.stage('deck','b',{name:'B 나중 수정'});waiting.resolve(h.commit('deck','a',{name:'A 저장'}));await saving;assert.deepEqual(h.calls.map(call=>call.fields.name),['A 저장','B 저장']);assert.equal(d.summary().dirtyCount,1);assert.deepEqual(d.summary().items[0].fields,{name:'B 나중 수정'});
});

test('an unsent scoped entity can be cancelled while a different request waits',async()=>{
  const waiting=deferred(),h=mount({onSave:()=>waiting.promise}),d=h.drafts;d.stage('deck','a',{name:'보냄'});d.stage('deck','b',{name:'아직 안 보냄'});const saving=d.saveAll();await tick();d.cancel({keys:[d.key('deck','b')]});waiting.resolve(h.commit('deck','a',{name:'보냄'}));await saving;assert.deepEqual(h.calls.map(call=>call.id),['a']);assert.equal(d.summary().dirtyCount,0);
});

test('restored submitted edits wait for the old request and clear when fresh canonical data proves success',async()=>{
  const waiting=deferred(),h=mount({onSave:()=>waiting.promise}),d=h.drafts;d.stage('deck','a',{name:'대기 값'});const saving=d.saveAll();await tick();const restored=mount({storage:h.storage});restored.setState({pending:1,phase:'error',error:'timeout'});assert.equal(restored.drafts.summary().submittedCount,1);assert.throws(()=>restored.drafts.saveAll(),/기존 저장/);assert.equal(restored.calls.length,0);restored.setRow('deck','a',{name:'대기 값'},8);restored.setState({pending:0,phase:'ready',error:null});assert.equal(restored.drafts.summary().items.length,0);waiting.resolve(h.commit('deck','a',{name:'대기 값'}));await saving;
});

test('already-current store certificates complete without a synthetic request or applied revision',async()=>{
  const h=mount({onSave:({type,id,fields,commit})=>{const ack=commit(type,id,fields);return {kind:'already-current',alreadyCurrent:true,entityType:type,entityId:id,observedProjectRevision:40,entity:ack.entities[0]};}}),d=h.drafts;d.stage('deck','a',{name:'이미 DB에 있음'});await d.saveAll();assert.equal(d.summary().items.length,0);assert.equal(h.calls.length,1);
});

test('a synchronous pre-enqueue rejection restores local fields and permits correction',async()=>{
  const h=mount({onSave:()=>{throw Error('입력 거부');}}),d=h.drafts;d.stage('deck','a',{name:'거부 값'});await assert.rejects(d.saveAll(),/입력 거부/);assert.equal(d.summary().submittedCount,0);assert.equal(d.summary().dirtyCount,1);assert.deepEqual(d.summary().items[0].fields,{name:'거부 값'});d.cancel();assert.equal(d.summary().items.length,0);
});

test('unknown async errors preserve submitted fields and never create a replacement request',async()=>{
  const h=mount({onSave:()=>Promise.reject(Error('network timeout'))}),d=h.drafts;d.stage('deck','a',{name:'결과 불명'});await assert.rejects(d.saveAll(),/network timeout/);assert.equal(d.summary().submittedCount,1);assert.equal(d.summary().items[0].submitted.uncertain,true);assert.throws(()=>d.saveAll(),/이전 저장/);assert.throws(()=>d.cancel(),/전송한/);assert.equal(h.calls.length,1);h.setRow('deck','a',{name:'결과 불명'},7);assert.equal(d.summary().items.length,0);assert.equal(d.summary().error,null);
});

test('discarding a certified old store conflict returns sent fields to a local draft',async()=>{
  const h=mount({onSave:()=>({discarded:true})}),d=h.drafts;d.stage('deck','a',{name:'돌아올 수정'});const result=await d.saveAll();assert.equal(result.discarded,true);assert.equal(d.summary().submittedCount,0);assert.equal(d.summary().dirtyCount,1);assert.deepEqual(d.summary().items[0].fields,{name:'돌아올 수정'});
});

test('owner changes release only the local wait and late ACKs stay in the original owner bank',async()=>{
  const waiting=deferred(),h=mount({onSave:()=>waiting.promise}),d=h.drafts;d.stage('deck','a',{name:'A 보냄'});const saving=d.saveAll();await tick();h.setState({owner:'owner-b'});assert.equal((await saving).ownerChanged,true);assert.equal(d.summary().items.length,0);d.stage('deck','a',{name:'B 초안'});waiting.resolve({kind:'unified039-write-ack',entities:[row('deck','a',{...deck('a').content,name:'A 보냄'},4)]});await tick();assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'B 초안');h.setState({owner:'owner-a'});assert.equal(d.summary().submittedCount,0);
});

test('malformed or wrong-account stored drafts are preserved without overwriting or executing them',()=>{
  for(const raw of ['{broken',JSON.stringify({schema:1,owner:'wrong-owner',items:[]}),'{"schema":1,"owner":"owner-a","items":[{"__proto__":{"x":1}}]}']){const storage=memory(),key='poc-authoring060-drafts:owner-a';storage.data.set(key,raw);const h=mount({storage}),d=h.drafts;assert.match(d.summary().storageError,/원본은 유지/);d.stage('deck','a',{name:'새 로컬 수정'});assert.equal(storage.data.get(key),raw);assert.equal(d.summary().dirtyCount,1);assert.equal(h.calls.length,0);}
});

test('field validation rejects unsafe values and never mutates canonical snapshots',()=>{
  const h=mount(),d=h.drafts,before=JSON.stringify(h.snapshot());for(const fields of [{name:undefined},{name:NaN},JSON.parse('{"constructor":1}'),{name:new Date()}])assert.throws(()=>d.stage('deck','a',fields));assert.throws(()=>d.stage('category','x',{name:'x'}));assert.throws(()=>d.stage('deck','a',{name:'x'},{operation:'delete'}));assert.equal(JSON.stringify(h.snapshot()),before);assert.equal(d.summary().items.length,0);
});

test('returned draft snapshots and overlays cannot mutate internal or canonical data',()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{main:[{source_id:81,identity_key:'card81',count:3}]});const summary=d.summary(),view=d.overlay(h.snapshot());summary.items[0].fields.main[0].count=99;view.entities[0].content.main[0].count=88;assert.equal(d.summary().items[0].fields.main[0].count,3);assert.equal(h.snapshot().entities[0].content.main[0].count,1);assert.equal(d.key('deck','a'),draftKey060('deck','a'));
});

test('storage quota failure keeps the memory draft and does not prevent saving to the DB',async()=>{
  const storage={getItem:()=>null,setItem:()=>{throw Error('quota');},removeItem:()=>{}},h=mount({storage}),d=h.drafts;d.stage('deck','a',{name:'메모리 유지'});assert.match(d.summary().storageError,/이 창을 유지/);assert.equal(d.summary().dirtyCount,1);await d.saveAll();assert.equal(h.calls.length,1);assert.equal(d.summary().dirtyCount,0);
});

test('loading or losing edit rights hides local overlays without discarding drafts',()=>{
  const h=mount(),d=h.drafts;d.stage('deck','a',{name:'내 초안'});h.setState({canEdit:false});assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'a');assert.throws(()=>d.stage('deck','a',{name:'권한 없음'}),/로그인/);h.setState({canEdit:true});assert.equal(d.overlay(h.snapshot()).entities[0].content.name,'내 초안');
});

test('real store timeout outbox UUID and body survive manual stage, blocked Save and local Cancel',async t=>{
  const payload=JSON.stringify({catalog:[],deck_rules035:{},opponents:{opponents:[]},starters:{starters:[]},content022:{},meta017:{},characters:[],shop_rules:{}}),fingerprint=createHash('sha256').update(payload).digest('hex');
  const remote={revision:50,rows:[deck('a'),deck('b')],timeout:true,calls:[]};
  const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},capabilities:{},authoring:{entities:clone(remote.rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:50,game_revision:50,metadata_revision:'50',identity:IDENTITY039,payload_json:payload,source_fingerprint:fingerprint}});
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'outbox-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
    if(name==='poc_bootstrap039')return {data:wire()};const intent=args.p_intent;remote.calls.push(clone(intent));if(remote.timeout)return {error:{code:'57014',message:'canceling statement due to statement timeout'}};
    const change=intent.changes[0],entity=remote.rows.find(item=>item.entity_type===change.entity_type&&item.entity_id===change.entity_id);assert.equal(change.expected_entity_version,entity.version);entity.content={...entity.content,...clone(change.fields)};entity.version=++remote.revision;
    return {data:{schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,entities:[clone(entity)],issues:[],game_revision:50,game_source_fingerprint:fingerprint}};
  }};
  const store=new AuthoringStore039({client,storage:null,events:{},crypto:webcrypto,pollMs:0,debounceMs:100000,idleRefreshMs:100000});
  const d=createAuthoringDrafts060({onSave:(...args)=>store.patch(...args)}),unsubscribe=store.subscribe(state=>d.observe(state));t.after(()=>{unsubscribe();store.stop();});await store.start();
  const oldSave=store.patch('deck','a',{name:'기존 요청'});await store.drain();assert.equal(store.phase,'error');const originalId=store.queue[0].requestId,originalBody=JSON.stringify(store.queue[0].body);
  d.stage('deck','b',{name:'새 미전송 초안'});assert.throws(()=>d.saveAll(),/기존 저장/);d.cancel({keys:[d.key('deck','b')]});assert.equal(store.queue.length,1);assert.equal(store.queue[0].requestId,originalId);assert.equal(JSON.stringify(store.queue[0].body),originalBody);
  remote.timeout=false;store.retry();await store.drain();await oldSave;assert.equal(store.queue.length,0);assert.equal(remote.calls.length,2);assert.ok(remote.calls.every(intent=>intent.request_id===originalId&&JSON.stringify(intent)===originalBody));assert.equal(d.summary().items.length,0);
});
