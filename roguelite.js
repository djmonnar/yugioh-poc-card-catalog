import {STORAGE_KEY,emptySave,readStore,writeStore,parseSave,serializeSave,makeStarter,createRun,validatePlayerDeck,beginDeckEdit,adjustRunDeck,commitRunDeck} from './roguelite-core.js?v=20261014-139';
import {generateMap,nodeLabel,nodeSummary,TOWER_THEME,TOWER_EVENTS} from './roguelite-map.js?v=20261014-138';
import {renderTowerMap,renderMapLegend,MAP_ASSETS} from './roguelite-map-view.js?v=20261014-138';
import {loadCatalog,browserDecks,onlineDecks,importedDecks} from './roguelite-data.js';
import {cleanEncounterPool,assignEncounters,browserEncounterPool} from './roguelite-encounters.js?v=20261014-138';
import {REST_CHOICES,RELICS,restOutcome,rewardPolicy} from './roguelite-rules.js?v=20261014-139';
import {mountRewardPreview} from './roguelite-reward-preview.js?v=20261014-139';
import {createStatFilters,statConditionsMatch} from './card-filters.js';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';

const $=id=>document.getElementById(id), copy=value=>structuredClone(value);
const count=rows=>rows.reduce((sum,row)=>sum+row.count,0);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;};
const button=(text,action,className)=>{const e=node('button',text,className);e.type='button';e.addEventListener('click',()=>safe(action));return e;};
const option=(label,value)=>{const e=node('option',label);e.value=value;return e;};
const img=card=>{const e=node('img');e.src=card.image;e.alt=card.name_ko;e.loading='lazy';return e;};
let cards=[],meta={},save=emptySave(),activeSlot=null,draft=null,sourceDecks=[],sourceCards=[],pendingSlot=null;
let blocked=false,rawSave=null,busy=false,sourceBusy=false,externalChange=false,toastTimer;
let mapView=null,mapViewKey=null;
let opponentPool=[],defaultOpponentPool=[],opponentSource='',opponentLoadError='';
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
  $('create-run').disabled||=!opponentPoolReady();
  if(blocked||busy||externalChange)$('commit-deck').disabled=true;
}
// All new writes share a Web Lock, then compare the revision again inside it.
// A storage event never replaces a draft underneath the player's edits.
async function persist(next,message){
  if(blocked)throw new Error('저장본을 보호하고 있어. 원본 백업부터 확인해줘.');
  if(externalChange)throw new Error('다른 창에서 저장이 바뀌었어. 저장본 다시 읽기로 비교해줘.');
  if(busy)throw new Error('저장 중이야. 잠시 기다려줘.');
  busy=true;saveStatus();const expected=save.revision;
  try{
    const write=()=>writeStore(localStorage,next,expected);
    save=navigator.locks?await navigator.locks.request(STORAGE_KEY,write):write();
    rawSave=serializeSave(save);renderSlots();renderStarters();if(message)toast(message);
  }catch(error){
    try{externalChange=readStore(localStorage).revision!==expected;}catch{blocked=true;}
    throw error;
  }finally{busy=false;saveStatus();sourceSelected();if(draft)renderEditor();}
}
function renderSlots(){
  $('slots').replaceChildren();
  save.slots.forEach((slot,i)=>{
    const e=node('article',null,`slot ${slot.run?'has-run':'empty'}${activeSlot===slot.slot_id?' selected':''}`);
    e.append(node('span',`SLOT ${i+1}`,'slot-number'));
    const actions=node('div',null,'actions');
    if(slot.run){
      const r=slot.run;e.append(node('h3',r.starter_name),node('p',`${r.floor} / ${r.map?.floors??20}층 · LP ${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()}`),node('p',`메인 ${count(r.active_deck.groups.main)}장 · ${new Date(r.updated_at).toLocaleString('ko-KR')}`));
      const open=button('불러오기',()=>openRun(slot.slot_id),'primary');open.disabled=blocked;
      const remove=button('슬롯 비우기',async()=>{
        if(!await confirm('이 원정 슬롯을 비울까?',`${r.starter_name}의 원정 기록과 카드함을 비워. 시작 덱 등록은 유지돼. 필요하면 슬롯 백업을 먼저 받아줘.`))return;
        const next=copy(save);next.slots[i].run=null;await persist(next,'슬롯을 비웠어.');if(activeSlot===slot.slot_id){activeSlot=null;draft=null;renderRun();}
      },'remove');remove.disabled=blocked||externalChange;actions.append(open,remove);
    }else{
      e.append(node('h3','새로운 원정'),node('p','등록한 시작 덱으로 나만의 지도를 준비해.'));
      const start=button('새 원정 준비',()=>prepareRun(slot.slot_id),'primary');start.disabled=blocked||externalChange;actions.append(start);
    }
    e.append(actions);$('slots').append(e);
  });saveStatus();
}
async function leaveDraft(){if(dirty()&&!await confirm('덱 편집을 취소할까?','아직 저장하지 않은 덱 편집을 취소해. 저장된 덱은 유지돼.'))return false;draft=null;return true;}
async function openRun(slotId){if(!await leaveDraft())return;activeSlot=slotId;renderSlots();renderRun();$('run-panel').scrollIntoView({behavior:'smooth',block:'start'});}
function deckPreview(target,groups,pool){
  target.replaceChildren();for(const group of ['main','extra'])for(const row of groups[group]){
    const card=pool.find(c=>c.identity_key===row.identity_key);if(!card)continue;
    const e=button('',()=>showCard(card));e.title=`${card.name_ko} × ${row.count}`;e.setAttribute('aria-label',e.title);e.append(img(card));
    const q=node('span',`×${row.count}`,'preview-count');e.append(q);target.append(e);
  }
}
function renderRun(){
  const r=run();$('run-panel').hidden=!r;$('deck-editor').hidden=!draft||!r;if(!r)return;
  $('run-slot').textContent=`SLOT ${save.slots.findIndex(s=>s.slot_id===activeSlot)+1}`;$('run-title').textContent=r.starter_name;
  $('run-subtitle').textContent=`원정 준비됨 · ${r.collection.length}종 ${r.collection.reduce((n,e)=>n+e.count,0)}장 보유`;
  $('run-lp').textContent=`${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()}`;$('run-floor').textContent=`${r.floor} / ${r.map?.floors??20}층`;
  $('run-gold').textContent=r.gold.toLocaleString();$('run-relics').textContent=`${r.relics.length}개`;
  $('deck-counts').textContent=`메인 ${count(r.active_deck.groups.main)}장 · 엑스트라 ${count(r.active_deck.groups.extra)}장`;
  deckPreview($('deck-preview'),r.active_deck.groups,runCards());$('map-seed').textContent=`지도 시드: ${r.seed}`;renderMap(r);
  $('edit-deck').disabled=blocked||externalChange||!['between_nodes','at_node'].includes(r.state);
  if(draft)renderEditor();saveStatus();
}
function renderMap(r){
  const root=$('run-map'),key=`${r.id}:${JSON.stringify(r.map)}:${JSON.stringify(r.encounters)}`;
  if(mapViewKey!==key){
    mapView?.destroy();mapView=null;mapViewKey=key;root.replaceChildren();
    if(!r.map){root.append(node('p','이 백업에는 아직 지도가 없어.','muted'));mapDetails(r,null);return;}
    if(!r.map.nodes.some(n=>n.id===mapSelections.get(r.id)))mapSelections.delete(r.id);
    mapView=renderTowerMap(root,r.map,{encounters:r.encounters,selectedNodeId:mapSelections.get(r.id)||null,onNode:entry=>{mapSelections.set(r.id,entry.id);mapDetails(r,entry);}});
    if(r.map.floors===20)root.prepend(node('p','↔ 좁은 화면에서는 지도를 좌우로 움직여 상대와 길을 확인해.','muted map-gesture-hint'));
  }
  const selected=r.map?.nodes.find(n=>n.id===mapSelections.get(r.id));mapDetails(r,selected||null);
}
function mapDetails(r,entry){
  const opponent=entry&&r.encounters?.[entry.id];
  $('map-selected-title').textContent=entry?`${entry.floor}층 · ${nodeLabel(entry.kind)}${opponent?' · '+opponent.opponent_name:''}`:'첫 관문에서 봉인의 중심까지';
  $('map-selected-summary').textContent=entry?entry.next.length?`이 칸에서 다음 ${entry.floor+1}층으로 이어지는 길 ${entry.next.length}개를 강조했어.`:'탑의 마지막 관문이야. 다음 층으로 이어지는 길은 없어.':'칸을 누르면 그곳에서 이어지는 루트를 볼 수 있어. 점선은 저장된 지도에서 연결된 길이야.';
  $('map-selected-icon').hidden=!entry;if(entry)$('map-selected-icon').src=MAP_ASSETS[entry.kind];
  $('inspect-map-node').disabled=!entry;$('map-route-status').textContent=entry?`${entry.floor}층 ${nodeLabel(entry.kind)} 루트 미리보기. 원정 진행도는 유지돼.`:'전체 루트 미리보기 · 아래에서 위로 올라가';
}
function showNode(entry,r){
  $('node-title').textContent=`${entry.floor}층 · ${nodeLabel(entry.kind)}`;
  let text=nodeSummary(entry.kind);
  const opponent=r.encounters?.[entry.id],opponentRoot=$('node-opponent');opponentRoot.replaceChildren();opponentRoot.hidden=!opponent;
  if(opponent){
    const info=node('div');info.append(node('h3',opponent.opponent_name),node('p',`사용 덱 · ${opponent.deck_name}`),node('p',`전투 · ${opponent.battle_name} / AI 난이도 ${opponent.difficulty}`,'muted'));
    const details=node('details'),summary=node('summary','상대 덱 카드 보기'),preview=node('div',null,'deck-preview');deckPreview(preview,opponent.deck.groups,cards);details.append(summary,preview);info.append(details);opponentRoot.append(info);
  }
  if(['battle','elite','midboss','boss'].includes(entry.kind)){
    const policy=rewardPolicy(entry.kind);
    text+=`\n\n승리 보상 설정 · ${policy.gold} 금화 / 카드 ${policy.card_choices}개 후보 중 1장${policy.min_rarity==='N'?'':` (후보에 ${policy.min_rarity} 이상 1장 보장)`}${policy.relic?' / 유물 1개':''}`;
    if(!opponent)text+='\n이전 저장 지도에는 상대가 아직 지정되지 않았어. 새 원정부터 상대가 표시돼.';
  }
  if(entry.kind==='event'){
    const events=TOWER_EVENTS;const index=r.map.nodes.filter(n=>n.kind==='event').findIndex(n=>n.id===entry.id);const event=events[index%events.length];
    text+=`\n\n${event.title}\n${event.text}\n\n${event.choices.map(c=>`${c.label}: ${c.preview}`).join('\n')}`;
  }else if(entry.kind==='rest')text+=`\n\n${TOWER_THEME.rest_text}`;
  else if(entry.kind==='midboss'||entry.kind==='elite')text+=`\n\n${TOWER_THEME.elite_text}`;
  else if(entry.kind==='boss')text+=`\n\n${TOWER_THEME.boss_text}`;
  const next=entry.next.map(id=>r.map.nodes.find(n=>n.id===id)).filter(Boolean);if(next.length)text+=`\n\n다음 길: ${next.map(n=>`${n.floor}층 ${nodeLabel(n.kind)}${r.encounters?.[n.id]?' · '+r.encounters[n.id].opponent_name:''}`).join(' / ')}`;
  $('rest-preview').hidden=entry.kind!=='rest';if(entry.kind==='rest')renderRestPreview(entry,r);
  $('node-description').textContent=text;$('node-dialog').showModal();
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
function showCard(card){
  $('card-title').textContent=card.name_ko;const root=$('card-detail');root.replaceChildren();root.append(img(card));const info=node('div');
  info.append(node('p',`${card.rarity} · ${card.type}${card.subtype?' · '+card.subtype:''}`),node('p',[card.race,card.attribute,card.level==null?'':`★ ${card.level}`].filter(Boolean).join(' · ')));
  if(card.atk!=null)info.append(node('p',`ATK ${card.atk<0?'?':card.atk} / DEF ${card.def<0?'?':card.def}`));
  info.append(node('p',card.description_ko||'설명 없음','effect'),node('p',card.speed_limit==null?'스피드 듀얼: 같은 카드 3장까지':card.speed_limit===0?'스피드 듀얼: 금지':`스피드 듀얼: 제한 ${card.speed_limit} 그룹 합계 ${card.speed_limit}장`,'muted'));
  if(card.tags?.length)info.append(node('p',card.tags.map(t=>'#'+t).join(' '),'muted'));root.append(info);$('card-dialog').showModal();
}
function renderStarters(){
  $('starter-list').replaceChildren();if(!save.starters.length)$('starter-list').append(node('p','아직 등록한 시작 덱이 없어. AI 덱이나 JSON에서 불러와 등록해줘.','muted'));
  for(const starter of save.starters){
    const e=node('div',null,'starter-item'),info=node('div');info.append(node('strong',starter.name),node('p',`메인 ${count(starter.groups.main)} · 엑스트라 ${count(starter.groups.extra)} · 카드함 ${starter.collection.reduce((n,c)=>n+c.count,0)}장`));
    const remove=button('등록 해제',async()=>{if(!await confirm('시작 덱 등록을 해제할까?',`${starter.name}을 시작 덱 목록에서 뺄게. 이미 시작한 원정의 덱과 카드는 유지돼.`))return;const next=copy(save);next.starters=next.starters.filter(s=>s.starter_id!==starter.starter_id);await persist(next,'시작 덱 등록을 해제했어.');},'remove');remove.disabled=blocked||externalChange;e.append(info,remove);$('starter-list').append(e);
  }sourceSelected();
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
  if(sourceBusy)return;sourceBusy=true;$('source-status').textContent='덱을 읽는 중…';for(const id of ['load-browser-decks','load-online-decks','import-decks'])$(id).disabled=true;sourceSelected();
  try{await loader();}catch(error){$('source-status').textContent=`읽지 못했어: ${error.message} 기존 선택은 유지돼.`;}
  finally{sourceBusy=false;for(const id of ['load-browser-decks','load-online-decks','import-decks'])$(id).disabled=false;sourceSelected();}
}
async function prepareRun(slotId){
  if(!await leaveDraft())return;renderRun();
  pendingSlot=slotId;if(!save.starters.length){$('starter-dialog').showModal();toast('시작 덱을 먼저 등록해줘.');return;}
  $('new-run-slot').textContent=`슬롯 ${save.slots.findIndex(s=>s.slot_id===slotId)+1}에 저장할 원정이야.`;
  $('start-deck').replaceChildren(...save.starters.map(s=>option(s.name,s.starter_id)));$('run-seed-input').value='';previewStarter();renderOpponentPool();$('new-run-dialog').showModal();
}
function previewStarter(){const starter=save.starters.find(s=>s.starter_id===$('start-deck').value),target=$('starter-preview');target.replaceChildren();if(!starter)return;target.append(node('p',`LP 4,000 · 메인 ${count(starter.groups.main)} · 엑스트라 ${count(starter.groups.extra)}`));const preview=node('div',null,'deck-preview');deckPreview(preview,starter.groups,starter.collection.map(e=>e.card));target.append(preview);}
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
  }renderCollection();
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

for(const [buttonId,dialogId]of [['close-starters','starter-dialog'],['close-new-run','new-run-dialog'],['close-card','card-dialog'],['close-node','node-dialog'],['close-intro','intro-dialog']])$(buttonId).addEventListener('click',()=>$(dialogId).close());
$('open-starters').addEventListener('click',()=>{$('starter-dialog').showModal();renderStarters();});
$('load-browser-decks').addEventListener('click',()=>readSources(async()=>setSources(browserDecks(localStorage,cards),cards,'브라우저 편집본')));
$('load-online-decks').addEventListener('click',()=>readSources(async()=>{const data=await onlineDecks(cards,meta,{createClient});setSources(data.decks,data.cards,'온라인 저장본');if(data.tagsMessage)$('source-status').textContent+=' · '+data.tagsMessage;}));
$('source-deck').addEventListener('change',()=>{const deck=sourceDecks[Number($('source-deck').value)];$('starter-name').value=$('source-deck').value===''?'':deck?.name||'';sourceSelected();});
$('register-starter').addEventListener('click',()=>safe(async()=>{
  const deck=sourceDecks[Number($('source-deck').value)];if(!deck||$('source-deck').value==='')throw new Error('시작 덱을 선택해줘.');
  const name=$('starter-name').value.trim()||deck.name;const starter=makeStarter(deck,sourceCards,{...meta,id:crypto.randomUUID(),name});const next=copy(save);next.starters.push(starter);await persist(next,`${name}을 시작 덱으로 등록했어.`);
}));
$('start-deck').addEventListener('change',previewStarter);
$('create-run').addEventListener('click',()=>safe(async()=>{
  const starter=save.starters.find(s=>s.starter_id===$('start-deck').value);if(!starter||!pendingSlot)throw new Error('시작 덱과 슬롯을 선택해줘.');
  if(save.slots.find(s=>s.slot_id===pendingSlot)?.run)throw new Error('이 슬롯에는 원정이 있어. 빈 슬롯을 골라줘.');
  if(!opponentPoolReady())throw new Error('일반·엘리트·보스에 출현할 상대를 각각 하나 이상 골라줘.');
  const r=createRun({id:crypto.randomUUID(),slotId:pendingSlot,starter,cards,catalogVersion:meta.dataset_id,seed:$('run-seed-input').value.trim().normalize('NFC')||crypto.randomUUID()});r.map=generateMap(r.seed);
  r.encounters=assignEncounters(r.map,opponentPool.filter(entry=>entry.allowed_kinds.length));
  const next=copy(save);next.slots.find(s=>s.slot_id===pendingSlot).run=r;await persist(next,'새 원정을 저장했어.');$('new-run-dialog').close();activeSlot=pendingSlot;draft=null;renderSlots();renderRun();$('run-panel').scrollIntoView({behavior:'smooth',block:'start'});
}));
$('close-run').addEventListener('click',()=>safe(async()=>{if(!await leaveDraft())return;activeSlot=null;renderSlots();renderRun();}));
$('save-run').addEventListener('click',()=>safe(async()=>{if(draft)throw new Error('편집 중인 덱은 아래의 덱 저장을 눌러줘.');await persist(copy(save),'원정 저장을 확인했어.');renderRun();}));
$('edit-deck').addEventListener('click',()=>safe(()=>{
  if(!draft){draft=beginDeckEdit(run());for(const id of ['main-rows','extra-rows','collection-cards'])$(id).replaceChildren();filterOptions();renderEditor();}
  $('deck-editor').scrollIntoView({behavior:'smooth',block:'start'});
}));
$('discard-deck').addEventListener('click',()=>safe(async()=>{if(!await leaveDraft())return;renderRun();}));
$('commit-deck').addEventListener('click',()=>safe(async()=>{const changed=commitRunDeck(run(),draft);const next=copy(save);next.slots.find(s=>s.slot_id===activeSlot).run=changed;await persist(next,'원정 덱을 저장했어.');draft=null;renderRun();}));
for(const id of ['collection-search','collection-type','collection-race','collection-attribute','collection-rarity','collection-sort'])$(id).addEventListener(id==='collection-search'?'input':'change',renderCollection);
$('reset-collection').addEventListener('click',()=>{filterOptions();renderCollection();});
$('view-intro').addEventListener('click',()=>$('intro-dialog').showModal());
let demoView=null,demoMap=null;
function drawDemo(){
  if(!defaultOpponentPool.length)throw new Error(opponentLoadError||'상대 자료를 읽고 있어. 잠시 후 다시 눌러줘.');
  const map=generateMap(crypto.randomUUID()),encounters=assignEncounters(map,defaultOpponentPool);
  demoMap=map;demoView?.destroy();renderMapLegend($('map-demo-legend'));$('demo-seed').textContent=`20층 · ${map.nodes.length}개 지점 · 시드 ${map.seed}`;
  demoView=renderTowerMap($('map-demo'),map,{encounters,onNode:entry=>showNode(entry,{map,encounters})});
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
$('map-to-top').addEventListener('click',()=>mapView?.scrollToNode(run()?.map?.nodes.find(n=>n.kind==='boss')?.id,{focus:true,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}));
$('inspect-map-node').addEventListener('click',()=>{const r=run(),entry=r?.map?.nodes.find(n=>n.id===mapSelections.get(r.id));if(entry)showNode(entry,r);});
$('export-save').addEventListener('click',()=>safe(()=>download(serializeSave(save),'YU-GI-OH-CLASSIC-expeditions.json')));
$('download-raw').addEventListener('click',()=>{if(rawSave!==null)download(rawSave,'YU-GI-OH-CLASSIC-expeditions-original.json');});
$('import-save').addEventListener('click',()=>$('save-file').click());
$('import-decks').addEventListener('click',()=>$('deck-file').click());
$('deck-file').addEventListener('change',()=>safe(async()=>{const raw=await fileText($('deck-file'));if(raw!==null)setSources(importedDecks(JSON.parse(raw),cards),cards,'JSON 덱 자료');}));
$('save-file').addEventListener('change',()=>safe(async()=>{
  const raw=await fileText($('save-file'));if(raw===null)return;const incoming=parseSave(raw);
  if(blocked)throw new Error('현재 저장 원본을 보호 중이야. 원본 백업을 받아 확인한 뒤 복구해줘.');
  const populated=incoming.slots.filter(s=>s.run).length;
  if(!await confirm('슬롯 백업을 불러올까?',`시작 덱 ${incoming.starters.length}개와 원정 ${populated}개를 불러와 현재 원정 슬롯을 교체해. 현재 자료가 필요하면 먼저 슬롯 백업을 받아줘.`))return;
  incoming.revision=save.revision;await persist(incoming,'슬롯 백업을 불러왔어.');draft=null;activeSlot=null;renderSlots();renderRun();
}));
$('reload-save').addEventListener('click',()=>safe(async()=>{if(!await leaveDraft())return;readSaved();toast(blocked?'저장 원본을 유지하고 있어.':'저장본을 다시 읽었어.');}));
addEventListener('storage',event=>{if(event.key!==STORAGE_KEY&&event.key!==null)return;externalChange=true;saveStatus();renderSlots();if(draft)renderEditor();else renderRun();toast('다른 창에서 저장이 바뀌었어. 현재 편집본은 유지돼.');});
addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});

renderMapLegend($('map-legend'));
const opponentLoad=loadOpponentPool();
$('opponent-search').addEventListener('input',renderOpponentPool);
$('opponent-defaults').addEventListener('click',()=>safe(async()=>{if(!defaultOpponentPool.length)await loadOpponentPool();opponentPool=copy(defaultOpponentPool);opponentLoadError='';opponentSource='설치된 AI 배틀의 기본 상대 풀';renderOpponentPool();}));
$('opponent-browser').addEventListener('click',()=>safe(()=>{
  const data=browserEncounterPool(localStorage,browserDecks(localStorage,cards),cards);
  if(!data.pool.length)throw new Error(data.issues.map(issue=>issue.message).join(' ')||'이 브라우저에 연결 가능한 AI 배틀과 덱이 없어.');
  opponentPool=copy(data.pool);opponentSource=`이 브라우저의 AI 배틀 ${data.pool.length}개${data.issues.length?' · 제외 '+data.issues.length+'개':''}`;opponentLoadError='';renderOpponentPool();
}));
try{({cards,meta}=await loadCatalog());mountRewardPreview({cards,showCard});readSaved();await opponentLoad;}
catch(error){blocked=true;$('save-error').hidden=false;$('save-error-text').textContent=error.message;$('save-status').textContent='카드 자료를 읽지 못했어. 새로고침해줘.';renderSlots();}
