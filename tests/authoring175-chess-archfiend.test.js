import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY161} from '../authoring161-identity.js';
import {GAME_IDENTITY162} from '../authoring162-identity.js';
import {GAME_IDENTITY165} from '../authoring165-identity.js';
import {GAME_IDENTITY174, gameIdentityAccepts174} from '../authoring174-identity.js';
import {CONTENT_PROFILE175, GAME_IDENTITY175, gameIdentityAccepts175, gameIdentityMatches175} from '../authoring175-identity.js';
import {cardMetadata175} from '../authoring175-catalog.js';
import {cardMetadata174} from '../authoring174-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion175.json',import.meta.url),'utf8'));
const pack174=JSON.parse(readFileSync(new URL('../data/native-expansion174.json',import.meta.url),'utf8'));
const pack165=JSON.parse(readFileSync(new URL('../data/native-expansion165.json',import.meta.url),'utf8'));
const pack162=JSON.parse(readFileSync(new URL('../data/native-expansion162.json',import.meta.url),'utf8'));
const pack161=JSON.parse(readFileSync(new URL('../data/native-expansion161.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY175){
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

test('chess archfiend cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:14},(_,i)=>3136+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:14},(_,i)=>2168+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native175/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native175/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.equal(card.token,false);
    assert.equal(card.deck_limit,3);
    assert.deepEqual(cardMetadata175(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata175(row.sourceId,row.identity_key).maximumNormalLimit,undefined);
    assert.equal(cardMetadata175(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata175(row.sourceId,'0'.repeat(64)),null);
    // 14장 모두 메인 덱(효과 몬스터 8, 마법 3, 함정 3). 엑스트라 덱 카드는 없다.
    const added=changeDeckCard039(draft(),card,1,cards);
    assert.equal(added.main[0].source_id,card.source_id,row.name);
    assert.equal(added.extra.length,0,row.name);
  }
  assert.equal(pack.cards.filter(row=>row.speedLimit!==null||row.normalLimit!==3).length,0);
  assert.equal(cards.filter(card=>card.tags.includes('지원-데몬')).length,12);
  assert.equal(cards.filter(card=>card.tags.includes('지원-악마족')).length,4);
  // "다크 퓨전"(94820406)은 이미 카탈로그에 있어(sourceId 2738) 이 팩에 없다.
  assert(!pack.cards.some(row=>row.code===94820406));
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards175');
  assert.equal(additions.latest.label,'체스 데몬');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['archfiend175',8],['archfiend-support175',4],['fiend175',2]]);
});

test('the 175 metadata keeps the 174, 165, 162 and 161 cards and the 161 display-only token',()=>{
  for(const row of [...pack174.cards,...pack165.cards,...pack162.cards,...pack161.cards])
    assert.deepEqual(cardMetadata175(row.sourceId,row.identity_key),cardMetadata174(row.sourceId,row.identity_key));
  for(const row of pack174.cards)
    assert.equal(cardMetadata175(row.sourceId,row.identity_key).image,'assets/native174/cards/'+row.sourceId+'.jpg');
  const king=pack165.cards.find(row=>row.code===16528181);
  assert.equal(cardMetadata175(king.sourceId,king.identity_key).maximumSpeedLimit,2);
  const token=pack161.cards.find(row=>row.token);
  assert.equal(cardMetadata175(token.sourceId,token.identity_key).maximumNormalLimit,0);
});

test('the studio opens 152, 161, 162, 165, 174 and exact 175 databases and rejects a forged 175 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE175,{schema:1,card_set:'chess-archfiend175'});
  assert.equal(Object.keys(GAME_IDENTITY175).length,57);
  assert.equal(Object.keys(GAME_IDENTITY175).length,Object.keys(GAME_IDENTITY174).length+2);
  assert.deepEqual(Object.keys(GAME_IDENTITY175).slice(-2),['catalog175_sha256','native_manifest175_sha256']);
  assert.equal(GAME_IDENTITY175.catalog174_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY175.native_manifest174_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174])
    assert(gameIdentityMatches175(identity),'a site published before the database migration still opens the older database');
  assert(gameIdentityMatches175(GAME_IDENTITY175));
  assert(!gameIdentityMatches175({...GAME_IDENTITY175,catalog175_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches175({...GAME_IDENTITY175,extra:'x'}));
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174,GAME_IDENTITY175]) await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY175,catalog175_sha256:'0'.repeat(64)},{...GAME_IDENTITY175,native_manifest175_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY174,catalog175_sha256:hex,native_manifest175_sha256:hex}]){
    assert(gameIdentityAccepts174(forged),'the 174 rule alone would accept unknown 175 fingerprints');
    assert(!gameIdentityAccepts175(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 175 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts175({...GAME_IDENTITY175,catalog180_sha256:hex,native_manifest180_sha256:hex}));
  assert(gameIdentityAccepts175({...GAME_IDENTITY175,catalog176_sha256:hex,native_manifest176_sha256:hex}));
  assert(!gameIdentityAccepts175({...GAME_IDENTITY175,catalog175_sha256:'0'.repeat(64),catalog180_sha256:hex}),'known keys must still match');
  assert(!gameIdentityAccepts175({...GAME_IDENTITY175,extra:hex}),'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts175({...GAME_IDENTITY175,catalog180_sha256:'x'}),'added keys must be sha256');
  assert(!gameIdentityAccepts175({...GAME_IDENTITY175,catalog175_sha256x:hex}),'added keys must use the pack key form');
  assert(!gameIdentityAccepts175({...GAME_IDENTITY175,catalog174_sha256:hex}),'an older pack key cannot change after 175');
  assert(!gameIdentityAccepts175({...GAME_IDENTITY175,catalog173_sha256:hex}),'an older pack number cannot be added after 175');
  assert(!gameIdentityAccepts175({...GAME_IDENTITY174,catalog180_sha256:hex}),'a newer pack cannot skip 175');
  const {catalog175_sha256,...missing}=GAME_IDENTITY175;
  assert(!gameIdentityAccepts175({...missing,catalog180_sha256:hex}),'a known key cannot be dropped');
  assert(!gameIdentityAccepts175(null));
  assert(!gameIdentityAccepts175([]));
});
