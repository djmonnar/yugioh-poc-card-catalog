import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {Document041,field041,button041} from './authoring041-test-dom.js';
const copy=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex'),tick=()=>new Promise(resolve=>setImmediate(resolve)),flush=async()=>{await tick();await tick();};
class Storage068{constructor(){this.values=new Map();}getItem(key){return this.values.get(key)??null;}setItem(key,value){this.values.set(key,String(value));}removeItem(key){this.values.delete(key);}}
const row=(type,id,content,version=1)=>({entity_type:type,entity_id:id,version,state:'saved',issues:[],content:copy(content)});
const cards=Array.from({length:8},(_,i)=>({source_id:i+1,code:10001+i,alias:0,identity_key:hash('synthetic068-card-'+i),web_slot:i+1,native_type:17,playable:true,token:false,name:'합성 카드 '+(i+1),name_english:'Synthetic '+i,description:'검증 전용 카드',rarity:'N',stock:true,draw_enabled:true,normal_limit:3,speed_limit:null,attack:1000,defense:1000,level:4,race:1,attribute:1,type_name:'일반 몬스터'}));
const composition=offset=>cards.slice(offset,offset+7).map((c,i)=>({source_id:c.source_id,identity_key:c.identity_key,count:i===6?2:3}));
const deck=(id='deck-a',offset=0)=>row('deck',id,{name:id,deck_name:id,main:composition(offset),extra:[],banlist_enabled:false,profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
const encounter=(name='기존 상대')=>({name,deck_name:'표시 덱',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
const entry=(id,deckId='deck-a')=>({entry_id:id,deck_id:deckId,weight:1,encounter:encounter(id)});
const role=(id,entries=[])=>{const [chapter,kind]=id.split(':');return row('chapter_role',id,{chapter:Number(chapter),role:kind,lp_bonus:0,entries});};
const characters=[{id:'character-yugi',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',profile:{name:'합성 유희',skills:[],skill_profiles:[]}},{id:'character-kaiba',profile_id:'kaiba',art_key:'CharacterPresentation012/images/kaiba/start',profile:{name:'합성 카이바',skills:[{kind:'lp_bonus',value:500}],skill_profiles:[{profile_id:'kaiba-one',name:'같은 이름 특성',skills:[{kind:'lp_bonus',value:1200}]},{profile_id:'kaiba-two',name:'같은 이름 특성',skills:[{kind:'lp_bonus',value:2400}]}]}}];
characters.push({id:'character-yugi-alt',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',profile:{name:'합성 다른 유희',skills:[{kind:'lp_bonus',value:700}],skill_profiles:[{profile_id:'alt-profile',name:'다른 유희 특성',skills:[{kind:'lp_bonus',value:1400}]}]}});
async function setup(t){
  const capabilities=JSON.parse(fs.readFileSync(new URL('./fixtures/authoring-capabilities066.json',import.meta.url),'utf8'));capabilities.deck_compositions044=true;
  const initial=[deck(),deck('deck-b',1),...['1:battle','1:elite','1:boss','2:battle','2:elite','2:boss','3:battle','3:elite','3:boss'].map(id=>role(id)),...characters.map(c=>row('character',c.id,{...c.profile,portrait:''}))];
  const remote={rows:initial,revision:1,writes:[],requests:new Map(),commits:0,rejectOnce:null},payload=JSON.stringify({catalog:cards,deck_rules035:{rows:[]},opponents:{opponents:[],chapters:[]},starters:{starters:[]},content022:{relics:[],events:[]},meta017:{},characters,shop_rules:{}});
  const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},capabilities:copy(capabilities),catalog:{cards:copy(cards)},characters:copy(characters),authoring:{entities:copy(remote.rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:1,metadata_revision:'1',identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}});
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic068-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
    if(name==='poc_bootstrap039')return {data:wire()};assert.equal(name,'poc_apply_intent039');const intent=copy(args.p_intent);remote.writes.push(intent);if(remote.requests.has(intent.request_id))return {data:copy(remote.requests.get(intent.request_id))};if(remote.rejectOnce){const error=remote.rejectOnce;remote.rejectOnce=null;return {error};}
    assert.equal(intent.expected_project_revision,remote.revision);assert.ok(intent.changes.length<=32);for(const c of intent.changes){const before=remote.rows.find(r=>r.entity_type===c.entity_type&&r.entity_id===c.entity_id);assert.equal(c.expected_entity_version,before?.version??0);}
    const next=copy(remote.rows),revision=remote.revision+1,changed=[];for(const c of intent.changes){const index=next.findIndex(r=>r.entity_type===c.entity_type&&r.entity_id===c.entity_id),value=row(c.entity_type,c.entity_id,{...(next[index]?.content??{}),...c.fields},revision);if(index<0)next.push(value);else next[index]=value;changed.push(copy(value));}remote.rows=next;remote.revision=revision;remote.commits++;
    const ack={schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:revision,observed_project_revision:revision,entities:changed,game_revision:1,game_source_fingerprint:hash(payload),issues:[]};remote.requests.set(intent.request_id,copy(ack));return {data:ack};
  }};
  const store=new AuthoringStore039({client,storage:new Storage068(),crypto:webcrypto,events:{},debounceMs:100000,idleRefreshMs:100000,pollMs:0});await store.start();
  store.flushPending083=()=>{}; // This fixture inspects the durable queue before explicitly draining it.
  const document=new Document041(),root=document.createElement('main');document.body.append(root);
  const window={location:{href:'https://example.test/index.html?section=decks&deck=deck-a'},history:{pushState(_state,_title,url){window.location.href=new URL(url,window.location.href).href;}},addEventListener(){},removeEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){}};
  const draftStorage=new Storage068(),shell=mountAuthoringShell039({root,store,manualSave:true,draftStorage,document,window});t.after(()=>{shell.destroy();store.stop();});
  return {store,shell,root,document,window,remote,draftStorage,canonical:(type,id)=>remote.rows.find(r=>r.entity_type===type&&r.entity_id===id),async refresh(){await store.refresh(true);await flush();}};
}
function click(m,label,root=m.root){const node=button041(root,label);assert.ok(node,'Missing '+label);node.click();return node;}
async function input(m,label,value,event='input',root=m.root){const control=field041(root,label);assert.ok(control,'Missing '+label);control.focus();control.value=String(value);control.fire(event);control.blur();await flush();return control;}
const setupEditor=m=>m.root.querySelector('.au-setup-editor068');
const footer=m=>m.root.querySelector('.au-manual-save060');
async function openAdd(m){click(m,'배치 설정');await flush();click(m,'배치 추가');await flush();return setupEditor(m);}
async function drain(m){await flush();assert.equal(m.store.queue.length,1,'One atomic outbox item must contain the whole save: '+m.root.querySelector('.au-toast')?.textContent);await m.store.drain();await flush();}

const routes=m=>m.root.querySelector('.au-routes071'),editor=m=>m.root.querySelector('.au-route-editor071'),common=m=>m.root.querySelector('.au-route-common071');
async function openBulk(m){click(m,'여러 구역에 배치');await flush();assert.ok(routes(m));}
async function selectNew(m,label,checked=true){const control=routes(m).querySelectorAll('input').find(node=>node.getAttribute('aria-label')===label);assert.ok(control,label);control.checked=checked;control.fire('change');await flush();}
async function selectExisting(m,entryId){const label=routes(m).querySelectorAll('.au-route-existing-row071').find(node=>node.textContent.includes('배치 '+entryId));assert.ok(label,entryId);const input=label.querySelector('input');input.checked=true;input.fire('change');await flush();}
const viewRows=m=>m.shell.drafts060.overlay(m.store.snapshot()).entities;
function selectedEntry(m,roleId,id){return viewRows(m).find(row=>row.entity_id===roleId).content.entries.find(entry=>entry.entry_id===id);}
async function pickRoute(m,roleName){const pick=routes(m).querySelectorAll('.au-route-selected-row071').find(row=>row.textContent.includes(roleName));assert.ok(pick,roleName);pick.click();await flush();}

async function selectDeckPlacement101(m,roleId,id){
 const checkbox=m.root.querySelectorAll('input').find(node=>node.dataset.placementKey===JSON.stringify([roleId,id]));assert.ok(checkbox,'Deck placement '+id);
 checkbox.checked=true;checkbox.fire('change');await flush();
}

test('101 deck-side multi exclusion saves exact roles and renamed deck atomically, preserving sibling decks and metadata',async t=>{
 const m=await setup(t),first=m.canonical('chapter_role','1:battle'),second=m.canonical('chapter_role','2:boss');
 first.content.entries=[entry('remove-a'),entry('keep-a'),entry('other','deck-b')];first.content.entries[1].encounter.lp_bonus=800;first.content.lp_bonus=500;
 second.content.entries=[entry('remove-b')];second.content.lp_bonus=1200;await m.refresh();
 assert.match(m.root.querySelector('.au-setup-chapters101').textContent,/1장 · 일반 전투 2곳/);
 click(m,'배치 설정');await flush();await selectDeckPlacement101(m,'1:battle','remove-a');await selectDeckPlacement101(m,'2:boss','remove-b');
 click(m,'선택 배치 제외');await flush();assert.equal(m.remote.writes.length,0);click(m,'2곳 배치 제외');await flush();
 assert.equal(m.remote.writes.length,0);assert.equal(m.shell.drafts060.summary().dirtyCount,2);await input(m,'덱 이름','배치 함께 저장');
 click(m,'덱과 배치 저장');await drain(m);assert.equal(m.remote.commits,1);
 assert.deepEqual(m.remote.writes[0].changes.map(row=>[row.entity_type,row.entity_id]),[['deck','deck-a'],['chapter_role','1:battle'],['chapter_role','2:boss']]);
 assert.deepEqual(first.content.entries.map(row=>row.entry_id),['remove-a','keep-a','other'],'The held old snapshot is not mutated');
 assert.deepEqual(m.canonical('chapter_role','1:battle').content.entries.map(row=>row.entry_id),['keep-a','other']);
 assert.equal(m.canonical('chapter_role','1:battle').content.entries[0].encounter.lp_bonus,800);
 assert.equal(m.canonical('chapter_role','1:battle').content.entries[1].deck_id,'deck-b');
 assert.equal(m.canonical('chapter_role','1:battle').content.lp_bonus,500);assert.equal(m.canonical('chapter_role','2:boss').content.lp_bonus,1200);
 assert.deepEqual(m.canonical('chapter_role','2:boss').content.entries,[]);assert.equal(m.canonical('deck','deck-a').content.deck_name,'배치 함께 저장');
 assert.equal(m.remote.rows.filter(row=>row.entity_type==='deck').length,2);assert.equal(m.shell.drafts060.summary().dirtyCount,0);
});

test('101 selected deck placements open the shared route editor and return to the same deck after one atomic common edit',async t=>{
 const m=await setup(t);m.canonical('chapter_role','1:battle').content.entries=[entry('same-a'),entry('untouched')];m.canonical('chapter_role','3:elite').content.entries=[entry('same-b')];await m.refresh();
 click(m,'배치 설정');await flush();await selectDeckPlacement101(m,'1:battle','same-a');await selectDeckPlacement101(m,'3:elite','same-b');click(m,'선택 배치 함께 수정');await flush();
 assert.match(routes(m).querySelector('h1').textContent,/이 덱의 배치 관리/);assert.equal(routes(m).querySelectorAll('.au-route-selected-row071').length,2);
 assert.equal(routes(m).querySelector('.au-route-existing071').open,true);assert.equal(m.remote.writes.length,0);
 await input(m,'상대 추가 LP',1600,'input',common(m));click(m,'선택한 2개 배치에 공통 설정 적용');await flush();click(m,'선택한 구역과 덱 저장');await drain(m);
 assert.deepEqual(m.remote.writes[0].changes.map(row=>row.entity_id),['1:battle','3:elite']);
 assert.equal(m.canonical('chapter_role','1:battle').content.entries[0].encounter.lp_bonus,1600);assert.equal(m.canonical('chapter_role','1:battle').content.entries[1].encounter.lp_bonus,0);
 assert.equal(m.canonical('chapter_role','3:elite').content.entries[0].encounter.lp_bonus,1600);
 click(m,'덱으로');await flush();assert.equal(m.root.querySelector('.au-routes071'),null);assert.ok(m.root.querySelector('.au-deck-setup068'));assert.match(m.window.location.href,/deck=deck-a/);
});

test('101 global cancel discards multi exclusions without RPC or losing either placement',async t=>{
 const m=await setup(t);m.canonical('chapter_role','1:battle').content.entries=[entry('keep-one')];m.canonical('chapter_role','2:boss').content.entries=[entry('keep-two')];await m.refresh();
 click(m,'배치 설정');await flush();await selectDeckPlacement101(m,'1:battle','keep-one');await selectDeckPlacement101(m,'2:boss','keep-two');click(m,'선택 배치 제외');await flush();click(m,'2곳 배치 제외');await flush();
 assert.equal(m.shell.drafts060.summary().dirtyCount,2);click(m,'변경 취소',footer(m));await flush();
 assert.equal(m.remote.writes.length,0);assert.equal(m.shell.drafts060.summary().dirtyCount,0);
 assert.equal(viewRows(m).find(row=>row.entity_id==='1:battle').content.entries[0].entry_id,'keep-one');assert.equal(viewRows(m).find(row=>row.entity_id==='2:boss').content.entries[0].entry_id,'keep-two');
});

test('101 selected edit includes pre-existing drafts in selected roles and excludes unrelated drafts',async t=>{
 const m=await setup(t);m.canonical('chapter_role','1:battle').content.entries=[entry('selected')];m.canonical('chapter_role','2:boss').content.entries=[entry('unselected')];await m.refresh();
 m.shell.drafts060.stage('chapter_role','1:battle',{lp_bonus:900});m.shell.drafts060.stage('chapter_role','2:boss',{lp_bonus:1700});await flush();
 click(m,'배치 설정');await flush();await selectDeckPlacement101(m,'1:battle','selected');click(m,'선택 배치 함께 수정');await flush();
 assert.equal(button041(routes(m),'선택한 구역과 덱 저장').disabled,false);
 click(m,'선택한 구역과 덱 저장');await drain(m);
 assert.deepEqual(m.remote.writes[0].changes.map(row=>row.entity_id),['1:battle']);assert.equal(m.canonical('chapter_role','1:battle').content.lp_bonus,900);
 assert.equal(m.canonical('chapter_role','2:boss').content.lp_bonus,0);assert.deepEqual(m.shell.drafts060.summary().items.filter(row=>row.dirty).map(row=>row.id),['2:boss']);
});

test('101 a concurrent change blocks the entire queued multi exclusion and retains every requested role',async t=>{
 const m=await setup(t);m.canonical('chapter_role','1:battle').content.entries=[entry('one')];m.canonical('chapter_role','2:boss').content.entries=[entry('two')];await m.refresh();
 click(m,'배치 설정');await flush();await selectDeckPlacement101(m,'1:battle','one');await selectDeckPlacement101(m,'2:boss','two');click(m,'선택 배치 제외');await flush();click(m,'2곳 배치 제외');await flush();
 click(m,'덱과 배치 저장');await flush();assert.equal(m.store.queue.length,1);
 m.canonical('chapter_role','1:battle').content.entries.push(entry('new-remote','deck-b'));m.canonical('chapter_role','1:battle').version=++m.remote.revision;
 m.remote.rejectOnce={code:'P0001',message:'unified039_conflict'};await m.store.drain();await flush();
 assert.equal(m.remote.commits,0);assert.equal(m.store.phase,'conflict');assert.equal(m.store.queue.length,1);
 assert.deepEqual(m.store.queue[0].changes.map(row=>row.id),['1:battle','2:boss']);
 assert.deepEqual(m.canonical('chapter_role','1:battle').content.entries.map(row=>row.entry_id),['one','new-remote']);
 assert.deepEqual(m.canonical('chapter_role','2:boss').content.entries.map(row=>row.entry_id),['two']);
 assert.match(m.root.textContent,/초안|변경/);
});

test('071 mounted deck entry chooses multiple pools once and commits their independent LP in one exact-scope intent',async t=>{
 const m=await setup(t);await openBulk(m);
 await selectNew(m,'1장 · 일반 전투에 새 배치 추가');await input(m,'상대 추가 LP',700,'input',editor(m));
 await selectNew(m,'2장 · 보스에 새 배치 추가');await input(m,'상대 추가 LP',1900,'input',editor(m));
 assert.equal(m.shell.drafts060.summary().dirtyCount,0);assert.equal(m.remote.writes.length,0);
 click(m,'선택한 구역과 덱 저장');await drain(m);
 assert.equal(m.remote.commits,1);assert.deepEqual(m.remote.writes[0].changes.map(c=>c.entity_id),['1:battle','2:boss']);
 assert.equal(m.canonical('chapter_role','1:battle').content.entries[0].encounter.lp_bonus,700);
 assert.equal(m.canonical('chapter_role','2:boss').content.entries[0].encounter.lp_bonus,1900);
 assert.equal(m.shell.drafts060.summary().dirtyCount,0);assert.match(routes(m).textContent,/입력값을 저장/);
});

test('071 common edits leave mixed existing opponents untouched until explicit apply and retain exact IDs',async t=>{
 const m=await setup(t);m.canonical('chapter_role','1:battle').content.entries=[entry('same-name-a'),entry('same-name-b'),entry('other','deck-b')];
 for(const [i,e]of m.canonical('chapter_role','1:battle').content.entries.entries()){e.encounter.name='같은 이름';e.encounter.lp_bonus=500+i*300;e.weight=2+i;}
 await m.refresh();await openBulk(m);await selectExisting(m,'same-name-a');await selectExisting(m,'same-name-b');
 await input(m,'상대 추가 LP',1800,'input',common(m));
 assert.equal(m.remote.writes.length,0);assert.equal(selectedEntry(m,'1:battle','same-name-a').encounter.lp_bonus,500);
 click(m,'선택한 2개 배치에 공통 설정 적용');await flush();
 await pickRoute(m,'1장 · 일반 전투');await input(m,'상대 추가 LP',2200,'input',editor(m));
 click(m,'선택한 구역과 덱 저장');await drain(m);const entries=m.canonical('chapter_role','1:battle').content.entries;
 assert.equal(entries.length,3);assert.equal(entries[0].entry_id,'same-name-a');assert.equal(entries[0].encounter.lp_bonus,2200);
 assert.equal(entries[1].entry_id,'same-name-b');assert.equal(entries[1].encounter.lp_bonus,1800);assert.equal(entries[2].encounter.lp_bonus,1100);assert.equal(entries[2].weight,4);
});

test('071 staging, navigation and shell reload retain all unsaved route values with no RPC',async t=>{
 const m=await setup(t);await openBulk(m);
 await selectNew(m,'1장 · 일반 전투에 새 배치 추가');await input(m,'상대 추가 LP',900,'input',editor(m));
 await selectNew(m,'3장 · 엘리트에 새 배치 추가');await input(m,'상대 추가 LP',2400,'input',editor(m));
 await m.shell.navigate('cards');await flush();assert.equal(m.remote.writes.length,0);assert.equal(m.shell.drafts060.summary().dirtyCount,2);
 await m.shell.navigate('chapters');await flush();assert.ok(routes(m));assert.equal(selectedEntry(m,'1:battle',viewRows(m).find(r=>r.entity_id==='1:battle').content.entries[0].entry_id).encounter.lp_bonus,900);
 assert.match(footer(m).textContent,/저장 전 변경/);m.shell.destroy();
 m.shell=mountAuthoringShell039({root:m.root,store:m.store,manualSave:true,draftStorage:m.draftStorage,document:m.document,window:m.window});t.after(()=>m.shell.destroy());await flush();
 const drafts=m.shell.drafts060.summary();assert.equal(drafts.dirtyCount,2);assert.equal(viewRows(m).find(r=>r.entity_id==='3:elite').content.entries[0].encounter.lp_bonus,2400);assert.equal(m.remote.writes.length,0);
 click(m,'변경 사항 저장',footer(m));await drain(m);assert.equal(m.remote.commits,1);assert.equal(m.canonical('chapter_role','3:elite').content.entries[0].encounter.lp_bonus,2400);
});

test('071 invalid LP blocks navigation and Save, and explicit cancel clears the session validation cache',async t=>{
 const m=await setup(t);await openBulk(m);await selectNew(m,'1장 · 일반 전투에 새 배치 추가');
 await input(m,'상대 추가 LP',50,'input',editor(m));await m.shell.navigate('cards');await flush();assert.ok(routes(m));assert.equal(field041(editor(m),'상대 추가 LP').value,'50');
 click(m,'선택한 구역과 덱 저장');await flush();assert.equal(m.store.queue.length,0);assert.equal(m.shell.drafts060.summary().dirtyCount,0);
 click(m,'미적용 설정 취소');await flush();await selectNew(m,'1장 · 일반 전투에 새 배치 추가');assert.equal(field041(editor(m),'상대 추가 LP').value,'0');
 assert.notEqual(field041(editor(m),'상대 추가 LP').getAttribute('aria-invalid'),'true');
});

test('071 unchecking a selected existing entry never removes the opponent or saves an unrelated dirty pool',async t=>{
 const m=await setup(t);m.canonical('chapter_role','1:battle').content.entries=[entry('old')];await m.refresh();await openBulk(m);await selectExisting(m,'old');
 const box=routes(m).querySelectorAll('.au-route-existing-row071').find(node=>node.textContent.includes('배치 old')).querySelector('input');box.checked=false;box.fire('change');await flush();assert.equal(viewRows(m).find(r=>r.entity_id==='1:battle').content.entries.length,1);
 m.shell.drafts060.stage('chapter_role','3:boss',{lp_bonus:1700});await flush();await selectNew(m,'2장 · 일반 전투에 새 배치 추가');
 click(m,'선택한 구역과 덱 저장');await drain(m);assert.deepEqual(m.remote.writes[0].changes.map(c=>c.entity_id),['2:battle']);assert.equal(m.shell.drafts060.summary().dirtyCount,1);assert.equal(m.canonical('chapter_role','3:boss').content.lp_bonus,0);
});

test('071 unfinished deck warning distinguishes input persistence from last-valid game publication',async t=>{
 const m=await setup(t);m.canonical('deck','deck-a').content.main=[];await m.refresh();await openBulk(m);await selectNew(m,'1장 · 일반 전투에 새 배치 추가');
 assert.match(routes(m).textContent,/마지막 유효 게임 편성/);click(m,'선택한 구역과 덱 저장');await drain(m);
 assert.match(routes(m).textContent,/입력값은 저장됐지만/);assert.match(routes(m).textContent,/마지막 유효 편성은 유지/);
});

test('071 reselecting a newly staged target edits its exact entry instead of replaying a create',async t=>{
 const m=await setup(t);await openBulk(m);await selectNew(m,'1장 · 일반 전투에 새 배치 추가');await input(m,'상대 추가 LP',500,'input',editor(m));
 click(m,'초안으로 보관');await flush();const id=viewRows(m).find(r=>r.entity_id==='1:battle').content.entries[0].entry_id;
 await selectNew(m,'1장 · 일반 전투에 새 배치 추가',false);await selectNew(m,'1장 · 일반 전투에 새 배치 추가');await input(m,'상대 추가 LP',900,'input',editor(m));
 click(m,'선택한 구역과 덱 저장');await drain(m);assert.equal(m.canonical('chapter_role','1:battle').content.entries.length,1);assert.equal(m.canonical('chapter_role','1:battle').content.entries[0].entry_id,id);assert.equal(m.canonical('chapter_role','1:battle').content.entries[0].encounter.lp_bonus,900);
});

test('071 unchecking a staged destination keeps its draft but excludes it from selected-route Save',async t=>{
 const m=await setup(t);await openBulk(m);await selectNew(m,'1장 · 일반 전투에 새 배치 추가');await input(m,'상대 추가 LP',500,'input',editor(m));click(m,'초안으로 보관');await flush();
 await selectNew(m,'1장 · 일반 전투에 새 배치 추가',false);await selectNew(m,'2장 · 엘리트에 새 배치 추가');click(m,'선택한 구역과 덱 저장');await drain(m);
 assert.deepEqual(m.remote.writes[0].changes.map(c=>c.entity_id),['2:elite']);assert.equal(m.canonical('chapter_role','1:battle').content.entries.length,0);assert.equal(m.shell.drafts060.summary().dirtyCount,1);assert.equal(viewRows(m).find(r=>r.entity_id==='1:battle').content.entries[0].encounter.lp_bonus,500);
});

test('071 an empty bulk preflight never blocks global Save of another existing draft',async t=>{
 const m=await setup(t);m.shell.drafts060.stage('deck','deck-b',{deck_name:'다른 덱 저장'});await m.shell.navigate('chapters');await flush();click(m,'여러 구역에 배치');await flush();assert.ok(routes(m));assert.ok(!routes(m).querySelector('.au-route-grid071'));
 click(m,'변경 사항 저장',footer(m));await drain(m);assert.deepEqual(m.remote.writes[0].changes.map(c=>c.entity_id),['deck-b']);assert.equal(m.canonical('deck','deck-b').content.deck_name,'다른 덱 저장');
});

test('071 applying only None preserves each exact character identity and excludes unrelated character drafts',async t=>{
 const m=await setup(t),old=entry('alternate');Object.assign(old.encounter,{shared_character_id:'character-yugi-alt',shared_skill_profile_id:'alt-profile',use_shared_skills:true});m.canonical('chapter_role','1:battle').content.entries=[old];await m.refresh();
 m.shell.drafts060.stage('character','character-yugi',{skills:[{kind:'lp_bonus',value:500}],skill_profiles:[]});await flush();await openBulk(m);await selectExisting(m,'alternate');
 await input(m,'특성',JSON.stringify(['character-yugi',null]),'change',common(m));await input(m,'특성','','change',common(m));click(m,'선택한 1개 배치에 공통 설정 적용');await flush();
 click(m,'선택한 구역과 덱 저장');await drain(m);const saved=m.canonical('chapter_role','1:battle').content.entries[0].encounter;
 assert.equal(saved.shared_character_id,'character-yugi-alt');assert.equal(saved.profile_id,'yugi');assert.equal(saved.use_shared_skills,false);assert.deepEqual(m.remote.writes[0].changes.map(c=>c.entity_id),['1:battle']);assert.equal(m.shell.drafts060.summary().dirtyCount,1);
});
