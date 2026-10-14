// One metadata boundary for starter cards, acquired cards and pending rewards.
const CARD_TYPES = ['일반 몬스터', '효과 몬스터', '의식 몬스터', '융합 몬스터', '마법', '함정'];
const fail = message => { throw new Error(message); };
const record = value => !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} 값이 올바르지 않아.`);
  return value;
};
const text = (value, max, label, empty = false) => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length)) fail(`${label} 형식이 올바르지 않아.`);
  return value;
};
const identity = value => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('카드 식별값이 올바르지 않아.');
  return value;
};

// Acquire card metadata once. Later catalog changes do not rewrite an ongoing run.
export function snapshotCard(card) {
  if (!record(card)) fail('카드 정보를 확인할 수 없어.');
  const result = {
    identity_key: identity(card.identity_key),
    slot: integer(card.slot, 1, 2047, '카드 번호'),
    internal_id: integer(card.internal_id, 0, 65535, '카드 내부 번호'),
    name_ko: text(card.name_ko, 200, '카드 이름'),
    name_en: text(card.name_en, 200, '카드 영문 이름'),
    type: text(card.type, 30, '카드 종류'),
    special: card.special === true,
    speed_limit: card.speed_limit ?? null,
    deck_limit: card.deck_limit ?? 3,
    rarity: card.rarity ?? 'N',
    description_ko: text(card.description_ko ?? '', 10000, '카드 설명', true),
    image: text(card.image ?? '', 300, '카드 그림', true),
    subtype: text(card.subtype ?? '', 80, '카드 분류', true),
    race: text(card.race ?? '', 50, '종족', true),
    attribute: text(card.attribute ?? '', 50, '속성', true)
  };
  if (!Array.isArray(card.tags ?? []) || (card.tags ?? []).length > 50) fail('카드 태그를 확인할 수 없어.');
  result.tags = [...new Set((card.tags ?? []).map(tag => text(tag, 80, '카드 태그')))];
  if (!CARD_TYPES.includes(result.type) || result.special) fail('토큰·특수 카드나 지원하지 않는 카드 종류는 원정 덱에 넣을 수 없어.');
  if (![null, 0, 1, 2, 3].includes(result.speed_limit) || ![0, 1, 2, 3].includes(result.deck_limit)) fail('카드 금제 정보를 확인할 수 없어.');
  if (!['N', 'R', 'SR', 'UR', 'L'].includes(result.rarity)) fail('카드 등급을 확인할 수 없어.');
  if (result.image && (!/^assets\/cards\/[a-zA-Z0-9_./-]+$/.test(result.image) || result.image.split('/').includes('..'))) fail('카드 그림 경로를 확인할 수 없어.');
  for (const field of ['level', 'atk', 'def']) {
    const value = card[field] ?? null;
    if (value !== null && (!Number.isInteger(value) || value < -2 || value > 65535)) fail('카드 능력치를 확인할 수 없어.');
    result[field] = value;
  }
  return result;
}
