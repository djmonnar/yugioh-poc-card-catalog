import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {Document041,field041,button041} from './authoring041-test-dom.js';
const clone=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const A='지원-공용',B='효과-드로우',C='효과-버리기';
const payloadText=JSON.stringify({catalog:[],deck_rules035:{},opponents:{opponents:[]},starters:{starters:[]},content022:{},meta017:{},characters:[],shop_rules:{}});

async function groupHarness(t,{initialMembers=[A],initialRevision=50,groupVersion=12}={}){
 const remote={revision:initialRevision,calls:[],requests:new Map(),sqlTimeout:false,annotation:{entity_type:'card_annotation',entity_id:'2420',version:12,state:'saved',issues:[],content:{tags:[],links:[]}},group:{entity_type:'category_group',entity_id:'category-group-pointer-probe',version:groupVersion,state:'saved',issues:[],content:{name:'누르는 중 갱신 검증',categories:[...initialMembers],archived:false}},categories:[...new Set([A,B,C,...initialMembers])].map(name=>({entity_type:'category',entity_id:name,version:1,content:{name,archived:false},state:'saved',issues:[]}))};
 const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},capabilities:{entities:{category_group:{operations:['create','patch']}}},authoring:{entities:[...clone(remote.categories),clone(remote.annotation)]},category_groups055:{schema:1,groups:[clone(remote.group)]},game:{schema:1,kind:'poc-unified-game039',authoring_revision:50,game_revision:50,metadata_revision:'50',identity:IDENTITY039,payload_json:payloadText,source_fingerprint:hash(payloadText)}});
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'pointer-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  if(name==='poc_bootstrap039')return {data:wire()};
  const intent=args.p_intent,change=intent.changes[0];remote.calls.push(clone(intent));
  if(remote.sqlTimeout)return {error:{code:'57014',message:'canceling statement due to statement timeout'}};
  if(remote.requests.has(intent.request_id))return {data:clone(remote.requests.get(intent.request_id))};
  const old=change.entity_type==='category_group'?remote.group:remote.annotation;assert.equal(intent.expected_project_revision,remote.revision);assert.equal(change.expected_entity_version,old.version);
  const next={...old,version:++remote.revision,content:{...old.content,...clone(change.fields)}};if(change.entity_type==='category_group')remote.group=next;else remote.annotation=next;
  const ack={schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,entities:change.entity_type==='category_group'?[]:[clone(next)],category_groups055:{schema:1,groups:change.entity_type==='category_group'?[clone(next)]:[]},game_revision:50,game_source_fingerprint:hash(payloadText)};remote.requests.set(intent.request_id,clone(ack));return {data:ack};
 }};
 const store=new AuthoringStore039({client,storage:null,events:{},crypto:webcrypto,debounceMs:100000,idleRefreshMs:100000,pollMs:0});await store.start();
 const document=new Document041(),root=document.createElement('main');document.body.append(root);
 const window={location:{href:'https://example.test/index.html?section=cards'},history:{pushState(){}},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,scrollTo(){}};
 const shell=mountAuthoringShell039({root,store,document,window});t.after(()=>{shell.destroy();store.stop();});
 const select=field041(root,'편집할 카테고리 묶음');select.value=remote.group.entity_id;select.fire('change');return {store,remote,document,root,shell};
}

test('a live authoring refresh cannot remove a pressed group checkbox before its click applies',async t=>{
 const m=await groupHarness(t),pressed=field041(m.root,'묶음에 포함: '+B);pressed.focus();pressed.fire('pointerdown',{pointerId:1,button:0,pointerType:'touch'});
 // A separate category's metadata changes, while this group's canonical
 // content and version remain unchanged. A poll can legitimately deliver it.
 m.remote.categories[2].version++;m.remote.revision++;await m.store.refresh(true);
 assert.equal(pressed.isConnected,true,'Keep the native pointer target until pointerup/click.');assert.equal(field041(m.root,'묶음에 포함: '+B),pressed);
 pressed.checked=true;pressed.fire('change');pressed.fire('pointerup',{pointerId:1,pointerType:'touch'});pressed.fire('click');
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(field041(m.root,'묶음에 포함: '+B).checked,true);assert.equal(m.store.snapshot().pending,0,'Membership stays a local draft until explicit Save.');
 button041(m.root,'변경 사항 저장').click();await m.store.drain();await Promise.resolve();assert.deepEqual(m.remote.group.content.categories,[A,B]);assert.equal(m.store.phase,'ready');
});

test('rapid group membership saves and canonical ACKs preserve checked categories and versions',async t=>{
 const m=await groupHarness(t);
 for(const name of [B,C]){const input=field041(m.root,'묶음에 포함: '+name);input.focus();input.checked=true;input.fire('change');button041(m.root,'변경 사항 저장').click();await m.store.drain();await Promise.resolve();assert.equal(field041(m.root,'묶음에 포함: '+name).checked,true);assert.equal(m.store.phase,'ready');}
 await m.store.refresh(true);assert.deepEqual(m.remote.group.content.categories,[A,B,C]);assert.equal(field041(m.root,'묶음에 포함: '+B).checked,true);assert.equal(field041(m.root,'묶음에 포함: '+C).checked,true);assert.equal(m.store.snapshot().pending,0);
});

test('a cancelled group-checkbox pointer releases a delayed refresh without selecting the category',async t=>{
 const m=await groupHarness(t),pressed=field041(m.root,'묶음에 포함: '+B);pressed.focus();pressed.fire('pointerdown',{pointerId:2,button:0,pointerType:'touch'});
 m.remote.categories[2].version++;m.remote.revision++;await m.store.refresh(true);assert.equal(pressed.isConnected,true);
 pressed.fire('pointercancel',{pointerId:2,pointerType:'touch'});await new Promise(resolve=>setTimeout(resolve,10));
 const current=field041(m.root,'묶음에 포함: '+B);assert.notEqual(current,pressed);assert.equal(current.checked,false);assert.equal(m.store.snapshot().pending,0);assert.deepEqual(m.remote.group.content.categories,[A]);
});

test('explicit section navigation supersedes a delayed checkbox refresh instead of restoring the previous screen',async t=>{
 const m=await groupHarness(t),pressed=field041(m.root,'묶음에 포함: '+B);pressed.focus();pressed.fire('pointerdown',{pointerId:3,button:0,pointerType:'touch'});
 m.remote.categories[2].version++;m.remote.revision++;await m.store.refresh(true);assert.equal(pressed.isConnected,true);
 m.shell.navigate('decks');assert.equal(pressed.isConnected,false);assert.equal(m.root.querySelector('.au-category-manager055'),null);assert.match(m.root.textContent,/덱 만들기/);
 m.document.fire('pointercancel',{pointerId:3,pointerType:'touch'});await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(m.root.querySelector('.au-category-manager055'),null,'A cancelled old pointer must not reopen the previous card section.');assert.equal(m.store.snapshot().pending,0);assert.deepEqual(m.remote.group.content.categories,[A]);
});

test('a different editor account renders immediately and clears the previous account draft during a pressed checkbox',async t=>{
 const m=await groupHarness(t),name=field041(m.root,'묶음 이름');name.value='이전 계정의 미저장 묶음 이름';name.fire('input');
 const pressed=field041(m.root,'묶음에 포함: '+B);pressed.focus();pressed.fire('pointerdown',{pointerId:4,button:0,pointerType:'touch'});
 m.remote.categories[2].version++;m.remote.revision++;await m.store.refresh(true);assert.equal(pressed.isConnected,true);
 await m.store.acceptSession({user:{id:'different-editor'}});
 assert.ok(m.root.querySelector('.au-category-manager055'),'The new ready account must replace the temporary loading view immediately.');
 assert.equal(m.root.textContent.includes('이전 계정의 미저장 묶음 이름'),false);assert.equal(field041(m.root,'묶음 이름').value,'');assert.equal(m.store.snapshot().pending,0);
 m.document.fire('pointercancel',{pointerId:4,pointerType:'touch'});await new Promise(resolve=>setTimeout(resolve,10));assert.equal(field041(m.root,'묶음 이름').value,'');
});

test('a timed-out earlier card save explains the locked16member group and recovery replays the same request once',async t=>{
 const initialMembers=Array.from({length:15},(_,index)=>'효과-기존'+(index+1)),m=await groupHarness(t,{initialMembers,initialRevision:170,groupVersion:156});
 m.remote.sqlTimeout=true;const earlier=m.store.patch('card_annotation','2420',{tags:[A],links:[]});await m.store.drain();assert.equal(m.store.phase,'error');const originalRequest=m.store.queue[0].requestId;
 const box=field041(m.root,'묶음에 포함: '+B);box.checked=true;box.fire('change');button041(m.root,'변경 사항 저장').click();await m.store.drain();
 assert.equal(m.store.phase,'error');assert.equal(m.store.queue.length,2);assert.equal(m.store.queue[0].type,'card_annotation');assert.equal(m.store.queue[1].type,'category_group');assert.equal(m.store.queue[1].body,undefined,'The group must not be sent ahead of the uncertain earlier write.');assert.equal(m.remote.group.version,156);
 const current=field041(m.root,'묶음에 포함: '+B);assert.equal(current.checked,true);assert.equal(current.disabled,true);assert.equal(button041(m.root,'변경 사항 저장').disabled,true);
 const error=m.root.querySelector('.au-group-error055').textContent;assert.match(error,/앞선 카드 편집/);assert.match(error,/서버 처리 시간이 초과/);assert.match(error,/같은 요청으로 다시 확인/);assert.match(m.root.querySelector('.au-group-member-count055').textContent,/16개/);
 const retry=button041(m.root,'저장 결과 다시 확인');assert.ok(retry);assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);
 m.remote.sqlTimeout=false;retry.click();await m.store.drain();await earlier;await m.store.drain();await Promise.resolve();await Promise.resolve();
 const annotationCalls=m.remote.calls.filter(intent=>intent.changes[0].entity_type==='card_annotation');assert.equal(annotationCalls.length,3);assert.ok(annotationCalls.every(intent=>intent.request_id===originalRequest),'Timeout recovery must retain the exact original request UUID.');
 assert.equal(m.remote.requests.size,2,'The annotation and group each commit once.');assert.equal(m.store.phase,'ready');assert.equal(m.store.queue.length,0);assert.deepEqual(m.remote.group.content.categories,[...initialMembers,B]);assert.equal(field041(m.root,'묶음에 포함: '+B).disabled,false);assert.equal(button041(m.root,'변경 사항 저장').disabled,true);
});
