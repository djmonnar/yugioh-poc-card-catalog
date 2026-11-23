// (197) Recover traits "융합회수" (fusion_recover) and "의식회수" (ritual_recover): once per battle, in the trait user's own
// Main Phase with no chain, add one main-deck monster it used as Fusion (Ritual) Material from its GY or face-up banishment
// to the hand. The studio offers trait kinds from the database (capabilities.trait_form.kinds). The 197 migration appends
// these two definitions there and opens the public route poc_bootstrap197 (content_profile197); routes up to 196 stay
// frozen, so apps up to 0.18.126 never receive the new kinds. The kinds have no parameters.
// (197, 대표님 "캐릭터 공용 특성") The same migration marks the four 184 kinds and union_power shared:true as well, so
// character shared traits may carry them; the database compiles a character's shared traits into the opponent skills
// of the decks and encounters bound to it, which only route 197 publishes.
// Which editor offers what:
//  - opponent decks and chapter encounters (direct traits): every compiled kind;
//  - character shared traits: every kind the database does not mark shared:false;
//  - starter decks: exactly the kinds studio153_compile_starter_loadout accepts (STARTER_KINDS197). The app's starter
//    plan takes only these (the v4 kinds, opening_draw folded into the draw bonus, and the two recover kinds); any other
//    kind makes the app reject the whole bootstrap, so this list does not follow the shared flag.
// This module has no imports so the database preparation (WebSync197/Database/prepare197.mjs) can load it as-is.
export const CONTENT_PROFILE197=Object.freeze({schema:1,card_set:'thunder-dragon-hand197'});
export const TRAIT_KINDS197=Object.freeze([
  Object.freeze({kind:'fusion_recover',label:'융합회수',fields:Object.freeze({}),compiled:true,shared:true,
    help:'전투당 1번, 내 메인 페이즈에 융합 소재로 썼던 몬스터 1장을 묘지(또는 앞면 제외)에서 패로 가져옵니다.'}),
  Object.freeze({kind:'ritual_recover',label:'의식회수',fields:Object.freeze({}),compiled:true,shared:true,
    help:'전투당 1번, 내 메인 페이즈에 의식 소재로 썼던 몬스터 1장을 묘지(또는 앞면 제외)에서 패로 가져옵니다.'}),
]);
export const TRAIT_KIND_IDS197=Object.freeze(TRAIT_KINDS197.map(row=>row.kind));
// Kinds character shared traits may carry from 197 on (the database sets shared:true on these definitions).
export const CHARACTER_KINDS197=Object.freeze(['effect_damage_null','reflect_damage_null','first_damage_null','ouija_board','union_power',...TRAIT_KIND_IDS197]);
// Starter deck traits: what studio153_compile_starter_loadout accepts (lp_bonus is a starter LP field, not a trait).
export const STARTER_KINDS197=Object.freeze(['start_hand','start_field','start_monster','start_grave','heal_once','draw_once','add_hand_once','parasite_deck','opening_draw',...TRAIT_KIND_IDS197]);

export function traitKindOffered197(definition,shared,starter=false){
  if(!definition||typeof definition.kind!=='string')return false;
  if(starter===true)return STARTER_KINDS197.includes(definition.kind);
  if(!shared)return definition.compiled===true;
  return definition.shared!==false;
}
