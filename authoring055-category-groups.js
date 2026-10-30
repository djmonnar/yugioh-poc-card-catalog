const folded055=value=>String(value??'').trim().toLocaleLowerCase('ko').replace(/\s+/g,' ');
const content055=row=>row?.content??row;
const unique055=values=>[...new Set(values??[])];

// Drafts live only while this editor is open. The store's normal intent queue
// owns persistence, version checks and recovery; this is not a second database.
export function createCategoryGroupManager055({document:doc=globalThis.document,getState,onSave,onError=()=>{},bindControl=()=>{},newId=()=>`category-group-${globalThis.crypto.randomUUID()}`}={}){
  const drafts=new Map();let owner=null,selected='new',open=false,currentRoot=null,currentHost=null;
  const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=String(text);if(cls)node.className=cls;return node;};
  const stateNow=()=>{const state=getState();if(owner!==state.owner){owner=state.owner;drafts.clear();selected='new';open=false;}return state;};
  const makeDraft=row=>({name:content055(row)?.name??'',categories:unique055(content055(row)?.categories),baseVersion:row?.version??0,dirty:false,busy:false,error:'',query:''});
  const rowsOf=state=>(state.groups??[]).filter(row=>row&&!row.deleted);
  const find=(state,id)=>rowsOf(state).find(row=>row.entity_id===id);
  function draftFor(state,id){const row=id==='new'?null:find(state,id);let draft=drafts.get(id);if(!draft){draft=makeDraft(row);drafts.set(id,draft);}else if(row&&!draft.dirty&&!draft.busy&&row.version!==draft.baseVersion){const query=draft.query;Object.assign(draft,makeDraft(row),{query});}return draft;}
  function redraw(){if(currentHost?.isConnected!==false)render(currentHost);}
  function render(host){
    currentHost=host;const state=stateNow(),write=state.writeState;
    // A typed refusal leaves the store promise open so the same queued intent
    // can be corrected. Network uncertainty must keep its original request.
    for(const draft of drafts.values())if(draft.busy&&write?.entityType==='category_group'&&write.entityId===draft.requestEntityId&&write.rejected&&write.phase==='invalid'){
      draft.busy=false;draft.ticket=(draft.ticket??0)+1;draft.serverRejected=true;draft.error=state.error??'묶음을 저장하지 못했습니다. 내용을 확인한 뒤 다시 저장해 주세요.';if(draft.pendingKind==='save')draft.dirty=true;
    }
    const rows=rowsOf(state),active=rows.filter(row=>!content055(row).archived||row.pending&&row.entity_id===selected),archived=rows.filter(row=>content055(row).archived&&!active.includes(row));
    if(selected!=='new'&&!active.some(row=>row.entity_id===selected))selected=active[0]?.entity_id??'new';
    const row=selected==='new'?null:find(state,selected),draft=draftFor(state,selected),canWrite=state.canEdit===true&&state.canWrite!==false;
    const previous=currentRoot,focus=doc.activeElement?.dataset?.editKey,selection=focus&&typeof doc.activeElement.selectionStart==='number'?[doc.activeElement.selectionStart,doc.activeElement.selectionEnd]:null;
    const root=el('details',null,'au-category-manager055'),summary=el('summary','카테고리 묶음 관리');root.open=open;root.ontoggle=()=>{open=root.open;};root.append(summary);
    root.append(el('p','묶음 이름과 포함할 카테고리를 정하세요. 같은 카테고리를 여러 묶음에 넣을 수 있습니다.','au-hint'));
    if(!canWrite)root.append(el('p',state.canEdit?'묶음 편집 기능을 불러오지 못했습니다. 화면을 새로고침해 주세요.':'묶음을 편집하려면 편집 계정으로 로그인해 주세요.','au-hint'));
    const tools=el('div',null,'au-group-tools055'),selectLabel=el('label',null,'au-field'),select=el('select');select.setAttribute('aria-label','편집할 카테고리 묶음');select.dataset.editKey='category-groups055.select';
    const newOption=el('option','새 묶음 만들기');newOption.value='new';select.append(newOption);for(const item of active){const option=el('option',content055(item).name);option.value=item.entity_id;select.append(option);}select.value=selected;
    select.onchange=()=>{selected=select.value;open=true;redraw();};bindControl(select);selectLabel.append(el('span','편집할 묶음'),select);tools.append(selectLabel);
    const button=(label,fn,key)=>{const node=el('button',label);node.type='button';if(key)node.dataset.editKey=key;node.onclick=()=>{try{Promise.resolve(fn()).catch(onError);}catch(error){onError(error);}};return node;};
    const newButton=button('새 묶음',()=>{selected='new';open=true;redraw();},'category-groups055.new');newButton.disabled=!canWrite||draft.busy||rows.length>=64;tools.append(newButton);root.append(tools);
    const form=el('div',null,'au-group-form055'),nameLabel=el('label',null,'au-field'),name=el('input');name.type='text';name.maxLength=40;name.value=draft.name;name.placeholder='예: 공격 보조';name.setAttribute('aria-label','묶음 이름');name.dataset.editKey=`category-groups055.${selected}.name`;bindControl(name);nameLabel.append(el('span','묶음 이름'),name);form.append(nameLabel);
    const search=el('input');search.type='search';search.value=draft.query;search.placeholder='포함할 카테고리 찾기';search.setAttribute('aria-label','묶음에 넣을 카테고리 검색');search.dataset.editKey=`category-groups055.${selected}.search`;bindControl(search);form.append(search);
    const count=el('p',null,'au-group-member-count055'),choices=el('div',null,'au-group-member-list055'),preserved=el('div',null,'au-group-preserved055');choices.setAttribute('role','group');choices.setAttribute('aria-label','묶음에 넣을 카테고리');form.append(count,choices,preserved);
    const error=el('p',null,'au-group-error055'),status=el('p',null,'au-group-status055'),actions=el('div',null,'au-group-actions055');error.setAttribute('role','alert');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const currentRow=()=>selected==='new'?null:find(stateNow(),selected),conflicted=()=>{const latest=currentRow();return Boolean(row&&latest&&latest.version!==draft.baseVersion&&!draft.busy);};
    const save=button(row?'변경 사항 저장':'묶음 만들기',async()=>{
      const latestState=stateNow(),latest=currentRow();if(latestState.canEdit!==true||latestState.canWrite===false||draft.busy)return;
      if(conflicted()){draft.error='다른 창에서 이 묶음을 수정했습니다. 최신 내용을 불러온 뒤 다시 편집해 주세요.';updateStatus();return;}
      const nextName=name.value.trim(),signature=folded055(nextName);
      if(!nextName||nextName.length>40||/[\u0000-\u001f\u007f]/.test(nextName)){draft.error='묶음 이름은 1~40자로 입력해 주세요.';updateStatus();return;}
      const ownId=row?.entity_id??draft.id??selected;
      if(rowsOf(latestState).some(item=>item.entity_id!==ownId&&folded055(content055(item).name)===signature)){draft.error='같은 이름의 묶음이 있습니다. 다른 이름을 입력해 주세요.';updateStatus();return;}
      if(!row&&rowsOf(latestState).length>=64){draft.error='묶음은 보관한 항목을 포함해 64개까지 만들 수 있습니다.';updateStatus();return;}
      const activeNames=new Set((latestState.categories??[]).filter(item=>!item.archived).map(item=>item.name)),existing=new Set(content055(latest)?.categories??[]);
      if(draft.categories.some(category=>!activeNames.has(category)&&!existing.has(category))){draft.error='보관되거나 이름이 바뀐 카테고리가 있습니다. 최신 내용을 불러온 뒤 다시 선택해 주세요.';updateStatus();return;}
      const id=row?.entity_id??(draft.id??=newId()),requestOwner=owner,ticket=(draft.ticket??0)+1,rejected=latestState.writeState?.entityType==='category_group'&&latestState.writeState.entityId===id&&latestState.writeState.rejected;
      draft.name=nextName;draft.busy=true;draft.error='';draft.ticket=ticket;draft.requestEntityId=id;draft.pendingKind='save';draft.serverRejected=false;updateStatus();
      try{const result=await onSave('category_group',id,{name:nextName,categories:unique055(draft.categories),archived:false},{operation:row||rejected?'patch':'create'});if(stateNow().owner!==requestOwner||ticket!==draft.ticket)return;draft.busy=false;if(result?.discarded){draft.dirty=true;draft.error='대기하던 변경을 취소했습니다. DB 내용을 확인한 뒤 다시 저장할 수 있습니다.';draft.baseVersion=find(stateNow(),id)?.version??0;redraw();return;}draft.dirty=false;draft.baseVersion=find(stateNow(),id)?.version??draft.baseVersion+1;if(!row){drafts.delete('new');drafts.set(id,draft);selected=id;}redraw();}
      catch(failure){if(stateNow().owner!==requestOwner||ticket!==draft.ticket)return;draft.busy=false;draft.error=failure.message??'묶음을 저장하지 못했습니다. 연결을 확인한 뒤 다시 저장해 주세요.';updateStatus();onError(failure);}
    },`category-groups055.${selected}.save`);save.className='au-primary';actions.append(save);
    const reset=button('편집 취소',()=>{drafts.set(selected,makeDraft(currentRow()));redraw();});actions.append(reset);
    const reload=button('최신 내용 불러오기',()=>{drafts.set(selected,makeDraft(currentRow()));redraw();});actions.append(reload);
    const archive=button('묶음 보관',()=>archiveChange(row,true));if(row)actions.append(archive);
    const retryFailed=button('저장 요청 다시 시도',()=>{const action=draft.pendingAction;if(action)return archiveChange(action.row,action.archived);});actions.append(retryFailed);
    function updateStatus(){
      const now=stateNow(),head=now.writeState,formId=row?.entity_id??draft.id,refused=head?.phase==='invalid'&&head.rejected===true,sameHead=head?.entityType==='category_group'&&head.entityId===formId,transportPending=Boolean(currentRow()?.pending)&&!(refused&&sameHead),headBlocked=['invalid','conflict'].includes(head?.phase)&&!sameHead;
      const locked=!canWrite||draft.busy||transportPending;name.disabled=locked;search.disabled=locked;select.disabled=draft.busy||transportPending;save.disabled=locked||headBlocked||Boolean(row&&!draft.dirty)||(!row&&rows.length>=64);reset.disabled=locked||!draft.dirty||Boolean(currentRow()?.pending);newButton.disabled=locked||rows.length>=64;archive.disabled=locked||draft.dirty||headBlocked;archive.title=draft.dirty?'변경 사항을 저장하거나 취소한 뒤 보관해 주세요.':'';reload.hidden=!conflicted()||Boolean(currentRow()?.pending);reload.disabled=locked;
      retryFailed.hidden=!draft.serverRejected||!draft.pendingAction||draft.pendingKind==='save';retryFailed.disabled=!canWrite||draft.busy;
      const uncertain=now.phase==='error'&&(draft.busy||transportPending),conflict=now.phase==='conflict'&&(draft.busy||transportPending);error.textContent=draft.error||(conflict?'다른 창의 수정과 겹쳤습니다. 화면 위의 충돌 알림에서 처리 방법을 선택해 주세요.':uncertain?'저장 결과를 확인하지 못했습니다. 연결이 돌아오면 같은 요청으로 다시 확인합니다.':headBlocked?'먼저 저장 대기 중인 다른 항목의 오류를 해결해 주세요.':'');error.hidden=!error.textContent;
      status.textContent=uncertain?'연결을 기다리는 중…':conflict?'충돌 처리 대기 중…':draft.busy||transportPending?'묶음을 DB에 저장하는 중…':draft.dirty?'저장하지 않은 변경 사항이 있습니다.':row?'DB에 저장됨':'이름과 카테고리를 정한 뒤 묶음을 만드세요.';for(const input of choices.querySelectorAll('input'))input.disabled=locked;count.textContent=`포함한 카테고리 ${draft.categories.length}개`;
    }
    function changed(){draft.name=name.value;draft.dirty=true;draft.error='';updateStatus();}
    function renderMembers(){
      choices.replaceChildren();preserved.replaceChildren();const query=folded055(search.value).replace(/\s/g,''),activeCategories=(state.categories??[]).filter(item=>!item.archived),known=new Set(activeCategories.map(item=>item.name));
      for(const category of activeCategories){if(query&&!folded055(category.name).replace(/\s/g,'').includes(query))continue;const label=el('label',null,'au-category-option054'),input=el('input');input.type='checkbox';input.checked=draft.categories.includes(category.name);input.setAttribute('aria-label',`묶음에 포함: ${category.name}`);input.dataset.editKey=`category-groups055.${selected}.member.${category.name}`;input.onchange=()=>{draft.categories=input.checked?unique055([...draft.categories,category.name]):draft.categories.filter(item=>item!==category.name);changed();};bindControl(input);label.append(input,el('span',category.name));choices.append(label);}
      if(!choices.children.length)choices.append(el('p','검색에 맞는 카테고리가 없습니다.','au-hint'));
      const saved=draft.categories.filter(item=>!known.has(item));if(saved.length){preserved.append(el('p','보관한 카테고리 · 기존 연결 유지','au-hint'));for(const category of saved){const remove=button(`${category} 제외`,()=>{draft.categories=draft.categories.filter(item=>item!==category);changed();renderMembers();search.focus({preventScroll:true});});remove.disabled=!canWrite||draft.busy;preserved.append(remove);}}
      updateStatus();
    }
    async function archiveChange(item,archivedValue){const latestState=stateNow();if(!item||latestState.canEdit!==true||latestState.canWrite===false||draft.busy)return;const requestOwner=owner,ticket=(draft.ticket??0)+1;draft.busy=true;draft.error='';draft.ticket=ticket;draft.requestEntityId=item.entity_id;draft.pendingKind=archivedValue?'archive':'restore';draft.pendingAction={row:item,archived:archivedValue};draft.serverRejected=false;updateStatus();try{const result=await onSave('category_group',item.entity_id,{archived:archivedValue},{operation:'patch'});if(stateNow().owner!==requestOwner||ticket!==draft.ticket)return;draft.busy=false;if(result?.discarded){draft.error='대기하던 변경을 취소했습니다.';redraw();return;}drafts.delete(item.entity_id);if(archivedValue&&selected===item.entity_id)selected='new';redraw();}catch(failure){if(stateNow().owner!==requestOwner||ticket!==draft.ticket)return;draft.busy=false;draft.error=failure.message;updateStatus();onError(failure);}}
    name.oninput=changed;name.oncompositionend=changed;search.oninput=()=>{draft.query=search.value;renderMembers();};search.oncompositionend=search.oninput;search.onsearch=search.oninput;
    form.append(error,actions,status);root.append(form);if(rows.length>=64)root.append(el('p','묶음은 보관한 항목을 포함해 64개까지 만들 수 있습니다.','au-hint'));
    if(archived.length){const archiveList=el('details',null,'au-group-archive055');archiveList.append(el('summary',`보관한 묶음 · ${archived.length}개`),el('p','묶음을 보관해도 카테고리와 카드의 분류는 유지됩니다.','au-hint'));for(const item of archived){const restore=button(`${content055(item).name} 복원`,()=>archiveChange(item,false));restore.disabled=!canWrite||draft.busy;archiveList.append(restore);}root.append(archiveList);}
    renderMembers();if(previous?.parentNode===host){host.insertBefore(root,previous);previous.remove();}else host.append(root);currentRoot=root;
    if(focus){const target=[...root.querySelectorAll('[data-edit-key]')].find(node=>node.dataset.editKey===focus);if(target){target.focus({preventScroll:true});if(selection&&target.setSelectionRange)try{target.setSelectionRange(...selection);}catch{}}}
    return root;
  }
  return {render};
}
