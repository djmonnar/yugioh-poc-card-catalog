// Trait choices follow the registered native card metadata used by the game.
// Display labels and the date a card was added do not determine eligibility.
const source=card=>card?.source_id??card?.sourceId??card?.internal_id;
const slot=card=>card?.web_slot??card?.slot;
const nativeType=card=>card?.native_type??card?.nativeType035??card?.native?.type??card?.type;
const extraOrToken=0x40|0x2000|0x800000|0x4000000|0x4000;

export function traitCardMatches089(card,filter=''){
  const type=nativeType(card),id=source(card);
  if(!card||card.special||card.token||card.playable===false||!Number.isSafeInteger(id)||id<0||
    !Number.isSafeInteger(type)||!(type&7)||(type&extraOrToken)!==0)return false;
  const kind=String(filter??'');
  if(kind.endsWith('-spell-trap'))return Boolean(type&6);
  if(kind.endsWith('-monster'))return Boolean(type&1);
  return true;
}

export function sharedTraitRefMatches089(card,ref){
  return traitCardMatches089(card)&&Number.isSafeInteger(slot(card))&&slot(card)>0&&
    ref?.slot===slot(card)&&ref.internal_id===source(card)&&
    typeof card.identity_key==='string'&&/^[0-9a-f]{64}$/.test(card.identity_key)&&
    ref.identity_key===card.identity_key;
}
