// (199) Trait "시작 덱에 카드 추가" (start_deck, 대표님 2026-11-24 "특성에 패 말고 시작 시 덱에 카드 추가하는 특성도 만들어줘
// (그 전투에만 사용 가능한 카드)"): 1..12 distinct main-deck cards, at most 12 copies, shuffled into the trait user's own deck right
// after both opening hands, for that battle only. Same entry list as 시작 묘지 (counted-source-cards). The 199 migration appends
// this definition to capabilities.trait_form.kinds and opens the public route poc_bootstrap199; routes up to 197 stay frozen,
// so apps up to 0.18.127 never receive it. Decks, chapter encounters, character shared traits and starter decks may carry it.
// It imports only the import-free 197 module, so the database preparation (WebSync199/Database/prepare199.mjs) can load it as-is.
import {STARTER_KINDS197, CHARACTER_KINDS197} from './authoring197-traits.js';

export const START_DECK_DEFINITION199=Object.freeze({kind:'start_deck',label:'시작 덱에 카드 추가',
  fields:Object.freeze({entries:Object.freeze({type:'counted-source-cards',filter:'playable-main',max_rows:12,min_rows:1,count_max:12,count_min:1,total_max:12,distinct_source:true})}),
  compiled:true,shared:true,help:'첫 손패를 받은 뒤 고른 카드를 이 전투에만 덱에 섞어 넣습니다. 메인 덱 카드, 합계 12장까지.'});
export const TRAIT_KINDS199=Object.freeze([START_DECK_DEFINITION199]);
export const TRAIT_KIND_IDS199=Object.freeze(TRAIT_KINDS199.map(row=>row.kind));
export const CHARACTER_KINDS199=Object.freeze([...CHARACTER_KINDS197,...TRAIT_KIND_IDS199]);
// Starter deck traits: what studio153_compile_starter_loadout accepts from 199 on (the 197 list and start_deck).
export const STARTER_KINDS199=Object.freeze([...STARTER_KINDS197,...TRAIT_KIND_IDS199]);
// Cards a counted list (시작 묘지, 시작 덱) may hold in total.
export const COUNTED_TOTAL199=12;

export function traitKindOffered199(definition,shared,starter=false){
  if(!definition||typeof definition.kind!=='string')return false;
  if(starter===true)return STARTER_KINDS199.includes(definition.kind);
  if(!shared)return definition.compiled===true;
  return definition.shared!==false;
}
