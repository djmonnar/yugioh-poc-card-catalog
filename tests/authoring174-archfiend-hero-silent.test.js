import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY161} from '../authoring161-identity.js';
import {GAME_IDENTITY162} from '../authoring162-identity.js';
import {GAME_IDENTITY165, gameIdentityAccepts165} from '../authoring165-identity.js';
import {CONTENT_PROFILE174, GAME_IDENTITY174, gameIdentityAccepts174, gameIdentityMatches174} from '../authoring174-identity.js';
import {cardMetadata174} from '../authoring174-catalog.js';
import {cardMetadata165} from '../authoring165-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion174.json',import.meta.url),'utf8'));
const pack165=JSON.parse(readFileSync(new URL('../data/native-expansion165.json',import.meta.url),'utf8'));
const pack162=JSON.parse(readFileSync(new URL('../data/native-expansion162.json',import.meta.url),'utf8'));
const pack161=JSON.parse(readFileSync(new URL('../data/native-expansion161.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY174){
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

test('archfiend, elemental hero and silent cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:19},(_,i)=>3117+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:19},(_,i)=>2149+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native174/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native174/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.equal(card.token,false);
    assert.equal(card.deck_limit,3);
    assert.deepEqual(cardMetadata174(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata174(row.sourceId,row.identity_key).maximumNormalLimit,undefined);
    assert.equal(cardMetadata174(row.sourceId,row.identity_key).maximumSpeedLimit,undefined);
    assert.equal(cardMetadata174(row.sourceId,'0'.repeat(64)),null);
  }
  assert.equal(pack.cards.filter(row=>row.speedLimit!==null||row.normalLimit!==3).length,0);
  assert.equal(cards.filter(card=>card.tags.includes('지원-데몬')).length,7);
  assert.equal(cards.filter(card=>card.tags.includes('지원-엘리멘틀 히어로')).length,5);
  // 데몬 현현(융합)은 엑스트라 덱, 데몬 강림(의식)·사일런트 스워드맨(특수 소환)·히어로 얼라이브(마법)는 메인 덱
  const manifestation=cards.find(card=>card.code===32775808);
  assert.equal(changeDeckCard039(draft(),manifestation,1,cards).extra[0].source_id,manifestation.source_id);
  assert.equal(changeDeckCard039(draft(),manifestation,1,cards).main.length,0);
  for(const code of [95825679,15180041,8949584]){
    const card=cards.find(row=>row.code===code);
    assert.equal(changeDeckCard039(draft(),card,1,cards).main[0].source_id,card.source_id);
  }
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards174');
  assert.equal(additions.latest.label,'데몬·히어로·사일런트');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['archfiend174',7],['fiend174',3],['elemental-hero174',5],['silent174',3],['other174',1]]);
});

test('the 174 metadata keeps the 165, 162 and 161 cards and the 161 display-only token',()=>{
  for(const row of [...pack165.cards,...pack162.cards,...pack161.cards])
    assert.deepEqual(cardMetadata174(row.sourceId,row.identity_key),cardMetadata165(row.sourceId,row.identity_key));
  for(const row of pack165.cards)
    assert.equal(cardMetadata174(row.sourceId,row.identity_key).image,'assets/native165/cards/'+row.sourceId+'.jpg');
  const king=pack165.cards.find(row=>row.code===16528181);
  assert.equal(cardMetadata174(king.sourceId,king.identity_key).maximumSpeedLimit,2);
  const token=pack161.cards.find(row=>row.token);
  assert.equal(cardMetadata174(token.sourceId,token.identity_key).maximumNormalLimit,0);
});

test('the studio opens 152, 161, 162, 165 and exact 174 databases and rejects a forged 174 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE174,{schema:1,card_set:'archfiend-hero-silent174'});
  assert.equal(Object.keys(GAME_IDENTITY174).length,55);
  assert.equal(Object.keys(GAME_IDENTITY174).length,Object.keys(GAME_IDENTITY165).length+2);
  assert.deepEqual(Object.keys(GAME_IDENTITY174).slice(-2),['catalog174_sha256','native_manifest174_sha256']);
  assert.equal(GAME_IDENTITY174.catalog165_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY174.native_manifest165_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165])
    assert(gameIdentityMatches174(identity),'a site published before the database migration still opens the older database');
  assert(gameIdentityMatches174(GAME_IDENTITY174));
  assert(!gameIdentityMatches174({...GAME_IDENTITY174,catalog174_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches174({...GAME_IDENTITY174,extra:'x'}));
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165,GAME_IDENTITY174]) await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY174,catalog174_sha256:'0'.repeat(64)},{...GAME_IDENTITY174,native_manifest174_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY165,catalog174_sha256:hex,native_manifest174_sha256:hex}]){
    assert(gameIdentityAccepts165(forged),'the 165 rule alone would accept unknown 174 fingerprints');
    assert(!gameIdentityAccepts174(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 174 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts174({...GAME_IDENTITY174,catalog180_sha256:hex,native_manifest180_sha256:hex}));
  await normalizeBootstrap039(bootstrap([],{...GAME_IDENTITY174,catalog175_sha256:hex,native_manifest175_sha256:hex}),webcrypto);
  assert(!gameIdentityAccepts174({...GAME_IDENTITY174,catalog174_sha256:'0'.repeat(64),catalog180_sha256:hex}),'known keys must still match');
  assert(!gameIdentityAccepts174({...GAME_IDENTITY174,extra:hex}),'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts174({...GAME_IDENTITY174,catalog180_sha256:'x'}),'added keys must be sha256');
  assert(!gameIdentityAccepts174({...GAME_IDENTITY174,catalog174_sha256x:hex}),'added keys must use the pack key form');
  assert(!gameIdentityAccepts174({...GAME_IDENTITY174,catalog173_sha256:hex}),'an older pack number cannot be added after 174');
  assert(!gameIdentityAccepts174({...GAME_IDENTITY165,catalog180_sha256:hex}),'a newer pack cannot skip 174');
  const {catalog174_sha256,...missing}=GAME_IDENTITY174;
  assert(!gameIdentityAccepts174({...missing,catalog180_sha256:hex}),'a known key cannot be dropped');
  assert(!gameIdentityAccepts174(null));
  assert(!gameIdentityAccepts174([]));
});
