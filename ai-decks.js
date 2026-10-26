import {DECK_STORAGE_KEY,GROUPS,GROUP_LABELS,RULESETS,emptyDeck,cardLimit,copyCount,groupCardCount,copiedDeckName,groupCount,groupTypeCounts,placementError,adjustCard,resolveCard,validateDeck,speedBuckets,parseBundle,exportBundle,deckMarkdown} from './ai-deck-core.js?v=20261013-copy129';
import {renderPagination} from './pagination.js?v=20261006-8';
import {makeSyncPacket,packetDeck,loadOpponentDeck} from './ai-sync-core.js?v=20261008-70';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig,DeckCloud,cloudError} from './supabase-cloud.js?v=20261008-70';
import {CardSettingsCloud,applySettings} from './card-settings.js?v=20261007-49';
import {mergeAIAssets,copyAIAsset} from './ai-assets.js?v=20261008-70';
import {CardLimitsCloud,applyLimits} from './card-limits.js?v=20261008-61';
import {parseActors,actorForDeck} from './ai-actors.js?v=20261006-37';
import {CardTagsCloud,annotationFor,relatedAnnotations} from './card-tags.js?v=20261007-47';
import {createStatFilters} from './card-filters.js?v=20261007-44';
import {fillSubtypeFilter} from './card-subtypes.js?v=20261011-tags';
import {additionIndex} from './card-additions.js?v=20261008-additions';
import {builderCardMatches,builderSearchText,sortBuilderCards} from './ai-deck-filters.js?v=20261012-filters122';
import {NATIVE035_BASE_BINDINGS,NATIVE035_CATALOG,indexNative035,sha256035,isExtra035,assertLegacyExport035} from './native035-core.js?v=035-2';
import {mergeCatalogNative035,applyNativeCatalogSettings035,nativeRelease035} from './catalog-native035.js?v=20261026-036';
import {catalogGateway037} from './catalog-editor037.js?v=20261026-037';
import {toBuilderNative038,fromBuilderNative038,validateBuilderNative038,adjustBuilderNative038,loadNativeDraft038,saveNativeDraft038,NativeSession038} from './ai-native038.js?v=20261026-038';

const $=id=>document.getElementById(id), PAGE=24;
let cards=[],meta=null,decks=[],active='',page=1,timer,storageBlocked=false,opponents=[],actors=[];
let cloud=null,authClient=null,canEdit=false,onlineVersions=null,authGeneration=0;
let loadingOpponent=false;
let installed=[],cloudReady=false,saveDeckId=null;
let engine='legacy',legacyCards=[],unityCards=[],nativeIndex=null,nativeSession=null,nativeError='',nativeDraftVersion=null,nativeBlocked=false,nativeReady=false;
let legacyState={decks:[],active:''},nativeState={decks:[],active:''},nativeCharacters=[],nativeLoadBackedUp=false;
let nativeDraftPresent=false;
const ACTIVE_KEY=DECK_STORAGE_KEY+'-active',PENDING_KEY=DECK_STORAGE_KEY+'-pending-create',SOURCES_KEY=DECK_STORAGE_KEY+'-versions';
const opponentSources=new Map();
let tagsCloud=null;const selectedTags=new Set();
const collator=new Intl.Collator('ko');
let additions={byIdentity:new Map(),releases:[],latest:null};
let additionHistory038=null;
const FILTER_CONTROLS={query:'builder-search',type:'builder-type',race:'builder-race',attribute:'builder-attribute',tier:'builder-tier',subtype:'builder-subtype',minLevel:'builder-level-min',maxLevel:'builder-level-max',mechanic:'builder-mechanic',group:'builder-group',release:'builder-release',limit:'builder-limit',speedLimit:'builder-speed-limit',status:'builder-status'};
const statFilters=createStatFilters($('builder-stat-filters'),()=>{page=1;renderPool();});
$('builder-advanced-filters').open=!matchMedia('(max-width:800px)').matches;
function el(tag,text,className){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;}
function restrictionBadge(deck,card,overlay=false){
  if(engine==='unity'){
    const n=nativeIndex?.bySource.get(card.internal_id),limit=deck.banlist_enabled?(n?.deckLimit??3):3;
    if(overlay&&limit===3)return null;
    const badge=el('span',deck.banlist_enabled?(limit===0?'금지':limit===3?'제한 없음':`제한 ${limit}`):'AI 금제 예외',`restriction-badge ${limit<3?'limit-'+limit:'unrestricted'}${overlay?' on-art':''}`);
    badge.title=deck.banlist_enabled?'Unity 원정의 카드 제한을 적용해. 같은 이름 카드와 제한 그룹도 함께 검사해.':'AI도 같은 이름 카드 합계는 3장까지 사용할 수 있어.';return badge;
  }
  const speed=deck.ruleset==='duel_links_plan',limit=speed?(card.speed_limit??3):Math.min(3,card.deck_limit??3),restricted=speed?card.speed_limit!=null:limit<3;
  if(overlay&&!restricted)return null;
  const label=restricted?(limit===0?'금지':`제한 ${limit}`):'제한 없음';
  const badge=el('span',label,`restriction-badge ${restricted?'limit-'+limit:'unrestricted'}${overlay?' on-art':''}`);
  badge.title='플레이어 금제 정보야. AI는 금제를 적용하지 않고 같은 카드 3장까지 사용할 수 있어. '+(restricted?(limit===0?'플레이어 덱에서는 사용할 수 없어.':speed?`제한 ${limit} 카드들의 종류를 합쳐 전체 덱에서 ${limit}장까지.`:`같은 카드의 전체 덱 합계 ${limit}장까지.`):'플레이어도 같은 카드 3장까지.');
  return badge;
}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,4500);}
function uid(){return crypto.randomUUID();}
function current(){return decks.find(d=>d.deck_id===active);}
function fileDownload(name,body,type='application/json;charset=utf-8'){const url=URL.createObjectURL(new Blob([body],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);}
function assertLegacyDecks038(selected){if(engine!=='legacy')throw Error('Unity 원정 덱은 기존 게임 형식으로 저장할 수 없어.');const rows=selected.flatMap(d=>GROUPS.flatMap(g=>d.groups[g]));if(rows.some(r=>r.slot>=1427||r.internal_id>=2390&&r.internal_id<=2419))throw Error('Unity 추가 카드는 기존 게임 형식으로 저장할 수 없어.');assertLegacyExport035([...rows,...rows.map(r=>unityCards.find(c=>c.identity_key===r.identity_key)).filter(Boolean)]);}
function bundle(selected=decks){
  if(engine==='unity')return {schema:1,kind:'unity-ai-builder038-drafts',engine:'unity-native-035',catalog_id:NATIVE035_CATALOG,decks:selected.map(d=>fromBuilderNative038(d,nativeIndex,{allowIncomplete:true}))};
  assertLegacyDecks038(selected);return exportBundle(meta,selected,legacyCards);
}
function persist(){
  if(engine==='unity')return persistNative038();
  if(storageBlocked){$('deck-save-status').textContent='이전 저장 내용을 보존하고 있어. 현재 덱은 JSON을 내려받아 보관해줘.';return false;}
  try{localStorage.setItem(DECK_STORAGE_KEY,JSON.stringify(bundle()));localStorage.setItem(ACTIVE_KEY,active);localStorage.setItem(SOURCES_KEY,JSON.stringify([...opponentSources].map(([id,s])=>[id,{source:s.source,version:s.version}])));$('deck-save-status').textContent='이 브라우저에 편집본 저장됨 · 온라인 저장하면 다른 기기에서도 불러올 수 있어';return true;}
  catch{$('deck-save-status').textContent='브라우저 저장 실패 · AI 덱 JSON을 내려받아 보관해줘.';return false;}
}
function renderLibrary(){
  if(engine==='unity'){$('deck-select').replaceChildren(...decks.map(d=>{const o=el('option',`[Unity 원정] ${d.name||'이름 없는 AI 덱'}`);o.value=d.deck_id;return o;}));$('deck-select').value=active;return;}
  $('deck-select').replaceChildren(...decks.map(d=>{const o=el('option',`[${RULESETS[d.ruleset].shortLabel}] ${d.name||'이름 없는 AI 덱'}`);o.value=d.deck_id;return o;}));$('deck-select').value=active;
}
function showFields(){
  if(engine==='unity'){const d=current();$('deck-name').value=d.name;$('deck-banlist').checked=d.banlist_enabled;$('deck-banlist').disabled=false;$('deck-banlist').title='등록된 시작 덱은 카드 제한을 해제할 수 없어.';renderNativeCharacters038();return;}
  const d=current();$('deck-name').value=d.name;$('deck-rules').value=d.ruleset;$('deck-difficulty').value=String(d.difficulty);$('deck-banlist').checked=d.banlist_enabled;
  $('deck-banlist').checked=false;$('deck-banlist').disabled=true;$('deck-banlist').title='AI는 플레이어 금제를 적용하지 않아.';
  for(const key of Object.keys(d.strategy))$('strategy-'+key).value=d.strategy[key];
}
function keepViewport(update){
  const x=window.scrollX,y=window.scrollY,panels=[$('deck-panel'),$('builder-detail')].map(node=>[node,node.scrollTop]);
  const focused=document.activeElement, row=focused?.closest('.deck-row');
  const identity=row?.dataset.identity,group=row?.dataset.group,direction=focused?.dataset.direction;
  update();
  for(const [node,top] of panels)node.scrollTop=top;
  if(focused?.isConnected)focused.focus({preventScroll:true});
  else if(identity&&direction){
    const replacement=[...$('deck-groups').querySelectorAll('.deck-row')].find(n=>n.dataset.identity===identity&&n.dataset.group===group)?.querySelector(`[data-direction="${direction}"]`);
    replacement?.focus({preventScroll:true});
  }
  window.scrollTo(x,y);
}
function renderDeck(){
  if(engine==='unity'){renderNativeDeck038();return;}
  const d=current(),check=validateDeck(d,cards);$('mobile-count').textContent=String(check.counts.main);
  const buckets=speedBuckets(d,cards);
  renderActor($('deck-actor'),d);
  const rules=RULESETS[d.ruleset];$('active-mode-label').textContent=rules.shortLabel;$('active-mode-label').classList.toggle('speed',rules.mode==='speed');$('active-mode-summary').textContent=`${d.name} · 메인 ${check.counts.main}/${rules.min}~${rules.max}장`;
  $('rules-note').hidden=RULESETS[d.ruleset].playable;
  $('recipe-source').hidden=!d.source_recipe;
  const origin=opponentSources.get(d.deck_id),originLabel=origin?(origin.source==='online'?`온라인 저장본 · 버전 ${origin.version}`:'설치 기본 덱 · 온라인 저장본 없음'):'편집본';
  $('recipe-source').textContent=d.source_recipe?`${originLabel} · ${d.name} · 온라인 저장하면 이 덱이 갱신돼.`:'';
  $('deck-counts').replaceChildren(...GROUPS.map(g=>el('span',`${GROUP_LABELS[g]} ${check.counts[g]}장`)));
  const composition=groupTypeCounts(d,cards);
  $('deck-type-counts').replaceChildren(...[['normal','일반 몬스터'],['effect','효과 몬스터'],['spell','마법'],['trap','함정'],['ritual','의식 몬스터'],['other','기타'],['unknown','미확인']]
    .filter(([key],index)=>index<4||composition[key]>0)
    .map(([key,label])=>{const badge=el('span',null,`deck-type-count ${key}`);badge.append(el('span',label),el('strong',`${composition[key]}장`));return badge;}));
  $('validation-summary').textContent=check.issues.length?`확인할 항목 ${check.issues.length}개`:`${rules.shortLabel} 덱 구성 확인 완료 · 온라인 저장 가능`;
  $('validation-summary').textContent+=' · AI 금제 예외';
  $('deck-banlist').disabled=true;
  $('deck-issues').replaceChildren(...check.issues.map(message=>el('li',message)));$('validation-summary').parentElement.classList.toggle('ok',!check.issues.length);
  $('deck-groups').replaceChildren(...GROUPS.map(group=>{
    const section=el('section',null,'deck-group'),title=el('h2',`${GROUP_LABELS[group]} 덱 · ${check.counts[group]}장`),select=el('button','카드 찾기');select.type='button';
    select.addEventListener('click',()=>{$('add-group').value=group;if(group==='extra')$('builder-type').value='융합 몬스터';else if($('builder-type').value==='융합 몬스터')$('builder-type').value='';fillSubtypeFilter($('builder-subtype'),$('builder-type').value);page=1;renderPool();switchView(false);$('builder-search').focus();});title.append(select);section.append(title);
    if(!d.groups[group].length)section.append(el('p','카드 찾기에서 추가할 위치를 고르고 ＋ 버튼을 눌러줘.','builder-empty'));
    for(const row of d.groups[group]){
      const card=resolveCard(row,cards),line=el('div',null,'deck-row'+(card?'':' unknown'));
      line.dataset.identity=row.identity_key;line.dataset.group=group;
      if(card){const img=el('img');img.src=card.image;img.alt='';img.width=33;img.height=48;img.loading='lazy';line.append(img);}
      const info=el('div',null,'deck-row-info'),name=el('button',row.name_ko,'deck-row-name');name.type='button';name.addEventListener('click',()=>card?openDetail(card):toast('도감과 일치하지 않는 이전 카드야. 빼고 새 카드를 골라줘.'));info.append(name);
      if(card){
        info.append(restrictionBadge(d,card));
        if(d.ruleset==='duel_links_plan'&&card.speed_limit>0){const bucket=buckets[card.speed_limit],usage=el('small',`같은 제한 그룹 ${bucket.used}장 · AI 예외`,'deck-limit-usage');usage.title=bucket.cards.map(({card,count})=>`${card.name_ko} ${count}장`).join(', ');info.append(usage);}
      }else info.append(el('span','금제 확인 불가','restriction-badge unrestricted'));
      line.append(info);
      const controls=el('div',null,'deck-quantity'),minus=el('button','−'),plus=el('button','＋');minus.type=plus.type='button';minus.setAttribute('aria-label',`${row.name_ko} 한 장 빼기`);plus.setAttribute('aria-label',`${row.name_ko} 한 장 추가`);
      minus.dataset.direction='minus';plus.dataset.direction='plus';
      minus.addEventListener('click',()=>{
        keepViewport(()=>{
        if(card)adjustCard(d,card,group,-1);else{row.count--;if(!row.count)d.groups[group].splice(d.groups[group].indexOf(row),1);}
        persist();renderDeck();updatePoolControls();
        });
      });
      plus.disabled=!card||copyCount(d,card.identity_key)>=cardLimit(d,card)||groupCount(d,group)>=(group==='main'?RULESETS[d.ruleset].max:15);
      plus.addEventListener('click',()=>add(card,group));controls.append(minus,el('span',String(row.count)),plus);line.append(controls);section.append(line);
    }
    return section;
  }));
}
function renderTags(){
  const box=$('builder-tag-filters');box.replaceChildren();
  for(const {name} of tagsCloud?.state?.categories||[]){
    const label=el('label',null,'tag-choice'),check=el('input');check.type='checkbox';check.checked=selectedTags.has(name);
    check.addEventListener('change',()=>{check.checked?selectedTags.add(name):selectedTags.delete(name);page=1;renderPool();});
    label.append(check,el('span',name));box.append(label);
  }
  if(!box.children.length)box.append(el('p','도감에서 카테고리를 만들고 카드에 태그를 붙이면 여기에 표시돼.','muted'));
}
async function refreshTags(){
  $('refresh-builder-tags').disabled=true;
  try{if(!tagsCloud)throw new Error('온라인 연결을 확인해줘.');await tagsCloud.load();renderTags();keepViewport(renderPool);$('builder-tag-status').textContent='온라인 태그를 불러왔어. 여러 개 선택하면 모두 포함한 카드를 찾아.';}
  catch(e){$('builder-tag-status').textContent='태그를 불러오지 못했어. 새로 불러오기를 눌러줘.';}
  finally{$('refresh-builder-tags').disabled=false;}
}
function filterValues(){
  return {...Object.fromEntries(Object.entries(FILTER_CONTROLS).map(([key,id])=>[key,$(id).value])),statConditions:statFilters.values(),tags:[...selectedTags]};
}
function filtered(filters){
  return sortBuilderCards(cards.filter(card=>(engine!=='unity'||nativeIndex?.bySource.get(card.internal_id)?.playable&&!nativeIndex.bySource.get(card.internal_id).token)&&builderCardMatches(card,filters,{tagsState:tagsCloud?.state,additions})),$('builder-sort').value,additions);
}
function filterSummary(filters){
  const labels=Object.entries(FILTER_CONTROLS).filter(([,id])=>$(id).value).map(([key,id])=>{
    if(key==='query')return `검색: ${$(id).value}`;
    if(key==='minLevel')return `레벨 ${$(id).value} 이상`;
    if(key==='maxLevel')return `레벨 ${$(id).value} 이하`;
    const label=$(id).selectedOptions[0]?.textContent||'';
    return key==='limit'?`일반 금제: ${label}`:key==='speedLimit'?`스피드 금제: ${label}`:label;
  });
  labels.push(...statFilters.summary(),...filters.tags.map(tag=>'#'+tag));
  $('builder-filter-count').textContent=labels.length?`· ${labels.length}개 조건`:'';
  $('builder-active-filters').textContent=labels.length?labels.join(' · '):'전체 카드 · 토큰·특수 카드 제외';
}
function resetPoolFilters(){
  for(const id of Object.values(FILTER_CONTROLS))$(id).value='';
  $('builder-sort').value='name';fillSubtypeFilter($('builder-subtype'));statFilters.reset();selectedTags.clear();renderTags();
}
function renderPool(){
  const filters=filterValues(),rows=filtered(filters),pages=Math.max(1,Math.ceil(rows.length/PAGE));page=Math.min(page,pages);filterSummary(filters);
  $('pool-results').textContent=`${rows.length.toLocaleString('ko-KR')}종 · ${GROUP_LABELS[$('add-group').value]} 덱에 추가`;
  for(const id of ['pool-pages-top','pool-pages-bottom'])renderPagination($(id),page,pages,goPage);
  $('builder-cards').replaceChildren(...rows.slice((page-1)*PAGE,page*PAGE).map(card=>{
    const item=el('article',null,'builder-card'),art=el('button',null,'builder-art');art.type='button';art.setAttribute('aria-label',`${card.name_ko} 효과 보기`);
    item.poolCard=card;
    const img=el('img');img.src=card.image;img.alt='';img.width=200;img.height=290;img.loading='lazy';art.append(img);const badge=restrictionBadge(current(),card,true);if(badge)art.append(badge);art.addEventListener('click',()=>openDetail(card));
    const controls=el('div',null,'builder-card-controls'),minus=el('button','−','builder-remove'),addButton=el('button',null,'builder-add'),quantity=el('span',null,'builder-in-deck');minus.type=addButton.type='button';
    minus.addEventListener('click',()=>remove(card,$('add-group').value));
    addButton.addEventListener('click',()=>placementError(card,$('add-group').value)?openDetail(card):add(card,$('add-group').value));
    controls.append(minus,addButton);item.append(art,el('h3',card.name_ko),el('span',card.rarity,`rarity ${card.rarity}`),el('p',[card.type,card.race].filter(Boolean).join(' · '),'muted'),quantity,controls);setPoolControls(card,item);return item;
  }));
  if(!rows.length)$('builder-cards').append(el('p','조건에 맞는 카드가 없어. 검색이나 필터를 줄여줘.','muted'));
}
function setPoolControl(card,button){
  if(engine==='unity'){setNativePoolControl038(card,button);return;}
  const d=current(),group=$('add-group').value,used=copyCount(d,card.identity_key),limit=cardLimit(d,card),wrong=placementError(card,group);
  button.textContent=wrong?'효과 보기':`＋ 추가 · ${used}/${limit}`;
  button.setAttribute('aria-label',wrong?`${card.name_ko} 효과 보기`:`${card.name_ko} ${GROUP_LABELS[group]} 덱에 추가`);
  button.disabled=!wrong&&(used>=limit||groupCount(d,group)>=(group==='main'?RULESETS[d.ruleset].max:15));
  button.title=wrong?'':used>=limit?'AI도 같은 카드는 전체 덱 합계 3장까지.':'AI 금제 예외 · 같은 카드 3장까지';
}
function setPoolControls(card,item){
  setPoolControl(card,item.querySelector('.builder-add'));
  const group=$('add-group').value,count=groupCardCount(current(),card.identity_key,group),minus=item.querySelector('.builder-remove');
  minus.disabled=count===0;minus.setAttribute('aria-label',`${card.name_ko} ${GROUP_LABELS[group]} 덱에서 한 장 빼기`);
  item.querySelector('.builder-in-deck').textContent=`${GROUP_LABELS[group]} ${count}장 · 전체 ${copyCount(current(),card.identity_key)}장`;
}
function updatePoolControls(){for(const item of $('builder-cards').children)if(item.poolCard)setPoolControls(item.poolCard,item);}
function goPage(next){page=next;renderPool();$('pool-results').scrollIntoView({block:'start'});}
function add(card,group){try{keepViewport(()=>{if(engine==='unity')adjustBuilderNative038(current(),card,group,1,nativeIndex);else adjustCard(current(),card,group,1,cards);persist();renderDeck();updatePoolControls();});toast(`${card.name_ko} · ${GROUP_LABELS[group]} 덱에 추가했어.`);}catch(error){toast(error.message);}}
function remove(card,group){try{keepViewport(()=>{if(engine==='unity')adjustBuilderNative038(current(),card,group,-1,nativeIndex);else adjustCard(current(),card,group,-1,cards);persist();renderDeck();updatePoolControls();});toast(`${card.name_ko} · ${GROUP_LABELS[group]} 덱에서 한 장 뺐어.`);}catch(error){toast(error.message);}}
function openDetail(card){
  const layout=el('div',null,'detail-layout'),art=el('div',null,'detail-art'),info=el('div',null,'detail-info'),img=el('img');img.src=card.image;img.alt=card.name_ko;img.width=200;img.height=290;art.append(img);const artBadge=restrictionBadge(current(),card,true);if(artBadge)art.append(artBadge);
  const title=el('h2',card.name_ko);title.id='builder-detail-title';info.append(title,el('p',[card.type,card.race,card.level==null?'':`LV ${card.level}`,card.atk==null?'':`ATK ${card.atk} / DEF ${card.def}`].filter(Boolean).join(' · '),'muted'),restrictionBadge(current(),card));
  info.append(el('p',engine==='unity'?'Unity 원정에서 사용하는 효과와 카드 제한이야.':'배지는 플레이어 금제 기준이야. AI는 금제와 관계없이 같은 카드 3장까지 사용할 수 있어.','muted'));
  info.append(el('p','현재 모드 효과','description-title'),el('div',card.description_ko,'description'));
  if(card.review_note)info.append(el('p',card.review_note,'review-note'));
  const tags=annotationFor(tagsCloud?.state,card)?.tags||[];
  if(tags.length){const badges=el('div',null,'custom-tag-badges');for(const tag of tags){const b=el('button','#'+tag,'tag-badge');b.type='button';b.addEventListener('click',()=>{resetPoolFilters();selectedTags.add(tag);page=1;renderTags();renderPool();$('builder-detail').close();switchView(false);});badges.append(b);}info.append(badges);}
  const related=relatedAnnotations(tagsCloud?.state,card,cards);
  if(related.length){const links=el('div',null,'relation-links');info.append(el('h3','관련 카드'),links);for(const c of related){const b=el('button',c.name_ko);b.type='button';b.addEventListener('click',()=>openDetail(c));links.append(b);}}
  const buttons=el('div',null,'builder-detail-add');for(const group of (engine==='unity'?['main','extra']:GROUPS))if(!(engine==='unity'?nativePlacement038(card,group):placementError(card,group))){const b=el('button',`${GROUP_LABELS[group]}에 추가`,'primary');b.type='button';b.addEventListener('click',()=>add(card,group));buttons.append(b);}info.append(buttons);
  const catalogLink=el('a','도감에서 검토 의견 보기 ↗');catalogLink.href=`./#card-${card.slot}`;catalogLink.target='_blank';catalogLink.rel='noopener';info.append(el('p'),catalogLink);layout.append(art,info);$('builder-detail-body').replaceChildren(layout);if(!$('builder-detail').open)$('builder-detail').showModal();
}
function switchView(deck){document.querySelector('.builder-workspace').classList.toggle('deck-view',deck);$('show-pool').classList.toggle('active',!deck);$('show-deck').classList.toggle('active',deck);$('show-pool').setAttribute('aria-pressed',String(!deck));$('show-deck').setAttribute('aria-pressed',String(deck));}
function selectDeck(id){active=id;if(engine==='unity')persistNative038();else try{localStorage.setItem(ACTIVE_KEY,active);}catch{}renderLibrary();showFields();renderDeck();renderPool();renderOpponentOptions();}
function newDeck(clone=false,ruleset='classic'){
  if(engine==='unity'){newNativeDeck038(clone);return;}
  if(loadingOpponent||!meta||!current())return;
  if(storageBlocked){toast('이전 브라우저 저장을 보존 중이야. 먼저 JSON을 보관해줘.');return;}
  if(decks.length>=100){toast('덱은 100개까지야. JSON을 보관해줘.');return;}
  const source=current(),d=clone?editableCopy(source):emptyDeck(uid(),ruleset);decks.push(d);selectDeck(d.deck_id);persist();switchView(true);$('deck-name').focus({preventScroll:true});
  if(clone){$('deck-name').select();toast(`${source.name}을 복사했어. 이름을 정하고 카드를 편집해줘. 온라인 저장하면 새 AI 덱으로 추가돼.`);}
}
function editableCopy(source){const copy=copyAIAsset(source,uid());copy.name=copiedDeckName(source.name,decks.map(deck=>deck.name));return copy;}
function chooseNewDeck(){if(meta&&!$('new-deck-dialog').open)$('new-deck-dialog').showModal();}
function onlineSummary(){
  $('online-dialog-status').textContent='';
  const d=current();
  $('online-summary').textContent=`${d.name} · 메인 ${groupCount(d,'main')}장 / 융합 ${groupCount(d,'extra')}장 / 사이드 ${groupCount(d,'side')}장 · ${d.source_recipe?'선택한 AI 덱 갱신':'새 AI 덱으로 추가'}`;
}
async function openOnline(){
  if(engine==='unity'){openNativeOnline038();return;}
  $('online-title').textContent='기존 게임 AI 덱 온라인 저장';$('online-title').nextElementSibling.textContent='저장하면 기존 스토리의 AI 덱 목록에서 고를 수 있어.';
  if(!meta)return;
  saveDeckId=active;
  const o=el('option',current().source_recipe?current().name:'새 AI 덱으로 추가');o.value=current().source_recipe?.filename||'new';$('online-target').replaceChildren(o);
  onlineVersions=null;onlineSummary();$('online-dialog').showModal();$('prepare-online').disabled=true;
  try{if(!cloud)throw new Error('온라인 연결 준비 중이야. 잠시 후 다시 시도해줘.');const rows=await refreshAssets();onlineVersions=new Map(rows.map(r=>[r.filename,r.version]));const origin=opponentSources.get(active);if(current().source_recipe&&origin&&Number.isSafeInteger(origin.version))onlineVersions.set(current().source_recipe.filename,origin.version);$('online-dialog-status').textContent=canEdit?'이름과 구성을 확인한 뒤 저장해줘.':'이메일 인증 후 저장할 수 있어.';}
  catch(error){$('online-dialog-status').textContent=cloudError(error);}
  finally{$('prepare-online').disabled=!canEdit||onlineVersions===null;}
}
async function prepareOnline(){
  if(engine==='unity'){await saveNativeOnline038();return;}
  $('prepare-online').disabled=true;
  try{
    if(!canEdit||onlineVersions===null)throw new Error('poc_editor_required');
    if(active!==saveDeckId)throw new Error('편집할 덱이 바뀌었어. 저장 창을 다시 열어줘.');
    const d=current(),source=d.source_recipe?.filename;assertLegacyDecks038([d]);
    const target=source?opponents.find(t=>t.source_recipe.filename===source):installed.find(t=>t.ruleset===d.ruleset);
    const packet=await makeSyncPacket(meta,d,target,cards);
    $('online-dialog-status').textContent='덱을 검사하고 저장하는 중…';
    let row;
    if(source)row=await cloud.save(packet,onlineVersions.get(source)??0);
    else{
      const pending=JSON.parse(localStorage.getItem(PENDING_KEY)||'{}');
      const request=pending[d.deck_id]||{id:uid(),packet};pending[d.deck_id]=request;
      localStorage.setItem(PENDING_KEY,JSON.stringify(pending));
      row=await cloud.create(request.packet,request.id);
      d.source_recipe=structuredClone(row.packet.target);
      opponentSources.set(d.deck_id,{source:'online',version:row.version});persist();
      delete pending[d.deck_id];localStorage.setItem(PENDING_KEY,JSON.stringify(pending));
      // A retry may recover an older successful creation after the draft changed.
      // Keep that association, then save the current draft using the recovered version.
      if(JSON.stringify(packet.deck)!==JSON.stringify(row.packet.deck)){
        row=await cloud.save({...packet,target:d.source_recipe},row.version);
      }
    }
    onlineVersions.set(row.filename,row.version);opponentSources.set(active,{source:'online',version:row.version});persist();
    opponents=await mergeAIAssets(installed,cloud.rows,cards,meta);cloudReady=true;renderDeck();renderOpponentOptions();
    $('online-dialog-status').textContent=`저장 완료 · ${row.packet.deck.name} · 스토리에서 이 덱을 고를 수 있어. 다음 게임 실행 때 반영돼.`;
    $('online-status').textContent=$('online-dialog-status').textContent;toast('AI 덱을 온라인에 저장했어.');
  }catch(error){$('online-dialog-status').textContent=error.message?.includes('poc_')||error.code?cloudError(error):error.message;}
  finally{$('prepare-online').disabled=!canEdit||onlineVersions===null;}
}
async function loadOnline(){
  if(engine==='unity'){$('confirm-native-load').disabled=true;nativeLoadBackedUp=false;$('native-load-status').textContent='현재 편집본을 먼저 내려받아줘.';$('native-load-dialog').showModal();return;}
  $('load-online').disabled=true;$('online-status').textContent='온라인에 저장된 덱을 확인하는 중…';
  try{
    if(!cloud)throw new Error('온라인 연결 준비 중이야. 잠시 후 다시 시도해줘.');
    const entries=await refreshAssets();renderOpponentOptions();
    $('online-status').textContent=`AI 덱 목록 갱신 완료 · 온라인 저장 ${entries.length}개. 현재 편집 내용은 유지했어.`;
  }catch(error){$('online-status').textContent=error.message;}
  finally{$('load-online').disabled=false;}
}
async function authStatus(session){
  const generation=++authGeneration;canEdit=false;$('auth-signout').hidden=!session;$('auth-open').textContent=session?'다른 이메일로 로그인':'이메일로 로그인';
  $('auth-status').textContent=session?'편집 권한을 확인하는 중…':'로그인하면 AI 덱을 온라인에 저장할 수 있어.';
  if(session){try{const allowed=await cloud.editor();if(generation!==authGeneration)return;canEdit=allowed;$('auth-status').textContent=allowed?`${session.user.email} · 덱 편집 가능`:'로그인됨 · 이 계정에는 덱 편집 권한이 없어.';}catch(error){if(generation!==authGeneration)return;$('auth-status').textContent=cloudError(error);}}
  $('prepare-online').disabled=!canEdit||(engine==='unity'?!nativeSession?.loaded:onlineVersions===null);
}
async function initCloud(){
  try{
    const response=await fetch('./data/cloud-config.json?v=20261006-13',{cache:'no-store'});if(!response.ok)throw new Error('설정 없음');
    const config=validateCloudConfig(await response.json());authClient=createClient(config.url,config.publishable_key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'poc-ai-editor-auth-v1'},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(10000)})}});cloud=new DeckCloud(authClient);
    authClient.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>authStatus(session),0);});
    tagsCloud=new CardTagsCloud(catalogGateway037(authClient,()=>[...legacyCards,...unityCards.filter(c=>c.nativeOnly)]));await refreshTags();
    const {data,error}=await authClient.auth.getSession();if(error)throw error;await authStatus(data.session);
    applySettings(legacyCards,await new CardSettingsCloud(authClient).load());applyLimits(legacyCards,await new CardLimitsCloud(authClient).load());renderPool();
    await refreshAssets();renderOpponentOptions();
    if(nativeIndex){try{nativeSession=new NativeSession038(authClient,nativeIndex);await nativeSession.load();syncNativeSession038();if(!nativeDraftPresent&&!nativeBlocked)replaceNativeFromOnline038(false);}catch(e){nativeError=e.message;}}
  }catch(error){$('auth-status').textContent=cloudError(error);}
}
async function sendLogin(){
  const email=$('auth-email').value.trim();if(!$('auth-email').reportValidity())return;
  $('auth-send').disabled=true;$('auth-message').textContent='인증 메일을 보내는 중…';persist();
  try{if(!authClient)throw new Error('온라인 연결 없음');const redirect=new URL('ai-decks.html',location.href);redirect.hash='';redirect.search=`?engine=${engine}`;
    const {error}=await authClient.auth.signInWithOtp({email,options:{emailRedirectTo:redirect.href}});if(error)throw error;
    $('auth-message').textContent='인증 메일을 보냈어. 메일의 로그인 링크를 눌러줘. 편집본은 이 브라우저에 보관돼.';
  }catch(error){$('auth-message').textContent=cloudError(error);}finally{$('auth-send').disabled=false;}
}
function renderOpponentOptions(){
  if(engine==='unity'){renderNativeOpponents038();return;}
  $('load-example').textContent='온라인 저장본 다시 불러오기';
  const mode=$('opponent-mode').value,difficulty=Number($('opponent-difficulty').value);
  const filtered=opponents.filter(d=>(!mode||RULESETS[d.ruleset].mode===mode)&&(!difficulty||d.source_recipe.difficulty_levels.includes(difficulty)));
  const placeholder=el('option',current()?.source_recipe?'AI 덱 선택':`${current()?.name||'새 AI 덱'} · 온라인 미저장`);placeholder.value='';
  $('example-select').replaceChildren(placeholder,...filtered.map(d=>{const o=el('option',`[${RULESETS[d.ruleset].shortLabel}] ${d.name} · ${groupCount(d,'main')}장`);o.value=d.deck_id;return o;}));
  const selected=filtered.find(d=>d.source_recipe.filename===current()?.source_recipe?.filename);
  $('example-select').value=selected?.deck_id||'';
  $('opponent-count').textContent=`AI 덱 ${opponents.length}개 · 고르면 바로 편집할 수 있어.`;
  $('example-select').disabled=loadingOpponent||!cloudReady;
  $('load-example').disabled=loadingOpponent||!selected||!cloudReady;
  $('copy-example').disabled=loadingOpponent||!selected||!cloudReady;
  renderSelectedActor();
}
function renderActor(node,deck){
  const actor=actorForDeck(actors,deck);node.hidden=!actor;node.replaceChildren();if(!actor)return;
  const img=el('img');img.src=actor.portrait;img.alt=actor.name;img.width=64;img.height=76;
  const text=el('div');text.append(el('small','이 덱의 듀얼리스트'),el('strong',actor.name),el('span',deck.source_recipe.filename));node.append(img,text);
}
function renderSelectedActor(){if(engine==='unity'){renderNativeActor038($('selected-opponent-actor'),nativeSession?.book?.document.decks.find(d=>d.deck_id===$('example-select').value));return;}renderActor($('selected-opponent-actor'),opponents.find(d=>d.deck_id===$('example-select').value));}
async function loadActors(){
  try{const response=await fetch('./data/ai-actors.json?v=20261006-37',{cache:'no-cache'});if(response.ok)actors=parseActors(await response.json());}
  catch{actors=[];} // Card/deck editing remains usable if portrait data is unavailable.
  renderDeck();
}
async function loadOpponents(){
  try{const response=await fetch('./data/ai-opponents.json?v=20261006-10',{cache:'no-cache'});if(!response.ok)throw new Error('현재 상대 덱 자료를 가져오지 못했어.');installed=parseBundle(await response.json(),cards);opponents=structuredClone(installed);renderOpponentOptions();}
  catch(error){$('opponent-count').textContent=error.message;$('load-example').disabled=true;$('copy-example').disabled=true;}
}
async function loadSelectedOpponent(copy=false){
  if(engine==='unity'){loadNativeSelected038(copy);return;}
  if(loadingOpponent)return;
  loadingOpponent=true;$('load-example').disabled=true;$('copy-example').disabled=true;document.querySelector('.builder-workspace').setAttribute('aria-busy','true');$('deck-panel').inert=true;$('pool-panel').inert=true;
  $('opponent-load-status').textContent='선택한 상대의 최신 온라인 저장본을 확인하는 중…';
  try{
    if(decks.length>=100)throw new Error('덱은 100개까지야.');
    if(storageBlocked)throw new Error('이전 브라우저 저장을 보존 중이야. 먼저 JSON을 보관해줘.');
    const target=opponents.find(d=>d.deck_id===$('example-select').value);
    if(!cloud)throw new Error('온라인 연결 준비 중이야. 잠시 후 다시 시도해줘.');
    const result=await loadOpponentDeck(meta,target,cards,uid(),()=>cloud.load());
    if(decks.length>=100)throw new Error('덱은 100개까지야.');
    const deck=copy?editableCopy(result.deck):result.deck;
    decks.push(deck);if(!copy)opponentSources.set(deck.deck_id,{source:result.source,version:result.version??0});
    selectDeck(deck.deck_id);persist();switchView(true);$('deck-name').focus({preventScroll:true});if(copy)$('deck-name').select();
    const message=copy?`${result.deck.name}을 복사했어. 카드를 넣고 빼서 편집해줘. 온라인 저장하면 새 AI 덱으로 추가돼.`:result.source==='online'?`${result.deck.source_recipe.filename} · 온라인 저장본 버전 ${result.version}을 가져왔어. 게임에는 다음 실행 때 반영돼.`:`${result.deck.source_recipe.filename} · 온라인 저장본이 없어 설치 기본 덱을 가져왔어.`;
    $('opponent-load-status').textContent=message;$('online-status').textContent=message;toast(message);
  }catch(error){
    const message=error.message?.includes('poc_')||error.code?cloudError(error):error.message;
    $('opponent-load-status').textContent=`불러오지 못했어. 기존 편집본은 유지했어. ${message}`;toast($('opponent-load-status').textContent);
  }finally{loadingOpponent=false;$('deck-panel').inert=false;$('pool-panel').inert=false;document.querySelector('.builder-workspace').removeAttribute('aria-busy');renderOpponentOptions();}
}
async function refreshAssets(){
  const rows=await cloud.load(),merged=await mergeAIAssets(installed,rows,legacyCards,meta);opponents=merged;cloudReady=true;return rows;
}
// The two games keep their own drafts and save contracts. A ruleset is not an engine identity.
async function pinnedNative038(path,pin){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Unity 카드 자료를 불러오지 못했어.');const bytes=await r.arrayBuffer();if(await sha256035(bytes)!==pin)throw Error('Unity 카드 버전이 맞지 않아. 새로 열어줘.');return JSON.parse(new TextDecoder().decode(bytes));}
function nativeSearchText038(c){return [builderSearchText(c),...(c.searchAliases||[]),c.code,nativeIndex?.bySource.get(c.internal_id)?.code,c.name_ko?.replaceAll('앤틱','엔틱')].filter(v=>v!=null).join(' ').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');}
async function prepareNative038(data){
  try{
    const [base,extension]=await Promise.all([pinnedNative038('data/native-base035.json',NATIVE035_BASE_BINDINGS),pinnedNative038('data/native-expansion035.json',NATIVE035_CATALOG)]);
    nativeIndex=indexNative035(base,extension,legacyCards);
    unityCards=mergeCatalogNative035(data,extension).cards.map(c=>c.nativeOnly?c:{...c,description_ko:nativeIndex.bySource.get(c.internal_id).description,review_note:''});
    for(const c of unityCards)c.searchText=nativeSearchText038(c);
    const saved=loadNativeDraft038(localStorage,nativeIndex);nativeDraftPresent=saved.present;nativeBlocked=saved.blocked;nativeDraftVersion=saved.baseVersion;nativeState={decks:saved.decks,active:saved.active};
    if(saved.error)nativeError=saved.error.message||String(saved.error);nativeReady=true;
  }catch(e){nativeError=e.message;nativeReady=false;}
}
function nativePlacement038(card,group){const n=nativeIndex?.bySource.get(card.internal_id);if(!n?.playable||n.token)return '이 카드는 덱에 넣을 수 없어.';if(!['main','extra'].includes(group))return 'Unity 원정에는 사이드 덱이 없어.';return isExtra035(n)!==(group==='extra')?'엑스트라 덱 위치를 확인해줘.':'';}
function persistNative038(){
  if(nativeBlocked){$('deck-save-status').textContent='기존 Unity 편집본을 보존 중이야. 현재 덱은 JSON으로 내려받아줘.';return false;}
  try{saveNativeDraft038(localStorage,nativeIndex,{decks,active,baseVersion:nativeDraftVersion});nativeDraftPresent=true;nativeState={decks,active};$('deck-save-status').textContent=`Unity 편집본 보관됨 · ${nativeDraftVersion===null?'온라인 저장본 확인 전':`온라인 기준 v${nativeDraftVersion}`}`;return true;}
  catch(e){$('deck-save-status').textContent=`브라우저 저장 실패 · ${e.message} · JSON으로 내려받아줘.`;return false;}
}
function newNativeDeck038(copy=false){
  if(!nativeReady){toast(nativeError||'Unity 카드 자료를 확인하는 중이야.');return;}if(decks.length>=100){toast('편집본은 100개까지 보관할 수 있어.');return;}
  const d=copy?structuredClone(current()):toBuilderNative038({deck_id:`deck-${uid()}`,name:'새 원정 덱',character_id:null,character_skill_profile_id:null,use_shared_skills:true,banlist_enabled:false,main:[],extra:[]},nativeIndex,unityCards);
  if(copy){d.deck_id=`deck-${uid()}`;d.name=copiedDeckName(d.name,decks.map(x=>x.name));}
  decks.push(d);active=d.deck_id;persist();selectDeck(active);switchView(true);$('deck-name').focus({preventScroll:true});
}
function setEngine038(next,{writeUrl=true}={}){
  if(!['unity','legacy'].includes(next))return;if(next==='unity'&&!nativeReady){toast(nativeError||'Unity 카드 자료를 확인하는 중이야.');$('builder-engine').value=engine;return;}
  if(engine==='unity')nativeState={decks,active};else legacyState={decks,active};
  engine=next;const state=engine==='unity'?nativeState:legacyState;decks=state.decks;active=state.active;cards=engine==='unity'?unityCards:legacyCards;
  if(engine==='unity'&&!decks.length){const d=toBuilderNative038({deck_id:`deck-${uid()}`,name:'새 원정 덱',character_id:null,character_skill_profile_id:null,use_shared_skills:true,banlist_enabled:false,main:[],extra:[]},nativeIndex,unityCards);decks=[d];active=d.deck_id;nativeState={decks,active};}
  if(!decks.some(d=>d.deck_id===active))active=decks[0]?.deck_id;
  $('builder-engine').value=engine;document.body.dataset.engine=engine;$('copy-to-unity').hidden=engine!=='legacy';$('native-character-fields').hidden=engine!=='unity';$('legacy-rule-fields').hidden=engine==='unity';
  document.querySelector('.strategy-editor').hidden=engine==='unity';$('opponent-mode').closest('.filter-pair').hidden=engine==='unity';
  document.querySelector('.deck-composition').hidden=engine==='unity';
  $('add-group').querySelector('[value="side"]').hidden=engine==='unity';if(engine==='unity'&&$('add-group').value==='side')$('add-group').value='main';
  $('engine-note').textContent=engine==='unity'?'추가 카드 30장을 포함한 Unity 원정용 덱이야. 저장 후 장별 적 편성에서 사용할 수 있어.':'기존 게임의 덱·스토리·원정 편성을 계속 편집할 수 있어.';
  $('builder-mode-notice').textContent=engine==='unity'?'온라인에 저장한 덱을 장별 적 편성의 일반·엘리트·보스 후보로 지정해줘. 변경한 편성은 새 원정부터 적용돼.':'기존 게임의 AI 덱이야. 온라인 저장하면 기존 스토리에서 선택할 수 있어. Unity에서 쓰려면 복사 버튼으로 옮겨줘.';
  $('load-status').textContent=engine==='unity'?`Unity 원정 ${nativeIndex.cards.filter(c=>c.playable&&!c.token).length.toLocaleString('ko-KR')}종 · 추가 카드 30종`:`기존 도감 ${meta.regular_count.toLocaleString('ko-KR')}종`;
  $('deck-name-note').textContent=engine==='unity'?'같은 화면에서 이름과 카드를 편집한 뒤 온라인 저장해줘.':'이름을 바꾸고 온라인 저장하면 기존 스토리 덱 목록에도 표시돼.';
  $('deck-name').maxLength=engine==='unity'?100:80;
  $('online-status').textContent=engine==='unity'&&!nativeSession?.loaded?(nativeError||'Unity 온라인 목록을 확인하지 못했어. 목록 새로고침으로 다시 연결해줘.'):onlineFlowMessage038(engine);
  $('deck-banlist').parentElement.lastChild.textContent=engine==='unity'?' 카드 제한 적용 · 시작 덱으로도 쓸 덱은 필수':'AI 금제 예외 · 금제 표시는 플레이어 기준';
  const link=document.querySelector('.online-decks>a');link.href=engine==='unity'?`native035.html?deck=${encodeURIComponent(active)}#chapters`:'story.html';link.textContent=engine==='unity'?'장별 적 편성에서 이 덱 사용하기 →':'스토리에서 이 덱 사용하기 →';
  document.querySelector('.online-decks>p').textContent=engine==='unity'?'선택한 덱만 Unity 원정 목록에 저장해. 다른 덱·시작 덱·장별 편성·카드 설정은 유지돼.':'새 덱·복제 덱은 별도로 추가돼. 기존 상대 덱을 고르면 해당 덱에 저장돼.';
  document.querySelector('.local-drafts>p').textContent=engine==='unity'?'Unity 편집본은 기존 게임의 편집본과 별도로 보관돼.':'기존 편집본은 모두 보존돼. 온라인 저장한 덱을 스토리에서 쓸 수 있어.';
  if(writeUrl){const url=new URL(location.href);url.searchParams.set('engine',engine);url.searchParams.delete('recipe');history.replaceState(null,'',url.pathname+url.search+url.hash);}
  resetPoolFilters();renderReleases038();page=1;renderLibrary();showFields();renderDeck();renderPool();renderOpponentOptions();updateAssignmentLinks038();
}
function renderReleases038(){if(!additionHistory038)return;const history=structuredClone(additionHistory038);if(engine==='unity')history.releases.push(nativeRelease035(unityCards));additions=additionIndex(cards,history);const select=$('builder-release'),all=el('option','모든 추가 시점');all.value='';select.replaceChildren(all);if(additions.latest){const latest=el('option',`최근 추가 · ${additions.latest.count}장`);latest.value='latest';select.append(latest);}for(const r of additions.releases.filter(r=>r.count)){const o=el('option',`${r.date} · ${r.name} · ${r.count}장`);o.value=r.id;select.append(o);}select.disabled=false;}
function renderNativeCharacters038(){
  const d=current(),select=$('native-character');select.replaceChildren();const none=el('option','기본 캐릭터');none.value='';select.append(none);for(const row of nativeCharacters){const o=el('option',row.profile.name);o.value=row.id;select.append(o);}select.value=d.character_id||'';
  const profiles=$('native-profile');profiles.replaceChildren();const base=el('option','기본 특성');base.value='';profiles.append(base);const actor=nativeCharacters.find(c=>c.id===d.character_id);for(const p of actor?.profile.skill_profiles||[]){const o=el('option',p.name);o.value=p.profile_id;profiles.append(o);}profiles.value=d.character_skill_profile_id||'';profiles.disabled=!actor;
  $('native-character-status').textContent=nativeCharacters.length?`공용 캐릭터 ${nativeCharacters.length}명 · 이름·그림·특성을 함께 연결해.`:'공용 캐릭터를 온라인에서 확인하는 중이야.';
}
function updateAssignmentLinks038(){const query=encodeURIComponent(current()?.deck_id||'');$('builder-starters-link').href=engine==='unity'?`native035.html?deck=${query}#starters`:'starters026.html';$('builder-starters-link').textContent=engine==='unity'?'Unity 시작 덱 편집':'원정 시작 덱 편집';$('builder-chapters-link').href=engine==='unity'?`native035.html?deck=${query}#chapters`:'campaign164.html';$('builder-chapters-link').textContent=engine==='unity'?'Unity 장별 적 편성':'원정 제작 · 적 편성';}
function renderNativeActor038(node,deck){const c=nativeCharacters.find(c=>c.id===deck?.character_id);node.replaceChildren();node.hidden=!c;if(!c)return;const img=el('img');img.src=c.profile.portrait||'assets/icon.svg';img.alt='';img.width=64;img.height=76;const text=el('div');text.append(el('small','이 덱의 듀얼리스트'),el('strong',c.profile.name));node.append(img,text);}
function renderNativeDeck038(){
  const d=current(),check=validateBuilderNative038(d,nativeIndex);$('mobile-count').textContent=check.counts.main;$('active-mode-label').textContent='Unity 원정';$('active-mode-label').classList.add('speed');$('active-mode-summary').textContent=`${d.name||'이름 없는 덱'} · 메인 ${check.counts.main}/20~30장`;$('rules-note').hidden=true;
  $('recipe-source').hidden=false;$('recipe-source').textContent=nativeDraftVersion===null?'브라우저 편집본 · 온라인 저장본 확인이 필요해.':`Unity 온라인 기준 v${nativeDraftVersion} · ${nativeSession?.version!==nativeDraftVersion?'온라인 변경 확인 필요':'선택한 덱만 저장'}`;
  $('deck-counts').replaceChildren(...['main','extra'].map(g=>el('span',`${g==='main'?'메인':'EX'} ${check.counts[g]}장`)));$('deck-type-counts').replaceChildren();
  $('validation-summary').textContent=check.issues.length?`확인할 항목 ${check.issues.length}개`:'Unity 원정 덱 구성 완료';$('deck-issues').replaceChildren(...check.issues.map(t=>el('li',t)));$('validation-summary').parentElement.classList.toggle('ok',!check.issues.length);
  $('deck-groups').replaceChildren(...['main','extra'].map(group=>{const section=el('section',null,'deck-group'),h=el('h2',`${group==='main'?'메인 덱':'엑스트라 덱'} · ${check.counts[group]}장`),find=el('button','카드 찾기');find.type='button';find.onclick=()=>{$('add-group').value=group;page=1;renderPool();switchView(false);};h.append(find);section.append(h);
    if(!d.groups[group].length)section.append(el('p','카드 목록에서 ＋ 버튼으로 추가해줘.','builder-empty'));
    for(const row of d.groups[group]){const c=cards.find(c=>c.identity_key===row.identity_key),line=el('div',null,'deck-row');line.dataset.identity=row.identity_key;line.dataset.group=group;if(c){const img=el('img');img.src=c.image;img.alt='';img.loading='lazy';img.width=33;img.height=48;line.append(img);}const info=el('div',null,'deck-row-info'),name=el('button',c?.name_ko||row.name_ko,'deck-row-name');name.type='button';name.onclick=()=>c&&openDetail(c);info.append(name);if(c)info.append(restrictionBadge(d,c));line.append(info);const q=el('div',null,'deck-quantity'),minus=el('button','−'),plus=el('button','＋');minus.type=plus.type='button';minus.dataset.direction='minus';plus.dataset.direction='plus';minus.setAttribute('aria-label',`${name.textContent} 한 장 빼기`);plus.setAttribute('aria-label',`${name.textContent} 한 장 추가`);minus.onclick=()=>remove(c,group);plus.onclick=()=>add(c,group);setNativePoolControl038(c,plus,true,group);q.append(minus,el('span',String(row.count)),plus);line.append(q);section.append(line);}return section;}));
  renderNativeActor038($('deck-actor'),d);const link=document.querySelector('.online-decks>a');link.href=`native035.html?deck=${encodeURIComponent(d.deck_id)}#chapters`;updateAssignmentLinks038();
}
function setNativePoolControl038(card,button,quantity=false,group=$('add-group').value){
  const wrong=nativePlacement038(card,group);let message=wrong;try{if(!wrong)adjustBuilderNative038(structuredClone(current()),card,group,1,nativeIndex);}catch(e){message=e.message;}
  if(!quantity)button.textContent=wrong?'효과 보기':'＋ 추가';button.disabled=quantity?Boolean(message):Boolean(message)&&!wrong;button.title=message;button.setAttribute('aria-label',`${card?.name_ko||'카드'} ${group==='extra'?'EX':'메인'}에 추가`);
}
function renderNativeOpponents038(){const rows=nativeSession?.book?.document.decks||[],select=$('example-select'),placeholder=el('option','온라인 Unity 덱 선택');placeholder.value='';select.replaceChildren(placeholder,...rows.map(d=>{const o=el('option',`${d.name} · 메인 ${d.main.reduce((n,r)=>n+r.count,0)}장`);o.value=d.deck_id;return o;}));select.value=rows.some(d=>d.deck_id===active)?active:'';$('opponent-count').textContent=`온라인 Unity 덱 ${rows.length}개 · 기존 게임의 덱은 게임 선택에서 확인할 수 있어.`;select.disabled=!nativeSession?.loaded;$('load-example').textContent='선택한 덱 열기';$('load-example').disabled=!select.value;$('copy-example').disabled=!select.value;renderSelectedActor();}
function loadNativeSelected038(copy){const id=$('example-select').value,remote=nativeSession?.book?.document.decks.find(d=>d.deck_id===id);if(!remote)return;const existing=decks.find(d=>d.deck_id===id);if(existing&&!copy){selectDeck(id);toast('보관 중인 편집본을 열었어. 온라인 내용으로 교체하려면 목록 새로고침을 눌러줘.');return;}const d=toBuilderNative038(remote,nativeIndex,unityCards);if(copy){d.deck_id=`deck-${uid()}`;d.name=copiedDeckName(d.name,decks.map(x=>x.name));}decks.push(d);selectDeck(d.deck_id);persist();switchView(true);}
function syncNativeSession038(){nativeIndex=nativeSession.index;nativeCharacters=nativeSession.book.references.characters;applyNativeCatalogSettings035(unityCards,nativeSession.book);for(const c of unityCards){const n=nativeIndex.bySource.get(c.internal_id);c.deck_limit=n.deckLimit;c.speed_limit=n.speedLimit;if(!c.nativeOnly){const old=legacyCards.find(x=>x.internal_id===c.internal_id);if(old){c.rarity=old.rarity;c.stock=old.stock;c.draw_enabled=old.draw_enabled;}}}if(engine==='unity'){renderNativeCharacters038();renderDeck();renderPool();renderOpponentOptions();}}
function replaceNativeFromOnline038(backup=true){
  if(!nativeSession?.loaded)throw Error('온라인 목록을 먼저 확인해줘.');const next=nativeSession.book.document.decks.map(d=>toBuilderNative038(d,nativeIndex,unityCards));
  if(!next.length)next.push(toBuilderNative038({deck_id:`deck-${uid()}`,name:'새 원정 덱',character_id:null,character_skill_profile_id:null,use_shared_skills:true,banlist_enabled:false,main:[],extra:[]},nativeIndex,unityCards));
  const nextActive=next.some(d=>d.deck_id===active)?active:next[0].deck_id;saveNativeDraft038(localStorage,nativeIndex,{decks:next,active:nextActive,baseVersion:nativeSession.version},{backup});nativeState={decks:next,active:nextActive};nativeDraftVersion=nativeSession.version;nativeDraftPresent=true;nativeBlocked=false;
  if(engine==='unity'){decks=next;active=nextActive;selectDeck(active);}return next;
}
function openNativeOnline038(){saveDeckId=active;$('online-title').textContent='Unity 원정 덱 온라인 저장';$('online-title').nextElementSibling.textContent='선택한 덱만 저장해. 기존 편성·시작 덱·카드 설정은 유지돼.';$('online-target').replaceChildren(Object.assign(el('option',current().name),{value:active}));$('online-summary').textContent=`${current().name} · 메인 ${groupCount(current(),'main')} / EX ${groupCount(current(),'extra')}장`;$('online-dialog-status').textContent=nativeDraftVersion!==nativeSession?.version?'온라인 버전이 바뀌었어. 편집본을 보관한 뒤 목록 새로고침으로 다시 불러와줘.':`Unity 온라인 기준 v${nativeDraftVersion??'확인 전'}`;$('prepare-online').disabled=!canEdit||!nativeSession?.loaded||nativeBlocked||nativeDraftVersion!==nativeSession?.version;$('online-dialog').showModal();}
async function saveNativeOnline038(){
  $('prepare-online').disabled=true;try{if(!canEdit)throw Error('편집 계정으로 로그인해줘.');if(saveDeckId!==active||engine!=='unity')throw Error('편집할 덱이 바뀌었어. 저장 창을 다시 열어줘.');if(nativeBlocked)throw Error('기존 편집본을 먼저 보관해줘.');const typed=fromBuilderNative038(current(),nativeIndex);await nativeSession.saveSelected(typed,nativeDraftVersion);nativeDraftVersion=nativeSession.version;syncNativeSession038();persist();$('online-dialog-status').replaceChildren(el('p',`저장 완료 · ${typed.name} · v${nativeDraftVersion}`));const link=el('a','장별 적 편성에서 이 덱 사용하기 →');link.href=`native035.html?deck=${encodeURIComponent(typed.deck_id)}#chapters`;$('online-dialog-status').append(link);$('online-status').textContent=`Unity 덱 저장 완료 · ${onlineFlowMessage038('unity')}`;toast('Unity 원정 덱을 저장했어.');}catch(e){$('online-dialog-status').textContent=cloudError(e);}finally{$('prepare-online').disabled=!canEdit||nativeDraftVersion!==nativeSession?.version;}
}
function copyLegacyToUnity038(){
  try{if(engine!=='legacy'||!nativeReady)throw Error(nativeError||'Unity 카드 자료를 확인해줘.');const old=current(),copy=structuredClone(old);copy.deck_id=`deck-${uid()}`;copy.ruleset='duel_links_plan';copy.character_id=null;copy.character_skill_profile_id=null;copy.banlist_enabled=false;delete copy.source_recipe;const typed=fromBuilderNative038(copy,nativeIndex,{allowIncomplete:true}),ui=toBuilderNative038(typed,nativeIndex,unityCards);nativeState.decks.push(ui);nativeState.active=ui.deck_id;setEngine038('unity');persist();switchView(true);toast('Unity 원정용으로 복사했어. 기존 덱은 그대로 보관돼.');}catch(e){toast(e.message);}
}
function deckNotes038(){if(engine==='legacy')return deckMarkdown(meta,[current()],cards);const d=current();return [`# ${d.name||'Unity 원정 덱'}`,'Unity 원정 · 메인 20~30장 / EX 15장','',...['main','extra'].flatMap(g=>[`## ${g==='main'?'메인':'EX'}`,...d.groups[g].map(r=>`- ${r.name_ko} ×${r.count}`),''])].join('\n');}
function initialEngine038(params,hasLegacyDraft){if(params.get('engine')==='unity')return 'unity';if(params.get('engine')==='legacy')return 'legacy';if(params.has('recipe')||params.has('mode')||params.get('new')==='1')return 'legacy';return hasLegacyDraft?'legacy':'unity';}
function onlineFlowMessage038(forEngine){return forEngine==='unity'?'장별 적 편성에 등록하고 게임에서 온라인 편성을 불러온 뒤 새 원정을 시작해줘.':'게임이 켜져 있으면 다음 실행까지 적용을 기다려.';}
function builderLoading038(loading){for(const id of ['builder-engine-toolbar','active-deck-mode','builder-mobile-tabs','builder-workspace'])$(id).hidden=loading;$('builder-workspace').setAttribute('aria-busy',String(loading));document.body.dataset.builderLoading=String(loading);if(loading)$('load-status').textContent='카드와 덱 목록을 불러오는 중…';}
function parseNativeBuilderImport038(raw){
  if(raw?.schema!==1||raw.kind!=='unity-ai-builder038-drafts'||raw.engine!=='unity-native-035'||raw.catalog_id!==NATIVE035_CATALOG||Object.keys(raw).some(k=>!['schema','kind','engine','catalog_id','decks'].includes(k))||!Array.isArray(raw.decks)||raw.decks.length>100)throw Error('Unity 원정 AI 덱 JSON을 골라줘. 기존 게임 덱은 Unity용 복사 버튼으로 옮길 수 있어.');
  const seen=new Set();return raw.decks.map(d=>{const ui=toBuilderNative038(d,nativeIndex,unityCards);if(seen.has(ui.deck_id))throw Error('덱 ID가 중복되어 있어.');seen.add(ui.deck_id);if(ui.character_id!==null){const actor=nativeCharacters.find(c=>c.id===ui.character_id);if(!actor||ui.character_skill_profile_id!==null&&!actor.profile.skill_profiles?.some(p=>p.profile_id===ui.character_skill_profile_id))throw Error('덱의 캐릭터와 특성 묶음을 확인해줘.');}return ui;});
}
async function init(){
  builderLoading038(true);
  try{
    const response=await fetch('./data/cards.json?v=20261006-6',{cache:'no-cache'});if(!response.ok)throw new Error('카드 자료를 가져오지 못했어.');const data=await response.json();meta=data.meta;cards=data.cards;legacyCards=cards;
    if(cards.length!==meta.total||new Set(cards.map(c=>c.identity_key)).size!==cards.length)throw new Error('도감 자료를 확인할 수 없어.');
    for(const card of cards)card.searchText=builderSearchText(card);await prepareNative038(data);
    const regular=cards.filter(card=>!card.special),levels=[...new Set(regular.map(card=>card.level).filter(value=>value!=null))].sort((a,b)=>a-b);
    for(const [id,values] of [['builder-type',[...new Set(regular.map(card=>card.type))]],['builder-race',[...new Set(regular.map(card=>card.race).filter(Boolean))].sort(collator.compare)],['builder-attribute',[...new Set(regular.map(card=>card.attribute).filter(Boolean))]],['builder-level-min',levels],['builder-level-max',levels]])for(const value of values){const option=el('option',value);option.value=String(value);$(id).append(option);}
    for(const [id,rows] of [['builder-mechanic',meta.card_system?.mechanics||[]],['builder-group',meta.card_system?.groups||[]]])for(const row of rows){const option=el('option',row.name);option.value=row.id;$(id).append(option);}
    fillSubtypeFilter($('builder-subtype'));
    try{
      const response=await fetch('./data/card-additions.json?v=20261008',{cache:'no-cache'});if(!response.ok)throw new Error('추가 이력 없음');
      additionHistory038=await response.json();renderReleases038();
    }catch{$('builder-release').disabled=true;$('builder-sort').querySelector('[value="added"]').disabled=true;$('builder-release-status').hidden=false;$('builder-release-status').textContent='추가 이력을 불러오지 못했어. 나머지 필터는 사용할 수 있어.';}
    let hasLegacyDraft=false;try{const stored=localStorage.getItem(DECK_STORAGE_KEY);if(stored){hasLegacyDraft=true;decks=parseBundle(JSON.parse(stored),cards);}}catch{storageBlocked=true;toast('이전 AI 덱을 읽지 못했어. 기존 저장은 유지하고 현재 편집은 JSON으로 보관할게.');}
    try{for(const [id,s] of JSON.parse(localStorage.getItem(SOURCES_KEY)||'[]'))if(decks.some(d=>d.deck_id===id)&&['online','installed'].includes(s.source)&&Number.isSafeInteger(s.version)&&s.version>=0)opponentSources.set(id,s);}catch{}
    if(!decks.length)decks=[emptyDeck(uid())];active=decks.find(d=>d.deck_id===localStorage.getItem(ACTIVE_KEY))?.deck_id||decks[0].deck_id;selectDeck(active);
    $('load-status').textContent='온라인 덱 목록과 사용 게임을 확인하는 중…';
    await loadActors();await loadOpponents();await initCloud();
    const params=new URLSearchParams(location.search),recipe=params.get('recipe');
    setEngine038(initialEngine038(params,hasLegacyDraft),{writeUrl:false});
    if(params.get('new')==='1'){newDeck(false,params.get('mode')==='classic'?'classic':'duel_links_plan');params.delete('new');params.delete('mode');params.set('engine',engine);history.replaceState(null,'',location.pathname+'?'+params+location.hash);}
    else if(engine==='legacy'&&recipe&&cloudReady){const target=opponents.find(d=>d.source_recipe.filename===recipe);if(target){$('example-select').value=target.deck_id;await loadSelectedOpponent();}}
    const route=new URL(location.href);route.searchParams.set('engine',engine);history.replaceState(null,'',route.pathname+route.search+route.hash);
    builderLoading038(false);
    const match=/^#card-(\d+)$/.exec(location.hash);if(match){const card=cards.find(c=>c.slot===Number(match[1]));if(card&&!card.special)openDetail(card);}else if(location.hash==='#login')$('auth-dialog').showModal();
  }catch(error){$('load-status').textContent=error.message;$('export-decks').disabled=true;document.querySelector('.builder-workspace').hidden=true;}
}
$('builder-search').addEventListener('input',()=>{page=1;renderPool();});
$('builder-type').addEventListener('change',()=>{fillSubtypeFilter($('builder-subtype'),$('builder-type').value);page=1;renderPool();});
for(const id of [...Object.values(FILTER_CONTROLS).filter(id=>!['builder-search','builder-type'].includes(id)),'builder-sort','add-group'])$(id).addEventListener('change',()=>{page=1;renderPool();});
$('reset-builder-filters').addEventListener('click',()=>{resetPoolFilters();page=1;renderPool();});
$('refresh-builder-tags').addEventListener('click',refreshTags);$('clear-builder-tags').addEventListener('click',()=>{selectedTags.clear();renderTags();page=1;renderPool();});
$('show-pool').addEventListener('click',()=>switchView(false));$('show-deck').addEventListener('click',()=>switchView(true));$('deck-select').addEventListener('change',()=>selectDeck($('deck-select').value));$('new-deck').addEventListener('click',chooseNewDeck);$('choose-new-mode').addEventListener('click',chooseNewDeck);$('clone-deck').addEventListener('click',()=>newDeck(true));
$('builder-engine').addEventListener('change',()=>setEngine038($('builder-engine').value));$('copy-to-unity').addEventListener('click',copyLegacyToUnity038);
$('native-character').addEventListener('change',()=>{current().character_id=$('native-character').value||null;current().character_skill_profile_id=null;renderNativeCharacters038();persist();renderDeck();});
$('native-profile').addEventListener('change',()=>{current().character_skill_profile_id=$('native-profile').value||null;persist();});
$('close-native-load').addEventListener('click',()=>$('native-load-dialog').close());
$('backup-native-draft').addEventListener('click',()=>{try{fileDownload('Unity원정_불러오기전_편집본.json',JSON.stringify(bundle(),null,2));nativeLoadBackedUp=true;$('confirm-native-load').disabled=false;$('native-load-status').textContent='편집본 다운로드를 시작했어. 보관한 뒤 온라인 덱으로 교체해줘.';}catch(e){$('native-load-status').textContent=e.message;}});
$('confirm-native-load').addEventListener('click',async()=>{if(!nativeLoadBackedUp||engine!=='unity')return;$('confirm-native-load').disabled=true;try{await nativeSession.load();syncNativeSession038();replaceNativeFromOnline038(true);$('native-load-dialog').close();toast(`Unity 온라인 v${nativeDraftVersion}을 불러왔어. 이전 편집본도 백업했어.`);}catch(e){$('native-load-status').textContent=cloudError(e);$('confirm-native-load').disabled=false;}});
$('close-new-deck').addEventListener('click',()=>$('new-deck-dialog').close());
$('save-online').addEventListener('click',openOnline);
$('load-online').addEventListener('click',loadOnline);
$('close-online').addEventListener('click',()=>$('online-dialog').close());
$('online-target').addEventListener('change',onlineSummary);
$('prepare-online').addEventListener('click',prepareOnline);
$('auth-open').addEventListener('click',()=>{$('auth-message').textContent='';$('auth-dialog').showModal();});
$('close-auth').addEventListener('click',()=>$('auth-dialog').close());
$('auth-form').addEventListener('submit',event=>{event.preventDefault();sendLogin();});
$('auth-signout').addEventListener('click',async()=>{if(authClient){const {error}=await authClient.auth.signOut();if(error)toast(cloudError(error));}});
for(const [id,rules] of [['create-classic','classic'],['create-speed','duel_links_plan']])$(id).addEventListener('click',()=>{$('new-deck-dialog').close();setEngine038('legacy');newDeck(false,rules);});
$('create-unity').addEventListener('click',()=>{$('new-deck-dialog').close();setEngine038('unity');if(engine==='unity')newNativeDeck038();});
$('load-example').addEventListener('click',()=>loadSelectedOpponent());$('copy-example').addEventListener('click',()=>loadSelectedOpponent(true));
for(const id of ['opponent-mode','opponent-difficulty'])$(id).addEventListener('change',renderOpponentOptions);
$('example-select').addEventListener('change',()=>loadSelectedOpponent());
$('deck-name').addEventListener('input',()=>{current().name=$('deck-name').value;renderLibrary();persist();$('active-mode-summary').textContent=`${current().name} · 메인 ${groupCount(current(),'main')}장`;});
for(const id of ['deck-rules','deck-difficulty','deck-banlist'])$(id).addEventListener('change',()=>{if(engine==='unity'){current().banlist_enabled=$('deck-banlist').checked;persist();renderDeck();renderPool();return;}keepViewport(()=>{const d=current();if(d.ruleset!==$('deck-rules').value)delete d.source_recipe;d.ruleset=$('deck-rules').value;d.difficulty=Number($('deck-difficulty').value);d.banlist_enabled=$('deck-banlist').checked;persist();renderLibrary();renderDeck();updatePoolControls();});});
for(const key of ['goal','priorities','combos','avoid'])$('strategy-'+key).addEventListener('input',()=>{current().strategy[key]=$('strategy-'+key).value;persist();});
$('close-builder-detail').addEventListener('click',()=>$('builder-detail').close());$('close-builder-export').addEventListener('click',()=>$('builder-export').close());
$('export-decks').addEventListener('click',()=>{if(!meta)return;$('deck-export-preview').value=deckNotes038();$('builder-export').showModal();});
$('download-current-deck').addEventListener('click',()=>fileDownload('AI덱_현재덱.json',JSON.stringify(bundle([current()]),null,2)+'\n'));
$('download-all-decks').addEventListener('click',()=>fileDownload('AI덱_전체.json',JSON.stringify(bundle(),null,2)+'\n'));
$('download-deck-notes').addEventListener('click',()=>fileDownload('AI덱_플레이지침.md',deckNotes038(),'text/markdown;charset=utf-8'));
$('import-decks').addEventListener('click',()=>$('deck-import-file').click());$('deck-import-file').addEventListener('change',async()=>{
  const file=$('deck-import-file').files?.[0];if(!file)return;
  try{
    if(file.size>8*1024*1024)throw new Error('파일이 너무 커. AI 덱 JSON을 골라줘.');
    const raw=JSON.parse(await file.text());
    if(engine==='unity'){
      const incoming=parseNativeBuilderImport038(raw);if(!incoming.length)throw Error('불러올 덱이 없어.');
      const merged=new Map(decks.map(d=>[d.deck_id,d]));for(const d of incoming)merged.set(d.deck_id,d);if(merged.size>100)throw Error('편집본은 100개까지 보관할 수 있어.');
      const backup=JSON.stringify(bundle(),null,2);saveNativeDraft038(localStorage,nativeIndex,{decks:[...merged.values()],active:incoming[0].deck_id,baseVersion:nativeDraftVersion},{backup:true});decks=[...merged.values()];active=incoming[0].deck_id;selectDeck(active);fileDownload('Unity원정_불러오기전_백업.json',backup);switchView(true);toast(`${incoming.length}개 Unity 덱을 불러왔어.`);return;
    }
    const incoming=parseBundle(raw,cards);assertLegacyDecks038(incoming);if(!incoming.length)throw new Error('불러올 덱이 없어.');
    const merged=new Map(decks.map(d=>[d.deck_id,d]));for(const d of incoming)merged.set(d.deck_id,d);if(merged.size>100)throw new Error('덱은 100개까지 불러올 수 있어.');
    const backup=JSON.stringify(bundle(),null,2)+'\n';
    if(!storageBlocked)localStorage.setItem(DECK_STORAGE_KEY+'-before-import',backup);
    decks=[...merged.values()];selectDeck(incoming[0].deck_id);persist();switchView(true);
    toast(`${incoming.length}개 덱을 불러왔어. 이전 덱 백업도 내려받을게.`);fileDownload('AI덱_불러오기전_백업.json',backup);
  }catch(error){toast(error.message);}finally{$('deck-import-file').value='';}
});
init();
