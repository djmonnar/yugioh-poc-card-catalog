const content056=row=>row?.content??row;
const id056=row=>row?.entity_id??row?.id;
const same056=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// The saved list may be partial. New groups get a deterministic place, while
// archived groups keep their slot so restoring one does not shuffle the list.
export function effectiveCategoryGroupOrder056(groups=[],orderIds=[]){
  const known=new Map();for(const row of groups){const id=id056(row);if(typeof id==='string'&&id&&!row?.deleted&&!known.has(id))known.set(id,row);}
  const rows=[],seen=new Set();for(const id of orderIds??[])if(known.has(id)&&!seen.has(id)){seen.add(id);rows.push(known.get(id));}
  rows.push(...[...known.values()].filter(row=>!seen.has(id056(row))).sort((a,b)=>String(content056(a)?.name??'').localeCompare(String(content056(b)?.name??''),'ko')||id056(a).localeCompare(id056(b))));return rows;
}
export const categoryGroupOrderIds056=(groups,orderIds)=>effectiveCategoryGroupOrder056(groups,orderIds).map(id056);
export function moveCategoryGroup056(groups,orderIds,source,target,after=false){
  const rows=effectiveCategoryGroupOrder056(groups,orderIds),active=rows.filter(row=>!content056(row).archived).map(id056),all=rows.map(id056);
  if(source===target||!active.includes(source)||!active.includes(target))return all;
  active.splice(active.indexOf(source),1);active.splice(active.indexOf(target)+(after?1:0),0,source);
  const activeSet=new Set(active);let index=0;return all.map(id=>activeSet.has(id)?active[index++]:id);
}

export function createCategoryGroupOrderEditor056({document:doc=globalThis.document,getState,onSave,onError=()=>{}}={}){
  let owner,root=null,host=null,opened=false,draft=null,drag=null;
  const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=String(text);if(cls)node.className=cls;return node;};
  const current=()=>{const state=getState();if(owner!==state.owner){owner=state.owner;draft=null;drag=null;opened=false;}return state;};
  const rowOf=state=>state.order;
  const idsOf=state=>categoryGroupOrderIds056(state.groups,rowOf(state)?.content?.group_ids??[]);
  const makeDraft=state=>({ids:idsOf(state),savedIds:idsOf(state),baseVersion:rowOf(state)?.version??0,dirty:false,busy:false,error:'',notice:'',ticket:0,forceSave:false});
  const redraw=()=>{if(host?.isConnected!==false)render(host);};
  function render(nextHost){
    host=nextHost;const state=current();if(!state.order&&!state.canOrderWrite){root?.remove();root=null;return null;}
    if(drag){draft.ids=drag.startIds;draft.dirty=drag.startDirty;drag=null;}
    if(!draft)draft=makeDraft(state);
    const write=state.writeState,isOwn=head=>head?.entityType==='category_group_order'&&head.entityId==='main';
    if(draft.busy&&isOwn(write)&&write.rejected&&write.phase==='invalid'){
      draft.busy=false;draft.dirty=true;draft.forceSave=true;draft.ticket++;draft.error=state.error??'순서를 저장하지 못했습니다. 확인한 뒤 다시 저장해 주세요.';
    }
    if(!draft.dirty&&!draft.busy&&rowOf(state)?.version!==draft.baseVersion)draft=makeDraft(state);
    draft.ids=categoryGroupOrderIds056(state.groups,draft.ids);
    const canWrite=state.canEdit===true&&state.canOrderWrite===true,previous=root,focus=doc.activeElement?.dataset?.editKey;
    const section=el('details',null,'au-group-order056'),summary=el('summary','묶음 순서');section.open=opened;section.ontoggle=()=>{opened=section.open;};section.append(summary,el('p','손잡이를 끌어 순서를 바꾸세요. 위·아래 버튼이나 손잡이에 초점을 둔 뒤 방향키로도 옮길 수 있습니다.','au-hint'));
    const list=el('ol',null,'au-group-order-list056');list.setAttribute('aria-label','카테고리 묶음 순서');section.append(list);
    const rows=new Map(),handles=new Map(),upButtons=new Map(),downButtons=new Map();
    const live=el('p',null,'au-group-order-live056');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
    const error=el('p',null,'au-group-error055');error.setAttribute('role','alert');const status=el('p',null,'au-group-status055');status.setAttribute('role','status');
    const actions=el('div',null,'au-group-actions055');
    const button=(label,fn)=>{const node=el('button',label);node.type='button';node.onclick=()=>{try{Promise.resolve(fn()).catch(onError);}catch(failure){onError(failure);}};return node;};
    const activeIds=()=>effectiveCategoryGroupOrder056(current().groups,draft.ids).filter(row=>!content056(row).archived).map(id056);
    const conflicted=()=>rowOf(current())?.version!==draft.baseVersion;
    const locked=()=>{const now=current(),head=now.writeState,refused=isOwn(head)&&head.phase==='invalid'&&head.rejected;return !canWrite||draft.busy||Boolean(rowOf(now)?.pending)&&!refused;};
    function announce(id){const ids=activeIds(),row=current().groups.find(row=>id056(row)===id);live.textContent=`${content056(row)?.name??'묶음'} · ${ids.indexOf(id)+1}번째로 이동했습니다.`;}
    function showOrder(){
      // Keep the dragged node attached: reparenting it during touch/native
      // drag can drop pointer capture or cancel the browser's drag session.
      const ids=activeIds();for(const [index,id] of ids.entries()){const row=rows.get(id);if(row){row.style.order=String(index);if(!drag)list.append(row);row.querySelector('.au-group-order-position056').textContent=String(index+1);}}
      update();
    }
    function apply(next,id){if(locked())return;draft.ids=next;draft.dirty=draft.forceSave||!same056(next,draft.savedIds);draft.error='';draft.notice='';showOrder();announce(id);}
    function move(id,target,after){apply(moveCategoryGroup056(current().groups,draft.ids,id,target,after),id);}
    function step(id,delta){if(locked()||drag)return;const ids=activeIds(),index=ids.indexOf(id),target=ids[index+delta];if(target){move(id,target,delta>0);handles.get(id)?.focus({preventScroll:true});}}
    function finish(accepted){
      if(!drag)return;const moving=drag;drag=null;if(!accepted){draft.ids=moving.startIds;draft.dirty=moving.startDirty;}
      for(const [id,row] of rows){row.classList.remove('is-dragging');handles.get(id)?.setAttribute('aria-pressed','false');}showOrder();if(accepted)announce(moving.id);
    }
    function begin(id,kind,pointerId){if(locked())return false;drag={id,kind,pointerId,startIds:[...draft.ids],startDirty:draft.dirty};rows.get(id)?.classList.add('is-dragging');handles.get(id)?.setAttribute('aria-pressed','true');update();return true;}
    function moveAt(clientY){
      if(!drag||!Number.isFinite(clientY))return;const area=list.getBoundingClientRect?.();
      if(area&&area.height>0){if(clientY<area.top+28)list.scrollTop=Math.max(0,(list.scrollTop??0)-22);else if(clientY>area.bottom-28)list.scrollTop=(list.scrollTop??0)+22;}
      const visible=activeIds().map(id=>({id,rect:rows.get(id)?.getBoundingClientRect?.()})).filter(row=>row.rect&&row.rect.height>0);
      if(!visible.length)return;const target=visible.find(row=>clientY<row.rect.bottom)??visible.at(-1);if(target.id!==drag.id)move(drag.id,target.id,clientY>=target.rect.top+target.rect.height/2);
    }
    for(const row of effectiveCategoryGroupOrder056(state.groups,draft.ids).filter(row=>!content056(row).archived)){
      const id=id056(row),value=content056(row),item=el('li',null,'au-group-order-row056');item.dataset.orderGroupId=id;
      const grip=button('',()=>{});grip.className='au-group-order-grip056';grip.draggable=true;grip.dataset.editKey=`category-order056.${id}.grip`;grip.setAttribute('aria-label',`${value.name} 순서 이동`);grip.setAttribute('aria-pressed','false');grip.title='드래그하거나 방향키로 이동';
      const svg=doc.createElementNS?doc.createElementNS('http://www.w3.org/2000/svg','svg'):doc.createElement('svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('aria-hidden','true');
      for(const x of [8,16])for(const y of [5,12,19]){const dot=doc.createElementNS?doc.createElementNS('http://www.w3.org/2000/svg','circle'):doc.createElement('circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','1.6');dot.setAttribute('fill','currentColor');svg.append(dot);}grip.append(svg);
      const label=el('div',null,'au-group-order-label056'),position=el('span',null,'au-group-order-position056');position.setAttribute('aria-hidden','true');label.append(el('strong',value.name),el('small',`카테고리 ${(value.categories??[]).length}개`));
      const up=button('위',()=>step(id,-1)),down=button('아래',()=>step(id,1));up.setAttribute('aria-label',`${value.name} 위로 이동`);down.setAttribute('aria-label',`${value.name} 아래로 이동`);up.className=down.className='au-group-order-step056';
      grip.onkeydown=event=>{if(event.key==='Escape'&&drag){event.preventDefault();finish(false);}else if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();step(id,event.key==='ArrowUp'?-1:1);}};
      grip.ondragstart=event=>{if(drag?.kind==='pointer'||!begin(id,'html')){event.preventDefault();return;}event.dataTransfer?.setData('application/x-yugioh-category-group-order',id);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';};
      grip.ondragend=()=>finish(false);
      grip.onpointerdown=event=>{if(event.button!=null&&event.button!==0||event.isPrimary===false||!begin(id,'pointer',event.pointerId))return;event.preventDefault();grip.focus({preventScroll:true});grip.setPointerCapture?.(event.pointerId);};
      grip.onpointermove=event=>{if(drag?.kind==='pointer'&&drag.pointerId===event.pointerId){event.preventDefault();moveAt(event.clientY);}};
      grip.onpointerup=event=>{if(drag?.kind==='pointer'&&drag.pointerId===event.pointerId){event.preventDefault();moveAt(event.clientY);finish(true);grip.releasePointerCapture?.(event.pointerId);}};
      grip.onpointercancel=event=>{if(drag?.kind==='pointer'&&drag.pointerId===event.pointerId)finish(false);};grip.onlostpointercapture=()=>{if(drag?.kind==='pointer')finish(false);};
      item.append(grip,position,label,up,down);rows.set(id,item);handles.set(id,grip);upButtons.set(id,up);downButtons.set(id,down);
    }
    list.ondragover=event=>{if(drag?.kind==='html'){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';moveAt(event.clientY);}};
    list.ondrop=event=>{if(drag?.kind==='html'){event.preventDefault();moveAt(event.clientY);finish(true);}};
    const save=button('순서 저장',async()=>{
      const now=current();if(locked()||drag||!draft.dirty)return;if(conflicted()){draft.error='다른 창에서 묶음 순서를 바꿨습니다. 최신 순서를 불러온 뒤 다시 조정해 주세요.';update();return;}
      const ticket=++draft.ticket,requestOwner=owner;draft.busy=true;draft.error='';draft.notice='';update();
      try{const result=await onSave('category_group_order','main',{group_ids:categoryGroupOrderIds056(now.groups,draft.ids)},{operation:'patch'});if(current().owner!==requestOwner||ticket!==draft.ticket)return;draft.busy=false;
        if(result?.discarded){draft=makeDraft(current());draft.notice='대기하던 순서 변경을 취소했습니다.';}else{draft=makeDraft(current());draft.notice='묶음 순서를 저장했습니다.';}redraw();
      }catch(failure){if(current().owner!==requestOwner||ticket!==draft.ticket)return;draft.busy=false;draft.error=failure.message??'순서를 저장하지 못했습니다. 다시 시도해 주세요.';update();onError(failure);}
    });save.className='au-primary';save.dataset.editKey='category-order056.save';
    const cancel=button('순서 변경 취소',()=>{if(locked()||drag||rowOf(current())?.pending)return;draft=makeDraft(current());redraw();});
    const reload=button('최신 순서 불러오기',()=>{if(locked()||drag)return;draft=makeDraft(current());redraw();});
    actions.append(save,cancel,reload);section.append(error,actions,status,live);
    function update(){
      const now=current(),head=now.writeState,isLocked=locked(),ids=activeIds(),otherBlocked=['invalid','conflict'].includes(head?.phase)&&!isOwn(head),pending=Boolean(rowOf(now)?.pending),refused=isOwn(head)&&head.rejected&&head.phase==='invalid',uncertain=now.phase==='error'&&(draft.busy||pending),conflict=now.phase==='conflict'&&(draft.busy||pending);
      for(const [index,id] of ids.entries()){handles.get(id).disabled=isLocked;handles.get(id).draggable=!isLocked;upButtons.get(id).disabled=isLocked||Boolean(drag)||index===0;downButtons.get(id).disabled=isLocked||Boolean(drag)||index===ids.length-1;}
      save.disabled=isLocked||Boolean(drag)||otherBlocked||!draft.dirty;cancel.disabled=isLocked||Boolean(drag)||pending||!draft.dirty;reload.hidden=!conflicted()||pending;reload.disabled=isLocked||Boolean(drag);
      error.textContent=draft.error||(conflict?'다른 창의 수정과 겹쳤습니다. 화면 위의 충돌 알림에서 처리 방법을 선택해 주세요.':uncertain?'저장 결과를 확인하는 중입니다. 연결이 돌아오면 같은 요청으로 다시 확인합니다.':otherBlocked?'먼저 저장 대기 중인 다른 항목의 오류를 해결해 주세요.':'');error.hidden=!error.textContent;
      status.textContent=!canWrite?(now.canEdit?'순서 편집 기능을 불러오지 못했습니다. 화면을 새로고침해 주세요.':'묶음 순서를 바꾸려면 편집 계정으로 로그인해 주세요.'):uncertain?'연결을 기다리는 중…':conflict?'충돌 처리 대기 중…':refused?'순서를 확인한 뒤 순서 저장을 다시 눌러 주세요.':draft.busy||pending?'묶음 순서를 저장하는 중…':draft.dirty?'순서를 바꾼 뒤 순서 저장을 눌러 주세요.':draft.notice||'저장된 순서입니다.';
    }
    if(!rows.size)list.append(el('li','표시할 묶음이 없습니다. 묶음을 만들면 여기서 순서를 바꿀 수 있습니다.','au-hint'));
    showOrder();if(previous?.parentNode===host){host.insertBefore(section,previous);previous.remove();}else host.append(section);root=section;
    if(focus){const target=[...section.querySelectorAll('[data-edit-key]')].find(node=>node.dataset.editKey===focus);target?.focus({preventScroll:true});}return section;
  }
  return {render};
}
