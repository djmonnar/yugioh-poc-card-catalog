import {snapshotCard} from './roguelite-card.js?v=20261014-139';

// Initial test balance. These are expedition rewards, separate from paid packs.
// Odds are per ordinary candidate; a guarantee replaces one candidate slot.
const INITIAL_TEST_BALANCE = Object.freeze({
  version: 'test139-v1', status: 'initial_test', choices: 5,
  areas: Object.freeze([
    Object.freeze({UR: 2, SR: 8, R: 35, N: 55}),
    Object.freeze({UR: 3, SR: 12, R: 40, N: 45}),
    Object.freeze({UR: 5, SR: 15, R: 45, N: 35})
  ]),
  sr_hard_pity: 5, ur_hard_pity: 10,
  sr_bonus_per_miss: 2, ur_bonus_per_miss: 0.5
});

// Published versions are immutable contracts for saved offers. Tune by adding a
// new entry and changing the current alias; never rewrite an existing version.
const BALANCE163=Object.freeze({...INITIAL_TEST_BALANCE,version:'test163-v1'});
const BALANCE166=Object.freeze({...INITIAL_TEST_BALANCE,version:'test166-v1'});
export const BALANCE_VERSIONS=Object.freeze({'test139-v1':INITIAL_TEST_BALANCE,'test163-v1':BALANCE163,'test166-v1':BALANCE166});
export const REWARD_BALANCE = BALANCE_VERSIONS['test166-v1'];

const TIERS = ['UR', 'SR', 'R', 'N'];
const MAX_OFFERS = 1000;
const fail = message => { throw new Error(message); };
const record = value => !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} 값을 확인해줘.`);
  return value;
};
const text = (value, max, label) => {
  if (typeof value !== 'string' || !value.length || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label} 형식을 확인해줘.`);
  return value;
};
const identifier = value => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) fail('보상 번호 형식을 확인해줘.');
  return value;
};
const samePity = (a, b) => a.sr_misses === b.sr_misses && a.ur_misses === b.ur_misses;
const pity = value => {
  if (!record(value)) fail('보상 천장 기록을 확인해줘.');
  return {
    sr_misses: integer(value.sr_misses, 0, MAX_OFFERS, 'SR 미등장 횟수'),
    ur_misses: integer(value.ur_misses, 0, MAX_OFFERS, 'UR 미등장 횟수')
  };
};
const kindOf = value => {
  const kind = value === 'midboss' ? 'elite' : value;
  if (!['battle', 'elite', 'boss'].includes(kind)) fail('전투 보상 종류를 확인해줘.');
  return kind;
};

export function emptyRewardTrack() {
  return {schema_version: 1, sr_misses: 0, ur_misses: 0, offers: [], pending: null};
}

// Area is explicit: a floor number is never read from a run or a map here.
export function rewardOdds(area = 1, track = emptyRewardTrack()) {
  return oddsFor(area, track, REWARD_BALANCE);
}

function oddsFor(area, track, balance) {
  integer(area, 1, 10000, '구역');
  const before = pity(track), odds = {...balance.areas[Math.min(area, balance.areas.length) - 1]};
  const sr = before.sr_misses * balance.sr_bonus_per_miss;
  const ur = before.ur_misses * balance.ur_bonus_per_miss;
  const total = sr + ur, moved = Math.min(total, odds.N + odds.R);
  if (total) {
    odds.SR += moved * sr / total;
    odds.UR += moved * ur / total;
    const fromN = Math.min(moved, odds.N);
    odds.N -= fromN; odds.R -= moved - fromN;
  }
  return odds;
}

export function eligibleRewardCards(cards) {
  if (!Array.isArray(cards) || cards.length > 8192) fail('보상 카드 목록을 확인해줘.');
  const identities = new Map(), slots = new Map();
  for (const source of cards) {
    if (!source || source.special || !TIERS.includes(source.rarity) || source.reward_eligible !== true ||
      source.draw_enabled === false || source.deck_limit === 0 || source.speed_limit === 0) continue;
    const card = snapshotCard(source), previous = identities.get(card.identity_key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(card)) fail(`${card.name_ko}: 같은 카드 식별값의 정보가 달라. 보상 카드 자료를 다시 불러와줘.`);
    if (slots.has(card.slot) && slots.get(card.slot) !== card.identity_key) fail(`${card.name_ko}: 같은 번호에 교체 전후 카드가 섞여 있어. 보상 카드 자료를 다시 불러와줘.`);
    identities.set(card.identity_key, card); slots.set(card.slot, card.identity_key);
  }
  return [...identities.values()].sort((a, b) => a.identity_key.localeCompare(b.identity_key));
}

function guaranteeFor(kind, before, balance = REWARD_BALANCE) {
  if(kind==='boss'&&balance.version==='test166-v1')return {guarantee:'SR',guarantee_reasons:['boss_sr']};
  const reasons = [];
  if (kind === 'elite') reasons.push('elite');
  if (kind === 'boss') reasons.push('boss');
  if (before.sr_misses >= balance.sr_hard_pity - 1) reasons.push('sr_pity');
  if (before.ur_misses >= balance.ur_hard_pity - 1) reasons.push('ur_pity');
  const guarantee = reasons.some(reason => ['boss', 'ur_pity'].includes(reason)) ? 'UR' : reasons.length ? 'SR+' : null;
  return {guarantee, guarantee_reasons: reasons};
}

function nextPity(before, candidates) {
  const ur = candidates.some(card => card.rarity === 'UR');
  const sr = ur || candidates.some(card => card.rarity === 'SR');
  return {sr_misses: sr ? 0 : before.sr_misses + 1, ur_misses: ur ? 0 : before.ur_misses + 1};
}

function cleanOffer(value, before, completed) {
  if (!record(value) || typeof value.balance_version !== 'string' || !Object.hasOwn(BALANCE_VERSIONS, value.balance_version)) fail('지원하지 않는 보상 추첨 기록이야. 원본을 보존하고 버전을 확인해줘.');
  const balance = BALANCE_VERSIONS[value.balance_version];
  const id = identifier(value.id), seed = text(value.seed, 200, '보상 시드');
  const area = integer(value.area, 1, 10000, '구역'), kind = kindOf(value.kind);
  if (!samePity(pity(value.pity_before), before)) fail('보상 순서와 천장 누적 기록이 일치하지 않아.');
  if (!Array.isArray(value.candidates) || value.candidates.length < balance.choices || value.candidates.length > 20) fail(`보상 후보는 기본 ${balance.choices}장 이상이어야 해.`);
  const identities = new Set(), slots = new Set();
  const candidates = value.candidates.map(source => {
    const card = snapshotCard(source);
    if (!TIERS.includes(card.rarity) || card.deck_limit === 0 || card.speed_limit === 0) fail('보상 후보에 제외 대상 카드가 있어.');
    if (identities.has(card.identity_key) || slots.has(card.slot)) fail('보상 후보에 같은 카드나 교체된 번호가 중복돼 있어.');
    identities.add(card.identity_key); slots.add(card.slot); return card;
  });
  const after = nextPity(before, candidates);
  if (!samePity(pity(value.pity_after), after)) fail('보상 후보와 천장 초기화 기록이 일치하지 않아.');
  const guarantee = guaranteeFor(kind, before, balance);
  if (value.guarantee !== guarantee.guarantee || JSON.stringify(value.guarantee_reasons) !== JSON.stringify(guarantee.guarantee_reasons)) fail('보상 확정 등급 기록이 일치하지 않아.');
  if (guarantee.guarantee === 'UR' && !candidates.some(card => card.rarity === 'UR') ||
    guarantee.guarantee === 'SR+' && !candidates.some(card => ['SR', 'UR'].includes(card.rarity))) fail('보상 천장에 필요한 등급이 후보에 없어.');
  if(guarantee.guarantee==='SR'&&(candidates.length!==5||candidates.some(c=>c.rarity!=='SR')))fail('구역 보스 보상은 서로 다른 SR 카드 5장이어야 해.');
  const odds = kind==='boss'&&balance.version==='test166-v1'?{UR:0,SR:100,R:0,N:0}:oddsFor(area, before, balance);
  if (!record(value.odds) || TIERS.some(tier => value.odds[tier] !== odds[tier])) fail('보상 확률 기록이 일치하지 않아.');
  const offer = {id, seed, area, kind, balance_version: value.balance_version, candidates, odds,
    pity_before: {...before}, pity_after: after, ...guarantee};
  if(['test163-v1','test166-v1'].includes(value.balance_version)){
    const bias=value.race_bias;
    if(bias!==null&&(!record(bias)||Object.keys(bias).length!==2||typeof bias.race!=='string'||!bias.race.length||bias.race.length>100||!Number.isSafeInteger(bias.multiplier)||bias.multiplier<1||bias.multiplier>100))fail('종족 보상 가중 기록을 확인해줘.');
    offer.race_bias=bias===null?null:{race:bias.race,multiplier:bias.multiplier};
  }
  if (completed) {
    if (!identities.has(value.chosen_identity_key)) fail('선택한 카드가 보상 후보에 없어.');
    offer.chosen_identity_key = value.chosen_identity_key;
  } else if (value.chosen_identity_key != null) fail('대기 중인 보상에 선택 완료 기록이 있어.');
  return offer;
}

// Replaying stored offers checks the counters, but never draws candidates again.
// Selection does not determine pity: the complete displayed offer does.
export function cleanRewardTrack(value) {
  if (!record(value) || value.schema_version !== 1 || !Array.isArray(value.offers) || value.offers.length > MAX_OFFERS ||
    value.pending !== null && !record(value.pending)) fail('보상 추첨 저장 자료를 확인해줘.');
  const ids = new Set(); let before = {sr_misses: 0, ur_misses: 0};
  const offers = value.offers.map(source => {
    const offer = cleanOffer(source, before, true);
    if (ids.has(offer.id)) fail('보상 번호가 중복돼 있어.');
    ids.add(offer.id); before = offer.pity_after; return offer;
  });
  const pending = value.pending === null ? null : cleanOffer(value.pending, before, false);
  if (pending) {
    if (ids.has(pending.id) || offers.length === MAX_OFFERS) fail('대기 중인 보상 번호나 기록 수를 확인해줘.');
    before = pending.pity_after;
  }
  if (!samePity(pity(value), before)) fail('보상 후보 기록과 현재 천장 횟수가 일치하지 않아.');
  return {schema_version: 1, ...before, offers, pending};
}

function randomStream(seed) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index++) state = Math.imul(state ^ seed.charCodeAt(index), 16777619) >>> 0;
  return () => {
    state = state + 0x6D2B79F5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function drawCandidate(buckets, odds, random, allowed = TIERS, bias = null) {
  const available = allowed.filter(tier => buckets[tier].length && odds[tier] > 0);
  const total = available.reduce((sum, tier) => sum + odds[tier], 0);
  if (!total) fail('필요한 등급의 보상 카드가 부족해. 카드 도감의 등급·금제·보상 포함 설정을 확인해줘.');
  let roll = random() * total, tier = available.at(-1);
  for (const candidate of available) { roll -= odds[candidate]; if (roll < 0) { tier = candidate; break; } }
  const weights=buckets[tier].map(card=>bias&&card.type.includes('몬스터')&&card.race===bias.race?bias.multiplier:1);
  let index=0,cardRoll=random()*weights.reduce((a,b)=>a+b,0);
  for(;index<weights.length-1;index++){cardRoll-=weights[index];if(cardRoll<0)break;}
  return buckets[tier].splice(index,1)[0];
}

// Persist this complete result before showing candidates. A repeated offer ID
// returns its saved result even if seed, area or the live catalog has changed.
export function prepareCardReward(track, {offerId, seed, area = 1, kind = 'battle', cards, choices = REWARD_BALANCE.choices,raceBias=null}) {
  const clean = cleanRewardTrack(track), id = identifier(offerId);
  if (clean.pending?.id === id || clean.offers.some(offer => offer.id === id)) return clean;
  if (clean.pending) fail('먼저 대기 중인 카드 보상 1장을 선택해줘.');
  if (clean.offers.length >= MAX_OFFERS) fail('원정 보상 기록이 가득 찼어. 저장 파일을 내보내고 확인해줘.');
  const count = integer(choices, REWARD_BALANCE.choices, 20, '보상 후보 수');
  const canonicalSeed = typeof seed === 'number' ? String(integer(seed, 0, 0xffffffff, '보상 시드')) : text(seed, 200, '보상 시드');
  const battleKind = kindOf(kind), before = pity(clean), odds = battleKind==='boss'?{UR:0,SR:100,R:0,N:0}:rewardOdds(area, before);
  const guarantee = guaranteeFor(battleKind, before), pool = eligibleRewardCards(cards);
  if (pool.length < count) fail(`서로 다른 보상 카드 ${count}장이 필요해. 도감의 등급·금제·보상 포함 설정을 확인해줘.`);
  const buckets = Object.fromEntries(TIERS.map(tier => [tier, pool.filter(card => card.rarity === tier)]));
  if(battleKind==='boss'&&(count!==5||buckets.SR.length<5))fail('구역 보스 보상에 서로 다른 SR 카드 5장이 필요해.');
  if (guarantee.guarantee === 'UR' && !buckets.UR.length) fail('UR 확정 보상에 사용할 카드가 없어. UR 카드의 보상 포함·금제 설정을 확인해줘.');
  if (guarantee.guarantee === 'SR+' && !buckets.UR.length && !buckets.SR.length) fail('SR 이상 확정 보상에 사용할 카드가 없어. SR·UR 카드의 보상 포함·금제 설정을 확인해줘.');
  const random = randomStream(JSON.stringify([REWARD_BALANCE.version, canonicalSeed, id, area, battleKind]));
  const candidates = [];
  if (guarantee.guarantee) candidates.push(drawCandidate(buckets, odds, random, guarantee.guarantee === 'SR'?['SR']:guarantee.guarantee === 'UR' ? ['UR'] : ['UR', 'SR'],raceBias));
  while (candidates.length < count) candidates.push(drawCandidate(buckets, odds, random,TIERS,raceBias));
  for (let index = candidates.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  const after = nextPity(before, candidates);
  return cleanRewardTrack({...clean, ...after, pending: {id, seed: canonicalSeed, area, kind: battleKind,
    balance_version: REWARD_BALANCE.version, race_bias:raceBias===null?null:{race:raceBias.race,multiplier:raceBias.multiplier}, candidates, odds, pity_before: before, pity_after: after, ...guarantee}});
}

// The host grants exactly this chosen snapshot using the offer ID as its grant
// receipt. This function itself never writes account inventory, gold or a deck.
export function selectCardReward(track, offerId, identityKey) {
  const clean = cleanRewardTrack(track), id = identifier(offerId);
  const previous = clean.offers.find(offer => offer.id === id);
  if (previous) {
    if (previous.chosen_identity_key !== identityKey) fail('이 보상에서는 이미 다른 카드를 선택했어.');
    return clean;
  }
  if (!clean.pending || clean.pending.id !== id) fail('선택할 보상 번호와 현재 대기 중인 보상이 달라.');
  if (!clean.pending.candidates.some(card => card.identity_key === identityKey)) fail('현재 보상 후보 중에서 카드를 골라줘.');
  return cleanRewardTrack({...clean, offers: [...clean.offers, {...clean.pending, chosen_identity_key: identityKey}], pending: null});
}
