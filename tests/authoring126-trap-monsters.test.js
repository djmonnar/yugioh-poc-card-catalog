import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY125} from '../authoring125-identity.js';
import {CONTENT_PROFILE126,GAME_IDENTITY126,gameIdentityMatches126} from '../authoring126-identity.js';
import {cardMetadata126} from '../authoring126-catalog.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039,normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {cardQueryMatches091} from '../authoring091-search.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {fixture041} from './authoring041-test-dom.js';

const dataPath=new URL('../data/native-expansion126.json',import.meta.url);
const pack=JSON.parse(readFileSync(dataPath,'utf8'));
const chessCard={source_id:2400,alias:0,code:665,deck_limit:3,speed_limit:1,type:'trap'};

function bootstrapFor(cards,identity=GAME_IDENTITY126){
  const payload=JSON.stringify({catalog:cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:717,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:717,
      authoring_revision:717,metadata_revision:'717',identity,payload_json:payload,
      source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}

test('New cards keep exact identity, category, aliases, image and deck restrictions',async()=>{
  const sourceCards=pack.cards.map(card=>({
    source_id:card.sourceId,web_slot:card.slot,identity_key:card.identity_key,name:card.name,
    name_english:card.nameEnglish,native_type:card.type,type_name:card.typeName,normal_limit:card.normalLimit,
    speed_limit:card.speedLimit,code:card.code,art_key:card.artKey,playable:card.playable,race:card.race,
    categories:card.categories,stock:true,draw_enabled:true
  }));
  const bootstrap=await normalizeBootstrap039(bootstrapFor(sourceCards),webcrypto);
  const cards=normalizeCatalog039({...fixture041(),bootstrap});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:28},(_,index)=>2839+index));
  for(const row of pack.cards){
    const card=cards.find(candidate=>candidate.source_id===row.sourceId);
    assert.equal(card.identity_key,row.identity_key);
    assert.equal(card.image,'assets/native126/cards/'+row.sourceId+'.jpg');
    assert.equal(readFileSync(new URL('../'+card.image,import.meta.url)).subarray(0,3).toString('hex'),'ffd8ff');
    assert.deepEqual(card.search_aliases,row.searchAliases);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.deck_limit,row.normalLimit);
    assert.equal(card.speed_limit,row.speedLimit);
    assert.equal(cardMetadata126(row.sourceId,'0'.repeat(64)),null);
  }
  const rainbow=cards.find(card=>card.source_id===2845);
  assert(cardQueryMatches091(rainbow,'레인보우라이프'));
  const snapshot={bootstrap:{catalog:sourceCards,capabilities:{entities:{card_limit:{
    fields:{speed_limit:{type:'nullable_integer',min:-1,max:3}}
  }}}}};
  for(const speed_limit of [-1,2,3])assert.throws(()=>validateAuthoringChange066(snapshot,'card_limit','2845',{speed_limit}),/제한 1/);
  for(const speed_limit of [null,0,1])assert.doesNotThrow(()=>validateAuthoringChange066(snapshot,'card_limit','2845',{speed_limit}));
  const empty={banlist_enabled:true,main:[],extra:[]};
  const one=changeDeckCard039(empty,rainbow,1,cards);
  assert.throws(()=>changeDeckCard039(one,rainbow,1,cards),/제한 1/);
  assert.throws(()=>changeDeckCard039(one,chessCard,1,[...cards,chessCard]),/제한 1/);
  assert(cardQueryMatches091(cards.find(card=>card.source_id===2843),'마도화리전'));
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards126');
  const themes=additionThemes067(cards,'latest',additions);
  assert.equal(themes.find(theme=>theme.key==='trap-monsters126').count,6);
  assert.equal(themes.reduce((sum,theme)=>sum+theme.count,0),28);
});

test('The new publication accepts the exact previous cards and rejects mismatched identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE126,{schema:1,card_set:'trap-monsters126'});
  assert(gameIdentityMatches126(GAME_IDENTITY126));
  assert(gameIdentityMatches126(GAME_IDENTITY125));
  assert.deepEqual((await normalizeBootstrap039(bootstrapFor([],GAME_IDENTITY125),webcrypto)).gameEnvelope.identity,GAME_IDENTITY125);
  await assert.rejects(normalizeBootstrap039(bootstrapFor([],{
    ...GAME_IDENTITY126,catalog126_sha256:'0'.repeat(64)
  }),webcrypto),/게임 버전/);
});
