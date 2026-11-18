// Side-by-side view of a save conflict: what this editor wants to save next to
// what the DB holds now, per changed field. Display only; the existing
// "내 수정 유지 / DB 내용 사용" choices still decide what happens.

const MAX_TEXT170=240,MAX_ITEMS170=12;
const short=text=>text.length>MAX_TEXT170?`${text.slice(0,MAX_TEXT170)}…`:text;

function cardName170(ref,cards){
  const card=cards.get(Number(ref?.source_id??ref?.internal_id))??(ref?.slot!=null?[...cards.values()].find(row=>row.slot===ref.slot&&(!ref.identity_key||row.identity_key===ref.identity_key)):null);
  return card?.name_ko??(ref?.source_id!=null?`카드 ${ref.source_id}`:ref?.slot!=null?`${ref.slot}번 카드`:'카드');
}
function itemLabel170(item,cards){
  if(item==null)return '없음';
  if(typeof item!=='object')return String(item);
  if(item.source_id!=null||item.slot!=null||item.internal_id!=null)return `${cardName170(item,cards)}${Number.isSafeInteger(item.count)&&item.count>1?` ×${item.count}`:''}`;
  if(typeof item.deck_id==='string')return `${item.deck_id}${item.weight!=null?` · 가중치 ${item.weight}`:''}`;
  if(typeof item.kind==='string')return item.kind;
  if(typeof item.name==='string')return item.name;
  return short(JSON.stringify(item));
}
export function formatConflictValue170(value,{cards=new Map()}={}){
  if(value===undefined)return '값 없음';
  if(value===null)return '기본값';
  if(typeof value==='boolean')return value?'예':'아니요';
  if(typeof value==='number')return value.toLocaleString('ko-KR');
  if(typeof value==='string')return value.trim()?short(value):'(비어 있음)';
  if(Array.isArray(value)){
    if(!value.length)return '(없음)';
    const shown=value.slice(0,MAX_ITEMS170).map(item=>itemLabel170(item,cards));
    return `${shown.join(', ')}${value.length>MAX_ITEMS170?` 외 ${value.length-MAX_ITEMS170}개`:''}`;
  }
  return short(JSON.stringify(value));
}
function listDiff170(mine,db,cards){
  if(!Array.isArray(mine)||!Array.isArray(db))return null;
  const label=item=>itemLabel170(item,cards),count=rows=>{const map=new Map();for(const row of rows){const key=label(row);map.set(key,(map.get(key)??0)+1);}return map;};
  const a=count(mine),b=count(db),onlyMine=[],onlyDb=[];
  for(const [key,n] of a)if((b.get(key)??0)<n)onlyMine.push(key);
  for(const [key,n] of b)if((a.get(key)??0)<n)onlyDb.push(key);
  return onlyMine.length||onlyDb.length?{onlyMine,onlyDb}:null;
}
export function conflictRows170({fields=[],mine={},db={},labels={},cards=[]}={}){
  const index=cards instanceof Map?cards:new Map(cards.map(card=>[Number(card.source_id),card]));
  return [...new Set(fields)].map(field=>({field,label:labels[field]??field,mine:formatConflictValue170(mine?.[field],{cards:index}),db:formatConflictValue170(db?.[field],{cards:index}),diff:listDiff170(mine?.[field],db?.[field],index)}));
}
export function renderConflictTable170(doc,rows,{caption='바뀐 내용 비교'}={}){
  const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=String(text);if(cls)node.className=cls;return node;};
  const table=el('table',null,'au-conflict-table170'),head=el('tr');table.append(el('caption',caption));
  for(const text of ['항목','내 수정','현재 DB'])head.append(el('th',text));table.append(head);
  for(const row of rows){
    const tr=el('tr'),name=el('th',row.label),mine=el('td',row.mine,'au-conflict-mine170'),db=el('td',row.db,'au-conflict-db170');name.setAttribute('scope','row');
    if(row.diff){if(row.diff.onlyMine.length)mine.append(el('small',`내 수정에만: ${row.diff.onlyMine.slice(0,MAX_ITEMS170).join(', ')}`));if(row.diff.onlyDb.length)db.append(el('small',`DB에만: ${row.diff.onlyDb.slice(0,MAX_ITEMS170).join(', ')}`));}
    tr.append(name,mine,db);table.append(tr);
  }
  return table;
}
