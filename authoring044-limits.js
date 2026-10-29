// Display the resolved DB rules. An inherited (null) editor override is not a rule.
const own = (value,key) => value != null && Object.prototype.hasOwnProperty.call(value,key);
const valid = value => Number.isSafeInteger(value) && value >= 0 && value <= 3;
const family = card => {
  if(card?.alias||card?.code)return `code:${card.alias||card.code}`;
  const id=card?.source_id??card?.internal_id;
  return Number.isSafeInteger(id)&&id>=0?`source:${id}`:null;
};
const badge = (label,kind,title,rule,limit) => ({label,kind,title,rule,limit});

function individualNormalLimit(card) {
  if(valid(card?.deck_limit))return card.deck_limit;
  if(own(card,'normal_limit')){
    const value=card.normal_limit===null?card.frozen_normal_limit:card.normal_limit;
    if(valid(value))return value;
  }
  return valid(card?.maxCopies)?card.maxCopies:undefined;
}

function resolvedNormalLimit(card,cards) {
  if(valid(card?.effective_normal_limit))return card.effective_normal_limit;
  const key=family(card),related=key==null?[]:cards.filter(row=>family(row)===key);
  const legacy=card?.speed_limit!==0&&valid(card?.effective_copy_limit)?card.effective_copy_limit:undefined;
  const values=[legacy,individualNormalLimit(card),...related.map(individualNormalLimit)].filter(valid);
  if(values.length)return Math.min(...values);
  // Older normalized cards have this field, but speed-forbidden cards replace it
  // with zero. Never describe that speed-only ban as a general prohibition.
  return undefined;
}

/**
 * @param {object} card A normalized DB catalog card (not a nullable editor form).
 * @param {{includeUnrestricted?:boolean,cards?:Array<object>}} options
 * @returns {Array<{label:string,kind:string,title:string,rule:string,limit:number|null}>}
 */
export function cardLimitBadges044(card,{includeUnrestricted=false,cards=[]}={}) {
  const result=[],normal=resolvedNormalLimit(card,Array.isArray(cards)?cards:[]);
  if(normal===0)result.push(badge('금지','forbidden','일반 카드 제한: 덱에 넣을 수 없습니다. 같은 이름의 카드와 합산합니다.','normal',0));
  else if(normal===1)result.push(badge('제한','limited','일반 카드 제한: 같은 이름의 카드를 메인·엑스트라 덱 합계 1장까지 넣을 수 있습니다.','normal',1));
  else if(normal===2)result.push(badge('준제한','semilimited','일반 카드 제한: 같은 이름의 카드를 메인·엑스트라 덱 합계 2장까지 넣을 수 있습니다.','normal',2));
  else if(normal===3&&includeUnrestricted)result.push(badge('일반 제한 없음','unrestricted','일반 카드 제한: 같은 이름의 카드를 메인·엑스트라 덱 합계 3장까지 넣을 수 있습니다.','normal',3));
  else if(normal===undefined)result.push(badge('일반 제한 확인 필요','unknown','일반 카드 제한 정보를 확인할 수 없습니다. DB 자료를 다시 불러와 주세요.','normal',null));

  const speed=card?.speed_limit;
  if(speed===0)result.push(badge('스피드 금지','forbidden','스피드 듀얼에서는 덱에 넣을 수 없습니다.','speed',0));
  else if(valid(speed))result.push(badge(`스피드 제한 ${speed}`,'speed-limited',`스피드 듀얼: 제한 ${speed}에 속한 모든 카드의 매수를 메인·엑스트라 덱에서 합산해 ${speed}장까지 넣을 수 있습니다.`,'speed',speed));
  else if((speed===null||speed===-1)&&includeUnrestricted)result.push(badge('스피드 제한 없음','unrestricted','스피드 듀얼의 제한 1·2·3 그룹에 속하지 않습니다. 일반 카드 제한은 별도로 적용됩니다.','speed',null));
  else if(speed!==null&&speed!==-1)result.push(badge('스피드 제한 확인 필요','unknown','스피드 듀얼 제한 정보를 확인할 수 없습니다. DB 자료를 다시 불러와 주세요.','speed',null));
  return result;
}
