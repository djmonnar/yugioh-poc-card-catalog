import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY188} from '../authoring188-identity.js';
import {GAME_IDENTITY196} from '../authoring196-identity.js';
import {GAME_IDENTITY197, gameIdentityAccepts197} from '../authoring197-identity.js';
import {CONTENT_PROFILE199, GAME_IDENTITY199, gameIdentityAccepts199, gameIdentityMatches199} from '../authoring199-identity.js';
import {cardMetadata199} from '../authoring199-catalog.js';
import {cardMetadata197} from '../authoring197-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {CARD_RELATIONS198, CARD_RELATIONS_META198} from '../authoring198-card-relations-data.js';

// (199) 대표님 2026-11-24 카드팩: 뱀파이어·스노우맨·엘리멘틀 히어로 36장(3250~3285, 슬롯 2282~2317). 엑스트라 덱 = 엘리멘틀 히어로 디 어스(융합),
// 메인 덱 특수 소환 몬스터 = 데저트 트위스터·뱀파이어 제네시스, 튜너 = 유니좀비. 새 분류 지원-뱀파이어('지원')·아이스 카운터('효과')는 DB 마이그레이션이 만든다.
const pack=JSON.parse(readFileSync(new URL('../data/native-expansion199.json',import.meta.url),'utf8'));
const older=['197','196','188'].map(version=>JSON.parse(readFileSync(new URL(`../data/native-expansion${version}.json`,import.meta.url),'utf8')));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY199){
  const catalog=cards.map(row=>({source_id:row.sourceId,web_slot:row.slot,identity_key:row.identity_key,
    name:row.name,name_english:row.nameEnglish,description:row.description,alias:row.alias,native_type:row.type,
    type_name:row.typeName,normal_limit:row.normalLimit,speed_limit:row.speedLimit,code:row.code,art_key:row.artKey,
    playable:row.playable,token:row.token,race:row.race,categories:row.categories,stock:row.playable,draw_enabled:row.playable}));
  const payload=JSON.stringify({catalog,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:1,
    authoring_revision:1,metadata_revision:'1',identity,payload_json:payload,source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}
const EXTRA=[74711057],SPSUMMON=[81977953,22056710],TUNER=[49959355];

test('Vampire, Snowman and Elemental HERO cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:36},(_,i)=>3250+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:36},(_,i)=>2282+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native199/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native199/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.deepEqual(cardMetadata199(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata199(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata199(row.sourceId,'0'.repeat(64)),null);
  }
  assert.equal(cards.filter(card=>card.token).length,0);
  for(const card of cards){
    assert.equal(card.deck_limit,3);
    const added=changeDeckCard039(draft(),card,1,cards);
    if(EXTRA.includes(card.code)){assert.equal(added.extra[0].source_id,card.source_id,card.name_ko);assert.equal(added.main.length,0);}
    else{assert.equal(added.main[0].source_id,card.source_id,card.name_ko);assert.equal(added.extra.length,0);}
  }
  assert.deepEqual(cards.filter(card=>EXTRA.includes(card.code)).map(card=>card.source_id),[3253]);
  assert.deepEqual(cards.filter(card=>SPSUMMON.includes(card.code)).map(card=>card.source_id),[3262,3285]);
  assert.deepEqual(cards.filter(card=>TUNER.includes(card.code)).map(card=>card.source_id),[3263]);
  assert.equal(cards.filter(card=>card.tags.includes('지원-뱀파이어')).length,21);
  assert.equal(cards.filter(card=>card.tags.includes('아이스 카운터')).length,4);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards199');
  assert.equal(additions.latest.label,'뱀파이어·스노우맨·엘리멘틀 히어로');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['vampire199',21],['hero199',4],['snowman199',5],['others199',6]]);
});

test('the 199 metadata keeps the 197, 196 and 188 cards',()=>{
  for(const row of older.flatMap(item=>item.cards))
    assert.deepEqual(cardMetadata199(row.sourceId,row.identity_key),cardMetadata197(row.sourceId,row.identity_key));
  for(const row of older[0].cards)
    assert.equal(cardMetadata199(row.sourceId,row.identity_key).image,'assets/native197/cards/'+row.sourceId+'.jpg');
});

test('the studio opens 152 to 197 and exact 199 databases and rejects a forged 199 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE199,{schema:1,card_set:'vampire-snowman-hero199'});
  assert.equal(Object.keys(GAME_IDENTITY199).length,67);
  assert.deepEqual(Object.keys(GAME_IDENTITY199).slice(-2),['catalog199_sha256','native_manifest199_sha256']);
  assert.equal(GAME_IDENTITY199.catalog197_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY199.native_manifest197_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY188,GAME_IDENTITY196,GAME_IDENTITY197,GAME_IDENTITY199]){
    assert(gameIdentityMatches199(identity));
    await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  }
  // 지금 공개된 197 제작소도 199 DB를 받는다(197 규칙의 새 팩 허용). 그래서 DB를 먼저 올려도 제작소가 멈추지 않는다.
  assert(gameIdentityAccepts197(GAME_IDENTITY199));
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY199,catalog199_sha256:'0'.repeat(64)},{...GAME_IDENTITY199,native_manifest199_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY197,catalog199_sha256:hex,native_manifest199_sha256:hex}]){
    assert(!gameIdentityAccepts199(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 199 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts199({...GAME_IDENTITY199,catalog200_sha256:hex,native_manifest200_sha256:hex}));
  assert(!gameIdentityAccepts199({...GAME_IDENTITY199,catalog199_sha256:'0'.repeat(64),catalog200_sha256:hex}));
  assert(!gameIdentityAccepts199({...GAME_IDENTITY199,extra:hex}));
  assert(!gameIdentityAccepts199({...GAME_IDENTITY199,catalog198_sha256:hex}),'a pack number at or below 199 cannot be added');
});

test('related cards are rebuilt on catalog 199: Terra Firma lists Ocean and Woodsman, Genesis names Vampire Lord',()=>{
  assert(['catalog199.json','catalog202.json','catalog203.json'].includes(CARD_RELATIONS_META198.catalog),'related cards are built on catalog 199 or a newer pack');
  assert.deepEqual(CARD_RELATIONS198[3253]?.c,74711057);
  assert.deepEqual([...(CARD_RELATIONS198[3253]?.f??[])].sort((a,b)=>a-b),[3254,3255],'Elemental HERO Terra Firma fusion materials');
  for(const id of [3254,3255])assert((CARD_RELATIONS198[id]?.b??[]).includes(3253),'material '+id+' points back to Terra Firma');
  const genesis=CARD_RELATIONS198[3285];
  assert(genesis&&[...(genesis.n??[]),...(genesis.f??[])].includes(1976),'Vampire Genesis names Vampire Lord');
});
