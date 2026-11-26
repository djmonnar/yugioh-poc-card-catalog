import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {cardMetadata210} from '../authoring210-catalog.js';
import {GAME_IDENTITY207} from '../authoring207-identity.js';
import {GAME_IDENTITY210, gameIdentityAccepts210} from '../authoring210-identity.js';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const bytes = read('data/native-expansion210.json');
const pack = JSON.parse(bytes);

test('Spirit artwork, card IDs and deck limits match the shipped expansion', () => {
  assert.equal(pack.cards.length, 39);
  for (const card of pack.cards) {
    const data = cardMetadata210(card.sourceId, card.identity_key);
    assert.equal(data.image, `assets/native210/cards/${card.sourceId}.jpg`);
    assert.deepEqual(data.searchAliases, card.searchAliases);
    assert.deepEqual([...read(data.image).subarray(0, 2)], [255, 216]);
    assert.equal(cardMetadata210(card.sourceId, 'wrong-key'), null);
  }
  const healing = pack.cards.find(card => card.code === 276357);
  const token = pack.cards.find(card => card.code === 52900001);
  assert.equal(cardMetadata210(healing.sourceId, healing.identity_key).maximumSpeedLimit, 2);
  assert.equal(cardMetadata210(token.sourceId, token.identity_key).maximumNormalLimit, 0);
  assert.equal(token.playable, false);
});

test('known Spirit catalog fingerprints are strict and the old catalog still loads', () => {
  assert.equal(GAME_IDENTITY210.native_manifest210_sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(GAME_IDENTITY210.catalog207_sha256, pack.parentCatalogSha256);
  assert(gameIdentityAccepts210(GAME_IDENTITY207));
  assert(gameIdentityAccepts210(GAME_IDENTITY210));
  assert(!gameIdentityAccepts210({...GAME_IDENTITY210, catalog210_sha256: '0'.repeat(64)}));
  assert(!gameIdentityAccepts210({...GAME_IDENTITY207, catalog210_sha256: GAME_IDENTITY210.catalog210_sha256}));
});
