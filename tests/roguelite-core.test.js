import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyDeck, cardLine} from '../ai-deck-core.js';
import {generateMap} from '../roguelite-map.js';
import {SLOT_COUNT, STORAGE_KEY, emptySave, makeStarter, createRun, validatePlayerDeck, validateRun,
  beginDeckEdit, adjustRunDeck, commitRunDeck, grantCard, parseSave, serializeSave, readStore, writeStore} from '../roguelite-core.js';

const NOW = '2026-10-14T02:00:00.000Z';
const card = (index, fields = {}) => ({identity_key: index.toString(16).padStart(64, '0'), slot: index,
  internal_id: 1000 + index, name_ko: `카드 ${index}`, name_en: `Card ${index}`, type: '일반 몬스터',
  special: false, speed_limit: null, deck_limit: 3, rarity: 'N', level: 4, atk: 1000, def: 1000,
  image: `assets/cards/${index}.webp`, description_ko: '효과 설명', ...fields});
const cards = Array.from({length: 30}, (_, index) => card(index + 1));
const copy = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const deck = emptyDeck('starter-deck', 'duel_links_plan'); deck.name = '시작 덱';
  deck.groups.main = cards.slice(0, 20).map(value => cardLine(value));
  const starter = makeStarter(deck, cards, {dataset_id: 'catalog-1', now: NOW});
  const run = createRun({id: 'run-1', slotId: 'slot-1', starter, cards, seed: 12345, now: NOW});
  return {deck, starter, run};
}
function memoryStorage() {
  const values = new Map(), writes = [];
  return {values, writes, getItem: key => values.get(key) ?? null, setItem: (key, value) => {writes.push([key, value]); values.set(key, value);}};
}

test('registered starter and run freeze metadata, reserve side cards and isolate source deck/account', () => {
  const deck = emptyDeck('reserve', 'duel_links_plan'); deck.groups.main = cards.slice(0, 20).map(value => cardLine(value));
  deck.groups.side = [cardLine(cards[20], 2)];
  const fusion = card(40, {type: '융합 몬스터'}), pool = [...cards, fusion]; deck.groups.extra = [cardLine(fusion)];
  const originalDeck = copy(deck), originalPool = copy(pool);
  const starter = makeStarter(deck, pool, {dataset_id: 'version-one', now: NOW});
  const run = createRun({id: 'reserve-run', slotId: 'slot-3', starter, cards: pool, seed: 'original-seed', now: NOW});
  assert.equal(run.lp, 4000); assert.equal(run.max_lp, 4000); assert.equal(run.gold, 0); assert.equal(run.floor, 0);
  assert.equal(run.state, 'between_nodes'); assert.equal(run.revision, 0);
  assert.deepEqual(run.active_deck.groups.side, []); assert.deepEqual(starter.groups.side, []);
  assert.equal(run.collection.find(entry => entry.card.identity_key === cards[20].identity_key).count, 2);
  assert.equal(run.active_deck.groups.extra.length, 1);
  assert.deepEqual(deck, originalDeck); assert.deepEqual(pool, originalPool);
  pool[0].description_ko = '온라인에서 변경'; starter.collection[0].card.atk = 9999;
  assert.equal(run.collection[0].card.description_ko, '효과 설명'); assert.equal(run.collection[0].card.atk, 1000);
});

test('valid current catalog supports a player starter without token metadata polluting validation', () => {
  const catalog = JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8'));
  const legal = catalog.cards.filter(value => !value.special && value.type !== '융합 몬스터' && value.speed_limit == null).slice(0, 20);
  const deck = emptyDeck('installed-cards', 'duel_links_plan'); deck.groups.main = legal.map(value => cardLine(value));
  assert.equal(validatePlayerDeck(deck, catalog.cards).valid, true);
  const starter = makeStarter(deck, catalog.cards, {...catalog.meta, now: NOW});
  assert.equal(starter.collection.length, 20); assert.equal(starter.catalog_version, catalog.meta.dataset_id);
});

test('player speed forbidden and shared limit buckets apply even when imported AI ignores them', () => {
  const {deck} = fixture(), limited = cards.map(value => ({...value}));
  limited[0].speed_limit = 0; deck.banlist_enabled = false;
  assert.match(validatePlayerDeck(deck, limited).issues.join(' '), /금지/);
  assert.throws(() => makeStarter(deck, limited, {now: NOW}), /금지/);
  for (const limit of [1, 2, 3]) {
    const pool = cards.map(value => ({...value}));
    for (let index = 0; index < limit + 1; index++) pool[index].speed_limit = limit;
    assert.match(validatePlayerDeck(deck, pool).issues.join(' '), new RegExp(`제한 ${limit} 그룹`));
  }
});

test('shared Harpie and Umi names and copies cannot be bypassed using distinct identities', () => {
  const {deck} = fixture();
  const harpies = [card(108, {internal_id: 1530}), card(606, {internal_id: 609})];
  deck.groups.main = [cardLine(harpies[0], 2), cardLine(harpies[1], 2), ...cards.slice(0, 16).map(value => cardLine(value))];
  assert.match(validatePlayerDeck(deck, [...cards, ...harpies]).issues.join(' '), /해피 레이디/);
  const ocean = [card(86, {internal_id: 333, name_en: 'Umi'}), card(98, {internal_id: 2040, name_en: 'A Legendary Ocean'})];
  deck.groups.main = [cardLine(ocean[0], 2), cardLine(ocean[1], 2), ...cards.slice(0, 16).map(value => cardLine(value))];
  assert.match(validatePlayerDeck(deck, [...cards, ...ocean]).issues.join(' '), /바다/);
  const starterDeck = emptyDeck('four-copies', 'duel_links_plan');
  starterDeck.groups.main = [cardLine(cards[0], 3), ...cards.slice(1, 18).map(value => cardLine(value))];
  starterDeck.groups.side = [cardLine(cards[0])];
  assert.throws(() => makeStarter(starterDeck, cards, {now: NOW}), /합계는 3장/);
});

test('player deck placement, minimum, maximum and extra cap are enforced', () => {
  const {deck} = fixture(); deck.ruleset = 'classic'; assert.throws(() => makeStarter(deck, cards, {now: NOW}), /스피드/);
  deck.ruleset = 'duel_links_plan'; deck.groups.main.pop(); assert.equal(validatePlayerDeck(deck, cards).valid, false);
  const many = Array.from({length: 31}, (_, index) => card(index + 50)); deck.groups.main = many.map(value => cardLine(value));
  assert.equal(validatePlayerDeck(deck, many).valid, false);
  deck.groups.main = cards.slice(0, 20).map(value => cardLine(value));
  const fusion = Array.from({length: 16}, (_, index) => card(index + 100, {type: '융합 몬스터'}));
  deck.groups.extra = fusion.map(value => cardLine(value)); assert.match(validatePlayerDeck(deck, [...cards, ...fusion]).issues.join(' '), /15장/);
  deck.groups.extra = [cardLine(cards[20])]; assert.match(validatePlayerDeck(deck, cards).issues.join(' '), /융합 몬스터/);
});

test('draft may dip below twenty while active deck stays legal; commit requires legal owned cards', () => {
  const {run} = fixture(), original = copy(run);
  let draft = adjustRunDeck(run, beginDeckEdit(run), cards[0].identity_key, 'main', -1);
  assert.equal(draft.groups.main.length, 19); assert.equal(run.active_deck.groups.main.length, 20);
  assert.throws(() => commitRunDeck(run, draft, {now: NOW}), /20~30/);
  assert.throws(() => adjustRunDeck(run, draft, cards[20].identity_key, 'main', 1), /획득하지/);
  assert.throws(() => adjustRunDeck(run, draft, cards[1].identity_key, 'main', 1), /보유한 매수/);
  draft = adjustRunDeck(run, draft, cards[0].identity_key, 'main', 1);
  const committed = commitRunDeck(run, draft, {now: NOW});
  assert.equal(committed.revision, 1); assert.deepEqual(run, original);
  assert.throws(() => commitRunDeck(committed, draft, {now: NOW}), /오래된/);
});

test('reward only affects run collection, is idempotent and preserves old metadata', () => {
  const {run} = fixture(), original = copy(run);
  const changed = {...cards[0], atk: 9999, description_ko: '새 설명'};
  const rewarded = grantCard(run, changed, 2, {rewardId: 'battle-1', now: NOW});
  assert.equal(rewarded.collection[0].count, 3); assert.equal(rewarded.collection[0].card.atk, 1000);
  assert.deepEqual(rewarded.active_deck, run.active_deck); assert.equal(rewarded.gold, 0);
  assert.deepEqual(run, original);
  assert.deepEqual(grantCard(rewarded, changed, 2, {rewardId: 'battle-1', now: NOW}), rewarded);
  assert.throws(() => grantCard(rewarded, cards[1], 2, {rewardId: 'battle-1', now: NOW}), /다른 카드/);
  assert.throws(() => grantCard(run, changed), /보상 번호/);
  const draft = beginDeckEdit(run); assert.throws(() => commitRunDeck(rewarded, draft, {now: NOW}), /오래된/);
});

test('reward reserve is editable but cannot exceed owned copies or structural three-copy cap', () => {
  const {run} = fixture(); const rewarded = grantCard(run, cards[20], 4, {rewardId: 'event-1', now: NOW});
  let draft = beginDeckEdit(rewarded);
  for (let index = 0; index < 3; index++) draft = adjustRunDeck(rewarded, draft, cards[20].identity_key, 'main', 1);
  assert.throws(() => adjustRunDeck(rewarded, draft, cards[20].identity_key, 'main', 1), /3장/);
  const committed = commitRunDeck(rewarded, draft, {now: NOW}); assert.equal(committed.collection.at(-1).count, 4);
  const forged = copy(draft); forged.groups.main[0].count = 2;
  assert.throws(() => commitRunDeck(rewarded, forged, {now: NOW}), /보유한 매수/);
});

test('acquired identities survive catalog replacement, replaced reward never overwrites a frozen card', () => {
  const {run, starter} = fixture();
  const replacement = {...cards[0], identity_key: 'f'.repeat(64), name_ko: '교체 카드'};
  assert.throws(() => createRun({id: 'new-run', slotId: 'slot-1', starter, cards: [replacement, ...cards.slice(1)], seed: 'x', now: NOW}), /다시 등록/);
  assert.throws(() => grantCard(run, replacement, 1, {rewardId: 'replacement', now: NOW}), /교체/);
  assert.throws(() => grantCard(run, {...replacement, internal_id: 999}, 1, {rewardId: 'changed-internal-id', now: NOW}), /교체/);
  const save = emptySave(); save.slots[0].run = run;
  assert.deepEqual(parseSave(serializeSave(save)).slots[0].run, run);
  assert.equal(validateRun(run).valid, true);
  assert.throws(() => grantCard(run, {...cards[20], special: true}, 1, {rewardId: 'token', now: NOW}), /토큰/);
});

test('map, LP carry and relic data survive export/import without using the current catalog', () => {
  const {run, starter} = fixture(); run.lp = 1875; run.max_lp = 4500; run.floor = 3; run.gold = 98;
  run.map = generateMap(run.seed);
  run.relics = ['rest-bonus']; run.history = [{node_id: 'node-2', lp: 1875}];
  const save = emptySave(); save.starters = [starter]; save.slots[0].run = run;
  const restored = parseSave(serializeSave(save)); assert.deepEqual(restored, save);
  restored.slots[0].run.collection[0].card.name_ko = '별도 복사본'; assert.equal(run.collection[0].card.name_ko, '카드 1');
});

test('custom tags are frozen with acquired metadata; malformed counts and tag shapes cannot become starters', () => {
  const {deck} = fixture(), pool = cards.map(value => ({...value})); pool[0].tags = ['로우 레벨', '테스트'];
  const starter = makeStarter(deck, pool, {now: NOW});
  assert.deepEqual(starter.collection[0].card.tags, ['로우 레벨', '테스트']);
  pool[0].tags.push('새 태그'); assert.deepEqual(starter.collection[0].card.tags, ['로우 레벨', '테스트']);
  const badCount = copy(deck); delete badCount.groups.main[0].count;
  assert.throws(() => makeStarter(badCount, cards, {now: NOW}), /매수/);
  const badTags = cards.map(value => ({...value})); badTags[0].tags = [{id: 'not-a-string'}];
  assert.throws(() => makeStarter(deck, badTags, {now: NOW}), /태그/);
});

test('malformed, future, duplicate slots, impossible LP and forged card metadata fail restore', () => {
  const {run} = fixture(), valid = emptySave(); valid.slots[0].run = run;
  assert.equal(SLOT_COUNT, 3); assert.throws(() => parseSave('{bad JSON'), /손상/);
  assert.throws(() => parseSave({...valid, schema_version: 2}), /지원하지/);
  const duplicates = copy(valid); duplicates.slots[1].slot_id = 'slot-1'; assert.throws(() => parseSave(duplicates), /슬롯/);
  const wrongRun = copy(valid); wrongRun.slots[0].run.slot_id = 'slot-2'; assert.throws(() => parseSave(wrongRun), /일치하지/);
  for (const mutate of [value => {value.lp = 4001;}, value => {value.gold = -1;}, value => {value.revision = 0.5;},
    value => {value.active_deck.groups.main[0].slot = 99;}, value => {value.collection[0].card.image = 'javascript:alert(1)';},
    value => {value.collection.push(copy(value.collection[0]));}, value => {value.active_deck.groups.side = [cardLine(cards[0])];}]) {
    const bad = copy(valid); mutate(bad.slots[0].run); assert.throws(() => parseSave(bad));
  }
  const prototype = copy(valid); prototype.slots[0].run.map = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => parseSave(prototype)); assert.equal({}.polluted, undefined);
  const dangling = copy(valid); dangling.slots[0].run.map = generateMap(run.seed);
  dangling.slots[0].run.map.nodes[0].next = ['missing-node']; assert.throws(() => parseSave(dangling), /지도 자료/);
  const wrongSeed = copy(valid); wrongSeed.slots[0].run.map = generateMap('other-seed'); assert.throws(() => parseSave(wrongSeed), /시드/);
  const beyondTop = copy(valid); beyondTop.slots[0].run.map = generateMap(run.seed); beyondTop.slots[0].run.floor = beyondTop.slots[0].run.map.floors + 1;
  assert.throws(() => parseSave(beyondTop), /진행 층/);
});

test('save is one isolated key and revision CAS refuses a stale tab without losing saved data', () => {
  const storage = memoryStorage(); storage.values.set('poc-ai-decks-v1', 'user-decks'); storage.values.set('account-gold', '750');
  assert.deepEqual(readStore(storage), emptySave()); assert.equal(storage.writes.length, 0);
  const firstTab = readStore(storage), otherTab = readStore(storage), {run} = fixture(); firstTab.slots[0].run = run;
  const saved = writeStore(storage, firstTab, firstTab.revision); assert.equal(saved.revision, 1);
  assert.deepEqual(readStore(storage), saved); assert.equal(storage.writes.length, 1);
  assert.throws(() => writeStore(storage, otherTab, otherTab.revision), /다른 창/);
  assert.equal(storage.writes.length, 1); assert.equal(storage.values.get('poc-ai-decks-v1'), 'user-decks');
  assert.equal(storage.values.get('account-gold'), '750'); assert.deepEqual(storage.writes.map(([key]) => key), [STORAGE_KEY]);
});

test('corrupt/future stored envelope is never silently reset or overwritten, failed write preserves previous bytes', () => {
  for (const raw of ['bad-json', JSON.stringify({...emptySave(), schema_version: 99})]) {
    const storage = memoryStorage(); storage.values.set(STORAGE_KEY, raw);
    assert.throws(() => readStore(storage)); assert.throws(() => writeStore(storage, emptySave(), 0));
    assert.equal(storage.values.get(STORAGE_KEY), raw); assert.equal(storage.writes.length, 0);
  }
  const storage = memoryStorage(); writeStore(storage, emptySave(), 0); const previous = storage.values.get(STORAGE_KEY);
  storage.setItem = () => {throw new Error('quota exceeded');}; const saved = readStore(storage);
  assert.throws(() => writeStore(storage, saved, saved.revision), /quota/); assert.equal(storage.values.get(STORAGE_KEY), previous);
});

test('battle/end states cannot edit active deck and save cannot leak a half-edited invalid deck', () => {
  const {run} = fixture();
  for (const state of ['in_battle', 'reward_pending', 'completed', 'defeated']) assert.throws(() => beginDeckEdit({...run, state}), /덱을 바꿀/);
  const draft = adjustRunDeck(run, beginDeckEdit(run), cards[0].identity_key, 'main', -1);
  const save = emptySave(); save.slots[0].run = {...run, active_deck: {...run.active_deck, groups: draft.groups}};
  assert.throws(() => serializeSave(save), /20~30/);
});
