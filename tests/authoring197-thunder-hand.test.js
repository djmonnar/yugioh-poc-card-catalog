import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY161} from '../authoring161-identity.js';
import {GAME_IDENTITY162} from '../authoring162-identity.js';
import {GAME_IDENTITY165} from '../authoring165-identity.js';
import {GAME_IDENTITY174} from '../authoring174-identity.js';
import {GAME_IDENTITY175} from '../authoring175-identity.js';
import {GAME_IDENTITY183} from '../authoring183-identity.js';
import {GAME_IDENTITY188} from '../authoring188-identity.js';
import {GAME_IDENTITY196, gameIdentityAccepts196} from '../authoring196-identity.js';
import {CONTENT_PROFILE197, GAME_IDENTITY197, gameIdentityAccepts197, gameIdentityMatches197} from '../authoring197-identity.js';
import {cardMetadata197} from '../authoring197-catalog.js';
import {cardMetadata196} from '../authoring196-catalog.js';
import {TRAIT_KINDS197, TRAIT_KIND_IDS197, CHARACTER_KINDS197, STARTER_KINDS197, traitKindOffered197} from '../authoring197-traits.js';
import {TRAIT_KINDS196} from '../authoring196-traits.js';
import {TRAIT_KINDS184, traitKindOffered184, traitHelp184} from '../authoring184-traits.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, createAuthoringPanels039, normalizeCatalog039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {Document041, fixture041, field041, button041} from './authoring041-test-dom.js';
import {routeCandidates} from '../scripts/web-db-history.mjs';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion197.json',import.meta.url),'utf8'));
const older=['196','188','183','175','174','165','162','161'].map(version=>JSON.parse(readFileSync(new URL(`../data/native-expansion${version}.json`,import.meta.url),'utf8')));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY197){
  const catalog=cards.map(row=>({source_id:row.sourceId,web_slot:row.slot,identity_key:row.identity_key,
    name:row.name,name_english:row.nameEnglish,description:row.description,alias:row.alias,native_type:row.type,
    type_name:row.typeName,normal_limit:row.normalLimit,speed_limit:row.speedLimit,code:row.code,art_key:row.artKey,
    playable:row.playable,token:row.token,race:row.race,categories:row.categories,stock:row.playable,draw_enabled:row.playable}));
  const payload=JSON.stringify({catalog,deck_rules035:{},opponents:{},starters:{},content022:{},
    meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:1,
    authoring_revision:1,metadata_revision:'1',identity,payload_json:payload,source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}
// 초뇌룡－썬더 드래곤(융합): 유일한 엑스트라 덱 카드
const EXTRA=[15291624];
// 메인 덱 특수 소환 몬스터: 뇌겁룡－썬더 드래곤, 빙염의 쌍룡. 튜너: 심해의 디바.
const SPSUMMON=[55591586,55589254],TUNER=[78868119];

test('Thunder Dragon and Hand cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:23},(_,i)=>3227+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:23},(_,i)=>2259+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native197/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native197/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.deepEqual(cardMetadata197(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata197(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata197(row.sourceId,'0'.repeat(64)),null);
  }
  // 23장: 일반 3, 스피드 제한 없음, 토큰 없음. 초뇌룡은 엑스트라 칸, 메인 덱 특수 소환 몬스터·튜너·마법·함정을 포함한 나머지 22장은 메인 칸.
  assert.equal(cards.filter(card=>card.token).length,0);
  for(const card of cards){
    assert.equal(card.deck_limit,3);
    assert.equal(cardMetadata197(card.source_id,card.identity_key).maximumNormalLimit,undefined);
    const added=changeDeckCard039(draft(),card,1,cards);
    if(EXTRA.includes(card.code)){
      assert.equal(added.extra[0].source_id,card.source_id,card.name_ko);
      assert.equal(added.main.length,0,card.name_ko);
    }else{
      assert.equal(added.main[0].source_id,card.source_id,card.name_ko);
      assert.equal(added.extra.length,0,card.name_ko);
    }
  }
  assert.deepEqual(cards.filter(card=>EXTRA.includes(card.code)).map(card=>card.source_id),[3234]);
  assert.deepEqual(cards.filter(card=>SPSUMMON.includes(card.code)).map(card=>card.source_id),[3229,3249]);
  assert.deepEqual(cards.filter(card=>TUNER.includes(card.code)).map(card=>card.source_id),[3242]);
  const duo=cards.find(card=>card.code===55591586);
  const deck=[1,2,3].reduce(next=>changeDeckCard039(next,duo,1,cards),draft());
  assert.equal(deck.main[0].count,3);
  assert.equal(cards.filter(card=>card.tags.includes('지원-썬더 드래곤')).length,8);
  assert.equal(cards.filter(card=>card.tags.includes('지원-사이킥족')).length,1);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards197');
  assert.equal(additions.latest.label,'썬더 드래곤·핸드');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['thunder-dragon197',8],['hand197',5],['sea197',2],['spell-trap197',6],['monsters197',2]]);
});

test('the 197 metadata keeps the 196, 188, 183, 175, 174, 165, 162 and 161 cards and their display-only tokens',()=>{
  for(const row of older.flatMap(item=>item.cards))
    assert.deepEqual(cardMetadata197(row.sourceId,row.identity_key),cardMetadata196(row.sourceId,row.identity_key));
  for(const row of older[0].cards)
    assert.equal(cardMetadata197(row.sourceId,row.identity_key).image,'assets/native196/cards/'+row.sourceId+'.jpg');
  for(const token of older.flatMap(item=>item.cards).filter(row=>row.token))
    assert.equal(cardMetadata197(token.sourceId,token.identity_key).maximumNormalLimit,0);
});

test('the studio opens 152 to 196 and exact 197 databases and rejects a forged 197 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE197,{schema:1,card_set:'thunder-dragon-hand197'});
  assert.equal(Object.keys(GAME_IDENTITY197).length,65);
  assert.equal(Object.keys(GAME_IDENTITY197).length,Object.keys(GAME_IDENTITY196).length+2);
  assert.deepEqual(Object.keys(GAME_IDENTITY197).slice(-2),['catalog197_sha256','native_manifest197_sha256']);
  assert.equal(GAME_IDENTITY197.catalog196_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY197.native_manifest196_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175,GAME_IDENTITY183,GAME_IDENTITY188,GAME_IDENTITY196])
    assert(gameIdentityMatches197(identity),'a site published before the database migration still opens the older database');
  assert(gameIdentityMatches197(GAME_IDENTITY197));
  assert(!gameIdentityMatches197({...GAME_IDENTITY197,catalog197_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches197({...GAME_IDENTITY197,extra:'x'}));
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175,GAME_IDENTITY183,GAME_IDENTITY188,GAME_IDENTITY196,GAME_IDENTITY197])
    await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  // 지금 공개된 196 제작소도 197 DB를 받는다(196 규칙의 새 팩 허용). 그래서 DB를 먼저 올려도 제작소가 멈추지 않는다.
  assert(gameIdentityAccepts196(GAME_IDENTITY197));
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY197,catalog197_sha256:'0'.repeat(64)},{...GAME_IDENTITY197,native_manifest197_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY196,catalog197_sha256:hex,native_manifest197_sha256:hex}]){
    assert(gameIdentityAccepts196(forged),'the 196 rule alone would accept unknown 197 fingerprints');
    assert(!gameIdentityAccepts197(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 197 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts197({...GAME_IDENTITY197,catalog199_sha256:hex,native_manifest199_sha256:hex}));
  assert(gameIdentityAccepts197({...GAME_IDENTITY197,catalog198_sha256:hex,native_manifest198_sha256:hex}));
  assert(!gameIdentityAccepts197({...GAME_IDENTITY197,catalog197_sha256:'0'.repeat(64),catalog198_sha256:hex}),'known keys must still match');
  assert(!gameIdentityAccepts197({...GAME_IDENTITY197,extra:hex}),'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts197({...GAME_IDENTITY197,catalog198_sha256:'x'}),'added keys must be sha256');
  assert(!gameIdentityAccepts197({...GAME_IDENTITY197,catalog197_sha256x:hex}),'added keys must use the pack key form');
  assert(!gameIdentityAccepts197({...GAME_IDENTITY197,catalog196_sha256:hex}),'an older pack key cannot change after 197');
  assert(!gameIdentityAccepts197({...GAME_IDENTITY197,catalog190_sha256:hex}),'an older pack number cannot be added after 197');
  assert(!gameIdentityAccepts197({...GAME_IDENTITY196,catalog198_sha256:hex}),'a newer pack cannot skip 197');
  const {catalog197_sha256,...missing}=GAME_IDENTITY197;
  assert(!gameIdentityAccepts197({...missing,catalog198_sha256:hex}),'a known key cannot be dropped');
  assert(!gameIdentityAccepts197(null));
  assert(!gameIdentityAccepts197([]));
});

// (197) 회수 특성 '융합회수'(fusion_recover)·'의식회수'(ritual_recover)와 대표님 '캐릭터 공용 특성'.
// DB 197 마이그레이션이 capabilities.trait_form.kinds 끝에 회수 정의 2개(칸 없음, compiled, shared:true)를 더하고 184 네 종류·유니온의 힘의 shared를 true로 바꾼다.
// 덱·장별 상대는 전과 같이 compiled 종류 전부(typed 모양), 캐릭터 공용 특성은 DB가 shared로 보낸 종류, 시작 덱은 STARTER_KINDS197({"kind"} 모양)만 고른다.
const CHAR='traits197-character';
const typed=(kind,value=0)=>({kind,value,threshold:0,sourceId:-1,position:0,entries:[]});
const recoverTyped=TRAIT_KIND_IDS197.map(kind=>typed(kind));
const sharedTrue=rows=>rows.map(row=>({...structuredClone(row),shared:true}));
// 197 적용 뒤 DB가 보내는 정의(184·196 shared:true + 회수 2개) / 197 적용 전(184·196 shared:false, 회수 없음)
function withTraits197(state){state.bootstrap.capabilities.trait_form.kinds.push(...sharedTrue(TRAIT_KINDS184),...sharedTrue(TRAIT_KINDS196),...structuredClone(TRAIT_KINDS197));return state;}
function withTraitsBefore197(state){state.bootstrap.capabilities.trait_form.kinds.push(...structuredClone(TRAIT_KINDS184),...structuredClone(TRAIT_KINDS196));return state;}
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
const compiledKinds=state=>state.bootstrap.capabilities.trait_form.kinds.filter(row=>traitKindOffered184(row,false)).map(row=>row.kind);

test('197 trait module: recover traits with Korean labels and help, and the character and starter kind lists',()=>{
  assert.deepEqual(TRAIT_KIND_IDS197,['fusion_recover','ritual_recover']);
  assert.deepEqual([...CHARACTER_KINDS197],['effect_damage_null','reflect_damage_null','first_damage_null','ouija_board','union_power','fusion_recover','ritual_recover']);
  assert.deepEqual([...STARTER_KINDS197],['start_hand','start_field','start_monster','start_grave','heal_once','draw_once','add_hand_once','parasite_deck','opening_draw','fusion_recover','ritual_recover']);
  for(const [row,label,material] of [[TRAIT_KINDS197[0],'융합회수','융합 소재'],[TRAIT_KINDS197[1],'의식회수','의식 소재']]){
    assert.deepEqual(Object.keys(row),['kind','label','fields','compiled','shared','help']);
    assert.deepEqual([row.label,row.fields,row.compiled,row.shared],[label,{},true,true]);
    for(const word of ['전투당 1번','메인 페이즈',material,'묘지(또는 앞면 제외)','패로'])assert(row.help.includes(word),word);
    assert.equal(traitHelp184(row),row.help);
    // 덱·장별 상대, 캐릭터 공용 특성, 시작 덱 모두 받는다.
    assert.deepEqual([traitKindOffered197(row,false),traitKindOffered197(row,true),traitKindOffered197(row,true,true)],[true,true,true]);
  }
  const fixtureKinds=fixture041().bootstrap.capabilities.trait_form.kinds;
  // 덱·장별 상대와 캐릭터 공용 특성: 184 규칙 그대로(DB의 shared 표시를 따름).
  for(const row of [...fixtureKinds,...TRAIT_KINDS184,...TRAIT_KINDS196,...sharedTrue(TRAIT_KINDS184),...sharedTrue(TRAIT_KINDS196)])
    for(const shared of [false,true])assert.equal(traitKindOffered197(row,shared),traitKindOffered184(row,shared),row.kind);
  // 시작 덱: DB의 shared 표시와 무관하게 STARTER_KINDS197만. 196까지 시작 덱 편집기가 고르던 종류(lp_bonus 제외)는 그대로.
  for(const row of [...fixtureKinds,...TRAIT_KINDS184,...TRAIT_KINDS196,...sharedTrue(TRAIT_KINDS184),...sharedTrue(TRAIT_KINDS196),...TRAIT_KINDS197])
    assert.equal(traitKindOffered197(row,true,true),STARTER_KINDS197.includes(row.kind),row.kind);
  for(const row of fixtureKinds.filter(row=>row.kind!=='lp_bonus'))assert.equal(traitKindOffered197(row,true,true),traitKindOffered184(row,true),row.kind);
  // 184 네 종류·유니온의 힘: 197 전 DB(shared:false)는 캐릭터에 없고, 197 뒤(shared:true)는 캐릭터에 있고, 시작 덱에는 늘 없고, 덱·장별 상대에는 늘 있다.
  for(const row of [...TRAIT_KINDS184,...TRAIT_KINDS196])
    assert.deepEqual([traitKindOffered197(row,true),traitKindOffered197({...row,shared:true},true),traitKindOffered197(row,true,true),traitKindOffered197({...row,shared:true},true,true),traitKindOffered197(row,false)],
      [false,true,false,false,true],row.kind);
  assert.equal(traitKindOffered197(null,false),false);
  assert.equal(traitKindOffered197({label:'x'},true),false);
});

test('197 validation: decks as before, characters take the shared kinds the database offers, starters only the starter kinds',()=>{
  const state=withTraits197(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:recoverTyped}));
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[...recoverTyped,typed('union_power',300),typed('ouija_board'),{...typed('heal_once'),value:600}]}));
  assert.throws(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typed('fusion_recover'),typed('fusion_recover')]}));
  const olderState=withTraitsBefore197(fixture041()),olderDeck=olderState.entities.find(e=>e.entity_type==='deck');
  assert.throws(()=>validateAuthoringChange066(olderState,'deck',olderDeck.entity_id,{skills:[typed('fusion_recover')]}),/현재 지원하지 않는 특성/,'before the migration the database list has no recover traits');
  assert.doesNotThrow(()=>validateAuthoringChange066(olderState,'deck',olderDeck.entity_id,{skills:[typed('union_power',300),typed('ouija_board')]}),'decks keep the 184 and 196 kinds');
  // 캐릭터: 197 뒤 7종(유니온의 힘 100~3000, 나머지 칸 없음)을 기본 특성과 특성 묶음에 받는다.
  character(state);
  const sharedRows=[{kind:'effect_damage_null'},{kind:'reflect_damage_null'},{kind:'first_damage_null'},{kind:'ouija_board'},{kind:'union_power',value:300},{kind:'fusion_recover'},{kind:'ritual_recover'},{kind:'heal_once',value:800}];
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',CHAR,{skills:sharedRows,skill_profiles:[{profile_id:'p197',name:'묶음',skills:[{kind:'union_power',value:3000},{kind:'ouija_board'}]}]}));
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[{kind:'union_power',value:100}],skill_profiles:[]}));
  for(const value of [99,3001,300.5,'300',undefined])
    assert.throws(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[{kind:'union_power',value}],skill_profiles:[]}),/유니온의 힘의 수치는 100~3000/,String(value));
  assert.throws(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[{kind:'ouija_board'},{kind:'ouija_board'}],skill_profiles:[]}),/같은 종류의 특성은 한 번만/);
  // 197 전 DB(184·196 shared:false, 회수 없음): 캐릭터는 7종 모두 거부(DB 저장 검사도 거부).
  character(olderState);
  for(const kind of CHARACTER_KINDS197)
    assert.throws(()=>validateAuthoringChange066(olderState,'character',CHAR,{skills:[{kind,...(kind==='union_power'?{value:300}:{})}],skill_profiles:[]}),/현재 지원하지 않는 특성/,kind);
  // 시작 덱: 회수 둘은 받고, DB가 shared로 표시한 184 네 종류·유니온의 힘은 거부한다(DB studio153_compile_starter_loadout도 거부, 앱 시작 덱 계획도 모름).
  state.bootstrap.capabilities.starter_loadout={lp_max:1000000,gold_max:1000000,relics_max:70};
  const starters=state.entities.find(row=>row.entity_type==='starter_list'),first=starters.content.entries[0];
  const withTraits=traits=>({entries:[{...first,start_loadout:{lp:4000,gold:0,relic_ids:[],traits}},...starters.content.entries.slice(1)]});
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'starter_list',starters.entity_id,withTraits([{kind:'fusion_recover'},{kind:'ritual_recover'},{kind:'parasite_deck'}])));
  for(const kind of ['union_power','ouija_board','effect_damage_null','reflect_damage_null','first_damage_null'])
    assert.throws(()=>validateAuthoringChange066(state,'starter_list',starters.entity_id,withTraits([{kind,...(kind==='union_power'?{value:300}:{})}])),/현재 지원하지 않는 특성/,kind+' stays off starter decks');
  assert.throws(()=>validateAuthoringChange066(olderState,'starter_list',olderState.entities.find(row=>row.entity_type==='starter_list').entity_id,
    {entries:[{...first,start_loadout:{lp:4000,gold:0,relic_ids:[],traits:[{kind:'fusion_recover'}]}}]}),/현재 지원하지 않는 특성|원정 시작 설정/);
});

test('197 deck editor: the add list is every compiled kind as before, with 융합회수 and 의식회수 and their help; adding one writes the typed row',async t=>{
  const state=withTraits197(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[];
  const before=JSON.stringify(state),ui=mounted(t,state,'decks',deck.entity_id),selects=addSelects(ui.root);
  assert.equal(selects.length,1);const select=selects[0];
  assert.deepEqual(optionKinds(select),compiledKinds(state),'the deck list follows the compiled flag (shared flags do not matter)');
  assert.deepEqual(optionKinds(select).slice(-2),TRAIT_KIND_IDS197);
  assert.deepEqual(select.options.slice(-2).map(option=>option.textContent),['융합회수','의식회수']);
  select.value='ritual_recover';select.fire('change');
  const help=ui.root.querySelectorAll('p').filter(node=>node.className.includes('au-trait-help184'));
  assert(help.some(node=>!node.hidden&&node.textContent===TRAIT_KINDS197[1].help),'help of the selected kind');
  button041(ui.root,'특성 추가').click();await tick();
  assert.equal(ui.writes.length,1);const [type,id,fields]=ui.writes[0];
  assert.equal(type,'deck');assert.equal(id,deck.entity_id);assert.deepEqual(fields,{skills:[typed('ritual_recover')]});
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.equal(JSON.stringify(state),before);assert.deepEqual(ui.errors,[]);
});

test('197 deck editor: a saved recover trait shows its label and help with no number field',t=>{
  const state=withTraits197(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[typed('fusion_recover')];
  const ui=mounted(t,state,'decks',deck.entity_id);
  const legend=ui.root.querySelectorAll('legend').find(node=>node.textContent==='융합회수');
  assert(legend,'legend');
  const box=legend.parentNode;
  assert(box.querySelectorAll('p').some(node=>node.className.includes('au-trait-help184')&&node.textContent===TRAIT_KINDS197[0].help));
  assert.equal(box.querySelectorAll('input').length,0,'no value, threshold or card field');
  assert.deepEqual(ui.errors,[]);
});

test('197 starter editor offers exactly the starter kinds (not the 184 kinds or union_power the database marks shared) and writes the kind-only shape',async t=>{
  const state=withTraits197(fixture041());state.bootstrap.capabilities.starter_loadout={lp_max:1000000,gold_max:1000000,relics_max:70};
  const starters=state.entities.find(row=>row.entity_type==='starter_list'),first=starters.content.entries[0],others=structuredClone(starters.content.entries.slice(1));
  const ui=mounted(t,state,'starters',starters.entity_id);
  const config=()=>ui.root.querySelector('.au-starter-loadout');
  open(config());
  const select=field041(config(),'추가할 특성');
  assert.deepEqual(optionKinds(select),[...STARTER_KINDS197]);
  for(const kind of ['lp_bonus','union_power','ouija_board','effect_damage_null','reflect_damage_null','first_damage_null'])assert(!optionKinds(select).includes(kind),kind);
  select.value='fusion_recover';select.fire('change');
  assert(config().querySelectorAll('p').some(node=>node.className.includes('au-trait-help184')&&!node.hidden&&node.textContent===TRAIT_KINDS197[0].help));
  button041(config(),'특성 추가').click();await tick();
  const [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual([type,id],['starter_list',starters.entity_id]);
  assert.deepEqual(fields.entries.find(row=>row.starter_id===first.starter_id).start_loadout,{lp:4000,gold:0,traits:[{kind:'fusion_recover'}],relic_ids:[]});
  assert.deepEqual(fields.entries.slice(1),others);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(ui.errors,[]);
});

test('197 character shared traits offer the 184 kinds, union_power and the recover traits once the database marks them shared',async t=>{
  const state=withTraits197(fixture041());character(state,[{kind:'heal_once',value:800}],[{profile_id:'p197',name:'묶음',skills:[]}]);
  const ui=mounted(t,state,'characters',CHAR),selects=addSelects(ui.root);
  assert.equal(selects.length,2,'the base list and the profile list');
  const sharedKinds=state.bootstrap.capabilities.trait_form.kinds.filter(row=>row.shared!==false).map(row=>row.kind);
  assert.deepEqual(optionKinds(selects[0]),sharedKinds.filter(kind=>kind!=='heal_once'));
  assert.deepEqual(optionKinds(selects[1]),sharedKinds);
  for(const select of selects)for(const kind of CHARACTER_KINDS197)assert(optionKinds(select).includes(kind),kind);
  // 기본 특성에 유니온의 힘을 더하면 {kind,value:300}(제작소 기본값)으로 쓴다.
  selects[0].value='union_power';selects[0].fire('change');
  addButtonFor(selects[0]).click();await tick();
  const [type,id,fields]=ui.writes.at(-1);
  assert.deepEqual([type,id],['character',CHAR]);
  assert.deepEqual(fields.skills,[{kind:'heal_once',value:800},{kind:'union_power',value:300}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(ui.errors,[]);
});

test('197 character shared traits: a saved 위저보드 in a profile has no field and union_power keeps its ATK/DEF value field',async t=>{
  const state=withTraits197(fixture041());character(state,[{kind:'union_power',value:500},{kind:'fusion_recover'}],[{profile_id:'p197',name:'묶음',skills:[{kind:'ouija_board'}]}]);
  const ui=mounted(t,state,'characters',CHAR);
  const legends=ui.root.querySelectorAll('legend').map(node=>node.textContent);
  for(const label of ['유니온의 힘','융합회수','위저보드 (다크 네크로피어)'])assert(legends.includes(label),label);
  const caption=ui.root.querySelectorAll('span').filter(node=>node.textContent==='공격력·수비력 상승');
  assert.equal(caption.length,1);
  assert.equal(caption[0].parentNode.querySelectorAll('input')[0].value,'500');
  const ouija=ui.root.querySelectorAll('legend').find(node=>node.textContent==='위저보드 (다크 네크로피어)').parentNode;
  assert.equal(ouija.querySelectorAll('input').length,0);
  // 특성 묶음에 의식회수를 더하면 {kind}만 쓴다.
  const profileSelect=addSelects(ui.root).at(-1);profileSelect.value='ritual_recover';profileSelect.fire('change');
  addButtonFor(profileSelect).click();await tick();
  const [,,fields]=ui.writes.at(-1);
  assert.deepEqual(fields.skill_profiles,[{profile_id:'p197',name:'묶음',skills:[{kind:'ouija_board'},{kind:'ritual_recover'}]}]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',CHAR,fields));
  assert.deepEqual(ui.errors,[]);
});

test('197 character shared traits before the database migration (shared:false) offer none of the new kinds',t=>{
  const state=withTraitsBefore197(fixture041());character(state,[{kind:'heal_once',value:800}],[{profile_id:'p197',name:'묶음',skills:[]}]);
  const ui=mounted(t,state,'characters',CHAR),selects=addSelects(ui.root);
  assert(selects.length>=1,'character trait add lists');
  for(const select of selects)for(const kind of CHARACTER_KINDS197)assert(!optionKinds(select).includes(kind),'shared list offers '+kind);
  assert.deepEqual(ui.errors,[]);
});

// 운영은 장별 편성의 상대(deck_compositions044)에 특성을 저장한다: 상대 편집 창도 회수 특성을 보이고 typed 모양으로 그 상대에만 쓴다.
function encounterFixture197(){
  const state=withTraits197(fixture041());state.bootstrap.capabilities.deck_compositions044=true;
  const source=state.entities.find(row=>row.entity_type==='deck'&&row.content.main.reduce((n,r)=>n+r.count,0)===20),deck=structuredClone(source);
  deck.entity_id='shared-deck';deck.content={...deck.content,name:'공유 덱',deck_name:'공유 덱',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};
  const encounter={...structuredClone(source.content),name:'회수 상대',deck_name:'회수 상대',lp_bonus:0,banlist_enabled:false,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};delete encounter.main;delete encounter.extra;
  const role={entity_type:'chapter_role',entity_id:'1:battle',version:1,state:'saved',issues:[],content:{chapter:1,role:'battle',lp_bonus:0,entries:[{entry_id:'enc-recover',deck_id:deck.entity_id,weight:1,encounter},{entry_id:'enc-other',deck_id:deck.entity_id,weight:1,encounter:structuredClone(encounter)}]}};
  const starter={entity_type:'starter_list',entity_id:'main',version:1,state:'saved',issues:[],content:{entries:[{starter_id:'lineage-original',name:'시작 덱',deck_id:deck.entity_id}]}};
  state.entities=state.entities.filter(row=>!['deck','chapter_role','starter_list'].includes(row.entity_type));state.entities.push(deck,role,starter);
  return {state,role};
}
function mountChapters(t,state){
  const doc=new Document041(),root=doc.createElement('main'),changes=[],errors=[];doc.body.append(root);
  const panels=createAuthoringPanels039({document:doc,onChange:(...args)=>{changes.push(structuredClone(args));return Promise.resolve();},onError:e=>errors.push(e.message),onNavigate:()=>{}});t.after(()=>panels.destroy());
  panels.render('chapters',root,state);root.querySelectorAll('.au-entry-pick066')[0].click();
  return {root,changes,errors,editor:root.querySelector('.au-encounter-editor066')};
}

test('197 chapter encounter editor offers the compiled kinds as before and writes the typed recover trait on that encounter only',async t=>{
  const {state}=encounterFixture197(),{changes,errors,editor}=mountChapters(t,state);
  assert(editor,'encounter editor');
  const selects=addSelects(editor);assert(selects.length>=1);
  for(const select of selects){assert.deepEqual(optionKinds(select),compiledKinds(state));for(const kind of TRAIT_KIND_IDS197)assert(optionKinds(select).includes(kind));}
  const select=selects.at(-1);select.value='fusion_recover';select.fire('change');
  assert(editor.querySelectorAll('p').some(node=>node.className.includes('au-trait-help184')&&!node.hidden&&node.textContent===TRAIT_KINDS197[0].help));
  const add=editor.querySelectorAll('button').filter(node=>node.textContent==='특성 추가').at(-1);add.click();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(changes.length,1);const [type,id,fields]=changes[0];
  assert.equal(type,'chapter_role');assert.equal(id,'1:battle');
  assert.deepEqual(fields.entries[0].encounter.skills,[typed('fusion_recover')]);
  assert.deepEqual(fields.entries[1].encounter.skills,[]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(errors,[]);
});

test('197 encounter bound to a character: the shared trait preview names 위저보드, 유니온의 힘 (+ATK/DEF, not a card count) and 융합회수',t=>{
  const {state,role}=encounterFixture197();
  const yugi=state.bootstrap.characters.find(row=>row.id==='fixture-character-yugi');
  yugi.profile={...yugi.profile,skills:[{kind:'ouija_board'},{kind:'union_power',value:1200},{kind:'fusion_recover'}],skill_profiles:[]};
  role.content.entries[0].encounter={...role.content.entries[0].encounter,shared_character_id:yugi.id,shared_skill_profile_id:null,use_shared_skills:true};
  const {errors,editor}=mountChapters(t,state);
  const preview=editor.querySelector('.au-shared-traits-preview');
  assert(preview,'shared trait preview');
  const items=preview.querySelectorAll('li').map(node=>node.textContent);
  assert.deepEqual(items,['위저보드 (다크 네크로피어)','유니온의 힘 · 공격력·수비력 +1,200','융합회수']);
  assert(!preview.textContent.includes('1200장'));
  assert.deepEqual(errors,[]);
});

test('the hourly web DB history finds the 197 route before the frozen 196 and 188 routes',()=>{
  // 찾는 폭이 30(161~191)이면 196이 고정한 188 응답만 읽어 기록이 멈춘다(개정 947). 197을 먼저 찾아야 한다.
  const list=routeCandidates();
  for(const route of ['poc_bootstrap197','poc_bootstrap196','poc_bootstrap193','poc_bootstrap188'])assert(list.includes(route),route);
  assert(list.indexOf('poc_bootstrap197')<list.indexOf('poc_bootstrap196'));
  assert(list.indexOf('poc_bootstrap196')<list.indexOf('poc_bootstrap188'));
});
