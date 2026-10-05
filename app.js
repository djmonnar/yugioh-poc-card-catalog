import {TIERS, STORAGE_KEY, changesFor, makeReview, exportPayload, parseImport, reviewCounts, reviewMarkdown} from './review-core.js';

const $ = id => document.getElementById(id);
const PAGE_SIZE = 36;
const fmt = n => n.toLocaleString('ko-KR');
const collator = new Intl.Collator('ko');
const narrowLayout = matchMedia('(max-width: 800px)');
$('advanced-filters').open = !narrowLayout.matches;
narrowLayout.addEventListener('change', event => { $('advanced-filters').open = !event.matches; });
let cards = [], meta = null, reviews = new Map(), unmatched = [], page = 1, rarity = '', view = 'all', selected = null, backup = null;
let timer;
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
  $('active-summary').textContent = [rarity, $('type-filter').value, $('race-filter').value].filter(Boolean).join(' · ');
  $('page-info').textContent = `${page} / ${pages}`; $('prev').disabled = page <= 1; $('next').disabled = page >= pages;
  $('tab-all').classList.toggle('active', view === 'all'); $('tab-reviews').classList.toggle('active', view === 'reviews');
  $('tab-all').setAttribute('aria-pressed', String(view === 'all')); $('tab-reviews').setAttribute('aria-pressed', String(view === 'reviews'));
  updateCounts();
}
function selectControl(id, label, values, chosen, disabled = false) {
  const box = el('div'); const title = el('label', label); title.htmlFor = id;
  const control = el('select'); control.id = id; control.disabled = disabled;
  for (const [value,text] of values) { const option = el('option', text); option.value = value; control.append(option); }
  control.value = chosen == null ? '' : String(chosen);
  box.append(title, control); return box;
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
  if (!$('export-dialog').open) $('export-dialog').showModal();
}
function resetFilters() {
  for(const id of ['search','type-filter','limit-filter','race-filter','attribute-filter','level-min','level-max','status-filter']) $(id).value='';
  rarity='';page=1;rarityButtons();render();
}
async function init() {
  try {
    const response=await fetch('./data/cards.json?v=20261005-2',{cache:'no-cache'});if(!response.ok)throw new Error('카드 자료를 가져오지 못했어.');
    const data=await response.json();meta=data.meta;cards=data.cards;
    if(cards.length!==meta.total||new Set(cards.map(c=>c.identity_key)).size!==cards.length)throw new Error('카드 자료를 확인할 수 없어.');
    for(const c of cards)c.searchText=[c.name_ko,c.name_en,c.description_ko,c.race,c.attribute,String(c.slot),String(c.internal_id)].join(' ').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
    $('total-count').textContent=fmt(cards.length);$('scope-count').textContent=`일반 카드 ${fmt(meta.regular_count)}장 · 토큰·특수 ${meta.special_count}종`;$('snapshot-date').textContent=meta.snapshot_date+' 기준';
    fillFilter('type-filter',[...new Set(cards.map(c=>c.type))]);fillFilter('race-filter',[...new Set(cards.map(c=>c.race).filter(Boolean))].sort(collator.compare));fillFilter('attribute-filter',[...new Set(cards.map(c=>c.attribute).filter(Boolean))]);
    const levels=[...new Set(cards.map(c=>c.level).filter(v=>v!=null))].sort((a,b)=>a-b);fillFilter('level-min',levels);fillFilter('level-max',levels);
    try {const stored=localStorage.getItem(STORAGE_KEY);if(stored){const parsed=parseImport(JSON.parse(stored),cards);reviews=new Map(parsed.valid.map(r=>[r.identity_key,r]));unmatched=parsed.unmatched;if(unmatched.length)toast(`카드가 바뀐 이전 의견 ${unmatched.length}건을 따로 보관했어.`);}backup=localStorage.getItem(STORAGE_KEY+'-before-import');}
    catch{toast('이전 의견을 읽지 못했어. 기존 저장 내용은 그대로 두었어.');}
    rarityButtons();render();
    const match=/^#card-(\d+)$/.exec(location.hash);if(match)openCard(Number(match[1]),false);
  }catch(error){$('results').textContent=error.message;$('cards').replaceChildren(el('p','새로고침해 보거나 GitHub 저장소의 data/cards.csv를 확인해줘.','muted'));}
}

$('search').addEventListener('input',()=>{page=1;render();});
for(const id of ['type-filter','limit-filter','race-filter','attribute-filter','level-min','level-max','status-filter','sort'])$(id).addEventListener('change',()=>{page=1;render();});
$('reset-filters').addEventListener('click',resetFilters);
$('tab-all').addEventListener('click',()=>{view='all';page=1;render();});$('tab-reviews').addEventListener('click',()=>{view='reviews';resetFilters();});
$('prev').addEventListener('click',()=>{page--;render();$('results').scrollIntoView({block:'start'});});$('next').addEventListener('click',()=>{page++;render();$('results').scrollIntoView({block:'start'});});
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
window.addEventListener('hashchange',()=>{const match=/^#card-(\d+)$/.exec(location.hash);if(match)openCard(Number(match[1]),false);});
init();
