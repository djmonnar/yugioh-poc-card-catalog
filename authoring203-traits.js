// (203) 특성 2종 (대표님 2026-11-25): LP배리어 lp_barrier, 하이랜더 highlander. 둘 다 칸 없음.
//  - 덱·장별 상대: typed {kind,value:0,threshold:0,sourceId:-1,position:0,entries:[]} (DB unified039_skills, 앱 NativeOpponentRules revision 9).
//  - 캐릭터 공용 특성·시작 덱: {kind} (DB validate_character_skills199·studio153_compile_starter_loadout).
// 이름·설명은 DB가 capabilities.trait_form.kinds 끝에 보낸다(경로 203 마이그레이션 websync203, 출처 UnityExpeditionWork/Traits203/traits203-contract.json).
// 덱·장별 상대와 캐릭터 공용 특성은 그 정의의 compiled·shared 표시로 고르지만, 시작 덱은 DB가 받는 종류 목록을 여기서 정한다(STARTER_KINDS203).
import {STARTER_KINDS199, CHARACTER_KINDS199} from './authoring199-traits.js';

// DB 정의와 같은 글자(UnityExpeditionWork/Traits203/traits203-contract.json kinds): 미리보기 자료와 시험이 쓴다. 제작소 화면은 DB 정의를 읽는다.
export const TRAIT_KINDS203 = Object.freeze([
  Object.freeze({kind: "lp_barrier", label: "LP배리어", help: "전투당 1번, 내 메인 페이즈에 켜면 그 턴이 끝날 때까지 내가 지불하는 LP 비용이 모두 0이 됩니다.",
    fields: Object.freeze({}), compiled: true, shared: true, starter: true}),
  Object.freeze({kind: "highlander", label: "하이랜더", help: "듀얼을 시작할 때 이 전투 덱(메인·엑스트라 덱)에 같은 이름의 카드가 없으면 시작 패가 1장 늘고, 듀얼 동안 내 몬스터의 공격력·수비력이 100 올라갑니다.",
    fields: Object.freeze({}), compiled: true, shared: true, starter: true}),
]);
export const TRAIT_KIND_IDS203 = Object.freeze(TRAIT_KINDS203.map(row => row.kind));
// 제작소 대체 이름(DB 정의가 없을 때 저장된 특성의 이름; authoring203-trait-summary.js)
export const TRAIT_LABELS203 = Object.freeze({lp_barrier: 'LP배리어', highlander: '하이랜더'});
export const CHARACTER_KINDS203 = Object.freeze([...CHARACTER_KINDS199, ...TRAIT_KIND_IDS203]);
// Starter deck traits: what studio153_compile_starter_loadout accepts from 203 on (the 199 list and the two 203 kinds).
export const STARTER_KINDS203 = Object.freeze([...STARTER_KINDS199, ...TRAIT_KIND_IDS203]);

export function traitKindOffered203(definition, shared, starter = false) {
  if (!definition || typeof definition.kind !== 'string') return false;
  if (starter === true) return STARTER_KINDS203.includes(definition.kind);
  if (!shared) return definition.compiled === true;
  return definition.shared !== false;
}
