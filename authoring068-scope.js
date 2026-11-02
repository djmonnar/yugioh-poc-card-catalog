const key=row=>JSON.stringify([row.type,row.id]);
const rows=state=>{const value=state?.entities??state?.bootstrap?.authoring?.entities??[];return value instanceof Map?[...value.values()]:value;};
const references=(content,id)=>(content?.entries??[]).some(entry=>entry.deck_id===id);

// A removed placement exists only in the canonical snapshot. Include both sides
// so its deletion is committed with the deck that the editor is saving.
export function draftScope068({scope={},items=[],state={},canonical={}}={}){
  const wanted=new Set(),add=row=>{if(row)wanted.add(key(row));};
  if(scope.deckSetup068!=null){
    const id=String(scope.deckSetup068),all=[...rows(state),...rows(canonical)];
    for(const item of items)if(item.type==='deck'&&item.id===id||item.type==='chapter_role'&&(references(item.content,id)||all.some(row=>row.entity_type==='chapter_role'&&row.entity_id===item.id&&references(row.content,id))))add(item);
  }else if(scope.keys){for(const row of scope.keys)wanted.add(key(row));}
  else for(const item of items)if(scope.id==null||item.id===String(scope.id)&&(!scope.types||scope.types.includes(item.type)))add(item);
  // A newly created deck must precede every placement that refers to it, even
  // when the user pressed Save from the chapter editor instead of the deck.
  for(const item of items.filter(row=>wanted.has(key(row))&&row.type==='chapter_role'))for(const entry of item.content?.entries??[]){const dependency=items.find(row=>row.type==='deck'&&row.operation==='create'&&row.id===entry.deck_id);add(dependency);}
  return items.filter(row=>wanted.has(key(row))).map(({type,id})=>({type,id}));
}
