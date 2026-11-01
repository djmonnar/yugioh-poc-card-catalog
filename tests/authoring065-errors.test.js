import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {Document041,field041,button041} from './authoring041-test-dom.js';

// Synthetic editor, content and RPC only. No session, drafts or DB from a user.
const copy=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function flush(){await tick();await tick();}
async function until(predicate,message){for(let n=0;n<100;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,1));}assert.fail(message);}
class Storage065{
 constructor(){this.values=new Map();}
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){this.values.set(key,String(value));}
 removeItem(key){this.values.delete(key);}
}
const row=(entity_type,entity_id,content)=>({entity_type,entity_id,content,version:1,state:'saved',issues:[]});
const character=(id,name)=>row('character',id,{name,portrait:'',skills:[],skill_profiles:[]});
const initial=[character('yugi','검증 유희'),character('weevil','검증 사마준'),row('deck','deck-a',{name:'검증 덱',deck_name:'검증 덱',banlist_enabled:false,main:[],extra:[]})];
const capabilities={entities:{character:{operations:['patch'],fields:{name:{type:'text',min:1,max:80},portrait:{type:'text',max:2048},skills:{type:'compiled_character_skills'},skill_profiles:{type:'compiled_character_skill_profiles'}}},deck:{fields:{}}},trait_form:{kinds:[{kind:'lp_bonus',label:'추가 LP',compiled:true,fields:{value:{type:'integer',min:100,max:8000}}}]}};

async function harness(t,{section='chapters',manualSave=true,missingSkills=false}={}){
 const storage=new Storage065(),draftStorage=new Storage065(),remote={revision:1,rows:copy(initial),writes:[],rejectOnce:null,throwOnce:null};
 if(missingSkills){const legacy=remote.rows.find(item=>item.entity_id==='weevil').content;delete legacy.skills;delete legacy.skill_profiles;}
 const payload=JSON.stringify({catalog:[],deck_rules035:{rows:[]},opponents:{opponents:[],chapters:[]},starters:{starters:[]},content022:{relics:[],events:[]},meta017:{},characters:[],shop_rules:{}});
 const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},capabilities:copy(capabilities),catalog:{cards:[]},authoring:{entities:copy(remote.rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:1,metadata_revision:'1',identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}});
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-errors-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  if(name==='poc_bootstrap039')return {data:wire()};
  assert.equal(name,'poc_apply_intent039');const intent=copy(args.p_intent);remote.writes.push(intent);
  if(remote.throwOnce){const error=remote.throwOnce;remote.throwOnce=null;throw error;}
  if(remote.rejectOnce){const error=remote.rejectOnce;remote.rejectOnce=null;return {error};}
  const change=intent.changes[0],index=remote.rows.findIndex(item=>item.entity_type===change.entity_type&&item.entity_id===change.entity_id),old=remote.rows[index];
  if(intent.expected_project_revision!==remote.revision||change.expected_entity_version!==(old?.version??0))return {error:{code:'P0001',message:'unified039_conflict'}};
  const next={...old,entity_type:change.entity_type,entity_id:change.entity_id,content:{...old?.content,...copy(change.fields)},version:(old?.version??0)+1,state:'saved',issues:[]};
  if(index<0)remote.rows.push(next);else remote.rows[index]=next;remote.revision++;
  return {data:{schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,entities:[copy(next)],game_revision:1,game_source_fingerprint:hash(payload)}};
 }};
 const store=new AuthoringStore039({client,storage,crypto:webcrypto,events:{},debounceMs:100000,idleRefreshMs:100000,pollMs:0});await store.start();
 const document=new Document041(),root=document.createElement('main');document.body.append(root);
 const window={location:{href:`https://example.test/index.html?section=${section}`},history:{pushState(_state,_title,url){window.location.href=new URL(url,window.location.href).href;}},addEventListener(){},removeEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){}};
 const shell=mountAuthoringShell039({root,store,manualSave,draftStorage,document,window});
 t.after(()=>{shell.destroy();store.stop();});
 return {store,client,remote,root,document,window,shell,storage,draftStorage,canonical(type,id){return remote.rows.find(item=>item.entity_type===type&&item.entity_id===id);}};
}
async function reject(m,fields={name:''},error={message:'unified039_validation',details:JSON.stringify({reason:'unified039_unknown_legacy_reason'})}){
 m.remote.rejectOnce=error;const done=m.store.patch('character','weevil',fields);await m.store.drain();await flush();assert.equal(m.store.phase,'invalid');return {done};
}
async function input(m,label,value){const control=field041(m.root,label);assert.ok(control,`Missing ${label}`);control.focus();control.value=String(value);control.fire('input');control.blur();await flush();}
const footer=m=>m.root.querySelector('.au-manual-save060');
const save=m=>button041(footer(m),'변경 사항 저장');

test('a rejected character write reports its fields and a recoverable error instead of waiting for completion',async t=>{
 const m=await harness(t);await reject(m,{skills:[{kind:'lp_bonus',value:9000}]});
 const head=m.store.snapshot().writeState;assert.deepEqual(head.fields,['skills']);assert.equal(head.rejected,true);assert.ok(head.validation);assert.deepEqual(head.validation.fields,['skills']);
 const notice=m.root.querySelector('.au-notice');assert.match(notice.textContent,/검증 사마준/);assert.match(notice.textContent,/특성/);
 assert.ok(button041(notice,'수정할 항목 열기'));assert.ok(button041(notice,'초안으로 돌려 수정'));
 assert.doesNotMatch(footer(m).textContent,/기존 저장 요청이 끝난 뒤/);assert.doesNotMatch(notice.textContent,/카드 매수/);
 assert.equal(m.remote.revision,1);assert.equal(m.canonical('character','weevil').content.skills.length,0);
});

test('the error action opens the affected character even when another editing section is active',async t=>{
 const m=await harness(t);await reject(m,{name:''});button041(m.root.querySelector('.au-notice'),'수정할 항목 열기').click();await flush();
 assert.equal(new URL(m.window.location.href).searchParams.get('section'),'characters');assert.equal(field041(m.root,'캐릭터 선택').value,'weevil');
 assert.equal(field041(m.root,'이름').value,'');assert.equal(m.remote.writes.length,1);assert.equal(m.remote.revision,1);
});

test('unknown server validation reasons do not invent a card-count cause or render raw backend details',async t=>{
 const m=await harness(t);await reject(m,{name:''},{message:'unified039_validation',details:JSON.stringify({reason:'<script>private-server-value</script>',sql:'PRIVATE_SQL'})});
 const notice=m.root.querySelector('.au-notice');assert.match(notice.textContent,/이름/);assert.doesNotMatch(notice.textContent,/카드 매수|PRIVATE_SQL|private-server-value|<script>/);
 assert.equal(m.store.snapshot().writeState.validation.reason,null);assert.ok(button041(notice,'수정할 항목 열기'));
});

test('the confirmed legacy character error identifies both paired skill fields',async t=>{
 const m=await harness(t);await reject(m,{skills:[{kind:'lp_bonus',value:100}]},{message:'unified039_validation',details:JSON.stringify({reason:'poc_invalid_character_skills'})});
 const validation=m.store.snapshot().writeState.validation;assert.equal(validation.reason,'poc_invalid_character_skills');assert.deepEqual(new Set(validation.fields),new Set(['skills','skill_profiles']));
 assert.match(validation.message,/특성/);assert.doesNotMatch(validation.message,/카드 매수/);assert.match(m.root.querySelector('.au-notice').textContent,/특성 묶음/);
});

test('a restored certified rejection stays paused and exposes recovery without resending the failed write',async t=>{
 const m=await harness(t);await reject(m,{skills:[{kind:'lp_bonus',value:100}]});m.store.stop();
 const restored=new AuthoringStore039({client:m.client,storage:m.storage,crypto:webcrypto,events:{},debounceMs:100000,idleRefreshMs:100000,pollMs:0});t.after(()=>restored.stop());await restored.start();await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(restored.phase,'invalid');assert.equal(restored.snapshot().writeState.rejected,true);assert.deepEqual(restored.snapshot().writeState.fields,['skills']);assert.equal(m.remote.writes.length,1);assert.equal(m.remote.revision,1);
 assert.equal(restored.getRejected065().id,'weevil');
});

test('returning a rejected request to a draft keeps input until a later explicit corrected save',async t=>{
 const m=await harness(t);const {done}=await reject(m,{name:''});
 button041(m.root.querySelector('.au-notice'),'초안으로 돌려 수정').click();await flush();await done;
 await until(()=>!m.shell.drafts060.summary().saving,'Rejected request no longer counts as an in-flight save');
 assert.equal(m.store.queue.length,0);assert.equal(m.store.phase,'ready');assert.equal(m.remote.writes.length,1);assert.equal(m.remote.revision,1);
 const draft=m.shell.drafts060.summary().items.find(item=>item.type==='character'&&item.id==='weevil');assert.ok(draft);assert.equal(draft.content.name,'');assert.equal(m.shell.drafts060.summary().dirtyCount,1);
 assert.equal(new URL(m.window.location.href).searchParams.get('section'),'characters');assert.equal(field041(m.root,'캐릭터 선택').value,'weevil');
 await input(m,'이름','수정한 사마준');assert.equal(m.remote.writes.length,1);assert.equal(m.canonical('character','weevil').content.name,'검증 사마준');
 assert.equal(save(m).disabled,false);save(m).click();await flush();await m.store.drain();await until(()=>!m.shell.drafts060.summary().saving,'Corrected save completes');await flush();
 assert.equal(m.remote.writes.length,2);assert.equal(m.canonical('character','weevil').content.name,'수정한 사마준');assert.equal(m.shell.drafts060.summary().dirtyCount,0);assert.equal(m.store.queue.length,0);
});

test('failed durable draft storage leaves the original rejected outbox available for recovery',async t=>{
 const m=await harness(t);await reject(m,{name:''});const queueBefore=JSON.stringify(m.store.queue),outboxBefore=m.storage.getItem(m.store.outboxKey());m.draftStorage.setItem=()=>{throw Error('synthetic storage full');};
 button041(m.root.querySelector('.au-notice'),'초안으로 돌려 수정').click();await flush();
 assert.equal(JSON.stringify(m.store.queue),queueBefore);assert.equal(m.storage.getItem(m.store.outboxKey()),outboxBefore);assert.equal(m.store.phase,'invalid');assert.equal(m.remote.writes.length,1);assert.equal(m.remote.revision,1);
 assert.match(m.root.querySelector('.au-toast').textContent,/기존 저장 요청을 유지/);assert.equal(m.shell.drafts060.summary().dirtyCount,0);
});

test('unavailable draft storage never releases the only durable rejected outbox',async t=>{
 const m=await harness(t);await reject(m,{name:''});const queueBefore=JSON.stringify(m.store.queue),outboxBefore=m.storage.getItem(m.store.outboxKey());m.shell.drafts060.storage=null;
 button041(m.root.querySelector('.au-notice'),'초안으로 돌려 수정').click();await flush();
 assert.equal(JSON.stringify(m.store.queue),queueBefore);assert.equal(m.storage.getItem(m.store.outboxKey()),outboxBefore);assert.equal(m.store.phase,'invalid');assert.equal(m.store.queue.length,1);assert.equal(m.remote.writes.length,1);assert.equal(m.remote.revision,1);
 assert.equal(m.shell.drafts060.summary().dirtyCount,0);assert.equal(m.canonical('character','weevil').content.name,'검증 사마준');
});

test('recovering an old one-sided legacy skill request adds its missing companion only in the unsaved draft',async t=>{
 const m=await harness(t,{missingSkills:true}),skills=[{kind:'lp_bonus',value:100}];await reject(m,{skills},{message:'unified039_validation',details:JSON.stringify({reason:'poc_invalid_character_skills'})});
 assert.deepEqual(m.store.queue[0].fields,{skills});assert.equal(Object.hasOwn(m.canonical('character','weevil').content,'skills'),false);assert.equal(Object.hasOwn(m.canonical('character','weevil').content,'skill_profiles'),false);
 button041(m.root.querySelector('.au-notice'),'초안으로 돌려 수정').click();await flush();await until(()=>!m.shell.drafts060.summary().saving,'Legacy rejected request becomes a recoverable draft');
 const draft=m.shell.drafts060.summary().items.find(item=>item.type==='character'&&item.id==='weevil');assert.ok(draft);assert.deepEqual(draft.fields,{skills,skill_profiles:[]});assert.equal(m.store.queue.length,0);assert.equal(m.remote.writes.length,1);assert.equal(m.remote.revision,1);
 assert.equal(Object.hasOwn(m.canonical('character','weevil').content,'skills'),false);assert.equal(Object.hasOwn(m.canonical('character','weevil').content,'skill_profiles'),false);
});

test('a rejection of a manual Save can return to a draft and retain newer local edits',async t=>{
 const m=await harness(t,{section:'characters'});const picker=field041(m.root,'캐릭터 선택');picker.value='weevil';picker.fire('change');await flush();
 await input(m,'이름','처음 보낸 이름');m.remote.rejectOnce={message:'unified039_validation',details:'unknown_validation'};save(m).click();await flush();await m.store.drain();await flush();
 assert.equal(m.store.phase,'invalid');assert.equal(m.shell.drafts060.summary().submittedCount,1);
 await input(m,'이름','보낸 뒤 고친 이름');button041(m.root.querySelector('.au-notice'),'초안으로 돌려 수정').click();await flush();
 await until(()=>!m.shell.drafts060.summary().saving,'The rejected submitted plan becomes editable');
 const draft=m.shell.drafts060.summary().items.find(item=>item.id==='weevil');assert.ok(draft);assert.equal(draft.content.name,'보낸 뒤 고친 이름');assert.equal(field041(m.root,'이름').value,'보낸 뒤 고친 이름');assert.equal(m.remote.writes.length,1);
 assert.equal(m.canonical('character','weevil').content.name,'검증 사마준');assert.equal(m.shell.drafts060.summary().submittedCount,0);assert.equal(save(m).disabled,false);
});

test('releasing a certified rejected head preserves later queued requests and their exact retry bodies',async t=>{
 const m=await harness(t);const {done}=await reject(m,{name:''});m.store.patch('deck','deck-a',{deck_name:'다음 덱 수정'});
 const waiting=m.store.queue[1],requestId=webcrypto.randomUUID(),body={schema:1,project_id:PROJECT039,request_id:requestId,expected_project_revision:1,changes:[{entity_type:'deck',entity_id:'deck-a',expected_entity_version:1,operation:'patch',fields:{deck_name:'다음 덱 수정'}}]};waiting.requestId=requestId;waiting.body=copy(body);
 const before=JSON.stringify(waiting.body),released=m.store.releaseRejected065({type:'character',id:'weevil'});await done;
 assert.equal(released.type,'character');assert.equal(released.id,'weevil');assert.deepEqual(released.fields,{name:''});assert.equal(released.operation,'patch');assert.equal(released.baseVersion,1);assert.equal(released.baseContent.name,'검증 사마준');
 assert.equal(m.store.queue.length,1);assert.equal(m.store.queue[0],waiting);assert.equal(waiting.requestId,requestId);assert.equal(JSON.stringify(waiting.body),before);assert.equal(m.remote.revision,1);
});

test('recovery refuses a different entity and leaves the rejected input untouched',async t=>{
 const m=await harness(t);await reject(m,{name:''});const before=JSON.stringify(m.store.queue);
 assert.throws(()=>m.store.releaseRejected065({type:'character',id:'yugi'}));assert.equal(JSON.stringify(m.store.queue),before);assert.equal(m.store.phase,'invalid');assert.equal(m.remote.writes.length,1);
});

test('recovery is unavailable during an active operation or after editing permission is lost',async t=>{
 const m=await harness(t);await reject(m,{name:''});const before=JSON.stringify(m.store.queue);m.store.busy=true;
 assert.throws(()=>m.store.getRejected065());assert.throws(()=>m.store.releaseRejected065({type:'character',id:'weevil'}));m.store.busy=false;m.store.bootstrap.permissions.can_edit=false;
 assert.throws(()=>m.store.getRejected065());assert.equal(JSON.stringify(m.store.queue),before);assert.equal(m.remote.writes.length,1);assert.equal(m.remote.revision,1);
});

test('an uncertain network result never offers draft conversion or changes its retry identity',async t=>{
 const m=await harness(t);m.remote.throwOnce=new TypeError('synthetic connection lost');m.store.patch('character','weevil',{name:'확인 중인 이름'});await m.store.drain();await flush();
 assert.equal(m.store.phase,'error');const requestId=m.store.queue[0].requestId,body=JSON.stringify(m.store.queue[0].body);
 assert.equal(button041(m.root.querySelector('.au-notice'),'초안으로 돌려 수정'),undefined);assert.throws(()=>m.store.releaseRejected065({type:'character',id:'weevil'}));
 assert.equal(m.store.queue[0].requestId,requestId);assert.equal(JSON.stringify(m.store.queue[0].body),body);assert.equal(m.remote.writes.length,1);assert.equal(m.remote.revision,1);
});

test('editing a legacy character skill includes its missing companion profile array in one explicit save',async t=>{
 const m=await harness(t,{section:'characters',missingSkills:true});const picker=field041(m.root,'캐릭터 선택');picker.value='weevil';picker.fire('change');await flush();
 button041(m.root,'특성 추가').click();await flush();assert.equal(m.remote.writes.length,0);
 const draft=m.shell.drafts060.summary().items.find(item=>item.id==='weevil');assert.ok(draft);assert.deepEqual(draft.fields.skill_profiles,[]);assert.deepEqual(draft.fields.skills,[{kind:'lp_bonus',value:100}]);
 save(m).click();await flush();await m.store.drain();await until(()=>!m.shell.drafts060.summary().saving,'Legacy skills save completes');
 assert.equal(m.remote.writes.length,1);const fields=m.remote.writes[0].changes[0].fields;assert.deepEqual(fields.skill_profiles,[]);assert.deepEqual(fields.skills,[{kind:'lp_bonus',value:100}]);
 assert.equal(m.canonical('character','weevil').content.name,'검증 사마준');assert.equal(m.canonical('character','weevil').content.portrait,'');
});

test('editing a legacy character profile includes missing base skills and preserves existing profiles on later changes',async t=>{
 const m=await harness(t,{section:'characters',missingSkills:true});const picker=field041(m.root,'캐릭터 선택');picker.value='weevil';picker.fire('change');await flush();
 button041(m.root,'특성 묶음 추가').click();await flush();const draft=m.shell.drafts060.summary().items.find(item=>item.id==='weevil');assert.ok(draft);assert.deepEqual(draft.fields.skills,[]);assert.equal(draft.fields.skill_profiles.length,1);
 const profileId=draft.fields.skill_profiles[0].profile_id;save(m).click();await flush();await m.store.drain();await until(()=>!m.shell.drafts060.summary().saving,'Legacy profile save completes');await flush();
 assert.equal(m.remote.writes.length,1);assert.deepEqual(m.remote.writes[0].changes[0].fields.skills,[]);assert.equal(m.canonical('character','weevil').content.skill_profiles[0].profile_id,profileId);
 button041(m.root,'특성 추가').click();await flush();save(m).click();await flush();await m.store.drain();await until(()=>!m.shell.drafts060.summary().saving,'Subsequent skill save completes');
 assert.equal(m.remote.writes.length,2);assert.equal(m.canonical('character','weevil').content.skill_profiles[0].profile_id,profileId);assert.equal(m.canonical('character','weevil').content.skill_profiles.length,1);
});
