export const SPELL_TRAP_SUBTYPES = {
  '마법': ['일반','장착','필드','지속','속공','의식'],
  '함정': ['일반','카운터','지속'],
};
export function subtypeMatches(card, value) {
  return !value || value === `${card.type}:${card.subtype}`;
}
export function fillSubtypeFilter(select, type = '') {
  const previous=select.value,doc=select.ownerDocument;
  const all=doc.createElement('option');all.value='';all.textContent='모든 세부 종류';select.replaceChildren(all);
  for(const [kind,subtypes] of Object.entries(SPELL_TRAP_SUBTYPES)) {
    if(type&&type!==kind)continue;
    const group=doc.createElement('optgroup');group.label=kind;
    for(const subtype of subtypes){const option=doc.createElement('option');option.value=`${kind}:${subtype}`;option.textContent=`${kind} · ${subtype}`;group.append(option);}
    select.append(group);
  }
  select.disabled=Boolean(type&&!Object.hasOwn(SPELL_TRAP_SUBTYPES,type));
  select.value=[...select.options].some(o=>o.value===previous)?previous:'';
}
