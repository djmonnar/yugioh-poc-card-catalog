import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY161} from '../authoring161-identity.js';
import {GAME_IDENTITY162} from '../authoring162-identity.js';
import {GAME_IDENTITY165} from '../authoring165-identity.js';
import {GAME_IDENTITY174} from '../authoring174-identity.js';
import {GAME_IDENTITY175, gameIdentityAccepts175} from '../authoring175-identity.js';
import {CONTENT_PROFILE183, GAME_IDENTITY183, gameIdentityAccepts183, gameIdentityMatches183} from '../authoring183-identity.js';
import {cardMetadata183} from '../authoring183-catalog.js';
import {cardMetadata175} from '../authoring175-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion183.json',import.meta.url),'utf8'));
const pack175=JSON.parse(readFileSync(new URL('../data/native-expansion175.json',import.meta.url),'utf8'));
const pack174=JSON.parse(readFileSync(new URL('../data/native-expansion174.json',import.meta.url),'utf8'));
const pack165=JSON.parse(readFileSync(new URL('../data/native-expansion165.json',import.meta.url),'utf8'));
const pack162=JSON.parse(readFileSync(new URL('../data/native-expansion162.json',import.meta.url),'utf8'));
const pack161=JSON.parse(readFileSync(new URL('../data/native-expansion161.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY183){
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
const EXTRA=[40391316,90140980];
const TOKENS=[[3183,29843092,0],[3184,29843093,29843092],[3185,29843094,29843092],[3186,14470846,29843092],[3187,14470847,29843092],
  [3188,53855410,0],[3189,53855411,53855410]];

test('Manjoume cards and the display-only tokens appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:40},(_,i)=>3150+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:40},(_,i)=>2182+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native183/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native183/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.deepEqual(cardMetadata183(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata183(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata183(row.sourceId,'0'.repeat(64)),null);
  }
  // 33장: 일반 3, 스피드 제한 없음. 방해꾼 나이트·킹(융합)은 엑스트라 칸, 나머지 31장은 메인 칸.
  for(const card of cards.filter(card=>!card.token)){
    assert.equal(card.deck_limit,3);
    assert.equal(cardMetadata183(card.source_id,card.identity_key).maximumNormalLimit,undefined);
    const added=changeDeckCard039(draft(),card,1,cards);
    if(EXTRA.includes(card.code)){
      assert.equal(added.extra[0].source_id,card.source_id,card.name_ko);
      assert.equal(added.main.length,0,card.name_ko);
    }else{
      assert.equal(added.main[0].source_id,card.source_id,card.name_ko);
      assert.equal(added.extra.length,0,card.name_ko);
    }
  }
  // 토큰 7행: 표시만(덱 불가, 상점·드로우 아님, 금제 0). 4행은 Babel 별칭(099 흑염 토큰 2와 같은 선례).
  const tokens=cards.filter(card=>card.token);
  assert.deepEqual(tokens.map(card=>[card.source_id,card.code,card.alias]),TOKENS);
  for(const card of tokens){
    assert.equal(cardMetadata183(card.source_id,card.identity_key).maximumNormalLimit,0);
    assert.equal(card.playable,false);assert.equal(card.stock,false);assert.equal(card.draw_enabled,false);
    assert.throws(()=>changeDeckCard039(draft(),card,1,cards));
  }
  // 토큰의 같은 이름 묶음(별칭) 금제 0은 플레이할 수 있는 카드에 닿지 않는다.
  const green=cards.find(card=>card.code===12482652);
  const deck=[1,2,3].reduce(next=>changeDeckCard039(next,green,1,cards),draft());
  assert.equal(deck.main[0].count,3);
  assert.equal(cards.filter(card=>card.tags.includes('지원-방해꾼')).length,22);
  assert.equal(cards.filter(card=>card.tags.includes('지원-암드 드래곤')).length,11);
  // "어드밴스 드로우"(51630558)는 이미 카탈로그에 있어(sourceId 3100) 이 팩에 없다.
  assert(!pack.cards.some(row=>row.code===51630558));
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards183');
  assert.equal(additions.latest.label,'만죠메 암드·방해꾼');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['armed-dragon183',5],['armed-support183',4],['dragon-draw183',5],['ojama183',8],['ojama-support183',9],['junk183',2],['token183',7]]);
});

test('the 183 metadata keeps the 175, 174, 165, 162 and 161 cards and the 161 display-only token',()=>{
  for(const row of [...pack175.cards,...pack174.cards,...pack165.cards,...pack162.cards,...pack161.cards])
    assert.deepEqual(cardMetadata183(row.sourceId,row.identity_key),cardMetadata175(row.sourceId,row.identity_key));
  for(const row of pack175.cards)
    assert.equal(cardMetadata183(row.sourceId,row.identity_key).image,'assets/native175/cards/'+row.sourceId+'.jpg');
  const king=pack165.cards.find(row=>row.code===16528181);
  assert.equal(cardMetadata183(king.sourceId,king.identity_key).maximumSpeedLimit,2);
  const token=pack161.cards.find(row=>row.token);
  assert.equal(cardMetadata183(token.sourceId,token.identity_key).maximumNormalLimit,0);
});

test('the studio opens 152, 161, 162, 165, 174, 175 and exact 183 databases and rejects a forged 183 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE183,{schema:1,card_set:'manjoume183'});
  assert.equal(Object.keys(GAME_IDENTITY183).length,59);
  assert.equal(Object.keys(GAME_IDENTITY183).length,Object.keys(GAME_IDENTITY175).length+2);
  assert.deepEqual(Object.keys(GAME_IDENTITY183).slice(-2),['catalog183_sha256','native_manifest183_sha256']);
  assert.equal(GAME_IDENTITY183.catalog175_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY183.native_manifest175_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175])
    assert(gameIdentityMatches183(identity),'a site published before the database migration still opens the older database');
  assert(gameIdentityMatches183(GAME_IDENTITY183));
  assert(!gameIdentityMatches183({...GAME_IDENTITY183,catalog183_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches183({...GAME_IDENTITY183,extra:'x'}));
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175,GAME_IDENTITY183])
    await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY183,catalog183_sha256:'0'.repeat(64)},{...GAME_IDENTITY183,native_manifest183_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY175,catalog183_sha256:hex,native_manifest183_sha256:hex}]){
    assert(gameIdentityAccepts175(forged),'the 175 rule alone would accept unknown 183 fingerprints');
    assert(!gameIdentityAccepts183(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 183 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts183({...GAME_IDENTITY183,catalog190_sha256:hex,native_manifest190_sha256:hex}));
  await normalizeBootstrap039(bootstrap([],{...GAME_IDENTITY183,catalog184_sha256:hex,native_manifest184_sha256:hex}),webcrypto);
  assert(!gameIdentityAccepts183({...GAME_IDENTITY183,catalog183_sha256:'0'.repeat(64),catalog190_sha256:hex}),'known keys must still match');
  assert(!gameIdentityAccepts183({...GAME_IDENTITY183,extra:hex}),'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts183({...GAME_IDENTITY183,catalog190_sha256:'x'}),'added keys must be sha256');
  assert(!gameIdentityAccepts183({...GAME_IDENTITY183,catalog183_sha256x:hex}),'added keys must use the pack key form');
  assert(!gameIdentityAccepts183({...GAME_IDENTITY183,catalog175_sha256:hex}),'an older pack key cannot change after 183');
  assert(!gameIdentityAccepts183({...GAME_IDENTITY183,catalog180_sha256:hex}),'an older pack number cannot be added after 183');
  assert(!gameIdentityAccepts183({...GAME_IDENTITY175,catalog190_sha256:hex}),'a newer pack cannot skip 183');
  const {catalog183_sha256,...missing}=GAME_IDENTITY183;
  assert(!gameIdentityAccepts183({...missing,catalog190_sha256:hex}),'a known key cannot be dropped');
  assert(!gameIdentityAccepts183(null));
  assert(!gameIdentityAccepts183([]));
});
