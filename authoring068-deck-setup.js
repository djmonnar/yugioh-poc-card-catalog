// Decks own card composition. Each chapter-role entry owns its opponent setup.
import {deckPlacementSelection101,planDeckExclusions101} from './authoring101-deck-placements.js?v=20261110-101';
const copy=structuredClone;
const roles068=['battle','elite','boss'];
const roleNames068={battle:'일반 전투',elite:'엘리트',boss:'보스'};
const owner068=state=>state.user?.id??(state.canEdit?'editor':'public');
const roleLabel068=row=>`${row.content.chapter}장 · ${roleNames068[row.content.role]??row.content.role}`;
const entryKey068=(roleId,entryId)=>JSON.stringify([roleId,entryId]);
const normalize068=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');

export function deckPlacements068(entities,deckId){
  return entities.filter(row=>row.entity_type==='chapter_role'&&!row.deleted).sort((a,b)=>a.content.chapter-b.content.chapter||roles068.indexOf(a.content.role)-roles068.indexOf(b.content.role)).flatMap(role=>(role.content.entries??[]).filter(entry=>entry.deck_id===deckId).map(entry=>({role,entry,key:entryKey068(role.entity_id,entry.entry_id)})));
}

export function defaultDeckEncounter068(deck,characters=[]){
  const profile=characters.find(row=>row.profile_id==='yugi'&&row.art_key)??characters.find(row=>row.profile_id&&row.art_key),name=String(deck.content.deck_name??deck.content.name??'새 상대').trim()||'새 상대';
  return {name:name.slice(0,100),deck_name:name.slice(0,100),profile_id:profile?.profile_id??'yugi',art_key:profile?.art_key??'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false};
}

export function appendDeckPlacement068(role,deckId,entryId,encounter,{weight=1,entryFields={}}={}){
  const entries=role.content.entries??[],existing=entries.find(row=>row.entry_id===entryId);
  if(existing){if(existing.deck_id!==deckId)throw Error('같은 배치 번호가 이미 사용 중입니다. 새 배치를 다시 열어 주세요.');return entries;}
  if(entries.length>=100)throw Error('한 구역에는 상대를 100명까지 넣을 수 있습니다. 다른 구역을 선택해 주세요.');
  if(!entryId||!String(encounter.name??'').trim()||!String(encounter.deck_name??'').trim()||!encounter.profile_id||!encounter.art_key)throw Error('상대 이름과 캐릭터를 확인해 주세요.');
  return [...entries,{...copy(entryFields),entry_id:entryId,deck_id:deckId,weight,encounter:copy(encounter)}];
}

export function patchDeckPlacement068(role,deckId,entryId,fields){
  if(!(role.content.entries??[]).some(row=>row.entry_id===entryId&&row.deck_id===deckId))throw Error('이 배치가 변경됐습니다. 배치 목록에서 다시 선택해 주세요.');
  return role.content.entries.map(entry=>entry.entry_id===entryId&&entry.deck_id===deckId?{...entry,encounter:{...entry.encounter,...copy(fields)}}:entry);
}

export function renderDeckSetup068({host,getState,entities,getCharacters,deckId,el,button,field,patch,stageMany,renderEncounter,onNavigate,onSaveDrafts,manualSaveControl,registerSave068,filters,rerender,onBulkAssign}){
  const initial=getState(),owner=owner068(initial),memoryKey=`deck-setup068:${JSON.stringify([owner,deckId])}`,ui=filters.get(memoryKey)??{mode:'summary',selected:null,query:'',page:1,add:null,remove:null};
  const all=()=>entities(getState()),latestDeck=()=>all().find(row=>row.entity_type==='deck'&&row.entity_id===deckId&&!row.deleted),latestRole=id=>all().find(row=>row.entity_type==='chapter_role'&&row.entity_id===id&&!row.deleted),placements=()=>deckPlacements068(all(),deckId);
  const deck=latestDeck();if(!deck)return;
  const persist=()=>filters.set(memoryKey,ui),paint=(force=false)=>rerender?.({force});
  const writable=()=>{if(owner068(getState())!==owner)throw Error('로그인 계정이 바뀌었습니다. 현재 화면에서 다시 선택해 주세요.');if(!getState().canEdit)throw Error('편집 계정으로 로그인해 주세요.');if(!latestDeck())throw Error('이 덱을 찾을 수 없습니다. 덱 목록을 확인해 주세요.');};
  const latestPlacement=key=>placements().find(row=>row.key===key),selected=latestPlacement(ui.selected),list=placements();
  const root=el('section',null,'au-deck-setup068');root.setAttribute('aria-label','이 덱의 게임 배치');host.append(root);
  const heading=el('div',null,'au-deck-setup-heading068'),info=el('div'),summary=el('p',`편집 중인 배치 ${list.length}곳 · 같은 카드 구성, 각각 다른 상대 설정`,'au-hint'),toggle=button(ui.mode==='summary'?'배치 설정':'배치 설정 접기',()=>{ui.mode=ui.mode==='summary'?'list':'summary';ui.remove=null;persist();paint(true);},'au-setup-toggle068');
  info.append(el('h2','게임 배치'),summary);heading.append(info,toggle);root.append(heading,el('p','배치는 새로 시작하는 원정의 해당 장·전투에서 등장할 상대 목록에 반영됩니다.','au-hint au-setup-purpose068'));
  const chapterSummary=el('div',null,'au-setup-chapters101');chapterSummary.setAttribute('aria-label','이 덱의 장별 배치');
  for(const chapter of [...new Set(list.map(row=>row.role.content.chapter))]){
    const counts=roles068.map(kind=>{const count=list.filter(row=>row.role.content.chapter===chapter&&row.role.content.role===kind).length;return count?`${roleNames068[kind]} ${count}곳`:null;}).filter(Boolean);
    chapterSummary.append(el('p',`${chapter}장 · ${counts.join(' · ')}`));
  }
  if(!list.length)chapterSummary.append(el('p','장별 적 편성에 아직 배치되지 않은 덱입니다.','au-hint'));
  root.append(chapterSummary);
  const saveRow=el('div',null,'au-deck-setup-save068'),saveMessage=el('p',null,'au-hint'),scope={deckSetup068:deckId};
  const findInvalid=()=>root.querySelector('[aria-invalid="true"]');
  const addSession=()=>{
    writable();const session=ui.add;
    if(!session)throw Error('추가할 배치를 먼저 설정해 주세요.');
    if(session.pending)return session.pending;if(session.staged)return Promise.resolve();
    if(findInvalid())throw Error('입력한 값을 확인한 뒤 배치를 추가해 주세요.');
    const role=latestRole(session.roleId);if(!role)throw Error('추가할 장과 전투 종류를 다시 선택해 주세요.');
    const roleId=session.roleId,encounter=copy(session.encounter),weight=session.weight,entryFields=copy(session.entryFields??{});
    appendDeckPlacement068(role,deckId,session.entryId,encounter,{weight,entryFields});
    // Set the guard before calling the draft layer: one add session owns one ID.
    session.staged=true;persist();
    const pending=Promise.resolve().then(()=>{writable();const live=latestRole(roleId);if(!live)throw Error('추가할 구역이 변경됐습니다. 다시 선택해 주세요.');return patch(live,{entries:appendDeckPlacement068(live,deckId,session.entryId,encounter,{weight,entryFields})});}).then(()=>{ui.selected=entryKey068(roleId,session.entryId);ui.mode='entry';ui.remove=null;ui.add=null;persist();paint(true);},error=>{session.staged=false;persist();throw error;}).finally(()=>{session.pending=null;});
    session.pending=pending;return pending;
  };
  const hasLocal=Boolean(ui.add&&!ui.add.staged);
  const cancelLocal=()=>{if(owner068(getState())!==owner)return;if(ui.saving||ui.add?.pending)throw Error('배치 추가 또는 저장이 끝난 뒤 취소해 주세요.');ui.add=null;ui.mode='list';ui.remove=null;persist();paint(true);};
  registerSave068?.({deckId,hasLocal,prepare:async()=>{if(ui.add)await addSession();},cancel:hasLocal?cancelLocal:undefined});
  const save=button('덱과 배치 저장',()=>{
    writable();if(ui.saving)return ui.saving;
    if(findInvalid())throw Error('입력한 값을 확인한 뒤 저장해 주세요.');
    const pending=Promise.resolve().then(async()=>{if(ui.add)await addSession();return onSaveDrafts?.(scope);}).finally(()=>{ui.saving=null;persist();});ui.saving=pending;persist();return pending;
  },'au-primary');save.disabled=!getState().canEdit||!onSaveDrafts;saveRow.append(save,saveMessage);root.append(saveRow);
  if(manualSaveControl&&onSaveDrafts)manualSaveControl({...scope,localDirty068:hasLocal},save,{message:saveMessage});
  else saveMessage.textContent='카드 구성과 이 덱의 배치 설정을 함께 저장합니다.';
  const dirtyRoleIds=new Set((getState().manualDrafts060?.items??[]).filter(item=>item.type==='chapter_role'&&item.dirty).map(item=>item.id));
  const canonicalRoleIds=new Set(deckPlacements068(getState().canonicalEntities068??[],deckId).map(row=>row.role.entity_id));
  const dirty=hasLocal||list.some(row=>row.role.localDraft060||dirtyRoleIds.has(row.role.entity_id))||[...dirtyRoleIds].some(id=>canonicalRoleIds.has(id))||deck.localDraft060;
  if(dirty)summary.append(el('span',' · 저장 전 변경','au-setup-dirty068'));
  if(onBulkAssign)root.append(button('여러 구역에 배치',()=>onBulkAssign(deckId),'au-bulk-open071'));
  if(ui.mode==='summary')return;
  const availableRoles=all().filter(row=>row.entity_type==='chapter_role'&&!row.deleted).sort((a,b)=>a.content.chapter-b.content.chapter||roles068.indexOf(a.content.role)-roles068.indexOf(b.content.role));
  const tools=el('div',null,'au-setup-tools068'),startAdd=()=>{
    writable();if(ui.saving||ui.add?.pending)throw Error('배치 추가 또는 저장이 끝난 뒤 다시 선택해 주세요.');if(ui.add&&!ui.add.staged){ui.mode='add';persist();paint(true);return;}
    const target=latestPlacement(ui.selected)?.role??availableRoles.find(row=>row.content.chapter===1&&row.content.role==='battle')??availableRoles[0];
    if(!target)throw Error('장별 편성 자료를 불러온 뒤 다시 시도해 주세요.');
    ui.add={entryId:`enc-${crypto.randomUUID()}`,roleId:target.entity_id,weight:1,encounter:defaultDeckEncounter068(latestDeck(),getCharacters?.()??[]),staged:false,pending:null};ui.mode='add';ui.remove=null;persist();paint(true);
  },add=button('배치 추가',startAdd,'au-setup-add068'),back=button('배치 목록',()=>{ui.mode='list';ui.remove=null;persist();paint(true);});add.disabled=!getState().canEdit||!availableRoles.length;tools.append(back,add);root.append(tools);
  if(ui.mode==='list'||ui.mode==='entry'&&!selected){
    const search=el('input'),rows=el('div',null,'au-setup-list068'),pager=el('nav',null,'au-pagination');search.type='search';search.placeholder='장·전투 종류·상대 이름으로 찾기';search.setAttribute('aria-label','이 덱의 배치 검색');search.dataset.editKey=`${memoryKey}.query`;search.value=ui.query;root.append(search,rows,pager);
    const selection=el('div',null,'au-setup-selection101'),selectionCount=el('p',null,'au-hint'),selectionActions=el('div',null,'au-setup-selection-actions101'),removal=el('div');
    selectionCount.setAttribute('role','status');selectionCount.setAttribute('aria-live','polite');root.insertBefore(selection,rows);selection.append(selectionCount,selectionActions);root.append(removal);
    const selectedKeys=()=>Array.isArray(ui.selectedKeys101)?ui.selectedKeys101:[],selectedRows=()=>deckPlacementSelection101(all(),deckId,selectedKeys());
    const changeSelection=keys=>{writable();ui.selectedKeys101=[...new Set(keys)];ui.exclude101=null;persist();for(const input of rows.querySelectorAll('input'))input.checked=ui.selectedKeys101.includes(input.dataset.placementKey);renderSelection();};
    const matches=()=>{const query=normalize068(search.value);return placements().filter(row=>!query||normalize068(`${roleLabel068(row.role)} ${row.entry.encounter?.name??''} ${row.entry.encounter?.deck_name??''}`).includes(query));};
    const exclude=()=>{
      writable();if(ui.removing101)return ui.removing101;
      const keys=copy(ui.exclude101??[]);planDeckExclusions101({entities:all(),deckId,keys});
      if(!stageMany)throw Error('여러 배치의 초안 연결을 준비하지 못했습니다. 화면을 새로 열어 주세요.');
      const pending=Promise.resolve().then(()=>{writable();const next=planDeckExclusions101({entities:all(),deckId,keys});return stageMany(next.changes);}).then(()=>{
        ui.selectedKeys101=[];ui.exclude101=null;ui.selected=null;persist();paint(true);
      }).finally(()=>{ui.removing101=null;persist();paint(true);});ui.removing101=pending;return pending;
    };
    const renderSelection=()=>{
      const current=selectedRows(),stale=selectedKeys().length-current.length;selectionActions.replaceChildren();removal.replaceChildren();
      selectionCount.textContent=`선택 ${current.length}곳 · 이 덱의 전체 배치 ${placements().length}곳${stale?' · 바뀐 배치는 다시 선택해 주세요.':''}`;
      const selectAll=button('검색 결과 전체 선택',()=>changeSelection([...selectedKeys(),...matches().map(row=>row.key)])),clear=button('선택 해제',()=>changeSelection([]));
      selectAll.disabled=!getState().canEdit||!matches().length||Boolean(ui.removing101);clear.disabled=!getState().canEdit||!selectedKeys().length||Boolean(ui.removing101);selectionActions.append(selectAll,clear);
      if(onBulkAssign){const edit=button('선택 배치 함께 수정',()=>{writable();const keys=selectedKeys();if(!keys.length||selectedRows().length!==keys.length)throw Error('수정할 배치를 다시 선택해 주세요.');return onBulkAssign(deckId,{keys:copy(keys)});});edit.disabled=!getState().canEdit||!current.length||Boolean(stale||ui.removing101);selectionActions.append(edit);}
      const remove=button('선택 배치 제외',()=>{writable();const keys=copy(selectedKeys());planDeckExclusions101({entities:all(),deckId,keys});ui.exclude101=keys;persist();display();},'au-setup-exclude101');remove.disabled=!getState().canEdit||!current.length||!stageMany||Boolean(stale||ui.removing101);selectionActions.append(remove);
      if(!ui.exclude101)return;
      const warning=el('section',null,'au-setup-warning068 au-setup-exclusion101');warning.setAttribute('aria-label','선택 배치 제외 확인');
      let plan;try{plan=planDeckExclusions101({entities:all(),deckId,keys:ui.exclude101});}catch(error){warning.append(el('p',error.message));removal.append(warning);return;}
      const targets=deckPlacementSelection101(all(),deckId,ui.exclude101),details=el('ul');
      warning.append(el('h3',`선택한 ${plan.entryCount}곳에서 이 덱의 배치를 제외할까요?`),el('p','덱과 카드 구성은 유지됩니다. 아래 배치만 저장 전 초안에서 제외합니다.'));
      for(const row of targets.slice(0,12))details.append(el('li',`${roleLabel068(row.role)} · ${row.entry.encounter?.name||'이름 없는 상대'}`));warning.append(details);
      if(targets.length>12)warning.append(el('p',`외 ${targets.length-12}곳`));
      if(plan.emptyRoles.length)warning.append(el('p','상대가 없는 구역이 생깁니다. 다른 유효 상대를 배치하기 전까지 게임은 마지막 유효 편성을 계속 사용합니다.'));
      const confirm=button(`${plan.entryCount}곳 배치 제외`,exclude),keep=button('배치 유지',()=>{ui.exclude101=null;persist();display();});confirm.disabled=!getState().canEdit||Boolean(ui.removing101);keep.disabled=Boolean(ui.removing101);warning.append(confirm,keep);removal.append(warning);
    };
    const display=()=>{
      const query=normalize068(search.value),found=matches(),pages=Math.max(1,Math.ceil(found.length/5)),page=Math.min(ui.page??1,pages);rows.replaceChildren();pager.replaceChildren();renderSelection();
      if(!found.length)rows.append(el('p',query?'일치하는 배치가 없습니다.':'현재 편집 중인 편성에는 이 덱이 없습니다. 배치 추가에서 사용할 장과 상대를 설정하세요.','au-empty'));
      for(const row of found.slice((page-1)*5,page*5)){
        const line=el('div',null,'au-setup-row101'),checkLabel=el('label',null,'au-setup-check101'),check=el('input');check.type='checkbox';check.checked=selectedKeys().includes(row.key);check.disabled=!getState().canEdit||Boolean(ui.removing101);check.setAttribute('aria-label',`${roleLabel068(row.role)} · ${row.entry.encounter?.name||'상대'} 배치 선택`);check.dataset.placementKey=row.key;check.onchange=()=>changeSelection(check.checked?[...selectedKeys(),row.key]:selectedKeys().filter(key=>key!==row.key));checkLabel.append(check);
        const pick=button('',()=>{ui.selected=row.key;ui.mode='entry';ui.remove=null;persist();paint(true);},'au-setup-placement068'),encounter=row.entry.encounter??{},character=(getCharacters?.()??[]).find(profile=>profile.profile_id===encounter.profile_id);
        pick.dataset.entryId=row.entry.entry_id??'';pick.dataset.roleId=row.role.entity_id;pick.setAttribute('aria-pressed',String(ui.selected===row.key));pick.append(el('strong',roleLabel068(row.role)),el('span',encounter.name||'이름 없는 상대'),el('small',`${character?.profile?.name??'캐릭터 미확인'} · 직접 특성 ${(encounter.skills??[]).length}개${encounter.use_shared_skills?' · 공용 특성 사용':''}`));line.append(checkLabel,pick);rows.append(line);
      }
      if(pages>1){for(const [label,next] of [['이전',page-1],['다음',page+1]]){const b=button(label,()=>{ui.page=next;persist();display();});b.disabled=next<1||next>pages;pager.append(b);}pager.insertBefore(el('span',`${page} / ${pages} · ${found.length}곳`),pager.lastChild);}
    };
    search.oninput=()=>{ui.query=search.value;ui.page=1;persist();display();};display();return;
  }
  if(ui.mode==='add'&&ui.add){
    const session=ui.add,addKey=`${memoryKey}.add.${session.entryId}`,role=latestRole(session.roleId),editor=el('section',null,'au-setup-editor068'),title=el('h3','새 배치 설정');editor.dataset.mode='add';editor.dataset.entryId=session.entryId;editor.append(title,el('p','장과 전투 종류를 고르고 상대를 설정하세요. 같은 덱을 여러 곳에 배치할 수 있습니다.','au-hint'));
    const destinations=el('div',null,'au-setup-destination068'),chapter=role?.content.chapter??1,currentRole=role?.content.role??'battle';
    const choose=(chapter,kind)=>{writable();if(session.staged)throw Error('배치를 추가하고 있습니다. 완료 후 목록에서 수정해 주세요.');const target=availableRoles.find(row=>row.content.chapter===chapter&&row.content.role===kind);if(!target)throw Error('이 구역의 편성 자료가 없습니다. 연결을 확인해 주세요.');session.roleId=target.entity_id;persist();paint(false);};
    destinations.append(field('배치할 장',chapter,{type:'integer',enum:[1,2,3],enumNames:['1장','2장','3장']},value=>choose(value,currentRole),`${addKey}.chapter`),field('전투 종류',currentRole,{type:'string',enum:roles068,enumNames:roles068.map(role=>roleNames068[role])},value=>choose(chapter,value),`${addKey}.role`));editor.append(destinations);
    if((role?.content.entries??[]).length>=100)editor.append(el('p','이 구역은 100명이 모두 찼습니다. 다른 장이나 전투 종류를 선택해 주세요.','au-setup-warning068'));
    const draftEntry=()=>({entry_id:session.entryId,deck_id:deckId,weight:session.weight,encounter:session.encounter});
    renderEncounter(editor,draftEntry(),latestDeck(),fields=>{writable();if(session.staged)throw Error('이미 추가된 배치입니다. 배치 목록에서 수정해 주세요.');session.encounter={...session.encounter,...copy(fields)};persist();paint(false);},`${addKey}.encounter`,draftEntry);
    const actions=el('div',null,'au-setup-editor-actions068'),stage=button('이 배치 추가',addSession,'au-primary'),cancel=button('추가 취소',cancelLocal);stage.disabled=!getState().canEdit||(role?.content.entries??[]).length>=100||session.staged;cancel.disabled=Boolean(session.pending||ui.saving);actions.append(stage,cancel);editor.append(actions,el('p','추가한 배치는 아직 저장 전입니다. 덱과 배치 저장을 누르면 카드 구성과 함께 반영됩니다.','au-hint'));root.append(editor);return;
  }
  if(!selected)return;
  const id=selected.entry.entry_id,roleId=selected.role.entity_id,editor=el('section',null,'au-setup-editor068');editor.dataset.mode='entry';editor.dataset.entryId=id??'';editor.dataset.roleId=roleId;editor.append(el('h3',`${roleLabel068(selected.role)} · ${selected.entry.encounter?.name||'상대'} 설정`),el('p','이 배치의 캐릭터와 특성만 바뀝니다. 카드 구성은 이 덱을 사용하는 모든 배치가 함께 사용합니다.','au-hint'));
  const current=()=>latestPlacement(entryKey068(roleId,id));
  const change=fields=>{writable();const live=current();if(!live)throw Error('이 배치를 찾을 수 없습니다. 배치 목록에서 다시 선택해 주세요.');return patch(live.role,{entries:patchDeckPlacement068(live.role,deckId,id,fields)});};
  renderEncounter(editor,selected.entry,latestDeck(),change,`${memoryKey}.${roleId}.${id}.encounter`,()=>current()?.entry);
  editor.append(field('등장 가중치',selected.entry.weight,{type:'integer',minimum:1,maximum:10000},weight=>{writable();const live=current();if(!live)throw Error('이 배치를 찾을 수 없습니다.');return patch(live.role,{entries:live.role.content.entries.map(entry=>entry.entry_id===id?{...entry,weight}:entry)});},`${memoryKey}.${roleId}.${id}.weight`));
  const removeNow=()=>{writable();const live=current();if(!live)throw Error('이 배치를 찾을 수 없습니다.');ui.selected=null;ui.remove=null;ui.mode='list';persist();return patch(live.role,{entries:live.role.content.entries.filter(entry=>entry.entry_id!==id)});};
  const actions=el('div',null,'au-setup-editor-actions068'),remove=button('이 배치 제외',()=>{writable();ui.remove=selected.key;persist();paint(true);}),duplicate=button('이 설정으로 배치 추가',()=>{
    writable();const live=current();if(!live)throw Error('복사할 배치를 찾을 수 없습니다.');ui.add={entryId:`enc-${crypto.randomUUID()}`,roleId,weight:live.entry.weight,entryFields:copy(live.entry),encounter:copy(live.entry.encounter),staged:false,pending:null};ui.mode='add';ui.remove=null;persist();paint(true);
  });remove.disabled=!getState().canEdit;duplicate.disabled=!getState().canEdit;actions.append(button('다른 배치 보기',()=>{ui.mode='list';persist();paint(true);}),duplicate,remove);editor.append(actions);
  if(ui.remove===selected.key){
    const last=(current()?.role.content.entries??[]).length===1,warning=el('div',null,'au-setup-warning068');warning.setAttribute('role','status');warning.append(el('p',last?'이 구역의 마지막 상대입니다. 비워 저장해도 게임은 마지막 유효 편성을 계속 사용합니다. 게임 구성을 바꾸려면 다른 유효 상대를 편성해 주세요.':'이 배치만 제외합니다. 같은 덱을 사용하는 다른 배치와 카드 구성은 유지됩니다.'));
    const confirm=button(last?'마지막 상대 제외':'이 배치만 제외',removeNow);confirm.disabled=!getState().canEdit;warning.append(confirm,button('유지',()=>{ui.remove=null;persist();paint(true);}));editor.append(warning);
  }
  root.append(editor);
}
