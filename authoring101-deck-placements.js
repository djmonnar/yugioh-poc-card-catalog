// Placement keys contain both identities; a shared deck or entry ID is not a selection.
const roleOrder101=['battle','elite','boss'];
const placementKey101=(roleId,entryId)=>JSON.stringify([roleId,entryId]);
const selectionKeys101=keys=>Array.isArray(keys)||keys instanceof Set?[...new Set(keys)]:[];
const liveRoles101=entities=>(Array.isArray(entities)?entities:[])
  .filter(row=>row?.entity_type==='chapter_role'&&!row.deleted)
  .sort((a,b)=>a.content?.chapter-b.content?.chapter||roleOrder101.indexOf(a.content?.role)-roleOrder101.indexOf(b.content?.role));
const entries101=role=>Array.isArray(role.content?.entries)?role.content.entries:[];
const validId101=id=>typeof id==='string'&&id.length>0;

/**
 * Read live placements in chapter/role order, retaining their actual role/entry references.
 * keys accepts an Array or Set of JSON.stringify([roleId, entryId]) strings. Duplicate
 * strings select once; missing, malformed and other-deck keys are ignored for UI pruning.
 */
export function deckPlacementSelection101(entities,deckId,keys){
  if(!validId101(deckId))return [];
  const wanted=new Set(selectionKeys101(keys));
  return liveRoles101(entities).flatMap(role=>entries101(role)
    .filter(entry=>entry?.deck_id===deckId)
    .map(entry=>({role,entry,key:placementKey101(role.entity_id,entry.entry_id)}))
    .filter(row=>wanted.has(row.key)));
}

/**
 * Strict, all-or-nothing draft plan. Every unique key must resolve to exactly one live
 * placement for deckId. Changes/keys follow chapter/role order; emptyRoles contains the
 * IDs of changed roles with no entries left, including entries belonging to other decks.
 * Only entries are patched. Returned entry data is detached from the immutable input.
 */
export function planDeckExclusions101({entities,deckId,keys}={}){
  const selectedKeys=selectionKeys101(keys);
  if(!selectedKeys.length)throw Error('제외할 배치를 먼저 선택해 주세요.');
  if(!Array.isArray(entities)||!validId101(deckId))throw Error('배치 자료를 확인할 수 없습니다. 자료를 다시 불러온 뒤 선택해 주세요.');
  const roles=liveRoles101(entities),roleCounts=new Map(),matches=new Map();
  for(const role of roles)roleCounts.set(role.entity_id,(roleCounts.get(role.entity_id)??0)+1);
  for(const row of deckPlacementSelection101(entities,deckId,selectedKeys)){
    const rows=matches.get(row.key)??[];rows.push(row);matches.set(row.key,rows);
  }
  const selectedByRole=new Map();
  // Validate every selection before constructing any change, including stale later keys.
  for(const key of selectedKeys){
    const rows=matches.get(key);
    if(typeof key!=='string'||!rows?.length)throw Error('이 배치가 변경됐습니다. 배치 목록에서 다시 선택해 주세요.');
    const {role,entry}=rows[0];
    if(rows.length!==1||roleCounts.get(role.entity_id)!==1)throw Error('같은 배치 번호가 여러 항목에 있어 제외할 수 없습니다. 배치 목록을 확인해 주세요.');
    if(!validId101(role.entity_id)||!validId101(entry.entry_id))throw Error('배치 번호를 확인할 수 없습니다. 배치 목록에서 다시 선택해 주세요.');
    const ids=selectedByRole.get(role.entity_id)??new Set();ids.add(entry.entry_id);selectedByRole.set(role.entity_id,ids);
  }
  const changes=[],emptyRoles=[];
  for(const role of roles){
    const ids=selectedByRole.get(role.entity_id);if(!ids)continue;
    const entries=structuredClone(entries101(role).filter(entry=>!(ids.has(entry?.entry_id)&&entry?.deck_id===deckId)));
    changes.push({type:'chapter_role',id:role.entity_id,fields:{entries}});
    if(!entries.length)emptyRoles.push(role.entity_id);
  }
  return {changes,keys:changes.map(({type,id})=>({type,id})),entryCount:selectedKeys.length,emptyRoles};
}
