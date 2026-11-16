import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {GAME_IDENTITY136} from '../authoring136-identity.js';
import {CONTENT_PROFILE143, GAME_IDENTITY143, gameIdentityMatches143} from '../authoring143-identity.js';
import {cardMetadata143} from '../authoring143-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {cardQueryMatches091} from '../authoring091-search.js';
import previous from '../data/native-expansion136.json' with {type: 'json'};

const pack = JSON.parse(readFileSync(new URL('../data/native-expansion143.json', import.meta.url), 'utf8'));
const copyDeck = () => ({banlist_enabled: true, main: [], extra: []});
const payloadCard = row => ({source_id: row.sourceId, web_slot: row.slot, identity_key: row.identity_key,
  name: row.name, alias: row.alias, name_english: row.nameEnglish, description: row.description, native_type: row.type,
  type_name: row.typeName, normal_limit: row.normalLimit, speed_limit: row.speedLimit, code: row.code, art_key: row.artKey,
  playable: row.playable, token: row.token, race: row.race, categories: row.categories, stock: true, draw_enabled: true});

function bootstrapFor(catalog, identity = GAME_IDENTITY143) {
  const payload = JSON.stringify({catalog, deck_rules035: {}, opponents: {}, starters: {}, content022: {},
    meta017: {}, characters: [], shop_rules: {}});
  return {schema: 1, kind: 'unified039-bootstrap', project_id: PROJECT039, project_revision: 1, unchanged: false,
    permissions: {can_edit: false}, authoring: null, game: {schema: 1, kind: 'poc-unified-game039', game_revision: 1,
      authoring_revision: 1, metadata_revision: '1', identity, payload_json: payload,
      source_fingerprint: createHash('sha256').update(payload).digest('hex')}};
}

test('22 staged cards preserve canonical images, display rows, categories and copy limits', async () => {
  const bootstrap = await normalizeBootstrap039(bootstrapFor(pack.cards.map(payloadCard)), webcrypto);
  const cards = normalizeCatalog039({bootstrap});
  assert.deepEqual(cards.map(card => card.source_id), Array.from({length: 22}, (_, i) => 2958 + i));
  for (const row of pack.cards) {
    const card = cards.find(candidate => candidate.source_id === row.sourceId);
    assert.equal(card.identity_key, row.identity_key);
    assert.equal(card.image, `assets/native143/cards/${row.sourceId}.jpg`);
    assert.equal(readFileSync(new URL(`../${card.image}`, import.meta.url)).subarray(0, 3).toString('hex'), 'ffd8ff');
    assert.deepEqual(card.search_aliases, row.searchAliases);
    assert.deepEqual(card.tags, row.categories);
    assert.equal(card.name_ko, row.name);
    assert.equal(card.description_ko, row.description);
    assert.equal(card.deck_limit, row.normalLimit);
    assert.equal(card.speed_limit, row.speedLimit);
    assert.equal(card.playable, row.playable);
    assert.equal(card.token, row.token);
    assert.equal(cardMetadata143(row.sourceId, '0'.repeat(64)), null);
  }
  for (const code of [11765832, 54757758]) {
    const fusion = cards.find(card => card.code === code);
    const deck = changeDeckCard039(copyDeck(), fusion, 1, cards);
    assert.equal(deck.extra[0].source_id, fusion.source_id);
    assert.equal(deck.main.length, 0);
  }
  for (const code of [17080584, 21565445, 73199638]) {
    const card = cards.find(card => card.code === code);
    assert.equal(changeDeckCard039(copyDeck(), card, 1, cards).main[0].source_id, card.source_id);
    assert(cardQueryMatches091(card, '지원-해황'));
  }
  const goods = cards.find(card => card.code === 35726888);
  const full = changeDeckCard039(changeDeckCard039(copyDeck(), goods, 1, cards), goods, 1, cards);
  assert.equal(cardMetadata143(goods.source_id, goods.identity_key).maximumNormalLimit, 2);
  assert.throws(() => changeDeckCard039(full, goods, 1, cards), /제한 매수/);
  const additions = catalogAdditions049(cards);
  assert.equal(additions.latest.key, 'Cards143');
  assert.deepEqual(additionThemes067(cards, 'latest', additions).map(theme => [theme.key, theme.count]),
    [['atlantean143', 11], ['fusion143', 2], ['spelltrap143', 9]]);
});

test('Exact profile 136 and 143 payloads remain compatible and invalid fingerprints are rejected', async () => {
  assert.deepEqual(CONTENT_PROFILE143, {schema: 1, card_set: 'atlantean-fusion-spells143'});
  for (const [manifest, identity] of [[previous, GAME_IDENTITY136], [pack, GAME_IDENTITY143]]) {
    assert(gameIdentityMatches143(identity));
    const bootstrap = await normalizeBootstrap039(bootstrapFor(manifest.cards.map(payloadCard), identity), webcrypto);
    assert.deepEqual(bootstrap.gameEnvelope.identity, identity);
    for (const card of manifest.cards)
      assert.equal(cardMetadata143(card.sourceId, card.identity_key).image, `assets/native${identity === GAME_IDENTITY136 ? 136 : 143}/cards/${card.sourceId}.jpg`);
  }
  await assert.rejects(normalizeBootstrap039(bootstrapFor([], {
    ...GAME_IDENTITY143, catalog143_sha256: '0'.repeat(64),
  }), webcrypto), /게임 버전/);
  const corrupted = bootstrapFor(pack.cards.map(payloadCard));
  corrupted.game.source_fingerprint = '0'.repeat(64);
  await assert.rejects(normalizeBootstrap039(corrupted, webcrypto), /검증값/);
});
