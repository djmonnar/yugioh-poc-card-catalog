import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY152} from '../authoring152-identity.js';
import {CONTENT_PROFILE161, GAME_IDENTITY161, gameIdentityMatches161} from '../authoring161-identity.js';
import {cardMetadata161} from '../authoring161-catalog.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion161.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY161){
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

test('dark, banish and scorpion cards and the display-only token appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:20},(_,i)=>3039+i));
  assert.deepEqual(cards.map(card=>card.web_slot??card.slot),Array.from({length:20},(_,i)=>2071+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native161/cards/'+row.sourceId+'.jpg');
    const original=readFileSync(new URL('../'+card.image,import.meta.url));
    assert.equal(original.subarray(0,3).toString('hex'),'ffd8ff');
    const thumb=thumbnailUrl170(card.image);
    assert.equal(thumb,'assets/native161/thumbs/'+row.sourceId+'.jpg');
    const thumbBytes=readFileSync(new URL('../'+thumb,import.meta.url));
    assert.equal(thumbBytes.subarray(0,3).toString('hex'),'ffd8ff');
    assert(thumbBytes.length<original.length);
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.equal(cardMetadata161(row.sourceId,'0'.repeat(64)),null);
  }
  assert.equal(cards.filter(card=>card.tags.includes('지원-전갈')).length,6);
  for(const card of cards.filter(card=>!card.token)){
    assert.equal(card.deck_limit,3);
    assert.equal(cardMetadata161(card.source_id,card.identity_key).maximumNormalLimit,undefined);
  }
  const tokens=cards.filter(card=>card.token);
  assert.deepEqual(tokens.map(card=>[card.source_id,card.code]),[[3058,44330099]]);
  for(const card of tokens){
    assert.equal(cardMetadata161(card.source_id,card.identity_key).maximumNormalLimit,0);
    assert.equal(card.playable,false);assert.equal(card.stock,false);assert.equal(card.draw_enabled,false);
    assert.throws(()=>changeDeckCard039(draft(),card,1,cards));
  }
  const gaius=cards.find(card=>card.code===9748752);
  assert.equal(changeDeckCard039(draft(),gaius,1,cards).main[0].source_id,gaius.source_id);
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards161');
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(themes.filter(theme=>theme.key!=='all').map(theme=>[theme.key,theme.count]),
    [['banish-helios161',5],['dark-attribute161',4],['scorpion161',6],['other161',5]]);
});

test('recognizes prior web identity and rejects a forged scorpion catalog identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE161,{schema:1,card_set:'dark-scorpion161'});
  assert(gameIdentityMatches161(GAME_IDENTITY152),'a site published before the database migration still opens the current database');
  assert(gameIdentityMatches161(GAME_IDENTITY161));
  assert.equal(Object.keys(GAME_IDENTITY161).length,Object.keys(GAME_IDENTITY152).length+2);
  assert(!gameIdentityMatches161({...GAME_IDENTITY161,catalog161_sha256:'0'.repeat(64)}));
  assert(!gameIdentityMatches161({...GAME_IDENTITY161,extra:'x'}));
  await assert.rejects(normalizeBootstrap039(bootstrap([],{...GAME_IDENTITY161,catalog161_sha256:'0'.repeat(64)}),webcrypto),/게임 버전/);
  await assert.rejects(normalizeBootstrap039(bootstrap([],{...GAME_IDENTITY161,native_manifest161_sha256:'0'.repeat(64)}),webcrypto),/게임 버전/);
  await normalizeBootstrap039(bootstrap([],GAME_IDENTITY152),webcrypto);
});

test('a newer card pack in the database does not stop the studio', async () => {
  const {gameIdentityAccepts161} = await import('../authoring161-identity.js');
  const hex = 'a'.repeat(64);
  assert(gameIdentityAccepts161(GAME_IDENTITY161));
  assert(gameIdentityAccepts161(GAME_IDENTITY152));
  assert(gameIdentityAccepts161({...GAME_IDENTITY161, catalog170_sha256: hex, native_manifest170_sha256: hex}));
  assert(!gameIdentityAccepts161({...GAME_IDENTITY161, catalog161_sha256: '0'.repeat(64), catalog170_sha256: hex}), 'known keys must still match');
  assert(!gameIdentityAccepts161({...GAME_IDENTITY161, extra: hex}), 'only pack fingerprint keys may be added');
  assert(!gameIdentityAccepts161({...GAME_IDENTITY161, catalog170_sha256: 'x'}), 'added keys must be sha256');
  assert(!gameIdentityAccepts161({...GAME_IDENTITY161, catalog150_sha256: hex}), 'added packs must be newer than 161');
  const {catalog161_sha256, ...missing} = GAME_IDENTITY161;
  assert(!gameIdentityAccepts161({...missing, catalog170_sha256: hex}), 'a known key cannot be dropped');
  assert(!gameIdentityAccepts161(null));
  assert(!gameIdentityAccepts161([]));
});
