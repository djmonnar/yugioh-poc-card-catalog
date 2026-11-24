import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY188} from '../authoring188-identity.js';
import {GAME_IDENTITY197} from '../authoring197-identity.js';
import {GAME_IDENTITY199, gameIdentityAccepts199} from '../authoring199-identity.js';
import {CONTENT_PROFILE202, GAME_IDENTITY202, gameIdentityAccepts202, gameIdentityMatches202} from '../authoring202-identity.js';
import {cardMetadata202} from '../authoring202-catalog.js';
import {cardMetadata199} from '../authoring199-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {CARD_RELATIONS198, CARD_RELATIONS_META198} from '../authoring198-card-relations-data.js';

// (202) 대표님 2026-11-25 카드팩: 여섯 무사·시엔·게이트 가디언 42장(3286~3327, 슬롯 2318~2359). 엑스트라 덱 = 게이트 가디언 융합 4장(콘택트 융합),
// 메인 덱 특수 소환 몬스터 = 시엔의 노중 에니시, 튜너 = 시엔의 하급무사, 유니온 = 여섯 무사의 영물. 덱 제한: 시엔의 도량 2, 여섯 무의 문 1.
// 새 분류 지원-여섯 무사('지원')·무사도 카운터('효과')는 DB 마이그레이션이 만든다(태그·희귀도는 DB에서 읽는다).
const pack=JSON.parse(readFileSync(new URL('../data/native-expansion202.json',import.meta.url),'utf8'));
const older=['199','197','196','188'].map(version=>JSON.parse(readFileSync(new URL(`../data/native-expansion${version}.json`,import.meta.url),'utf8')));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY202){
  const catalog=cards.map(row=>({source_id:row.sourceId,web_slot:row.slot,identity_key:row.identity_key,
    name:row.name,name_english:row.nameEnglish,description:row.description,alias:row.alias,native_type:row.type,
    type_name:row.typeName,normal_limit:row.normalLimit,speed_limit:row.speedLimit,code:row.code,art_key:row.artKey,
    playable:row.playable,token:row.token,race:row.race,categories:row.categories,stock:row.playable,draw_enabled:row.playable}));
  const payload=JSON.stringify({catalog,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:1,
    authoring_revision:1,metadata_revision:'1',identity,payload_json:payload,source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}
const EXTRA=[34904525,61398234,97783338,8505920],SPSUMMON=[38280762],TUNER=[33883834],UNION=[65685470];
const LIMITS={47436247:2,27970830:1};

test('Six Samurai, Shien and Gate Guardian cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:42},(_,i)=>3286+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:42},(_,i)=>2318+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native202/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native202/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.deepEqual(cardMetadata202(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata202(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata202(row.sourceId,row.identity_key).maximumNormalLimit,LIMITS[row.code]);
    assert.equal(cardMetadata202(row.sourceId,'0'.repeat(64)),null);
  }
  assert.equal(cards.filter(card=>card.token).length,0);
  for(const card of cards){
    assert.equal(card.deck_limit,LIMITS[card.code]??3,card.name_ko);
    const added=changeDeckCard039(draft(),card,1,cards);
    if(EXTRA.includes(card.code)){assert.equal(added.extra[0].source_id,card.source_id,card.name_ko);assert.equal(added.main.length,0);}
    else{assert.equal(added.main[0].source_id,card.source_id,card.name_ko);assert.equal(added.extra.length,0);}
  }
  assert.deepEqual(cards.filter(card=>EXTRA.includes(card.code)).map(card=>card.source_id),[3322,3323,3324,3325]);
  assert.deepEqual(cards.filter(card=>SPSUMMON.includes(card.code)).map(card=>card.source_id),[3303]);
  assert.deepEqual(cards.filter(card=>TUNER.includes(card.code)).map(card=>card.source_id),[3308]);
  assert.deepEqual(cards.filter(card=>UNION.includes(card.code)).map(card=>card.source_id),[3313]);
  assert.equal(cards.filter(card=>card.tags.includes('지원-여섯 무사')).length,36);
  assert.equal(cards.filter(card=>card.tags.includes('무사도 카운터')).length,6);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards202');
  assert.equal(additions.latest.label,'여섯 무사·시엔·게이트 가디언');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['sixsamurai202',25],['shien202',11],['gateguardian202',6]]);
});

test('Shien\'s Dojo stops at two copies and Gateway of the Six at one in the deck editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  for(const [code,limit] of Object.entries(LIMITS)){
    const card=cards.find(row=>row.code===Number(code));
    let deck=draft();
    for(let i=0;i<limit;i++)deck=changeDeckCard039(deck,card,1,cards);
    assert.equal(deck.main.find(row=>row.source_id===card.source_id).count,limit,card.name_ko);
    assert.throws(()=>changeDeckCard039(deck,card,1,cards),/제한 매수/,`${card.name_ko} stops at ${limit}`);
    const free=changeDeckCard039({...deck,banlist_enabled:false},card,1,cards);
    assert.equal(free.main.find(row=>row.source_id===card.source_id).count,limit+1,'without the banlist the card goes past its limit');
  }
});

test('the 202 metadata keeps the 199, 197, 196 and 188 cards',()=>{
  for(const row of older.flatMap(item=>item.cards))
    assert.deepEqual(cardMetadata202(row.sourceId,row.identity_key),cardMetadata199(row.sourceId,row.identity_key));
  for(const row of older[0].cards)
    assert.equal(cardMetadata202(row.sourceId,row.identity_key).image,'assets/native199/cards/'+row.sourceId+'.jpg');
});

test('the studio opens 152 to 199 and exact 202 databases and rejects a forged 202 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE202,{schema:1,card_set:'six-samurai-gate-guardian202'});
  assert.equal(Object.keys(GAME_IDENTITY202).length,69);
  assert.deepEqual(Object.keys(GAME_IDENTITY202).slice(-2),['catalog202_sha256','native_manifest202_sha256']);
  assert.equal(GAME_IDENTITY202.catalog199_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY202.native_manifest199_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY188,GAME_IDENTITY197,GAME_IDENTITY199,GAME_IDENTITY202]){
    assert(gameIdentityMatches202(identity));
    await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  }
  // 지금 공개된 199 제작소도 202 DB를 받는다(199 규칙의 새 팩 허용). 그래서 DB를 먼저 올려도 제작소가 멈추지 않는다.
  assert(gameIdentityAccepts199(GAME_IDENTITY202));
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY202,catalog202_sha256:'0'.repeat(64)},{...GAME_IDENTITY202,native_manifest202_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY199,catalog202_sha256:hex,native_manifest202_sha256:hex}]){
    assert(!gameIdentityAccepts202(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 202 studio',async()=>{
  const hex='a'.repeat(64);
  await normalizeBootstrap039(bootstrap([],{...GAME_IDENTITY202,catalog203_sha256:hex,native_manifest203_sha256:hex}),webcrypto);
  assert(!gameIdentityAccepts202({...GAME_IDENTITY202,catalog202_sha256:'0'.repeat(64),catalog203_sha256:hex}));
  assert(!gameIdentityAccepts202({...GAME_IDENTITY202,extra:hex}));
  assert(!gameIdentityAccepts202({...GAME_IDENTITY202,catalog201_sha256:hex}),'a pack number at or below 202 cannot be added');
});

test('related cards are rebuilt on catalog 202: Gate Guardian Fusions list their Contact Fusion materials',()=>{
  assert.equal(CARD_RELATIONS_META198.catalog,'catalog202.json');
  assert.deepEqual(CARD_RELATIONS198[3325]?.c,8505920);
  for(const [id,materials] of [[3322,[2642,2644]],[3323,[2642,2643]],[3324,[2643,2644]],[3325,[2642,2643,2644]]]){
    assert.deepEqual([...(CARD_RELATIONS198[id]?.f??[])].sort((a,b)=>a-b),materials,'Gate Guardian Fusion '+id+' materials');
    for(const material of materials)assert((CARD_RELATIONS198[material]?.b??[]).includes(id),'material '+material+' points back to '+id);
  }
  assert((CARD_RELATIONS198[3294]?.n??[]).includes(3302),'Six Scrolls of the Samurai names Great Shogun Shien');
  assert((CARD_RELATIONS198[3326]?.n??[]).includes(2660),'Riryoku Guardian names Gate Guardian');
});
