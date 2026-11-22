// (184) Opponent traits 184: effect damage null, reflect damage null, first damage null and the Ouija board.
// The studio offers trait kinds from the database (capabilities.trait_form.kinds). The 184 migration appends
// these four definitions there and opens the public route poc_bootstrap184 (content_profile184); routes up to
// 183 stay frozen, so apps up to 0.18.119 never receive the new kinds. The kinds have no parameters and belong
// to opponent decks and chapter encounters only (shared:false): character shared traits and starter-deck
// traits keep rejecting them in the database, and the shared editors here do not offer them.
// This module has no imports so the database preparation (WebSync184/Database/prepare184.mjs) can load it as-is.
export const CONTENT_PROFILE184=Object.freeze({schema:1,trait_set:'damage-ouija184'});
export const TRAIT_KINDS184=Object.freeze([
  Object.freeze({kind:'effect_damage_null',label:'효과 데미지 무효',fields:Object.freeze({}),compiled:true,shared:false,
    help:'이 상대가 받는 효과 데미지를 모두 0으로 만듭니다. 전투 데미지는 그대로 받습니다.'}),
  Object.freeze({kind:'reflect_damage_null',label:'반사 데미지 무효',fields:Object.freeze({}),compiled:true,shared:false,
    help:'이 상대에게 되돌아온 데미지를 0으로 만듭니다. 이 상대의 몬스터가 이긴 전투에서 반사된 전투 데미지(아마조네스의 검사 등)와, 매직 실린더처럼 이 상대의 공격·효과를 되돌린 데미지가 해당합니다.'}),
  Object.freeze({kind:'first_damage_null',label:'첫 데미지 무효',fields:Object.freeze({}),compiled:true,shared:false,
    help:'듀얼에서 이 상대가 처음 받는 데미지 1번(전투·효과)을 0으로 만듭니다. 다른 데미지 무효 특성이 먼저 막은 데미지는 세지 않습니다.'}),
  Object.freeze({kind:'ouija_board',label:'위저보드 (다크 네크로피어)',fields:Object.freeze({}),compiled:true,shared:false,
    help:'이 상대의 몬스터 존에 앞면 표시 다크 네크로피어가 처음 나온 뒤, 이 상대의 스탠바이 페이즈마다 F·I·N·A·L을 한 글자씩 놓고 다섯 번째 글자에서 이 상대가 승리합니다. 다크 네크로피어가 없으면 멈추고 놓은 글자는 남습니다. 덱에 다크 네크로피어를 넣어 주세요.'}),
]);
export const TRAIT_KIND_IDS184=Object.freeze(TRAIT_KINDS184.map(row=>row.kind));
// Dark Necrofear (code 31829185) wakes the Ouija board; the trait does not add the card to the deck.
export const NECROFEAR_CODE184=31829185;

// Which database trait definitions an editor offers. Opponent decks and chapter encounters (direct traits)
// take every compiled kind; character shared traits and starter-deck traits take every kind except the ones
// marked shared:false (the four 184 kinds).
export function traitKindOffered184(definition,shared){
  if(!definition||typeof definition.kind!=='string')return false;
  return shared?definition.shared!==false:definition.compiled===true;
}

// Help text under a trait: the database definition wins; the four 184 kinds keep their built-in copy.
export function traitHelp184(definition){
  if(typeof definition?.help==='string'&&definition.help.trim())return definition.help;
  return TRAIT_KINDS184.find(row=>row.kind===definition?.kind)?.help??'';
}

// A deck with the Ouija board but no Dark Necrofear can never reveal a letter. The studio shows a note (not an error).
export function ouijaWithoutNecrofear184(skills,cards,main=[]){
  if(!(skills??[]).some(row=>row?.kind==='ouija_board'))return false;
  const codes=new Map((cards??[]).map(card=>[card.source_id,card.code]));
  return !(main??[]).some(entry=>codes.get(entry?.source_id??entry?.sourceId)===NECROFEAR_CODE184);
}
