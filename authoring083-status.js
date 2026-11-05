const cardKind083=type=>typeof type==='string'&&type.startsWith('card_');

export function changedCards083(summary){
  const items=summary?.items??[];
  return new Set(items.filter(item=>cardKind083(item.type)&&item.dirty!==false).map(item=>String(item.id))).size;
}

export function draftLabel083(summary){
  const count=summary?.dirtyCount??0,cards=changedCards083(summary);
  if(!count)return '';
  const others=(summary?.items??[]).filter(item=>!cardKind083(item.type)&&item.dirty!==false).length;
  return cards?`저장 전 변경 · 카드 ${cards}장${others?` · 다른 항목 ${others}개`:''}`:`저장 전 변경 ${count}개`;
}

function clock083(value){
  if(!Number.isFinite(value)||value<=0)return '';
  return new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}

export function syncDetail083(snapshot){
  const sync=snapshot?.sync083??{},parts=[];
  if(sync.checking)parts.push('최신 내용 확인 중…');
  else if(clock083(sync.checkedAt))parts.push(`최근 확인 ${clock083(sync.checkedAt)}`);
  if(clock083(sync.savedAt))parts.push(`최근 저장 ${clock083(sync.savedAt)}`);
  return parts.join(' · ');
}
