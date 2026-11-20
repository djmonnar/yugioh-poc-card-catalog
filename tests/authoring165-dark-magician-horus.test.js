import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {GAME_IDENTITY161} from '../authoring161-identity.js';
import {GAME_IDENTITY162, gameIdentityAccepts162} from '../authoring162-identity.js';
import {CONTENT_PROFILE165, GAME_IDENTITY165, gameIdentityAccepts165, gameIdentityMatches165} from '../authoring165-identity.js';
import {cardMetadata165} from '../authoring165-catalog.js';
import {cardMetadata162} from '../authoring162-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion165.json',import.meta.url),'utf8'));
const pack162=JSON.parse(readFileSync(new URL('../data/native-expansion162.json',import.meta.url),'utf8'));
const pack161=JSON.parse(readFileSync(new URL('../data/native-expansion161.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY165){
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

test('dark magician, magician girl, shining sarcophagus and horus cards appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:36},(_,i)=>3081+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:36},(_,i)=>2113+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native165/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native165/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.equal(card.token,false);
    assert.equal(card.deck_limit,3);
    assert.deepEqual(cardMetadata165(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata165(row.sourceId,row.identity_key).maximumNormalLimit,undefined);
    assert.equal(cardMetadata165(row.sourceId,row.identity_key).maximumSpeedLimit,row.speedLimit??undefined);
    assert.equal(cardMetadata165(row.sourceId,'0'.repeat(64)),null);
  }
  assert.equal(cards.filter(card=>card.tags.includes('지원-매지션 걸')).length,7);
  assert.equal(cards.filter(card=>card.tags.includes('지원-빛의 황금궤')).length,14);
  const king=pack.cards.find(row=>row.code===16528181),tirade=pack.cards.find(row=>row.code===76721030);
  assert.deepEqual([king.normalLimit,king.speedLimit,cardMetadata165(king.sourceId,king.identity_key).maximumSpeedLimit],[3,2,2]);
  assert.deepEqual([tirade.normalLimit,tirade.speedLimit,cardMetadata165(tirade.sourceId,tirade.identity_key).maximumSpeedLimit],[3,1,1]);
  assert.equal(pack.cards.filter(row=>row.speedLimit!==null).length,2);
  const darkMagician=cards.find(card=>card.code===342673);
  assert.equal(changeDeckCard039(draft(),darkMagician,1,cards).main[0].source_id,darkMagician.source_id);
  const sarcophagus=cards.find(card=>card.code===79791878);
  assert.equal(changeDeckCard039(draft(),sarcophagus,1,cards).main[0].source_id,sarcophagus.source_id);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards165');
  assert.equal(additions.latest.label,'블랙 매지션·호루스');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['dark-magician165',8],['silent165',4],['spell-counter165',4],['sarcophagus165',10],['horus165',7],['other165',3]]);
});

test('the 165 metadata keeps the 162 and 161 cards and the 161 display-only token',()=>{
  for(const row of [...pack162.cards,...pack161.cards])
    assert.deepEqual(cardMetadata165(row.sourceId,row.identity_key),cardMetadata162(row.sourceId,row.identity_key));
  for(const row of pack162.cards)
    assert.equal(cardMetadata165(row.sourceId,row.identity_key).image,'assets/native162/cards/'+row.sourceId+'.jpg');
  const token=pack161.cards.find(row=>row.token);
  assert.equal(cardMetadata165(token.sourceId,token.identity_key).maximumNormalLimit,0);
});

test('the studio opens 152, 161, 162 and exact 165 databases and rejects a forged 165 identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE165,{schema:1,card_set:'dark-magician-horus165'});
  assert.equal(Object.keys(GAME_IDENTITY165).length,53);
  assert.equal(Object.keys(GAME_IDENTITY165).length,Object.keys(GAME_IDENTITY162).length+2);
  assert.deepEqual(Object.keys(GAME_IDENTITY165).slice(-2),['catalog165_sha256','native_manifest165_sha256']);
  assert.equal(GAME_IDENTITY165.catalog162_sha256,pack.parentCatalogSha256);
  assert.equal(GAME_IDENTITY165.native_manifest162_sha256,pack.parentExpansionSha256);
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162])
    assert(gameIdentityMatches165(identity),'a site published before the database migration still opens the older database');
  assert(gameIdentityMatches165(GAME_IDENTITY165));
  assert(!gameIdentityMatches165({...GAME_IDENTITY165,catalog165_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches165({...GAME_IDENTITY165,extra:'x'}));
  for(const identity of [GAME_IDENTITY152,GAME_IDENTITY161,GAME_IDENTITY162,GAME_IDENTITY165]) await normalizeBootstrap039(bootstrap([],identity),webcrypto);
  const hex='a'.repeat(64);
  for(const forged of [{...GAME_IDENTITY165,catalog165_sha256:'0'.repeat(64)},{...GAME_IDENTITY165,native_manifest165_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY162,catalog165_sha256:hex,native_manifest165_sha256:hex}]){
    assert(gameIdentityAccepts162(forged),'the 162 rule alone would accept unknown 165 fingerprints');
    assert(!gameIdentityAccepts165(forged));
    await assert.rejects(normalizeBootstrap039(bootstrap([],forged),webcrypto),/게임 버전/);
  }
});

test('a newer card pack in the database does not stop the 165 studio',async()=>{
  const hex='a'.repeat(64);
  assert(gameIdentityAccepts165({...GAME_IDENTITY165,catalog170_sha256:hex,native_manifest170_sha256:hex}));
  assert(gameIdentityAccepts165({...GAME_IDENTITY165,catalog166_sha256:hex,native_manifest166_sha256:hex}));
  assert(!gameIdentityAccepts165({...GAME_IDENTITY165,catalog165_sha256:'0'.repeat(64),catalog170_sha256:hex}),'known keys must still match');
  assert(!gameIdentityAccepts165({...GAME_IDENTITY165,extra:hex}),'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts165({...GAME_IDENTITY165,catalog170_sha256:'x'}),'added keys must be sha256');
  assert(!gameIdentityAccepts165({...GAME_IDENTITY165,catalog165_sha256x:hex}),'added keys must use the pack key form');
  assert(!gameIdentityAccepts165({...GAME_IDENTITY165,catalog164_sha256:hex}),'an older pack number cannot be added after 165');
  assert(!gameIdentityAccepts165({...GAME_IDENTITY162,catalog170_sha256:hex}),'a newer pack cannot skip 165');
  const {catalog165_sha256,...missing}=GAME_IDENTITY165;
  assert(!gameIdentityAccepts165({...missing,catalog170_sha256:hex}),'a known key cannot be dropped');
  assert(!gameIdentityAccepts165(null));
  assert(!gameIdentityAccepts165([]));
});
