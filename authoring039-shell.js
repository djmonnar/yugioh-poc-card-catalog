import {AUTHORING_SECTIONS039,createAuthoringPanels039,normalizeCatalog039} from './authoring039-panels.js?v=20261102-068';
import {createAuthoringDrafts060} from './authoring060-drafts.js?v=20261102-068';
import {completeCharacterTraits065} from './authoring065-errors.js?v=20261101-065';
import {authoringFieldNames066} from './authoring066-validation.js?v=20261101-066';
import {draftScope068} from './authoring068-scope.js?v=20261102-068';

const MANUAL_KINDS060=['card_display','card_setting','card_annotation','card_limit','deck','chapter_role','starter_list','character','relic','event','shop_rules','meta_pack','meta_score'];
const TYPE_NAMES060={card_display:'카드 정보',card_setting:'카드 등급·보상',card_annotation:'카드 카테고리·관련 카드',card_limit:'카드 제한',category:'카테고리',category_group:'카테고리 묶음',category_group_order:'묶음 순서',deck:'덱',chapter_role:'장별 적 편성',starter_list:'시작 덱',character:'캐릭터',relic:'유물',event:'이벤트',shop_rules:'상점',map_rules:'맵 분포',meta_pack:'카드팩',meta_score:'점수·보상',recovery_archive:'이전 자료'};
const FIELD_NAMES060={name:'이름',deck_name:'덱 이름',name_english:'영문 이름',description:'설명',rarity:'등급',stock:'상점 판매',draw_enabled:'전투 보상',tags:'카테고리',links:'관련 카드',normal_limit:'일반 제한',speed_limit:'스피드 제한',main:'메인 덱',extra:'엑스트라 덱',banlist_enabled:'카드 제한 적용',entries:'편성',skills:'특성',profile:'프로필',lp_bonus:'추가 LP',opening_draw_bonus:'시작 패',categories:'포함 카테고리',group_ids:'묶음 순서'};
Object.assign(FIELD_NAMES060,{portrait:'캐릭터 이미지',skill_profiles:'특성 묶음',shared_character_id:'공용 특성 연결',shared_skill_profile_id:'공용 특성 묶음'});
Object.assign(FIELD_NAMES060,authoringFieldNames066);
export function writeSubject060(snapshot,{type,id,fields=[]}={}){
  const row=(snapshot.entities??[]).find(e=>e.entity_type===type&&e.entity_id===id),content=row?.content;
  const card=type?.startsWith('card_')?normalizeCatalog039(snapshot).find(c=>String(c.source_id)===String(id)):null;
  const name=type==='chapter_role'&&content?`${content.chapter}장 · ${{battle:'일반 전투',elite:'엘리트',boss:'보스'}[content.role]??content.role}`:card?.name_ko??content?.deck_name??content?.name??content?.profile?.name;
  return {title:[TYPE_NAMES060[type]??'편집 항목',typeof name==='string'?name:''].filter(Boolean).join(' · '),fields:[...new Set(fields.map(f=>FIELD_NAMES060[f]??'편집 내용'))].join(', ')};
}

export function route039(url){const parsed=url instanceof URL?url:new URL(url,'https://example.invalid/'),section=parsed.searchParams.get('section');return {section:AUTHORING_SECTIONS039.some(([key])=>key===section)?section:'cards',deck:parsed.searchParams.get('deck'),card:/^#card-(\d+)$/.exec(parsed.hash)?.[1]??null};}
export function saveLabel039(snapshot){if(snapshot.phase==='loading'||!snapshot.bootstrap)return 'DB 자료를 불러오는 중…';if(snapshot.phase==='conflict')return '저장 기준 확인 필요';if((snapshot.phase==='invalid'||snapshot.localValidation066))return '입력 확인 필요';if(snapshot.error)return '연결 확인 필요';if(snapshot.pending>0||snapshot.phase==='saving')return 'DB에 저장 중…';if(snapshot.manualDrafts060?.dirtyCount)return `저장 전 변경 ${snapshot.manualDrafts060.dirtyCount}개`;return snapshot.canEdit?'DB에 저장됨':'열람 중';}

export function mountAuthoringShell039({root,store,uploadAsset=null,manualSave=false,draftStorage=null,manualKinds=MANUAL_KINDS060,document:doc=globalThis.document,window:win=globalThis.window}={}){
  if(!root||!store)throw Error('제작 화면을 준비하지 못했습니다.');
  const el=(tag,value,cls)=>{const n=doc.createElement(tag);if(value!=null)n.textContent=String(value);if(cls)n.className=cls;return n;};
  const button=(label,fn,cls='')=>{const b=el('button',label,cls);b.type='button';b.onclick=()=>{try{Promise.resolve(fn()).catch(notify);}catch(e){notify(e);}};return b;};
  let state=store.snapshot(),route=route039(win.location.href),toastTimer,lastCardHash='',lastContentSignature='',forceRenderNext=true,destroyed060=false,draftRenderQueued060=false,latestSnapshot060=state,localIssue066=null,localDeckSetup068=null;
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
    notice.append(el('strong',state.phase==='conflict'?'DB 내용과 저장 대기분이 다릅니다.':local?'저장 전에 확인할 항목이 있습니다.':invalid?'변경 내용을 저장하지 못했습니다.':'DB에 저장하지 못했습니다.'));
    if(head){const changes=head.batch068?head.changes??[]:[{type:head.entityType,id:head.entityId,fields:head.validation?.fields??head.conflict?.fields?.filter(field=>field.changedSinceBase&&!field.alreadyDesired).map(field=>field.field)??head.fields??[]}];for(const change of changes){const subject=writeSubject060(state,{type:change.type??change.entityType,id:change.id??change.entityId,fields:Array.isArray(change.fields)?change.fields:Object.keys(change.fields??{})});notice.append(el('p',subject.title+(subject.fields?` · ${subject.fields}`:''),'au-write-subject060'));}if(head.batch068)notice.append(el('p','덱과 출현 설정을 함께 저장하지 못했습니다. 아래 항목 전체가 초안으로 유지됩니다.','au-hint'));}
    notice.append(el('p',head?.validation?.message??state.error?.message??state.error));
    if(invalid&&head){
      notice.append(button('수정할 항목 열기',()=>openWrite065(head)));
      if(!local&&drafts060&&head.rejected&&(head.batch068?store.getRejectedBatch068&&store.releaseRejectedBatch068:manualSet060.has(head.entityType)&&['patch','create'].includes(head.operation)&&store.getRejected065&&store.releaseRejected065))notice.append(button('초안으로 돌려 수정',recoverWrite065,'au-primary'));
    }else if(state.phase!=='conflict')notice.append(button('다시 연결',()=>store.retry()));
    if(state.phase==='conflict'&&store.resolveConflict)notice.append(button('DB 내용 사용',()=>store.resolveConflict('remote')),button('내 수정 적용',()=>store.resolveConflict('retry')));
  }
  const manualSet060=new Set(manualKinds),drafts060=manualSave?createAuthoringDrafts060({storage:draftStorage,allowedKinds:manualKinds,onSave:savePatch066,onSaveBatch:saveBatch068,onChange:()=>{if(destroyed060||draftRenderQueued060)return;draftRenderQueued060=true;queueMicrotask(()=>{draftRenderQueued060=false;if(!destroyed060)render(latestSnapshot060);});}}):null;
  const shell=el('div',null,'au-app'),header=el('header',null,'au-top'),brand=el('a',null,'au-brand');brand.href='index.html?v=20261102-068';const icon=el('img');icon.src='assets/icon.svg';icon.alt='';icon.width=35;icon.height=43;brand.append(icon,el('span','YU-GI-OH CLASSIC'),el('small','원정 제작소 · 068'));
  const saveStatus=el('span',null,'au-save-status');saveStatus.setAttribute('role','status');saveStatus.setAttribute('aria-live','polite');const authButton=button('로그인',()=>state.user?prepareNavigation068(()=>store.logout()):login.showModal(),'au-auth');header.append(brand,saveStatus,authButton);
  const saveBar060=el('section',null,'au-manual-save060'),draftMessage060=el('p',null,'au-manual-message060'),draftActions060=el('div',null,'au-manual-actions060'),saveAll060=button('변경 사항 저장',()=>saveDrafts060(),'au-primary'),cancelAll060=button('변경 취소',()=>{panels.cancelLocalSetup068();return drafts060?.cancel();}),draftConflicts060=el('div',null,'au-manual-conflicts060');saveBar060.setAttribute('aria-label','제작소 저장');draftMessage060.setAttribute('role','status');draftActions060.append(saveAll060,cancelAll060);saveBar060.append(draftMessage060,draftActions060,draftConflicts060);saveBar060.hidden=true;if(manualSave)shell.append(saveBar060);shell.classList.toggle('au-manual-mode060',manualSave);
  const layout=el('div',null,'au-layout'),nav=el('nav',null,'au-navigation');nav.setAttribute('aria-label','원정 제작 영역');const view=el('main',null,'au-main');view.id='authoring-main';view.setAttribute('tabindex','-1');const notice=el('section',null,'au-notice');notice.setAttribute('role','status');const content=el('div',null,'au-content');view.append(notice,content);layout.append(nav,view);shell.append(header,layout);root.replaceChildren(shell);
  const login=el('dialog',null,'au-login');login.setAttribute('aria-label','편집 계정 로그인');const form=el('form'),email=el('input');email.type='email';email.autocomplete='email';email.required=true;email.placeholder='편집 계정 이메일';email.setAttribute('aria-label','편집 계정 이메일');const loginStatus=el('p',null,'au-hint'),send=el('button','로그인 메일 받기','au-primary');send.type='submit';form.append(el('h2','편집 계정 로그인'),el('p',manualSave?'편집한 뒤 저장 버튼을 누르면 같은 DB에 반영됩니다.':'로그인하면 모든 편집 내용이 같은 DB에 자동 저장됩니다.'),email,send,loginStatus,button('닫기',()=>login.close(),'au-text-button'));login.append(form);doc.body.append(login);form.onsubmit=async e=>{e.preventDefault();if(!email.reportValidity())return;send.disabled=true;try{await store.login(email.value.trim());loginStatus.textContent='이메일의 로그인 링크를 열어 주세요. 같은 제작 화면으로 돌아옵니다.';}catch(e){loginStatus.textContent=e.message;}finally{send.disabled=false;}};
  const toast=el('div',null,'au-toast');toast.setAttribute('role','status');toast.hidden=true;shell.append(toast);
  function notify(error){toast.textContent=error?.message??String(error);toast.hidden=false;win.clearTimeout(toastTimer);toastTimer=win.setTimeout(()=>toast.hidden=true,6500);}
  function change060(kind,id,fields,options={}){
    if(drafts060&&manualSet060.has(kind)){
      if(options.operation==='delete'){
        const draft=drafts060.summary().items.find(item=>item.type===kind&&item.id===id);
        if(draft?.operation==='create'){drafts060.cancel({keys:[{type:kind,id}]});return {discarded:true};}
        if(draft)throw Error('이 항목의 변경을 저장하거나 취소한 뒤 삭제해 주세요.');
      }else{const result=drafts060.stage(kind,id,fields,options);if(localIssue066?.entityType===kind&&localIssue066.entityId===id)localIssue066=null;return result;}
    }
    return savePatch066(kind,id,fields,options);
  }
  function latestState068(){const snapshot=store.snapshot();return drafts060?{...drafts060.overlay(snapshot),manualSave060:true,manualDrafts060:drafts060.summary(),canonicalEntities068:snapshot.entities??snapshot.bootstrap?.authoring?.entities??[]}:snapshot;}
  async function saveDrafts060(scope={}){
    if(!drafts060)return;
    await panels.prepareSave068(scope);
    const keys=draftScope068({scope,items:drafts060.summary().items,state:latestState068(),canonical:store.snapshot()}),atomic=keys.filter(row=>['deck','chapter_role'].includes(row.type)),other=keys.filter(row=>!['deck','chapter_role'].includes(row.type));
    if(atomic.length){const result=await drafts060.saveTogether068({keys:atomic});if(result.success!==true||!other.length)return result;}
    return drafts060.saveAll({keys:other});
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
    if(!drafts060)return;const summary=drafts060.summary(),hasLocal=localDeckSetup068?.hasLocal===true,idleChapter066=route.section==='chapters'&&!summary.dirtyCount&&!summary.saving&&!summary.submittedCount&&!state.pending&&!state.error&&!localIssue066&&!summary.storageError&&!summary.error&&!summary.blockedReason;saveBar060.hidden=!state.canEdit||idleChapter066;shell.classList.toggle('au-chapter-idle066',idleChapter066);
    const rejected=state.phase==='invalid'&&state.writeState?.rejected===true;
    if(hasLocal&&!summary.saving&&!state.pending&&!state.error&&!localIssue066){saveStatus.textContent='저장 전 새 배치';saveStatus.dataset.state='draft';}else{saveStatus.textContent=saveLabel039({...state,manualDrafts060:summary});saveStatus.dataset.state=state.error||localIssue066?'error':state.pending?'saving':summary.dirtyCount?'draft':'saved';}
    saveAll060.textContent=summary.saving&&!rejected?'저장 확인 중…':'변경 사항 저장';saveAll060.disabled=!state.canEdit||summary.saving||!summary.dirtyCount&&!hasLocal||Boolean(summary.blockedReason);cancelAll060.disabled=summary.saving||Boolean(summary.submittedCount)||!summary.dirtyCount&&!hasLocal;saveBar060.setAttribute('aria-busy',String(summary.saving&&!rejected));
    draftMessage060.textContent=summary.storageError||(rejected?'저장이 거절됐습니다. 상단 안내에서 항목을 열거나 초안으로 돌려 수정해 주세요.':summary.error||(summary.saving?'보낸 내용을 확인하고 있습니다.':summary.blockedReason||(hasLocal?'설정 중인 새 배치를 덱과 함께 저장합니다.':summary.dirtyCount?`저장 전 변경 ${summary.dirtyCount}개 · 저장 버튼을 눌러 반영하세요.`:'저장할 변경이 없습니다.')));
    draftConflicts060.replaceChildren();for(const item of summary.items.filter(item=>item.conflicts?.length)){
      const subject=writeSubject060(state,{type:item.type,id:item.id,fields:item.conflicts}),line=el('div',null,'au-manual-conflict060');line.append(el('p',`${subject.title} · ${subject.fields}의 DB 내용이 달라졌습니다.`),button('내 수정 유지',()=>drafts060.resolveConflicts({keys:[{type:item.type,id:item.id}],choice:'local'})),button('DB 내용 사용',()=>drafts060.resolveConflicts({keys:[{type:item.type,id:item.id}],choice:'remote'})));draftConflicts060.append(line);
    }
  }
  function focusSection(){view.focus?.({preventScroll:true});win.scrollTo?.({top:0,left:0,behavior:'instant'});}
  function revealNavigation(){const b=[...nav.children].find(n=>n.dataset.section===route.section);if(nav.scrollWidth>nav.clientWidth)b?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});}
  function prepareNavigation068(next){if(!localDeckSetup068?.hasLocal)return next();const owner=state.user?.id,previousDeck=localDeckSetup068.deckId,failed=error=>{panels.selectDeck(previousDeck);notify(error);};try{return Promise.resolve(panels.prepareSave068()).then(()=>{if(state.user?.id===owner)return next();}).catch(failed);}catch(error){failed(error);}}
  function navigate(section,deck=null){return prepareNavigation068(()=>{const url=new URL(win.location.href);url.searchParams.set('section',section);if(deck)url.searchParams.set('deck',deck);else if(section!=='decks')url.searchParams.delete('deck');url.hash='';win.history.pushState(null,'',url.pathname+url.search);route=route039(url);if(deck)panels.selectDeck(deck);lastContentSignature='';forceRenderNext=true;render(store.snapshot());focusSection();revealNavigation();});}
  const panels=createAuthoringPanels039({document:doc,getLatestState068:latestState068,onPrepareDeckSetup068:setup=>{localDeckSetup068=setup;renderDraftBar060();},onRetryWrite:()=>store.retry(),onSaveDrafts060:manualSave?saveDrafts060:null,onResolveDrafts060:manualSave?(scope,choice)=>drafts060.resolveConflicts({keys:drafts060.summary().items.filter(item=>item.id===String(scope.id)&&(!scope.types||scope.types.includes(item.type))).map(item=>({type:item.type,id:item.id})),choice}):null,onChange:change060,onNavigate:navigate,onError:notify,onEditingChange:editing=>shell.classList.toggle('au-editing',editing),onUpload:uploadAsset??(store.uploadAsset?file=>store.uploadAsset(file):null),onRecoveryRead:async id=>{const row=await store.readRecovery(id),url=win.URL.createObjectURL(new Blob([row.raw_json],{type:'application/json;charset=utf-8'})),link=el('a');link.href=url;link.download=`이전자료_${row.source_key.replace(/[^A-Za-z0-9_-]/g,'_')}.json`;link.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),10000);}});
  for(const [key,label] of AUTHORING_SECTIONS039){const b=button(label,()=>navigate(key));b.dataset.section=key;nav.append(b);}
  function render(snapshot){if((state.user?.id??null)!==(snapshot.user?.id??null)){toast.hidden=true;toast.textContent='';win.clearTimeout(toastTimer);}latestSnapshot060=snapshot;if(localIssue066&&localIssue066.owner!==(snapshot.user?.id??null))localIssue066=null;if(drafts060){drafts060.observe(snapshot);state={...drafts060.overlay(snapshot),manualSave060:true,manualDrafts060:drafts060.summary(),canonicalEntities068:snapshot.entities??snapshot.bootstrap?.authoring?.entities??[]};}else state=snapshot;if(localIssue066&&manualSet060.has(localIssue066.entityType)&&!state.manualDrafts060?.items.some(item=>item.type===localIssue066.entityType&&item.id===localIssue066.entityId))localIssue066=null;state={...state,localValidation066:localIssue066};saveStatus.textContent=saveLabel039(state);saveStatus.dataset.state=state.error||localIssue066?'error':state.pending?'saving':state.manualDrafts060?.dirtyCount?'draft':'saved';authButton.textContent=state.user?'로그아웃':'로그인';authButton.title=state.user?.email??'편집 계정으로 로그인';notice.replaceChildren();notice.hidden=true;renderDraftBar060();
    renderNotice066();
    for(const b of nav.children){b.classList.toggle('active',b.dataset.section===route.section);b.setAttribute('aria-current',b.dataset.section===route.section?'page':'false');}
    if(!state.bootstrap){content.replaceChildren(el('section','카드와 원정 제작 자료를 DB에서 불러오고 있습니다.','au-loading'));content.setAttribute('aria-busy','true');return;}
    content.setAttribute('aria-busy','false');if(!state.canEdit){notice.hidden=false;notice.append(el('p','저장된 자료를 보고 있습니다. 편집하려면 로그인해 주세요.'));}
    const signature=JSON.stringify([route.section,state.entities??state.bootstrap.authoring?.entities,state.bootstrap.catalog??state.bootstrap.game?.catalog,state.bootstrap.game?.source_fingerprint,state.canEdit,state.recoveries,state.phase,state.error,state.localValidation066,state.writeState,state.manualDrafts060,state.user?.id]);
    if(signature!==lastContentSignature){lastContentSignature=signature;panels.render(route.section,content,state,{force:forceRenderNext});forceRenderNext=false;}
    if(route.deck)panels.selectDeck(route.deck);
    if(route.card&&lastCardHash!==route.card){const card=normalizeCatalog039(state).find(c=>String(c.slot??c.legacy_slot)===route.card);if(card){lastCardHash=route.card;panels.openCard(card);}}
  }
  if(route.deck)panels.selectDeck(route.deck);const unsubscribe=store.subscribe(render);render(state);const pop=()=>prepareNavigation068(()=>{const previousSection=route.section;route=route039(win.location.href);lastContentSignature='';forceRenderNext=true;render(store.snapshot());if(route.section!==previousSection)focusSection();revealNavigation();});win.addEventListener('popstate',pop);win.addEventListener('hashchange',pop);
  const beforeUnload060=event=>{if(drafts060?.summary().dirtyCount||localDeckSetup068?.hasLocal){event.preventDefault?.();event.returnValue='';}};if(manualSave)win.addEventListener('beforeunload',beforeUnload060);
  return {navigate,render,drafts060,destroy(){destroyed060=true;unsubscribe?.();panels.destroy();login.remove();win.removeEventListener('popstate',pop);win.removeEventListener('hashchange',pop);win.removeEventListener('beforeunload',beforeUnload060);root.replaceChildren();}};
}
