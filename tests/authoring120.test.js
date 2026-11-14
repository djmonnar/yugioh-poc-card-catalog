import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY109} from '../authoring109-identity.js';
import {GAME_IDENTITY120,gameIdentityMatches120} from '../authoring120-identity.js';
import {cardMetadata120} from '../authoring120-catalog.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039,createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {additionThemes067} from '../authoring067-themes.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {traitCardMatches089} from '../authoring089-traits.js';
import {cardQueryMatches091} from '../authoring091-search.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const read=file=>readFileSync(new URL(file,import.meta.url));
const sha=value=>createHash('sha256').update(value).digest('hex');
const manifest=read('../data/native-expansion120.json');
const additions=JSON.parse(manifest).cards;
const library=2770, tokenSources=[2784,2790];

function fixture(){
  const state=fixture041();
  state.bootstrap.catalog.cards.push(...additions.map(card=>({
    source_id:card.sourceId,web_slot:card.slot,code:card.code,alias:card.alias,identity_key:card.identity_key,
    name:card.name,name_english:card.nameEnglish,description:card.description,rarity:card.rarity,
    native_type:card.type,type_name:card.typeName,level:card.level,attribute:card.attribute,race:card.race,
    attack:card.attack,defense:card.defense,normal_limit:card.normalLimit,speed_limit:card.speedLimit,
    playable:card.playable,token:card.token,art_key:card.artKey,categories:card.categories,
    stock:card.playable,draw_enabled:card.playable
  })));
  return state;
}

function wire(state,identity){
  const payload=JSON.stringify({catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},
    content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',
    project_revision:621,unchanged:false,permissions:{can_edit:true},authoring:{entities:state.entities},
    game:{schema:1,kind:'poc-unified-game039',game_revision:621,authoring_revision:621,
      metadata_revision:'621',identity,payload_json:payload,source_fingerprint:sha(payload)}};
}

function mount(t,state){
  const document=new Document041(), root=document.createElement('main'), errors=[];
  document.body.append(root);
  const panels=createAuthoringPanels039({document,onChange:()=>{},onError:error=>errors.push(error)});
  t.after(()=>panels.destroy());
  return {document,root,panels,errors};
}

test('exact 120 game identity and earlier supported 109 identity both load',async()=>{
  assert.equal(Object.keys(GAME_IDENTITY120).length,29);
  assert.deepEqual(Object.fromEntries(Object.entries(GAME_IDENTITY120).slice(0,27)),GAME_IDENTITY109);
  assert(gameIdentityMatches120(GAME_IDENTITY109));
  assert(gameIdentityMatches120(GAME_IDENTITY120));
  const {catalog120_sha256,...partial}=GAME_IDENTITY120;
  const bad=[partial,{...GAME_IDENTITY120,catalog120_sha256:'0'.repeat(64)},{...GAME_IDENTITY120,extra:0}];
  for(const identity of bad){
    assert.equal(gameIdentityMatches120(identity),false);
    await assert.rejects(normalizeBootstrap039(wire(fixture(),identity),webcrypto),/게임 버전/);
  }
  const previous=fixture041();
  for(const [state,identity] of [[previous,GAME_IDENTITY109],[fixture(),GAME_IDENTITY120]]){
    const raw=wire(state,identity);
    const normalized=await normalizeBootstrap039(raw,webcrypto);
    assert.equal(normalized.gamePayload.catalog.length,state.bootstrap.catalog.cards.length);
  }
});

test('new rows, identity-bound art and aliases match the released manifest',()=>{
  assert.equal(sha(manifest),'8cf043043205ab3b0d7d5922ea2621deca4d8ba3c4b0f74371bac000787a446f');
  const normalized=normalizeCatalog039(fixture()).filter(card=>card.source_id>=2765);
  assert.equal(normalized.length,26);
  for(const [index,row] of additions.entries()){
    const {sourceId,slot,code,identity_key,searchAliases}=row;
    assert.equal(sourceId,2765+index);
    assert.equal(slot,1797+index);
    assert.equal(identity_key,sha(['unity-native120',slot,sourceId,code].join('\0')));
    assert.equal(cardMetadata120(sourceId,'0'.repeat(64)),null);
    const card=normalized[index],expectedImage=`assets/native120/cards/${sourceId}.jpg`;
    assert.equal(card.image,expectedImage);
    const image=read('../'+expectedImage);
    assert(image.length>1000&&image[0]===255&&image[1]===216);
    for(const query of searchAliases)assert(cardQueryMatches091(card,query),query);
    assert.equal(traitCardMatches089(card),!tokenSources.includes(sourceId));
  }
  const all=normalizeCatalog039(fixture()),latest=catalogAdditions049(all);
  assert.equal(latest.latest.key,'Cards120');
  assert.equal(latest.latest.count,26);
  assert.equal(additionThemes067(all,'Cards120',latest).reduce((total,row)=>total+row.count,0),26);
});

test('Library cap and effect-only tokens apply to deck additions and editor changes',()=>{
  const state=fixture();
  const entities=state.bootstrap.capabilities.entities;
  entities.card_limit={operations:['patch'],fields:{normal_limit:{type:'nullable_integer',min:0,max:3},speed_limit:{type:'nullable_integer',min:-1,max:3}}};
  entities.card_setting={operations:['patch'],fields:{stock:{type:'boolean'},draw_enabled:{type:'boolean'},rarity:{type:'enum',values:['N','R','SR','UR']}}};
  const cards=normalizeCatalog039(state), limited=cards.find(card=>card.source_id===library);
  const deck={main:[],extra:[],banlist_enabled:true};
  assert.equal(limited.effective_normal_limit,1);
  const once=changeDeckCard039(deck,limited,1,cards);
  assert.throws(()=>changeDeckCard039(once,limited,1,cards),/제한 매수/);
  assert.throws(()=>validateAuthoringChange066(state,'card_limit',String(library),{normal_limit:2}),/최대 1장/);
  for(const option of [0,1,null])assert.doesNotThrow(()=>validateAuthoringChange066(state,'card_limit',String(library),{normal_limit:option}));
  for(const id of tokenSources){
    const token=cards.find(card=>card.source_id===id);
    assert.equal(token.deck_limit,0);
    assert.equal(token.stock,false);
    assert.equal(token.draw_enabled,false);
    assert.throws(()=>changeDeckCard039(deck,token,1,cards),/덱에 넣을 수 없습니다/);
    assert.throws(()=>validateAuthoringChange066(state,'card_setting',String(id),{stock:true}),/토큰/);
    assert.throws(()=>validateAuthoringChange066(state,'card_limit',String(id),{normal_limit:1}),/토큰/);
  }
});

test('recent catalog displays 26 rows with usable legacy queries and safe effect text',t=>{
  const state=fixture();
  const ui=mount(t,state);
  ui.panels.render('cards',ui.root,state);
  button041(ui.root,'최근 추가').click();
  assert.equal(field041(ui.root,'추가 묶음').value,'Cards120');
  const summary=()=>ui.root.querySelector('.au-card-results-summary').textContent;
  assert.match(summary(),/^26종/);
  const search=field041(ui.root,'카드 검색');
  for(const [query,label] of [['제스티 콩피','제스터 콩피'],['썬더나이트','썬더 나이트'],['가신 토큰','가신 토큰']]){
    search.value=query;
    search.fire('input');
    assert(ui.root.querySelectorAll('button').some(node=>node.getAttribute('aria-label')===`${label} 카드 정보`),query);
  }
  const card=normalizeCatalog039(state).find(row=>row.source_id===2766);
  ui.panels.openCard({...card,description_ko:card.description_ko+'<img src=x onerror=alert(0)>'});
  const description=ui.document.querySelector('.au-card-description');
  assert(description.querySelector('br'));
  assert.equal(description.querySelector('img'),null);
  assert.match(description.textContent,/<img src=x/);
  assert.deepEqual(ui.errors,[]);
});
