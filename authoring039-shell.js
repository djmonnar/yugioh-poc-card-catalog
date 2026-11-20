import {AUTHORING_SECTIONS039,createAuthoringPanels039,entities039,normalizeCatalog039} from './authoring039-panels.js?v=20261110-101';
import {createAuthoringDrafts060} from './authoring060-drafts.js?v=20261103-071';
import {completeCharacterTraits065} from './authoring065-errors.js?v=20261101-065';
import {authoringFieldNames066,validateAuthoringChange066} from './authoring066-validation.js?v=20261101-066';
import {draftScope068} from './authoring068-scope.js?v=20261103-071';
import {draftLabel083,syncDetail083} from './authoring083-status.js?v=20261105-083';
import {deckManagementTitle041} from './authoring041-decks.js?v=20261028-043';
import {editableControl041} from './authoring041-editing.js?v=20261031-060';
import {CATALOG_PARAMS170,readCatalogParams170,writeCatalogParams170} from './authoring170-catalog.js';
import {conflictRows170,renderConflictTable170} from './authoring170-conflict.js';
import {createUndoStack170} from './authoring170-drafts.js';

const MANUAL_KINDS060=['card_display','card_setting','card_annotation','card_limit','deck','chapter_role','starter_list','character','relic','event','shop_rules','meta_pack','meta_score'];
const TYPE_NAMES060={card_display:'카드 정보',card_setting:'카드 등급·보상',card_annotation:'카드 카테고리·관련 카드',card_limit:'카드 제한',category:'카테고리',category_group:'카테고리 묶음',category_group_order:'묶음 순서',deck:'덱',chapter_role:'장별 적 편성',starter_list:'시작 덱',character:'캐릭터',relic:'유물',event:'이벤트',shop_rules:'상점',map_rules:'맵 분포',meta_pack:'카드팩',meta_score:'점수·보상',recovery_archive:'이전 자료'};
const FIELD_NAMES060={name:'이름',deck_name:'덱 이름',name_english:'영문 이름',description:'설명',rarity:'등급',stock:'상점 판매',draw_enabled:'전투 보상',tags:'카테고리',links:'관련 카드',normal_limit:'일반 제한',speed_limit:'스피드 제한',main:'메인 덱',extra:'엑스트라 덱',banlist_enabled:'카드 제한 적용',entries:'편성',skills:'특성',profile:'프로필',lp_bonus:'추가 LP',opening_draw_bonus:'시작 패',categories:'포함 카테고리',group_ids:'묶음 순서'};
Object.assign(FIELD_NAMES060,{portrait:'캐릭터 이미지',skill_profiles:'특성 묶음',shared_character_id:'공용 특성 연결',shared_skill_profile_id:'공용 특성 묶음'});
Object.assign(FIELD_NAMES060,authoringFieldNames066);
export function writeSubject060(snapshot,{type,id,fields=[]}={}){
  const row=(snapshot.entities??[]).find(e=>e.entity_type===type&&e.entity_id===id),content=row?.content;
  const card=type?.startsWith('card_')?normalizeCatalog039(snapshot).find(c=>String(c.source_id)===String(id)):null;
  const name=type==='chapter_role'&&content?`${content.chapter}장 · ${{battle:'일반 전투',elite:'엘리트',boss:'보스'}[content.role]??content.role}`:type==='deck'&&content?deckManagementTitle041(content):card?.name_ko??content?.name??content?.profile?.name;
  return {title:[TYPE_NAMES060[type]??'편집 항목',typeof name==='string'?name:''].filter(Boolean).join(' · '),fields:[...new Set(fields.map(f=>FIELD_NAMES060[f]??'편집 내용'))].join(', ')};
}

export function route039(url){const parsed=url instanceof URL?url:new URL(url,'https://example.invalid/'),section=parsed.searchParams.get('section');return {section:AUTHORING_SECTIONS039.some(([key])=>key===section)?section:'cards',deck:parsed.searchParams.get('deck'),card:/^#card-(\d+)$/.exec(parsed.hash)?.[1]??null};}
export function saveLabel039(snapshot){if(snapshot.phase==='loading'||!snapshot.bootstrap)return '자료를 불러오는 중…';if(snapshot.phase==='conflict')return '저장 기준 확인 필요';if((snapshot.phase==='invalid'||snapshot.localValidation066))return '입력 확인 필요';if(snapshot.error)return '연결 확인 필요';if(snapshot.pending>0||snapshot.phase==='saving')return '저장 중…';if(snapshot.manualDrafts060?.dirtyCount)return draftLabel083(snapshot.manualDrafts060);return snapshot.canEdit?'저장됨':'열람 중';}

export function mountAuthoringShell039({root,store,uploadAsset=null,manualSave=false,draftStorage=null,manualKinds=MANUAL_KINDS060,draftBackup170=null,history170=null,preview170=false,document:doc=globalThis.document,window:win=globalThis.window}={}){
  if(!root||!store)throw Error('제작 화면을 준비하지 못했습니다.');
  const el=(tag,value,cls)=>{const n=doc.createElement(tag);if(value!=null)n.textContent=String(value);if(cls)n.className=cls;return n;};
  const button=(label,fn,cls='')=>{const b=el('button',label,cls);b.type='button';b.onclick=()=>{try{Promise.resolve(fn()).catch(notify);}catch(e){notify(e);}};return b;};
  const undo170=createUndoStack170(),restoreDismissed170=new Set();
  let state=store.snapshot(),route=route039(win.location.href),toastTimer,lastCardHash='',lastContentSignature='',forceRenderNext=true,destroyed060=false,draftRenderQueued060=false,latestSnapshot060=state,localIssue066=null,localDeckSetup068=null,reloadBusy083=false;
  function savePatch066(...args){
    try{return store.patch(...args);}
    catch(error){
      if(error.authoringIssue066){localIssue066={...error.authoringIssue066,owner:state.user?.id??null};queueMicrotask(()=>{if(!destroyed060)render(latestSnapshot060);});}
      throw error;
    }
  }
  function saveBatch068(changes){
    try{return store.patchTogether068(changes);}
    catch(error){if(error.authoringIssue066){localIssue066={...error.authoringIssue066,owner:state.user?.id??null};queueMicrotask(()=>{if(!destroyed060)render(latestSnapshot060);});}throw error;}
  }
  function renderNotice066(){
    const local=state.error?null:localIssue066;
    if(!state.error&&!local)return;
    notice.hidden=false;
    const invalid=state.phase==='invalid'||Boolean(local),head=local?{...local,validation:{fields:local.fields,message:local.message}}:state.writeState;
    if(head?.batch068&&head.changes?.every(change=>change.operation==='delete')){
      notice.append(el('strong',state.phase==='conflict'?'덱을 다시 확인해 주세요.':'덱을 삭제하지 못했습니다.'));
      for(const change of head.changes)notice.append(el('p',writeSubject060(state,change).title,'au-write-subject060'));
      notice.append(el('p',state.error?.message??state.error));
      if(state.phase==='conflict')notice.append(button('삭제 요청 취소',()=>store.resolveConflict('remote')));
      else if(head.rejected)notice.append(button('삭제 요청 취소',()=>store.releaseRejectedBatch068({batchId:head.batchId})));
      else notice.append(button('다시 연결',()=>store.retry()));
      return;
    }
    notice.append(el('strong',state.phase==='conflict'?'DB 내용과 저장 대기분이 다릅니다.':local?'저장 전에 확인할 항목이 있습니다.':invalid?'변경 내용을 저장하지 못했습니다.':'DB에 저장하지 못했습니다.'));
    if(head){const changes=head.batch068?head.changes??[]:[{type:head.entityType,id:head.entityId,fields:head.validation?.fields??head.conflict?.fields?.filter(field=>field.changedSinceBase&&!field.alreadyDesired).map(field=>field.field)??head.fields??[]}];for(const change of changes){const subject=writeSubject060(state,{type:change.type??change.entityType,id:change.id??change.entityId,fields:Array.isArray(change.fields)?change.fields:Object.keys(change.fields??{})});notice.append(el('p',subject.title+(subject.fields?` · ${subject.fields}`:''),'au-write-subject060'));}if(head.batch068)notice.append(el('p','덱과 출현 설정을 함께 저장하지 못했습니다. 아래 항목 전체가 초안으로 유지됩니다.','au-hint'));}
    notice.append(el('p',head?.validation?.message??state.error?.message??state.error));
    if(state.phase==='conflict'&&head?.conflict&&!head.batch068){const fields=(head.conflict.fields??[]).filter(field=>field.changedSinceBase&&!field.alreadyDesired).map(field=>field.field);const mine=(latestSnapshot060.entities??[]).find(row=>row.entity_type===head.entityType&&row.entity_id===head.entityId)?.content??{},db=(latestSnapshot060.bootstrap?.authoring?.entities??[]).find(row=>row.entity_type===head.entityType&&row.entity_id===head.entityId)?.content??{};if(fields.length)notice.append(renderConflictTable170(doc,conflictRows170({fields,mine,db,labels:FIELD_NAMES060,cards:head.entityType.startsWith('card_')||head.entityType==='deck'?normalizeCatalog039(state):[]}),{caption:head.conflict.currentMissing?'DB에서 이 항목이 사라졌습니다':'저장 대기분과 현재 DB 비교'}));}
    if(invalid&&head){
      notice.append(button('수정할 항목 열기',()=>openWrite065(head)));
      if(!local&&drafts060&&head.rejected&&(head.batch068?store.getRejectedBatch068&&store.releaseRejectedBatch068:manualSet060.has(head.entityType)&&['patch','create'].includes(head.operation)&&store.getRejected065&&store.releaseRejected065))notice.append(button('초안으로 돌려 수정',recoverWrite065,'au-primary'));
    }else if(state.phase!=='conflict')notice.append(button('다시 연결',()=>store.retry()));
    if(state.phase==='conflict'&&store.resolveConflict)notice.append(button('DB 내용 사용',()=>store.resolveConflict('remote')),button('내 수정 적용',()=>store.resolveConflict('retry')));
  }
  const manualSet060=new Set(manualKinds),drafts060=manualSave?createAuthoringDrafts060({storage:draftStorage,allowedKinds:manualKinds,onSave:(...args)=>{const result=savePatch066(...args);store.flushPending083?.();return result;},onSaveBatch:(...args)=>{const result=saveBatch068(...args);store.flushPending083?.();return result;},onChange:()=>{if(destroyed060||draftRenderQueued060)return;draftRenderQueued060=true;queueMicrotask(()=>{draftRenderQueued060=false;if(!destroyed060)render(latestSnapshot060);});}}):null;
  const shell=el('div',null,'au-app'),header=el('header',null,'au-top'),brand=el('a',null,'au-brand');brand.href='index.html';const icon=el('img');icon.src='assets/icon.svg';icon.alt='';icon.width=35;icon.height=43;brand.append(icon,el('span','YU-GI-OH CLASSIC'),el('small',preview170?'원정 제작소 · 로컬 미리보기':'원정 제작소'));
  const saveStatus=el('span',null,'au-save-status');saveStatus.setAttribute('role','status');saveStatus.setAttribute('aria-live','polite');
  const syncControls083=el('div',null,'au-sync083'),syncText083=el('span',null,'au-sync-detail083'),reload083=button('새로 불러오기',reloadLatest083,'au-reload083');
  reload083.title='최신 저장 내용을 확인합니다. 편집 중인 변경은 유지됩니다.';syncControls083.append(saveStatus,reload083,syncText083);
  const authButton=button('로그인',()=>state.user?prepareNavigation068(()=>store.logout()):login.showModal(),'au-auth');header.append(brand,syncControls083,authButton);
  const saveBar060=el('section',null,'au-manual-save060'),draftMessage060=el('p',null,'au-manual-message060'),draftActions060=el('div',null,'au-manual-actions060'),saveAll060=button('변경 사항 저장',()=>saveDrafts060(),'au-primary'),undoButton170=button('되돌리기',()=>undoLast170()),cancelAll060=button('변경 취소',()=>{panels.cancelLocalSetup068();return drafts060?.cancel();}),draftConflicts060=el('div',null,'au-manual-conflicts060');saveBar060.setAttribute('aria-label','제작소 저장');draftMessage060.setAttribute('role','status');draftActions060.append(saveAll060,undoButton170,cancelAll060);saveBar060.append(draftMessage060,draftActions060,draftConflicts060);saveBar060.hidden=true;if(manualSave)shell.append(saveBar060);shell.classList.toggle('au-manual-mode060',manualSave);
  const layout=el('div',null,'au-layout'),nav=el('nav',null,'au-navigation');nav.setAttribute('aria-label','원정 제작 영역');const view=el('main',null,'au-main');view.id='authoring-main';view.setAttribute('tabindex','-1');const notice=el('section',null,'au-notice');notice.setAttribute('role','status');const content=el('div',null,'au-content');view.append(notice,content);layout.append(nav,view);const restore170=el('section',null,'au-restore170');restore170.hidden=true;restore170.setAttribute('aria-label','보관한 초안 복원');
  const previewBanner170=preview170?el('p','로컬 미리보기 · 합성 자료로 편집 화면을 확인합니다. 실제 DB와 연결되지 않으며 저장 내용은 이 브라우저에만 남습니다.','au-preview170'):null;
  shell.append(header,...(previewBanner170?[previewBanner170]:[]),restore170,layout);root.replaceChildren(shell);
  const login=el('dialog',null,'au-login');login.setAttribute('aria-label','편집 계정 로그인');const form=el('form'),email=el('input');email.type='email';email.autocomplete='email';email.required=true;email.placeholder='편집 계정 이메일';email.setAttribute('aria-label','편집 계정 이메일');const loginStatus=el('p',null,'au-hint'),send=el('button','로그인 메일 받기','au-primary');send.type='submit';form.append(el('h2','편집 계정 로그인'),el('p',manualSave?'편집한 뒤 저장 버튼을 누르면 같은 DB에 반영됩니다.':'로그인하면 모든 편집 내용이 같은 DB에 자동 저장됩니다.'),email,send,loginStatus,button('닫기',()=>login.close(),'au-text-button'));login.append(form);doc.body.append(login);form.onsubmit=async e=>{e.preventDefault();if(!email.reportValidity())return;send.disabled=true;try{await store.login(email.value.trim());loginStatus.textContent='이메일의 로그인 링크를 열어 주세요. 같은 제작 화면으로 돌아옵니다.';}catch(e){loginStatus.textContent=e.message;}finally{send.disabled=false;}};
  const toast=el('div',null,'au-toast');toast.setAttribute('role','status');toast.hidden=true;shell.append(toast);
  function notify(error){toast.textContent=error?.message??String(error);toast.hidden=false;win.clearTimeout(toastTimer);toastTimer=win.setTimeout(()=>toast.hidden=true,6500);}
  function undoLast170(){
    if(!drafts060)return 0;const summary=drafts060.summary();if(summary.saving)throw Error('저장 결과를 확인한 뒤 되돌려 주세요.');
    const count=undo170.undo((type,id)=>drafts060.canUndo(type,id),(type,id)=>drafts060.undo(type,id));
    if(!count)notify('되돌릴 저장 전 변경이 없습니다.');return count;
  }
  const catalogUrl170={
    read(){try{return readCatalogParams170(new URL(win.location.href).searchParams);}catch{return {};}},
    write(catalog){if(route.section!=='cards')return;try{const url=new URL(win.location.href),before=url.search;writeCatalogParams170(url,catalog);if(url.search!==before)win.history.replaceState?.(win.history.state??null,'',url.pathname+url.search+url.hash);}catch{/* The address bar is a convenience only. */}}
  };
  function renderRestore170(){
    restore170.replaceChildren();restore170.hidden=true;
    const owner=state.user?.id;if(!draftBackup170||!drafts060||!state.canEdit||!owner||!state.bootstrap||restoreDismissed170.has(owner))return;
    const summary=drafts060.summary();if(summary.items.length||summary.saving)return;
    let pending=null;try{pending=draftBackup170.pending(owner);}catch{pending=null;}if(!pending)return;
    const when=new Date(pending.savedAt).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
    restore170.hidden=false;restore170.append(el('strong','저장하지 않은 변경이 이 기기에 남아 있습니다.'),el('p',`${when}에 보관한 항목 ${pending.count.toLocaleString('ko-KR')}개입니다. 복원하면 저장 전 변경으로만 돌아오며, 변경 사항 저장을 눌러야 DB에 반영됩니다. 다른 창에서 아직 편집 중이라면 그 창에서 저장해 주세요.`,'au-hint'),
      button('초안 복원',()=>{drafts060.adoptBackup170(pending.text);draftBackup170.discard(pending.key);restoreDismissed170.add(owner);render(latestSnapshot060);},'au-primary'),
      button('버리기',()=>{draftBackup170.discard(pending.key);restoreDismissed170.add(owner);render(latestSnapshot060);}));
  }
  function download170(name,text){const url=win.URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),link=el('a');link.href=url;link.download=name;link.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),10000);}
  function change060(kind,id,fields,options={}){
    if(drafts060&&manualSet060.has(kind)){
      if(options.operation==='delete'){
        const draft=drafts060.summary().items.find(item=>item.type===kind&&item.id===id);
        if(draft?.operation==='create'){drafts060.cancel({keys:[{type:kind,id}]});return {discarded:true};}
        if(draft)throw Error('이 항목의 변경을 저장하거나 취소한 뒤 삭제해 주세요.');
      }else{const result=drafts060.stage(kind,id,fields,options);undo170.record({type:kind,id});if(localIssue066?.entityType===kind&&localIssue066.entityId===id)localIssue066=null;return result;}
    }
    return savePatch066(kind,id,fields,options);
  }
  function latestState068(){const snapshot=store.snapshot();return drafts060?{...drafts060.overlay(snapshot),manualSave060:true,manualDrafts060:drafts060.summary(),canonicalEntities068:snapshot.entities??snapshot.bootstrap?.authoring?.entities??[]}:snapshot;}
  function stageMany071(changes){
    if(!drafts060)throw Error('수동 저장 화면에서 여러 구역을 편집해 주세요.');
    const preview=structuredClone(latestState068());
    for(const change of changes){validateAuthoringChange066(preview,change.type,change.id,change.fields,{operation:change.operation??'patch'});const row=preview.entities.find(row=>row.entity_type===change.type&&row.entity_id===change.id);if(row)row.content={...row.content,...structuredClone(change.fields)};}
    const result=drafts060.stageTogether071(changes);undo170.group(()=>{for(const change of changes)undo170.record({type:change.type,id:change.id});});return result;
  }
  async function saveDrafts060(scope={}){
    if(!drafts060)return;
    await panels.prepareSave068(scope);
    const keys=draftScope068({scope,items:drafts060.summary().items,state:latestState068(),canonical:store.snapshot()}),atomic=keys.filter(row=>['deck','chapter_role'].includes(row.type)),other=keys.filter(row=>!['deck','chapter_role'].includes(row.type));
    if(atomic.length){const result=await drafts060.saveTogether068({keys:atomic});if(result.success!==true||!other.length)return result;}
    return drafts060.saveAll({keys:other});
  }
  function renderSync083(){
    const checking=reloadBusy083||state.sync083?.checking===true;
    syncText083.textContent=syncDetail083({...state,sync083:{...state.sync083,checking}});
    reload083.textContent=checking?'불러오는 중…':'새로 불러오기';
    reload083.disabled=checking||state.phase==='loading'||Boolean(state.pending)||Boolean(drafts060?.summary().saving);
    reload083.setAttribute('aria-busy',String(checking));
  }
  async function reloadLatest083(){
    if(reload083.disabled||typeof store.refresh!=='function')return;
    reloadBusy083=true;renderSync083();
    try{await store.refresh(true);}
    finally{reloadBusy083=false;renderSync083();}
  }
  function openWrite065(head=state.writeState){
    if(!head)return;
    const type=head.entityType,id=head.entityId,fields=head.validation?.fields??head.fields??[],section=type.startsWith('card_')?'cards':({deck:'decks',chapter_role:'chapters',starter_list:'starters',character:'characters',relic:'relics',event:'events',shop_rules:'shop',map_rules:'map',meta_pack:'packs',meta_score:'balance',category:'cards',category_group:'cards',category_group_order:'cards'})[type];
    if(!section)return;
    panels.selectEntity065(section,id,head.entryId);navigate(section,type==='deck'?id:null);
    if(type.startsWith('card_')){const card=normalizeCatalog039(state).find(card=>String(card.source_id)===String(id));if(card)panels.openCard(card);}
    panels.revealFields065(type,id,fields);
  }
  function recoverWrite065(){
    if(state.writeState?.batch068){const record=store.getRejectedBatch068();drafts060.recoverRejectedBatch068(record);store.releaseRejectedBatch068({batchId:record.batchId});const first=record.changes[0];openWrite065({entityType:first.type,entityId:first.id,fields:Object.keys(first.fields)});return;}
    const record=store.getRejected065();
    if(record.type==='character'){
      const row=state.entities?.find(row=>row.entity_type===record.type&&row.entity_id===record.id);
      record.fields=completeCharacterTraits065(row?.content??record.baseContent,record.fields);
    }
    // Persist the recoverable input before releasing a certified non-write.
    drafts060.recoverRejected065(record);store.releaseRejected065({type:record.type,id:record.id});
    openWrite065({entityType:record.type,entityId:record.id,fields:Object.keys(record.fields)});
  }
  function renderDraftBar060(){
    if(!drafts060)return;const summary=drafts060.summary(),hasLocal=localDeckSetup068?.hasLocal===true,idleChapter066=['chapters','history'].includes(route.section)&&!hasLocal&&!summary.dirtyCount&&!summary.saving&&!summary.submittedCount&&!state.pending&&!state.error&&!localIssue066&&!summary.storageError&&!summary.error&&!summary.blockedReason;saveBar060.hidden=!state.canEdit||idleChapter066;shell.classList.toggle('au-chapter-idle066',idleChapter066);
    const rejected=state.phase==='invalid'&&state.writeState?.rejected===true;
    if(hasLocal&&!summary.saving&&!state.pending&&!state.error&&!localIssue066){saveStatus.textContent=localDeckSetup068?.scope071?'저장 전 여러 구역 설정':'저장 전 새 배치';saveStatus.dataset.state='draft';}else{saveStatus.textContent=saveLabel039({...state,manualDrafts060:summary});saveStatus.dataset.state=state.error||localIssue066?'error':state.pending?'saving':summary.dirtyCount?'draft':'saved';}
    saveAll060.textContent=summary.saving&&!rejected?'저장 확인 중…':'변경 사항 저장';saveAll060.disabled=!state.canEdit||summary.saving||!summary.dirtyCount&&!hasLocal||Boolean(summary.blockedReason);cancelAll060.disabled=summary.saving||Boolean(summary.submittedCount)||!summary.dirtyCount&&!hasLocal;saveBar060.setAttribute('aria-busy',String(summary.saving&&!rejected));
    saveAll060.setAttribute('aria-keyshortcuts','Control+S Meta+S');saveAll060.title='변경 사항 저장 (Ctrl+S / ⌘S)';
    draftMessage060.textContent=summary.storageError||(rejected?'저장이 거절됐습니다. 상단 안내에서 항목을 열거나 초안으로 돌려 수정해 주세요.':summary.error||(summary.saving?'보낸 내용을 확인하고 있습니다.':summary.blockedReason||(hasLocal?(localDeckSetup068?.scope071?'설정 중인 여러 구역의 변경을 덱과 함께 저장합니다.':'설정 중인 새 배치를 덱과 함께 저장합니다.'):summary.dirtyCount?`${draftLabel083(summary)} · 저장하면 반영됩니다.`:'저장할 변경이 없습니다.')));
    renderSync083();
    const undoReady170=!summary.saving&&undo170.available((type,id)=>drafts060.canUndo(type,id));undoButton170.disabled=!state.canEdit||!undoReady170;undoButton170.title=undoReady170?'마지막 변경 1단계를 되돌립니다 (Ctrl+Z / ⌘Z). 저장한 내용은 바뀌지 않습니다.':'되돌릴 저장 전 변경이 없습니다.';undoButton170.setAttribute('aria-keyshortcuts','Control+Z Meta+Z');
    draftConflicts060.replaceChildren();const conflicted170=summary.items.filter(item=>item.conflicts?.length),canonical170=conflicted170.length?new Map((latestSnapshot060.bootstrap?.authoring?.entities??[]).map(row=>[`${row.entity_type}\n${row.entity_id}`,row])):null,cards170=conflicted170.some(item=>item.type.startsWith('card_')||item.type==='deck')?normalizeCatalog039(state):[];
    for(const item of conflicted170){
      const subject=writeSubject060(state,{type:item.type,id:item.id,fields:item.conflicts}),line=el('div',null,'au-manual-conflict060'),table=renderConflictTable170(doc,conflictRows170({fields:item.conflicts,mine:item.fields,db:canonical170.get(`${item.type}\n${item.id}`)?.content??{},labels:FIELD_NAMES060,cards:cards170}));line.append(el('p',`${subject.title} · ${subject.fields}의 DB 내용이 달라졌습니다. 아래에서 두 값을 비교한 뒤 고르세요.`),table,button('내 수정 유지',()=>drafts060.resolveConflicts({keys:[{type:item.type,id:item.id}],choice:'local'})),button('DB 내용 사용',()=>drafts060.resolveConflicts({keys:[{type:item.type,id:item.id}],choice:'remote'})));draftConflicts060.append(line);
    }
  }
  function focusSection(){view.focus?.({preventScroll:true});win.scrollTo?.({top:0,left:0,behavior:'instant'});}
  function revealNavigation(){const b=[...nav.children].find(n=>n.dataset.section===route.section);if(nav.scrollWidth>nav.clientWidth)b?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});}
  function prepareNavigation068(next){if(!localDeckSetup068?.hasLocal)return next();const owner=state.user?.id,previousDeck=localDeckSetup068.deckId,failed=error=>{panels.selectDeck(previousDeck);notify(error);};try{return Promise.resolve(panels.prepareSave068()).then(()=>{if(state.user?.id===owner)return next();}).catch(failed);}catch(error){failed(error);}}
  function navigate(section,deck=null){return prepareNavigation068(()=>{const url=new URL(win.location.href);url.searchParams.set('section',section);if(deck)url.searchParams.set('deck',deck);else if(section!=='decks')url.searchParams.delete('deck');if(section!=='cards')for(const key of CATALOG_PARAMS170)url.searchParams.delete(key);url.hash='';win.history.pushState(null,'',url.pathname+url.search);route=route039(url);lastContentSignature='';forceRenderNext=true;render(store.snapshot());focusSection();revealNavigation();});}
  const historyDb171=typeof store.loadHistory039==='function'?{list:before=>store.loadHistory039({before}),detail:revision=>store.loadHistoryRevision039(revision)}:null;
  const panels=createAuthoringPanels039({document:doc,history170,historyDb171,catalogUrl170,onGroup170:run=>undo170.group(run),onDownload170:download170,getLatestState068:latestState068,onStageMany071:stageMany071,onDeleteDecks153:changes=>{const request=saveBatch068(changes);store.flushPending083?.();return request;},onCancelDrafts174:drafts060?keys=>drafts060.cancel({keys}):null,onPrepareDeckSetup068:setup=>{localDeckSetup068=setup;renderDraftBar060();},onRetryWrite:()=>store.retry(),onSaveDrafts060:manualSave?saveDrafts060:null,onResolveDrafts060:manualSave?(scope,choice)=>drafts060.resolveConflicts({keys:drafts060.summary().items.filter(item=>item.id===String(scope.id)&&(!scope.types||scope.types.includes(item.type))).map(item=>({type:item.type,id:item.id})),choice}):null,onChange:change060,onNavigate:navigate,onError:notify,onEditingChange:editing=>{shell.classList.toggle('au-editing',editing);renderDraftBar060();},onUpload:uploadAsset??(store.uploadAsset?file=>store.uploadAsset(file):null),onRecoveryRead:async id=>{const row=await store.readRecovery(id),url=win.URL.createObjectURL(new Blob([row.raw_json],{type:'application/json;charset=utf-8'})),link=el('a');link.href=url;link.download=`이전자료_${row.source_key.replace(/[^A-Za-z0-9_-]/g,'_')}.json`;link.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),10000);}});
  for(const [key,label] of AUTHORING_SECTIONS039){const b=button(label,()=>navigate(key));b.dataset.section=key;nav.append(b);}
  function render(snapshot){if((state.user?.id??null)!==(snapshot.user?.id??null)){toast.hidden=true;toast.textContent='';win.clearTimeout(toastTimer);}latestSnapshot060=snapshot;if(localIssue066&&localIssue066.owner!==(snapshot.user?.id??null))localIssue066=null;if(drafts060){drafts060.observe(snapshot);state={...drafts060.overlay(snapshot),manualSave060:true,manualDrafts060:drafts060.summary(),canonicalEntities068:snapshot.entities??snapshot.bootstrap?.authoring?.entities??[]};}else state=snapshot;if(localIssue066&&manualSet060.has(localIssue066.entityType)&&!state.manualDrafts060?.items.some(item=>item.type===localIssue066.entityType&&item.id===localIssue066.entityId))localIssue066=null;state={...state,localValidation066:localIssue066};saveStatus.textContent=saveLabel039(state);saveStatus.dataset.state=state.error||localIssue066?'error':state.pending?'saving':state.manualDrafts060?.dirtyCount?'draft':'saved';authButton.textContent=state.user?'로그아웃':'로그인';authButton.title=state.user?.email??'편집 계정으로 로그인';notice.replaceChildren();notice.hidden=true;renderDraftBar060();renderRestore170();
    renderSync083();renderNotice066();
    for(const b of nav.children){b.classList.toggle('active',b.dataset.section===route.section);b.setAttribute('aria-current',b.dataset.section===route.section?'page':'false');}
    if(!state.bootstrap){content.replaceChildren(el('section','카드와 원정 제작 자료를 DB에서 불러오고 있습니다.','au-loading'));content.setAttribute('aria-busy','true');return;}
    content.setAttribute('aria-busy','false');if(!state.canEdit){notice.hidden=false;notice.append(el('p','저장된 자료를 보고 있습니다. 편집하려면 로그인해 주세요.'));}
    if(route.section==='decks'&&route.deck){
      if(entities039(state).some(row=>row.entity_type==='deck'&&row.entity_id===route.deck&&!row.deleted))panels.selectDeck(route.deck);
      else{
        const url=new URL(win.location.href);
        url.searchParams.delete('deck');
        win.history.replaceState?.(null,'',url.pathname+url.search+url.hash);
        route={...route,deck:null};
      }
    }
    const signature=JSON.stringify([route.section,state.entities??state.bootstrap.authoring?.entities,state.bootstrap.catalog??state.bootstrap.game?.catalog,state.bootstrap.game?.source_fingerprint,state.canEdit,state.recoveries,state.phase,state.error,state.localValidation066,state.writeState,state.manualDrafts060,state.user?.id]);
    if(signature!==lastContentSignature){lastContentSignature=signature;panels.render(route.section,content,state,{force:forceRenderNext});forceRenderNext=false;}
    if(route.card&&lastCardHash!==route.card){const card=normalizeCatalog039(state).find(c=>String(c.slot??c.legacy_slot)===route.card);if(card){lastCardHash=route.card;panels.openCard(card);}}
  }
  const unsubscribe=store.subscribe(render);render(state);const pop=()=>prepareNavigation068(()=>{const previousSection=route.section;route=route039(win.location.href);if(route.section==='cards')panels.restoreCatalog170(catalogUrl170.read());lastContentSignature='';forceRenderNext=true;render(store.snapshot());if(route.section!==previousSection)focusSection();revealNavigation();});win.addEventListener('popstate',pop);win.addEventListener('hashchange',pop);
  const beforeUnload060=event=>{if(drafts060?.summary().dirtyCount||localDeckSetup068?.hasLocal){event.preventDefault?.();event.returnValue='';}};if(manualSave)win.addEventListener('beforeunload',beforeUnload060);
  const saveShortcut083=event=>{if(!manualSave||event.isComposing||event.altKey||!(event.ctrlKey||event.metaKey)||String(event.key).toLowerCase()!=='s')return;event.preventDefault?.();if(state.canEdit&&!saveAll060.disabled)Promise.resolve(saveDrafts060()).catch(notify);};
  if(manualSave)win.addEventListener('keydown',saveShortcut083);
  const undoShortcut170=event=>{if(!manualSave||event.isComposing||event.altKey||event.shiftKey||!(event.ctrlKey||event.metaKey)||String(event.key).toLowerCase()!=='z')return;const target=event.target??doc.activeElement;if(editableControl041(target)||target?.isContentEditable===true)return;event.preventDefault?.();if(state.canEdit&&!undoButton170.disabled)try{undoLast170();}catch(error){notify(error);}};
  if(manualSave)win.addEventListener('keydown',undoShortcut170);
  return {navigate,render,drafts060,undo170:()=>undoLast170(),destroy(){destroyed060=true;unsubscribe?.();panels.destroy();login.remove();win.removeEventListener('popstate',pop);win.removeEventListener('hashchange',pop);win.removeEventListener('beforeunload',beforeUnload060);win.removeEventListener('keydown',saveShortcut083);win.removeEventListener('keydown',undoShortcut170);root.replaceChildren();}};
}
