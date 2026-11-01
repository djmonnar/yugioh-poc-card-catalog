import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {GAME_IDENTITY067} from '../authoring067-identity.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
const bytes=fs.readFileSync(new URL('../data/native-expansion067.json',import.meta.url));
const manifest=JSON.parse(bytes);

test('the published067 manifest keeps the exact reviewed registry bytes and prior native lineage',()=>{
  assert.equal(sha(bytes),'22675aba9c08faaeac3b492ca3e06cf0e93a3f8dc2a1e281b8f2c93e121b25fe');
  assert.equal(manifest.parentCatalogSha256,GAME_IDENTITY067.catalog053_sha256);
  assert.equal(manifest.parentExpansionSha256,GAME_IDENTITY067.native_manifest053_sha256);
  assert.equal(manifest.cards.length,37);
  assert.equal(new Set(manifest.cards.map(card=>card.code)).size,37);
  assert.equal(new Set(manifest.cards.map(card=>card.identity_key)).size,37);
});

test('all37 added identities retain supported summon types, Korean display and local unchanged JPEG paths',()=>{
  const themes=new Map();
  for(const [index,card] of manifest.cards.entries()){
    assert.equal(card.sourceId,2551+index);assert.equal(card.slot,1583+index);
    assert.equal(card.identity_key,sha(`unity-native067\0${card.slot}\0${card.sourceId}\0${card.code}`));
    assert.equal(card.legacyExportAllowed,false);assert.equal(card.legacySlot,null);
    assert.equal(card.type&(0x2000|0x800000|0x4000000|0x1000000),0);
    assert.equal(card.playable,true);assert.equal(card.token,false);
    assert.equal(card.artKey,`Cards067/${card.sourceId}`);
    assert.equal(card.nativeLuaPath,`official/c${card.code}.lua`);assert.match(card.nativeLuaSha256,/^[a-f0-9]{64}$/);
    assert.match(card.name,/[가-힣]/);assert.match(card.description,/[가-힣]/);assert.ok(!card.name.includes('\ufffd')&&!card.description.includes('\ufffd'));
    const image=fs.readFileSync(new URL(`../assets/native067/cards/${card.sourceId}.jpg`,import.meta.url));
    assert.deepEqual([...image.subarray(0,3)],[255,216,255]);assert.ok(image.length>2000);
    themes.set(card.category,(themes.get(card.category)??0)+1);
  }
  assert.deepEqual([...themes],[['묘지기',17],['가이아',20]]);
});
