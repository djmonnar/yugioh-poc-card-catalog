import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {builderCardMatches, builderSearchText, sortBuilderCards} from '../ai-deck-filters.js';
import {additionIndex, additionMatches} from '../card-additions.js';
import {statConditionsMatch} from '../card-filters.js';
import {subtypeMatches} from '../card-subtypes.js';
import {categoryMatches} from '../card-groups.js';
import {emptyDeck, adjustCard, exportBundle, parseBundle, copyCount} from '../ai-deck-core.js';

const catalog = JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8'));
const history = JSON.parse(readFileSync(new URL('../data/card-additions.json', import.meta.url), 'utf8'));
const additions = additionIndex(catalog.cards, history);
const monster = {slot: 1, internal_id: 101, identity_key: 'a'.repeat(64), name_ko: '시험 몬스터', name_en: 'Test Monster',
  type: '일반 몬스터', race: '물족', attribute: '물', level: 2, atk: 1000, def: 500,
  rarity: 'R', deck_limit: 1, speed_limit: 2, stock: true, reward_eligible: true,
  mechanics: [{id: 'low_level', name: '저레벨 지원'}], card_groups: [{id: 'water', name: '물 카드군'}]};
const tagged = {annotations: [{...monster, tags: ['습지초원', '내 덱'], links: [], version: 1}]};

test('builder intersects type, rarity, race, attribute, level and both player banlists', () => {
  const filters = {type: '일반 몬스터', tier: 'R', race: '물족', attribute: '물', minLevel: '1', maxLevel: '3', limit: '1', speedLimit: '2'};
  assert.equal(builderCardMatches(monster, filters), true);
  for (const [key, value] of Object.entries({type: '효과 몬스터', tier: 'N', race: '전사족', attribute: '빛', minLevel: '3', maxLevel: '1', limit: '2', speedLimit: '1'})) {
    assert.equal(builderCardMatches(monster, {...filters, [key]: value}), false, key);
  }
  assert.equal(builderCardMatches(monster, {minLevel: '3', maxLevel: '1'}), false);
  assert.equal(builderCardMatches({...monster, level: null}, {maxLevel: '3'}), false);
});

test('special duel-only cards stay excluded even if every selected condition matches', () => {
  assert.equal(builderCardMatches({...monster, special: true}), false);
  const found = catalog.cards.filter(card => builderCardMatches(card));
  assert.equal(found.length, catalog.meta.regular_count);
  assert.equal(found.some(card => card.special), false);
});

test('spell and trap subtype and mechanic/group conditions reuse catalog semantics', () => {
  for (const card of catalog.cards) {
    for (const subtype of ['마법:장착', '마법:필드', '마법:지속', '마법:속공', '마법:의식', '함정:카운터', '함정:지속']) {
      assert.equal(builderCardMatches(card, {subtype}), !card.special && subtypeMatches(card, subtype));
    }
    const mechanic = catalog.meta.card_system.mechanics[0].id, group = catalog.meta.card_system.groups[0].id;
    assert.equal(builderCardMatches(card, {mechanic, group}), !card.special && categoryMatches(card, mechanic, group));
  }
  assert.equal(builderCardMatches(monster, {mechanic: 'low_level', group: 'water'}), true);
  assert.equal(builderCardMatches(monster, {mechanic: 'low_level', group: 'another'}), false);
});

test('ATK/DEF ranges and selected stars intersect with level bounds and exclude unknown values', () => {
  const conditions = [{field: 'atk', min: '1000', max: '1900'}, {field: 'def', max: '500'}, {field: 'level', levels: [2, 4]}];
  assert.equal(builderCardMatches(monster, {statConditions: conditions, minLevel: '1', maxLevel: '3'}), true);
  for (const card of catalog.cards) {
    assert.equal(builderCardMatches(card, {statConditions: conditions}), !card.special && statConditionsMatch(card, conditions));
  }
  assert.equal(builderCardMatches(monster, {statConditions: [{field: 'atk', min: '2000', max: '1000'}]}), false);
  assert.equal(builderCardMatches({...monster, atk: null}, {statConditions: [{field: 'atk', min: '0'}]}), false);
});

test('custom tags use AND and searches include normalized tags without adopting replaced identities', () => {
  assert.equal(builderCardMatches(monster, {tags: ['습지초원', '내 덱']}, {tagsState: tagged}), true);
  assert.equal(builderCardMatches(monster, {tags: ['습지초원', '다른 태그']}, {tagsState: tagged}), false);
  assert.equal(builderCardMatches(monster, {query: ' 내　덱 '}, {tagsState: tagged}), true);
  assert.equal(builderCardMatches({...monster, identity_key: 'b'.repeat(64)}, {query: '습지초원'}, {tagsState: tagged}), false);
  assert.equal(builderCardMatches(monster, {tags: ['습지초원']}), false);
});

test('search includes official names, text, category labels, attributes and IDs', () => {
  const before = structuredClone(monster), prepared = {...monster, searchText: builderSearchText(monster)};
  for (const query of ['ＴＥＳＴ  ＭＯＮＳＴＥＲ', '물 카드군', '저레벨 지원', '물족', '101']) {
    assert.equal(builderCardMatches(prepared, {query}), true, query);
  }
  assert.equal(builderCardMatches(prepared, {query: '없는카드'}), false);
  assert.deepEqual(monster, before);
});

test('stock, ordinary reward and review status match the catalog and keep legends out of random rewards', () => {
  assert.equal(builderCardMatches(monster, {status: 'stock'}), true);
  assert.equal(builderCardMatches({...monster, stock: false}, {status: 'stock'}), false);
  assert.equal(builderCardMatches(monster, {status: 'reward'}), true);
  for (const card of [{...monster, rarity: 'L'}, {...monster, draw_enabled: false}, {...monster, reward_eligible: false}]) {
    assert.equal(builderCardMatches(card, {status: 'reward'}), false);
  }
  assert.equal(builderCardMatches({...monster, review_kind: 'effect'}, {status: 'effect-difference'}), true);
  assert.equal(builderCardMatches(monster, {status: 'effect-difference'}), false);
  assert.equal(builderCardMatches({...monster, review_note: '검토 필요'}, {status: 'attention'}), true);
  assert.equal(builderCardMatches(monster, {status: 'attention'}), false);
});

test('speed restriction 3 and no restriction remain distinct; zero is searchable in both modes', () => {
  assert.equal(builderCardMatches({...monster, speed_limit: 3}, {speedLimit: '3'}), true);
  assert.equal(builderCardMatches({...monster, speed_limit: null}, {speedLimit: '3'}), false);
  assert.equal(builderCardMatches({...monster, speed_limit: null}, {speedLimit: 'unrestricted'}), true);
  assert.equal(builderCardMatches({...monster, speed_limit: 3}, {speedLimit: 'unrestricted'}), false);
  assert.equal(builderCardMatches({...monster, speed_limit: 0, deck_limit: 0}, {speedLimit: '0', limit: '0'}), true);
});

test('release filters reuse identity-safe catalog addition history and fail closed when unavailable', () => {
  const latest = catalog.cards.filter(card => builderCardMatches(card, {release: 'latest'}, {additions}));
  assert.ok(latest.length > 0);
  assert.deepEqual(latest, catalog.cards.filter(card => !card.special && additionMatches(card, 'latest', additions)));
  assert.equal(builderCardMatches(latest[0], {release: 'latest'}), false);
  assert.equal(builderCardMatches({...latest[0], identity_key: 'f'.repeat(64), previous_identity_keys: []}, {release: 'latest'}, {additions}), false);
});

test('sorting does not mutate pool and default stays alphabetical while additions sort newest first', () => {
  const pool = [{...monster, slot: 2, name_ko: '나', atk: 2000}, {...monster, slot: 1, name_ko: '가', atk: 1000}];
  const before = structuredClone(pool);
  assert.deepEqual(sortBuilderCards(pool).map(card => card.slot), [1, 2]);
  assert.deepEqual(sortBuilderCards(pool, 'attack').map(card => card.slot), [2, 1]);
  assert.deepEqual(sortBuilderCards(pool, 'slot').map(card => card.slot), [1, 2]);
  assert.deepEqual(pool, before);
  const sorted = sortBuilderCards(catalog.cards, 'added', additions);
  assert.equal(additionMatches(sorted[0], 'latest', additions), true);
});

test('browsing banlist filters do not change AI three-copy policy or serialized deck identity', () => {
  for (const mode of ['classic', 'duel_links_plan']) {
    const deck = emptyDeck('filter-preservation', mode), banned = {...monster, deck_limit: 0, speed_limit: 0};
    assert.equal(builderCardMatches(banned, {limit: '0', speedLimit: '0'}), true);
    for (let index = 0; index < 3; index++) adjustCard(deck, banned, 'main', 1);
    assert.equal(copyCount(deck, banned.identity_key), 3);
    assert.throws(() => adjustCard(deck, banned, 'main', 1));
    const before = exportBundle(catalog.meta, [deck], [banned]);
    builderCardMatches(banned, {limit: '3'});
    sortBuilderCards([banned], 'slot');
    const after = exportBundle(catalog.meta, parseBundle(before, [banned]), [banned]);
    assert.deepEqual(after.decks, before.decks);
    assert.equal(after.catalog_dataset_id, before.catalog_dataset_id);
  }
});
