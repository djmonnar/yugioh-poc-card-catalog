const MAX_DECKS = 32;
const normalized = value => value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
const roleName = {battle:'일반 전투',elite:'엘리트',boss:'보스'};

export function deckDeletionBlocks153(rows,drafts=[]){
  const blocks=new Map();
  function add(id,reason){
    if(!id)return;
    if(!blocks.has(id))blocks.set(id,new Set());
    blocks.get(id).add(reason);
  }
  for(const row of rows){
    if(row.deleted||!['chapter_role','starter_list'].includes(row.entity_type))continue;
    const label=row.entity_type==='starter_list'?'시작 덱':`${row.content.chapter}장 ${roleName[row.content.role]??'편성'}`;
    for(const entry of row.content.entries??[])add(entry.deck_id,label);
  }
  for(const row of drafts)if(row.type==='deck')add(row.id,'저장 전 변경 있음');
  return blocks;
}

export function deckDeletionChanges153(choices,rows,drafts=[]){
  if(!choices.length||choices.length>MAX_DECKS||new Set(choices.map(row=>row.id)).size!==choices.length)
    throw Error('삭제할 덱을 1~32개 선택해 주세요.');
  const blocks=deckDeletionBlocks153(rows,drafts);
  const decks=new Map(rows.filter(row=>row.entity_type==='deck'&&!row.deleted).map(row=>[row.entity_id,row]));
  return choices.map(choice=>{
    const live=decks.get(choice.id);
    if(!live||live.version!==choice.version)throw Error('선택한 덱의 DB 내용이 바뀌었습니다. 덱을 다시 선택해 주세요.');
    const reasons=blocks.get(choice.id);
    if(reasons?.size)throw Error(`‘${choice.title}’ 덱을 삭제할 수 없습니다. ${[...reasons].join(', ')}을 확인해 주세요.`);
    return {type:'deck',id:choice.id,operation:'delete',fields:{},baseVersion:choice.version};
  });
}

// (174) 대표님 제보 2026-11-20: 편성에 들어 있거나 저장 전 변경이 있는 덱은 체크할 수 없었고, 이유만 작게 보였다.
// DB는 편성이 쓰는 덱의 삭제를 거부하므로 순서를 지킨다: 저장 전 덱 변경 취소 → 편성에서 빼는 저장 → 덱 삭제.
// 시작 덱 목록, 그 덱만 남은 편성, 저장 전 변경이 있는 편성은 여기서 고치지 않고 이유와 고칠 곳을 보인다.
const draftOf174=(drafts,type,id)=>(drafts??[]).some(row=>row.type===type&&row.id===id);
const roleLabel174=row=>`${row.content.chapter}장 ${roleName[row.content.role]??'편성'}`;
export function deckDeletionPlan174(rows,drafts=[]){
  const plans=new Map();
  const plan=id=>{if(!plans.has(id))plans.set(id,{hard:new Set(),fix:new Set(),pools:[],draft:false});return plans.get(id);};
  for(const row of rows){
    if(row.deleted||!['chapter_role','starter_list'].includes(row.entity_type))continue;
    const entries=row.content?.entries??[];
    for(const id of new Set(entries.map(entry=>entry.deck_id).filter(Boolean))){
      const p=plan(id);
      if(row.entity_type==='starter_list'){p.hard.add('시작 덱 목록에서 먼저 빼 주세요');continue;}
      const label=roleLabel174(row);
      if(draftOf174(drafts,'chapter_role',row.entity_id))p.hard.add(`${label} 편성에 저장 전 변경이 있어요. 먼저 저장하거나 취소해 주세요`);
      else if(entries.every(entry=>entry.deck_id===id))p.hard.add(`${label}의 유일한 상대예요. 다른 상대를 먼저 넣어 주세요`);
      else if(!p.pools.some(pool=>pool.entity_id===row.entity_id)){p.pools.push(row);p.fix.add(`${label} 편성에서 빠져요`);}
    }
  }
  for(const row of drafts??[])if(row.type==='deck'){const p=plan(row.id);p.draft=true;p.fix.add('저장 전 변경은 취소돼요');}
  return plans;
}
// 선택한 덱을 지우기 위한 순서: 취소할 덱 초안, 편성 저장(한 번에), 그다음 덱 삭제(deckDeletionChanges153으로 다시 확인).
export function deckDeletionSteps174(choices,rows,drafts=[]){
  if(!choices.length||choices.length>MAX_DECKS||new Set(choices.map(row=>row.id)).size!==choices.length)
    throw Error('삭제할 덱을 1~32개 선택해 주세요.');
  const plans=deckDeletionPlan174(rows,drafts),chosen=new Set(choices.map(row=>row.id)),pools=new Map(),draftKeys=[];
  for(const choice of choices){
    const p=plans.get(choice.id);
    if(p?.hard.size)throw Error(`‘${choice.title}’ 덱을 삭제할 수 없습니다. ${[...p.hard].join(', ')}.`);
    if(p?.draft)draftKeys.push({type:'deck',id:choice.id});
    for(const row of p?.pools??[])pools.set(row.entity_id,row);
  }
  const poolPatches=[...pools.values()].map(row=>{
    const entries=(row.content.entries??[]).filter(entry=>!chosen.has(entry.deck_id));
    if(!entries.length)throw Error(`${roleLabel174(row)}의 상대가 모두 빠지게 돼요. 다른 상대를 먼저 넣어 주세요.`);
    return {type:'chapter_role',id:row.entity_id,operation:'patch',fields:{entries},baseVersion:row.version,baseContent:structuredClone(row.content)};
  });
  return {draftKeys,poolPatches};
}

export function openDeckDeletion153({document:doc,el,button,rows,getBlocks,onDelete,trigger}){
  const picked=new Set(),dialog=el('dialog',null,'au-deck-delete153'),body=el('div',null,'au-deck-delete-body153');
  const title=el('h2','덱 삭제'),search=el('input'),list=el('div',null,'au-deck-delete-list153'),notice=el('p',null,'au-field-error');
  const choices=el('div',null,'au-deck-delete-tools153'),count=el('p',null,'au-hint'),actions=el('div',null,'au-deck-delete-actions153');
  const back=button('이전으로',()=>paint(false)),close=button('취소',()=>dialog.close());
  const all=button('검색 결과 선택',()=>{for(const row of available())if(picked.size<MAX_DECKS)picked.add(row.id);paint(false);});
  const clear=button('선택 해제',()=>{picked.clear();paint(false);});
  let reviewing=false;
  const submit=button('선택 확인',()=>{
    if(!reviewing){paint(true);return;}
    const chosen=rows.filter(row=>picked.has(row.id));
    let request;
    try{request=onDelete(chosen);}
    catch(error){notice.textContent=error.message;return;}
    dialog.close();
    return request;
  });
  // getBlocks는 id -> 막는 이유 Set(153) 또는 id -> {hard, fix}(174)를 돌려준다. 막는 이유가 있을 때만 체크를 막는다.
  const planOf=(blocks,id)=>{const value=blocks.get(id);return value instanceof Set?{hard:value,fix:new Set()}:value??{hard:new Set(),fix:new Set()};};
  function matches(){const query=normalized(search.value);return rows.filter(row=>!query||row.search.includes(query));}
  // 한꺼번에 고르기는 아무것도 함께 바뀌지 않는 덱만. 편성에서 빠지거나 초안이 취소되는 덱은 하나씩 직접 고른다.
  function available(){const blocks=getBlocks();return matches().filter(row=>{const p=planOf(blocks,row.id);return !p.hard.size&&!p.fix.size;});}
  function paint(review){
    reviewing=review;
    list.replaceChildren();
    notice.textContent='';
    search.hidden=review;choices.hidden=review;close.hidden=review;back.hidden=!review;
    title.textContent=review?'선택한 덱을 삭제할까요?':'덱 삭제';
    submit.textContent=review?`${picked.size}개 삭제`:'선택 확인';
    submit.classList.toggle('au-delete-submit153',review);
    submit.disabled=picked.size===0;
    const blocks=getBlocks(),shown=review?rows.filter(row=>picked.has(row.id)):matches();
    const withFixes=[...picked].some(id=>planOf(blocks,id).fix.size);
    count.textContent=review?(withFixes?'편성에서 먼저 빼고 삭제합니다. 삭제하면 웹 덱 목록에서 사라집니다.':'삭제하면 웹 덱 목록에서 사라집니다.'):`${picked.size}개 선택 · 한 번에 최대 ${MAX_DECKS}개`;
    for(const [index,row] of shown.entries()){
      const {hard,fix}=planOf(blocks,row.id),selected=picked.has(row.id);
      const line=el(review?'div':'label',null,'au-deck-delete-row153'),info=el('span',null,'au-deck-delete-info153');
      info.append(el('strong',row.title));
      if(row.detail)info.append(el('small',row.detail));
      if(hard.size)info.append(el('small',`삭제할 수 없음 · ${[...hard].join(' · ')}`,'au-deck-delete-hard174'));
      else if(fix.size)info.append(el('small',`삭제하면 · ${[...fix].join(' · ')}`,'au-deck-delete-fix174'));
      if(!review){
        const check=el('input');check.type='checkbox';check.checked=selected;
        check.disabled=Boolean(hard.size)||!selected&&picked.size===MAX_DECKS;
        check.onchange=()=>{
          if(check.checked)picked.add(row.id);else picked.delete(row.id);
          const scroll=list.scrollTop;
          paint(false);
          list.scrollTop=scroll;
          list.querySelector(`[data-checkbox-index="${index}"]`)?.focus?.({preventScroll:true});
        };
        check.setAttribute('data-checkbox-index',String(index));
        line.append(check);
      }
      line.append(info);list.append(line);
    }
    if(!shown.length)list.append(el('p','일치하는 덱이 없습니다.','au-hint'));
    all.disabled=picked.size===MAX_DECKS||!available().some(row=>!picked.has(row.id));
    clear.disabled=picked.size===0;
    if(review)back.focus?.();
  }
  title.id='au-deck-delete-title153';
  dialog.setAttribute('aria-labelledby',title.id);search.type='search';
  search.placeholder='관리용 제목·덱 이름으로 찾기';search.setAttribute('aria-label','삭제할 덱 검색');
  search.oninput=event=>{if(!event.isComposing)paint(false);};
  search.addEventListener('compositionend',()=>paint(false));
  count.setAttribute('role','status');notice.setAttribute('role','alert');
  choices.append(all,clear);actions.append(close,back,submit);
  body.append(title,search,choices,list,count,notice,actions);dialog.append(body);doc.body.append(dialog);
  dialog.onclose=()=>{dialog.remove();trigger?.focus?.();};
  paint(false);dialog.showModal();search.focus?.();
  return dialog;
}
