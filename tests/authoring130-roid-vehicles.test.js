import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY126} from '../authoring126-identity.js';
import {CONTENT_PROFILE130,GAME_IDENTITY130,gameIdentityMatches130} from '../authoring130-identity.js';
import {cardMetadata130} from '../authoring130-catalog.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039,normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {cardQueryMatches091} from '../authoring091-search.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {fixture041} from './authoring041-test-dom.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion130.json',import.meta.url),'utf8'));
const otherLimited={source_id:2400,alias:0,code:665,deck_limit:3,speed_limit:2,type:'trap'};
function bootstrapFor(catalog,identity=GAME_IDENTITY130){
  const payload=JSON.stringify({catalog,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:740,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:740,
      authoring_revision:740,metadata_revision:'740',identity,payload_json:payload,
      source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}

test('All 28 Roid batch cards keep exact deck editor identities, limits, art and categories',async()=>{
  const sourceCards=pack.cards.map(card=>({
    source_id:card.sourceId,web_slot:card.slot,identity_key:card.identity_key,name:card.name,
    name_english:card.nameEnglish,description:card.description,native_type:card.type,type_name:card.typeName,
    normal_limit:card.normalLimit,speed_limit:card.speedLimit,code:card.code,art_key:card.artKey,
    playable:card.playable,race:card.race,categories:card.categories,stock:true,draw_enabled:true
  }));
  const bootstrap=await normalizeBootstrap039(bootstrapFor(sourceCards),webcrypto);
  const cards=normalizeCatalog039({...fixture041(),bootstrap});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:28},(_,i)=>2867+i));
  for(const row of pack.cards){
    const card=cards.find(candidate=>candidate.source_id===row.sourceId);
    assert.equal(card.identity_key,row.identity_key);
    assert.equal(card.image,'assets/native130/cards/'+row.sourceId+'.jpg');
    assert.equal(readFileSync(new URL('../'+card.image,import.meta.url)).subarray(0,3).toString('hex'),'ffd8ff');
    assert.deepEqual(card.search_aliases,row.searchAliases);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.description_ko,row.description);
    assert.equal(card.speed_limit,row.speedLimit);
    assert.equal(cardMetadata130(row.sourceId,'0'.repeat(64)),null);
  }
  const city=cards.find(card=>card.code===44139064);
  const drill=cards.find(card=>card.code===36256625);
  assert(cardQueryMatches091(city,'메가로이드시티'));
  const snapshot={bootstrap:{catalog:sourceCards,capabilities:{entities:{card_limit:{
    fields:{speed_limit:{type:'nullable_integer',min:-1,max:3}}
  }}}}};
  for(const speed_limit of [-1,3])assert.throws(()=>validateAuthoringChange066(snapshot,'card_limit','2886',{speed_limit}),/제한 2/);
  for(const speed_limit of [null,0,1,2])assert.doesNotThrow(()=>validateAuthoringChange066(snapshot,'card_limit','2886',{speed_limit}));
  const empty={banlist_enabled:true,main:[],extra:[]};
  const one=changeDeckCard039(empty,city,1,cards);
  const two=changeDeckCard039(one,otherLimited,1,[...cards,otherLimited]);
  assert.throws(()=>changeDeckCard039(two,city,1,[...cards,otherLimited]),/제한 2/);
  assert.equal(changeDeckCard039(empty,drill,1,cards).extra[0].source_id,drill.source_id);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards130');
  const themes=additionThemes067(cards,'latest',additions);
  assert.equal(themes.find(theme=>theme.key==='roid-fusions130').count,5);
  assert.equal(themes.reduce((sum,theme)=>sum+theme.count,0),28);
});

test('Card publication recognizes both previous and current exact identities',async()=>{
  assert.deepEqual(CONTENT_PROFILE130,{schema:1,card_set:'roid-vehicles130'});
  assert(gameIdentityMatches130(GAME_IDENTITY126));
  assert(gameIdentityMatches130(GAME_IDENTITY130));
  assert.deepEqual((await normalizeBootstrap039(bootstrapFor([],GAME_IDENTITY126),webcrypto)).gameEnvelope.identity,GAME_IDENTITY126);
  await assert.rejects(normalizeBootstrap039(bootstrapFor([],{
    ...GAME_IDENTITY130,catalog130_sha256:'0'.repeat(64)
  }),webcrypto),/게임 버전/);
});
