import {DECK_STORAGE_KEY,GROUPS,GROUP_LABELS,RULESETS,emptyDeck,cardLimit,copyCount,groupCount,placementError,adjustCard,resolveCard,validateDeck,parseBundle,exportBundle,deckMarkdown} from './ai-deck-core.js?v=20261006-10';
import {renderPagination} from './pagination.js?v=20261006-8';
import {SYNC_REPO,SYNC_URL,makeSyncPacket,issueDraft,packetDeck} from './ai-sync-core.js?v=20261006-12';

const $=id=>document.getElementById(id), PAGE=24;
let cards=[],meta=null,decks=[],active='',page=1,timer,storageBlocked=false,opponents=[];
const collator=new Intl.Collator('ko');
function el(tag,text,className){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,4500);}
function uid(){return crypto.randomUUID();}
function current(){return decks.find(d=>d.deck_id===active);}
function fileDownload(name,body,type='application/json;charset=utf-8'){const url=URL.createObjectURL(new Blob([body],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);}
function bundle(selected=decks){return exportBundle(meta,selected,cards);}
function persist(){
  if(storageBlocked){$('deck-save-status').textContent='이전 저장 내용을 보존하고 있어. 현재 덱은 JSON을 내려받아 보관해줘.';return false;}
  try{localStorage.setItem(DECK_STORAGE_KEY,JSON.stringify(bundle()));$('deck-save-status').textContent='이 브라우저에 저장됨 · 다른 기기에서는 JSON으로 이어서 편집';return true;}
  catch{$('deck-save-status').textContent='브라우저 저장 실패 · AI 덱 JSON을 내려받아 보관해줘.';return false;}
}
function renderLibrary(){
  $('deck-select').replaceChildren(...decks.map(d=>{const o=el('option',`[${RULESETS[d.ruleset].shortLabel}] ${d.name||'이름 없는 AI 덱'}`);o.value=d.deck_id;return o;}));$('deck-select').value=active;
}
function showFields(){
  const d=current();$('deck-name').value=d.name;$('deck-rules').value=d.ruleset;$('deck-difficulty').value=String(d.difficulty);$('deck-banlist').checked=d.banlist_enabled;
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
  const rules=RULESETS[d.ruleset];$('active-mode-label').textContent=rules.shortLabel;$('active-mode-label').classList.toggle('speed',rules.mode==='speed');$('active-mode-summary').textContent=`${d.name} · 메인 ${check.counts.main}/${rules.min}~${rules.max}장`;
  $('rules-note').hidden=RULESETS[d.ruleset].playable;
  $('recipe-source').hidden=!d.source_recipe;
  $('recipe-source').textContent=d.source_recipe?`게임 원본: ${d.source_recipe.filename} · 등장 난이도 ${d.source_recipe.difficulty_levels.join(', ')} · 편집본을 JSON으로 보내주면 이 상대 덱에 반영할 수 있어.`:'';
  $('deck-counts').replaceChildren(...GROUPS.map(g=>el('span',`${GROUP_LABELS[g]} ${check.counts[g]}장`)));
  $('validation-summary').textContent=check.issues.length?`확인할 항목 ${check.issues.length}개`:check.ready_for_game?'일반 덱 구성 확인 완료 · 적용 요청 가능':'스피드 덱 구성 완료 · 시험 모드 적용 요청 가능';
  $('deck-issues').replaceChildren(...check.issues.map(message=>el('li',message)));$('validation-summary').parentElement.classList.toggle('ok',!check.issues.length);
  $('deck-groups').replaceChildren(...GROUPS.map(group=>{
    const section=el('section',null,'deck-group'),title=el('h2',`${GROUP_LABELS[group]} 덱 · ${check.counts[group]}장`),select=el('button','카드 찾기');select.type='button';
    select.addEventListener('click',()=>{$('add-group').value=group;if(group==='extra')$('builder-type').value='융합 몬스터';else if($('builder-type').value==='융합 몬스터')$('builder-type').value='';page=1;renderPool();switchView(false);$('builder-search').focus();});title.append(select);section.append(title);
    if(!d.groups[group].length)section.append(el('p','카드 찾기에서 추가할 위치를 고르고 ＋ 버튼을 눌러줘.','builder-empty'));
    for(const row of d.groups[group]){
      const card=resolveCard(row,cards),line=el('div',null,'deck-row'+(card?'':' unknown'));
      line.dataset.identity=row.identity_key;line.dataset.group=group;
      if(card){const img=el('img');img.src=card.image;img.alt='';img.width=33;img.height=48;img.loading='lazy';line.append(img);}
      const name=el('button',row.name_ko,'deck-row-name');name.type='button';name.addEventListener('click',()=>card?openDetail(card):toast('도감과 일치하지 않는 이전 카드야. 빼고 새 카드를 골라줘.'));line.append(name);
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
function filtered(){
  const q=$('builder-search').value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
  return cards.filter(c=>!c.special&&(!q||c.searchText.includes(q))&&(!$('builder-type').value||c.type===$('builder-type').value)&&(!$('builder-race').value||c.race===$('builder-race').value)&&(!$('builder-tier').value||c.rarity===$('builder-tier').value)).sort((a,b)=>collator.compare(a.name_ko,b.name_ko));
}
function renderPool(){
  const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/PAGE));page=Math.min(page,pages);
  $('pool-results').textContent=`${rows.length.toLocaleString('ko-KR')}종 · ${GROUP_LABELS[$('add-group').value]} 덱에 추가`;
  for(const id of ['pool-pages-top','pool-pages-bottom'])renderPagination($(id),page,pages,goPage);
  $('builder-cards').replaceChildren(...rows.slice((page-1)*PAGE,page*PAGE).map(card=>{
    const item=el('article',null,'builder-card'),art=el('button',null,'builder-art');art.type='button';art.setAttribute('aria-label',`${card.name_ko} 효과 보기`);
    item.poolCard=card;
    const img=el('img');img.src=card.image;img.alt='';img.width=200;img.height=290;img.loading='lazy';art.append(img);art.addEventListener('click',()=>openDetail(card));
    const addButton=el('button',null,'builder-add');addButton.type='button';const used=copyCount(current(),card.identity_key),limit=cardLimit(current(),card),wrong=placementError(card,$('add-group').value);
    setPoolControl(card,addButton);addButton.addEventListener('click',()=>wrong?openDetail(card):add(card,$('add-group').value));
    item.append(art,el('h3',card.name_ko),el('span',card.rarity,`rarity ${card.rarity}`),el('p',[card.type,card.race,limit===3?'3장':limit===0?'금지':`제한 ${limit}장`].filter(Boolean).join(' · '),'muted'),addButton);return item;
  }));
  if(!rows.length)$('builder-cards').append(el('p','조건에 맞는 카드가 없어. 검색이나 필터를 줄여줘.','muted'));
}
function setPoolControl(card,button){
  const d=current(),group=$('add-group').value,used=copyCount(d,card.identity_key),limit=cardLimit(d,card),wrong=placementError(card,group);
  button.textContent=wrong?'효과 보기':`＋ 추가 · ${used}/${limit}`;
  button.setAttribute('aria-label',wrong?`${card.name_ko} 효과 보기`:`${card.name_ko} ${GROUP_LABELS[group]} 덱에 추가`);
  button.disabled=!wrong&&(used>=limit||groupCount(d,group)>=(group==='main'?RULESETS[d.ruleset].max:15));
}
function updatePoolControls(){for(const item of $('builder-cards').children)if(item.poolCard)setPoolControl(item.poolCard,item.querySelector('.builder-add'));}
function goPage(next){page=next;renderPool();$('pool-results').scrollIntoView({block:'start'});}
function add(card,group){try{keepViewport(()=>{adjustCard(current(),card,group,1);persist();renderDeck();updatePoolControls();});toast(`${card.name_ko} · ${GROUP_LABELS[group]} 덱에 추가했어.`);}catch(error){toast(error.message);}}
function openDetail(card){
  const layout=el('div',null,'detail-layout'),art=el('div',null,'detail-art'),info=el('div',null,'detail-info'),img=el('img');img.src=card.image;img.alt=card.name_ko;img.width=200;img.height=290;art.append(img);
  const title=el('h2',card.name_ko);title.id='builder-detail-title';info.append(title,el('p',[card.type,card.race,card.level==null?'':`LV ${card.level}`,card.atk==null?'':`ATK ${card.atk} / DEF ${card.def}`].filter(Boolean).join(' · '),'muted'),el('p','현재 모드 효과','description-title'),el('div',card.description_ko,'description'));
  if(card.review_note)info.append(el('p',card.review_note,'review-note'));
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
  $('online-ready').hidden=true;$('online-dialog-status').textContent='';
  const target=opponents.find(d=>d.deck_id===$('online-target').value),d=current();
  $('online-summary').textContent=target?`${d.name} · 메인 ${groupCount(d,'main')}장 / 융합 ${groupCount(d,'extra')}장 / 사이드 ${groupCount(d,'side')}장 → ${target.source_recipe.filename} · 실제 등장 난이도 ${target.source_recipe.difficulty_levels.join(', ')}`:'같은 모드의 적용 상대가 없어.';
}
function openOnline(){
  if(!meta)return;
  const targets=opponents.filter(d=>d.ruleset===current().ruleset);
  $('online-target').replaceChildren(...targets.map(d=>{const o=el('option',`${d.name} · ${d.source_recipe.filename}`);o.value=d.deck_id;return o;}));
  const source=current().source_recipe?.filename,original=targets.find(d=>d.source_recipe.filename===source);
  if(original)$('online-target').value=original.deck_id;
  onlineSummary();$('online-dialog').showModal();
}
async function prepareOnline(){
  $('prepare-online').disabled=true;$('online-ready').hidden=true;
  try{
    const target=opponents.find(d=>d.deck_id===$('online-target').value),packet=await makeSyncPacket(meta,current(),target,cards),draft=await issueDraft(packet);
    $('online-body-text').value=draft.body;
    const url=draft.prefilled?draft.url:`https://github.com/${SYNC_REPO}/issues/new?title=${encodeURIComponent('[AI 덱 저장] '+current().name)}`;
    $('confirm-online').href=url;
    $('online-copy-note').textContent=draft.prefilled?'GitHub 화면에 저장 내용이 자동 입력돼. 해당 계정으로 로그인한 뒤 저장을 확정해줘.':'메모가 길어서 아래 저장 내용을 복사하고 GitHub 본문에 붙여 넣어줘.';
    $('online-dialog-status').textContent='';$('online-ready').hidden=false;
  }catch(error){$('online-dialog-status').textContent=error.message;}
  finally{$('prepare-online').disabled=false;}
}
async function loadOnline(){
  $('load-online').disabled=true;$('online-status').textContent='온라인에 저장된 덱을 확인하는 중…';
  try{
    const response=await fetch(SYNC_URL+'&check='+Date.now(),{cache:'no-store',headers:{Accept:'application/vnd.github.raw+json'},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('온라인 덱을 가져오지 못했어. 잠시 후 다시 눌러줘.');
    const remote=await response.json();if(remote.kind!=='poc-ai-sync-state'||remote.schema_version!==1||!remote.entries||Object.keys(remote.entries).length>42)throw new Error('온라인 자료 형식을 확인할 수 없어.');
    const entries=Object.values(remote.entries);if(!entries.length){$('online-status').textContent='아직 GitHub 저장 검사를 통과한 덱이 없어. 저장을 확정한 뒤 잠시 기다려줘.';return;}
    if(decks.length+entries.length>100)throw new Error('온라인 덱을 추가하면 100개를 넘어. 기존 JSON을 먼저 보관해줘.');
    const incoming=[];for(const entry of entries){if(entry.packet.catalog_dataset_id!==meta.dataset_id)throw new Error('도감이 변경됐어. 이전 온라인 덱은 JSON으로 검토해야 해.');incoming.push(await packetDeck(entry.packet,cards,uid()));}
    if(storageBlocked)throw new Error('이전 브라우저 저장을 보존 중이야. 먼저 JSON을 보관해줘.');
    localStorage.setItem(DECK_STORAGE_KEY+'-before-online',JSON.stringify(bundle()));
    decks.push(...incoming);selectDeck(incoming[0].deck_id);persist();switchView(true);
    $('online-status').textContent=`온라인 저장 ${incoming.length}개를 편집본으로 가져왔어. 기존 편집본도 보존했어. 실제 PC 적용 기록은 KoreanPatch/reports/last_ai_sync.json에서 확인할 수 있어.`;
  }catch(error){$('online-status').textContent=error.message;}
  finally{$('load-online').disabled=false;}
}
function renderOpponentOptions(){
  const mode=$('opponent-mode').value,difficulty=Number($('opponent-difficulty').value),previous=$('example-select').value;
  const filtered=opponents.filter(d=>(!mode||RULESETS[d.ruleset].mode===mode)&&(!difficulty||d.source_recipe.difficulty_levels.includes(difficulty)));
  $('example-select').replaceChildren(...filtered.map(d=>{const o=el('option',`${d.name} · 메인 ${groupCount(d,'main')}장`);o.value=d.deck_id;return o;}));
  if(filtered.some(d=>d.deck_id===previous))$('example-select').value=previous;
  $('opponent-count').textContent=`현재 설치된 AI 덱 ${opponents.length}개 중 ${filtered.length}개 · 일부 난이도는 같은 덱을 공유해.`;
  $('load-example').disabled=!filtered.length;
}
async function loadOpponents(){
  try{const response=await fetch('./data/ai-opponents.json?v=20261006-10',{cache:'no-cache'});if(!response.ok)throw new Error('현재 상대 덱 자료를 가져오지 못했어.');opponents=parseBundle(await response.json(),cards);renderOpponentOptions();}
  catch(error){$('opponent-count').textContent=error.message;$('load-example').disabled=true;}
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
    await loadOpponents();
    const match=/^#card-(\d+)$/.exec(location.hash);if(match){const card=cards.find(c=>c.slot===Number(match[1]));if(card&&!card.special)openDetail(card);}
  }catch(error){$('load-status').textContent=error.message;$('export-decks').disabled=true;document.querySelector('.builder-workspace').hidden=true;}
}
$('builder-search').addEventListener('input',()=>{page=1;renderPool();});for(const id of ['builder-type','builder-race','builder-tier','add-group'])$(id).addEventListener('change',()=>{page=1;renderPool();});
$('show-pool').addEventListener('click',()=>switchView(false));$('show-deck').addEventListener('click',()=>switchView(true));$('deck-select').addEventListener('change',()=>selectDeck($('deck-select').value));$('new-deck').addEventListener('click',chooseNewDeck);$('choose-new-mode').addEventListener('click',chooseNewDeck);$('clone-deck').addEventListener('click',()=>newDeck(true));
$('close-new-deck').addEventListener('click',()=>$('new-deck-dialog').close());
$('save-online').addEventListener('click',openOnline);
$('load-online').addEventListener('click',loadOnline);
$('close-online').addEventListener('click',()=>$('online-dialog').close());
$('online-target').addEventListener('change',onlineSummary);
$('prepare-online').addEventListener('click',prepareOnline);
$('copy-online-body').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('online-body-text').value);$('online-dialog-status').textContent='복사했어. GitHub 본문에 붙여 넣어줘.';}catch{$('online-body-text').focus();$('online-body-text').select();$('online-dialog-status').textContent='아래 내용을 선택했어. 직접 복사해줘.';}});
$('confirm-online').addEventListener('click',()=>{$('online-status').textContent='GitHub 저장 화면을 열었어. 아직 저장 완료는 아니야. GitHub에서 저장 확정 후 ‘온라인 덱 불러오기’로 검사 결과를 확인해줘.';});
for(const [id,rules] of [['create-classic','classic'],['create-speed','duel_links_plan']])$(id).addEventListener('click',()=>{$('new-deck-dialog').close();newDeck(false,rules);});
$('load-example').addEventListener('click',async()=>{
  try{if(decks.length>=100)throw new Error('덱은 100개까지야.');const original=opponents.find(d=>d.deck_id===$('example-select').value);if(!original)throw new Error('상대 덱을 골라줘.');const d=structuredClone(original);d.deck_id=uid();decks.push(d);selectDeck(d.deck_id);persist();switchView(true);$('deck-name').focus({preventScroll:true});toast('현재 AI 덱을 편집본으로 가져왔어. 카드와 이름을 바꾼 뒤 JSON으로 보내줘.');}catch(error){toast(error.message);}
});
for(const id of ['opponent-mode','opponent-difficulty'])$(id).addEventListener('change',renderOpponentOptions);
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
