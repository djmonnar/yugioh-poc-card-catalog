// Category membership belongs to authoring groups. Card tags remain flat,
// so showing one category in two groups never adds a second tag to a card.
import {effectiveCategoryGroupOrder056} from './authoring056-group-order.js?v=20261031-056';
const ORDER054=['덱','면역','발동','소환','지원','파괴','효과'];
const key054=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g,'');
export function groupCategories054(categories=[],selected=[],customGroups,orderIds){
  const known=new Map();
  for(const source of categories){const row=typeof source==='string'?{name:source}:source,name=row?.name;if(typeof name!=='string'||!name.trim()||known.has(name))continue;known.set(name,{name,aliases:[name,...(row.aliases??[]).filter(value=>typeof value==='string'&&value)].filter((value,index,all)=>all.indexOf(value)===index)});}
  const aliases=new Set([...known.values()].flatMap(row=>row.aliases));
  // Archived/unresolved tags remain visible and removable, never silently
  // discarded merely because they are absent from the active category list.
  for(const name of selected)if(typeof name==='string'&&name.trim()&&!aliases.has(name))known.set(name,{name,aliases:[name]});
  if(Array.isArray(customGroups)){
    const lookup=new Map();for(const row of known.values())for(const alias of row.aliases)if(!lookup.has(alias))lookup.set(alias,row);
    const assigned=new Set(),ids=new Set(),groups=[];
    for(const source of Array.isArray(orderIds)?effectiveCategoryGroupOrder056(customGroups,orderIds):customGroups){
      const group=source?.content??source,id=source?.entity_id??group?.id,name=group?.name;
      if(typeof id!=='string'||!id||ids.has(id)||typeof name!=='string'||!name.trim()||group.archived)continue;ids.add(id);
      const members=new Map();for(const reference of group.categories??[]){const row=lookup.get(reference);if(row){members.set(row.name,{...row,label:row.name});assigned.add(row.name);}}
      groups.push({key:`group:${id}`,label:name,items:[...members.values()]});
    }
    const remaining=[...known.values()].filter(row=>!assigned.has(row.name)).map(row=>({...row,label:row.name})).sort((a,b)=>a.label.localeCompare(b.label,'ko'));
    if(remaining.length)groups.push({key:'ungrouped',label:'미분류',items:remaining});return groups;
  }
  const groups=new Map();
  for(const row of known.values()){
    const split=row.name.indexOf('-'),prefix=split>0&&split<row.name.length-1?row.name.slice(0,split).trim():'',label=prefix||'기타',item={...row,label:prefix?row.name.slice(split+1):row.name};
    if(!groups.has(label))groups.set(label,{key:label,label,items:[]});groups.get(label).items.push(item);
  }
  return [...groups.values()].sort((a,b)=>{const ai=ORDER054.indexOf(a.label),bi=ORDER054.indexOf(b.label);return (ai<0?ORDER054.length:ai)-(bi<0?ORDER054.length:bi)||a.label.localeCompare(b.label,'ko');}).map(group=>({...group,items:group.items.sort((a,b)=>a.label.localeCompare(b.label,'ko'))}));
}

export function categoryMatcher054(categories=[]){
  const rows=groupCategories054(categories).flatMap(group=>group.items),names=new Map(rows.map(row=>[row.name,row.name]));
  for(const row of rows)for(const alias of row.aliases)if(!names.has(alias))names.set(alias,row.name);
  return (tags=[],selected=[])=>{const known=new Set(tags.map(tag=>names.get(tag)??tag));return selected.every(tag=>known.has(names.get(tag)??tag));};
}

export function createCategoryPicker054({document:doc=globalThis.document,categories=[],groups:customGroups,groupOrder,selected=[],onChange=()=>{},onError=()=>{},memory={},editKey='categories',mode='edit',bindControl=()=>{}}={}){
  const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=String(text);if(cls)node.className=cls;return node;};
  const root=el('div',null,'au-category-picker054');root.dataset.mode=mode;
  const search=el('input');search.type='search';search.placeholder='카테고리 찾기';search.setAttribute('aria-label',mode==='filter'?'카테고리 필터 검색':'카테고리 검색');search.dataset.editKey=`${editKey}.search`;search.value=memory.query??'';bindControl(search);
  const help=el('p',mode==='filter'?'선택한 카테고리를 모두 포함한 카드를 찾습니다.':'묶음을 펼쳐 선택하세요. 같은 카테고리는 어느 묶음에서 골라도 함께 선택됩니다.','au-category-help054');
  const selectedHead=el('p',null,'au-category-selected-heading054'),selectedList=el('div',null,'au-category-selected054'),groupsRoot=el('div',null,'au-category-groups054'),empty=el('p','일치하는 카테고리가 없습니다.','au-category-empty054');
  selectedHead.setAttribute('role','status');selectedHead.setAttribute('aria-live','polite');selectedList.setAttribute('aria-label','선택한 카테고리');root.append(help,search,selectedHead,selectedList,groupsRoot,empty);
  let values=new Set(selected),groups=groupCategories054(categories,selected,customGroups,groupOrder),controls=[],generation=0;
  if(!(memory.open instanceof Set))memory.open=new Set();
  const checked=row=>row.aliases.some(alias=>values.has(alias));
  function notify(before){
    const ticket=++generation;
    try{Promise.resolve(onChange([...values])).catch(error=>{if(ticket===generation){values=before;sync();}onError(error);});}
    catch(error){values=before;sync();onError(error);}
  }
  function toggle(row,on){const before=new Set(values);for(const alias of row.aliases)values.delete(alias);if(on)values.add(row.name);sync();notify(before);}
  function sync(){
    const selectedRows=[...new Map(groups.flatMap(group=>group.items).filter(checked).map(row=>[row.name,row])).values()];selectedHead.textContent=selectedRows.length?`선택한 카테고리 ${selectedRows.length}개`:'선택한 카테고리 없음';selectedList.replaceChildren();
    for(const row of selectedRows){const remove=el('button',`${row.name} ×`);remove.type='button';remove.setAttribute('aria-label',`${row.name} 선택 해제`);remove.onclick=()=>{toggle(row,false);const target=search.isConnected!==false?search:[...doc.querySelectorAll('[data-edit-key]')].find(node=>node.dataset.editKey===search.dataset.editKey);target?.focus({preventScroll:true});};selectedList.append(remove);}
    selectedList.hidden=selectedRows.length===0;
    for(const row of controls){row.input.checked=checked(row.item);}
    for(const group of groups){const summary=[...groupsRoot.querySelectorAll('summary')].find(node=>node.dataset.group===group.key);if(summary){const count=group.items.filter(checked).length;summary.querySelector('small').textContent=count?`${count}개 선택 · ${group.items.length}개`:`${group.items.length}개`;}}
  }
  function renderGroups(){
    groupsRoot.replaceChildren();controls=[];const query=key054(search.value);let matches=0;
    for(const group of groups){
      const groupMatches=query&&key054(group.label).includes(query),found=group.items.filter(row=>!query||groupMatches||key054(row.name).includes(query));if(!found.length&&(query&&!groupMatches||group.items.length))continue;matches++;
      const details=el('details',null,'au-category-group054'),summary=el('summary'),label=el('span',group.label),count=el('small');summary.dataset.group=group.key;summary.append(label,count);details.append(summary);details.open=query.length>0||memory.open.has(group.key);
      const searchExpanded=query.length>0;details.ontoggle=()=>{if(!searchExpanded){if(details.open)memory.open.add(group.key);else memory.open.delete(group.key);}};
      const options=el('div',null,'au-category-options054');
      for(const item of found){const wrap=el('label',null,'au-category-option054'),input=el('input');input.type='checkbox';input.checked=checked(item);input.setAttribute('aria-label',item.name);input.dataset.editKey=`${editKey}.tag.${group.key}.${item.name}`;input.onchange=()=>toggle(item,input.checked);bindControl(input);const name=el('span',item.label);name.title=item.name;wrap.append(input,name);options.append(wrap);controls.push({input,item});}
      if(!found.length)options.append(el('p','아직 포함된 카테고리가 없습니다.','au-category-empty054'));
      details.append(options);groupsRoot.append(details);
    }
    empty.hidden=matches>0;sync();
  }
  const searchChanged=()=>{memory.query=search.value;renderGroups();};search.oninput=searchChanged;search.oncompositionend=searchChanged;search.onsearch=searchChanged;
  function setSelected(next){values=new Set(next);const merged=groupCategories054(categories,next,customGroups,groupOrder);if(JSON.stringify(merged)!==JSON.stringify(groups)){groups=merged;renderGroups();}else sync();}
  renderGroups();
  return {root,setSelected,selected:()=>[...values]};
}
