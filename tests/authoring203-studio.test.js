import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {AuthoringStore039, PROJECT039, IDENTITY039} from '../authoring039-store.js';
import {createAuthoringPanels039} from '../authoring039-panels.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {createPreviewClient170} from '../authoring170-preview.js';
import {TRAIT_KINDS199, AURA_DEFAULT199} from '../authoring199-traits.js';
import {traitLine203, traitLines203, traitValues203, encounterTraitText203, sharedTraitSource203} from '../authoring203-trait-summary.js';
import {Document041, fixture041, field041, button041} from './authoring041-test-dom.js';

// (203) 대표님 2026-11-25 제작소 요청: 시작 덱 확인이 너무 길다, 특성 칸이 늘 열려 있다, "공용 특성" 대신 실제 특성 이름과 값,
// 캐릭터 탭에서 특성을 눌러도 적용이 안 되거나 화면이 넘어간다, Supabase 전송량.
const copy=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const tick=()=>new Promise(resolve=>setImmediate(resolve)),flush=async()=>{for(let n=0;n<4;n++)await tick();};
const open=disclosure=>{disclosure.open=true;disclosure.fire('toggle',{bubbles:false});};
const definitions=state=>state.bootstrap.capabilities.trait_form.kinds;
const withKinds199=state=>{state.bootstrap.capabilities.trait_form.kinds.push(...copy(TRAIT_KINDS199));return state;};
const cardRef=card=>({slot:card.web_slot??card.slot,internal_id:card.source_id,identity_key:card.identity_key,name_ko:card.name});
const typed=(kind,fields={})=>({kind,value:0,threshold:0,sourceId:-1,position:0,entries:[],...fields});

// ---------- trait lines ----------
test('203 a trait line names the trait and its values in both stored shapes',()=>{
  const state=withKinds199(fixture041()),cards=state.bootstrap.catalog.cards,names=new Map(cards.map(card=>[card.source_id,card.name]));
  const options={definitions:definitions(state),cardName:id=>names.get(id)??null},[blue,elf]=cards;
  assert.equal(traitLine203(typed('heal_once',{value:1000}),options),'LP 회복 1회 (1,000 LP)');
  assert.equal(traitLine203({kind:'heal_once',value:2000},options),'LP 회복 1회 (2,000 LP)');
  assert.equal(traitLine203(typed('draw_once',{value:2,threshold:2000}),options),'위기 드로우 1회 (2장 · LP 2,000 이하)');
  assert.equal(traitLine203(typed('start_hand',{sourceId:blue.source_id}),options),`시작 패에 카드 추가 (${blue.name})`);
  assert.equal(traitLine203({kind:'start_hand',card:cardRef(blue)},options),`시작 패에 카드 추가 (${blue.name})`);
  assert.equal(traitLine203({kind:'start_monster',card:cardRef(blue),position:'set'},options),`시작 몬스터 배치 (${blue.name} · 뒷면 수비)`);
  assert.equal(traitLine203(typed('start_monster',{sourceId:blue.source_id,position:4}),options),`시작 몬스터 배치 (${blue.name} · 수비 표시)`);
  assert.equal(traitLine203({kind:'start_grave',entries:[{card:cardRef(blue),count:2},{card:cardRef(elf),count:1}]},options),`시작 묘지 (${blue.name} 2장, ${elf.name} 1장 · 합계 3장)`);
  assert.equal(traitLine203({kind:'stat_aura',aura:{...AURA_DEFAULT199,attributes:16,atk:300}},options),'공격력·수비력 조정 (조건) (빛 · 공격력 +300)');
  assert.equal(traitLine203({kind:'opening_reload'},options),'리로드');
  // A kind the database list no longer offers still shows its known name and stored value, never "공용 특성".
  assert.equal(traitLine203({kind:'fusion_recover'},{...options,definitions:[]}),'융합회수');
  assert.equal(traitLine203({kind:'union_power',value:300},{...options,definitions:[]}),'유니온의 힘 (공격력·수비력 +300)');
  // The card name follows the current catalog; the stored name of a shared reference is only the fallback.
  assert.deepEqual(traitValues203({kind:'start_hand',card:{internal_id:999999,name_ko:'저장된 이름'}},options),['저장된 이름']);
});

test('203 a deck or encounter bound to a character names the shared traits it uses instead of "공용 특성 사용"',()=>{
  const state=fixture041(),kaiba=state.bootstrap.characters.find(row=>row.profile_id==='kaiba');
  kaiba.profile={...kaiba.profile,skills:[{kind:'heal_once',value:1000}],skill_profiles:[{profile_id:'boss',name:'보스 특성',skills:[{kind:'draw_once',value:2,threshold:2000}]}]};
  const options={characters:state.bootstrap.characters,definitions:definitions(state)};
  assert.equal(encounterTraitText203({use_shared_skills:true,shared_character_id:kaiba.id,shared_skill_profile_id:null,skills:[]},options),'공용 테스트 카이바 · 기본 특성: LP 회복 1회 (1,000 LP)');
  assert.equal(encounterTraitText203({use_shared_skills:true,shared_character_id:kaiba.id,shared_skill_profile_id:'boss',skills:[typed('heal_once',{value:500})]},options),
    '공용 테스트 카이바 · 보스 특성: 위기 드로우 1회 (2장 · LP 2,000 이하) · 직접: LP 회복 1회 (500 LP)');
  assert.equal(encounterTraitText203({use_shared_skills:false,skills:[typed('heal_once',{value:500})]},options),'특성: LP 회복 1회 (500 LP)');
  assert.equal(encounterTraitText203({use_shared_skills:false,skills:[]},options),'특성 없음');
  assert.equal(encounterTraitText203({use_shared_skills:true,shared_character_id:'gone',skills:[]},options),'공용 특성 (연결한 캐릭터를 찾을 수 없음)');
  assert.equal(sharedTraitSource203({use_shared_skills:true,shared_character_id:kaiba.id,shared_skill_profile_id:'gone'},state.bootstrap.characters).missing,'연결한 특성 묶음을 찾을 수 없음');
  assert.deepEqual(traitLines203(null),[]);
});

// ---------- starter list ----------
function starterState(){
  const state=withKinds199(fixture041()),[blue]=state.bootstrap.catalog.cards;
  state.bootstrap.capabilities.starter_loadout={lp_max:1000000,gold_max:1000000,relics_max:70};
  state.entities.push({entity_type:'relic',entity_id:'relic-sight',version:1,state:'saved',issues:[],content:{id:'relic-sight',name:'간파의 눈',description:'첫 턴에 상대 패를 확인합니다.',enabled:true}});
  const starters=state.entities.find(row=>row.entity_type==='starter_list'),first=starters.content.entries[0];
  first.start_loadout={lp:8000,gold:300,relic_ids:['relic-sight'],traits:[{kind:'heal_once',value:2000},{kind:'start_hand',card:cardRef(blue)}]};
  return {state,starters,first,blue};
}
function mounted(t,state,section,id,{rerender=false}={}){
  const document=new Document041(),root=document.createElement('main'),writes=[],errors=[];document.body.append(root);
  let panels;
  // rerender: apply each change to the state and render again, like the shell does after a draft change.
  const onChange=(type,entityId,fields)=>{writes.push(copy([type,entityId,fields]));if(rerender){const row=state.entities.find(item=>item.entity_type===type&&item.entity_id===entityId);row.content={...row.content,...copy(fields)};row.version++;panels.render(section,root,state);}return Promise.resolve({staged:true});};
  panels=createAuthoringPanels039({document,onChange,onError:error=>errors.push(error)});
  panels.selectEntity065(section,id);panels.render(section,root,state);t.after(()=>panels.destroy());
  return {document,root,writes,errors,panels};
}

test('203 each starter is one folded row whose summary shows LP, gold, start relics and traits by name and value',t=>{
  const {state,starters,first,blue}=starterState(),ui=mounted(t,state,'starters',starters.entity_id);
  const rows=ui.root.querySelectorAll('.au-starter-row');
  assert.equal(rows.length,starters.content.entries.length);
  assert(rows.every(row=>row.tagName==='DETAILS'&&row.open===false),'every starter starts folded');
  const head=rows[0].querySelector('summary');
  assert.equal(head.querySelector('h3').textContent,first.name);
  assert.match(head.textContent,/메인 \d+장 · EX \d+장 · 8,000 LP · 300 G/);
  assert.equal(head.querySelector('.au-starter-relics203').textContent,'유물 1개 · 간파의 눈');
  assert.equal(head.querySelector('.au-starter-trait-line203').textContent,`특성 2개 · LP 회복 1회 (2,000 LP) · 시작 패에 카드 추가 (${blue.name})`);
  assert.doesNotMatch(rows.map(row=>row.querySelector('summary').textContent).join('\n'),/공용 특성/);
  // A starter without settings shows only its deck size and the default 4,000 LP · 0 G.
  assert.match(rows[1].querySelector('summary').textContent,/4,000 LP · 0 G/);assert.equal(rows[1].querySelector('.au-starter-trait-line203'),null);
  // The open state survives a re-render (a save, a background refresh).
  open(rows[0]);ui.panels.render('starters',ui.root,state,{force:true});
  assert.equal(ui.root.querySelectorAll('.au-starter-row')[0].open,true);
  assert.deepEqual(ui.errors,[]);
});

test('203 the starter trait section folds; each trait is a folded "이름 · 값" row and a just-added trait opens',async t=>{
  const {state,starters,first,blue}=starterState(),ui=mounted(t,state,'starters',starters.entity_id,{rerender:true});
  const config=()=>ui.root.querySelector('.au-starter-loadout');
  assert.match(config().querySelector('summary').textContent,/8,000 LP · 300 G · 유물 1개 · 특성 2개/);
  open(config());
  const section=()=>config().querySelector('.au-starter-traits203');
  assert.equal(section().tagName,'DETAILS');assert.equal(section().open,false,'the trait section starts folded');
  assert.equal(section().querySelector('summary').textContent,`시작 특성 · 2개LP 회복 1회 (2,000 LP) · 시작 패에 카드 추가 (${blue.name})`);
  const rows=()=>section().querySelectorAll('.au-trait-row203');
  const head=row=>row.querySelector('summary');
  assert.deepEqual(rows().map(row=>[row.open,head(row).querySelector('strong').textContent,head(row).querySelector('span')?.textContent]),
    [[false,'LP 회복 1회','2,000 LP'],[false,'시작 패에 카드 추가',blue.name]]);
  // The editor still lives under each folded row (fieldset + legend), so nothing is lost.
  assert.equal(rows()[0].querySelector('legend').textContent,'LP 회복 1회');assert.ok(field041(rows()[0],'LP 수치'));
  open(section());open(rows()[1]);
  const select=field041(config(),'추가할 특성');select.value='opening_reload';select.fire('change');button041(config(),'특성 추가').click();await tick();
  assert.deepEqual(ui.writes.at(-1)[2].entries.find(row=>row.starter_id===first.starter_id).start_loadout.traits.map(row=>row.kind),['heal_once','start_hand','opening_reload']);
  assert.equal(section().open,true,'the section stays open after the change');
  assert.deepEqual(rows().map(row=>[head(row).querySelector('strong').textContent,row.open]),[['LP 회복 1회',false],['시작 패에 카드 추가',true],['리로드',true]]);
  assert.deepEqual(ui.errors,[]);
});

test('203 character trait editors fold every trait to one line with its values',t=>{
  const state=withKinds199(fixture041()),[blue]=state.bootstrap.catalog.cards;
  state.entities.push({entity_type:'character',entity_id:'char203',version:1,state:'saved',issues:[],content:{name:'접기 확인',portrait:'',skills:[{kind:'heal_once',value:800},{kind:'start_hand',card:cardRef(blue)}],skill_profiles:[]}});
  const ui=mounted(t,state,'characters','char203');open(ui.root.querySelector('.au-character-traits'));
  const rows=ui.root.querySelector('.au-character-traits').querySelectorAll('.au-trait-row203');
  assert.deepEqual(rows.map(row=>row.querySelector('summary').textContent),['LP 회복 1회800 LP',`시작 패에 카드 추가${blue.name}`]);
  assert(rows.every(row=>row.open===false));
});

// ---------- 캐릭터 탭 특성 선택 (bug 4) ----------
// Safari (iPhone·Mac) and Firefox keep focus on a select after a choice and do not move it to a tapped button.
// The fake DOM's fire('click') models that: the button is clicked while the select keeps focus.
test('203 choosing a trait kind and pressing 특성 추가 shows the new trait at once while the select keeps focus',async t=>{
  const state=fixture041();
  state.entities.push({entity_type:'character',entity_id:'char203',version:1,state:'saved',issues:[],content:{name:'선택 확인',portrait:'',skills:[{kind:'heal_once',value:800}],skill_profiles:[]}});
  const ui=mounted(t,state,'characters','char203',{rerender:true});open(ui.root.querySelector('.au-character-traits'));
  const traits=()=>ui.root.querySelector('.au-character-traits'),select=field041(traits(),'추가할 특성');
  select.focus();select.value='draw_once';select.fire('change');
  // The owner looks at the choice before tapping: the select's own commit window has closed.
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(ui.document.activeElement,select);
  traits().querySelectorAll('button').find(node=>node.textContent==='특성 추가').fire('click');
  assert.deepEqual(ui.writes.at(-1)[2].skills.map(row=>row.kind),['heal_once','draw_once']);
  assert.deepEqual(traits().querySelectorAll('legend').map(node=>node.textContent),['LP 회복 1회','위기 드로우 1회'],'shown without waiting for the next tap');
  assert.equal(traits().querySelectorAll('.au-trait-row203').at(-1).open,true,'the new trait opens for editing');
  assert.equal(select.isConnected,false,'the used select is replaced; nothing stays pending');
  assert.deepEqual(ui.errors,[]);
});

test('203 picking a card in a trait card search applies at once and releases the search box',t=>{
  const state=fixture041(),[blue,elf]=state.bootstrap.catalog.cards;
  state.entities.push({entity_type:'character',entity_id:'char203',version:1,state:'saved',issues:[],content:{name:'카드 확인',portrait:'',skills:[{kind:'start_hand',card:cardRef(blue)}],skill_profiles:[]}});
  const ui=mounted(t,state,'characters','char203',{rerender:true});open(ui.root.querySelector('.au-character-traits'));
  const row=()=>ui.root.querySelector('.au-character-traits').querySelector('.au-trait-row203'),search=row().querySelector('.au-card-picker').querySelector('input');
  search.focus();search.value=elf.name;search.fire('input');
  row().querySelectorAll('button').find(node=>node.textContent===elf.name).fire('click');
  assert.equal(ui.writes.at(-1)[2].skills[0].card.internal_id,elf.source_id);
  assert(row().querySelectorAll('p').some(node=>node.textContent===`선택한 카드: ${elf.name}`),'the chosen card shows at once');
  assert.equal(row().querySelector('summary').querySelector('span').textContent,elf.name);
  assert.notEqual(ui.document.activeElement,search);
});

test('203 a background refresh still waits for a focused select, and a search box still keeps its node while results are tapped',t=>{
  const state=fixture041();
  state.entities.push({entity_type:'character',entity_id:'char203',version:1,state:'saved',issues:[],content:{name:'대기 확인',portrait:'',skills:[{kind:'heal_once',value:800}],skill_profiles:[]}});
  const ui=mounted(t,state,'characters','char203');open(ui.root.querySelector('.au-character-traits'));
  const select=field041(ui.root,'추가할 특성');select.focus();
  assert.equal(ui.panels.render('characters',ui.root,state),false,'no click: the refresh waits for the picker');
  assert.equal(select.isConnected,true);
});

// ---------- placement rows ----------
test('203 deck placements name the traits each opponent uses instead of "공용 특성 사용"',t=>{
  const state=fixture041();state.bootstrap.capabilities.deck_compositions044=true;
  const kaiba=state.bootstrap.characters.find(row=>row.profile_id==='kaiba');kaiba.profile={...kaiba.profile,skills:[{kind:'heal_once',value:1000}],skill_profiles:[]};
  const deck=state.entities.find(row=>row.entity_type==='deck'),role=state.entities.find(row=>row.entity_type==='chapter_role'&&row.entity_id==='1:battle');
  const encounter={name:'공용 상대',deck_name:'공용 상대',profile_id:'kaiba',art_key:'CharacterPresentation012/images/kaiba/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[typed('heal_once',{value:500})],shared_character_id:kaiba.id,shared_skill_profile_id:null,use_shared_skills:true};
  role.content.entries=[{entry_id:'enc203',deck_id:deck.entity_id,weight:1,encounter}];
  const ui=mounted(t,state,'decks',deck.entity_id);ui.panels.selectDeck(deck.entity_id);ui.panels.render('decks',ui.root,state,{force:true});
  button041(ui.root,'배치 설정').click();
  const placement=ui.root.querySelector('.au-setup-placement068');
  assert.ok(placement,'the placement list');
  assert.equal(placement.querySelector('small').textContent,'테스트 카이바 · 공용 테스트 카이바 · 기본 특성: LP 회복 1회 (1,000 LP) · 직접: LP 회복 1회 (500 LP)');
  assert.deepEqual(ui.errors,[]);
});

// ---------- Supabase 전송량: 제작소 확인 횟수 ----------
const native={setTimeout,clearTimeout,setInterval,clearInterval,setImmediate,now:Date.now};
const settle=async()=>{await new Promise(native.setImmediate);await new Promise(native.setImmediate);};
class Clock203{
  constructor(){this.now=0;this.next=1;this.tasks=new Map();}
  install(){globalThis.setTimeout=(fn,ms=0)=>this.add(fn,ms,0);globalThis.setInterval=(fn,ms)=>this.add(fn,ms,ms);globalThis.clearTimeout=globalThis.clearInterval=handle=>this.tasks.delete(handle?.id??handle);Date.now=()=>this.now;}
  add(fn,ms,interval){const handle={id:this.next++,unref(){}};this.tasks.set(handle.id,{fn,due:this.now+Math.max(0,ms),interval,handle});return handle;}
  async advance(ms){const end=this.now+ms;for(let count=0;;){const task=[...this.tasks.values()].filter(t=>t.due<=end).sort((a,b)=>a.due-b.due||a.handle.id-b.handle.id)[0];if(!task)break;assert.ok(++count<5000,'Unexpected timer loop');this.now=task.due;if(task.interval)task.due+=task.interval;else this.tasks.delete(task.handle.id);task.fn();await settle();}this.now=end;await settle();}
  restore(){Object.assign(globalThis,{setTimeout:native.setTimeout,clearTimeout:native.clearTimeout,setInterval:native.setInterval,clearInterval:native.clearInterval});Date.now=native.now;}
}
class Target203{
  constructor(hidden=false){this.hidden=hidden;this.listeners=new Map();}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  fire(type){for(const fn of this.listeners.get(type)??[])fn({type});}
}
async function pollHarness(t,{hidden=false,...options}={}){
  const clock=new Clock203();clock.install();
  const payload=JSON.stringify({catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  const remote={revision:7,reads:[]};
  // Mirrors poc_bootstrap039: a matching p_known_revision answers without entities or game payload.
  const wire=known=>known===remote.revision
    ?{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:true,permissions:{can_edit:true},authoring:null,game:null}
    :{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:[]},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:remote.revision,metadata_revision:String(remote.revision),identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}};
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'editor-203'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
    assert.equal(name,'poc_bootstrap039');remote.reads.push({at:clock.now,known:args.p_known_revision});return {data:wire(args.p_known_revision)};
  }};
  const page=new Target203(hidden),win=new Target203(),store=new AuthoringStore039({client,storage:null,events:win,visibility:page,crypto:webcrypto,...options});await store.start();
  t.after(async()=>{store.stop();await settle();clock.restore();});
  const reads=(from=1)=>remote.reads.slice(from);
  return {store,remote,clock,page,win,reads};
}
const HOUR=3600000,MINUTE=60000;

test('203 measured: a visible tab in use checks 60 times an hour (was 240), every check conditional',async t=>{
  const {clock,win,reads}=await pollHarness(t);
  assert.equal(reads(0)[0].known,null,'the first load is the only full read');
  for(let minute=0;minute<60;minute+=5){win.fire('pointerdown');await clock.advance(5*MINUTE);}
  assert.equal(reads().length,60);assert(reads().every(read=>read.known===7));
});

test('203 measured: the old 15 second interval would have checked 240 times in the same hour',async t=>{
  const {clock,win,reads}=await pollHarness(t,{pollMs:15000});
  for(let minute=0;minute<60;minute+=5){win.fire('pointerdown');await clock.advance(5*MINUTE);}
  assert.equal(reads().length,240);
});

test('203 measured: an untouched visible tab slows to one check per 5 minutes after 10 minutes (19 in the first hour, 12 after)',async t=>{
  const {clock,reads}=await pollHarness(t);
  await clock.advance(HOUR);
  assert.deepEqual(reads().map(read=>read.at/1000),[60,120,180,240,300,360,420,480,540,840,1140,1440,1740,2040,2340,2640,2940,3240,3540]);
  const before=reads().length;await clock.advance(HOUR);assert.equal(reads().length-before,12);
});

test('203 measured: a hidden tab never checks; showing it checks once only when the last check is 30 seconds old',async t=>{
  const {clock,page,reads}=await pollHarness(t);
  page.hidden=true;page.fire('visibilitychange');await clock.advance(HOUR);assert.equal(reads().length,0);
  page.hidden=false;page.fire('visibilitychange');await settle();assert.equal(reads().length,1,'shown after an hour: one check');
  await clock.advance(10000);page.hidden=true;page.fire('visibilitychange');page.hidden=false;page.fire('visibilitychange');await settle();
  assert.equal(reads().length,1,'switching apps for 10 seconds does not check again');
  await clock.advance(25000);page.hidden=true;page.fire('visibilitychange');page.hidden=false;page.fire('visibilitychange');await settle();
  assert.equal(reads().length,2);
});

test('203 a tap after an idle period checks right away when the last check is a minute old',async t=>{
  const {clock,win,reads}=await pollHarness(t);
  await clock.advance(15*MINUTE);const before=reads().length,last=reads().at(-1).at;
  assert(clock.now-last>=MINUTE);
  win.fire('keydown');await settle();
  assert.equal(reads().length,before+1);assert.equal(reads().at(-1).at,clock.now);
  // Active again: the regular minute interval resumes.
  await clock.advance(5*MINUTE);assert.equal(reads().length,before+6);
});

test('203 stop() removes the activity listeners as well',async t=>{
  const {store,win}=await pollHarness(t);
  assert.equal(win.listeners.get('pointerdown').size,1);assert.equal(win.listeners.get('keydown').size,1);
  store.stop();assert.equal(win.listeners.get('pointerdown').size,0);assert.equal(win.listeners.get('keydown').size,0);
});

// ---------- 새로 불러오기 ----------
function reloadHarness(t){
  const fixture=fixture041(),remote={revision:3,reads:[]};
  const payload=JSON.stringify({...fixture.bootstrap.game,catalog:fixture.bootstrap.catalog.cards,characters:fixture.bootstrap.characters,shop_rules:fixture.bootstrap.game.shop_rules??{}});
  const full=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:copy(fixture.entities)},catalog:copy(fixture.bootstrap.catalog),characters:copy(fixture.bootstrap.characters),capabilities:copy(fixture.bootstrap.capabilities),
    game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:remote.revision,metadata_revision:String(remote.revision),identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}});
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'reload-203'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
    remote.reads.push(args.p_known_revision);
    return {data:args.p_known_revision===remote.revision?{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:true,permissions:{can_edit:true},authoring:null,game:null}:full()};
  }};
  const store=new AuthoringStore039({client,crypto:webcrypto,storage:null,events:{},pollMs:0});
  const document=new Document041(),root=document.createElement('main');document.body.append(root);
  const window={location:{href:'https://example.test/index.html?section=starters'},history:{pushState(){},replaceState(){}},scrollTo(){},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}};
  return {store,remote,root,document,window,mount:()=>{const shell=mountAuthoringShell039({root,store,document,window});t.after(()=>{shell.destroy();store.stop();});return shell;}};
}

test('203 새로 불러오기 asks with the known revision: an unchanged DB answers without the full payload',async t=>{
  const m=reloadHarness(t);await m.store.start();m.mount();await flush();
  assert.deepEqual(m.remote.reads,[null]);
  const reload=button041(m.root,'새로 불러오기');reload.click();await flush();
  assert.deepEqual(m.remote.reads,[null,3],'conditional: the known revision is sent');
  assert.equal(reload.disabled,false);assert.match(m.root.querySelector('.au-sync-detail083').textContent,/최근 확인/);
  // A changed DB still arrives in full through the same button.
  m.remote.revision=4;reload.click();
  for(let n=0;n<200&&m.store.fetchedRevision!==4;n++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.deepEqual(m.remote.reads,[null,3,3]);assert.equal(m.store.fetchedRevision,4);
});

test('203 the local preview answers unchanged for a known revision and records each answer size',async()=>{
  const fixture=fixture041(),payload={...fixture.bootstrap.game,catalog:fixture.bootstrap.catalog.cards};
  const client=createPreviewClient170({seed:{id:'p203',revision:5,capabilities:fixture.bootstrap.capabilities,catalog:fixture.bootstrap.catalog.cards,characters:fixture.bootstrap.characters,rows:fixture.entities,payload},crypto:webcrypto,storage:null});
  const first=(await client.rpc('poc_bootstrap039',{p_view:'authoring',p_known_revision:null})).data,again=(await client.rpc('poc_bootstrap039',{p_view:'authoring',p_known_revision:5})).data;
  assert.equal(first.unchanged,false);assert.equal(again.unchanged,true);assert.equal(again.authoring,null);assert.equal(again.capabilities,null);
  const traffic=client.traffic170();
  assert.deepEqual(traffic.map(row=>[row.known,row.unchanged]),[[null,false],[5,true]]);
  assert(traffic[0].bytes>traffic[1].bytes*50,'a full answer is far larger than an unchanged one');
});
