import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY130} from '../authoring130-identity.js';
import {CONTENT_PROFILE135,GAME_IDENTITY135,gameIdentityMatches135} from '../authoring135-identity.js';
import {cardMetadata135} from '../authoring135-catalog.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039,normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {cardQueryMatches091} from '../authoring091-search.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion135.json',import.meta.url),'utf8'));
function bootstrapFor(catalog,identity=GAME_IDENTITY135){
  const payload=JSON.stringify({catalog,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:756,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:756,
      authoring_revision:756,metadata_revision:'756',identity,payload_json:payload,
      source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}

test('All 38 rows expose canonical image, identities, categories and limits',async()=>{
  const sourceCards=pack.cards.map(card=>({
    source_id:card.sourceId,web_slot:card.slot,identity_key:card.identity_key,name:card.name,alias:card.alias,
    name_english:card.nameEnglish,description:card.description,native_type:card.type,type_name:card.typeName,
    normal_limit:card.normalLimit,speed_limit:card.speedLimit,code:card.code,art_key:card.artKey,
    playable:card.playable,token:card.token,race:card.race,categories:card.categories,stock:true,draw_enabled:true
  }));
  const bootstrap=await normalizeBootstrap039(bootstrapFor(sourceCards),webcrypto);
  const cards=normalizeCatalog039({bootstrap});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:38},(_,i)=>2895+i));
  for(const row of pack.cards){
    const card=cards.find(candidate=>candidate.source_id===row.sourceId);
    assert.equal(card.identity_key,row.identity_key);
    assert.equal(card.image,'assets/native135/cards/'+row.sourceId+'.jpg');
    assert.equal(readFileSync(new URL('../'+card.image,import.meta.url)).subarray(0,3).toString('hex'),'ffd8ff');
    assert.deepEqual(card.search_aliases,row.searchAliases);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.equal(card.description_ko,row.description);
    assert.equal(card.deck_limit,row.normalLimit);
    assert.equal(card.speed_limit,row.speedLimit);
    assert.equal(card.playable,row.playable);
    assert.equal(card.token,row.token);
    assert.equal(cardMetadata135(row.sourceId,'0'.repeat(64)),null);
  }
  const empty={banlist_enabled:true,main:[],extra:[]};
  for(const id of [2899,2931,2932]){
    const token=cards.find(card=>card.source_id===id);
    assert.equal(token.playable,false);
    assert.equal(token.deck_limit,0);
    assert.equal(token.stock,false);
    assert.equal(token.draw_enabled,false);
    assert.equal(token.reward_eligible,false);
    assert.throws(()=>changeDeckCard039(empty,token,1,cards),/덱에 넣을 수 없습니다/);
  }
  const tank=cards.find(card=>card.source_id===2912);
  const tyranno=cards.find(card=>card.source_id===2908);
  assert(cardQueryMatches091(tyranno,'궁극의전도티라노'));
  assert.equal(changeDeckCard039(empty,tank,1,cards).extra[0].source_id,2912);
  assert.equal(changeDeckCard039(empty,tyranno,1,cards).main[0].source_id,2908);
  const additions=catalogAdditions049(cards);
  const themes=additionThemes067(cards,'latest',additions);
  assert.equal(additions.latest.key,'Cards135');
  assert.deepEqual(themes.map(theme=>[theme.key,theme.count]),[
    ['dinosaur135',15],['jurrac135',14],['paleozoic135',4],['allure135',4],['support135',1]
  ]);
});

test('The editor accepts exact 130 and 135 identities, including profiles',async()=>{
  assert.deepEqual(CONTENT_PROFILE135,{schema:1,card_set:'dinosaur-paleozoic-allure135'});
  for(const identity of [GAME_IDENTITY130,GAME_IDENTITY135]){
    assert(gameIdentityMatches135(identity));
    assert.deepEqual((await normalizeBootstrap039(bootstrapFor([],identity),webcrypto)).gameEnvelope.identity,identity);
  }
  await assert.rejects(normalizeBootstrap039(bootstrapFor([],{
    ...GAME_IDENTITY135,catalog135_sha256:'0'.repeat(64)
  }),webcrypto),/게임 버전/);
});
