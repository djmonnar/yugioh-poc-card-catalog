// (196) Opponent trait "유니온의 힘" (union_power): the opponent's monsters equipped with a Union monster gain this much ATK and DEF.
// The studio offers trait kinds from the database (capabilities.trait_form.kinds). The 196 migration appends this definition
// there and opens the public route poc_bootstrap196 (content_profile196); routes up to 193 stay frozen, so apps up to 0.18.124
// never receive the new kind. The kind carries one integer value (100..3000) and belongs to opponent decks and chapter
// encounters only (shared:false): character shared traits and starter-deck traits keep rejecting it in the database.
// The database definition has no default field, so this module decides the value a newly added row starts with (300).
// This module has no imports so the database preparation (WebSync196/Database/prepare196.mjs) can load it as-is.
export const TRAIT_KINDS196=Object.freeze([
  Object.freeze({kind:'union_power',label:'유니온의 힘',fields:Object.freeze({value:Object.freeze({max:3000,min:100,type:'integer'})}),compiled:true,shared:false,
    help:'유니온 몬스터를 장착한 이 상대의 몬스터는 공격력·수비력이 이 수치만큼 올라갑니다.'}),
]);
export const TRAIT_KIND_IDS196=Object.freeze(TRAIT_KINDS196.map(row=>row.kind));
export const TRAIT_DEFAULTS196=Object.freeze({union_power:Object.freeze({value:300})});

// The value a newly added integer field starts with: the studio default for that kind when it fits the database bounds, else the minimum.
export function traitDefault196(kind,key,spec){
  const value=TRAIT_DEFAULTS196[kind]?.[key];
  return Number.isSafeInteger(value)&&value>=spec.min&&value<=spec.max?value:spec.min;
}

// The label of an integer field in the trait editor (the older kinds keep their labels).
export function traitFieldLabel196(kind,key){
  if(key==='threshold')return '발동 LP';
  if(kind==='union_power')return '공격력·수비력 상승';
  return kind==='heal_once'||kind==='lp_bonus'?'LP 수치':'드로우 장수';
}
