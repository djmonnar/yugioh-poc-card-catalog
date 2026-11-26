import {traitKindOffered203} from './authoring203-traits.js';

export const DUEL_READY209 = Object.freeze({
  kind: 'duel_ready209',
  label: '듀얼 준비 완료',
  help: '시작 패가 1장 늘어납니다. 자신의 첫 턴에는 카드와 카드의 효과를 발동할 수 없습니다.',
  fields: Object.freeze({}),
  compiled: true,
  shared: true,
  starter: true,
});

export function traitKindOffered209(definition, shared, starter = false) {
  if (definition?.kind !== DUEL_READY209.kind) return traitKindOffered203(definition, shared, starter);
  return definition.compiled === true && (starter ? definition.starter === true : !shared || definition.shared !== false);
}
