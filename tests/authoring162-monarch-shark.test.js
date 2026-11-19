import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY161, gameIdentityAccepts161} from '../authoring161-identity.js';
import {CONTENT_PROFILE162, GAME_IDENTITY162, gameIdentityAccepts162, gameIdentityMatches162} from '../authoring162-identity.js';
import {cardMetadata162} from '../authoring162-catalog.js';
import {cardMetadata161} from '../authoring161-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion162.json',import.meta.url),'utf8'));
const pack161=JSON.parse(readFileSync(new URL('../data/native-expansion161.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY162){
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

test('monarch, shark and self-destruct cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:22},(_,i)=>3059+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:22},(_,i)=>2091+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native162/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native162/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.equal(card.token,false);
    assert.equal(card.deck_limit,3);
    assert.deepEqual(cardMetadata162(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata162(row.sourceId,row.identity_key).maximumNormalLimit,undefined);
    assert.equal(cardMetadata162(row.sourceId,'0'.repeat(64)),null);
  }
  assert.equal(cards.filter(card=>card.tags.includes('지원-자괴')).length,2);
  assert.equal(cards.filter(card=>card.tags.includes('지원-제왕')).length,5);
  const doomkaiser=cards.find(card=>card.code===6021033);
  assert.equal(changeDeckCard039(draft(),doomkaiser,1,cards).extra[0].source_id,doomkaiser.source_id);
  const trooper=cards.find(card=>card.code===85087012);
  assert.equal(changeDeckCard039(draft(),trooper,1,cards).main[0].source_id,trooper.source_id);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards162');
  assert.equal(additions.latest.label,'제왕·샤크');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['monarch162',5],['shark-water162',6],['self-destruct162',2],['undead-hades162',5],['other162',4]]);
});

test('the 162 metadata keeps the 161 cards and their display-only token',()=>{
  for(const row of pack161.cards){
    assert.deepEqual(cardMetadata162(row.sourceId,row.identity_key),cardMetadata161(row.sourceId,row.identity_key));
    assert.equal(cardMetadata162(row.sourceId,row.identity_key).image,'assets/native161/cards/'+row.sourceId+'.jpg');
  }
  const token=pack161.cards.find(row=>row.token);
  assert.equal(cardMetadata162(token.sourceId,token.identity_key).maximumNormalLimit,0);
});

test('the studio opens 152, 161 and exact 162 databases and rejects a forged 162 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE162,{schema:1,card_set:'monarch-shark162'});
  assert.equal(Object.keys(GAME_IDENTITY162).length,51);
  assert.equal(Object.keys(GAME_IDENTITY162).length,Object.keys(GAME_IDENTITY161).length+2);
  assert.deepEqual(Object.keys(GAME_IDENTITY162).slice(-2),['catalog162_sha256','native_manifest162_sha256']);
  assert(gameIdentityMatches162(GAME_IDENTITY152),'a site published before the database migration still opens the 152 database');
  assert(gameIdentityMatches162(GAME_IDENTITY161),'a site published before the database migration still opens the 161 database');
  assert(gameIdentityMatches162(GAME_IDENTITY162));
  assert(!gameIdentityMatches162({...GAME_IDENTITY162,catalog162_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches162({...GAME_IDENTITY162,extra:'x'}));
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162]) await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY162,catalog162_sha256:'0'.repeat(64)},{...GAME_IDENTITY162,native_manifest162_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY161,catalog162_sha256:hex,native_manifest162_sha256:hex}]){
    assert(gameIdentityAccepts161(forged),'the 161 rule alone would accept unknown 162 fingerprints');
    assert(!gameIdentityAccepts162(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 162 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts162({...GAME_IDENTITY162,catalog170_sha256:hex,native_manifest170_sha256:hex}));
  await normalizeBootstrap039(bootstrap([],{...GAME_IDENTITY162,catalog163_sha256:hex,native_manifest163_sha256:hex}),webcrypto);
  assert(!gameIdentityAccepts162({...GAME_IDENTITY162,catalog162_sha256:'0'.repeat(64),catalog170_sha256:hex}),'known keys must still match');
  assert(!gameIdentityAccepts162({...GAME_IDENTITY162,extra:hex}),'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts162({...GAME_IDENTITY162,catalog170_sha256:'x'}),'added keys must be sha256');
  assert(!gameIdentityAccepts162({...GAME_IDENTITY162,catalog162_sha256x:hex}),'added keys must use the pack key form');
  assert(!gameIdentityAccepts162({...GAME_IDENTITY161,catalog170_sha256:hex}),'a newer pack cannot skip 162');
  const {catalog162_sha256,...missing}=GAME_IDENTITY162;
  assert(!gameIdentityAccepts162({...missing,catalog170_sha256:hex}),'a known key cannot be dropped');
  assert(!gameIdentityAccepts162(null));
  assert(!gameIdentityAccepts162([]));
});
