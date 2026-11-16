import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY135} from '../authoring135-identity.js';
import {CONTENT_PROFILE136,GAME_IDENTITY136,gameIdentityMatches136} from '../authoring136-identity.js';
import {cardMetadata136} from '../authoring136-catalog.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039,normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {cardQueryMatches091} from '../authoring091-search.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion136.json',import.meta.url),'utf8'));
function bootstrapFor(catalog,identity=GAME_IDENTITY136){
  const payload=JSON.stringify({catalog,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:757,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:757,
      authoring_revision:757,metadata_revision:'757',identity,payload_json:payload,
      source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}

test('All 25 rows expose canonical image, identities, categories and limits',async()=>{
  const sourceCards=pack.cards.map(card=>({
    source_id:card.sourceId,web_slot:card.slot,identity_key:card.identity_key,name:card.name,alias:card.alias,
    name_english:card.nameEnglish,description:card.description,native_type:card.type,type_name:card.typeName,
    normal_limit:card.normalLimit,speed_limit:card.speedLimit,code:card.code,art_key:card.artKey,
    playable:card.playable,token:card.token,race:card.race,categories:card.categories,stock:true,draw_enabled:true
  }));
  const bootstrap=await normalizeBootstrap039(bootstrapFor(sourceCards),webcrypto);
  const cards=normalizeCatalog039({bootstrap});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:25},(_,i)=>2933+i));
  for(const row of pack.cards){
    const card=cards.find(candidate=>candidate.source_id===row.sourceId);
    assert.equal(card.identity_key,row.identity_key);
    assert.equal(card.image,'assets/native136/cards/'+row.sourceId+'.jpg');
    assert.equal(readFileSync(new URL('../'+card.image,import.meta.url)).subarray(0,3).toString('hex'),'ffd8ff');
    assert.deepEqual(card.search_aliases,row.searchAliases);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.equal(card.description_ko,row.description);
    assert.equal(card.deck_limit,row.normalLimit);
    assert.equal(card.speed_limit,row.speedLimit);
    assert.equal(card.playable,row.playable);
    assert.equal(card.token,row.token);
    assert.equal(cardMetadata136(row.sourceId,'0'.repeat(64)),null);
  }
  const empty={banlist_enabled:true,main:[],extra:[]};
  const instantFusion=cards.find(card=>card.code===1845204);
  const fusion=cards.find(card=>card.code===69946549);
  const meteor=cards.find(card=>card.code===17548456);
  const miniature=cards.find(card=>card.code===34815282);
  assert(cardQueryMatches091(fusion,'프레데터플랜츠드라고스타페리아'));
  assert(cardQueryMatches091(miniature,'효과-레벨다운'));
  assert.equal(changeDeckCard039(empty,fusion,1,cards).extra[0].source_id,fusion.source_id);
  assert.equal(changeDeckCard039(empty,meteor,1,cards).extra[0].source_id,meteor.source_id);
  const withInstant=changeDeckCard039(empty,instantFusion,1,cards);
  assert.equal(withInstant.main[0].source_id,instantFusion.source_id);
  assert.equal(cardMetadata136(instantFusion.source_id,instantFusion.identity_key).maximumNormalLimit,1);
  assert.throws(()=>changeDeckCard039(withInstant,instantFusion,1,cards),/제한 매수/);
  const additions=catalogAdditions049(cards);
  const themes=additionThemes067(cards,'latest',additions);
  assert.equal(additions.latest.key,'Cards136');
  assert.deepEqual(themes.map(theme=>[theme.key,theme.count]),[
    ['predaplant136',20],['fusion136',2],['leveldown136',2],['jurrac136',1]
  ]);
});

test('The editor accepts exact 135 and 136 identities, including profiles',async()=>{
  assert.deepEqual(CONTENT_PROFILE136,{schema:1,card_set:'predaplant-fusion-meteor136'});
  for(const identity of [GAME_IDENTITY135,GAME_IDENTITY136]){
    assert(gameIdentityMatches136(identity));
    assert.deepEqual((await normalizeBootstrap039(bootstrapFor([],identity),webcrypto)).gameEnvelope.identity,identity);
  }
  await assert.rejects(normalizeBootstrap039(bootstrapFor([],{
    ...GAME_IDENTITY136,catalog136_sha256:'0'.repeat(64)
  }),webcrypto),/게임 버전/);
});
