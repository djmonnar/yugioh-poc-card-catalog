import {traitKindOffered209} from './authoring209-traits.js';

export const DESTRUCTION_REWARD211 = Object.freeze({
  kind: 'destruction_reward211',
  label: '파괴 보상',
  help: '내 카드가 지정한 원인으로 파괴되면 선택한 보상을 받습니다.',
  fields: Object.freeze({destructionReward: Object.freeze({type: 'destruction-reward'})}),
  compiled: true,
  shared: true,
  starter: true,
});

export const DESTRUCTION_OPTIONS211 = Object.freeze({
  cause: Object.freeze({battle: '전투', monster_effect: '몬스터 효과', spell: '마법', trap: '함정'}),
  frequency: Object.freeze({turn: '턴당 1번', duel: '전투당 1번'}),
  reward: Object.freeze({recover: 'LP 회복', draw: '드로우'}),
});

export const DESTRUCTION_DEFAULT211 = Object.freeze({cause: 'battle', frequency: 'turn', reward: 'recover', amount: 500});

export function destructionAmount211(reward) {
  return reward === 'draw' ? {minimum: 1, maximum: 3} : {minimum: 100, maximum: 8000};
}

export function destructionRewardValid211(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 4 || !Object.hasOwn(value, 'amount')) return false;
  if (!Object.entries(DESTRUCTION_OPTIONS211).every(([field, options]) => Object.hasOwn(value, field) && Object.hasOwn(options, value[field]))) return false;
  const {minimum, maximum} = destructionAmount211(value.reward);
  return Number.isSafeInteger(value.amount) && value.amount >= minimum && value.amount <= maximum;
}

export function destructionRewardValues211(value) {
  if (!destructionRewardValid211(value)) return ['설정 확인 필요'];
  const amount = value.amount.toLocaleString('ko-KR');
  const cause = DESTRUCTION_OPTIONS211.cause[value.cause];
  return [DESTRUCTION_OPTIONS211.frequency[value.frequency], `${cause}${value.cause === 'spell' || value.cause === 'trap' ? '으로' : '로'} 파괴 시`,
    value.reward === 'draw' ? `${amount}장 드로우` : `LP ${amount} 회복`];
}

export function traitKindOffered211(definition, shared, starter = false) {
  if (definition?.kind !== DESTRUCTION_REWARD211.kind) return traitKindOffered209(definition, shared, starter);
  return definition.compiled === true && (starter ? definition.starter === true : !shared || definition.shared === true);
}
