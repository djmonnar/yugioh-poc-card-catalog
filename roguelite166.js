import {instanceCards163,pendingEnhancement166} from './roguelite166-instances.js?v=20261018-166';
import {upgradeCopyView166,decorateCopy166,appendCopyDetails166} from './roguelite166-copy-view.js?v=20261018-166';
import {STORAGE_KEY,emptySave,readStore,writeStore,parseSave,serializeSave,makeStarter,createRun,initCampaign164,validatePlayerDeck,beginDeckEdit,adjustRunDeck,commitRunDeck} from './roguelite166-core.js?v=20261018-166';
import {generateMap,chapterViewMap164,nodeLabel,nodeSummary,TOWER_THEME,TOWER_EVENTS} from './roguelite164-map.js?v=20261018-166';
import {renderTowerMap,renderMapLegend,MAP_ASSETS} from './roguelite164-map-view.js?v=20261018-166';
import {loadCatalog,browserDecks,onlineDecks,importedDecks} from './roguelite-data.js';
import {cleanEncounterPool,assignEncounters,browserEncounterPool} from './roguelite-encounters.js?v=20261014-138';
import {REST_CHOICES,RELICS,restOutcome,rewardPolicy} from './roguelite166-rules.js?v=20261018-166';
import {mountRewardPreview} from './roguelite166-reward-preview.js?v=20261018-166';
import {createStatFilters,statConditionsMatch} from './card-filters.js';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {BRIDGE} from './roguelite147-config.js?v=20261015-147';
import {mountBridge154} from './roguelite166-ui.js?v=20261018-166';
import {createEmbedBridge152,mountGameAudio152} from './embedbridge154.js?v=20261018-163';
import {loadToolStarters153} from './starter153-data.js?v=20261016-153';
import {shouldApplyCheckpoint150} from './roguelite150-present.js?v=20261018-163';
import {pendingForge163} from './roguelite166-opening.js?v=20261018-166';
import {reachableNodes} from './roguelite166-progress.js?v=20261018-166';
import {loadCampaign164} from './campaign164-data.js?v=20261018-166';
import {assignCampaignEncounters164} from './roguelite164-encounters.js?v=20261018-166';
import {SKILLS} from './story-core.js';
import {mountStartView164} from './roguelite164-start-view.js?v=20261018-166';
mountStartView164(document);
const $=id=>document.getElementById(id), copy=value=>structuredClone(value);
const count=rows=>rows.reduce((sum,row)=>sum+row.count,0);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;};
const button=(text,action,className)=>{const e=node('button',text,className);e.type='button';e.addEventListener('click',()=>safe(action));return e;};
const option=(label,value)=>{const e=node('option',label);e.value=value;return e;};
const img=card=>{const e=node('img');e.src=card.image;e.alt=card.name_ko;e.loading='lazy';return e;};
let cards=[],meta={},save=emptySave(),activeSlot=null,draft=null,sourceDecks=[],sourceCards=[],pendingSlot=null;
let toolStarters=[],toolStarterLoading=false,toolStarterError='',toolStarterLoaded=false,toolStarterRequest=null;
let blocked=false,rawSave=null,busy=false,sourceBusy=false,externalChange=false,toastTimer;
let mapView=null,mapViewKey=null;
let bridgeUI=null;
let audio152=null,resumePending152=false,audioState152='',consumableView163=false;
function syncGameAudio163(state){const value={...state,visible:state.visible&&!consumableView163&&run()?.bridge147?.phase!=='duel_started'},key=`${value.connected}:${value.visible}:${value.autoplay_allowed}`;if(audioState152!==key){audioState152=key;audio152?.sync(value);}}
const embed152=createEmbedBridge152({sessionId:BRIDGE?.session_id,
  onState:state=>{
    document.body.dataset.embed=state.connected?'ready':state.available?'connecting':'outside';
    $('embed152-gate').hidden=state.connected;
    $('embed152-gate-message').textContent=state.error||(!state.available?'게임 메인 메뉴의 원정 전투에서 열어줘.':state.connected?'원정이 준비됐어.':'게임과 원정 기록을 연결하고 있어.');
    $('game152-close').disabled=state.busy||!state.connected||bridgeUI?.canReturnToGame166?.()===false;
    syncGameAudio163(state);
  },onResume:async()=>{if(bridgeUI){await bridgeUI.refresh();await bridgeUI.openConsumables163();}else resumePending152=true;},onStop:()=>audio152?.pause()});
let opponentPool=[],defaultOpponentPool=[],opponentSource='',opponentLoadError='';
let campaignLibrary164=null,campaignError164='',campaignLoading164=false;
let newRunRequested164=false;
const localFloor164=(r,n)=>r?.campaign164?((n-1)%15)+1:n;
const chapter164=r=>r?.campaign164?.chapter??1;
const progressText164=r=>r.campaign164?`${chapter164(r)}장 · ${Math.max(0,r.floor-(chapter164(r)-1)*15)} / 15층`:`${r.floor} / ${r.map?.floors??20}층`;
const encounterKinds=['battle','elite','boss'];
const mapSelections=new Map();
const statFilters=createStatFilters($('collection-stat-filters'),()=>renderCollection());
const run=()=>save.slots.find(slot=>slot.slot_id===activeSlot)?.run;
const runCards=()=>run()?.collection.map(entry=>entry.card)||[];
const dirty=()=>draft&&JSON.stringify(draft.groups)!==JSON.stringify(run()?.active_deck.groups);
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
async function safe(action){try{await action();}catch(error){toast(error.message||'작업을 마치지 못했어.');}}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function confirm(title,text){return new Promise(resolve=>{
  const dialog=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-text').textContent=text;
  let done=false;const finish=value=>{if(done)return;done=true;dialog.close();$('confirm-ok').removeEventListener('click',yes);$('confirm-cancel').removeEventListener('click',no);dialog.removeEventListener('cancel',cancel);resolve(value);};
  const yes=()=>finish(true),no=()=>finish(false),cancel=event=>{event.preventDefault();finish(false);};
  $('confirm-ok').addEventListener('click',yes);$('confirm-cancel').addEventListener('click',no);dialog.addEventListener('cancel',cancel);dialog.showModal();
});}
function readSaved(){
  try{rawSave=localStorage.getItem(STORAGE_KEY);save=readStore(localStorage);blocked=false;externalChange=false;$('save-error').hidden=true;}
  catch(error){blocked=true;$('save-error').hidden=false;$('save-error-text').textContent=`${error.message} 원본을 보존했어. 백업을 받아 확인해줘.`;}
  $('download-raw').disabled=rawSave===null;renderSlots();renderStarters();renderRun();
}
function saveStatus(){
  $('save-status').textContent=blocked?'저장본 보호 중 · 원본을 덮어쓰지 않았어.':externalChange?'다른 창에서 저장이 바뀌었어. 편집본은 유지돼. 저장본 다시 읽기를 눌러줘.':`이 브라우저에 저장 · 버전 ${save.revision} · 시작 덱 ${save.starters.length}개`;
  $('export-save').disabled=blocked;for(const id of ['open-starters','save-run','create-run'])$(id).disabled=blocked||busy||externalChange;
  $('create-run').disabled||=!campaignLibrary164||campaignLoading164||toolStarterLoading||!toolStarterLoaded||!toolStarters.length||!$('start-deck').value||!pendingSlot||Boolean(save.slots.find(s=>s.slot_id===pendingSlot)?.run);
  if(blocked||busy||externalChange)$('commit-deck').disabled=true;
  renderHub152();
}
function setScreen152(screen){document.body.dataset.screen=screen;if(screen==='hub')scrollTo({top:0,behavior:'instant'});}
function renderHub152(){
  const occupied=save.slots.filter(slot=>slot.run),empty=save.slots.find(slot=>!slot.run);
  $('hub152-continue').disabled=blocked||busy||externalChange||!occupied.length;
  $('hub152-new').disabled=blocked||busy||externalChange||!empty;
  $('hub152-status').textContent=blocked?'원정 기록을 확인해줘.':toolStarterLoading?'툴에서 지정한 시작 덱을 불러오는 중…':toolStarterError?`시작 덱을 불러오지 못했어. 시작 덱 보기에서 다시 불러와줘.${occupied.length?' 기존 원정은 이어갈 수 있어.':''}`:toolStarters.length?`${occupied.length?occupied.length+'개의 여정 · ':''}툴에서 지정한 시작 덱 ${toolStarters.length}개`: '툴에서 원정 시작 덱을 지정하고 온라인 저장해줘. 기존 여정은 계속 이어갈 수 있어.';
}
// All new writes share a Web Lock, then compare the revision again inside it.
// A storage event never replaces a draft underneath the player's edits.
async function persist(next,message){
  if(blocked)throw new Error('저장본을 보호하고 있어. 원본 백업부터 확인해줘.');
  if(externalChange)throw new Error('다른 창에서 저장이 바뀌었어. 저장본 다시 읽기로 비교해줘.');
  if(busy)throw new Error('저장 중이야. 잠시 기다려줘.');
  busy=true;embed152.setBusy('storage',true);saveStatus();const expected=save.revision;
  try{
    const write=()=>writeStore(localStorage,next,expected);
    save=navigator.locks?await navigator.locks.request(STORAGE_KEY,write):write();
    rawSave=serializeSave(save);renderSlots();renderStarters();if(message)toast(message);
  }catch(error){
    try{externalChange=readStore(localStorage).revision!==expected;}catch{blocked=true;}
    throw error;
  }finally{busy=false;embed152.setBusy('storage',false);saveStatus();sourceSelected();if(draft)renderEditor();}
}
function renderSlots(){
  $('slots').replaceChildren();
  save.slots.forEach((slot,i)=>{
    const e=node('article',null,`slot ${slot.run?'has-run':'empty'}${activeSlot===slot.slot_id?' selected':''}`);
    e.append(node('span',`SLOT ${i+1}`,'slot-number'));
    const actions=node('div',null,'actions');
    if(slot.run){
      const r=slot.run;e.append(node('h3',r.starter_name),node('p',`${progressText164(r)} · LP ${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()}`),node('p',`메인 ${count(r.active_deck.groups.main)}장 · ${new Date(r.updated_at).toLocaleString('ko-KR')}`));
      const open=button('이어하기',()=>openRun(slot.slot_id),'primary');open.disabled=blocked;
      const remove=button('슬롯 비우기',async()=>{
        if(r.bridge147)throw new Error('게임에 연결된 원정은 게임의 저장 기록에서 관리해. 브라우저에서 지우지 않았어.');
        if(!await confirm('이 원정 슬롯을 비울까?',`${r.starter_name}의 원정 기록과 카드함을 비워. 시작 덱 등록은 유지돼. 필요하면 슬롯 백업을 먼저 받아줘.`))return;
        const next=copy(save);next.slots[i].run=null;await persist(next,'슬롯을 비웠어.');if(activeSlot===slot.slot_id){activeSlot=null;draft=null;renderRun();}
      },'remove');remove.disabled=blocked||externalChange||Boolean(r.bridge147);actions.append(open);
      if(r.bridge147&&bridgeUI?.isLocal()){
        const archive=button('이 여정 마치기',async()=>{
          if(!await confirm('이 여정을 마칠까?',`${r.starter_name}의 기록을 보관하고 이 슬롯을 비워. 이 여정은 더 이상 이어갈 수 없어. 현재 덱 편집은 취소돼.`))return;
          await bridgeUI.archiveRun(r);
        },'remove');archive.disabled=blocked||externalChange||!bridgeUI.canArchive(r);actions.append(archive);
      }else actions.append(remove);
    }else{
      e.append(node('h3','빈 저장 슬롯'),node('p','새 원정의 시작 덱은 매번 자유롭게 골라.'));
      const start=button('시작 덱 고르기',()=>prepareRun(slot.slot_id),'primary');start.disabled=blocked||externalChange;actions.append(start);
    }
    e.append(actions);$('slots').append(e);
  });saveStatus();
}
async function leaveDraft(){if(dirty()&&!await confirm('덱 편집을 취소할까?','아직 저장하지 않은 덱 편집을 취소해. 저장된 덱은 유지돼.'))return false;draft=null;return true;}
async function openRun(slotId){if(!await leaveDraft())return;activeSlot=slotId;setScreen152('run');renderSlots();renderRun();const current=run();if(current.current_node_id)mapView?.scrollToNode(current.current_node_id,{focus:false});else mapView?.scrollToStart({focus:false});$('run-panel').scrollIntoView({behavior:'instant',block:'start'});}
function deckPreview(target,groups,pool,owner=null){
  target.replaceChildren();
  if(owner?.instances163){
    for(const item of instanceCards163(owner,{deckOnly:true})){
      const view=upgradeCopyView166(item),e=button('',()=>showCard(item.card,item));
      e.title=`${view.name} · ${view.copy_label}${view.summary?' · '+view.summary:''}`;e.setAttribute('aria-label',e.title);e.append(img(item.card));decorateCopy166(e,item);
      e.append(node('span',view.copy_label,'copy166-label'));if(view.enhanced)e.append(node('span','강화','forge166-badge'));if(view.seal_remaining)e.append(node('span',`봉인 ${view.seal_remaining}전투`,'seal166-badge'));target.append(e);
    }return;
  }
  for(const group of ['main','extra'])for(const row of groups[group]){
    const card=pool.find(c=>c.identity_key===row.identity_key);if(!card)continue;
    const e=button('',()=>showCard(card));e.title=`${card.name_ko} × ${row.count}`;e.setAttribute('aria-label',e.title);e.append(img(card),node('span',`×${row.count}`,'preview-count'));target.append(e);
  }
}
function renderRun(){
  const r=run();$('run-panel').hidden=!r;$('deck-editor').hidden=!draft||!r;if(!r)return;
  $('run-slot').textContent=`SLOT ${save.slots.findIndex(s=>s.slot_id===activeSlot)+1}`;$('run-title').textContent=r.starter_name;
  $('run-subtitle').textContent=`${r.bridge147?'게임 연결 원정':'원정 준비됨'} · ${r.collection.length}종 ${r.collection.reduce((n,e)=>n+e.count,0)}장 보유`;
  $('run-lp').textContent=`${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()}`;$('run-floor').textContent=progressText164(r);
  renderChapterProgress164(r);
  $('run-gold').textContent=r.gold.toLocaleString();$('run-relics').textContent=`${r.relics.length}개`;
  let tactics=document.getElementById('tactics-hud163');if(!tactics){tactics=node('span',null,'tactics-counter163');tactics.id='tactics-hud163';$('run-relics').parentElement.append(tactics);}tactics.hidden=!r.relics.includes('tactics_manual');if(!tactics.hidden)tactics.textContent=`병법서 ${r.runtime163?.draw_progress??0} / ${r.content163?.document.relics.find(x=>x.id==='tactics_manual')?.params.threshold??10}`;
  $('deck-counts').textContent=`메인 ${count(r.active_deck.groups.main)}장 · 엑스트라 ${count(r.active_deck.groups.extra)}장`;
  deckPreview($('deck-preview'),r.active_deck.groups,runCards(),r);$('map-seed').textContent=`지도 시드: ${r.seed}`;renderMap(r);
  $('edit-deck').disabled=blocked||externalChange||!['between_nodes','at_node'].includes(r.state)||(Boolean(r.bridge147)&&!bridgeUI?.isBound(r));
  $('resume-stage').hidden=Boolean(r.bridge147)&&!(r.nodes163??r.nodes159??r.nodes158)?.pending_reward&&!r.runtime163?.rest_reward&&r.opening163?.status!=='pending'&&!(r.content163&&pendingForge163(r))&&!pendingEnhancement166(r)&&!['prepared','duel_started','interrupted','reward_pending'].includes(r.bridge147.phase)&&!['defeated','completed'].includes(r.state);
  $('resume-stage').textContent=r.opening163?.status==='pending'?'시작 보상 선택':pendingEnhancement166(r)?'강화할 카드 선택':r.content163&&pendingForge163(r)?'제련할 카드 선택':r.runtime163?.rest_reward?'휴식 카드 보상':r.bridge147?'진행 확인':'게임 연결';
  $('resume-current').hidden=r.state!=='at_node';
  if($('run-deck-dialog').open)renderCollectionSummary153();
  if(draft)renderEditor();saveStatus();bridgeUI?.render();syncGameAudio163(embed152.state());
  const reachable=r.bridge147&&bridgeUI?.isLocal()?new Set(reachableNodes(r)):new Set();
  for(const tile of $('run-map').querySelectorAll('[data-node-id]')){
    tile.classList.toggle('current-run-node',tile.dataset.nodeId===r.current_node_id);tile.classList.toggle('run-next-node',r.state==='between_nodes'&&reachable.has(tile.dataset.nodeId));
  }
}
function renderCollectionSummary153(){
  const current=run();if(!current)return;
  const root=$('run-collection-preview');root.replaceChildren();$('run-collection-count').textContent=`${current.collection.length}종 · ${current.collection.reduce((sum,entry)=>sum+entry.count,0)}장`;
  for(const entry of current.collection){const tile=node('article'),art=button('',()=>showCard(entry.card));art.append(img(entry.card));art.setAttribute('aria-label',`${entry.card.name_ko} 효과 보기`);tile.append(art,node('strong',entry.card.name_ko),node('span',`보유 ${entry.count}장`));root.append(tile);}
}
function renderChapterProgress164(r){
  const root=$('chapter-progress164');root.replaceChildren();root.hidden=!r.campaign164;
  if(!r.campaign164)return;
  const current=chapter164(r),document=r.campaign164.library.document;
  document.chapters.forEach((entry,i)=>{const item=node('span',`${i+1}장 · ${entry.name}`,'chapter164-step');item.dataset.state=i+1<current||r.state==='completed'?'cleared':i+1===current?'current':'locked';item.append(node('small',i+1<current||r.state==='completed'?'클리어':i+1===current?'도전 중':'봉인됨'));root.append(item);});
  $('tower-map-title').textContent=`${current}장 · ${document.chapters[current-1].name}`;
}
function renderMap(r){
  const visibleMap=r.campaign164?chapterViewMap164(r.map,chapter164(r)):r.map;
  const root=$('run-map'),key=`${r.id}:${chapter164(r)}:${JSON.stringify(visibleMap)}:${JSON.stringify(r.encounters)}`;
  if(mapViewKey!==key){
    mapView?.destroy();mapView=null;mapViewKey=key;root.replaceChildren();
    if(!r.map){root.append(node('p','이 백업에는 아직 지도가 없어.','muted'));mapDetails(r,null);return;}
    if(!visibleMap.nodes.some(n=>n.id===mapSelections.get(r.id)))mapSelections.delete(r.id);
    mapView=renderTowerMap(root,visibleMap,{encounters:r.encounters,selectedNodeId:mapSelections.get(r.id)||null,onNode:entry=>{mapSelections.set(r.id,entry.id);mapDetails(r,entry);}});
    if(visibleMap.floors>=15)root.prepend(node('p','↔ 좁은 화면에서는 지도를 좌우로 움직여 상대와 길을 확인해.','muted map-gesture-hint'));
  }
  const selected=visibleMap?.nodes.find(n=>n.id===mapSelections.get(r.id));mapDetails(r,selected||null);
}
function mapDetails(r,entry){
  const opponent=entry&&r.encounters?.[entry.id];
  $('map-selected-title').textContent=entry?`${entry.floor}층 · ${nodeLabel(entry.kind)}${opponent?' · '+opponent.opponent_name:''}`:'첫 관문에서 봉인의 중심까지';
  $('map-selected-summary').textContent=entry?entry.next.length?`이 칸에서 다음 ${entry.floor+1}층으로 이어지는 길 ${entry.next.length}개를 강조했어.`:r.campaign164&&chapter164(r)<3?'이 장의 보스를 이기고 카드 보상을 고르면 다음 장이 열려.':'탑의 마지막 관문이야.':'칸을 누르면 그곳에서 이어지는 루트를 볼 수 있어. 점선은 저장된 지도에서 연결된 길이야.';
  $('map-selected-icon').hidden=!entry;if(entry)$('map-selected-icon').src=MAP_ASSETS[entry.kind];
  $('inspect-map-node').disabled=!entry;$('inspect-map-node').textContent=entry&&['battle','elite','boss','midboss'].includes(entry.kind)?'상대 확인 · 전투':'칸 자세히 보기';$('map-route-status').textContent=entry?`${entry.floor}층 ${nodeLabel(entry.kind)} 루트 미리보기. 원정 진행도는 유지돼.`:'전체 루트 미리보기 · 아래에서 위로 올라가';
}
function showNode(entry,r){
  if(r.campaign164)entry={...entry,floor:localFloor164(r,entry.floor),next:entry.next.filter(id=>Math.ceil(r.map.nodes.find(n=>n.id===id).floor/15)===chapter164(r))};
  $('node-title').textContent=`${r.campaign164?chapter164(r)+'장 · ':''}${entry.floor}층 · ${nodeLabel(entry.kind)}`;
  const bound=bridgeUI?.isBound(r);$('node-dialog').dataset.bound=String(Boolean(bound));
  let text=bound?({battle:'상대와 덱을 확인한 뒤 전투를 준비해.',elite:'강한 상대와의 듀얼. 승리하면 더 좋은 보상과 유물을 얻어.',boss:r.campaign164&&chapter164(r)<3?'이 장의 마지막 관문. 승리 카드 보상을 고르면 다음 장이 열려.':'탑의 마지막 관문. 덱을 정비하고 전투를 준비해.',event:'이곳에서 마주친 사건과 선택지를 확인해.',shop:'현재 원정 금화로 카드와 유물을 사고 덱을 정비할 수 있어.',rest:'세 가지 휴식 중 한 가지를 골라줘.'}[entry.kind]||nodeSummary(entry.kind)):nodeSummary(entry.kind);
  const opponent=r.encounters?.[entry.id],opponentRoot=$('node-opponent');opponentRoot.replaceChildren();opponentRoot.hidden=!opponent;
  if(opponent){
    const info=node('div');info.append(node('h3',opponent.opponent_name),node('p',`사용 덱 · ${opponent.deck_name}`),node('p',`전투 · ${opponent.battle_name} / AI 난이도 ${opponent.difficulty}`,'muted'));
    const bonus=opponent.skills?.find(s=>s.kind==='lp_bonus')?.amount??opponent.skills?.find(s=>s.kind==='lp_bonus')?.value??0;
    if(r.campaign164)info.append(node('p',`시작 LP · ${(4000+bonus).toLocaleString()}`,'enemy-lp164'));
    if(opponent.skills?.length){const list=node('ul',null,'enemy-traits164');for(const skill of opponent.skills){const value=skill.value??skill.amount;list.append(node('li',`${SKILLS[skill.kind]??skill.kind}${value!=null?' · '+value:''}${skill.card?.name_ko?' · '+skill.card.name_ko:''}`));}info.append(list);}
    const details=node('details'),summary=node('summary','상대 덱 카드 보기'),preview=node('div',null,'deck-preview');deckPreview(preview,opponent.deck.groups,cards);details.append(summary,preview);info.append(details);opponentRoot.append(info);
  }
  if(['battle','elite','midboss','boss'].includes(entry.kind)){
    const policy=rewardPolicy(entry.kind,(r.content163||r.content158)?r:r.relics||[]);
    text+=`\n\n승리 보상 설정 · ${policy.gold} 금화 / 카드 ${policy.card_choices}개 후보 중 1장${policy.min_rarity==='N'?'':` (후보에 ${policy.min_rarity} 이상 1장 보장)`}${policy.relic?' / 유물 1개':''}`;
    if(!opponent)text+='\n이전 저장 지도에는 상대가 아직 지정되지 않았어. 새 원정부터 상대가 표시돼.';
  }
  if(entry.kind==='event'&&!bound){
    text+='\n\n상처를 돌보거나, 카드를 바꾸거나, 유물을 발견할지도 몰라. 도착해서 사건을 확인하고 선택해줘.';
  }else if(entry.kind==='rest')text+=`\n\n${TOWER_THEME.rest_text}`;
  else if(entry.kind==='midboss'||entry.kind==='elite')text+=`\n\n${TOWER_THEME.elite_text}`;
  else if(entry.kind==='boss')text+=`\n\n${r.campaign164&&chapter164(r)<3?['천년 문양이 새겨진 문 앞에서 한 듀얼리스트가 길을 막는다. 첫 봉인을 풀어야 탑 안쪽으로 들어갈 수 있다.','기둥 사이를 흐르는 빛이 하나의 결투장에 모인다. 이 관문을 넘으면 마지막 봉인으로 향하는 길이 열린다.'][chapter164(r)-1]:TOWER_THEME.boss_text}`;
  const next=entry.next.map(id=>r.map.nodes.find(n=>n.id===id)).filter(Boolean);if(next.length)text+=`\n\n다음 길: ${next.map(n=>`${localFloor164(r,n.floor)}층 ${nodeLabel(n.kind)}${r.encounters?.[n.id]?' · '+r.encounters[n.id].opponent_name:''}`).join(' / ')}`;
  $('rest-preview').hidden=entry.kind!=='rest'||bound;if(entry.kind==='rest'&&!bound)renderRestPreview(entry,r);
  $('node-description').textContent=text;bridgeUI?.renderNode(entry,r,!r.id);$('node-dialog').showModal();
}
function renderRestPreview(entry,r){
  const root=$('rest-choices');root.replaceChildren();$('rest-result').textContent='한 장소에서 한 가지만 선택할 수 있어.';
  for(const choice of REST_CHOICES){
    const action=button('',()=>{
      const result=restOutcome({lp:2400,max_lp:4000,relics:[],seed:r.map.seed,nodeId:entry.id},choice.id);
      for(const control of root.querySelectorAll('button'))control.disabled=true;
      action.classList.add('chosen');
      const relic=RELICS.find(item=>item.id===result.relic_id);
      $('rest-result').textContent=`${choice.name} 선택 · LP ${result.lp.toLocaleString()} / ${result.max_lp.toLocaleString()}${relic?'\n획득: '+relic.name+' — '+relic.description:''}\n체험 결과야. 원정 저장은 바뀌지 않았어.`;
    },'rest-choice');
    action.dataset.choice=choice.id;action.append(node('strong',choice.name),node('span',choice.description));root.append(action);
  }
}
function opponentPoolReady(){return encounterKinds.every(kind=>opponentPool.some(entry=>entry.allowed_kinds.includes(kind)));}
function renderOpponentPool(){
  const root=$('opponent-pool'),query=$('opponent-search').value.trim().toLocaleLowerCase('ko');root.replaceChildren();
  $('opponent-source-status').textContent=opponentLoadError||opponentSource||'상대 자료를 읽는 중…';
  $('opponent-counts').textContent=encounterKinds.map(kind=>`${nodeLabel(kind)} ${opponentPool.filter(entry=>entry.allowed_kinds.includes(kind)).length}개`).join(' · ')+(opponentPoolReady()?'':' · 각 종류에서 상대를 하나 이상 골라줘.');
  for(const entry of opponentPool){
    if(query&&!`${entry.opponent_name} ${entry.deck_name} ${entry.battle_name}`.toLocaleLowerCase('ko').includes(query))continue;
    const row=node('fieldset',null,'opponent-row');row.append(node('legend',entry.opponent_name),node('p',`${entry.deck_name} · ${entry.battle_name} · 난이도 ${entry.difficulty}`));
    const choices=node('div',null,'opponent-tiers');
    for(const kind of encounterKinds){const label=node('label'),control=node('input');control.type='checkbox';control.checked=entry.allowed_kinds.includes(kind);control.setAttribute('aria-label',`${entry.opponent_name} ${entry.battle_name} ${nodeLabel(kind)}`);
      control.addEventListener('change',()=>{entry.allowed_kinds=encounterKinds.filter(value=>value===kind?control.checked:entry.allowed_kinds.includes(value));$('opponent-counts').textContent=encounterKinds.map(value=>`${nodeLabel(value)} ${opponentPool.filter(item=>item.allowed_kinds.includes(value)).length}개`).join(' · ')+(opponentPoolReady()?'':' · 각 종류에서 상대를 하나 이상 골라줘.');saveStatus();});label.append(control,document.createTextNode(nodeLabel(kind)));choices.append(label);}
    row.append(choices);root.append(row);
  }saveStatus();
}
async function loadOpponentPool(){
  try{const response=await fetch('data/roguelite-opponents.json?v=20261014-138',{cache:'no-store'});if(!response.ok)throw new Error('상대 자료를 읽지 못했어.');const data=await response.json();defaultOpponentPool=cleanEncounterPool(data.pool);opponentPool=copy(defaultOpponentPool);opponentSource='설치된 AI 배틀에서 준비한 상대 풀 · 출현 종류를 자유롭게 바꿀 수 있어.';opponentLoadError='';}
  catch(error){opponentLoadError=error.message+' 새로고침하거나 이 브라우저의 AI 배틀에서 읽어줘.';}
  renderOpponentPool();
}
function showCard(card,instance=null){
  $('card-title').textContent=card.name_ko;const root=$('card-detail');root.replaceChildren();root.append(img(card));const info=node('div');
  info.append(node('p',`${card.rarity} · ${card.type}${card.subtype?' · '+card.subtype:''}`),node('p',[card.race,card.attribute,card.level==null?'':`★ ${card.level}`].filter(Boolean).join(' · ')));
  if(card.atk!=null){const view=instance?upgradeCopyView166(instance):null;info.append(node('p',`ATK ${(view?.atk??card.atk)<0?'?':view?.atk??card.atk} / DEF ${(view?.def??card.def)<0?'?':view?.def??card.def}`));}if(instance){decorateCopy166(root,instance);appendCopyDetails166(info,instance,node);}else root.classList.remove('secret-rare166','sealed166');
  info.append(node('p',card.description_ko||'설명 없음','effect'),node('p',card.speed_limit==null?'스피드 듀얼: 같은 카드 3장까지':card.speed_limit===0?'스피드 듀얼: 금지':`스피드 듀얼: 제한 ${card.speed_limit} 그룹 합계 ${card.speed_limit}장`,'muted'));
  if(card.tags?.length)info.append(node('p',card.tags.map(t=>'#'+t).join(' '),'muted'));root.append(info);$('card-dialog').showModal();
}
function renderStarters(){
  const root=$('starter-list');root.replaceChildren();
  $('tool-starter-status').textContent=toolStarterLoading?'시작 덱을 불러오는 중…':toolStarterError||(!toolStarters.length?'지정된 시작 덱이 없어. 툴에서 원정 시작 덱을 지정한 뒤 온라인 저장해줘.':`원정 시작 덱 ${toolStarters.length}개 · 새로운 여정에서 선택할 수 있어.`);
  $('reload-tool-starters').disabled=toolStarterLoading;
  for(const starter of toolStarters){
    const e=node('div',null,'starter-item'),info=node('div');info.append(node('strong',starter.name),node('p',`메인 ${count(starter.groups.main)} · 엑스트라 ${count(starter.groups.extra)} · 카드함 ${starter.collection.reduce((n,c)=>n+c.count,0)}장`));e.append(info);
    const preview=node('div',null,'deck-preview');deckPreview(preview,starter.groups,starter.collection.map(e=>e.card));e.append(preview);root.append(e);
  }
}
async function refreshToolStarters153(){
  if(toolStarterRequest)return toolStarterRequest;
  toolStarterLoading=true;toolStarterError='';renderStarters();saveStatus();
  toolStarterRequest=(async()=>{try{const data=await loadToolStarters153({config:BRIDGE,cards,fetcher:fetch});toolStarters=data.starters;toolStarterLoaded=true;return true;}
  catch(error){toolStarters=[];toolStarterLoaded=false;toolStarterError=error.message||'시작 덱을 불러오지 못했어.';return false;}
  finally{toolStarterLoading=false;toolStarterRequest=null;renderStarters();saveStatus();}})();return toolStarterRequest;
}
function setSources(decks,pool,label){
  sourceDecks=decks.filter(deck=>deck.ruleset==='duel_links_plan');sourceCards=pool;
  $('source-deck').replaceChildren(option(sourceDecks.length?'덱을 선택해줘.':'스피드 듀얼 덱이 없어.',''));
  sourceDecks.forEach((deck,i)=>$('source-deck').append(option(deck.name,String(i))));
  $('source-status').textContent=`${label} · 스피드 듀얼 덱 ${sourceDecks.length}개`;$('starter-name').value='';sourceSelected();
}
function sourceSelected(){
  const deck=$('source-deck').value===''?null:sourceDecks[Number($('source-deck').value)];let problem='';
  if(deck){const check=validatePlayerDeck(deck,sourceCards,{allowSide:true});problem=check.issues.join('\n');$('source-summary').textContent=`메인 ${count(deck.groups.main)} · 엑스트라 ${count(deck.groups.extra)} · 예비 ${count(deck.groups.side)}장. 예비 카드는 원정 카드함에 보관해.`;}
  else $('source-summary').textContent='';$('source-issues').textContent=problem;
  $('register-starter').disabled=!deck||!!problem||blocked||externalChange||sourceBusy||busy;
}
async function readSources(loader){
  if(sourceBusy)return;sourceBusy=true;$('source-status').textContent='덱을 읽는 중…';for(const id of ['load-installed-decks','load-browser-decks','load-online-decks','import-decks'])$(id).disabled=true;sourceSelected();
  try{await loader();}catch(error){$('source-status').textContent=`읽지 못했어: ${error.message} 기존 선택은 유지돼.`;}
  finally{sourceBusy=false;for(const id of ['load-installed-decks','load-browser-decks','load-online-decks','import-decks'])$(id).disabled=false;sourceSelected();}
}
async function prepareRun(slotId=null){
  if(!await leaveDraft())return;renderRun();
  newRunRequested164=true;pendingSlot=slotId;await refreshToolStarters153();if(!toolStarters.length){$('starter-dialog').showModal();return;}
  $('start-deck').replaceChildren(option('시작 덱을 골라줘.',''),...toolStarters.map(s=>option(s.name,s.starter_id)));
  $('run-seed-input').value='';renderStarterChoices164();renderSlotChoices164();previewStarter();renderCampaign164();$('new-run-dialog').showModal();
  if(!campaignLibrary164)await refreshCampaign164();saveStatus();
}
function renderStarterChoices164(){
  const root=$('starter-choices164');root.replaceChildren();
  for(const starter of toolStarters){const choose=button('',()=>{$('start-deck').value=starter.starter_id;renderStarterChoices164();previewStarter();saveStatus();},'starter-choice164');choose.dataset.starterId=starter.starter_id;choose.setAttribute('aria-pressed',String($('start-deck').value===starter.starter_id));const art=node('div',null,'starter-choice-art164');for(const row of starter.groups.main.slice(0,3)){const card=starter.collection.find(e=>e.card.identity_key===row.identity_key)?.card;if(card)art.append(img(card));}choose.append(art,node('strong',starter.name),node('span',`메인 ${count(starter.groups.main)}장 · 엑스트라 ${count(starter.groups.extra)}장`));root.append(choose);}
}
function renderSlotChoices164(){
  const root=$('save-slot-choices164');root.replaceChildren();
  for(const [index,slot] of save.slots.entries()){const choose=button(`SLOT ${index+1} · ${slot.run?'진행 중':'비어 있음'}`,()=>{pendingSlot=slot.slot_id;renderSlotChoices164();saveStatus();},'save-slot-choice164');choose.disabled=Boolean(slot.run);choose.setAttribute('aria-pressed',String(slot.slot_id===pendingSlot));root.append(choose);}
  $('new-run-slot').textContent=pendingSlot?'이 슬롯에 이번 여정의 진행을 저장해. 다음 새 원정에서는 다른 덱을 골라도 돼.':'덱을 고른 뒤 진행을 보관할 빈 슬롯을 골라줘.';
}
function renderCampaign164(){
  const root=$('campaign-summary164');root.replaceChildren();
  $('campaign-status164').textContent=campaignLoading164?'장별 상대 설정을 읽는 중…':campaignError164|| (campaignLibrary164?`3개 장 · 장마다 15층 · 설정 버전 ${campaignLibrary164.version}`:'장별 상대 설정을 불러와줘.');
  if(!campaignLibrary164)return;
  for(const chapter of campaignLibrary164.document.chapters){const row=node('article');row.append(node('h4',chapter.name));for(const kind of encounterKinds){const group=chapter[kind];row.append(node('p',`${nodeLabel(kind)} · 상대 ${group.pool.length}개 · LP +${group.lp_bonus.toLocaleString()}${group.traits.length?' · 추가 특성 '+group.traits.length+'개':''}`));}root.append(row);}
}
async function refreshCampaign164(){
  if(campaignLoading164)return;campaignLoading164=true;campaignError164='';renderCampaign164();saveStatus();
  try{campaignLibrary164=await loadCampaign164({config:BRIDGE,cards,fetcher:fetch});}
  catch(error){campaignError164=error.message;}
  finally{campaignLoading164=false;renderCampaign164();saveStatus();}
}
function previewStarter(){const starter=toolStarters.find(s=>s.starter_id===$('start-deck').value),target=$('starter-preview');target.replaceChildren();if(!starter)return;target.append(node('p',`LP 4,000 · 메인 ${count(starter.groups.main)} · 엑스트라 ${count(starter.groups.extra)}`));const preview=node('div',null,'deck-preview');deckPreview(preview,starter.groups,starter.collection.map(e=>e.card));target.append(preview);}
function filterOptions(){for(const [id,key]of [['collection-type','type'],['collection-race','race'],['collection-attribute','attribute']]){const select=$(id);select.replaceChildren(option('전체',''),...[...new Set(runCards().map(c=>c[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')).map(v=>option(v,v)));}for(const id of ['collection-search','collection-rarity'])$(id).value='';$('collection-sort').value='name';statFilters.reset();}
function renderEditor(){
  if(!draft)return;const r=run(),pool=runCards();const check=validatePlayerDeck({...r.active_deck,groups:draft.groups},pool);
  $('deck-editor').hidden=false;$('editor-counts').textContent=`메인 ${count(draft.groups.main)} / 20~30장 · 엑스트라 ${count(draft.groups.extra)} / 15장`;
  $('editor-issues').textContent=externalChange?'다른 창에서 저장이 바뀌었어. 이 편집본은 유지돼. 저장본을 다시 읽어줘.':check.issues.join('\n');
  $('commit-deck').disabled=!check.valid||blocked||externalChange||busy;
  for(const group of ['main','extra']){
    $(`${group}-count`).textContent=`${count(draft.groups[group])}장`;
    // Keep existing controls mounted so repeated taps never lose focus or scroll.
    const root=$(`${group}-rows`),wanted=new Set(draft.groups[group].map(row=>row.identity_key));
    for(const child of [...root.children])if(!wanted.has(child.dataset.key))child.remove();
    if(!wanted.size){if(!root.querySelector('.empty-row'))root.append(node('p','아직 카드가 없어.','empty-row muted'));}else root.querySelector('.empty-row')?.remove();
    for(const row of draft.groups[group]){
      const card=pool.find(c=>c.identity_key===row.identity_key);let e=[...root.children].find(c=>c.dataset.key===row.identity_key);
      if(!e){e=node('div',null,'deck-row');e.dataset.key=row.identity_key;e.append(img(card),button(card.name_ko,()=>showCard(card),'card-link'));const q=node('div',null,'quantity');
        const minus=button('−',()=>changeDeck(card.identity_key,group,-1));minus.setAttribute('aria-label',`${card.name_ko} 한 장 빼기`);const plus=button('+',()=>changeDeck(card.identity_key,group,1));plus.setAttribute('aria-label',`${card.name_ko} 한 장 넣기`);q.append(minus,node('span',null,'used-count'),plus);e.append(q);root.append(e);}
      e.querySelector('.used-count').textContent=`${row.count}`;const plus=e.querySelector('.quantity button:last-child');plus.disabled=!canAdd(card,group);
    }
  }renderCopyList166();renderCollection();
}
function renderCopyList166(){
  const r=run();if(!r?.instances163)return;
  let details=document.getElementById('copy166-editor-list');if(!details){details=node('details',null,'copy166-editor-list');details.id='copy166-editor-list';$('deck-editor').append(details);}details.replaceChildren(node('summary','내 카드 한 장씩 · 강화와 봉인 확인'));
  const list=node('div',null,'copy166-grid');for(const item of instanceCards163(r)){const view=upgradeCopyView166(item),b=button('',()=>showCard(item.card,item),'copy166-tile');b.append(img(item.card),node('strong',view.name),node('small',view.copy_label),node('p',view.summary||'원본 카드'));decorateCopy166(b,item);list.append(b);}details.append(list);
}
function canAdd(card,group){try{adjustRunDeck(run(),draft,card.identity_key,group,1);return !externalChange&&!blocked;}catch{return false;}}
function changeDeck(key,group,delta){if(busy||externalChange||blocked)throw new Error('저장 또는 새 저장본 확인을 마친 뒤 편집해줘.');draft=adjustRunDeck(run(),draft,key,group,delta);renderEditor();}
function renderCollection(){
  if(!draft)return;const r=run(),root=$('collection-cards');const search=$('collection-search').value.trim().toLocaleLowerCase('ko').replace(/^#/,'');
  const filtered=r.collection.filter(({card})=>{
    for(const [id,key]of [['collection-type','type'],['collection-race','race'],['collection-attribute','attribute'],['collection-rarity','rarity']])if($(id).value&&card[key]!==$(id).value)return false;
    if(search&&!`${card.name_ko} ${card.name_en} ${card.description_ko} ${card.slot} ${card.internal_id} ${(card.tags||[]).join(' ')}`.toLocaleLowerCase('ko').includes(search))return false;
    return statConditionsMatch(card,statFilters.values());
  });
  const order=$('collection-sort').value,ranks={L:5,UR:4,SR:3,R:2,N:1};filtered.sort((a,b)=>{
    const key=order==='attack'?'atk':order==='level'?'level':null;return (order==='rarity'?(ranks[b.card.rarity]-ranks[a.card.rarity]):key?(b.card[key]??-1)-(a.card[key]??-1):0)||a.card.name_ko.localeCompare(b.card.name_ko,'ko');
  });$('collection-result').textContent=`${filtered.length} / ${r.collection.length}종 · 카드 그림을 누르면 효과를 볼 수 있어.`;
  const keys=new Set(filtered.map(e=>e.card.identity_key));for(const e of [...root.children])if(!keys.has(e.dataset.key))e.remove();
  for(const entry of filtered){const card=entry.card,group=card.type==='융합 몬스터'?'extra':'main';let tile=[...root.children].find(e=>e.dataset.key===card.identity_key);
    if(!tile){tile=node('article',null,'collection-card');tile.dataset.key=card.identity_key;const art=button('',()=>showCard(card),'art-button');art.setAttribute('aria-label',`${card.name_ko} 효과 보기`);art.append(img(card));tile.append(art,node('strong',card.name_ko),node('p',`${card.rarity} · ${card.type}`),node('p',null,'owned-count'),button(group==='extra'?'+ 엑스트라에 넣기':'+ 메인에 넣기',()=>changeDeck(card.identity_key,group,1),'add-card'));}
    const used=['main','extra'].reduce((n,g)=>n+(draft.groups[g].find(row=>row.identity_key===card.identity_key)?.count||0),0);tile.querySelector('.owned-count').textContent=`보유 ${entry.count} · 덱 ${used}`;tile.querySelector('.add-card').disabled=!canAdd(card,group);
    const index=filtered.indexOf(entry);if(root.children[index]!==tile)root.insertBefore(tile,root.children[index]||null);
  }
}
async function fileText(input){const file=input.files?.[0];input.value='';if(!file)return null;if(file.size>8_000_000)throw new Error('8MB 이하 JSON 파일을 선택해줘.');return file.text();}
for(const [buttonId,dialogId]of [['close-starters','starter-dialog'],['close-new-run','new-run-dialog'],['close-card','card-dialog'],['close-node','node-dialog'],['close-intro','intro-dialog'],['close-run-deck','run-deck-dialog'],['close-run-stage','run-stage-dialog'],['close-run-relics','run-relic-dialog']])$(buttonId).addEventListener('click',()=>$(dialogId).close());
$('open-run-deck').addEventListener('click',()=>{renderCollectionSummary153();$('run-deck-dialog').showModal();});
$('open-run-relics').addEventListener('click',()=>$('run-relic-dialog').showModal());
$('resume-stage').addEventListener('click',()=>$('run-stage-dialog').showModal());
$('resume-current').addEventListener('click',()=>{const current=run(),entry=current?.map.nodes.find(item=>item.id===current.current_node_id);if(entry)showNode(entry,current);});
async function closeEditor153(){if(!await leaveDraft())return;$('deck-editor-dialog').close();renderRun();}
$('close-deck-editor').addEventListener('click',()=>safe(closeEditor153));
$('deck-editor-dialog').addEventListener('cancel',event=>{event.preventDefault();safe(closeEditor153);});
$('hub-back').addEventListener('click',()=>safe(async()=>{if(!await leaveDraft())return;setScreen152('hub');renderRun();}));
$('hub152-continue').addEventListener('click',()=>safe(async()=>{const slot=save.slots.filter(s=>s.run).sort((a,b)=>new Date(b.run.updated_at)-new Date(a.run.updated_at))[0];if(slot)await openRun(slot.slot_id);}));
$('hub152-new').addEventListener('click',()=>safe(async()=>{if(!save.slots.some(s=>!s.run))throw new Error('빈 원정 슬롯을 골라줘.');await prepareRun();}));
$('embed152-retry').addEventListener('click',()=>embed152.announce());
$('game152-close').addEventListener('click',()=>{if(bridgeUI?.canReturnToGame166?.()===false){toast('마도서 효과로 패에 넣을 마법 카드 1장을 먼저 골라줘.');return;}if(!embed152.requestClose())toast('원정 기록을 저장하고 있어. 잠시 뒤 다시 눌러줘.');});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){event.preventDefault();if(bridgeUI?.canReturnToGame166?.()===false){toast('마도서의 마법 카드 선택을 먼저 마쳐줘.');return;}if(!embed152.requestClose())toast('원정 기록을 저장한 뒤 돌아갈 수 있어.');}});
$('open-starters').addEventListener('click',()=>{$('starter-dialog').showModal();safe(refreshToolStarters153);});
$('reload-tool-starters').addEventListener('click',()=>safe(async()=>{await refreshToolStarters153();if(toolStarters.length&&newRunRequested164&&!save.slots.find(s=>s.slot_id===pendingSlot)?.run){$('starter-dialog').close();await prepareRun(pendingSlot);}}));
$('load-installed-decks').addEventListener('click',()=>readSources(async()=>{const response=await fetch('./data/ai-opponents.json',{cache:'no-store'});if(!response.ok)throw new Error('게임의 AI 덱을 읽지 못했어.');setSources(importedDecks(await response.json(),cards),cards,'게임에 설치된 덱');}));
$('load-browser-decks').addEventListener('click',()=>readSources(async()=>setSources(browserDecks(localStorage,cards),cards,'브라우저 편집본')));
$('load-online-decks').addEventListener('click',()=>readSources(async()=>{const data=await onlineDecks(cards,meta,{createClient});setSources(data.decks,data.cards,'온라인 저장본');if(data.tagsMessage)$('source-status').textContent+=' · '+data.tagsMessage;}));
$('source-deck').addEventListener('change',()=>{const deck=sourceDecks[Number($('source-deck').value)];$('starter-name').value=$('source-deck').value===''?'':deck?.name||'';sourceSelected();});
$('start-deck').addEventListener('change',()=>{renderStarterChoices164();previewStarter();saveStatus();});
$('reload-campaign164').addEventListener('click',()=>safe(refreshCampaign164));
$('create-run').addEventListener('click',()=>safe(async()=>{
  const starter=toolStarters.find(s=>s.starter_id===$('start-deck').value);if(!starter||!pendingSlot)throw new Error('시작 덱과 슬롯을 선택해줘.');
  if(save.slots.find(s=>s.slot_id===pendingSlot)?.run)throw new Error('이 슬롯에는 원정이 있어. 빈 슬롯을 골라줘.');
  if(!campaignLibrary164)throw new Error('장별 상대 설정을 먼저 불러와줘.');
  let r=createRun({id:crypto.randomUUID(),slotId:pendingSlot,starter,cards:starter.collection.map(entry=>entry.card),catalogVersion:meta.dataset_id,seed:$('run-seed-input').value.trim().normalize('NFC')||crypto.randomUUID()});
  r=initCampaign164(r,campaignLibrary164,cards);
  const next=copy(save);next.slots.find(s=>s.slot_id===pendingSlot).run=r;await persist(next,'새 원정을 저장했어.');newRunRequested164=false;$('new-run-dialog').close();activeSlot=pendingSlot;draft=null;setScreen152('run');renderSlots();renderRun();
  if(embed152.state().connected&&bridgeUI?.isLocal())await bridgeUI.command('bind',{},r);
  $('run-panel').scrollIntoView({behavior:'instant',block:'start'});
}));
$('close-run').addEventListener('click',()=>safe(async()=>{if(!await leaveDraft())return;activeSlot=null;setScreen152('hub');renderSlots();renderRun();}));
$('save-run').addEventListener('click',()=>safe(async()=>{if(draft)throw new Error('편집 중인 덱은 아래의 덱 저장을 눌러줘.');await persist(copy(save),'원정 저장을 확인했어.');renderRun();}));
$('edit-deck').addEventListener('click',()=>safe(()=>{
  if(!draft){draft=beginDeckEdit(run());for(const id of ['main-rows','extra-rows','collection-cards'])$(id).replaceChildren();filterOptions();renderEditor();}
  $('run-deck-dialog').close();if(!$('deck-editor-dialog').open)$('deck-editor-dialog').showModal();$('deck-editor-dialog').scrollTop=0;
}));
$('discard-deck').addEventListener('click',()=>safe(closeEditor153));
$('commit-deck').addEventListener('click',()=>safe(async()=>{if(run()?.bridge147){if(!bridgeUI?.isBound(run()))throw new Error('게임 실행기의 원정 화면에서 덱을 저장해줘.');await bridgeUI.syncDeck(draft);draft=null;$('deck-editor-dialog').close();renderRun();return;}const changed=commitRunDeck(run(),draft);const next=copy(save);next.slots.find(s=>s.slot_id===activeSlot).run=changed;await persist(next,'원정 덱을 저장했어.');draft=null;$('deck-editor-dialog').close();renderRun();}));
for(const id of ['collection-search','collection-type','collection-race','collection-attribute','collection-rarity','collection-sort'])$(id).addEventListener(id==='collection-search'?'input':'change',renderCollection);
$('reset-collection').addEventListener('click',()=>{filterOptions();renderCollection();});
$('view-intro').addEventListener('click',()=>$('intro-dialog').showModal());
let demoView=null,demoMap=null;
function drawDemo(){
  if(!campaignLibrary164)throw new Error(campaignError164||'장별 상대 설정을 읽고 있어. 잠시 후 다시 눌러줘.');
  const fullMap=generateMap(crypto.randomUUID()),encounters=assignCampaignEncounters164(fullMap,campaignLibrary164,cards),map=chapterViewMap164(fullMap,1);
  demoMap=map;demoView?.destroy();renderMapLegend($('map-demo-legend'));$('demo-seed').textContent=`1장 · 15층 · ${map.nodes.length}개 지점 · 시드 ${map.seed}`;
  demoView=renderTowerMap($('map-demo'),map,{encounters,onNode:entry=>showNode(entry,{map,encounters,relics:[]})});
  $('map-demo').prepend(node('p','↔ 좁은 화면에서는 지도를 좌우로 움직여 상대와 길을 확인해.','muted map-gesture-hint'));
}
$('open-map-demo').addEventListener('click',()=>safe(()=>{drawDemo();$('map-demo-dialog').showModal();}));
$('reroll-map-demo').addEventListener('click',()=>safe(drawDemo));
$('demo-to-top').addEventListener('click',()=>demoView?.scrollToNode(demoMap?.nodes.find(n=>n.kind==='boss')?.id,{focus:true}));
$('demo-to-start').addEventListener('click',()=>demoView?.scrollToStart({focus:true}));
$('close-map-demo').addEventListener('click',()=>$('map-demo-dialog').close());
$('map-demo-dialog').addEventListener('close',()=>{demoView?.destroy();demoView=null;$('map-demo-legend').replaceChildren();});
$('reset-map-route').addEventListener('click',()=>{const r=run();if(!r)return;mapSelections.delete(r.id);mapView?.setSelection(null);mapDetails(r,null);});
$('map-to-start').addEventListener('click',()=>mapView?.scrollToStart({focus:true,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}));
$('map-to-top').addEventListener('click',()=>{const r=run();mapView?.scrollToNode(r?.map?.nodes.find(n=>n.kind==='boss'&&(!r.campaign164||n.floor===chapter164(r)*15))?.id,{focus:true,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});});
$('inspect-map-node').addEventListener('click',()=>{const r=run(),entry=r?.map?.nodes.find(n=>n.id===mapSelections.get(r.id));if(entry)showNode(entry,r);});
$('export-save').addEventListener('click',()=>safe(()=>download(serializeSave(save),'YU-GI-OH-CLASSIC-expeditions.json')));
$('download-raw').addEventListener('click',()=>{if(rawSave!==null)download(rawSave,'YU-GI-OH-CLASSIC-expeditions-original.json');});
$('import-save').addEventListener('click',()=>$('save-file').click());
$('import-decks').addEventListener('click',()=>$('deck-file').click());
$('deck-file').addEventListener('change',()=>safe(async()=>{const raw=await fileText($('deck-file'));if(raw!==null)setSources(importedDecks(JSON.parse(raw),cards),cards,'JSON 덱 자료');}));
$('save-file').addEventListener('change',()=>safe(async()=>{
  const raw=await fileText($('save-file'));if(raw===null)return;const incoming=parseSave(raw);
  if(blocked)throw new Error('현재 저장 원본을 보호 중이야. 원본 백업을 받아 확인한 뒤 복구해줘.');
  if(save.slots.some(slot=>slot.run?.bridge147))throw new Error('게임 연결 원정을 백업 파일로 덮어쓰지 않았어. 게임 진행 다시 불러오기로 복구해줘.');
  if(incoming.slots.some(slot=>slot.run?.bridge147))throw new Error('게임 연결 기록은 백업만으로 승인할 수 없어. 게임 실행기에서 저장된 원정을 다시 불러와줘.');
  const populated=incoming.slots.filter(s=>s.run).length;
  if(!await confirm('슬롯 백업을 불러올까?',`시작 덱 ${incoming.starters.length}개와 원정 ${populated}개를 불러와 현재 원정 슬롯을 교체해. 현재 자료가 필요하면 먼저 슬롯 백업을 받아줘.`))return;
  incoming.revision=save.revision;await persist(incoming,'슬롯 백업을 불러왔어.');draft=null;activeSlot=null;renderSlots();renderRun();
}));
$('reload-save').addEventListener('click',()=>safe(async()=>{if(!await leaveDraft())return;readSaved();toast(blocked?'저장 원본을 유지하고 있어.':'저장본을 다시 읽었어.');}));
addEventListener('storage',event=>{if(event.key!==STORAGE_KEY&&event.key!==null)return;externalChange=true;saveStatus();renderSlots();if(draft)renderEditor();else renderRun();toast('다른 창에서 저장이 바뀌었어. 현재 편집본은 유지돼.');});
addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
audio152=mountGameAudio152({onAudio:value=>embed152.diagnostics(value)});audioState152='';syncGameAudio163(embed152.state());embed152.announce();
renderMapLegend($('map-legend'));
const legend152=document.createElement('details');legend152.className='legend152';const legendTitle152=document.createElement('summary');legendTitle152.textContent='지도 기호';legend152.append(legendTitle152,$('map-legend'));document.querySelector('.map-toolbar').append(legend152);
const opponentLoad=loadOpponentPool();
$('opponent-search').addEventListener('input',renderOpponentPool);
$('opponent-defaults').addEventListener('click',()=>safe(async()=>{if(!defaultOpponentPool.length)await loadOpponentPool();opponentPool=copy(defaultOpponentPool);opponentLoadError='';opponentSource='설치된 AI 배틀의 기본 상대 풀';renderOpponentPool();}));
$('opponent-browser').addEventListener('click',()=>safe(()=>{
  const data=browserEncounterPool(localStorage,browserDecks(localStorage,cards),cards);
  if(!data.pool.length)throw new Error(data.issues.map(issue=>issue.message).join(' ')||'이 브라우저에 연결 가능한 AI 배틀과 덱이 없어.');
  opponentPool=copy(data.pool);opponentSource=`이 브라우저의 AI 배틀 ${data.pool.length}개${data.issues.length?' · 제외 '+data.issues.length+'개':''}`;opponentLoadError='';renderOpponentPool();
}));
try{({cards,meta}=await loadCatalog());mountRewardPreview({cards,showCard});readSaved();
  bridgeUI=mountBridge154({config:BRIDGE,getRun:run,getSave:()=>save,cards,showCard,toast,onBusy:value=>embed152.setBusy('host',value),onConsumableView:value=>{consumableView163=value;document.body.classList.toggle('consumables-mode163',value);$('game152-close').textContent=value?'전투로 돌아가기':'게임으로 돌아가기';audioState152='';syncGameAudio163(embed152.state());},closeToGame:()=>embed152.requestClose(),assertReady:()=>{if(!embed152.state().connected)throw new Error('게임과 원정 연결을 확인하고 있어. 잠시 기다려줘.');if(dirty())throw new Error('편집 중인 덱을 저장하거나 편집을 취소한 뒤 진행해줘.');},onChanged:()=>{renderSlots();renderRun();},applyArchived:async(receipt,{fromStatus=false}={})=>{
    const next=copy(save),slot=next.slots.find(s=>s.slot_id===receipt.slot_id);
    if(!slot?.run||slot.run.id!==receipt.run_id){if(fromStatus)return;throw new Error('보관한 원정과 브라우저 슬롯이 달라. 기존 슬롯을 비우지 않았어.');}
    if(fromStatus&&!slot.run.bridge147)return;
    if(fromStatus&&activeSlot===receipt.slot_id&&dirty())throw new Error('이 원정은 다른 창에서 보관됐어. 현재 덱 편집은 보존했어. 편집을 취소한 뒤 게임 진행을 다시 불러와줘.');
    slot.run=null;const priorDraft=draft,priorSlot=activeSlot;if(activeSlot===receipt.slot_id){draft=null;activeSlot=null;}
    try{await persist(next,'원정 기록을 게임에 보관하고 슬롯을 비웠어.');}catch(error){draft=priorDraft;activeSlot=priorSlot;throw error;}
    renderSlots();renderRun();
  },applyRuns:async(runs,{allowDraftCommit=false}={})=>{
    const next=copy(save);let changed=false;
    for(const incoming of runs){const slot=next.slots.find(s=>s.slot_id===incoming.slot_id);if(!slot)throw new Error('게임 저장 슬롯을 확인할 수 없어.');
      if(slot.run&&slot.run.id!==incoming.id)throw new Error('이 브라우저 슬롯에 다른 원정이 있어. 먼저 슬롯 백업을 받아줘. 원본은 바꾸지 않았어.');
      if(!shouldApplyCheckpoint150(slot.run,incoming))continue;
      if(JSON.stringify(slot.run)!==JSON.stringify(incoming)){slot.run=incoming;changed=true;}
    }
    if(changed){if(dirty()&&!allowDraftCommit)throw new Error('게임 진행이 바뀌었어. 현재 덱 편집을 취소한 뒤 다시 불러와줘.');await persist(next);}
    if(activeSlot===null&&runs.length)activeSlot=runs[0].slot_id;
  }});
  void refreshToolStarters153();void refreshCampaign164();renderRun();if(resumePending152){resumePending152=false;await bridgeUI.refresh();await bridgeUI.openConsumables163();}await opponentLoad;}
catch(error){blocked=true;$('save-error').hidden=false;$('save-error-text').textContent=error.message;$('save-status').textContent='카드 자료를 읽지 못했어. 새로고침해줘.';renderSlots();}
addEventListener('pagehide',()=>audio152.pause());
addEventListener('beforeunload',()=>{audio152.destroy();embed152.destroy();});
