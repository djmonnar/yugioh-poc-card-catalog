import {TIERS, STORAGE_KEY, changesFor, makeReview, exportPayload, parseImport, reviewCounts, reviewMarkdown} from './review-core.js?v=20261006-5';
import {RESET_BACKUP_KEY, resetStoredReviews} from './review-storage.js?v=20261006-5';
import {categoryMatches, groupCards, cardLink, groupHash, parseCatalogHash} from './card-groups.js?v=20261006-7';
import {renderPagination} from './pagination.js?v=20261006-8';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig,DeckCloud,cloudError} from './supabase-cloud.js?v=20261006-13';
import {CardSettingsCloud,applySettings} from './card-settings.js?v=20261006-14';

const $ = id => document.getElementById(id);
const PAGE_SIZE = 36;
const fmt = n => n.toLocaleString('ko-KR');
const collator = new Intl.Collator('ko');
const narrowLayout = matchMedia('(max-width: 800px)');
$('advanced-filters').open = !narrowLayout.matches;
narrowLayout.addEventListener('change', event => { $('advanced-filters').open = !event.matches; });
let cards = [], meta = null, reviews = new Map(), unmatched = [], page = 1, rarity = '', view = 'all', selected = null, backup = null;
let timer, resetBackup = null;
let settingsCloud=null,settingsAuth=null,catalogCanEdit=false,catalogAuthGeneration=0;
function liveSettings(card,info){
  if(card.special)return;
  const box=el('section',null,'review-editor live-card-settings');box.append(el('h3','게임 설정 바로 저장'));
  const ready=catalogCanEdit&&settingsCloud?.rows!==null&&settingsCloud;
  const expected=ready?settingsCloud.version(card):null;
  box.append(selectControl('live-rarity','현재 카드 등급',TIERS.map(t=>[t,`${t} · ${meta.rarity_prices[t].buy_price} 골드`]),card.rarity,!ready));
  const checkRow=el('div',null,'check-row'),stock=el('input');stock.id='live-stock';stock.type='checkbox';stock.checked=card.stock;stock.disabled=!ready;
  const label=el('label','상점에서 이 카드 판매');label.htmlFor=stock.id;checkRow.append(stock,label);box.append(checkRow);
  const save=el('button','등급·판매 여부 저장','primary');save.type='button';save.id='save-card-setting';save.disabled=!ready;
  const status=el('p',ready?'저장하면 도감에 반영돼. PC 상점도 실행 중이면 설정을 받아와.':'이메일 로그인 후 등급과 상점 판매 여부를 직접 바꿀 수 있어.','muted');status.id='live-setting-status';status.setAttribute('role','status');box.append(save,status);
  if(!ready){const login=el('a','이메일 로그인');login.href='ai-decks.html#login';box.append(login);}
  save.addEventListener('click',async()=>{
    const rarity=$('live-rarity').value,stocked=stock.checked;save.disabled=true;stock.disabled=true;$('live-rarity').disabled=true;status.textContent='설정을 저장하는 중…';
    try{const row=await settingsCloud.save(meta,card,rarity,stocked,expected);applySettings(cards,[row]);rarityButtons();render();const top=$('card-dialog').scrollTop;
      if(selected?.slot===card.slot){openCard(card.slot);$('card-dialog').scrollTop=top;$('live-setting-status').textContent='저장 완료 · 등급·가격·상점 판매 여부를 반영했어.';}toast('카드 설정을 온라인에 저장했어.');
    }catch(error){status.textContent=error.message;save.disabled=false;stock.disabled=false;if(selected?.slot===card.slot)$('live-rarity').disabled=false;}
  });info.append(box);
}
async function refreshCardSettings(){
  if(!settingsCloud)return;const rows=await settingsCloud.load();applySettings(cards,rows);rarityButtons();render();if(selected)openCard(selected.slot);
}
async function initCardSettings(){
  try{
    const response=await fetch('./data/cloud-config.json?v=20261006-13',{cache:'no-store'});if(!response.ok)throw new Error('설정 없음');const config=validateCloudConfig(await response.json());
    settingsAuth=createClient(config.url,config.publishable_key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'poc-ai-editor-auth-v1'},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(10000)})}});
    settingsCloud=new CardSettingsCloud(settingsAuth);await refreshCardSettings();
    const update=async session=>{const generation=++catalogAuthGeneration,previous=catalogCanEdit;try{const allowed=session?await new DeckCloud(settingsAuth).editor():false;if(generation!==catalogAuthGeneration)return;catalogCanEdit=allowed;$('card-cloud-status').textContent=catalogCanEdit?'로그인됨 · 카드 상세에서 등급·판매 여부를 바로 저장할 수 있어.':'등급·상점 판매 설정을 직접 저장하려면 이메일로 로그인해줘.';if(selected&&previous!==catalogCanEdit)openCard(selected.slot);}catch(error){if(generation===catalogAuthGeneration){catalogCanEdit=false;$('card-cloud-status').textContent=cloudError(error);}}};
    settingsAuth.auth.onAuthStateChange((_event,session)=>setTimeout(()=>update(session),0));const {data,error}=await settingsAuth.auth.getSession();if(error)throw error;await update(data.session);
  }catch(error){$('card-cloud-status').textContent=cloudError(error);}
}
const resetPanel=el('section',null,'reset-panel');
resetPanel.append(el('h3','검토 의견 초기화'),el('p','내보내기는 의견을 유지해. 전달을 마쳤다면 초기화하고 새 검토를 시작할 수 있어.'));
for(const [id,text] of [['reset-reviews','의견 전체 초기화'],['undo-reset','초기화 전 의견 복원'],['download-reset-backup','초기화 전 백업 JSON 내려받기']]){
  const button=el('button',text);button.id=id;button.type='button';button.hidden=id!=='reset-reviews';resetPanel.append(button);
}
$('export-dialog').querySelector('.export-body').append(resetPanel);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(timer); timer = setTimeout(() => $('toast').hidden = true, 3500);
}
function limitName(limit) { return limit == null ? '특수' : limit === 0 ? '금지' : limit === 1 ? '제한 1' : limit === 2 ? '준제한 2' : '3장'; }
function labelTier(tier) { return el('span', tier, `rarity ${tier}`); }
function regularLimit(card) { return el('span', limitName(card.deck_limit), 'limit' + (card.deck_limit === 3 || card.special ? ' unlimited' : '')); }
function kind(card) { return [card.type, card.subtype, card.race].filter(Boolean).join(' · '); }
function statText(card) { return card.level == null ? (card.special ? '듀얼 전용 · 참고 카드' : card.subtype + ' ' + card.type) : `LV ${card.level} · ATK ${card.atk} / DEF ${card.def}`; }
function currentPayload() { return exportPayload(meta, [...reviews.values()], unmatched); }

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPayload())); return true; }
  catch { toast('브라우저에 저장할 수 없어. 검토 JSON을 내려받아 보관해줘.'); return false; }
}
function updateCounts() {
  $('review-count').textContent = String(reviews.size);
  $('tab-review-count').textContent = String(reviews.size);
}
function fillFilter(id, values) {
  for (const value of values) { const option = el('option', value); option.value = String(value); $(id).append(option); }
}
function rarityButtons() {
  $('rarity-filters').replaceChildren();
  for (const value of ['', ...TIERS]) {
    const b = el('button', value || '전체'); b.type = 'button';
    b.className = value === rarity ? 'active' : '';
    b.setAttribute('aria-pressed', String(value === rarity));
    b.setAttribute('aria-label', value ? `${value} 등급 보기` : '모든 등급 보기');
    if (value) b.append(el('small', cards.filter(c => c.rarity === value).length));
    b.addEventListener('click', () => { rarity = value; page = 1; rarityButtons(); render(); });
    $('rarity-filters').append(b);
  }
}
function filteredCards() {
  const q = $('search').value.trim().normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g, '');
  const type = $('type-filter').value, race = $('race-filter').value, attribute = $('attribute-filter').value;
  const limit = $('limit-filter').value, status = $('status-filter').value, min = $('level-min').value, max = $('level-max').value;
  return cards.filter(c => {
    if (view === 'reviews' && !reviews.has(c.identity_key)) return false;
    if (!categoryMatches(c, $('mechanic-filter').value, $('group-filter').value)) return false;
    if (rarity && c.rarity !== rarity || type && c.type !== type || race && c.race !== race || attribute && c.attribute !== attribute) return false;
    if (limit !== '' && c.deck_limit !== Number(limit)) return false;
    if (status === 'effect-difference' && c.review_kind !== 'effect') return false;
    if (min && (c.level == null || c.level < Number(min)) || max && (c.level == null || c.level > Number(max))) return false;
    if (status === 'stock' && !c.stock || status === 'reward' && !c.reward_eligible || status === 'regular' && c.special || status === 'special' && !c.special || status === 'attention' && !c.review_note || status === 'replace' && !(reviews.get(c.identity_key)?.changes.replacement_candidate || reviews.get(c.identity_key)?.changes.replacement_name)) return false;
    return !q || c.searchText.includes(q);
  });
}
function sortCards(rows) {
  const value = $('sort').value;
  rows.sort((a,b) => {
    if (value === 'slot') return a.slot - b.slot;
    if (value === 'attack') return (b.atk ?? -1) - (a.atk ?? -1) || collator.compare(a.name_ko,b.name_ko);
    if (value === 'level') return (b.level ?? -1) - (a.level ?? -1) || (b.atk ?? -1) - (a.atk ?? -1) || collator.compare(a.name_ko,b.name_ko);
    if (value === 'rarity') return Number(a.special) - Number(b.special) || TIERS.indexOf(a.rarity) - TIERS.indexOf(b.rarity) || collator.compare(a.name_ko,b.name_ko);
    return collator.compare(a.name_ko,b.name_ko) || a.slot - b.slot;
  });
  return rows;
}
function renderCard(card) {
  const b = el('button', null, 'catalog-card' + (reviews.has(card.identity_key) ? ' reviewed' : ''));
  b.type = 'button'; b.dataset.slot = String(card.slot);
  b.setAttribute('aria-label', `${card.name_ko} · ${card.rarity} · ${limitName(card.deck_limit)} · 상세 및 검토`);
  const image = document.createElement('img'); image.src = card.image; image.alt = ''; image.width = 200; image.height = 290; image.loading = 'lazy'; image.decoding = 'async';
  b.append(image);
  if (reviews.has(card.identity_key)) b.append(el('span', '검토 작성', 'review-mark'));
  const metadata = el('div', null, 'card-meta'); metadata.append(labelTier(card.rarity), regularLimit(card)); b.append(metadata);
  const name = el('h3', card.name_ko);
  if (card.review_note) { const dot = el('span', '', 'attention-dot'); dot.title = '효과·이름 검토 대상'; name.append(dot); }
  b.append(name, el('span', kind(card), 'kind'), el('span', statText(card), 'stats'));
  b.addEventListener('click', () => openCard(card.slot));
  return b;
}
function render() {
  const results = sortCards(filteredCards());
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE)); page = Math.min(page, pages);
  $('cards').replaceChildren(...results.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map(renderCard));
  $('empty').hidden = results.length > 0;
  $('results').textContent = `${fmt(results.length)}장${view === 'reviews' ? '의 검토' : '의 카드'} · 전체 ${fmt(cards.length)}장`;
  $('active-summary').textContent = [rarity, $('type-filter').value, $('race-filter').value, $('mechanic-filter').selectedOptions[0]?.value ? $('mechanic-filter').selectedOptions[0].textContent : '', $('group-filter').selectedOptions[0]?.value ? $('group-filter').selectedOptions[0].textContent : ''].filter(Boolean).join(' · ');
  for(const id of ['catalog-pages-top','catalog-pages-bottom'])renderPagination($(id),page,pages,goPage);
  $('tab-all').classList.toggle('active', view === 'all'); $('tab-reviews').classList.toggle('active', view === 'reviews');
  $('tab-all').setAttribute('aria-pressed', String(view === 'all')); $('tab-reviews').setAttribute('aria-pressed', String(view === 'reviews'));
  updateCounts();
}
function goPage(next) {page=next;render();$('results').scrollIntoView({block:'start'});}
function selectControl(id, label, values, chosen, disabled = false) {
  const box = el('div'); const title = el('label', label); title.htmlFor = id;
  const control = el('select'); control.id = id; control.disabled = disabled;
  for (const [value,text] of values) { const option = el('option', text); option.value = value; control.append(option); }
  control.value = chosen == null ? '' : String(chosen);
  box.append(title, control); return box;
}
function relatedLink(card, label = card.name_ko) {
  const link = el('a', label, 'related-link'); link.href = cardLink(card.slot);
  link.addEventListener('click', event => {event.preventDefault(); openCard(card.slot);});
  return link;
}
function showGroup(id) {
  if (!meta.card_system?.groups.some(g => g.id === id)) return;
  if ($('card-dialog').open) closeCard();
  view = 'all'; resetFilters(); $('group-filter').value = id; page = 1; render();
  history.replaceState(null, '', groupHash(id));
  $('results').scrollIntoView({block:'start'});
}
function renderRelations(card, info) {
  if (card.mechanics?.length) {
    const box=el('section',null,'card-relations'); box.append(el('h3','기믹 분류'));
    const badges=el('div',null,'relation-links');
    for (const mechanic of card.mechanics) {
      const button=el('button',mechanic.name);button.type='button';button.title=mechanic.note;
      button.addEventListener('click',()=>{closeCard();view='all';resetFilters();$('mechanic-filter').value=mechanic.id;render();});badges.append(button);
    }
    box.append(badges,el('p','공식 카드의 분류야. 이 모드의 원본 효과 복원 여부는 아래 검토 메모를 확인해줘.','muted'));info.append(box);
  }
  for (const group of card.card_groups || []) {
    const box=el('section',null,'card-relations'),heading=el('h3',`${group.name} · ${group.role === 'support' ? '지원 카드' : '소속 카드'}`);
    const all=el('button','묶음 전체 보기','text-button');all.type='button';all.addEventListener('click',()=>showGroup(group.id));box.append(heading,all);
    for (const [role,label] of [['member','소속 카드'],['support','지원 카드']]) {
      const rows=groupCards(cards,group.id,role).filter(c=>c.slot!==card.slot);
      if (!rows.length) continue;
      const links=el('div',null,'relation-links');box.append(el('p',label,'description-title'));
      for (const related of rows) links.append(relatedLink(related));box.append(links);
    }
    box.append(el('p',group.note,'muted'));info.append(box);
  }
  if (card.related_cards?.length) {
    const box=el('section',null,'card-relations');box.append(el('h3','직접 연결된 카드'));
    for (const related of card.related_cards) {
      const target=cards.find(c=>c.slot===related.slot && c.identity_key===related.identity_key);
      if(target){const row=el('div',null,'relation-links');row.append(el('span',related.label,'muted'),relatedLink(target));box.append(row);}
    }
    info.append(box);
  }
}
function openCard(slot, updateHash = true) {
  const card = cards.find(c => c.slot === slot); if (!card) return;
  selected = card; if (updateHash) history.replaceState(null, '', `#card-${slot}`);
  const previous = reviews.get(card.identity_key);
  const change = previous?.changes || changesFor(card);
  const layout = el('div', null, 'detail-layout'); const art = el('div', null, 'detail-art');
  const image = document.createElement('img'); image.src = card.image; image.alt = `${card.name_ko} 카드 앞면`; image.width = 200; image.height = 290;
  art.append(image, el('div', `카드 #${String(card.slot).padStart(4,'0')} · ID ${card.internal_id}`, 'identity'));
  if (card.official_url) { const a = el('a', '공식 한국어 DB에서 보기 ↗'); a.href = card.official_url; a.target = '_blank'; a.rel = 'noopener'; art.append(a); }
  else art.append(el('p', '공식 카드 이름 매칭 미확인'));
  art.append(el('p', '그림에 인쇄된 내용보다 오른쪽의 현재 모드 설명을 기준으로 의견을 남겨줘.'));
  const info = el('div', null, 'detail-info'); const top = el('div'); top.append(labelTier(card.rarity), document.createTextNode(' '), regularLimit(card));
  const title = el('h2', card.name_ko); title.id = 'detail-title'; info.append(top, title, el('p', card.name_en, 'english-name'));
  const tags = el('div', null, 'detail-tags'); for (const t of [card.type, card.subtype, card.race, card.attribute, card.level == null ? '' : `LV ${card.level}`, card.atk == null ? '' : `ATK ${card.atk} / DEF ${card.def}`].filter(Boolean)) tags.append(el('span',t)); info.append(tags);
  info.append(el('p', '현재 모드 설명', 'description-title'), el('div', card.description_ko || '별도의 카드 설명이 없는 토큰·특수 카드야.', 'description'));
  renderRelations(card, info);
  if (card.fusion_materials?.length) {
    const materials=el('div',null,'fusion-materials');materials.append(el('p','이 모드에서 확인한 융합 소재','description-title'));
    const grouped=new Map();for(const material of card.fusion_materials){const item=grouped.get(material.slot);if(item)item.count++;else grouped.set(material.slot,{...material,count:1});}
    for(const material of grouped.values()){
      const item=el('div',null,'material-row'),button=el('button',`${material.name_ko}${material.count>1?' ×'+material.count:''}`,'material-link');button.type='button';button.addEventListener('click',()=>openCard(material.slot));
      item.append(button,el('span',material.shop_stock?'상점 판매 중':material.reward_eligible?'승리 보상으로 입수':'입수 경로 확인 필요','muted'));materials.append(item);
    }
    info.append(materials);
  }
  if (card.review_note) info.append(el('p', card.review_note, 'review-note'));
  if (card.special) info.append(el('p', '일반 카드풀에서 얻거나 덱에 넣는 카드가 아닌, 듀얼 중 생성·참조되는 카드야.', 'review-note'));
  info.append(el('p', `등급 초안 근거: ${card.rarity_reason}`, 'grade-reason'));
  if (!card.special) {
    const context = [card.stock ? '상점 판매 중' : '현재 상점 상품 아님', card.reward_eligible ? '승리 보상 대상' : '승리 보상 제외', `등급 기준 가격 ${card.buy_price} / 판매 ${card.sell_price} 골드`, `금지·제한 해제 옵션에서 ${card.deck_limit_without_banlist}장`];
    info.append(el('p', context.join(' · '), 'muted'));
  }
  liveSettings(card,info);
  const editor = el('section', null, 'review-editor'); editor.append(el('h3', '이 카드에 대한 의견'));
  const fields = el('div', null, 'review-fields');
  fields.append(selectControl('proposed-rarity', '바꾸고 싶은 레어 등급', [['', `현재 ${card.rarity} 유지`], ...TIERS.map(t => [t, `${t} · ${meta.rarity_prices[t].buy_price} 골드`])], change.proposed_rarity));
  fields.append(selectControl('proposed-limit', '덱에 넣을 수 있는 매수', [['',card.special ? '특수 카드 · 대상 아님' : `현재 ${card.deck_limit}장 유지`], ['1','제한 · 1장'],['2','준제한 · 2장'],['3','무제한 · 3장'],['0','금지 · 0장']], change.proposed_limit, card.special));
  editor.append(fields);
  const checkRow = el('div', null, 'check-row'); const check = el('input'); check.id = 'replacement-candidate'; check.type = 'checkbox'; check.checked = change.replacement_candidate;
  const cl = el('label','다른 카드로 교체해도 될 것 같아'); cl.htmlFor = check.id; checkRow.append(check,cl); editor.append(checkRow);
  const replacementLabel = el('label','대신 넣고 싶은 카드 (선택)'); replacementLabel.htmlFor='replacement-name'; const replacement = el('input'); replacement.id='replacement-name'; replacement.type='text'; replacement.placeholder='예: 백룡·흑룡 지원 카드'; replacement.maxLength=240; replacement.value=change.replacement_name; editor.append(replacementLabel,replacement);
  const memoLabel = el('label','이유 · 효과 수정 의견 · 기타 메모'); memoLabel.htmlFor='review-note'; const memo = el('textarea'); memo.id='review-note'; memo.rows=3; memo.maxLength=8000; memo.placeholder='이 카드가 약한 이유, 실제 효과와 다른 부분 등을 적어줘.'; memo.value=change.note; editor.append(memoLabel,memo);
  const bottom=el('div',null,'editor-bottom'); const status=el('span',previous?'이 브라우저에 저장된 의견':'선택하거나 메모를 적으면 자동 저장'); status.id='save-status'; const remove=el('button','이 카드 의견 지우기','text-button'); remove.id='clear-review'; remove.type='button'; bottom.append(status,remove); editor.append(bottom); info.append(editor);
  layout.append(art,info); $('detail-body').replaceChildren(layout);
  function save() {
    try {
      const row=makeReview(card,{proposed_rarity:$('proposed-rarity').value,proposed_limit:$('proposed-limit').value,replacement_candidate:$('replacement-candidate').checked,replacement_name:$('replacement-name').value,note:$('review-note').value},reviews.get(card.identity_key));
      if (row) reviews.set(card.identity_key,row); else reviews.delete(card.identity_key);
      $('save-status').textContent = persist() ? (row ? '자동 저장됨 · 내보내기로 파일 보관' : '의견 없음 · 현재 설정 유지') : '저장 실패 · JSON을 내려받아줘'; render();
    } catch(e) { toast(e.message); }
  }
  for (const id of ['proposed-rarity','proposed-limit','replacement-candidate']) $(id).addEventListener('change',save);
  for (const id of ['replacement-name','review-note']) $(id).addEventListener('input',save);
  remove.addEventListener('click',()=>{reviews.delete(card.identity_key);persist();render();openCard(card.slot);toast('이 카드의 검토 의견을 지웠어.');});
  if (!$('card-dialog').open) $('card-dialog').showModal();
  $('card-dialog').scrollTop = 0;
}
function closeCard() { $('card-dialog').close(); selected=null; history.replaceState(null,'',location.pathname+location.search); }
function download(name, body, type) {
  const url=URL.createObjectURL(new Blob([body],{type})); const a=el('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),20000);
}
function openExport() {
  const payload=currentPayload(), counts=reviewCounts(payload.reviews);
  $('export-summary').textContent=`${counts.total}장의 카드에 의견을 남겼어.${unmatched.length ? ` 현재 카드풀과 일치하지 않는 이전 의견 ${unmatched.length}건도 파일에 보관해.` : ''}`;
  $('export-stats').replaceChildren(...[[counts.rarity,'등급 조정'],[counts.replace,'교체 후보'],[counts.limit,'제한 조정']].map(([n,t])=>el('span',`${t} ${n}건`)));
  $('review-preview').value=reviewMarkdown(payload); $('import-status').textContent=''; $('download-backup').hidden=!backup;
  $('reset-reviews').disabled = !reviews.size && !unmatched.length;
  $('undo-reset').hidden = !resetBackup;
  $('download-reset-backup').hidden = !resetBackup;
  if (!$('export-dialog').open) $('export-dialog').showModal();
}
function resetFilters() {
  for(const id of ['search','type-filter','limit-filter','race-filter','attribute-filter','level-min','level-max','status-filter','mechanic-filter','group-filter']) $(id).value='';
  rarity='';page=1;rarityButtons();render();
}
async function init() {
  try {
    const response=await fetch('./data/cards.json?v=20261006-7',{cache:'no-cache'});if(!response.ok)throw new Error('카드 자료를 가져오지 못했어.');
    const data=await response.json();meta=data.meta;cards=data.cards;
    if(cards.length!==meta.total||new Set(cards.map(c=>c.identity_key)).size!==cards.length)throw new Error('카드 자료를 확인할 수 없어.');
    for(const c of cards)c.searchText=[c.name_ko,c.name_en,c.description_ko,c.race,c.attribute,...(c.mechanics||[]).map(m=>m.name),...(c.card_groups||[]).map(g=>g.name),String(c.slot),String(c.internal_id)].join(' ').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
    for(const [id,rows] of [['mechanic-filter',meta.card_system?.mechanics||[]],['group-filter',meta.card_system?.groups||[]]])
      for(const row of rows){const option=el('option',row.name);option.value=row.id;$(id).append(option);}
    $('total-count').textContent=fmt(cards.length);$('scope-count').textContent=`일반 카드 ${fmt(meta.regular_count)}장 · 토큰·특수 ${meta.special_count}종`;$('snapshot-date').textContent=meta.snapshot_date+' 기준';
    fillFilter('type-filter',[...new Set(cards.map(c=>c.type))]);fillFilter('race-filter',[...new Set(cards.map(c=>c.race).filter(Boolean))].sort(collator.compare));fillFilter('attribute-filter',[...new Set(cards.map(c=>c.attribute).filter(Boolean))]);
    const levels=[...new Set(cards.map(c=>c.level).filter(v=>v!=null))].sort((a,b)=>a-b);fillFilter('level-min',levels);fillFilter('level-max',levels);
    try {const stored=localStorage.getItem(STORAGE_KEY);if(stored){const parsed=parseImport(JSON.parse(stored),cards);reviews=new Map(parsed.valid.map(r=>[r.identity_key,r]));unmatched=parsed.unmatched;if(unmatched.length)toast(`카드가 바뀐 이전 의견 ${unmatched.length}건을 따로 보관했어.`);}backup=localStorage.getItem(STORAGE_KEY+'-before-import');}
    catch{toast('이전 의견을 읽지 못했어. 기존 저장 내용은 그대로 두었어.');}
    try { resetBackup = localStorage.getItem(RESET_BACKUP_KEY); } catch {}
    rarityButtons();render();await initCardSettings();
    const destination=parseCatalogHash(location.hash);if(destination?.card)openCard(destination.card,false);else if(destination?.group)showGroup(destination.group);
  }catch(error){$('results').textContent=error.message;$('cards').replaceChildren(el('p','새로고침해 보거나 GitHub 저장소의 data/cards.csv를 확인해줘.','muted'));}
}

$('search').addEventListener('input',()=>{page=1;render();});
$('refresh-card-settings').addEventListener('click',async()=>{try{await refreshCardSettings();toast('온라인 카드 설정을 다시 불러왔어.');}catch(error){toast(cloudError(error));}});
for(const id of ['type-filter','limit-filter','race-filter','attribute-filter','level-min','level-max','status-filter','mechanic-filter','group-filter','sort'])$(id).addEventListener('change',()=>{page=1;render();});
$('reset-filters').addEventListener('click',resetFilters);
$('tab-all').addEventListener('click',()=>{view='all';page=1;render();});$('tab-reviews').addEventListener('click',()=>{view='reviews';resetFilters();});
$('close-detail').addEventListener('click',closeCard);$('card-dialog').addEventListener('cancel',()=>{selected=null;history.replaceState(null,'',location.pathname+location.search);});
$('card-dialog').addEventListener('click',e=>{if(e.target===$('card-dialog')){const rect=$('card-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)closeCard();}});
$('export-open').addEventListener('click',()=>{if(meta)openExport();});$('close-export').addEventListener('click',()=>$('export-dialog').close());
$('download-json').addEventListener('click',()=>download(`카드검토_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(currentPayload(),null,2)+'\n','application/json;charset=utf-8'));
$('download-md').addEventListener('click',()=>download(`카드검토_${new Date().toISOString().slice(0,10)}.md`,reviewMarkdown(currentPayload()),'text/markdown;charset=utf-8'));
$('copy-review').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(reviewMarkdown(currentPayload()));toast('복사했어. 이 채팅에 붙여넣으면 돼.');}catch{$('review-preview').focus();$('review-preview').select();toast('미리보기 내용이 선택됐어. 복사해서 보내줘.');}});
$('import-json').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async()=>{
  const file=$('import-file').files?.[0];if(!file)return;
  try{
    if(file.size>12*1024*1024)throw new Error('파일이 너무 커. 이 도감의 검토 JSON을 골라줘.');
    const incoming=parseImport(JSON.parse(await file.text()),cards);
    backup=JSON.stringify(currentPayload(),null,2)+'\n';
    // Back up before any merge. If storage is unavailable, keep a downloadable
    // in-memory backup and announce the limitation instead of hiding it.
    try{localStorage.setItem(STORAGE_KEY+'-before-import',backup);}catch{toast('백업을 브라우저에 저장하지 못했어. 백업 파일을 내려받아줘.');}
    for(const row of incoming.valid)reviews.set(row.identity_key,row);
    const combined=new Map(unmatched.map(r=>[r.identity_key,r]));for(const row of incoming.unmatched)combined.set(row.identity_key,row);unmatched=[...combined.values()];
    persist();render();openExport();$('import-status').textContent=`${incoming.valid.length}건을 합쳤어.${incoming.unmatched.length ? ` 카드가 일치하지 않는 ${incoming.unmatched.length}건은 따로 보관했어.` : ''}`;$('download-backup').hidden=false;
  }catch(error){$('import-status').textContent=error.message;}
  finally{$('import-file').value='';}
});
$('download-backup').addEventListener('click',()=>{if(backup)download('카드검토_불러오기전_백업.json',backup,'application/json;charset=utf-8');});
$('reset-reviews').addEventListener('click',()=>{
  $('reset-summary').textContent=`작성한 의견 ${reviews.size}건${unmatched.length ? `과 이전 카드 의견 ${unmatched.length}건` : ''}을 비울 거야. 초기화 전 내용을 백업하고, 새 의견을 작성할 수 있어.`;
  $('reset-dialog').showModal();
});
$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
$('confirm-reset').addEventListener('click',()=>{
  try {
    resetBackup=resetStoredReviews(localStorage,currentPayload());
    reviews=new Map();unmatched=[];page=1;
    $('reset-dialog').close();render();if(selected)openCard(selected.slot);openExport();
    toast('의견을 초기화했어. 아래 버튼으로 초기화 전 의견을 복원할 수 있어.');
  } catch {
    $('reset-dialog').close();toast('백업 또는 저장에 실패해서 초기화를 취소했어. JSON을 내려받아 보관해줘.');
  }
});
$('download-reset-backup').addEventListener('click',()=>{if(resetBackup)download('카드검토_초기화전_백업.json',resetBackup,'application/json;charset=utf-8');});
$('undo-reset').addEventListener('click',()=>{
  if(!resetBackup)return;
  try {
    const parsed=parseImport(JSON.parse(resetBackup),cards);
    const merged=new Map(reviews);for(const row of parsed.valid)if(!merged.has(row.identity_key))merged.set(row.identity_key,row);
    const old=new Map(unmatched.map(r=>[r.identity_key,r]));for(const row of parsed.unmatched)if(!old.has(row.identity_key))old.set(row.identity_key,row);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(exportPayload(meta,[...merged.values()],[...old.values()])));
    reviews=merged;unmatched=[...old.values()];render();if(selected)openCard(selected.slot);openExport();toast('초기화 전 의견을 복원했어. 새로 작성한 의견도 유지했어.');
  } catch {toast('복원에 실패했어. 초기화 전 백업 JSON을 내려받아 보관해줘.');}
});
window.addEventListener('hashchange',()=>{const destination=parseCatalogHash(location.hash);if(destination?.card)openCard(destination.card,false);else if(destination?.group)showGroup(destination.group);});
init();
