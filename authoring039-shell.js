import {AUTHORING_SECTIONS039,createAuthoringPanels039,normalizeCatalog039} from './authoring039-panels.js?v=20261031-060';
import {createAuthoringDrafts060} from './authoring060-drafts.js?v=20261031-060';

const MANUAL_KINDS060=['card_display','card_setting','card_annotation','card_limit','deck','chapter_role','starter_list','character','relic','event','shop_rules','meta_pack','meta_score'];
const TYPE_NAMES060={card_display:'카드 정보',card_setting:'카드 등급·보상',card_annotation:'카드 카테고리·관련 카드',card_limit:'카드 제한',category:'카테고리',category_group:'카테고리 묶음',category_group_order:'묶음 순서',deck:'덱',chapter_role:'장별 적 편성',starter_list:'시작 덱',character:'캐릭터',relic:'유물',event:'이벤트',shop_rules:'상점',map_rules:'맵 분포',meta_pack:'카드팩',meta_score:'점수·보상',recovery_archive:'이전 자료'};
const FIELD_NAMES060={name:'이름',deck_name:'덱 이름',name_english:'영문 이름',description:'설명',rarity:'등급',stock:'상점 판매',draw_enabled:'전투 보상',tags:'카테고리',links:'관련 카드',normal_limit:'일반 제한',speed_limit:'스피드 제한',main:'메인 덱',extra:'엑스트라 덱',banlist_enabled:'카드 제한 적용',entries:'편성',skills:'특성',profile:'프로필',lp_bonus:'추가 LP',opening_draw_bonus:'시작 패',categories:'포함 카테고리',group_ids:'묶음 순서'};
export function writeSubject060(snapshot,{type,id,fields=[]}={}){
  const row=(snapshot.entities??[]).find(e=>e.entity_type===type&&e.entity_id===id),content=row?.content;
  const card=type?.startsWith('card_')?normalizeCatalog039(snapshot).find(c=>String(c.source_id)===String(id)):null;
  const name=card?.name_ko??content?.deck_name??content?.name??content?.profile?.name;
  return {title:[TYPE_NAMES060[type]??'편집 항목',typeof name==='string'?name:''].filter(Boolean).join(' · '),fields:[...new Set(fields.map(f=>FIELD_NAMES060[f]??'편집 내용'))].join(', ')};
}

export function route039(url){const parsed=url instanceof URL?url:new URL(url,'https://example.invalid/'),section=parsed.searchParams.get('section');return {section:AUTHORING_SECTIONS039.some(([key])=>key===section)?section:'cards',deck:parsed.searchParams.get('deck'),card:/^#card-(\d+)$/.exec(parsed.hash)?.[1]??null};}
export function saveLabel039(snapshot){if(snapshot.phase==='loading'||!snapshot.bootstrap)return 'DB 자료를 불러오는 중…';if(snapshot.phase==='conflict')return '저장 기준 확인 필요';if(snapshot.phase==='invalid')return '입력 확인 필요';if(snapshot.error)return '연결 확인 필요';if(snapshot.pending>0||snapshot.phase==='saving')return 'DB에 저장 중…';if(snapshot.manualDrafts060?.dirtyCount)return `저장 전 변경 ${snapshot.manualDrafts060.dirtyCount}개`;return snapshot.canEdit?'DB에 저장됨':'열람 중';}

export function mountAuthoringShell039({root,store,uploadAsset=null,manualSave=false,draftStorage=null,manualKinds=MANUAL_KINDS060,document:doc=globalThis.document,window:win=globalThis.window}={}){
  if(!root||!store)throw Error('제작 화면을 준비하지 못했습니다.');
  const el=(tag,value,cls)=>{const n=doc.createElement(tag);if(value!=null)n.textContent=String(value);if(cls)n.className=cls;return n;};
  const button=(label,fn,cls='')=>{const b=el('button',label,cls);b.type='button';b.onclick=()=>{try{Promise.resolve(fn()).catch(notify);}catch(e){notify(e);}};return b;};
  let state=store.snapshot(),route=route039(win.location.href),toastTimer,lastCardHash='',lastContentSignature='',forceRenderNext=true,destroyed060=false,draftRenderQueued060=false,latestSnapshot060=state;
  const manualSet060=new Set(manualKinds),drafts060=manualSave?createAuthoringDrafts060({storage:draftStorage,allowedKinds:manualKinds,onSave:(...args)=>store.patch(...args),onChange:()=>{if(destroyed060||draftRenderQueued060)return;draftRenderQueued060=true;queueMicrotask(()=>{draftRenderQueued060=false;if(!destroyed060)render(latestSnapshot060);});}}):null;
  const shell=el('div',null,'au-app'),header=el('header',null,'au-top'),brand=el('a',null,'au-brand');brand.href='index.html?v=20261031-060';const icon=el('img');icon.src='assets/icon.svg';icon.alt='';icon.width=35;icon.height=43;brand.append(icon,el('span','YU-GI-OH CLASSIC'),el('small','원정 제작소 · 060'));
  const saveStatus=el('span',null,'au-save-status');saveStatus.setAttribute('role','status');saveStatus.setAttribute('aria-live','polite');const authButton=button('로그인',()=>state.user?store.logout():login.showModal(),'au-auth');header.append(brand,saveStatus,authButton);
  const saveBar060=el('section',null,'au-manual-save060'),draftMessage060=el('p',null,'au-manual-message060'),draftActions060=el('div',null,'au-manual-actions060'),saveAll060=button('변경 사항 저장',()=>saveDrafts060(),'au-primary'),cancelAll060=button('변경 취소',()=>drafts060?.cancel()),draftConflicts060=el('div',null,'au-manual-conflicts060');saveBar060.setAttribute('aria-label','제작소 저장');draftMessage060.setAttribute('role','status');draftActions060.append(saveAll060,cancelAll060);saveBar060.append(draftMessage060,draftActions060,draftConflicts060);saveBar060.hidden=true;if(manualSave)shell.append(saveBar060);shell.classList.toggle('au-manual-mode060',manualSave);
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
      }else return drafts060.stage(kind,id,fields,options);
    }
    return store.patch(kind,id,fields,options);
  }
  function saveDrafts060(scope={}){
    if(!drafts060)return;
    const keys=scope.keys??(scope.id!=null?drafts060.summary().items.filter(item=>item.id===String(scope.id)&&(!scope.types||scope.types.includes(item.type))).map(item=>({type:item.type,id:item.id})):null);
    return drafts060.saveAll({keys});
  }
  function renderDraftBar060(){
    if(!drafts060)return;const summary=drafts060.summary();saveBar060.hidden=!state.canEdit;
    saveAll060.textContent=summary.saving?'저장 확인 중…':'변경 사항 저장';saveAll060.disabled=!state.canEdit||summary.saving||!summary.dirtyCount||Boolean(summary.blockedReason);cancelAll060.disabled=summary.saving||Boolean(summary.submittedCount)||!summary.dirtyCount;saveBar060.setAttribute('aria-busy',String(summary.saving));
    draftMessage060.textContent=summary.storageError||summary.error||(summary.saving?'보낸 내용을 확인하고 있습니다.':summary.blockedReason||(summary.dirtyCount?`저장 전 변경 ${summary.dirtyCount}개 · 저장 버튼을 눌러 반영하세요.`:'저장할 변경이 없습니다.'));
    draftConflicts060.replaceChildren();for(const item of summary.items.filter(item=>item.conflicts?.length)){
      const subject=writeSubject060(state,{type:item.type,id:item.id,fields:item.conflicts}),line=el('div',null,'au-manual-conflict060');line.append(el('p',`${subject.title} · ${subject.fields}의 DB 내용이 달라졌습니다.`),button('내 수정 유지',()=>drafts060.resolveConflicts({keys:[{type:item.type,id:item.id}],choice:'local'})),button('DB 내용 사용',()=>drafts060.resolveConflicts({keys:[{type:item.type,id:item.id}],choice:'remote'})));draftConflicts060.append(line);
    }
  }
  function focusSection(){view.focus?.({preventScroll:true});win.scrollTo?.({top:0,left:0,behavior:'instant'});}
  function revealNavigation(){const b=[...nav.children].find(n=>n.dataset.section===route.section);if(nav.scrollWidth>nav.clientWidth)b?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});}
  function navigate(section,deck=null){const url=new URL(win.location.href);url.searchParams.set('section',section);if(deck)url.searchParams.set('deck',deck);else if(section!=='decks')url.searchParams.delete('deck');url.hash='';win.history.pushState(null,'',url.pathname+url.search);route=route039(url);if(deck)panels.selectDeck(deck);lastContentSignature='';forceRenderNext=true;render(store.snapshot());focusSection();revealNavigation();}
  const panels=createAuthoringPanels039({document:doc,onRetryWrite:()=>store.retry(),onSaveDrafts060:manualSave?saveDrafts060:null,onResolveDrafts060:manualSave?(scope,choice)=>drafts060.resolveConflicts({keys:drafts060.summary().items.filter(item=>item.id===String(scope.id)&&(!scope.types||scope.types.includes(item.type))).map(item=>({type:item.type,id:item.id})),choice}):null,onChange:change060,onNavigate:navigate,onError:notify,onEditingChange:editing=>shell.classList.toggle('au-editing',editing),onUpload:uploadAsset??(store.uploadAsset?file=>store.uploadAsset(file):null),onRecoveryRead:async id=>{const row=await store.readRecovery(id),url=win.URL.createObjectURL(new Blob([row.raw_json],{type:'application/json;charset=utf-8'})),link=el('a');link.href=url;link.download=`이전자료_${row.source_key.replace(/[^A-Za-z0-9_-]/g,'_')}.json`;link.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),10000);}});
  for(const [key,label] of AUTHORING_SECTIONS039){const b=button(label,()=>navigate(key));b.dataset.section=key;nav.append(b);}
  function render(snapshot){latestSnapshot060=snapshot;if(drafts060){drafts060.observe(snapshot);state={...drafts060.overlay(snapshot),manualSave060:true,manualDrafts060:drafts060.summary()};}else state=snapshot;saveStatus.textContent=saveLabel039(state);saveStatus.dataset.state=state.error?'error':state.pending?'saving':state.manualDrafts060?.dirtyCount?'draft':'saved';authButton.textContent=state.user?'로그아웃':'로그인';authButton.title=state.user?.email??'편집 계정으로 로그인';notice.replaceChildren();notice.hidden=true;renderDraftBar060();
    if(state.error){notice.hidden=false;notice.append(el('strong',state.phase==='conflict'?'DB 내용과 저장 대기분이 다릅니다.':state.phase==='invalid'?'입력한 값을 확인해 주세요.':'DB에 저장하지 못했습니다.'));const head=state.writeState;if(head){const subject=writeSubject060(state,{type:head.entityType,id:head.entityId,fields:head.conflict?.fields?.filter(f=>f.changedSinceBase&&!f.alreadyDesired).map(f=>f.field)??[]});notice.append(el('p',subject.title+(subject.fields?` · ${subject.fields}`:''),'au-write-subject060'));}notice.append(el('p',state.error.message??state.error),...(state.phase==='invalid'||state.phase==='conflict'?[]:[button('다시 연결',()=>store.retry())]));if(state.phase==='conflict'&&store.resolveConflict){notice.append(button('DB 내용 사용',()=>store.resolveConflict('remote')),button('내 수정 적용',()=>store.resolveConflict('retry')));}}
    for(const b of nav.children){b.classList.toggle('active',b.dataset.section===route.section);b.setAttribute('aria-current',b.dataset.section===route.section?'page':'false');}
    if(!state.bootstrap){content.replaceChildren(el('section','카드와 원정 제작 자료를 DB에서 불러오고 있습니다.','au-loading'));content.setAttribute('aria-busy','true');return;}
    content.setAttribute('aria-busy','false');if(!state.canEdit){notice.hidden=false;notice.append(el('p','저장된 자료를 보고 있습니다. 편집하려면 로그인해 주세요.'));}
    const signature=JSON.stringify([route.section,state.entities??state.bootstrap.authoring?.entities,state.bootstrap.catalog??state.bootstrap.game?.catalog,state.bootstrap.game?.source_fingerprint,state.canEdit,state.recoveries,state.phase,state.error,state.writeState,state.manualDrafts060,state.user?.id]);
    if(signature!==lastContentSignature){lastContentSignature=signature;panels.render(route.section,content,state,{force:forceRenderNext});forceRenderNext=false;}
    if(route.deck)panels.selectDeck(route.deck);
    if(route.card&&lastCardHash!==route.card){const card=normalizeCatalog039(state).find(c=>String(c.slot??c.legacy_slot)===route.card);if(card){lastCardHash=route.card;panels.openCard(card);}}
  }
  if(route.deck)panels.selectDeck(route.deck);const unsubscribe=store.subscribe(render);render(state);const pop=()=>{const previousSection=route.section;route=route039(win.location.href);lastContentSignature='';forceRenderNext=true;render(store.snapshot());if(route.section!==previousSection)focusSection();revealNavigation();};win.addEventListener('popstate',pop);win.addEventListener('hashchange',pop);
  const beforeUnload060=event=>{if(drafts060?.summary().dirtyCount){event.preventDefault?.();event.returnValue='';}};if(manualSave)win.addEventListener('beforeunload',beforeUnload060);
  return {navigate,render,drafts060,destroy(){destroyed060=true;unsubscribe?.();panels.destroy();login.remove();win.removeEventListener('popstate',pop);win.removeEventListener('hashchange',pop);win.removeEventListener('beforeunload',beforeUnload060);root.replaceChildren();}};
}
