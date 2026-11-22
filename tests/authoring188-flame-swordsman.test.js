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
import {GAME_IDENTITY183, gameIdentityAccepts183} from '../authoring183-identity.js';
import {CONTENT_PROFILE188, GAME_IDENTITY188, gameIdentityAccepts188, gameIdentityMatches188} from '../authoring188-identity.js';
import {cardMetadata188} from '../authoring188-catalog.js';
import {cardMetadata183} from '../authoring183-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion188.json',import.meta.url),'utf8'));
const pack183=JSON.parse(readFileSync(new URL('../data/native-expansion183.json',import.meta.url),'utf8'));
const pack175=JSON.parse(readFileSync(new URL('../data/native-expansion175.json',import.meta.url),'utf8'));
const pack174=JSON.parse(readFileSync(new URL('../data/native-expansion174.json',import.meta.url),'utf8'));
const pack165=JSON.parse(readFileSync(new URL('../data/native-expansion165.json',import.meta.url),'utf8'));
const pack162=JSON.parse(readFileSync(new URL('../data/native-expansion162.json',import.meta.url),'utf8'));
const pack161=JSON.parse(readFileSync(new URL('../data/native-expansion161.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY188){
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
// 극화염의 검사·투의염참룡·암흑 마계의 용기사 다크 스워드(융합)
const EXTRA=[324483,36319131,86805855];
// 유니온 몬스터: 기사용·칠흑의 전투용(메인 덱)
const UNION=[84814897,47415292];

test('Flame Swordsman, Salamandra and Dark Blade cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:18},(_,i)=>3190+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:18},(_,i)=>2222+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native188/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native188/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.deepEqual(cardMetadata188(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata188(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata188(row.sourceId,'0'.repeat(64)),null);
  }
  // 18장: 일반 3, 스피드 제한 없음, 토큰 없음. 융합 3장은 엑스트라 칸, 유니온 2장·마법·함정을 포함한 나머지 15장은 메인 칸.
  assert.equal(cards.filter(card=>card.token).length,0);
  for(const card of cards){
    assert.equal(card.deck_limit,3);
    assert.equal(cardMetadata188(card.source_id,card.identity_key).maximumNormalLimit,undefined);
    const added=changeDeckCard039(draft(),card,1,cards);
    if(EXTRA.includes(card.code)){
      assert.equal(added.extra[0].source_id,card.source_id,card.name_ko);
      assert.equal(added.main.length,0,card.name_ko);
    }else{
      assert.equal(added.main[0].source_id,card.source_id,card.name_ko);
      assert.equal(added.extra.length,0,card.name_ko);
    }
  }
  assert.deepEqual(cards.filter(card=>UNION.includes(card.code)).map(card=>card.source_id),[3204,3205]);
  const swordsman=cards.find(card=>card.code===1047075);
  const deck=[1,2,3].reduce(next=>changeDeckCard039(next,swordsman,1,cards),draft());
  assert.equal(deck.main[0].count,3);
  assert.equal(cards.filter(card=>card.tags.includes('지원-화염의 검사')).length,10);
  assert.equal(cards.filter(card=>card.tags.includes('지원-사라만도라')).length,3);
  assert.equal(cards.filter(card=>card.tags.includes('지원-다크 스워드')).length,3);
  // "사라만도라"(32268901, sourceId 653)와 "왕궁의 철벽"(30459350, sourceId 2898)은 이미 카탈로그에 있어 이 팩에 없다.
  assert(!pack.cards.some(row=>row.code===32268901||row.code===30459350));
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards188');
  assert.equal(additions.latest.label,'화염의 검사·다크 스워드');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['flame-swordsman188',5],['flame-support188',3],['salamandra188',3],['dark-blade188',4],['warrior-support188',3]]);
});

test('the 188 metadata keeps the 183, 175, 174, 165, 162 and 161 cards and the 183 and 161 display-only tokens',()=>{
  for(const row of [...pack183.cards,...pack175.cards,...pack174.cards,...pack165.cards,...pack162.cards,...pack161.cards])
    assert.deepEqual(cardMetadata188(row.sourceId,row.identity_key),cardMetadata183(row.sourceId,row.identity_key));
  for(const row of pack183.cards)
    assert.equal(cardMetadata188(row.sourceId,row.identity_key).image,'assets/native183/cards/'+row.sourceId+'.jpg');
  const king=pack165.cards.find(row=>row.code===16528181);
  assert.equal(cardMetadata188(king.sourceId,king.identity_key).maximumSpeedLimit,2);
  for(const token of [...pack183.cards,...pack161.cards].filter(row=>row.token))
    assert.equal(cardMetadata188(token.sourceId,token.identity_key).maximumNormalLimit,0);
});

test('the studio opens 152, 161, 162, 165, 174, 175, 183 and exact 188 databases and rejects a forged 188 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE188,{schema:1,card_set:'flame-swordsman188'});
  assert.equal(Object.keys(GAME_IDENTITY188).length,61);
  assert.equal(Object.keys(GAME_IDENTITY188).length,Object.keys(GAME_IDENTITY183).length+2);
  assert.deepEqual(Object.keys(GAME_IDENTITY188).slice(-2),['catalog188_sha256','native_manifest188_sha256']);
  assert.equal(GAME_IDENTITY188.catalog183_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY188.native_manifest183_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175,GAME_IDENTITY183])
    assert(gameIdentityMatches188(identity),'a site published before the database migration still opens the older database');
  assert(gameIdentityMatches188(GAME_IDENTITY188));
  assert(!gameIdentityMatches188({...GAME_IDENTITY188,catalog188_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches188({...GAME_IDENTITY188,extra:'x'}));
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175,GAME_IDENTITY183,GAME_IDENTITY188])
    await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  // 지금 공개된 183 제작소도 188 DB를 받는다(183 규칙의 새 팩 허용). 그래서 DB를 먼저 올려도 제작소가 멈추지 않는다.
  assert(gameIdentityAccepts183(GAME_IDENTITY188));
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY188,catalog188_sha256:'0'.repeat(64)},{...GAME_IDENTITY188,native_manifest188_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY183,catalog188_sha256:hex,native_manifest188_sha256:hex}]){
    assert(gameIdentityAccepts183(forged),'the 183 rule alone would accept unknown 188 fingerprints');
    assert(!gameIdentityAccepts188(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 188 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts188({...GAME_IDENTITY188,catalog190_sha256:hex,native_manifest190_sha256:hex}));
  await normalizeBootstrap039(bootstrap([],{...GAME_IDENTITY188,catalog189_sha256:hex,native_manifest189_sha256:hex}),webcrypto);
  assert(!gameIdentityAccepts188({...GAME_IDENTITY188,catalog188_sha256:'0'.repeat(64),catalog190_sha256:hex}),'known keys must still match');
  assert(!gameIdentityAccepts188({...GAME_IDENTITY188,extra:hex}),'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts188({...GAME_IDENTITY188,catalog190_sha256:'x'}),'added keys must be sha256');
  assert(!gameIdentityAccepts188({...GAME_IDENTITY188,catalog188_sha256x:hex}),'added keys must use the pack key form');
  assert(!gameIdentityAccepts188({...GAME_IDENTITY188,catalog183_sha256:hex}),'an older pack key cannot change after 188');
  assert(!gameIdentityAccepts188({...GAME_IDENTITY188,catalog186_sha256:hex}),'an older pack number cannot be added after 188');
  assert(!gameIdentityAccepts188({...GAME_IDENTITY183,catalog190_sha256:hex}),'a newer pack cannot skip 188');
  const {catalog188_sha256,...missing}=GAME_IDENTITY188;
  assert(!gameIdentityAccepts188({...missing,catalog190_sha256:hex}),'a known key cannot be dropped');
  assert(!gameIdentityAccepts188(null));
  assert(!gameIdentityAccepts188([]));
});
