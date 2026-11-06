// Selection refers to encounter placements, never their shared deck identity.
export const placementId095=entry=>typeof entry?.entry_id==='string'&&entry.entry_id.length>0?entry.entry_id:null;
export function selectedPlacements095(entries,selected){
  const wanted=new Set(selected);return [...new Set(entries.map(placementId095).filter(id=>id!==null&&wanted.has(id)))];
}
export function excludePlacements095(entries,selected){
  const ids=new Set(selectedPlacements095(entries,selected));
  if(!ids.size)throw Error('제외할 상대를 다시 선택해 주세요.');
  return entries.filter(entry=>!ids.has(placementId095(entry)));
}
