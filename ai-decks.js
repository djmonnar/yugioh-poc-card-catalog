import {DECK_STORAGE_KEY,GROUPS,GROUP_LABELS,RULESETS,emptyDeck,cardLimit,copyCount,groupCount,groupTypeCounts,placementError,adjustCard,resolveCard,validateDeck,speedBuckets,parseBundle,exportBundle,deckMarkdown} from './ai-deck-core.js?v=20261007-49';
import {renderPagination} from './pagination.js?v=20261006-8';
import {makeSyncPacket,packetDeck,loadOpponentDeck} from './ai-sync-core.js?v=20261007-53';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig,DeckCloud,cloudError} from './supabase-cloud.js?v=20261006-13';
import {CardSettingsCloud,applySettings} from './card-settings.js?v=20261007-49';
import {parseActors,actorForDeck} from './ai-actors.js?v=20261006-37';
import {CardTagsCloud,annotationFor,tagMatches,relatedAnnotations} from './card-tags.js?v=20261007-47';

const $=id=>document.getElementById(id), PAGE=24;
let cards=[],meta=null,decks=[],active='',page=1,timer,storageBlocked=false,opponents=[],actors=[];
let cloud=null,authClient=null,canEdit=false,onlineVersions=null,authGeneration=0;
let loadingOpponent=false;
const opponentSources=new Map();
let tagsCloud=null;const selectedTags=new Set();
const collator=new Intl.Collator('ko');
function el(tag,text,className){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;}
function restrictionBadge(deck,card,overlay=false){
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
function bundle(selected=decks){return exportBundle(meta,selected,cards);}
function persist(){
  if(storageBlocked){$('deck-save-status').textContent='이전 저장 내용을 보존하고 있어. 현재 덱은 JSON을 내려받아 보관해줘.';return false;}
  try{localStorage.setItem(DECK_STORAGE_KEY,JSON.stringify(bundle()));$('deck-save-status').textContent='이 브라우저에 편집본 저장됨 · 온라인 저장하면 다른 기기에서도 불러올 수 있어';return true;}
  catch{$('deck-save-status').textContent='브라우저 저장 실패 · AI 덱 JSON을 내려받아 보관해줘.';return false;}
}
function renderLibrary(){
  $('deck-select').replaceChildren(...decks.map(d=>{const o=el('option',`[${RULESETS[d.ruleset].shortLabel}] ${d.name||'이름 없는 AI 덱'}`);o.value=d.deck_id;return o;}));$('deck-select').value=active;
}
function showFields(){
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
  const d=current(),check=validateDeck(d,cards);$('mobile-count').textContent=String(check.counts.main);
  const buckets=speedBuckets(d,cards);
  renderActor($('deck-actor'),d);
  const rules=RULESETS[d.ruleset];$('active-mode-label').textContent=rules.shortLabel;$('active-mode-label').classList.toggle('speed',rules.mode==='speed');$('active-mode-summary').textContent=`${d.name} · 메인 ${check.counts.main}/${rules.min}~${rules.max}장`;
  $('rules-note').hidden=RULESETS[d.ruleset].playable;
  $('recipe-source').hidden=!d.source_recipe;
  const origin=opponentSources.get(d.deck_id),originLabel=origin?(origin.source==='online'?`온라인 저장본 · 버전 ${origin.version}`:'설치 기본 덱 · 온라인 저장본 없음'):'편집본';
  $('recipe-source').textContent=d.source_recipe?`${originLabel} · 적용 상대: ${d.source_recipe.filename} · 등장 난이도 ${d.source_recipe.difficulty_levels.join(', ')} · 온라인 저장으로 다음 실행 때 반영할 수 있어.`:'';
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
    select.addEventListener('click',()=>{$('add-group').value=group;if(group==='extra')$('builder-type').value='융합 몬스터';else if($('builder-type').value==='융합 몬스터')$('builder-type').value='';page=1;renderPool();switchView(false);$('builder-search').focus();});title.append(select);section.append(title);
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
function filtered(){
  const q=$('builder-search').value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
  return cards.filter(c=>!c.special&&tagMatches(tagsCloud?.state,c,[...selectedTags])&&(!q||c.searchText.includes(q)||(annotationFor(tagsCloud?.state,c)?.tags||[]).join(' ').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'').includes(q))&&(!$('builder-type').value||c.type===$('builder-type').value)&&(!$('builder-race').value||c.race===$('builder-race').value)&&(!$('builder-tier').value||c.rarity===$('builder-tier').value)).sort((a,b)=>collator.compare(a.name_ko,b.name_ko));
}
function renderPool(){
  const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/PAGE));page=Math.min(page,pages);
  $('pool-results').textContent=`${rows.length.toLocaleString('ko-KR')}종 · ${GROUP_LABELS[$('add-group').value]} 덱에 추가`;
  for(const id of ['pool-pages-top','pool-pages-bottom'])renderPagination($(id),page,pages,goPage);
  $('builder-cards').replaceChildren(...rows.slice((page-1)*PAGE,page*PAGE).map(card=>{
    const item=el('article',null,'builder-card'),art=el('button',null,'builder-art');art.type='button';art.setAttribute('aria-label',`${card.name_ko} 효과 보기`);
    item.poolCard=card;
    const img=el('img');img.src=card.image;img.alt='';img.width=200;img.height=290;img.loading='lazy';art.append(img);const badge=restrictionBadge(current(),card,true);if(badge)art.append(badge);art.addEventListener('click',()=>openDetail(card));
    const addButton=el('button',null,'builder-add');addButton.type='button';const used=copyCount(current(),card.identity_key),limit=cardLimit(current(),card),wrong=placementError(card,$('add-group').value);
    setPoolControl(card,addButton);addButton.addEventListener('click',()=>wrong?openDetail(card):add(card,$('add-group').value));
    item.append(art,el('h3',card.name_ko),el('span',card.rarity,`rarity ${card.rarity}`),el('p',[card.type,card.race].filter(Boolean).join(' · '),'muted'),addButton);return item;
  }));
  if(!rows.length)$('builder-cards').append(el('p','조건에 맞는 카드가 없어. 검색이나 필터를 줄여줘.','muted'));
}
function setPoolControl(card,button){
  const d=current(),group=$('add-group').value,used=copyCount(d,card.identity_key),limit=cardLimit(d,card),wrong=placementError(card,group);
  button.textContent=wrong?'효과 보기':`＋ 추가 · ${used}/${limit}`;
  button.setAttribute('aria-label',wrong?`${card.name_ko} 효과 보기`:`${card.name_ko} ${GROUP_LABELS[group]} 덱에 추가`);
  button.disabled=!wrong&&(used>=limit||groupCount(d,group)>=(group==='main'?RULESETS[d.ruleset].max:15));
  button.title=wrong?'':used>=limit?'AI도 같은 카드는 전체 덱 합계 3장까지.':'AI 금제 예외 · 같은 카드 3장까지';
}
function updatePoolControls(){for(const item of $('builder-cards').children)if(item.poolCard)setPoolControl(item.poolCard,item.querySelector('.builder-add'));}
function goPage(next){page=next;renderPool();$('pool-results').scrollIntoView({block:'start'});}
function add(card,group){try{keepViewport(()=>{adjustCard(current(),card,group,1,cards);persist();renderDeck();updatePoolControls();});toast(`${card.name_ko} · ${GROUP_LABELS[group]} 덱에 추가했어.`);}catch(error){toast(error.message);}}
function openDetail(card){
  const layout=el('div',null,'detail-layout'),art=el('div',null,'detail-art'),info=el('div',null,'detail-info'),img=el('img');img.src=card.image;img.alt=card.name_ko;img.width=200;img.height=290;art.append(img);const artBadge=restrictionBadge(current(),card,true);if(artBadge)art.append(artBadge);
  const title=el('h2',card.name_ko);title.id='builder-detail-title';info.append(title,el('p',[card.type,card.race,card.level==null?'':`LV ${card.level}`,card.atk==null?'':`ATK ${card.atk} / DEF ${card.def}`].filter(Boolean).join(' · '),'muted'),restrictionBadge(current(),card));
  info.append(el('p','배지는 플레이어 금제 기준이야. AI는 금제와 관계없이 같은 카드 3장까지 사용할 수 있어.','muted'));
  info.append(el('p','현재 모드 효과','description-title'),el('div',card.description_ko,'description'));
  if(card.review_note)info.append(el('p',card.review_note,'review-note'));
  const tags=annotationFor(tagsCloud?.state,card)?.tags||[];
  if(tags.length){const badges=el('div',null,'custom-tag-badges');for(const tag of tags){const b=el('button','#'+tag,'tag-badge');b.type='button';b.addEventListener('click',()=>{selectedTags.clear();selectedTags.add(tag);$('builder-search').value='';for(const id of ['builder-type','builder-race','builder-tier'])$(id).value='';page=1;renderTags();renderPool();$('builder-detail').close();switchView(false);});badges.append(b);}info.append(badges);}
  const related=relatedAnnotations(tagsCloud?.state,card,cards);
  if(related.length){const links=el('div',null,'relation-links');info.append(el('h3','관련 카드'),links);for(const c of related){const b=el('button',c.name_ko);b.type='button';b.addEventListener('click',()=>openDetail(c));links.append(b);}}
  const buttons=el('div',null,'builder-detail-add');for(const group of GROUPS)if(!placementError(card,group)){const b=el('button',`${GROUP_LABELS[group]}에 추가`,'primary');b.type='button';b.addEventListener('click',()=>add(card,group));buttons.append(b);}info.append(buttons);
  const catalogLink=el('a','도감에서 검토 의견 보기 ↗');catalogLink.href=`./#card-${card.slot}`;catalogLink.target='_blank';catalogLink.rel='noopener';info.append(el('p'),catalogLink);layout.append(art,info);$('builder-detail-body').replaceChildren(layout);if(!$('builder-detail').open)$('builder-detail').showModal();
}
function switchView(deck){document.querySelector('.builder-workspace').classList.toggle('deck-view',deck);$('show-pool').classList.toggle('active',!deck);$('show-deck').classList.toggle('active',deck);$('show-pool').setAttribute('aria-pressed',String(!deck));$('show-deck').setAttribute('aria-pressed',String(deck));}
function selectDeck(id){active=id;renderLibrary();showFields();renderDeck();renderPool();}
function newDeck(clone=false,ruleset='classic'){
  if(decks.length>=100){toast('덱은 100개까지야. JSON을 보관해줘.');return;}
  const d=clone?structuredClone(current()):emptyDeck(uid(),ruleset);d.deck_id=uid();if(clone)d.name=(d.name+' 복제').slice(0,80);decks.push(d);selectDeck(d.deck_id);persist();switchView(true);
}
function chooseNewDeck(){if(meta&&!$('new-deck-dialog').open)$('new-deck-dialog').showModal();}
function onlineSummary(){
  $('online-dialog-status').textContent='';
  const target=opponents.find(d=>d.deck_id===$('online-target').value),d=current();
  $('online-summary').textContent=target?`${d.name} · 메인 ${groupCount(d,'main')}장 / 융합 ${groupCount(d,'extra')}장 / 사이드 ${groupCount(d,'side')}장 → ${target.source_recipe.filename} · 실제 등장 난이도 ${target.source_recipe.difficulty_levels.join(', ')}`:'같은 모드의 적용 상대가 없어.';
}
async function openOnline(){
  if(!meta)return;
  const targets=opponents.filter(d=>d.ruleset===current().ruleset);
  $('online-target').replaceChildren(...targets.map(d=>{const o=el('option',`${d.name} · ${d.source_recipe.filename}`);o.value=d.deck_id;return o;}));
  const source=current().source_recipe?.filename,original=targets.find(d=>d.source_recipe.filename===source);
  if(original)$('online-target').value=original.deck_id;
  onlineVersions=null;onlineSummary();$('online-dialog').showModal();$('prepare-online').disabled=true;
  try{if(!cloud)throw new Error('온라인 연결 준비 중이야. 잠시 후 다시 시도해줘.');const rows=await cloud.load();onlineVersions=new Map(rows.map(r=>[r.filename,r.version]));$('online-dialog-status').textContent=canEdit?'적용 상대를 확인한 뒤 저장해줘.':'이메일 인증 후 저장할 수 있어.';}
  catch(error){$('online-dialog-status').textContent=cloudError(error);}
  finally{$('prepare-online').disabled=!canEdit||onlineVersions===null;}
}
async function prepareOnline(){
  $('prepare-online').disabled=true;
  try{
    if(!canEdit||onlineVersions===null)throw new Error('poc_editor_required');
    const target=opponents.find(d=>d.deck_id===$('online-target').value),packet=await makeSyncPacket(meta,current(),target,cards);
    $('online-dialog-status').textContent='덱을 검사하고 저장하는 중…';
    const row=await cloud.save(packet,onlineVersions.get(packet.target.filename)??0);onlineVersions.set(row.filename,row.version);
    $('online-dialog-status').textContent=`저장 완료 · ${packet.deck.name} · ${row.filename} · 다음 창모드 실행 때 반영돼.`;
    $('online-status').textContent=$('online-dialog-status').textContent;toast('AI 덱을 온라인에 저장했어.');
  }catch(error){$('online-dialog-status').textContent=error.message?.includes('poc_')||error.code?cloudError(error):error.message;}
  finally{$('prepare-online').disabled=!canEdit||onlineVersions===null;}
}
async function loadOnline(){
  $('load-online').disabled=true;$('online-status').textContent='온라인에 저장된 덱을 확인하는 중…';
  try{
    if(!cloud)throw new Error('온라인 연결 준비 중이야. 잠시 후 다시 시도해줘.');
    const entries=await cloud.load();if(!entries.length){$('online-status').textContent='아직 온라인에 저장한 덱이 없어. 현재 상대 덱을 편집한 뒤 온라인 저장해줘.';return;}
    if(decks.length+entries.length>100)throw new Error('온라인 덱을 추가하면 100개를 넘어. 기존 JSON을 먼저 보관해줘.');
    const incoming=[];for(const entry of entries){if(entry.packet.catalog_dataset_id!==meta.dataset_id)throw new Error('도감이 변경됐어. 이전 온라인 덱은 JSON으로 검토해야 해.');incoming.push(await packetDeck(entry.packet,cards,uid()));}
    if(storageBlocked)throw new Error('이전 브라우저 저장을 보존 중이야. 먼저 JSON을 보관해줘.');
    localStorage.setItem(DECK_STORAGE_KEY+'-before-online',JSON.stringify(bundle()));
    decks.push(...incoming);selectDeck(incoming[0].deck_id);persist();switchView(true);
    $('online-status').textContent=`온라인 저장 ${incoming.length}개를 편집본으로 가져왔어. 기존 편집본도 보존했어. 실제 PC 적용 기록은 KoreanPatch/reports/last_ai_sync.json에서 확인할 수 있어.`;
  }catch(error){$('online-status').textContent=error.message;}
  finally{$('load-online').disabled=false;}
}
async function authStatus(session){
  const generation=++authGeneration;canEdit=false;$('auth-signout').hidden=!session;$('auth-open').textContent=session?'다른 이메일로 로그인':'이메일로 로그인';
  $('auth-status').textContent=session?'편집 권한을 확인하는 중…':'로그인하면 AI 덱을 온라인에 저장할 수 있어.';
  if(session){try{const allowed=await cloud.editor();if(generation!==authGeneration)return;canEdit=allowed;$('auth-status').textContent=allowed?`${session.user.email} · 덱 편집 가능`:'로그인됨 · 이 계정에는 덱 편집 권한이 없어.';}catch(error){if(generation!==authGeneration)return;$('auth-status').textContent=cloudError(error);}}
  $('prepare-online').disabled=!canEdit||onlineVersions===null;
}
async function initCloud(){
  try{
    const response=await fetch('./data/cloud-config.json?v=20261006-13',{cache:'no-store'});if(!response.ok)throw new Error('설정 없음');
    const config=validateCloudConfig(await response.json());authClient=createClient(config.url,config.publishable_key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'poc-ai-editor-auth-v1'},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(10000)})}});cloud=new DeckCloud(authClient);
    authClient.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>authStatus(session),0);});
    tagsCloud=new CardTagsCloud(authClient);await refreshTags();
    const {data,error}=await authClient.auth.getSession();if(error)throw error;await authStatus(data.session);
    applySettings(cards,await new CardSettingsCloud(authClient).load());renderPool();
  }catch(error){$('auth-status').textContent=cloudError(error);}
}
async function sendLogin(){
  const email=$('auth-email').value.trim();if(!$('auth-email').reportValidity())return;
  $('auth-send').disabled=true;$('auth-message').textContent='인증 메일을 보내는 중…';persist();
  try{if(!authClient)throw new Error('온라인 연결 없음');const redirect=new URL('ai-decks.html',location.href);redirect.hash='';redirect.search='';
    const {error}=await authClient.auth.signInWithOtp({email,options:{emailRedirectTo:redirect.href}});if(error)throw error;
    $('auth-message').textContent='인증 메일을 보냈어. 메일의 로그인 링크를 눌러줘. 편집본은 이 브라우저에 보관돼.';
  }catch(error){$('auth-message').textContent=cloudError(error);}finally{$('auth-send').disabled=false;}
}
function renderOpponentOptions(){
  const mode=$('opponent-mode').value,difficulty=Number($('opponent-difficulty').value),previous=$('example-select').value;
  const filtered=opponents.filter(d=>(!mode||RULESETS[d.ruleset].mode===mode)&&(!difficulty||d.source_recipe.difficulty_levels.includes(difficulty)));
  $('example-select').replaceChildren(...filtered.map(d=>{const o=el('option',`${d.name} · 메인 ${groupCount(d,'main')}장`);o.value=d.deck_id;return o;}));
  if(filtered.some(d=>d.deck_id===previous))$('example-select').value=previous;
  $('opponent-count').textContent=`게임 상대 덱 ${opponents.length}개 중 ${filtered.length}개 · 선택하면 최신 온라인 저장본을 먼저 확인해.`;
  $('load-example').disabled=loadingOpponent||!filtered.length;
  renderSelectedActor();
}
function renderActor(node,deck){
  const actor=actorForDeck(actors,deck);node.hidden=!actor;node.replaceChildren();if(!actor)return;
  const img=el('img');img.src=actor.portrait;img.alt=actor.name;img.width=64;img.height=76;
  const text=el('div');text.append(el('small','이 덱의 듀얼리스트'),el('strong',actor.name),el('span',deck.source_recipe.filename));node.append(img,text);
}
function renderSelectedActor(){renderActor($('selected-opponent-actor'),opponents.find(d=>d.deck_id===$('example-select').value));}
async function loadActors(){
  try{const response=await fetch('./data/ai-actors.json?v=20261006-37',{cache:'no-cache'});if(response.ok)actors=parseActors(await response.json());}
  catch{actors=[];} // Card/deck editing remains usable if portrait data is unavailable.
  renderDeck();
}
async function loadOpponents(){
  try{const response=await fetch('./data/ai-opponents.json?v=20261006-10',{cache:'no-cache'});if(!response.ok)throw new Error('현재 상대 덱 자료를 가져오지 못했어.');opponents=parseBundle(await response.json(),cards);renderOpponentOptions();}
  catch(error){$('opponent-count').textContent=error.message;$('load-example').disabled=true;}
}
async function loadSelectedOpponent(){
  if(loadingOpponent)return;
  loadingOpponent=true;$('load-example').disabled=true;
  $('opponent-load-status').textContent='선택한 상대의 최신 온라인 저장본을 확인하는 중…';
  try{
    if(decks.length>=100)throw new Error('덱은 100개까지야.');
    if(storageBlocked)throw new Error('이전 브라우저 저장을 보존 중이야. 먼저 JSON을 보관해줘.');
    const target=opponents.find(d=>d.deck_id===$('example-select').value);
    if(!cloud)throw new Error('온라인 연결 준비 중이야. 잠시 후 다시 시도해줘.');
    const result=await loadOpponentDeck(meta,target,cards,uid(),()=>cloud.load());
    if(decks.length>=100)throw new Error('덱은 100개까지야.');
    decks.push(result.deck);opponentSources.set(result.deck.deck_id,result);
    selectDeck(result.deck.deck_id);persist();switchView(true);$('deck-name').focus({preventScroll:true});
    const message=result.source==='online'?`${result.deck.source_recipe.filename} · 온라인 저장본 버전 ${result.version}을 가져왔어. 게임에는 다음 실행 때 반영돼.`:`${result.deck.source_recipe.filename} · 온라인 저장본이 없어 설치 기본 덱을 가져왔어.`;
    $('opponent-load-status').textContent=message;$('online-status').textContent=message;toast(message);
  }catch(error){
    const message=error.message?.includes('poc_')||error.code?cloudError(error):error.message;
    $('opponent-load-status').textContent=`불러오지 못했어. 기존 편집본은 유지했어. ${message}`;toast($('opponent-load-status').textContent);
  }finally{loadingOpponent=false;renderOpponentOptions();}
}
async function init(){
  try{
    const response=await fetch('./data/cards.json?v=20261006-6',{cache:'no-cache'});if(!response.ok)throw new Error('카드 자료를 가져오지 못했어.');const data=await response.json();meta=data.meta;cards=data.cards;
    if(cards.length!==meta.total||new Set(cards.map(c=>c.identity_key)).size!==cards.length)throw new Error('도감 자료를 확인할 수 없어.');
    for(const c of cards)c.searchText=[c.name_ko,c.name_en,c.description_ko,c.race,c.type,String(c.slot)].join(' ').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
    for(const [id,values] of [['builder-type',[...new Set(cards.filter(c=>!c.special).map(c=>c.type))]],['builder-race',[...new Set(cards.filter(c=>!c.special).map(c=>c.race).filter(Boolean))].sort(collator.compare)]])for(const value of values){const o=el('option',value);o.value=value;$(id).append(o);}
    try{const stored=localStorage.getItem(DECK_STORAGE_KEY);if(stored)decks=parseBundle(JSON.parse(stored),cards);}catch{storageBlocked=true;toast('이전 AI 덱을 읽지 못했어. 기존 저장은 유지하고 현재 편집은 JSON으로 보관할게.');}
    if(!decks.length)decks=[emptyDeck(uid())];active=decks[0].deck_id;selectDeck(active);
    $('load-status').textContent=`도감 ${meta.regular_count.toLocaleString('ko-KR')}종으로 상대 덱을 구성할 수 있어.`;
    await loadActors();await loadOpponents();await initCloud();
    const match=/^#card-(\d+)$/.exec(location.hash);if(match){const card=cards.find(c=>c.slot===Number(match[1]));if(card&&!card.special)openDetail(card);}else if(location.hash==='#login')$('auth-dialog').showModal();
  }catch(error){$('load-status').textContent=error.message;$('export-decks').disabled=true;document.querySelector('.builder-workspace').hidden=true;}
}
$('builder-search').addEventListener('input',()=>{page=1;renderPool();});for(const id of ['builder-type','builder-race','builder-tier','add-group'])$(id).addEventListener('change',()=>{page=1;renderPool();});
$('refresh-builder-tags').addEventListener('click',refreshTags);$('clear-builder-tags').addEventListener('click',()=>{selectedTags.clear();renderTags();page=1;renderPool();});
$('show-pool').addEventListener('click',()=>switchView(false));$('show-deck').addEventListener('click',()=>switchView(true));$('deck-select').addEventListener('change',()=>selectDeck($('deck-select').value));$('new-deck').addEventListener('click',chooseNewDeck);$('choose-new-mode').addEventListener('click',chooseNewDeck);$('clone-deck').addEventListener('click',()=>newDeck(true));
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
for(const [id,rules] of [['create-classic','classic'],['create-speed','duel_links_plan']])$(id).addEventListener('click',()=>{$('new-deck-dialog').close();newDeck(false,rules);});
$('load-example').addEventListener('click',loadSelectedOpponent);
for(const id of ['opponent-mode','opponent-difficulty'])$(id).addEventListener('change',renderOpponentOptions);
$('example-select').addEventListener('change',renderSelectedActor);
$('deck-name').addEventListener('input',()=>{current().name=$('deck-name').value;renderLibrary();persist();$('active-mode-summary').textContent=`${current().name} · 메인 ${groupCount(current(),'main')}장`;});
for(const id of ['deck-rules','deck-difficulty','deck-banlist'])$(id).addEventListener('change',()=>{keepViewport(()=>{const d=current();if(d.ruleset!==$('deck-rules').value)delete d.source_recipe;d.ruleset=$('deck-rules').value;d.difficulty=Number($('deck-difficulty').value);d.banlist_enabled=$('deck-banlist').checked;persist();renderLibrary();renderDeck();updatePoolControls();});});
for(const key of ['goal','priorities','combos','avoid'])$('strategy-'+key).addEventListener('input',()=>{current().strategy[key]=$('strategy-'+key).value;persist();});
$('close-builder-detail').addEventListener('click',()=>$('builder-detail').close());$('close-builder-export').addEventListener('click',()=>$('builder-export').close());
$('export-decks').addEventListener('click',()=>{if(!meta)return;$('deck-export-preview').value=deckMarkdown(meta,[current()],cards);$('builder-export').showModal();});
$('download-current-deck').addEventListener('click',()=>fileDownload('AI덱_현재덱.json',JSON.stringify(bundle([current()]),null,2)+'\n'));
$('download-all-decks').addEventListener('click',()=>fileDownload('AI덱_전체.json',JSON.stringify(bundle(),null,2)+'\n'));
$('download-deck-notes').addEventListener('click',()=>fileDownload('AI덱_플레이지침.md',deckMarkdown(meta,[current()],cards),'text/markdown;charset=utf-8'));
$('import-decks').addEventListener('click',()=>$('deck-import-file').click());$('deck-import-file').addEventListener('change',async()=>{
  const file=$('deck-import-file').files?.[0];if(!file)return;
  try{
    if(file.size>8*1024*1024)throw new Error('파일이 너무 커. AI 덱 JSON을 골라줘.');
    const incoming=parseBundle(JSON.parse(await file.text()),cards);if(!incoming.length)throw new Error('불러올 덱이 없어.');
    const merged=new Map(decks.map(d=>[d.deck_id,d]));for(const d of incoming)merged.set(d.deck_id,d);if(merged.size>100)throw new Error('덱은 100개까지 불러올 수 있어.');
    const backup=JSON.stringify(bundle(),null,2)+'\n';
    if(!storageBlocked)localStorage.setItem(DECK_STORAGE_KEY+'-before-import',backup);
    decks=[...merged.values()];selectDeck(incoming[0].deck_id);persist();switchView(true);
    toast(`${incoming.length}개 덱을 불러왔어. 이전 덱 백업도 내려받을게.`);fileDownload('AI덱_불러오기전_백업.json',backup);
  }catch(error){toast(error.message);}finally{$('deck-import-file').value='';}
});
init();
