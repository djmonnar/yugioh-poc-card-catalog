import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY143} from '../authoring143-identity.js';
import {CONTENT_PROFILE144, GAME_IDENTITY144, gameIdentityMatches144} from '../authoring144-identity.js';
import {cardMetadata144} from '../authoring144-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';

const pack=JSON.parse(readFileSync(new URL('../data/native-expansion144.json',import.meta.url),'utf8'));
const draft=()=>({banlist_enabled:true,main:[],extra:[]});
function bootstrap(cards,identity=GAME_IDENTITY144){
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

test('insects, fusion and display-only tokens appear under the same canonical IDs in the web editor',async()=>{
  const cards=normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:26},(_,i)=>2980+i));
  for(const [index,card] of cards.entries()){
    const row=pack.cards[index];
    assert.equal(card.image,'assets/native144/cards/'+row.sourceId+'.jpg');
    assert.equal(readFileSync(new URL('../'+card.image,import.meta.url)).subarray(0,3).toString('hex'),'ffd8ff');
    assert.deepEqual(card.tags,row.categories);
    assert.equal(card.name_ko,row.name);
    assert.equal(cardMetadata144(row.sourceId,'0'.repeat(64)),null);
  }
  const resonance=cards.find(card=>card.code===96938986);
  assert.equal(resonance.deck_limit,3);
  assert.equal(resonance.speed_limit,1);
  assert.equal(cardMetadata144(resonance.source_id,resonance.identity_key).maximumSpeedLimit,1);
  const fusion=cards.find(card=>card.code===87804747);
  assert.equal(changeDeckCard039(draft(),fusion,1,cards).extra[0].source_id,fusion.source_id);
  for(const card of cards.filter(card=>card.token)){
    assert.equal(card.playable,false);assert.equal(card.stock,false);assert.equal(card.draw_enabled,false);
    assert.throws(()=>changeDeckCard039(draft(),card,1,cards));
  }
  const additions=catalogAdditions049(cards);
  assert.equal(additions.latest.key,'Cards144');
  assert.equal(additionThemes067(cards,'latest',additions).find(theme=>theme.key==='insect-token144')?.count,2);
});

test('recognizes prior web identity and rejects a forged insect catalog identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE144,{schema:1,card_set:'insects144'});
  assert(gameIdentityMatches144(GAME_IDENTITY143));
  assert(gameIdentityMatches144(GAME_IDENTITY144));
  await assert.rejects(normalizeBootstrap039(bootstrap([],{...GAME_IDENTITY144,catalog144_sha256:'0'.repeat(64)}),webcrypto),/게임 버전/);
});
