import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAIT_KINDS184} from '../authoring184-traits.js';
import {TRAIT_KINDS196} from '../authoring196-traits.js';
import {TRAIT_KINDS197, STARTER_KINDS197, CHARACTER_KINDS197} from '../authoring197-traits.js';
import {TRAIT_KINDS199, TRAIT_KIND_IDS199, STARTER_KINDS199, CHARACTER_KINDS199, STAT_AURA_DEFINITION199, AURA_KEYS199, AURA_DEFAULT199,
  auraMask199, auraOptions199, auraValid199, auraSummary199, traitKindOffered199} from '../authoring199-traits.js';
import {createAuthoringPanels039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {Document041, fixture041, field041, button041} from './authoring041-test-dom.js';

// (199) 대표님 2026-11-24: 특성 3종 더(공격력·수비력 조정 (조건) stat_aura, 데스티니 드로우 destiny_draw, 리로드 opening_reload).
// 출처 UnityExpeditionWork/Traits199/traits199-contract.json. DB 199 마이그레이션이 네 정의(start_deck 포함)를 capabilities.trait_form.kinds 끝에 더한다
// (compiled, shared:true). 덱·장별 상대는 typed 모양, 캐릭터 공용 특성·시작 덱은 {kind}(+ stat_aura는 aura) 모양이다.
const CHAR='traits199-character';
const sample={types:0,attributes:32,races:8192,levels:0,atk:300,def:0};
const typed=(kind,value=0)=>({kind,value,threshold:0,sourceId:-1,position:0,entries:[]});
const typedAura=(aura=sample)=>({...typed('stat_aura'),aura});
const sharedTrue=rows=>rows.map(row=>({...structuredClone(row),shared:true}));
function withTraits199(state){state.bootstrap.capabilities.trait_form.kinds.push(...sharedTrue(TRAIT_KINDS184),...sharedTrue(TRAIT_KINDS196),...structuredClone(TRAIT_KINDS197),...structuredClone(TRAIT_KINDS199));return state;}
function withTraits197(state){state.bootstrap.capabilities.trait_form.kinds.push(...sharedTrue(TRAIT_KINDS184),...sharedTrue(TRAIT_KINDS196),...structuredClone(TRAIT_KINDS197));return state;}
function character(state,skills=[],skill_profiles=[]){
  state.entities.push({entity_type:'character',entity_id:CHAR,version:3,state:'saved',issues:[],content:{name:'특성 확인 캐릭터',portrait:'',skills,skill_profiles}});
}
function mounted(t,state,section,id){
  const document=new Document041(),root=document.createElement('main'),writes=[],errors=[];document.body.append(root);
  const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(structuredClone(args)),onError:error=>errors.push(error)});
  panels.selectEntity065(section,id);if(section==='decks')panels.selectDeck(id);panels.render(section,root,state);t.after(()=>panels.destroy());
  if(section==='characters')for(const selector of ['.au-character-traits','.au-character-trait-profile'])for(const disclosure of root.querySelectorAll(selector)){disclosure.open=true;disclosure.fire('toggle',{bubbles:false});}
  return {root,writes,errors,panels};
}
const open=disclosure=>{disclosure.open=true;disclosure.fire('toggle',{bubbles:false});};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const addSelects=root=>root.querySelectorAll('select').filter(node=>node.getAttribute('aria-label')==='추가할 특성');
const optionKinds=select=>select.options.map(option=>option.value);
const addButtonFor=select=>select.parentNode.querySelectorAll('button').find(node=>node.textContent==='특성 추가');
const box=(root,label)=>root.querySelectorAll('legend').find(node=>node.textContent===label)?.parentNode;
const checkbox=(root,label)=>root.querySelectorAll('input').find(node=>node.getAttribute('aria-label')===label);

test('199 module: four kinds (start_deck, stat_aura, destiny_draw, opening_reload) after the 197 lists, with the contract masks',()=>{
  assert.deepEqual([...TRAIT_KIND_IDS199],['start_deck','stat_aura','destiny_draw','opening_reload']);
  assert.deepEqual(TRAIT_KINDS199.map(row=>row.label),['시작 덱에 카드 추가','공격력·수비력 조정 (조건)','데스티니 드로우','리로드']);
  assert.deepEqual([...STARTER_KINDS199],[...STARTER_KINDS197,...TRAIT_KIND_IDS199]);
  assert.deepEqual([...CHARACTER_KINDS199],[...CHARACTER_KINDS197,...TRAIT_KIND_IDS199]);
  for(const row of TRAIT_KINDS199){
    assert.deepEqual([row.compiled,row.shared,row.starter],[true,true,true],row.kind);
    assert.match(row.help,/[가-힣]/);
    assert.deepEqual([traitKindOffered199(row,false),traitKindOffered199(row,true),traitKindOffered199(row,true,true)],[true,true,true],row.kind);
  }
  assert.deepEqual(TRAIT_KINDS199[2].fields,{});assert.deepEqual(TRAIT_KINDS199[3].fields,{});
  const spec=STAT_AURA_DEFINITION199.fields.aura;
  assert.deepEqual([spec.type,spec.atk_min,spec.atk_max,spec.def_min,spec.def_max,spec.step],['stat-aura',-3000,3000,-3000,3000,100]);
  // 앱·DB와 같은 허용 비트(계약 allowedMasks).
  assert.deepEqual(['types','attributes','races','levels'].map(group=>auraMask199(spec,group)),[6299376,127,67108863,8190]);
  assert.deepEqual(auraOptions199(spec,'levels').slice(0,2),[[2,'레벨 1'],[4,'레벨 2']]);
  assert.deepEqual([...AURA_KEYS199],['types','attributes','races','levels','atk','def']);
  assert(auraValid199(AURA_DEFAULT199),'the add default is valid');
});

test('199 stat_aura check: exact keys, masks, ranges, 100 steps and not both zero',()=>{
  assert(auraValid199(sample));
  assert(auraValid199({types:6299376,attributes:127,races:67108863,levels:8190,atk:-3000,def:3000}),'every condition, both limits');
  assert(auraValid199({...sample,atk:0,def:-500}),'a DEF-only change');
  const bad={bothZero:{...sample,atk:0,def:0},typeBit:{...sample,types:8},monsterBit:{...sample,types:1},attribute128:{...sample,attributes:128},
    level0:{...sample,levels:1},level13:{...sample,levels:2**13},race2pow26:{...sample,races:2**26},negativeMask:{...sample,races:-1},
    atkOver:{...sample,atk:3100},defUnder:{...sample,def:-3100},atkStep:{...sample,atk:150},fraction:{...sample,atk:300.5},text:{...sample,atk:'300'},
    extraKey:{...sample,link:0},missingKey:(({def,...rest})=>rest)(sample),array:[],nullValue:null};
  for(const [label,aura] of Object.entries(bad))assert.equal(auraValid199(aura),false,label);
});

test('199 stat_aura summary names the conditions and the signed changes',()=>{
  assert.equal(auraSummary199(sample),'어둠 · 드래곤족 · 공격력 +300');
  assert.equal(auraSummary199({types:0,attributes:0,races:0,levels:0,atk:0,def:-500}),'모든 몬스터 · 수비력 −500');
  assert.equal(auraSummary199({types:16|4096,attributes:0,races:1|2,levels:(1<<4)|(1<<12),atk:1200,def:200}),'일반·튜너 · 전사족·마법사족 · 레벨 4·레벨 12 · 공격력 +1,200 · 수비력 +200');
  assert.equal(auraSummary199(undefined),'조건 미설정');
});

test('199 validation: decks, characters and starters take the three kinds once the database offers them; stat_aura is checked exactly',()=>{
  const state=withTraits199(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typedAura(),typed('destiny_draw'),typed('opening_reload'),typed('fusion_recover')]}));
  for(const aura of [{...sample,atk:0,def:0},{...sample,attributes:128},{...sample,atk:250},(({races,...rest})=>rest)(sample)])
    assert.throws(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typedAura(aura)]}),/공격력·수비력 조정 \(조건\)의 조건과 수치를 확인해 주세요/);
  assert.throws(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typed('stat_aura')]}),/조건과 수치/,'a stat_aura row without aura');
  const older=withTraits197(fixture041()),olderDeck=older.entities.find(e=>e.entity_type==='deck');
  for(const skill of [typedAura(),typed('destiny_draw'),typed('opening_reload')])
    assert.throws(()=>validateAuthoringChange066(older,'deck',olderDeck.entity_id,{skills:[skill]}),/현재 지원하지 않는 특성/,'before the migration: '+skill.kind);
  character(state);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[{kind:'stat_aura',aura:sample},{kind:'destiny_draw'}],skill_profiles:[{profile_id:'p199',name:'묶음',skills:[{kind:'opening_reload'},{kind:'stat_aura',aura:{...sample,atk:-300,def:-300}}]}]}));
  assert.throws(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[{kind:'stat_aura',aura:{...sample,atk:0,def:0}}],skill_profiles:[]}),/조건과 수치/);
  state.bootstrap.capabilities.starter_loadout={lp_max:1000000,gold_max:1000000,relics_max:70};
  const starters=state.entities.find(row=>row.entity_type==='starter_list'),first=starters.content.entries[0];
  const withTraits=traits=>({entries:[{...first,start_loadout:{lp:4000,gold:0,relic_ids:[],traits}},...starters.content.entries.slice(1)]});
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'starter_list',starters.entity_id,withTraits([{kind:'stat_aura',aura:sample},{kind:'destiny_draw'},{kind:'opening_reload'},{kind:'fusion_recover'}])));
  assert.throws(()=>validateAuthoringChange066(state,'starter_list',starters.entity_id,withTraits([{kind:'stat_aura',aura:{...sample,levels:1}}])),/조건과 수치/);
  assert.throws(()=>validateAuthoringChange066(state,'starter_list',starters.entity_id,withTraits([{kind:'union_power',value:300}])),/현재 지원하지 않는 특성/,'union_power stays off starter decks');
});

test('199 deck editor: a saved stat_aura shows its condition chips and values; a chip or a value changes only that aura',async t=>{
  const state=withTraits199(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[typedAura(),typed('destiny_draw')];
  const before=JSON.stringify(state),ui=mounted(t,state,'decks',deck.entity_id);
  const aura=box(ui.root,'공격력·수비력 조정 (조건)');assert(aura,'stat_aura legend');
  assert(aura.querySelectorAll('p').some(node=>node.textContent==='조건 · 어둠 · 드래곤족 · 공격력 +300'),'summary');
  assert.deepEqual(aura.querySelectorAll('legend').map(node=>node.textContent).slice(1),['종류','속성','종족','레벨']);
  assert.equal(aura.querySelectorAll('input').filter(node=>node.type==='checkbox').length,10+7+26+12);
  assert.equal(checkbox(aura,'속성 어둠').checked,true);assert.equal(checkbox(aura,'종족 드래곤족').checked,true);assert.equal(checkbox(aura,'종족 전사족').checked,false);
  const destiny=box(ui.root,'데스티니 드로우');assert(destiny,'destiny_draw legend');assert.equal(destiny.querySelectorAll('input').length,0,'no field');
  const warrior=checkbox(aura,'종족 전사족');warrior.checked=true;warrior.fire('change');await tick();
  assert.equal(ui.writes.length,1);let [type,id,fields]=ui.writes[0];
  assert.deepEqual([type,id],['deck',deck.entity_id]);
  assert.deepEqual(fields,{skills:[typedAura({...sample,races:8192|1}),typed('destiny_draw')]});
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  const atk=field041(aura,'공격력 조정');assert.equal(atk.value,'300');assert.equal(atk.step,'100');assert.equal(String(atk.min),'-3000');
  atk.value='-500';atk.fire('input');await tick();
  [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual(fields.skills[0].aura,{...sample,atk:-500});
  assert.equal(JSON.stringify(state),before);assert.deepEqual(ui.errors,[]);
});

test('199 deck editor: adding stat_aura writes the typed row with the default aura (+300 ATK, every monster)',async t=>{
  const state=withTraits199(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[];
  const ui=mounted(t,state,'decks',deck.entity_id),select=addSelects(ui.root)[0];
  for(const kind of TRAIT_KIND_IDS199)assert(optionKinds(select).includes(kind),kind);
  select.value='stat_aura';select.fire('change');button041(ui.root,'특성 추가').click();await tick();
  const [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual(fields,{skills:[typedAura(AURA_DEFAULT199)]});
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(ui.errors,[]);
});

test('199 starter editor offers the starter kinds with the three new ones and writes the shared shapes',async t=>{
  const state=withTraits199(fixture041());state.bootstrap.capabilities.starter_loadout={lp_max:1000000,gold_max:1000000,relics_max:70};
  const starters=state.entities.find(row=>row.entity_type==='starter_list'),first=starters.content.entries[0];
  const ui=mounted(t,state,'starters',starters.entity_id),config=()=>ui.root.querySelector('.au-starter-loadout');
  open(config());
  let select=field041(config(),'추가할 특성');
  assert.deepEqual(optionKinds(select),[...STARTER_KINDS199]);
  select.value='stat_aura';select.fire('change');button041(config(),'특성 추가').click();await tick();
  let [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual(fields.entries.find(row=>row.starter_id===first.starter_id).start_loadout.traits,[{kind:'stat_aura',aura:{...AURA_DEFAULT199}}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  first.start_loadout={lp:4000,gold:0,relic_ids:[],traits:[{kind:'stat_aura',aura:sample}]};
  ui.panels.render('starters',ui.root,state);open(config());
  select=field041(config(),'추가할 특성');select.value='opening_reload';select.fire('change');button041(config(),'특성 추가').click();await tick();
  [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual(fields.entries.find(row=>row.starter_id===first.starter_id).start_loadout.traits,[{kind:'stat_aura',aura:sample},{kind:'opening_reload'}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(ui.errors,[]);
});

test('199 character shared traits offer the three kinds; adding stat_aura to a profile writes {kind,aura}',async t=>{
  const state=withTraits199(fixture041());character(state,[{kind:'destiny_draw'}],[{profile_id:'p199',name:'묶음',skills:[]}]);
  const ui=mounted(t,state,'characters',CHAR),selects=addSelects(ui.root);
  assert.equal(selects.length,2);
  assert(!optionKinds(selects[0]).includes('destiny_draw')&&optionKinds(selects[0]).includes('stat_aura')&&optionKinds(selects[0]).includes('opening_reload'));
  for(const kind of TRAIT_KIND_IDS199)assert(optionKinds(selects[1]).includes(kind),kind);
  selects[1].value='stat_aura';selects[1].fire('change');addButtonFor(selects[1]).click();await tick();
  const [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual([type,id],['character',CHAR]);
  assert.deepEqual(fields.skill_profiles,[{profile_id:'p199',name:'묶음',skills:[{kind:'stat_aura',aura:{...AURA_DEFAULT199}}]}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(ui.errors,[]);
});

test('199 encounter bound to a character: the shared trait preview names the aura condition and the parameter-free kinds',t=>{
  const state=withTraits199(fixture041());state.bootstrap.capabilities.deck_compositions044=true;
  const source=state.entities.find(row=>row.entity_type==='deck'&&row.content.main.reduce((n,r)=>n+r.count,0)===20),deck=structuredClone(source);
  deck.entity_id='shared-deck';deck.content={...deck.content,name:'공유 덱',deck_name:'공유 덱',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};
  const yugi=state.bootstrap.characters.find(row=>row.id==='fixture-character-yugi');
  yugi.profile={...yugi.profile,skills:[{kind:'stat_aura',aura:sample},{kind:'destiny_draw'},{kind:'opening_reload'}],skill_profiles:[]};
  const encounter={...structuredClone(source.content),name:'오라 상대',deck_name:'오라 상대',lp_bonus:0,banlist_enabled:false,skills:[],shared_character_id:yugi.id,shared_skill_profile_id:null,use_shared_skills:true};delete encounter.main;delete encounter.extra;
  const role={entity_type:'chapter_role',entity_id:'1:battle',version:1,state:'saved',issues:[],content:{chapter:1,role:'battle',lp_bonus:0,entries:[{entry_id:'enc-aura',deck_id:deck.entity_id,weight:1,encounter}]}};
  const starter={entity_type:'starter_list',entity_id:'main',version:1,state:'saved',issues:[],content:{entries:[{starter_id:'lineage-original',name:'시작 덱',deck_id:deck.entity_id}]}};
  state.entities=state.entities.filter(row=>!['deck','chapter_role','starter_list'].includes(row.entity_type));state.entities.push(deck,role,starter);
  const doc=new Document041(),root=doc.createElement('main'),errors=[];doc.body.append(root);
  const panels=createAuthoringPanels039({document:doc,onChange:()=>Promise.resolve(),onError:e=>errors.push(e.message),onNavigate:()=>{}});t.after(()=>panels.destroy());
  panels.render('chapters',root,state);root.querySelectorAll('.au-entry-pick066')[0].click();
  const preview=root.querySelector('.au-encounter-editor066')?.querySelector('.au-shared-traits-preview');
  assert(preview,'shared trait preview');
  assert.deepEqual(preview.querySelectorAll('li').map(node=>node.textContent),['공격력·수비력 조정 (조건) · 어둠 · 드래곤족 · 공격력 +300','데스티니 드로우','리로드']);
  assert.deepEqual(errors,[]);
});
