// (199) 대표님 2026-11-24 특성 4종(UnityExpeditionWork/Traits199/traits199-contract.json이 앱·DB·제작소 공통 모양):
//  - start_deck "시작 덱에 카드 추가": 메인 덱 카드 1..12종, 합계 12장을 첫 손패 뒤 이 전투에만 덱에 섞어 넣는다(시작 묘지와 같은 counted-source-cards).
//  - stat_aura "공격력·수비력 조정 (조건)": 종류·속성·종족·레벨 조건(각 조건 안은 OR, 조건끼리는 AND, 0 = 조건 없음)에 맞는 내 앞면 몬스터의 공격력·수비력 조정.
//    한 칸 aura = {types, attributes, races, levels, atk, def}(정수; 비트 OR, levels는 레벨 n마다 1<<n; atk·def -3000..3000, 제작소는 100 단위, 둘 다 0 불가).
//  - destiny_draw "데스티니 드로우", opening_reload "리로드"(리로드 유물처럼 내 첫 턴 시작에 한 번 묻는다): 칸 없음(회수 특성과 같은 {kind}).
// 199 마이그레이션(B)이 이 정의를 capabilities.trait_form.kinds 끝에 더하고 공개 경로 poc_bootstrap199를 연다(197까지는 고정, 0.18.127 이하는 받지 않는다).
// 덱·장별 상대(typed), 캐릭터 공용 특성, 시작 덱 모두에 쓸 수 있다.
// 197 모듈(가져오기 없음)만 가져오므로 DB 준비(WebSync199/Database/prepare199.mjs)가 그대로 불러올 수 있다.
import {STARTER_KINDS197, CHARACTER_KINDS197} from './authoring197-traits.js';

const freezeDeep = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); } return value; };
export const TRAIT_KINDS199 = freezeDeep([
  {kind: 'start_deck', label: '시작 덱에 카드 추가',
    help: '첫 손패를 받은 뒤 고른 카드를 이 전투에만 덱에 섞어 넣습니다. 메인 덱 카드, 합계 12장까지.',
    fields: {entries: {type: 'counted-source-cards', filter: 'playable-main', max_rows: 12, min_rows: 1, count_max: 12, count_min: 1, total_max: 12, distinct_source: true}},
    compiled: true, shared: true, starter: true},
  {kind: 'stat_aura', label: '공격력·수비력 조정 (조건)',
    help: '고른 종류·속성·종족·레벨 조건에 모두 맞는 내 앞면 몬스터의 공격력·수비력을 정한 만큼 올리거나 내립니다. 한 조건 안에서 여러 개를 고르면 그중 하나만 맞아도 되고, 비워 둔 조건은 모두 해당합니다.',
    fields: {aura: {type: 'stat-aura', atk_min: -3000, atk_max: 3000, def_min: -3000, def_max: 3000, step: 100,
      types: [[16, '일반'], [32, '효과'], [64, '융합'], [128, '의식'], [512, '스피릿'], [1024, '유니온'], [2048, '듀얼'], [4096, '튜너'], [2097152, '리버스'], [4194304, '툰']],
      attributes: [[1, '땅'], [2, '물'], [4, '화염'], [8, '바람'], [16, '빛'], [32, '어둠'], [64, '신']],
      races: [[1, '전사족'], [2, '마법사족'], [4, '천사족'], [8, '악마족'], [16, '언데드족'], [32, '기계족'], [64, '물족'], [128, '화염족'], [256, '암석족'], [512, '비행야수족'],
        [1024, '식물족'], [2048, '곤충족'], [4096, '번개족'], [8192, '드래곤족'], [16384, '야수족'], [32768, '야수전사족'], [65536, '공룡족'], [131072, '어류족'],
        [262144, '해룡족'], [524288, '파충류족'], [1048576, '사이킥족'], [2097152, '환신야수족'], [4194304, '창조신족'], [8388608, '환룡족'], [16777216, '사이버스족'],
        [33554432, '환상마족']],
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}},
    compiled: true, shared: true, starter: true},
  {kind: 'destiny_draw', label: '데스티니 드로우', help: '전투당 1번, 내 메인 페이즈에 덱에서 원하는 카드 1장을 패에 넣고 덱을 섞습니다.',
    fields: {}, compiled: true, shared: true, starter: true},
  {kind: 'opening_reload', label: '리로드', help: '내 첫 턴이 시작되면 한 번 묻습니다. 예를 고르면 패를 모두 덱으로 되돌려 섞은 뒤 같은 장수만큼 다시 뽑습니다.',
    fields: {}, compiled: true, shared: true, starter: true},
]);
export const START_DECK_DEFINITION199 = TRAIT_KINDS199[0];
export const STAT_AURA_DEFINITION199 = TRAIT_KINDS199[1];
export const TRAIT_KIND_IDS199 = Object.freeze(TRAIT_KINDS199.map(row => row.kind));
export const CHARACTER_KINDS199 = Object.freeze([...CHARACTER_KINDS197, ...TRAIT_KIND_IDS199]);
// Starter deck traits: what studio153_compile_starter_loadout accepts from 199 on (the 197 list and the four 199 kinds).
export const STARTER_KINDS199 = Object.freeze([...STARTER_KINDS197, ...TRAIT_KIND_IDS199]);
// Cards a counted list (시작 묘지, 시작 덱) may hold in total.
export const COUNTED_TOTAL199 = 12;

export function traitKindOffered199(definition, shared, starter = false) {
  if (!definition || typeof definition.kind !== 'string') return false;
  if (starter === true) return STARTER_KINDS199.includes(definition.kind);
  if (!shared) return definition.compiled === true;
  return definition.shared !== false;
}

// ---- stat_aura ----
export const AURA_KEYS199 = Object.freeze(['types', 'attributes', 'races', 'levels', 'atk', 'def']);
export const AURA_GROUPS199 = Object.freeze([['types', '종류'], ['attributes', '속성'], ['races', '종족'], ['levels', '레벨']]);
export const AURA_DEFAULT199 = Object.freeze({types: 0, attributes: 0, races: 0, levels: 0, atk: 300, def: 0});
// 조건 묶음의 [비트, 이름] 목록(레벨은 1<<n).
export function auraOptions199(spec, group) {
  if (group === 'levels') return (spec?.levels ?? []).map(level => [2 ** level, `레벨 ${level}`]);
  return spec?.[group] ?? [];
}
export function auraMask199(spec, group) { return auraOptions199(spec, group).reduce((mask, [bit]) => mask + bit, 0); }
const bitsWithin = (value, mask) => Number.isSafeInteger(value) && value >= 0 && value <= mask &&
  BigInt(value) === (BigInt(value) & BigInt(mask));
export function auraValid199(aura, spec = STAT_AURA_DEFINITION199.fields.aura) {
  if (!aura || typeof aura !== 'object' || Array.isArray(aura)) return false;
  const keys = Object.keys(aura);
  if (keys.length !== AURA_KEYS199.length || !AURA_KEYS199.every(key => keys.includes(key))) return false;
  if (!AURA_GROUPS199.every(([group]) => bitsWithin(aura[group], auraMask199(spec, group)))) return false;
  const step = spec.step ?? 100;
  const stat = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max && value % step === 0;
  return stat(aura.atk, spec.atk_min, spec.atk_max) && stat(aura.def, spec.def_min, spec.def_max) && !(aura.atk === 0 && aura.def === 0);
}
const signed = value => (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toLocaleString('ko-KR');
export function auraSummary199(aura, spec = STAT_AURA_DEFINITION199.fields.aura) {
  if (!aura || typeof aura !== 'object') return '조건 미설정';
  const parts = [];
  for (const [group] of AURA_GROUPS199) {
    const names = auraOptions199(spec, group).filter(([bit]) => (BigInt(aura[group] ?? 0) & BigInt(bit)) !== 0n).map(([, name]) => name);
    if (names.length) parts.push(names.join('·'));
  }
  const stats = [];
  if (aura.atk) stats.push(`공격력 ${signed(aura.atk)}`);
  if (aura.def) stats.push(`수비력 ${signed(aura.def)}`);
  return [parts.length ? parts.join(' · ') : '모든 몬스터', ...stats].join(' · ');
}
