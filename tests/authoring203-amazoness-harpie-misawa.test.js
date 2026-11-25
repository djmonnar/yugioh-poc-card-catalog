import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY188} from '../authoring188-identity.js';
import {GAME_IDENTITY197} from '../authoring197-identity.js';
import {GAME_IDENTITY199} from '../authoring199-identity.js';
import {GAME_IDENTITY202, gameIdentityAccepts202} from '../authoring202-identity.js';
import {CONTENT_PROFILE203, GAME_IDENTITY203, gameIdentityAccepts203, gameIdentityMatches203} from '../authoring203-identity.js';
import {cardMetadata203} from '../authoring203-catalog.js';
import {cardMetadata202} from '../authoring202-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {CARD_RELATIONS198, CARD_RELATIONS_META198} from '../authoring198-card-relations-data.js';

// (203 카드, 경로 204) 대표님 2026-11-25 카드팩: 아마조네스·해피·미사와 22장(3328~3349, 슬롯 2360~2381). 엑스트라 덱 = 아마조네스 융합 4장,
// 메인 덱 특수 소환 몬스터 = 워터 드래곤·워터 드래곤－클러스터, 튜너·유니온·토큰 없음, 덱 제한 전부 3.
// 새 분류 지원-본딩('지원')과 옥시게돈(176)의 지원-본딩은 DB 마이그레이션 websync204가 만든다(태그·희귀도는 DB에서 읽는다).
const pack=JSON.parse(readFileSync(new URL('../data/native-expansion203.json',import.meta.url),'utf8'));
const older=['202','199','197','196','188'].map(version=>JSON.parse(readFileSync(new URL(`../data/native-expansion${version}.json`,import.meta.url),'utf8')));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY203){
  const catalog=cards.map(row=>({source_id:row.sourceId,web_slot:row.slot,identity_key:row.identity_key,
    name:row.name,name_english:row.nameEnglish,description:row.description,alias:row.alias,native_type:row.type,
    type_name:row.typeName,normal_limit:row.normalLimit,speed_limit:row.speedLimit,code:row.code,art_key:row.artKey,
    playable:row.playable,token:row.token,race:row.race,categories:row.categories,stock:row.playable,draw_enabled:row.playable}));
  const payload=JSON.stringify({catalog,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:1,
    authoring_revision:1,metadata_revision:'1',identity,payload_json:payload,source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}
const EXTRA=[23965033,59353647,4591250,68507541],SPSUMMON=[85066822,6022371];

test('Amazoness, Harpie and Daichi Misawa cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:22},(_,i)=>3328+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:22},(_,i)=>2360+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native203/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native203/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.deepEqual(cardMetadata203(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata203(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata203(row.sourceId,row.identity_key).maximumNormalLimit,undefined);
    assert.equal(cardMetadata203(row.sourceId,'0'.repeat(64)),null);
  }
  assert.equal(cards.filter(card=>card.token).length,0);
  for(const card of cards){
    assert.equal(card.deck_limit,3,card.name_ko);
    const added=changeDeckCard039(draft(),card,1,cards);
    if(EXTRA.includes(card.code)){assert.equal(added.extra[0].source_id,card.source_id,card.name_ko);assert.equal(added.main.length,0);}
    else{assert.equal(added.main[0].source_id,card.source_id,card.name_ko);assert.equal(added.extra.length,0);}
  }
  assert.deepEqual(cards.filter(card=>EXTRA.includes(card.code)).map(card=>card.source_id),[3333,3334,3335,3336]);
  assert.deepEqual(cards.filter(card=>SPSUMMON.includes(card.code)).map(card=>card.source_id),[3340,3344]);
  assert.equal(cards.filter(card=>card.tags.includes('지원-본딩')).length,7);
  assert.equal(cards.filter(card=>card.tags.includes('지원-아마조네스')).length,10);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards203');
  assert.equal(additions.latest.label,'아마조네스·해피·미사와');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['amazoness203',10],['harpie203',2],['misawa203',10]]);
});

test('every 203 card stops at three copies in the deck editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  for(const card of cards){
    let deck=draft();
    for(let i=0;i<3;i++)deck=changeDeckCard039(deck,card,1,cards);
    assert.equal((deck.main.find(row=>row.source_id===card.source_id)??deck.extra.find(row=>row.source_id===card.source_id)).count,3,card.name_ko);
    assert.throws(()=>changeDeckCard039(deck,card,1,cards),/매수/,`${card.name_ko} stops at three`);
  }
});

test('the 203 metadata keeps the 202, 199, 197, 196 and 188 cards',()=>{
  for(const row of older.flatMap(item=>item.cards))
    assert.deepEqual(cardMetadata203(row.sourceId,row.identity_key),cardMetadata202(row.sourceId,row.identity_key));
  for(const row of older[0].cards)
    assert.equal(cardMetadata203(row.sourceId,row.identity_key).image,'assets/native202/cards/'+row.sourceId+'.jpg');
});

test('the studio opens 152 to 202 and exact 203 databases and rejects a forged 203 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE203,{schema:1,card_set:'amazoness-harpie-misawa203'});
  assert.equal(Object.keys(GAME_IDENTITY203).length,71);
  assert.deepEqual(Object.keys(GAME_IDENTITY203).slice(-2),['catalog203_sha256','native_manifest203_sha256']);
  assert.equal(GAME_IDENTITY203.catalog202_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY203.native_manifest202_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY188,GAME_IDENTITY197,GAME_IDENTITY199,GAME_IDENTITY202,GAME_IDENTITY203]){
    assert(gameIdentityMatches203(identity));
    await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  }
  // 지금 공개된 202·203 제작소도 경로 204의 DB를 받는다(202 규칙의 새 팩 허용). 그래서 DB를 먼저 올려도 제작소가 멈추지 않는다.
  assert(gameIdentityAccepts202(GAME_IDENTITY203));
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY203,catalog203_sha256:'0'.repeat(64)},{...GAME_IDENTITY203,native_manifest203_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY202,catalog203_sha256:hex,native_manifest203_sha256:hex}]){
    assert(!gameIdentityAccepts203(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 203 studio',()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts203({...GAME_IDENTITY203,catalog204_sha256:hex,native_manifest204_sha256:hex}));
  assert(!gameIdentityAccepts203({...GAME_IDENTITY203,catalog203_sha256:'0'.repeat(64),catalog204_sha256:hex}));
  assert(!gameIdentityAccepts203({...GAME_IDENTITY203,extra:hex}));
  assert(!gameIdentityAccepts203({...GAME_IDENTITY203,catalog201_sha256:hex}),'a pack number at or below 203 cannot be added');
});

test('related cards retain Bonding and Amazoness links in a newer catalog',()=>{
  assert(['catalog203.json','catalog207.json'].includes(CARD_RELATIONS_META198.catalog));
  assert.equal(CARD_RELATIONS198[3342]?.c,45898858);
  for(const id of [176,3341,3340])assert((CARD_RELATIONS198[3342]?.n??[]).includes(id),'Bonding - H2O names '+id);
  assert((CARD_RELATIONS198[176]?.b??[]).includes(3342),'Oxygeddon points back to Bonding - H2O');
  assert.deepEqual(CARD_RELATIONS198[3335]?.f,[1837],'Amazoness Empress material');
  assert((CARD_RELATIONS198[1837]?.b??[]).includes(3335),'the material points back to Amazoness Empress');
  assert((CARD_RELATIONS198[3333]?.n??[]).includes(3335),'Amazoness Kaiserin names Amazoness Empress');
});
