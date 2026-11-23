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
import {GAME_IDENTITY188, gameIdentityAccepts188} from '../authoring188-identity.js';
import {CONTENT_PROFILE196, GAME_IDENTITY196, gameIdentityAccepts196, gameIdentityMatches196} from '../authoring196-identity.js';
import {cardMetadata196} from '../authoring196-catalog.js';
import {cardMetadata188} from '../authoring188-catalog.js';
import {TRAIT_KINDS196, TRAIT_KIND_IDS196, TRAIT_DEFAULTS196, traitDefault196, traitFieldLabel196} from '../authoring196-traits.js';
import {TRAIT_KINDS184, traitKindOffered184, traitHelp184} from '../authoring184-traits.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, createAuthoringPanels039, normalizeCatalog039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {Document041, fixture041, button041} from './authoring041-test-dom.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion196.json',import.meta.url),'utf8'));
const pack188=JSON.parse(readFileSync(new URL('../data/native-expansion188.json',import.meta.url),'utf8'));
const pack183=JSON.parse(readFileSync(new URL('../data/native-expansion183.json',import.meta.url),'utf8'));
const pack175=JSON.parse(readFileSync(new URL('../data/native-expansion175.json',import.meta.url),'utf8'));
const pack174=JSON.parse(readFileSync(new URL('../data/native-expansion174.json',import.meta.url),'utf8'));
const pack165=JSON.parse(readFileSync(new URL('../data/native-expansion165.json',import.meta.url),'utf8'));
const pack162=JSON.parse(readFileSync(new URL('../data/native-expansion162.json',import.meta.url),'utf8'));
const pack161=JSON.parse(readFileSync(new URL('../data/native-expansion161.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY196){
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
// 엘리멘틀 히어로 템피스터·플라즈마 바이스맨·와일드 쟤기맨(융합)
const EXTRA=[83121692,60493189,10526791];
// 유니온 몬스터: Y－드래곤 헤드·Z－메탈 캐터필러·W－윙 캐터펄트(메인 덱)
const UNION=[65622692,64500000,96300057];

test('Union and Elemental HERO cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:19},(_,i)=>3208+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:19},(_,i)=>2240+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native196/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native196/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.deepEqual(cardMetadata196(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata196(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata196(row.sourceId,'0'.repeat(64)),null);
  }
  // 19장: 일반 3, 스피드 제한 없음, 토큰 없음. 융합 3장은 엑스트라 칸, 유니온 3장·마법·함정을 포함한 나머지 16장은 메인 칸.
  assert.equal(cards.filter(card=>card.token).length,0);
  for(const card of cards){
    assert.equal(card.deck_limit,3);
    assert.equal(cardMetadata196(card.source_id,card.identity_key).maximumNormalLimit,undefined);
    const added=changeDeckCard039(draft(),card,1,cards);
    if(EXTRA.includes(card.code)){
      assert.equal(added.extra[0].source_id,card.source_id,card.name_ko);
      assert.equal(added.main.length,0,card.name_ko);
    }else{
      assert.equal(added.main[0].source_id,card.source_id,card.name_ko);
      assert.equal(added.extra.length,0,card.name_ko);
    }
  }
  assert.deepEqual(cards.filter(card=>UNION.includes(card.code)).map(card=>card.source_id),[3224,3225,3226]);
  assert.deepEqual(cards.filter(card=>EXTRA.includes(card.code)).map(card=>card.source_id),[3215,3217,3219]);
  const yDragon=cards.find(card=>card.code===65622692);
  const deck=[1,2,3].reduce(next=>changeDeckCard039(next,yDragon,1,cards),draft());
  assert.equal(deck.main[0].count,3);
  assert.equal(cards.filter(card=>card.tags.includes('지원-유니온')).length,7);
  assert.equal(cards.filter(card=>card.tags.includes('지원-엘리멘틀 히어로')).length,10);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards196');
  assert.equal(additions.latest.label,'유니온·엘리멘틀 히어로');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['union196',7],['elemental-hero196',6],['hero-support196',4],['clear-world196',2]]);
});

test('the 196 metadata keeps the 188, 183, 175, 174, 165, 162 and 161 cards and their display-only tokens',()=>{
  for(const row of [...pack188.cards,...pack183.cards,...pack175.cards,...pack174.cards,...pack165.cards,...pack162.cards,...pack161.cards])
    assert.deepEqual(cardMetadata196(row.sourceId,row.identity_key),cardMetadata188(row.sourceId,row.identity_key));
  for(const row of pack188.cards)
    assert.equal(cardMetadata196(row.sourceId,row.identity_key).image,'assets/native188/cards/'+row.sourceId+'.jpg');
  const king=pack165.cards.find(row=>row.code===16528181);
  assert.equal(cardMetadata196(king.sourceId,king.identity_key).maximumSpeedLimit,2);
  for(const token of [...pack183.cards,...pack161.cards].filter(row=>row.token))
    assert.equal(cardMetadata196(token.sourceId,token.identity_key).maximumNormalLimit,0);
});

test('the studio opens 152 to 188 and exact 196 databases and rejects a forged 196 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE196,{schema:1,card_set:'union-hero196'});
  assert.equal(Object.keys(GAME_IDENTITY196).length,63);
  assert.equal(Object.keys(GAME_IDENTITY196).length,Object.keys(GAME_IDENTITY188).length+2);
  assert.deepEqual(Object.keys(GAME_IDENTITY196).slice(-2),['catalog196_sha256','native_manifest196_sha256']);
  assert.equal(GAME_IDENTITY196.catalog188_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY196.native_manifest188_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175,GAME_IDENTITY183,GAME_IDENTITY188])
    assert(gameIdentityMatches196(identity),'a site published before the database migration still opens the older database');
  assert(gameIdentityMatches196(GAME_IDENTITY196));
  assert(!gameIdentityMatches196({...GAME_IDENTITY196,catalog196_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches196({...GAME_IDENTITY196,extra:'x'}));
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175,GAME_IDENTITY183,GAME_IDENTITY188,GAME_IDENTITY196])
    await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  // 지금 공개된 188 제작소도 196 DB를 받는다(188 규칙의 새 팩 허용). 그래서 DB를 먼저 올려도 제작소가 멈추지 않는다.
  assert(gameIdentityAccepts188(GAME_IDENTITY196));
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY196,catalog196_sha256:'0'.repeat(64)},{...GAME_IDENTITY196,native_manifest196_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY188,catalog196_sha256:hex,native_manifest196_sha256:hex}]){
    assert(gameIdentityAccepts188(forged),'the 188 rule alone would accept unknown 196 fingerprints');
    assert(!gameIdentityAccepts196(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 196 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts196({...GAME_IDENTITY196,catalog198_sha256:hex,native_manifest198_sha256:hex}));
  assert(gameIdentityAccepts196({...GAME_IDENTITY196,catalog197_sha256:hex,native_manifest197_sha256:hex}));
  assert(!gameIdentityAccepts196({...GAME_IDENTITY196,catalog196_sha256:'0'.repeat(64),catalog198_sha256:hex}),'known keys must still match');
  assert(!gameIdentityAccepts196({...GAME_IDENTITY196,extra:hex}),'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts196({...GAME_IDENTITY196,catalog198_sha256:'x'}),'added keys must be sha256');
  assert(!gameIdentityAccepts196({...GAME_IDENTITY196,catalog196_sha256x:hex}),'added keys must use the pack key form');
  assert(!gameIdentityAccepts196({...GAME_IDENTITY196,catalog188_sha256:hex}),'an older pack key cannot change after 196');
  assert(!gameIdentityAccepts196({...GAME_IDENTITY196,catalog190_sha256:hex}),'an older pack number cannot be added after 196');
  assert(!gameIdentityAccepts196({...GAME_IDENTITY188,catalog198_sha256:hex}),'a newer pack cannot skip 196');
  const {catalog196_sha256,...missing}=GAME_IDENTITY196;
  assert(!gameIdentityAccepts196({...missing,catalog198_sha256:hex}),'a known key cannot be dropped');
  assert(!gameIdentityAccepts196(null));
  assert(!gameIdentityAccepts196([]));
});

// (196) 상대 특성 '유니온의 힘'(union_power): DB가 capabilities.trait_form.kinds 끝에 정의 하나(값 100~3000, shared:false)를 더한다.
// 덱·장별 상대는 고를 수 있고, 캐릭터 공용 특성·시작 덱 특성은 고를 수 없다(DB도 거부). 새로 더하면 기본 300.
const CHAR='traits196-character';
const typed=(kind,value=0)=>({kind,value,threshold:0,sourceId:-1,position:0,entries:[]});
function withTraits196(state){state.bootstrap.capabilities.trait_form.kinds.push(...structuredClone(TRAIT_KINDS184),...structuredClone(TRAIT_KINDS196));return state;}
function character(state,skills=[],skill_profiles=[]){
  state.entities.push({entity_type:'character',entity_id:CHAR,version:3,state:'saved',issues:[],content:{name:'특성 확인 캐릭터',portrait:'',skills,skill_profiles}});
}
function mounted(t,state,section,id){
  const document=new Document041(),root=document.createElement('main'),writes=[],errors=[];document.body.append(root);
  const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(structuredClone(args)),onError:error=>errors.push(error)});
  panels.selectEntity065(section,id);if(section==='decks')panels.selectDeck(id);panels.render(section,root,state);t.after(()=>panels.destroy());
  if(section==='characters')for(const selector of ['.au-character-traits','.au-character-trait-profile'])for(const disclosure of root.querySelectorAll(selector)){disclosure.open=true;disclosure.fire('toggle',{bubbles:false});}
  return {root,writes,errors};
}
const addSelects=root=>root.querySelectorAll('select').filter(node=>node.getAttribute('aria-label')==='추가할 특성');
const optionKinds=select=>select.options.map(option=>option.value);

test('196 trait module: union_power with a Korean label, help, range 100..3000 and the studio default 300',()=>{
  assert.deepEqual(TRAIT_KIND_IDS196,['union_power']);
  const [row]=TRAIT_KINDS196;
  assert.deepEqual(Object.keys(row),['kind','label','fields','compiled','shared','help']);
  assert.deepEqual([row.label,row.fields,row.compiled,row.shared],['유니온의 힘',{value:{max:3000,min:100,type:'integer'}},true,false]);
  for(const word of ['유니온 몬스터','장착','공격력·수비력'])assert(row.help.includes(word),word);
  assert.deepEqual(TRAIT_DEFAULTS196,{union_power:{value:300}});
  assert.equal(traitDefault196('union_power','value',row.fields.value),300);
  assert.equal(traitDefault196('union_power','value',{min:500,max:3000}),500,'a default outside the database bounds falls back to the minimum');
  assert.equal(traitDefault196('heal_once','value',{min:100,max:8000}),100,'older kinds keep starting at the minimum');
  assert.equal(traitDefault196('draw_once','threshold',{min:100,max:16000}),100);
  assert.deepEqual(['union_power','heal_once','lp_bonus','draw_once','opening_draw'].map(kind=>traitFieldLabel196(kind,'value')),['공격력·수비력 상승','LP 수치','LP 수치','드로우 장수','드로우 장수']);
  assert.equal(traitFieldLabel196('draw_once','threshold'),'발동 LP');
  assert.equal(traitKindOffered184(row,false),true);
  assert.equal(traitKindOffered184(row,true),false,'shared editors do not offer union_power');
  assert.equal(traitHelp184(row),row.help);
});

test('196 validation: decks accept union_power 100..3000 once the database offers it; characters never do',()=>{
  const state=withTraits196(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');
  for(const value of [100,300,3000])assert.doesNotThrow(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typed('union_power',value)]}));
  assert.doesNotThrow(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typed('union_power',300),typed('ouija_board'),{...typed('heal_once'),value:600}]}));
  for(const value of [0,99,3001])assert.throws(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typed('union_power',value)]}),/유니온의 힘의 수치는 100~3000/);
  assert.throws(()=>validateAuthoringChange066(state,'deck',deck.entity_id,{skills:[typed('union_power',300),typed('union_power',400)]}));
  const older=fixture041(),olderDeck=older.entities.find(e=>e.entity_type==='deck');
  assert.throws(()=>validateAuthoringChange066(older,'deck',olderDeck.entity_id,{skills:[typed('union_power',300)]}),/현재 지원하지 않는 특성/,'before the migration the database list has no union_power');
  character(state);
  assert.throws(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[{kind:'union_power',value:300}],skill_profiles:[]}),/현재 지원하지 않는 특성/);
});

test('196 deck editor: the add list offers 유니온의 힘 with help, and adding it writes the typed row with 300',async t=>{
  const state=withTraits196(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[];
  const before=JSON.stringify(state),ui=mounted(t,state,'decks',deck.entity_id),selects=addSelects(ui.root);
  assert.equal(selects.length,1);const select=selects[0];
  assert.equal(optionKinds(select).at(-1),'union_power');
  assert.equal(select.options.at(-1).textContent,'유니온의 힘');
  select.value='union_power';select.fire('change');
  const help=ui.root.querySelectorAll('p').filter(node=>node.className.includes('au-trait-help184'));
  assert(help.some(node=>!node.hidden&&node.textContent===TRAIT_KINDS196[0].help),'help of the selected kind');
  button041(ui.root,'특성 추가').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.writes.length,1);const [type,id,fields]=ui.writes[0];
  assert.equal(type,'deck');assert.equal(id,deck.entity_id);assert.deepEqual(fields,{skills:[typed('union_power',300)]});
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.equal(JSON.stringify(state),before);assert.deepEqual(ui.errors,[]);
});

test('196 deck editor: a saved union_power shows its label, help and the ATK/DEF value field',t=>{
  const state=withTraits196(fixture041()),deck=state.entities.find(e=>e.entity_type==='deck');deck.content.skills=[typed('union_power',500)];
  const ui=mounted(t,state,'decks',deck.entity_id);
  assert(ui.root.querySelectorAll('legend').some(node=>node.textContent==='유니온의 힘'));
  assert(ui.root.querySelectorAll('p').some(node=>node.className.includes('au-trait-help184')&&node.textContent===TRAIT_KINDS196[0].help));
  const caption=ui.root.querySelectorAll('span').filter(node=>node.textContent==='공격력·수비력 상승');
  assert.equal(caption.length,1,'the value field is named for ATK/DEF, not draw count');
  assert(!ui.root.querySelectorAll('span').some(node=>node.textContent==='드로우 장수'));
  assert.equal(caption[0].parentNode.querySelectorAll('input')[0].value,'500');
  assert.deepEqual(ui.errors,[]);
});

test('196 character shared traits do not offer union_power',t=>{
  const state=withTraits196(fixture041());character(state,[{kind:'heal_once',value:800}],[{profile_id:'p196',name:'묶음',skills:[]}]);
  const ui=mounted(t,state,'characters',CHAR),selects=addSelects(ui.root);
  assert(selects.length>=1,'character trait add lists');
  for(const select of selects)assert(!optionKinds(select).includes('union_power'),'shared list offers union_power');
  assert.deepEqual(ui.errors,[]);
});

// 운영은 장별 편성의 상대(deck_compositions044)에 특성을 저장한다: 상대 편집 창도 union_power를 보이고 기본 300으로 그 상대에만 쓴다.
function encounterFixture196(){
  const state=withTraits196(fixture041());state.bootstrap.capabilities.deck_compositions044=true;
  const source=state.entities.find(row=>row.entity_type==='deck'&&row.content.main.reduce((n,r)=>n+r.count,0)===20),deck=structuredClone(source);
  deck.entity_id='shared-deck';deck.content={...deck.content,name:'공유 덱',deck_name:'공유 덱',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};
  const encounter={...structuredClone(source.content),name:'유니온 상대',deck_name:'유니온 상대',lp_bonus:0,banlist_enabled:false,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};delete encounter.main;delete encounter.extra;
  const role={entity_type:'chapter_role',entity_id:'1:battle',version:1,state:'saved',issues:[],content:{chapter:1,role:'battle',lp_bonus:0,entries:[{entry_id:'enc-union',deck_id:deck.entity_id,weight:1,encounter},{entry_id:'enc-other',deck_id:deck.entity_id,weight:1,encounter:structuredClone(encounter)}]}};
  const starter={entity_type:'starter_list',entity_id:'main',version:1,state:'saved',issues:[],content:{entries:[{starter_id:'lineage-original',name:'시작 덱',deck_id:deck.entity_id}]}};
  state.entities=state.entities.filter(row=>!['deck','chapter_role','starter_list'].includes(row.entity_type));state.entities.push(deck,role,starter);
  return {state,role};
}

test('196 chapter encounter editor offers union_power and writes the typed trait with 300 on that encounter only',async t=>{
  const {state}=encounterFixture196(),doc=new Document041(),root=doc.createElement('main'),changes=[],errors=[];doc.body.append(root);
  const panels=createAuthoringPanels039({document:doc,onChange:(...args)=>{changes.push(structuredClone(args));return Promise.resolve();},onError:e=>errors.push(e.message),onNavigate:()=>{}});t.after(()=>panels.destroy());
  panels.render('chapters',root,state);root.querySelectorAll('.au-entry-pick066')[0].click();
  const editor=root.querySelector('.au-encounter-editor066');assert(editor,'encounter editor');
  const selects=addSelects(editor);assert(selects.length>=1);
  for(const select of selects)assert(optionKinds(select).includes('union_power'));
  const select=selects.at(-1);select.value='union_power';select.fire('change');
  assert(editor.querySelectorAll('p').some(node=>node.className.includes('au-trait-help184')&&!node.hidden&&node.textContent===TRAIT_KINDS196[0].help));
  const add=editor.querySelectorAll('button').filter(node=>node.textContent==='특성 추가').at(-1);add.click();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(changes.length,1);const [type,id,fields]=changes[0];
  assert.equal(type,'chapter_role');assert.equal(id,'1:battle');
  assert.deepEqual(fields.entries[0].encounter.skills,[typed('union_power',300)]);
  assert.deepEqual(fields.entries[1].encounter.skills,[]);
  assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));
  assert.deepEqual(errors,[]);
});
