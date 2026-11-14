import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY122} from '../authoring122-identity.js';
import {cardMetadata122} from '../authoring122-catalog.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039,normalizeCatalog039} from '../authoring039-panels.js';
import {fixture041} from './authoring041-test-dom.js';

test('new flip catalog opens and Eclipse can be found and added up to the three-copy limit',async()=>{
  const pack=JSON.parse(readFileSync(new URL('../data/native-expansion122.json',import.meta.url),'utf8'));
  const state=fixture041();
  for(const card of pack.cards)state.bootstrap.catalog.cards.push({
    ...card,source_id:card.sourceId,web_slot:card.slot,name_english:card.nameEnglish,native_type:card.type,
    type_name:card.typeName,normal_limit:card.normalLimit,art_key:card.artKey,
    stock:true,draw_enabled:true
  });
  const payload=JSON.stringify({catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},
    content022:{},meta017:{},characters:[],shop_rules:{}});
  const raw={schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:674,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',
      game_revision:674,authoring_revision:674,metadata_revision:'674',identity:GAME_IDENTITY122,
      payload_json:payload,source_fingerprint:createHash('sha256').update(payload).digest('hex')}};
  const bootstrap=await normalizeBootstrap039(raw,webcrypto);
  const cards=normalizeCatalog039({...state,bootstrap}),eclipse=cards.find(card=>card.code===35480699);
  assert.equal(eclipse.source_id,2804);
  assert.equal(eclipse.deck_limit,3);
  assert.equal(eclipse.image,'assets/native122/cards/2804.jpg');
  assert(eclipse.tags.includes('지원-리버스'));
  assert.equal(cardMetadata122(2804,'invalid'),null);
  assert.equal(cardMetadata122(1,undefined),null);
  let deck={banlist_enabled:true,main:[],extra:[]};
  for(let i=0;i<3;i++)deck=changeDeckCard039(deck,eclipse,1,cards);
  assert.equal(deck.main[0].count,3);
  assert.throws(()=>changeDeckCard039(deck,eclipse,1,cards));
});
