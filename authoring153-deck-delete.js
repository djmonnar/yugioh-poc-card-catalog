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
  function matches(){const query=normalized(search.value);return rows.filter(row=>!query||row.search.includes(query));}
  function available(){const blocks=getBlocks();return matches().filter(row=>!blocks.has(row.id));}
  function paint(review){
    reviewing=review;
    list.replaceChildren();
    notice.textContent='';
    search.hidden=review;choices.hidden=review;close.hidden=review;back.hidden=!review;
    title.textContent=review?'선택한 덱을 삭제할까요?':'덱 삭제';
    submit.textContent=review?`${picked.size}개 삭제`:'선택 확인';
    submit.classList.toggle('au-delete-submit153',review);
    submit.disabled=picked.size===0;
    count.textContent=review?'삭제하면 웹 덱 목록에서 사라집니다.':`${picked.size}개 선택 · 한 번에 최대 ${MAX_DECKS}개`;
    const blocks=getBlocks(),shown=review?rows.filter(row=>picked.has(row.id)):matches();
    for(const [index,row] of shown.entries()){
      const reasons=blocks.get(row.id),selected=picked.has(row.id);
      const line=el(review?'div':'label',null,'au-deck-delete-row153'),info=el('span',null,'au-deck-delete-info153');
      info.append(el('strong',row.title));
      if(row.detail)info.append(el('small',row.detail));
      if(reasons?.size)info.append(el('small',`삭제할 수 없음 · ${[...reasons].join(', ')}`));
      if(!review){
        const check=el('input');check.type='checkbox';check.checked=selected;
        check.disabled=Boolean(reasons?.size)||!selected&&picked.size===MAX_DECKS;
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
