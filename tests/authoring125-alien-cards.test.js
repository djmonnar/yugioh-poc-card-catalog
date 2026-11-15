import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY122} from '../authoring122-identity.js';
import {CONTENT_PROFILE125,GAME_IDENTITY125,gameIdentityMatches125} from '../authoring125-identity.js';
import {cardMetadata125} from '../authoring125-catalog.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039,normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemeMatches067,additionThemes067} from '../authoring067-themes.js';
import {cardQueryMatches091} from '../authoring091-search.js';
import {fixture041} from './authoring041-test-dom.js';

const dataPath=new URL('../data/native-expansion125.json',import.meta.url);
const pack=JSON.parse(readFileSync(dataPath,'utf8'));

function bootstrapFor(cards,identity=GAME_IDENTITY125){
  const payload=JSON.stringify({catalog:cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:697,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:697,
      authoring_revision:697,metadata_revision:'697',identity,payload_json:payload,
      source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
}

test('Alien and Reptile cards retain their identity, images, aliases, tags and deck limits',async()=>{
  const state=fixture041();
  const sourceCards=pack.cards.map(card=>({
    source_id:card.sourceId,web_slot:card.slot,identity_key:card.identity_key,name:card.name,
    name_english:card.nameEnglish,native_type:card.type,type_name:card.typeName,normal_limit:card.normalLimit,
    code:card.code,art_key:card.artKey,playable:card.playable,race:card.race,attribute:card.attribute,
    categories:card.sourceId===2816?['지원-에일리언','A 카운터','발동-소환','소환-패,덱']:[],
    image_url:'unused-remote-image.jpg',stock:true,draw_enabled:true
  }));
  const bootstrap=await normalizeBootstrap039(bootstrapFor(sourceCards),webcrypto);
  const cards=normalizeCatalog039({...state,bootstrap});
  assert.equal(cards.length,23);
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:23},(_,index)=>2816+index));
  for(const source of pack.cards){
    const card=cards.find(candidate=>candidate.source_id===source.sourceId);
    const expectedImage=`assets/native125/cards/${source.sourceId}.jpg`;
    assert.equal(card.identity_key,source.identity_key);
    assert.equal(card.image,expectedImage);
    assert.equal(readFileSync(new URL(`../${expectedImage}`,import.meta.url)).subarray(0,3).toString('hex'),'ffd8ff');
    assert.deepEqual(card.search_aliases,source.searchAliases);
    assert.equal(card.deck_limit,source.normalLimit);
    assert.equal(card.special,false);
    assert.equal(cardMetadata125(source.sourceId,'0'.repeat(64)),null);
  }
  const dog=cards.find(card=>card.source_id===2816);
  assert(dog.tags.includes('지원-에일리언')&&dog.tags.includes('A 카운터'));
  assert(cardQueryMatches091(dog,'Alien Dog'));
  assert(cardQueryMatches091(dog,'에일리언도그'));
  let deck={banlist_enabled:true,main:[],extra:[]};
  for(let index=0;index<dog.deck_limit;index++)deck=changeDeckCard039(deck,dog,1,cards);
  assert.equal(deck.main[0].count,3);
  assert.throws(()=>changeDeckCard039(deck,dog,1,cards));

  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards125');
  assert.equal(additions.latest.count,23);
  const themes=additionThemes067(cards,'latest',additions);
  assert.deepEqual(Object.fromEntries(themes.map(theme=>[theme.key,theme.count])),{
    'alien-monsters125':6,'alien-support125':11,'reptile-support125':6
  });
  for(const card of cards)assert.equal(themes.filter(theme=>additionThemeMatches067(card,theme.key,additions)).length,1);
});

test('latest catalog is exact and the previous catalog remains accepted',async()=>{
  const packSha=createHash('sha256').update(readFileSync(dataPath)).digest('hex');
  assert.deepEqual(CONTENT_PROFILE125,{schema:1,card_set:'alien-counters125'});
  assert.equal(packSha,'2d761a3578646a0098c851f3a04bff894a3f3a639fc53e27c8174c0262978ac6');
  assert(gameIdentityMatches125(GAME_IDENTITY125));
  assert(gameIdentityMatches125(GAME_IDENTITY122));
  const previous=await normalizeBootstrap039(bootstrapFor([],GAME_IDENTITY122),webcrypto);
  assert.deepEqual(previous.gameEnvelope.identity,GAME_IDENTITY122);
  for(const identity of [
    {...GAME_IDENTITY125,catalog125_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY125,native_manifest125_sha256:'0'.repeat(64)},
    {...GAME_IDENTITY125,extra_sha256:'0'.repeat(64)}
  ])await assert.rejects(normalizeBootstrap039(bootstrapFor([],identity),webcrypto),/게임 버전/);
});
