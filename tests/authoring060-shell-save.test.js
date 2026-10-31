import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {mountAuthoringShell039,saveLabel039,writeSubject060} from '../authoring039-shell.js';
import {Document041,field041,button041} from './authoring041-test-dom.js';

const copy=value=>structuredClone(value),hash=text=>createHash('sha256').update(text).digest('hex');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const flush=async()=>{await tick();await tick();};
async function until(predicate,message){for(let n=0;n<100;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,1));}assert.fail(message);}
class DraftStorage060{
 constructor(){this.values=new Map();}
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){this.values.set(key,String(value));}
 removeItem(key){this.values.delete(key);}
}
const cards=[1,2].map(source_id=>({source_id,code:10000+source_id,identity_key:`synthetic-card-${source_id}`,web_slot:source_id,native_type:1,alias:0,playable:true,token:false,name:source_id===1?'검증용 흑룡':'검증용 백룡',name_english:`Synthetic Dragon ${source_id}`,description:'합성 회귀 카드입니다.',rarity:'N',stock:true,draw_enabled:true,normal_limit:3,speed_limit:null,attack:1000,defense:1000,level:4,race:8192,attribute:32,type_name:'일반 몬스터',image_url:`assets/synthetic-${source_id}.jpg`}));
const row=(entity_type,entity_id,content)=>({entity_type,entity_id,content,version:1,state:'saved',issues:[]});
const deck=(id,card)=>row('deck',id,{name:`검증 덱 ${id}`,deck_name:`검증 덱 ${id}`,profile_id:'yugi',art_key:'synthetic/yugi',banlist_enabled:false,main:[{source_id:card.source_id,identity_key:card.identity_key,count:1}],extra:[],lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
const cardRows=card=>[
 row('card_display',String(card.source_id),{name:card.name,name_english:card.name_english,description:card.description}),
 row('card_setting',String(card.source_id),{rarity:'N',stock:true,draw_enabled:true}),
 row('card_annotation',String(card.source_id),{tags:[],links:[]}),
 row('card_limit',String(card.source_id),{normal_limit:null,speed_limit:null,frozen_normal_limit:3,frozen_speed_limit:null})
];

async function harness(t,{section='decks',draftStorage=new DraftStorage060()}={}){
 const initial=[deck('a',cards[0]),deck('b',cards[1]),...cards.flatMap(cardRows),row('category','지원-공용',{name:'지원-공용',archived:false})];
 const remote={revision:1,rows:new Map(initial.map(item=>[`${item.entity_type}:${item.entity_id}`,copy(item)])),writes:[],requests:new Map(),holdWrite:false,gates:[]};
 const payload=JSON.stringify({catalog:cards,deck_rules035:{rows:[]},opponents:{opponents:[],chapters:[]},starters:{starters:[]},content022:{relics:[],events:[]},meta017:{},characters:[],shop_rules:{}});
 const capabilities={deck_compositions044:true,entities:{card_setting:{fields:{rarity:{type:'enum',values:['N','R','SR','UR']}}},card_limit:{fields:{normal_limit:{type:'nullable_integer',min:0,max:3},speed_limit:{type:'nullable_integer',min:-1,max:3}}},deck:{fields:{}},category:{fields:{name:{type:'text',min:1,max:40}}}}};
 const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},capabilities:copy(capabilities),catalog:{cards:copy(cards)},authoring:{entities:[...remote.rows.values()].map(copy)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:1,metadata_revision:'1',identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}});
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  if(name==='poc_bootstrap039')return {data:wire()};
  assert.equal(name,'poc_apply_intent039');const intent=copy(args.p_intent);remote.writes.push(intent);
  if(remote.holdWrite)await new Promise(resolve=>remote.gates.push(resolve));
  if(remote.requests.has(intent.request_id))return {data:{...copy(remote.requests.get(intent.request_id)),replayed:true}};
  assert.equal(intent.changes.length,1);const change=intent.changes[0],key=`${change.entity_type}:${change.entity_id}`,old=remote.rows.get(key);
  if(intent.expected_project_revision!==remote.revision||change.expected_entity_version!==(old?.version??0))return {error:{code:'P0001',message:'unified039_conflict',details:JSON.stringify({project_revision:remote.revision,entities:[{entity_type:change.entity_type,entity_id:change.entity_id,version:old?.version??0}]})}};
  const next={...old,entity_type:change.entity_type,entity_id:change.entity_id,content:{...old?.content,...copy(change.fields)},version:++remote.revision,state:'saved',issues:[]};remote.rows.set(key,next);
  const ack={schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,entities:[copy(next)],game_revision:1,game_source_fingerprint:hash(payload)};remote.requests.set(intent.request_id,copy(ack));return {data:ack};
 }};
 const store=new AuthoringStore039({client,storage:null,crypto:webcrypto,events:{},debounceMs:2,idleRefreshMs:100000,pollMs:0});await store.start();
 const document=new Document041(),root=document.createElement('main');document.body.append(root);
 const window={location:{href:`https://example.test/index.html?section=${section}`},history:{pushState(_state,_title,url){window.location.href=new URL(url,window.location.href).href;}},addEventListener(){},removeEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){}};
 let shell;
 const mount=()=>shell=mountAuthoringShell039({root,store,manualSave:true,draftStorage,document,window});mount();
 t.after(async()=>{shell?.destroy();store.stop();for(const release of remote.gates.splice(0))release();await flush();});
 return {store,remote,document,root,window,draftStorage,get shell(){return shell;},remount(){shell.destroy();mount();},canonical(type,id){return remote.rows.get(`${type}:${id}`);}};
}
async function input(root,label,value,event='input'){
 const target=field041(root,label);assert.ok(target,`Missing control: ${label}`);target.focus();target.value=String(value);target.fire(event);target.blur();await flush();
}
async function chooseDeck(m,id){await input(m.root,'편집할 덱',id,'change');}
function saveButton(m){const bar=m.root.querySelector('.au-manual-save060');return button041(bar,'변경 사항 저장')??button041(bar,'저장 확인 중…');}
function infoButton(root,name){return root.querySelectorAll('button').find(button=>button.getAttribute('aria-label')===`${name} 카드 정보`);}
function quantityButton(m,name,verb){return m.root.querySelector('.au-deck-owned').querySelectorAll('button').find(button=>button.getAttribute('aria-label')===`${name} ${verb}`);}
async function openCard(m,name){m.shell.navigate('cards');await flush();const button=infoButton(m.root,name);assert.ok(button,'Card information button is visible');button.click();await flush();return m.document.querySelector('.au-card-dialog');}

test('typing and card count changes stay local until one explicit header save per edited deck',async t=>{
 const m=await harness(t);
 for(const name of ['수','수정','수정한 덱'])await input(m.root,'덱 이름',name);
 quantityButton(m,cards[0].name,'추가').click();await flush();quantityButton(m,cards[0].name,'추가').click();await flush();quantityButton(m,cards[0].name,'빼기').click();await flush();
 await chooseDeck(m,'b');await input(m.root,'덱 이름','두 번째 덱 초안');
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(m.remote.writes.length,0);assert.equal(m.store.queue.length,0);assert.equal(m.shell.drafts060.summary().dirtyCount,2);
 assert.equal(m.canonical('deck','a').content.main[0].count,1);assert.match(m.root.querySelector('.au-save-status').textContent,/저장 전 변경 2개/);
 saveButton(m).click();await until(()=>m.remote.writes.length===2&&!m.shell.drafts060.summary().saving,'Both deck saves finish');await flush();
 assert.deepEqual(m.remote.writes.map(intent=>intent.changes[0].entity_id),['a','b']);
 assert.equal(m.canonical('deck','a').content.deck_name,'수정한 덱');assert.equal(m.canonical('deck','a').content.main[0].count,2);
 assert.equal(m.canonical('deck','b').content.deck_name,'두 번째 덱 초안');assert.equal(m.shell.drafts060.summary().dirtyCount,0);assert.equal(m.store.queue.length,0);
});

test('repeated Save clicks while an acknowledgement is pending create only one request',async t=>{
 const m=await harness(t);await input(m.root,'덱 이름','한 번만 저장');m.remote.holdWrite=true;
 const save=saveButton(m);save.click();save.click();save.click();await until(()=>m.remote.writes.length===1,'First write starts');
 assert.equal(m.shell.drafts060.summary().saving,true);assert.equal(m.remote.writes.length,1);
 const again=saveButton(m);assert.equal(again.disabled,true);again.click();await flush();assert.equal(m.remote.writes.length,1);
 m.remote.holdWrite=false;m.remote.gates.shift()();await until(()=>!m.shell.drafts060.summary().saving,'Held acknowledgement completes');
 assert.equal(m.remote.requests.size,1);assert.equal(m.remote.writes.length,1);assert.equal(m.canonical('deck','a').content.deck_name,'한 번만 저장');
});

test('drafts survive deck and section navigation and a shell remount without becoming writes',async t=>{
 const m=await harness(t);await input(m.root,'덱 이름','첫 덱 보관');quantityButton(m,cards[0].name,'추가').click();await flush();
 await chooseDeck(m,'b');await input(m.root,'덱 이름','둘째 덱 보관');m.shell.navigate('cards');await flush();m.remount();await flush();
 assert.equal(m.remote.writes.length,0);assert.equal(m.shell.drafts060.summary().dirtyCount,2);
 m.shell.navigate('decks','a');await flush();assert.equal(field041(m.root,'덱 이름').value,'첫 덱 보관');assert.match(m.root.querySelector('.au-deck-owned').textContent,/메인 · 2/);
 m.shell.navigate('decks','b');await flush();assert.equal(field041(m.root,'덱 이름').value,'둘째 덱 보관');
 assert.equal(m.remote.writes.length,0);assert.equal(m.canonical('deck','a').content.deck_name,'검증 덱 a');assert.ok([...m.draftStorage.values.keys()].every(key=>key.startsWith('poc-authoring060-drafts:')));
});

test('card detail Save sends only the four card kinds for that card and keeps other drafts',async t=>{
 const m=await harness(t);await input(m.root,'덱 이름','아직 저장하지 않을 덱');
 let dialog=await openCard(m,cards[1].name);await input(dialog,'카드 이름','백룡 미저장');button041(m.document.querySelector('.au-card-dialog'),'닫기').click();await flush();
 dialog=await openCard(m,cards[0].name);await input(dialog,'카드 이름','흑룡 수정');
 dialog=m.document.querySelector('.au-card-dialog');await input(dialog,'등급','R','change');
 dialog=m.document.querySelector('.au-card-dialog');const category=field041(dialog,'지원-공용');assert.ok(category);category.focus();category.checked=true;category.fire('change');category.blur();await flush();
 dialog=m.document.querySelector('.au-card-dialog');const limit=field041(dialog,'normal_limit')??field041(dialog,'일반 제한');assert.ok(limit,'Normal card limit control exists');limit.focus();limit.value='1';limit.fire('change');limit.blur();await flush();
 assert.equal(m.remote.writes.length,0);assert.equal(m.shell.drafts060.summary().dirtyCount,6);
 button041(m.document.querySelector('.au-card-dialog'),'이 카드 저장').click();await until(()=>m.remote.writes.length===4&&!m.shell.drafts060.summary().saving,'The selected card fields finish saving');await flush();
 assert.deepEqual(new Set(m.remote.writes.map(intent=>intent.changes[0].entity_type)),new Set(['card_display','card_setting','card_annotation','card_limit']));
 assert.ok(m.remote.writes.every(intent=>intent.changes[0].entity_id==='1'));
 assert.equal(m.canonical('card_display','1').content.name,'흑룡 수정');assert.equal(m.canonical('card_setting','1').content.rarity,'R');assert.deepEqual(m.canonical('card_annotation','1').content.tags,['지원-공용']);assert.equal(m.canonical('card_limit','1').content.normal_limit,1);
 const remaining=m.shell.drafts060.summary().items;assert.equal(remaining.length,2);assert.ok(remaining.some(item=>item.type==='deck'&&item.id==='a'));assert.ok(remaining.some(item=>item.type==='card_display'&&item.id==='2'));assert.equal(m.canonical('card_display','2').content.name,cards[1].name);
});

test('a saved card can be edited and saved again directly while its input remains focused',async t=>{
 const m=await harness(t,{section:'cards'});let dialog=await openCard(m,cards[0].name);
 await input(dialog,'카드 이름','첫 저장 이름');button041(m.document.querySelector('.au-card-dialog'),'이 카드 저장').click();
 await until(()=>m.remote.writes.length===1&&!m.shell.drafts060.summary().saving,'First card save completes');await flush();
 dialog=m.document.querySelector('.au-card-dialog');assert.equal(button041(dialog,'이 카드 저장').disabled,true);assert.match(dialog.querySelector('.au-card-save060').textContent,/저장할 변경이 없습니다/);assert.doesNotMatch(dialog.querySelector('.au-card-save060').textContent,/확인하고 있습니다/);
 button041(dialog,'닫기').click();await flush();dialog=await openCard(m,'첫 저장 이름');
 const name=field041(dialog,'카드 이름');name.focus();name.value='두 번째 저장 이름';name.setSelectionRange(2,5);name.fire('input');await flush();
 assert.equal(m.document.activeElement,name);assert.equal(name.isConnected,true);assert.equal(field041(m.document.querySelector('.au-card-dialog'),'카드 이름'),name);assert.equal(name.selectionStart,2);assert.equal(name.selectionEnd,5);
 const save=button041(m.document.querySelector('.au-card-dialog'),'이 카드 저장');assert.equal(save.disabled,false,'Refresh the existing footer without waiting for blur.');assert.equal(m.remote.writes.length,1);
 m.remote.holdWrite=true;save.click();await until(()=>m.remote.writes.length===2,'Second card request starts');await flush();
 const waiting=button041(m.document.querySelector('.au-card-dialog'),'이 카드 저장');assert.equal(waiting.disabled,true);waiting.click();await flush();assert.equal(m.remote.writes.length,2);
 m.remote.holdWrite=false;m.remote.gates.shift()();await until(()=>!m.shell.drafts060.summary().saving,'Second card ACK completes');await flush();
 dialog=m.document.querySelector('.au-card-dialog');assert.equal(m.canonical('card_display','1').content.name,'두 번째 저장 이름');assert.equal(button041(dialog,'이 카드 저장').disabled,true);assert.match(dialog.querySelector('.au-card-save060').textContent,/저장할 변경이 없습니다/);assert.doesNotMatch(dialog.querySelector('.au-card-save060').textContent,/확인하고 있습니다/);assert.equal(m.remote.requests.size,2);
});

test('footer state updates during a deferred poll preserve the Korean IME input and permit direct Save',async t=>{
 const m=await harness(t,{section:'cards'}),dialog=await openCard(m,cards[0].name),name=field041(dialog,'카드 이름');
 name.focus();name.fire('compositionstart');name.value='ㅎ';name.setSelectionRange(1,1);name.fire('input',{isComposing:true});
 const other=m.canonical('card_setting','2');other.content.stock=false;other.version=++m.remote.revision;await m.store.refresh(true);await flush();
 assert.equal(m.document.activeElement,name);assert.equal(name.isConnected,true);assert.equal(name.value,'ㅎ');assert.equal(name.selectionStart,1);assert.equal(m.remote.writes.length,0);assert.equal(button041(m.document.querySelector('.au-card-dialog'),'이 카드 저장').disabled,true);
 name.value='한글 입력 완료';name.setSelectionRange(8,8);name.fire('compositionend');await flush();
 assert.equal(m.document.activeElement,name);assert.equal(name.isConnected,true);assert.equal(name.value,'한글 입력 완료');assert.equal(name.selectionStart,8);const save=button041(m.document.querySelector('.au-card-dialog'),'이 카드 저장');assert.equal(save.disabled,false);
 save.click();await until(()=>m.remote.writes.length===1&&!m.shell.drafts060.summary().saving,'The completed IME value saves once');await flush();
 assert.equal(m.canonical('card_display','1').content.name,'한글 입력 완료');assert.deepEqual(m.remote.writes[0].changes[0].fields,{name:'한글 입력 완료'});assert.equal(m.remote.requests.size,1);
});

test('a blocked earlier card write names its card and changed field without blaming another device',async t=>{
 const m=await harness(t);await input(m.root,'덱 이름','남아 있어야 할 로컬 초안');
 const pending=m.store.patch('card_setting','1',{rarity:'UR'});void pending;
 const changed=m.canonical('card_setting','1');changed.content.rarity='SR';changed.version=++m.remote.revision;
 await m.store.drain();await flush();assert.equal(m.store.phase,'conflict');
 const notice=m.root.querySelector('.au-notice');assert.equal(notice.hidden,false);assert.match(notice.textContent,/검증용 흑룡/);assert.match(notice.textContent,/등급/);assert.doesNotMatch(notice.textContent,/다른 창|다른 기기|다른 계정|누군가/);
 assert.match(notice.textContent,/카드 등급/);assert.ok(button041(notice,'DB 내용 사용'));assert.equal(m.shell.drafts060.summary().dirtyCount,1);assert.equal(field041(m.root,'덱 이름').value,'남아 있어야 할 로컬 초안');
});

test('save status and write subjects describe local work and the affected fields',async t=>{
 const m=await harness(t);await input(m.root,'덱 이름','이름 보관');
 const snapshot={...m.store.snapshot(),manualDrafts060:m.shell.drafts060.summary()};
 assert.match(saveLabel039(snapshot),/저장 전 변경 1개/);assert.equal(saveLabel039({...snapshot,phase:'conflict'}),'저장 기준 확인 필요');
 const subject=writeSubject060(snapshot,{type:'card_annotation',id:'1',fields:['tags','links','tags']});
 assert.match(subject.title,/검증용 흑룡/);assert.equal(subject.fields,'카테고리, 관련 카드');assert.equal(m.remote.writes.length,0);
});
