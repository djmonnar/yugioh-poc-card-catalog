import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {mountAuthoringShell039,writeSubject060} from '../authoring039-shell.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const clone=structuredClone,tick=()=>new Promise(resolve=>setImmediate(resolve));
const hash=value=>createHash('sha256').update(value).digest('hex');
async function flush(){await tick();await tick();}
const row=(type,id,content)=>({entity_type:type,entity_id:id,version:1,state:'saved',issues:[],content:clone(content)});
function mounted(t,section,{state=fixture041(),id=null}={}){
 state.user={id:'synthetic-save-audit'};const document=new Document041(),root=document.createElement('main');document.body.append(root);const writes=[],errors=[];
 const panels=createAuthoringPanels039({document,onError:error=>errors.push(error),onChange:(type,id,fields,options)=>{
  writes.push({type,id,fields:clone(fields),options:clone(options)});const item=state.entities.find(item=>item.entity_type===type&&item.entity_id===id);assert.ok(item,`Synthetic entity ${type}:${id} exists`);item.content={...item.content,...clone(fields)};panels.render(section,root,state);return Promise.resolve({kind:'synthetic-local-stage'});
 }});
 if(id)panels.selectEntity065(section,id);panels.render(section,root,state);t.after(()=>panels.destroy());
 return {state,document,root,panels,writes,errors,entity(type,id){return state.entities.find(item=>item.entity_type===type&&item.entity_id===id);}};
}
function control(m,key){const node=m.root.querySelectorAll('[data-edit-key]').find(node=>node.dataset.editKey===key);assert.ok(node,`Missing edit control: ${key}`);return node;}
function edit(node,value){node.focus();node.value=String(value);node.fire('input');}
function characterState(content){const state=fixture041();state.entities.push(row('character','synthetic-character',{name:'합성 특성 검사',portrait:'',skills:[],skill_profiles:[],...clone(content)}));return state;}

test('relic parameter edits across focused controls retain the first change in the second whole-object patch',async t=>{
 const m=mounted(t,'relics',{id:'blood_contract'}),lp=control(m,'relic:blood_contract.params.lp'),threshold=control(m,'relic:blood_contract.params.threshold');
 edit(lp,2);edit(threshold,5);await flush();
 assert.equal(lp.isConnected,true);assert.equal(threshold.isConnected,true);assert.equal(m.writes.length,2);
 assert.equal(m.writes[1].fields.params.lp,2);assert.equal(m.writes[1].fields.params.threshold,5);assert.equal(m.entity('relic','blood_contract').content.params.lp,2);assert.equal(m.errors.length,0);
});

test('event parameter editing retains earlier values when keyboard focus moves directly to another field',async t=>{
 const m=mounted(t,'events',{id:'golden_idol'}),lp=control(m,'event:golden_idol.params.lp'),gold=control(m,'event:golden_idol.params.gold');
 edit(lp,400);edit(gold,1500);await flush();
 assert.equal(m.writes.length,2);assert.equal(m.writes[1].fields.params.lp,400);assert.equal(m.writes[1].fields.params.gold,1500);assert.equal(m.errors.length,0);
});

test('base shared skill value and threshold edits retain both values while the editor defers rendering',async t=>{
 const state=characterState({skills:[{kind:'draw_once',value:1,threshold:100}]}),m=mounted(t,'characters',{state,id:'synthetic-character'}),value=control(m,'character:synthetic-character.skills.0.value'),threshold=control(m,'character:synthetic-character.skills.0.threshold');
 edit(value,2);edit(threshold,500);await flush();
 assert.equal(value.isConnected,true);assert.equal(threshold.isConnected,true);assert.deepEqual(m.writes.at(-1).fields.skills,[{kind:'draw_once',value:2,threshold:500}]);assert.equal(m.errors.length,0);
});

test('editing another profile keeps the first profile changes and preserves stable profile identifiers',async t=>{
 const state=characterState({skill_profiles:[{profile_id:'one',name:'첫 특성 묶음',skills:[{kind:'draw_once',value:1,threshold:100}]},{profile_id:'two',name:'둘째 특성 묶음',skills:[{kind:'draw_once',value:1,threshold:100}]}]}),m=mounted(t,'characters',{state,id:'synthetic-character'}),value=control(m,'character:synthetic-character.profile.one.0.value'),threshold=control(m,'character:synthetic-character.profile.two.0.threshold');
 edit(value,2);edit(threshold,500);await flush();
 const profiles=m.writes.at(-1).fields.skill_profiles;assert.deepEqual(profiles.map(item=>item.profile_id),['one','two']);assert.equal(profiles[0].skills[0].value,2);assert.equal(profiles[1].skills[0].threshold,500);assert.equal(m.errors.length,0);
});

test('renaming a skill profile then changing its skill preserves the new name while both controls stay mounted',async t=>{
 const state=characterState({skill_profiles:[{profile_id:'one',name:'원래 이름',skills:[{kind:'draw_once',value:1,threshold:100}]}]}),m=mounted(t,'characters',{state,id:'synthetic-character'}),name=control(m,'character:synthetic-character.profile.one.name'),value=control(m,'character:synthetic-character.profile.one.0.value');
 edit(name,'바뀐 특성 묶음');edit(value,3);await flush();
 const profile=m.writes.at(-1).fields.skill_profiles[0];assert.equal(profile.profile_id,'one');assert.equal(profile.name,'바뀐 특성 묶음');assert.equal(profile.skills[0].value,3);assert.equal(m.errors.length,0);
});

test('counted shared grave entries retain previous row changes when focus moves between counts',async t=>{
 const state=characterState({}),cards=state.bootstrap.catalog.cards.filter(card=>card.playable&&!card.token&&!(card.native_type&(0x40|0x2000|0x800000|0x4000000))).slice(0,2),reference=card=>({slot:card.web_slot,internal_id:card.source_id,identity_key:card.identity_key,name_ko:card.name});
 state.entities.find(item=>item.entity_id==='synthetic-character').content.skills=[{kind:'start_grave',entries:cards.map(card=>({card:reference(card),count:1}))}];
 const m=mounted(t,'characters',{state,id:'synthetic-character'}),first=control(m,'character:synthetic-character.skills.0.grave.0'),second=control(m,'character:synthetic-character.skills.0.grave.1');
 edit(first,2);edit(second,3);await flush();
 const entries=m.writes.at(-1).fields.skills[0].entries;assert.deepEqual(entries.map(item=>item.count),[2,3]);assert.deepEqual(entries.map(item=>item.card.internal_id),cards.map(card=>card.source_id));assert.equal(m.errors.length,0);
});

test('a shared character at ten skill profiles cannot add an eleventh profile',async t=>{
 const state=characterState({skill_profiles:Array.from({length:10},(_,i)=>({profile_id:`profile-${i}`,name:`합성 묶음 ${i+1}`,skills:[]}))}),m=mounted(t,'characters',{state,id:'synthetic-character'}),add=button041(m.root,'특성 묶음 추가');
 assert.ok(!add||add.disabled,'Profile creation is unavailable at the actual ten-profile limit');add?.click();await flush();assert.equal(m.writes.length,0);assert.equal(m.entity('character','synthetic-character').content.skill_profiles.length,10);
});

test('shared grave card quantities use their twelve-card limit rather than the deck copy limit',async t=>{
 const state=characterState({}),card=state.bootstrap.catalog.cards.find(card=>card.playable&&!card.token&&!(card.native_type&(0x40|0x2000|0x800000|0x4000000))),reference={slot:card.web_slot,internal_id:card.source_id,identity_key:card.identity_key,name_ko:card.name};
 state.entities.find(item=>item.entity_id==='synthetic-character').content.skills=[{kind:'start_grave',entries:[{card:reference,count:1}]}];
 const m=mounted(t,'characters',{state,id:'synthetic-character'}),count=control(m,'character:synthetic-character.skills.0.grave.0');edit(count,12);await flush();
 assert.equal(m.writes.length,1);assert.equal(m.writes[0].fields.skills[0].entries[0].count,12);edit(count,13);await flush();assert.equal(m.writes.length,1);assert.equal(count.getAttribute('aria-invalid'),'true');
});

test('grave quantities can reallocate a freed budget across mounted inputs and reject a thirteenth total card',async t=>{
 const state=characterState({}),cards=state.bootstrap.catalog.cards.filter(card=>card.playable&&!card.token&&!(card.native_type&(0x40|0x2000|0x800000|0x4000000))).slice(0,2),reference=card=>({slot:card.web_slot,internal_id:card.source_id,identity_key:card.identity_key,name_ko:card.name});
 state.entities.find(item=>item.entity_id==='synthetic-character').content.skills=[{kind:'start_grave',entries:cards.map(card=>({card:reference(card),count:6}))}];const m=mounted(t,'characters',{state,id:'synthetic-character'}),first=control(m,'character:synthetic-character.skills.0.grave.0'),second=control(m,'character:synthetic-character.skills.0.grave.1');
 edit(first,1);edit(second,11);await flush();assert.equal(m.writes.length,2);assert.deepEqual(m.writes[1].fields.skills[0].entries.map(entry=>entry.count),[1,11]);
 edit(second,12);await flush();assert.equal(m.writes.length,2);assert.equal(second.getAttribute('aria-invalid'),'true');assert.match(second.parentElement.textContent,/12/);assert.deepEqual(m.entity('character','synthetic-character').content.skills[0].entries.map(entry=>entry.count),[1,11]);
});

for(const id of ['card_enhancement','card_sealing'])test(`editing legacy event ${id} includes a string effect companion while retaining the requested title`,async t=>{
 const state=fixture041(),entity=state.entities.find(item=>item.entity_type==='event'&&item.entity_id===id);entity.content.effect=null;
 const m=mounted(t,'events',{state,id}),title=field041(m.root,'제목');assert.ok(title);edit(title,'새 합성 이벤트 제목');await flush();
 assert.equal(m.writes.length,1);assert.equal(m.writes[0].fields.title,'새 합성 이벤트 제목');assert.equal(m.writes[0].fields.effect,'');assert.equal(entity.content.title,'새 합성 이벤트 제목');assert.equal(entity.content.effect,'');assert.equal(m.errors.length,0);
});

test('an event edit keeps an existing string effect unchanged',async t=>{
 const state=fixture041(),entity=state.entities.find(item=>item.entity_type==='event'&&item.entity_id==='card_enhancement');entity.content.effect='유지할 선택 결과';
 const m=mounted(t,'events',{state,id:'card_enhancement'});edit(field041(m.root,'제목'),'이름만 변경');await flush();
 assert.equal(entity.content.effect,'유지할 선택 결과');assert.ok(m.writes[0].fields.effect===undefined||m.writes[0].fields.effect==='유지할 선택 결과');assert.equal(m.errors.length,0);
});

test('card category editing refuses a thirteenth category before creating an invalid draft',async t=>{
 const state=fixture041(),card=normalizeCatalog039(state)[0],tags=Array.from({length:13},(_,i)=>`합성 카테고리 ${i+1}`);for(const name of tags)state.entities.push(row('category',name,{name,archived:false}));state.entities.push(row('card_annotation',String(card.source_id),{tags:tags.slice(0,12),links:[]}));
 const m=mounted(t,'cards',{state});m.panels.openCard(normalizeCatalog039(state)[0]);const dialog=m.document.querySelector('.au-card-dialog'),thirteenth=field041(dialog,tags[12]);assert.ok(thirteenth);thirteenth.checked=true;thirteenth.fire('change');await flush();
 assert.equal(m.writes.length,0);assert.equal(m.entity('card_annotation',String(card.source_id)).content.tags.length,12);assert.ok(thirteenth.disabled||m.errors.some(error=>/12/.test(error.message)),'The category limit is visible or explained');
});

test('related-card editing refuses a twenty-first link before creating an invalid draft',async t=>{
 const state=fixture041(),cards=normalizeCatalog039(state),card=cards[0],linked=cards.slice(1,21),candidate=cards[21];state.entities.push(row('card_annotation',String(card.source_id),{tags:[],links:linked.map(item=>({slot:item.slot,identity_key:item.identity_key}))}));
 const m=mounted(t,'cards',{state});m.panels.openCard(normalizeCatalog039(state)[0]);const dialog=m.document.querySelector('.au-card-dialog'),pick=dialog.querySelectorAll('.au-card-pick').find(node=>node.textContent===candidate.name_ko);assert.ok(pick);pick.click();await flush();
 assert.equal(m.writes.length,0);assert.equal(m.entity('card_annotation',String(card.source_id)).content.links.length,20);assert.ok(pick.disabled||m.errors.some(error=>/20/.test(error.message)),'The link limit is visible or explained');
});

test('a stale inherited related-card reference remains visible and can be removed without changing categories',async t=>{
 const state=fixture041(),card=normalizeCatalog039(state)[0];state.entities.push(row('category','유지할 분류',{name:'유지할 분류',archived:false}),row('card_annotation',String(card.source_id),{tags:['유지할 분류'],links:[{slot:9999,identity_key:'a'.repeat(64)}]}));
 const m=mounted(t,'cards',{state});m.panels.openCard(normalizeCatalog039(state)[0]);const dialog=m.document.querySelector('.au-card-dialog');assert.match(dialog.textContent,/사용할 수 없는 관련 카드 연결/);const remove=button041(dialog,'정보가 바뀐 관련 카드 · 9999번 연결 제거');assert.ok(remove);assert.equal(remove.closest('details').open,true);
 remove.click();await flush();assert.equal(m.writes.length,1);assert.deepEqual(m.writes[0].fields,{links:[]});assert.deepEqual(m.entity('card_annotation',String(card.source_id)).content.tags,['유지할 분류']);assert.equal(m.errors.length,0);
});

test('a related-card edit after a deferred background refresh preserves the newer category sibling',async t=>{
 const state=fixture041(),cards=normalizeCatalog039(state),card=cards[0],candidate=cards[1];state.entities.push(row('category','이전 분류',{name:'이전 분류',archived:false}),row('category','새 분류',{name:'새 분류',archived:false}),row('card_annotation',String(card.source_id),{tags:['이전 분류'],links:[]}));
 const m=mounted(t,'cards',{state});m.panels.openCard(normalizeCatalog039(state)[0]);const dialog=m.document.querySelector('.au-card-dialog'),search=field041(dialog,'대상 카드 검색');assert.ok(search);search.focus();m.entity('card_annotation',String(card.source_id)).content.tags=['새 분류'];m.panels.render('cards',m.root,m.state);
 assert.equal(search.isConnected,true);const pick=dialog.querySelectorAll('.au-card-pick').find(node=>node.textContent===candidate.name_ko);assert.ok(pick);pick.click();await flush();assert.equal(m.writes.length,1);assert.deepEqual(m.writes[0].fields,{links:[{slot:candidate.slot,identity_key:candidate.identity_key}]});assert.deepEqual(m.entity('card_annotation',String(card.source_id)).content.tags,['새 분류']);
});

test('a category edit after a deferred background refresh preserves a newer related-card sibling',async t=>{
 const state=fixture041(),cards=normalizeCatalog039(state),card=cards[0],candidate=cards[1],links=[{slot:candidate.slot,identity_key:candidate.identity_key}];state.entities.push(row('category','새로 고를 분류',{name:'새로 고를 분류',archived:false}),row('card_annotation',String(card.source_id),{tags:[],links:[]}));
 const m=mounted(t,'cards',{state});m.panels.openCard(normalizeCatalog039(state)[0]);const dialog=m.document.querySelector('.au-card-dialog'),search=field041(dialog,'카테고리 검색');assert.ok(search);search.focus();m.entity('card_annotation',String(card.source_id)).content.links=clone(links);m.panels.render('cards',m.root,m.state);
 const category=field041(dialog,'새로 고를 분류');assert.ok(category);category.checked=true;category.fire('change');await flush();assert.equal(m.writes.length,1);assert.deepEqual(m.writes[0].fields,{tags:['새로 고를 분류']});assert.deepEqual(m.entity('card_annotation',String(card.source_id)).content.links,links);
});

// The form contract is a public capabilities-only readback. All rows, user IDs,
// payloads and ACKs below are synthetic; these checks never connect to a DB.
const capabilities066=JSON.parse(fs.readFileSync(new URL('./fixtures/authoring-capabilities066.json',import.meta.url),'utf8'));
const score066={floorScore:10,battleScore:10,eliteScore:10,bossScore:10,chapterClearScore:10,completionScore:10,scorePerPoint:1,packPrice:100,packCards:5,urWeight:5,srWeight:15,rWeight:30,nWeight:50,ownershipMode:0,unlockedTypeCopies:1};
const map066={schema:1,battle_percent:50,event_percent:30,shop_percent:10,rest_percent:10,elite_percent:10};
const card066={source_id:1,code:10001,identity_key:hash('synthetic-card-one'),web_slot:1,native_type:1,playable:true,token:false,name:'합성 검사 카드',name_english:'Synthetic Card',description:'합성 설명',rarity:'N',stock:true,draw_enabled:true,normal_limit:3,speed_limit:null,image_url:'assets/synthetic.png'};
function syntheticRows066(){return [
 row('card_display','1',{name:card066.name,name_english:card066.name_english,description:card066.description}),row('card_setting','1',{rarity:'N',stock:true,draw_enabled:true}),row('card_annotation','1',{tags:[],links:[]}),row('card_limit','1',{normal_limit:null,speed_limit:null,frozen_normal_limit:3,frozen_speed_limit:null}),
 row('category','합성 분류',{name:'합성 분류',archived:false}),row('category_group','category-group-synthetic',{name:'합성 묶음',categories:['합성 분류'],archived:false}),row('category_group_order','main',{group_ids:['category-group-synthetic']}),
 row('deck','deck-a',{deck_name:'합성 편집 덱',banlist_enabled:true,main:[],extra:[]}),row('chapter_role','1:battle',{chapter:1,role:'battle',lp_bonus:0,entries:[]}),row('starter_list','main',{entries:[{starter_id:'starter-a',name:'합성 시작 덱',deck_id:'deck-a'}]}),
 row('map_rules','main',map066),row('character','synthetic-character',{name:'합성 캐릭터',portrait:'',skills:[],skill_profiles:[]}),
 row('relic','blood_contract',{id:'blood_contract',kind:'blood_contract',name:'합성 유물',description:'합성 유물 설명',rarity:'N',price:100,enabled:true,shopEnabled:true,weight:1,params:{lp:100,threshold:100,opening_draw:1}}),
 row('event','card_enhancement',{id:'card_enhancement',kind:'card_enhancement',title:'합성 이벤트',name:'합성 이벤트',description:'합성 이벤트 설명',effect:'합성 선택 결과',enabled:true,weight:1,params:{amount:1}}),
 row('shop_rules','main',{schema:1,regular_card_count:5,relic_count:2,reroll_base:25,reroll_step:25,fusion_pair_enabled:true,ritual_pair_enabled:true,fixed_source_ids:[]}),row('meta_pack','pack-synthetic',{id:'pack-synthetic',name:'합성 카드팩',description:'합성 카드팩 설명',enabled:true,sourceIds:[1]}),row('meta_score','main',score066)
];}
async function storeHarness066(t){
 const remote={rows:syntheticRows066(),revision:1,writes:[]},payload=JSON.stringify({catalog:[card066],deck_rules035:{rows:[]},opponents:{opponents:[],chapters:[]},starters:{starters:[]},content022:{relics:[],events:[]},meta017:{},characters:[],shop_rules:{}});
 const recovery={source_key:'poc-ai-decks-v1',raw_json:'{"synthetic":true}'};recovery.sha256=hash(recovery.raw_json);const recoveryId=hash(recovery.source_key+'\n'+recovery.raw_json);
 remote.rows.push(row('recovery_archive',recoveryId,{source_key:recovery.source_key,bytes:recovery.raw_json.length}));
 const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},capabilities:clone(capabilities066),catalog:{cards:[clone(card066)]},authoring:{entities:clone(remote.rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:1,metadata_revision:'1',identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}});
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-matrix-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
  if(name==='poc_bootstrap039')return {data:wire()};if(name==='poc_read_recovery039'){assert.equal(args.p_id,recoveryId);return {data:clone(recovery)};}
  assert.equal(name,'poc_apply_intent039');const intent=clone(args.p_intent);remote.writes.push(intent);assert.equal(intent.expected_project_revision,remote.revision);assert.ok(intent.changes.length>=1&&intent.changes.length<=32);
  const changes=intent.changes.map(change=>{const item=remote.rows.find(item=>item.entity_type===change.entity_type&&item.entity_id===change.entity_id);assert.ok(item);assert.equal(change.expected_entity_version,item.version);return {change,item};});remote.revision++;
  for(const {change,item} of changes){item.content={...item.content,...clone(change.fields)};item.version=remote.revision;}
  return {data:{schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,entities:changes.map(({item})=>clone(item)),game_revision:1,game_source_fingerprint:hash(payload)}};
 }};
 const outbox=new Map(),storage={getItem:key=>outbox.get(key)??null,setItem:(key,value)=>outbox.set(key,String(value)),removeItem:key=>outbox.delete(key)};const store=new AuthoringStore039({client,storage,crypto:webcrypto,events:{},debounceMs:100000,idleRefreshMs:100000,pollMs:0});await store.start();
 store.flushPending083=()=>{}; // This fixture verifies submitted state before manually sending its queued intent.
 t.after(()=>store.stop());return {store,remote,recoveryId};
}
const menuWrites066=[
 ['카드 도감','card_display','1',{name:'바꾼 합성 카드'}],['카드 등급','card_setting','1',{rarity:'R'}],['카드 분류','card_annotation','1',{tags:['합성 분류']}],['카드 제한','card_limit','1',{normal_limit:1}],
 ['카테고리','category','합성 분류',{name:'바꾼 분류'}],['카테고리 묶음','category_group','category-group-synthetic',{name:'바꾼 묶음'}],['묶음 순서','category_group_order','main',{group_ids:[]}],
 ['덱 만들기','deck','deck-a',{deck_name:'바꾼 합성 덱'}],['장별 적 편성','chapter_role','1:battle',{lp_bonus:100}],['맵 분포','map_rules','main',{battle_percent:40,event_percent:40,shop_percent:10,rest_percent:10,elite_percent:20}],['시작 덱','starter_list','main',{entries:[{starter_id:'starter-a',name:'바꾼 시작 덱',deck_id:'deck-a'}]}],
 ['캐릭터','character','synthetic-character',{name:'바꾼 캐릭터'}],['유물','relic','blood_contract',{name:'바꾼 유물'}],['이벤트','event','card_enhancement',{title:'바꾼 이벤트'}],['상점','shop_rules','main',{reroll_base:30}],['카드팩','meta_pack','pack-synthetic',{description:'바꾼 카드팩 설명'}],['점수·보상','meta_score','main',{floorScore:20}]
];
for(const [menu,type,id,fields] of menuWrites066)test(`${menu}: supported changes traverse the real queue and synthetic ACK once`,async t=>{
 const {store,remote}=await storeHarness066(t);const before=clone(store.getRow(type,id).content),done=store.patch(type,id,fields);assert.equal(remote.writes.length,0);assert.equal(store.queue.length,1);assert.deepEqual(store.queue[0].fields,fields);
 await store.drain();await done;assert.equal(remote.writes.length,1);assert.equal(store.queue.length,0);assert.equal(store.phase,'ready');const canonical=remote.rows.find(item=>item.entity_type===type&&item.entity_id===id).content;assert.deepEqual(canonical,{...before,...fields});assert.deepEqual(store.getRow(type,id).content,canonical);
});

test('이전 자료: reading preserved content verifies its hash and never becomes a write',async t=>{
 const {store,remote,recoveryId}=await storeHarness066(t),recovery=await store.readRecovery(recoveryId);assert.equal(recovery.raw_json,'{"synthetic":true}');assert.equal(remote.writes.length,0);assert.equal(store.queue.length,0);assert.equal(remote.revision,1);
});

const rejectedChanges066=[
 {name:'rarity weights must total one hundred',type:'meta_score',id:'main',fields:{urWeight:6},expectedField:'urWeight'},
 {name:'blood contract threshold must cover its LP cost',type:'relic',id:'blood_contract',fields:{params:{lp:100,threshold:50,opening_draw:1}},expectedField:'params'},
 {name:'characters can have at most ten profiles',type:'character',id:'synthetic-character',fields:{skill_profiles:Array.from({length:11},(_,i)=>({profile_id:`profile-${i}`,name:`묶음${i}`,skills:[]}))},expectedField:'skill_profiles'},
 {name:'legacy shared skill arrays must be paired',type:'character',id:'synthetic-character',prepare:store=>{delete store.getRow('character','synthetic-character').content.skills;delete store.getRow('character','synthetic-character').content.skill_profiles;},fields:{skills:[{kind:'lp_bonus',value:100}]},expectedField:'skill_profiles'},
 {name:'event effect must be string after merging',type:'event',id:'card_enhancement',fields:{effect:null},expectedField:'effect'},
 {name:'fixed shop cards cannot exceed regular slots',type:'shop_rules',id:'main',prepare:store=>{const shop=store.getRow('shop_rules','main').content;shop.fixed_source_ids=[1,2];store.bootstrap.catalog.cards.push({...clone(card066),source_id:2,code:10002,identity_key:hash('synthetic-card-two')});},fields:{regular_card_count:1},expectedField:'regular_card_count'},
 ...['stock','normal','speed','extra'].map(kind=>({name:`fixed shop cards reject ${kind} ineligible cards`,type:'shop_rules',id:'main',prepare:store=>{if(kind==='stock')store.getRow('card_setting','1').content.stock=false;else if(kind==='normal')store.getRow('card_limit','1').content.normal_limit=0;else if(kind==='speed')store.getRow('card_limit','1').content.speed_limit=0;else store.bootstrap.catalog.cards[0].native_type=0x40;},fields:{fixed_source_ids:[1]},expectedField:'fixed_source_ids'}))
];
for(const issue of rejectedChanges066)test(`preflight: ${issue.name} without creating a pending RPC`,async t=>{
 const {store,remote}=await storeHarness066(t);issue.prepare?.(store);const before=JSON.stringify(store.queue),revision=store.bootstrap.project_revision;
 assert.throws(()=>store.patch(issue.type,issue.id,clone(issue.fields)),error=>{
  assert.equal(error.authoringIssue066?.entityType,issue.type);assert.equal(error.authoringIssue066?.entityId,issue.id);assert.ok(error.authoringIssue066?.fields.includes(issue.expectedField),`Identify ${issue.expectedField}`);return true;
 });
 assert.equal(JSON.stringify(store.queue),before);assert.equal(store.bootstrap.project_revision,revision);assert.equal(store.phase,'ready');assert.equal(remote.writes.length,0);assert.equal(remote.revision,1);
});

test('a synchronous preflight refusal returns manual input to its editable draft and leaves the write queue empty',async t=>{
 const {store,remote}=await storeHarness066(t),document=new Document041(),root=document.createElement('main');document.body.append(root);const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},window={location:{href:'https://example.test/index.html?section=balance'},history:{pushState(){}},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,scrollTo(){}};
 const shell=mountAuthoringShell039({root,store,manualSave:true,draftStorage:storage,document,window});t.after(()=>shell.destroy());shell.drafts060.stage('meta_score','main',{urWeight:6});await flush();
 await assert.rejects(shell.drafts060.saveAll(),error=>error.authoringIssue066?.entityType==='meta_score');await flush();
 const summary=shell.drafts060.summary();assert.equal(summary.saving,false);assert.equal(summary.submittedCount,0);assert.equal(summary.dirtyCount,1);assert.equal(summary.items[0].fields.urWeight,6);assert.equal(store.queue.length,0);assert.equal(remote.writes.length,0);assert.equal(remote.revision,1);assert.equal(store.phase,'ready');
});

test('a local save validation notice names its fields, opens the correct menu and clears when that input is corrected',async t=>{
 const {store,remote}=await storeHarness066(t),document=new Document041(),root=document.createElement('main');document.body.append(root);const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},window={location:{href:'https://example.test/index.html?section=balance'},history:{pushState(_state,_title,url){window.location.href=new URL(url,window.location.href).href;}},addEventListener(){},removeEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){}};
 const shell=mountAuthoringShell039({root,store,manualSave:true,draftStorage:storage,document,window});t.after(()=>shell.destroy());const weight=control({root},'meta_score:main.urWeight');edit(weight,6);weight.blur();await flush();shell.navigate('chapters');
 button041(root.querySelector('.au-manual-save060'),'변경 사항 저장').click();await flush();
 const notice=root.querySelector('.au-notice');assert.equal(notice.hidden,false);assert.match(notice.querySelector('.au-write-subject060').textContent,/점수·보상/);assert.match(notice.querySelector('.au-write-subject060').textContent,/UR/);assert.match(notice.textContent,/100/);assert.match(root.querySelector('.au-save-status').textContent,/입력 확인 필요/);
 assert.equal(store.phase,'ready');assert.equal(store.error,null);assert.equal(store.queue.length,0);assert.equal(remote.writes.length,0);assert.equal(shell.drafts060.summary().dirtyCount,1);assert.equal(shell.drafts060.summary().submittedCount,0);
 button041(notice,'수정할 항목 열기').click();await flush();assert.equal(new URL(window.location.href).searchParams.get('section'),'balance');const corrected=control({root},'meta_score:main.urWeight');assert.equal(corrected.value,'6');edit(corrected,5);await flush();
 assert.equal(notice.hidden,true);assert.doesNotMatch(root.querySelector('.au-save-status').textContent,/입력 확인 필요/);assert.equal(shell.drafts060.summary().dirtyCount,0);assert.equal(remote.writes.length,0);assert.equal(remote.revision,1);
});

test('fixed shop eligibility uses the strictest playable alias-family limit',async t=>{
 const {store,remote}=await storeHarness066(t);store.bootstrap.catalog.cards.push({...clone(card066),source_id:2,code:10002,alias:card066.code,identity_key:hash('synthetic-alias'),normal_limit:0});
 assert.throws(()=>store.patch('shop_rules','main',{fixed_source_ids:[1]}),error=>error.authoringIssue066?.fields.includes('fixed_source_ids'));assert.equal(store.queue.length,0);assert.equal(remote.writes.length,0);assert.equal(remote.revision,1);
});

test('a nonplayable token in an alias family cannot block an otherwise eligible shop card',async t=>{
 const {store,remote}=await storeHarness066(t);store.bootstrap.catalog.cards.push({...clone(card066),source_id:2,code:10002,alias:card066.code,identity_key:hash('synthetic-alias-token'),normal_limit:0,token:true,playable:false});
 const done=store.patch('shop_rules','main',{fixed_source_ids:[1]});await store.drain();await done;assert.equal(remote.writes.length,1);assert.deepEqual(store.getRow('shop_rules','main').content.fixed_source_ids,[1]);
});

for(const portrait of ['', 'assets/characters/weevil.png','content-packs/characters/weevil.webp','https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/poc-story-assets/owner/portrait.jpg'])test(`portrait preflight accepts an allowed project/upload path: ${portrait||'(empty)'}`,async t=>{
 const {store,remote}=await storeHarness066(t);const done=store.patch('character','synthetic-character',{portrait});await store.drain();await done;assert.equal(store.getRow('character','synthetic-character').content.portrait,portrait);assert.equal(remote.writes.length,1);
});

for(const portrait of ['https://example.test/portrait.png','assets/../secret.png','assets/portrait.svg','javascript:alert(1)','https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/poc-story-assets/../x.png'])test(`portrait preflight refuses an unsupported or traversing path: ${portrait}`,async t=>{
 const {store,remote}=await storeHarness066(t);assert.throws(()=>store.patch('character','synthetic-character',{portrait}),error=>error.authoringIssue066?.fields.includes('portrait'));assert.equal(store.queue.length,0);assert.equal(remote.writes.length,0);assert.equal(remote.revision,1);assert.equal(store.getRow('character','synthetic-character').content.portrait,'');
});

test('the chapter footer hides only when idle and remains available for drafts, pending writes and errors',async t=>{
 const {store,remote}=await storeHarness066(t),document=new Document041(),root=document.createElement('main');document.body.append(root);const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},window={location:{href:'https://example.test/index.html?section=chapters'},history:{pushState(_state,_title,url){window.location.href=new URL(url,window.location.href).href;}},addEventListener(){},removeEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){}};
 const shell=mountAuthoringShell039({root,store,manualSave:true,draftStorage:storage,document,window});t.after(()=>shell.destroy());const footer=root.querySelector('.au-manual-save060'),app=root.querySelector('.au-app');assert.equal(footer.hidden,true);assert.equal(app.classList.contains('au-chapter-idle066'),true);
 shell.navigate('characters');assert.equal(footer.hidden,false,'Other menus retain their existing footer behavior');shell.navigate('chapters');assert.equal(footer.hidden,true);
 button041(root,'구역 LP 설정').click();const lp=field041(root,'구역 추가 LP');assert.ok(lp);edit(lp,100);await flush();assert.equal(footer.hidden,false);assert.equal(button041(footer,'변경 사항 저장').disabled,false);assert.equal(app.classList.contains('au-chapter-idle066'),false);
 lp.blur();shell.navigate('decks','deck-a');edit(field041(root,'덱 이름'),'다른 메뉴에서 고친 덱');await flush();shell.navigate('chapters');assert.equal(footer.hidden,false);assert.equal(shell.drafts060.summary().dirtyCount,2);
 button041(footer,'변경 사항 저장').click();await flush();assert.equal(footer.hidden,false);assert.equal(store.snapshot().pending,1);assert.equal(button041(footer,'저장 확인 중…').disabled,true);
 await store.drain();await flush();assert.equal(shell.drafts060.summary().saving,false);assert.equal(shell.drafts060.summary().dirtyCount,0);assert.equal(store.snapshot().pending,0);assert.equal(remote.writes.length,1);assert.deepEqual(remote.writes[0].changes.map(change=>change.entity_type),['deck','chapter_role']);assert.equal(footer.hidden,true);assert.equal(app.classList.contains('au-chapter-idle066'),true);
 store.setError(Error('합성 서버 연결 오류'));await flush();assert.equal(store.snapshot().pending,0);assert.equal(footer.hidden,false,'A server error remains visible even with no local drafts');assert.equal(app.classList.contains('au-chapter-idle066'),false);store.retry();await flush();assert.equal(footer.hidden,true);
 void store.patch('deck','deck-a',{deck_name:'저장 대기 덱'});await flush();assert.equal(store.snapshot().pending,1);assert.equal(footer.hidden,false,'An existing queued write keeps the footer visible');assert.equal(app.classList.contains('au-chapter-idle066'),false);
});

test('a chapter skill validation failure names its encounter and opens that role and entry rather than the first',async t=>{
 const {store,remote}=await storeHarness066(t),encounter=name=>({name,deck_name:'합성 공유 덱',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false}),first=encounter('첫 번째 정상 상대'),second=encounter('두 번째 오류 상대');
 second.skills=[{kind:'draw_once',value:4,threshold:100,sourceId:-1,position:0,entries:[]}];remote.rows.push(row('chapter_role','2:boss',{chapter:2,role:'boss',lp_bonus:0,entries:[{entry_id:'enc-first',deck_id:'deck-a',weight:1,encounter:first},{entry_id:'enc-invalid-second',deck_id:'deck-a',weight:1,encounter:second}]}));await store.refresh(true);
 assert.throws(()=>store.patch('chapter_role','2:boss',{lp_bonus:100}),error=>{assert.equal(error.authoringIssue066?.entryId,'enc-invalid-second');assert.match(error.message,/두 번째 오류 상대/);assert.deepEqual(error.authoringIssue066.fields,['entries']);return true;});assert.match(writeSubject060(store.snapshot(),{type:'chapter_role',id:'2:boss',fields:['entries']}).title,/2장.*보스/);
 const document=new Document041(),root=document.createElement('main');document.body.append(root);const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},window={location:{href:'https://example.test/index.html?section=chapters'},history:{pushState(_state,_title,url){window.location.href=new URL(url,window.location.href).href;}},addEventListener(){},removeEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){}};
 const shell=mountAuthoringShell039({root,store,manualSave:true,draftStorage:storage,document,window});t.after(()=>shell.destroy());assert.match(root.querySelector('.au-chapter-context066').textContent,/1장/);shell.drafts060.stage('chapter_role','2:boss',{lp_bonus:100});await flush();button041(root.querySelector('.au-manual-save060'),'변경 사항 저장').click();await flush();
 const notice=root.querySelector('.au-notice');assert.equal(notice.hidden,false);assert.match(notice.querySelector('.au-write-subject060').textContent,/2장.*보스/);assert.match(notice.textContent,/두 번째 오류 상대/);assert.equal(store.queue.length,0);assert.equal(remote.writes.length,0);assert.equal(store.phase,'ready');
 button041(notice,'수정할 항목 열기').click();await flush();assert.match(root.querySelector('.au-chapter-context066').textContent,/2장.*보스/);const editor=root.querySelector('.au-encounter-editor066');assert.equal(editor.dataset.entryId,'enc-invalid-second');assert.equal(root.querySelector('.au-chapter-workspace066').dataset.mode,'editor');assert.match(editor.querySelector('h2').textContent,/두 번째 오류 상대/);assert.equal(field041(editor,'드로우 장수').value,'4');assert.equal(store.queue.length,0);assert.equal(remote.writes.length,0);
});

test('account changes clear private preflight messages while keeping each owner draft isolated',async t=>{
 const {store,remote}=await storeHarness066(t),ownerA='synthetic-matrix-editor',ownerB='synthetic-other-editor',baseEncounter={name:'공통 상대',deck_name:'합성 공유 덱',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false},canonical=row('chapter_role','2:boss',{chapter:2,role:'boss',lp_bonus:0,entries:[{entry_id:'enc-owned',deck_id:'deck-a',weight:1,encounter:baseEncounter}]});remote.rows.push(canonical);await store.refresh(true);
 const entriesA=clone(canonical.content.entries),entriesB=clone(canonical.content.entries);entriesA[0].encounter.name='계정 A의 비공개 오류 상대';entriesA[0].encounter.skills=[{kind:'draw_once',value:4,threshold:100,sourceId:-1,position:0,entries:[]}];entriesB[0].encounter.name='계정 B의 저장 전 상대';
 const document=new Document041(),root=document.createElement('main');document.body.append(root);const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},window={location:{href:'https://example.test/index.html?section=chapters'},history:{pushState(_state,_title,url){window.location.href=new URL(url,window.location.href).href;}},addEventListener(){},removeEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){}};
 values.set(`poc-authoring060-drafts:${encodeURIComponent(ownerB)}`,JSON.stringify({schema:1,owner:ownerB,items:[{type:'chapter_role',id:'2:boss',operation:'patch',baseVersion:1,baseContent:clone(canonical.content),fields:{entries:entriesB},submitted:null}]}));
 const shell=mountAuthoringShell039({root,store,manualSave:true,draftStorage:storage,document,window});t.after(()=>shell.destroy());shell.drafts060.stage('chapter_role','2:boss',{entries:entriesA});await flush();button041(root.querySelector('.au-manual-save060'),'변경 사항 저장').click();await flush();assert.match(root.querySelector('.au-notice').textContent,/계정 A의 비공개 오류 상대/);assert.equal(remote.writes.length,0);
 await store.acceptSession({user:{id:ownerB}});await flush();assert.equal(root.querySelector('.au-notice').hidden,true);assert.doesNotMatch(root.querySelector('.au-notice').textContent,/계정 A/);const toast=root.querySelector('.au-toast');assert.ok(toast.hidden||!toast.textContent.includes('계정 A'),'Private validation messages cannot remain visible in another account');
 const draftB=shell.drafts060.summary().items.find(item=>item.id==='2:boss');assert.ok(draftB);assert.equal(draftB.content.entries[0].encounter.name,'계정 B의 저장 전 상대');assert.equal(draftB.content.entries[0].encounter.skills.length,0);
 await store.acceptSession({user:{id:ownerA}});await flush();assert.equal(root.querySelector('.au-notice').hidden,true);const draftA=shell.drafts060.summary().items.find(item=>item.id==='2:boss');assert.ok(draftA);assert.equal(draftA.content.entries[0].encounter.name,'계정 A의 비공개 오류 상대');assert.equal(draftA.content.entries[0].encounter.skills[0].value,4);
 button041(root,'2장').click();root.querySelector('.au-entry-pick066').click();const editor=root.querySelector('.au-encounter-editor066');assert.equal(field041(editor,'상대 이름').value,'계정 A의 비공개 오류 상대');assert.equal(field041(editor,'드로우 장수').value,'4');assert.equal(root.querySelector('.au-notice').hidden,true);assert.equal(store.queue.length,0);assert.equal(remote.writes.length,0);
});
