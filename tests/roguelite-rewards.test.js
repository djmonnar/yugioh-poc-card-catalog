import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BALANCE_VERSIONS, REWARD_BALANCE, emptyRewardTrack, rewardOdds, eligibleRewardCards, prepareCardReward,
  selectCardReward, cleanRewardTrack} from '../roguelite-rewards.js';
import {emptyDeck, cardLine} from '../ai-deck-core.js';
import {createRun, makeStarter, emptySave, parseSave, serializeSave, beginDeckEdit, commitRunDeck} from '../roguelite-core.js';

const clone = value => JSON.parse(JSON.stringify(value));
const card = (index, rarity = 'N', fields = {}) => ({identity_key: index.toString(16).padStart(64, '0'), slot: index,
  internal_id: 1000 + index, name_ko: `보상 카드 ${index}`, name_en: `Reward Card ${index}`, type: '일반 몬스터',
  special: false, speed_limit: null, deck_limit: 3, reward_eligible: true, rarity, level: 4, atk: 1000, def: 1000,
  image: `assets/cards/${index}.webp`, description_ko: '보상 설명', tags: ['원정'], ...fields});
const cards = ['N', 'R', 'SR', 'UR'].flatMap((rarity, tier) => Array.from({length: 20}, (_, index) => card(tier * 20 + index + 1, rarity)));
const normals = cards.filter(value => value.rarity === 'N');
const noUR = cards.filter(value => value.rarity !== 'UR');
const newOffer = (track, id, options = {}) => prepareCardReward(track, {offerId: id, seed: 'reward-seed', cards, ...options});
const claimFirst = track => selectCardReward(track, track.pending.id, track.pending.candidates[0].identity_key);
function misses(count, track = emptyRewardTrack(), offset = 0) {
  for (let index = 1; index <= count; index++) track = claimFirst(newOffer(track, `miss-${offset + index}`, {cards: normals}));
  return track;
}

test('default offer has five distinct frozen snapshots and deterministic pool-order independent draws', () => {
  const source = clone(cards), track = emptyRewardTrack(), original = clone(track);
  const result = newOffer(track, 'one', {cards: source});
  assert.equal(result.pending.candidates.length, 5);
  assert.equal(new Set(result.pending.candidates.map(value => value.identity_key)).size, 5);
  assert.equal(new Set(result.pending.candidates.map(value => value.slot)).size, 5);
  assert.deepEqual(result, newOffer(track, 'one', {cards: [...source].reverse()}));
  assert.deepEqual(track, original);
  const snapshot = result.pending.candidates[0], raw = source.find(value => value.identity_key === snapshot.identity_key);
  raw.name_ko = '새 이름'; raw.tags.push('바뀜');
  assert.notEqual(snapshot.name_ko, raw.name_ko); assert.deepEqual(snapshot.tags, ['원정']);
  assert.equal(newOffer(track, 'six', {choices: 6}).pending.candidates.length, 6);
});

test('approved initial area rates and miss bonuses are independent of map floors', () => {
  assert.deepEqual(rewardOdds(1), {UR: 2, SR: 8, R: 35, N: 55});
  assert.deepEqual(rewardOdds(2), {UR: 3, SR: 12, R: 40, N: 45});
  assert.deepEqual(rewardOdds(3), {UR: 5, SR: 15, R: 45, N: 35});
  assert.deepEqual(rewardOdds(10), rewardOdds(3));
  assert.deepEqual(rewardOdds(2, {sr_misses: 2, ur_misses: 4}), {UR: 5, SR: 16, R: 40, N: 39});
  const before = misses(2);
  const first = newOffer(before, 'area-change', {area: 2, floor: 1});
  const twentieth = newOffer(before, 'area-change', {area: 2, floor: 20});
  assert.deepEqual(first, twentieth);
  assert.deepEqual(first.pending.pity_before, {sr_misses: 2, ur_misses: 2});
  assert.equal(first.pending.odds.UR, 4); assert.equal(first.pending.odds.SR, 16);
  assert.throws(() => rewardOdds(0), /구역/);
  assert.equal(REWARD_BALANCE.status, 'initial_test');
});

test('fifth offer guarantees SR or better; tenth guarantees UR and satisfies both simultaneous ceilings', () => {
  let track = misses(4);
  assert.deepEqual({sr: track.sr_misses, ur: track.ur_misses}, {sr: 4, ur: 4});
  track = newOffer(track, 'fifth', {cards: noUR});
  assert.equal(track.pending.guarantee, 'SR+');
  assert.deepEqual(track.pending.guarantee_reasons, ['sr_pity']);
  assert.ok(track.pending.candidates.some(value => value.rarity === 'SR'));
  assert.equal(track.sr_misses, 0); assert.equal(track.ur_misses, 5);
  track = misses(4, claimFirst(track), 5);
  assert.equal(track.sr_misses, 4); assert.equal(track.ur_misses, 9);
  track = newOffer(track, 'tenth');
  assert.equal(track.pending.guarantee, 'UR');
  assert.deepEqual(track.pending.guarantee_reasons, ['sr_pity', 'ur_pity']);
  assert.ok(track.pending.candidates.some(value => value.rarity === 'UR'));
  assert.equal(track.sr_misses, 0); assert.equal(track.ur_misses, 0);
});

test('appearance resets pity before selection; choosing a common card does not retain rare pity', () => {
  const fourMisses = misses(4);
  const pool = [...normals, card(100, 'SR')];
  const pending = newOffer(fourMisses, 'appearance', {cards: pool});
  const normal = pending.pending.candidates.find(value => value.rarity === 'N');
  assert.ok(normal); assert.equal(pending.sr_misses, 0); assert.equal(pending.ur_misses, 5);
  const selected = selectCardReward(pending, 'appearance', normal.identity_key);
  assert.equal(selected.sr_misses, 0); assert.equal(selected.ur_misses, 5);
  const boss = newOffer(selected, 'boss', {kind: 'boss', cards: [...normals, card(101, 'UR')]});
  assert.equal(boss.sr_misses, 0); assert.equal(boss.ur_misses, 0);
  const bossNormal = boss.pending.candidates.find(value => value.rarity === 'N');
  const chosen = selectCardReward(boss, 'boss', bossNormal.identity_key);
  assert.equal(chosen.sr_misses, 0); assert.equal(chosen.ur_misses, 0);
  assert.equal(chosen.offers.at(-1).chosen_identity_key, bossNormal.identity_key);
});

test('elite and boss guarantee one rare candidate while other candidates can remain common', () => {
  const elite = newOffer(emptyRewardTrack(), 'elite', {kind: 'elite', cards: [...normals, card(100, 'SR')]});
  assert.equal(elite.pending.guarantee, 'SR+');
  assert.equal(elite.pending.candidates.filter(value => value.rarity === 'SR').length, 1);
  assert.equal(elite.pending.candidates.filter(value => value.rarity === 'N').length, 4);
  const boss = newOffer(emptyRewardTrack(), 'boss', {kind: 'boss', cards: [...normals, card(101, 'UR')]});
  assert.equal(boss.pending.guarantee, 'UR');
  assert.equal(boss.pending.candidates.filter(value => value.rarity === 'UR').length, 1);
  assert.equal(boss.pending.candidates.filter(value => value.rarity === 'N').length, 4);
});

test('pending reload and repeated IDs never reroll, advance pity again or allow another selection', () => {
  const pending = newOffer(emptyRewardTrack(), 'once', {cards: normals});
  const restored = cleanRewardTrack(clone(pending));
  assert.deepEqual(restored, pending);
  assert.deepEqual(prepareCardReward(restored, {offerId: 'once', seed: 'changed', area: 3, cards: []}), pending);
  assert.throws(() => newOffer(pending, 'other'), /대기 중/);
  const identity = pending.pending.candidates[0].identity_key;
  const selected = selectCardReward(pending, 'once', identity);
  assert.equal(selected.pending, null); assert.equal(selected.offers.length, 1);
  assert.deepEqual(selectCardReward(selected, 'once', identity), selected);
  assert.deepEqual(prepareCardReward(selected, {offerId: 'once', cards: []}), selected);
  assert.throws(() => selectCardReward(selected, 'once', pending.pending.candidates[1].identity_key), /이미 다른 카드/);
  const newer = newOffer(selected, 'newer', {cards: normals});
  assert.deepEqual(prepareCardReward(newer, {offerId: 'once'}), newer);
  assert.equal(newer.sr_misses, 2); assert.equal(newer.ur_misses, 2);
  assert.deepEqual(pending, restored);
});

test('eligibility excludes tokens, L, disabled rewards/draw and either forbidden flag; duplicates cannot bias selection', () => {
  const excluded = [card(101, 'N', {special: true}), card(102, 'L'), card(103, 'N', {reward_eligible: false}),
    card(104, 'N', {reward_eligible: undefined}), card(105, 'N', {draw_enabled: false}),
    card(106, 'N', {deck_limit: 0}), card(107, 'N', {speed_limit: 0})];
  assert.deepEqual(eligibleRewardCards([...normals, ...excluded, clone(normals[0])]), eligibleRewardCards(normals));
  assert.throws(() => eligibleRewardCards([...normals, {...normals[0], slot: 200}]), /식별값의 정보가 달라/);
  assert.throws(() => eligibleRewardCards([...normals, card(200, 'N', {slot: normals[0].slot})]), /같은 번호/);
  const catalog = JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8')).cards;
  const eligible = eligibleRewardCards(catalog);
  assert.ok(eligible.length > 1000);
  assert.deepEqual(new Set(eligible.map(value => value.rarity)), new Set(['N', 'R', 'SR', 'UR']));
  assert.equal(newOffer(emptyRewardTrack(), 'real-catalog', {cards: catalog}).pending.candidates.length, 5);
});

test('insufficient or conflicting pools reject before any state mutation; guarantees cannot silently fall back', () => {
  const fourMisses = misses(4), original = clone(fourMisses);
  assert.throws(() => newOffer(fourMisses, 'fail-sr', {cards: normals}), /SR 이상 확정/);
  assert.deepEqual(fourMisses, original);
  assert.throws(() => newOffer(emptyRewardTrack(), 'fail-ur', {kind: 'boss', cards: noUR}), /UR 확정/);
  assert.throws(() => newOffer(emptyRewardTrack(), 'too-small', {cards: normals.slice(0, 4)}), /5장이 필요/);
  assert.throws(() => newOffer(emptyRewardTrack(), 'too-few', {choices: 3}), /후보 수/);
  assert.throws(() => newOffer(emptyRewardTrack(), 'invalid-seed', {seed: ''}), /시드/);
});

test('tampered candidates, chosen identities, pity history and guarantee metadata cannot reload', () => {
  const track = newOffer(emptyRewardTrack(), 'stored', {kind: 'boss'});
  for (const change of [value => { value.sr_misses++; },
    value => { value.pending.candidates[1] = clone(value.pending.candidates[0]); },
    value => { value.pending.candidates[0].speed_limit = 0; },
    value => { value.pending.odds.UR++; },
    value => { value.pending.guarantee = null; },
    value => { value.pending.chosen_identity_key = value.pending.candidates[0].identity_key; }]) {
    const altered = clone(track); change(altered); assert.throws(() => cleanRewardTrack(altered));
  }
  const completed = claimFirst(track); completed.offers[0].chosen_identity_key = 'f'.repeat(64);
  assert.throws(() => cleanRewardTrack(completed), /선택한 카드/);
  const duplicated = claimFirst(track); duplicated.offers.push(clone(duplicated.offers[0]));
  assert.throws(() => cleanRewardTrack(duplicated), /중복/);
});

test('stored balance versions are immutable; unsupported versions reject without changing the save', () => {
  const saved = newOffer(emptyRewardTrack(), 'versioned');
  assert.equal(saved.pending.balance_version, 'test139-v1');
  assert.equal(BALANCE_VERSIONS['test139-v1'], REWARD_BALANCE);
  assert.ok(Object.isFrozen(BALANCE_VERSIONS));
  assert.ok(Object.isFrozen(BALANCE_VERSIONS['test139-v1']));
  assert.ok(Object.isFrozen(BALANCE_VERSIONS['test139-v1'].areas[0]));
  assert.deepEqual(cleanRewardTrack(clone(saved)), saved);
  for (const version of ['future-v2', '__proto__', 'constructor']) {
    const unsupported = clone(saved); unsupported.pending.balance_version = version;
    const original = clone(unsupported);
    assert.throws(() => cleanRewardTrack(unsupported), /지원하지 않는 보상 추첨 기록/);
    assert.deepEqual(unsupported, original);
  }
});

test('legacy run saves default empty; new pending/claimed snapshots survive save and deck-edit roundtrips', () => {
  const deck = emptyDeck('reward-starter', 'duel_links_plan'); deck.groups.main = normals.map(value => cardLine(value));
  const now = '2026-10-14T02:00:00.000Z';
  const starter = makeStarter(deck, cards, {dataset_id: 'reward-test', now});
  const run = createRun({id: 'reward-run', slotId: 'slot-1', starter, cards, seed: 'save-seed', now});
  assert.deepEqual(run.reward_track, emptyRewardTrack());
  const save = emptySave(); save.starters.push(starter); save.slots[0].run = clone(run);
  delete save.slots[0].run.reward_track;
  assert.deepEqual(parseSave(save).slots[0].run.reward_track, emptyRewardTrack());
  save.slots[0].run.reward_track = newOffer(emptyRewardTrack(), 'saved');
  const loaded = parseSave(serializeSave(save)).slots[0].run;
  assert.deepEqual(loaded.reward_track, save.slots[0].run.reward_track);
  loaded.reward_track = claimFirst(loaded.reward_track);
  const edited = commitRunDeck(loaded, beginDeckEdit(loaded), {now});
  assert.deepEqual(edited.reward_track, loaded.reward_track);
  assert.deepEqual(edited.collection, run.collection);
  assert.equal(edited.gold, 0);
  assert.deepEqual(createRun({id: 'new-run', slotId: 'slot-2', starter, cards, seed: 'new-seed', now}).reward_track, emptyRewardTrack());
});
