import {PACK_DRAFT_KEY,PACK_RULES,newCardPack,parseCardPack,canonicalCardPack,parsePackDrafts,packCardEligible,resolvePackCard,cardPackPool,togglePackCard,sameCardPack,acceptPackSave,CardPacksCloud,packCloudError} from './card-packs-core.js?v=20261013-packs131';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig,DeckCloud} from './supabase-cloud.js?v=20261008-70';
import {CardSettingsCloud,applySettings} from './card-settings.js?v=20261007-49';
import {CardLimitsCloud,applyLimits} from './card-limits.js?v=20261008-limits-labels';
import {CardTagsCloud} from './card-tags.js?v=20261011-tags';
import {createStatFilters} from './card-filters.js?v=20261007-44';
import {fillSubtypeFilter} from './card-subtypes.js?v=20261011-tags';
import {additionIndex} from './card-additions.js?v=20261008-additions';
import {builderCardMatches,builderSearchText,sortBuilderCards} from './ai-deck-filters.js?v=20261012-filters122';

const $=id=>document.getElementById(id),clone=structuredClone,PER_PAGE=24;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const filters={query:'pack-search',tier:'pack-tier',type:'pack-type',race:'pack-race',attribute:'pack-attribute',subtype:'pack-subtype',mechanic:'pack-mechanic',group:'pack-group',release:'pack-release'};
let cards=[],meta,client,cloud,tags,rows=[],drafts=new Map(),active='',page=1,saving=false,storageBlocked=false,canEdit=false,authGeneration=0,conflict=null,detailCard=null,toastTimer;
let additions={byIdentity:new Map(),releases:[],latest:null};const selectedTags=new Set();
const entry=()=>drafts.get(active),pack=()=>entry()?.document;
const stats=createStatFilters($('pack-stat-filters'),()=>{page=1;renderCards();});
function status(value){$('pack-status').textContent=value;renderSync();}
function toast(value){$('pack-toast').textContent=value;$('pack-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('pack-toast').hidden=true,3500);}
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function persist(){
  if(storageBlocked){renderSync();return false;}
  try{localStorage.setItem(PACK_DRAFT_KEY,JSON.stringify({schema_version:1,active,entries:[...drafts.values()]}));renderSync();return true;}
  catch{storageBlocked=true;status('브라우저 저장에 실패했어. JSON 내보내기로 편집본을 보관해줘.');return false;}
}
function readDrafts(){const raw=localStorage.getItem(PACK_DRAFT_KEY);if(!raw)return;try{const parsed=parsePackDrafts(JSON.parse(raw));drafts=new Map(parsed.entries.map(d=>[d.id,d]));active=parsed.active;}catch{storageBlocked=true;}}
function listPacks(){const merged=new Map(rows.filter(r=>!r.archived).map(r=>[r.id,r.document.name]));for(const d of drafts.values())if(!rows.find(r=>r.id===d.id)?.archived)merged.set(d.id,d.document.name);return [...merged];}
function renderList(){const options=listPacks().map(([id,name])=>{const o=el('option',name||'이름 없는 카드팩');o.value=id;return o;});$('pack-select').replaceChildren(...options);$('pack-select').value=active;$('new-pack').disabled=saving||drafts.size>=100;}
function use(id){
  let d=drafts.get(id);const row=rows.find(r=>r.id===id&&!r.archived);if(!d&&row){d={id,expectedVersion:row.version,document:clone(row.document),baseline:clone(row)};drafts.set(id,d);}if(!d)return;
  active=id;const url=new URL(location.href);url.searchParams.delete('new');url.searchParams.delete('card');url.searchParams.set('pack',id);history.replaceState(null,'',url);conflict=null;renderConflict();page=1;renderList();$('pack-name').value=d.document.name;$('pack-description').value=d.document.description;$('pack-enabled').checked=d.document.enabled;render();persist();
}
function create(){if(drafts.size>=100)return status('카드팩 편집본은 100개까지 보관할 수 있어.');const id='pack-'+crypto.randomUUID();drafts.set(id,{id,expectedVersion:0,document:newCardPack(meta.dataset_id),baseline:null});use(id);status('새 카드팩 편집본을 만들었어. 카드를 고르고 온라인 저장해줘.');}
function renderSync(){
  if(!entry())return;const row=rows.find(r=>r.id===active),same=row&&!row.archived&&sameCardPack(pack(),row.document);
  $('pack-sync').textContent=storageBlocked?'기존 브라우저 자료 보존 중 · JSON 내보내기로 보관해줘.':`브라우저 편집본 ${pack().cards.length}종 · ${row?.archived?'온라인에서 삭제됨':same?'온라인 반영됨':row?'온라인 미반영 변경 있음':'새 카드팩 · 온라인 저장 전'}`;
  $('save-pack').disabled=saving||storageBlocked||!canEdit||Boolean(row?.archived);$('archive-pack').disabled=saving||!canEdit||!row||row.archived;
  $('load-pack').disabled=saving||!row||row.archived;$('save-compared-pack').disabled=saving||!canEdit||!conflict;
}
function renderReadiness(){
  if(!pack())return;const pool=cardPackPool(pack(),cards);$('pack-pool-counts').replaceChildren(...Object.entries(pool.pool_counts).map(([tier,count])=>el('span',`${tier} ${count}종`,count?'':'missing')));
  $('pack-readiness').textContent=pool.available?'판매 준비 완료 · 온라인 저장하면 상점에 반영돼.':pool.reason;$('pack-readiness').dataset.ready=String(pool.available);
  $('pack-excluded').textContent=pool.excluded.length?`${pool.excluded.length}종은 등급·금제·뽑기 설정 때문에 뽑기에서 제외돼. 카드 선택은 보존돼.`:'가격·장수·등급 확률은 모든 카드팩에 동일하게 적용돼.';
  $('pack-missing-cards').hidden=!pool.unresolved.length;$('pack-unresolved').replaceChildren(...pool.unresolved.map(ref=>{const line=el('p',ref.name_ko+' '),b=el('button','목록에서 제거');b.type='button';b.onclick=()=>{pack().cards=pack().cards.filter(r=>r.identity_key!==ref.identity_key);render();persist();};line.append(b);return line;}));
  $('pack-selected-count').textContent=`선택 ${pack().cards.length}종`;
}
function selected(card){return Boolean(pack()?.cards.some(ref=>resolvePackCard(ref,cards)?.identity_key===card.identity_key||ref.identity_key===card.identity_key));}
function toggle(card){
  const root=$('pack-results'),tiles=[...root.children],anchor=tiles.find(n=>n.dataset.identity===card.identity_key);
  const position={x:window.scrollX,y:window.scrollY,top:anchor?.getBoundingClientRect().top},focused=root.contains(document.activeElement),index=tiles.indexOf(anchor);
  try{
    entry().document=togglePackCard(pack(),card,cards);renderReadiness();
    if($('pack-selected-only').checked||(!packCardEligible(card)&&!selected(card))){
      renderCards();if(focused){const next=root.children[Math.min(Math.max(index,0),root.children.length-1)];next?.querySelector('.pack-card-toggle')?.focus({preventScroll:true});}
    }else{
      const selection=new Set(pack().cards.map(ref=>resolvePackCard(ref,cards)?.identity_key||ref.identity_key));
      for(const tile of root.children){const chosen=selection.has(tile.dataset.identity),button=tile.querySelector('.pack-card-toggle');tile.classList.toggle('selected',chosen);button.textContent=chosen?'✓ 선택됨 · 빼기':'+ 카드 선택';button.setAttribute('aria-pressed',String(chosen));}
    }
    renderConflict();persist();
    if(detailCard===card&&$('pack-card-detail').open){const button=$('pack-card-detail').querySelector('.pack-detail-toggle');button.textContent=selected(card)?'이 팩에서 빼기':'이 팩에 추가';button.disabled=!selected(card)&&!packCardEligible(card);}
    const offset=anchor?.isConnected?anchor.getBoundingClientRect().top-position.top:0;
    window.scrollTo({left:position.x,top:position.y+offset,behavior:'instant'});
  }catch(e){toast(e.message);}
}
function renderCards(){
  if(!pack())return;const criteria=Object.fromEntries(Object.entries(filters).map(([key,id])=>[key,$(id).value]));criteria.statConditions=stats.values();criteria.tags=[...selectedTags];
  const selection=new Set(pack().cards.map(ref=>resolvePackCard(ref,cards)?.identity_key||ref.identity_key));
  const found=sortBuilderCards(cards.filter(c=>!c.special&&(packCardEligible(c)||selection.has(c.identity_key))&&(!$('pack-selected-only').checked||selection.has(c.identity_key))&&builderCardMatches(c,criteria,{tagsState:tags?.state,additions})),$('pack-sort').value,additions);
  const pages=Math.max(1,Math.ceil(found.length/PER_PAGE));page=Math.max(1,Math.min(page,pages));$('pack-found').textContent=found.length?`검색 결과 ${found.length}종 · 카드를 다시 누르면 선택 취소`:'조건에 맞는 카드가 없어. 검색어나 필터를 줄여줘.';
  $('pack-results').replaceChildren(...found.slice((page-1)*PER_PAGE,page*PER_PAGE).map(card=>{
    const chosen=selection.has(card.identity_key),tile=el('article',null,'pack-card'+(chosen?' selected':''));tile.dataset.identity=card.identity_key;
    const detail=el('button'),img=el('img');detail.type='button';detail.setAttribute('aria-label',`${card.name_ko} 카드 능력 보기`);img.src=card.image;img.alt='';img.loading='lazy';detail.append(img,el('h3',card.name_ko),el('small',[card.type,card.race,card.attribute].filter(Boolean).join(' · ')),el('small',card.level==null?card.subtype||'':`★${card.level} · ${card.atk} / ${card.def}`));detail.onclick=()=>showDetail(card);tile.append(detail,el('span',card.rarity,'rarity '+card.rarity));
    const button=el('button',chosen?'✓ 선택됨 · 빼기':'+ 카드 선택','pack-card-toggle');button.type='button';button.setAttribute('aria-pressed',String(chosen));button.onclick=()=>toggle(card);tile.append(button);if(!packCardEligible(card))tile.append(el('span','현재 뽑기 제외 카드','pack-card-excluded'));return tile;
  }));$('pack-page').textContent=`${page} / ${pages}`;$('pack-prev').disabled=page<=1;$('pack-next').disabled=page>=pages;
}
function render(){renderList();renderReadiness();renderCards();renderSync();renderConflict();}
function showDetail(card){
  const alreadyOpen=$('pack-card-detail').open;detailCard=card;const layout=el('div',null,'pack-detail-layout'),img=el('img');img.src=card.image;img.alt=card.name_ko;const info=el('div');info.append(el('span',card.rarity,'rarity '+card.rarity));const title=el('h2',card.name_ko);title.id='pack-detail-title';info.append(title,el('p',card.name_en,'muted'),el('p',[card.type,card.subtype,card.race,card.attribute,card.level==null?'':`★ ${card.level}`,card.atk==null?'':`ATK ${card.atk} / DEF ${card.def}`].filter(Boolean).join(' · '),'muted'),el('div',card.description_ko,'description'));
  const actions=el('div',null,'pack-actions'),button=el('button',selected(card)?'이 팩에서 빼기':'이 팩에 추가','primary pack-detail-toggle');button.type='button';button.disabled=!selected(card)&&!packCardEligible(card);button.onclick=()=>toggle(card);const link=el('a','도감에서 등급·뽑기 설정 보기');link.href=`./#card-${card.slot}`;link.target='_blank';link.rel='noopener';actions.append(button,link);info.append(actions);if(!packCardEligible(card))info.append(el('p','이 카드는 현재 랜덤 뽑기에서 제외돼. 선택은 유지되며, 도감에서 뽑기 설정을 바꾸면 다시 후보가 돼.','muted'));layout.append(img,info);$('pack-detail-body').replaceChildren(layout);if(!alreadyOpen)$('pack-card-detail').showModal();else button.focus({preventScroll:true});
}
function renderTags(){const root=$('pack-tag-filters');root.replaceChildren();for(const {name} of tags?.state?.categories||[]){const label=el('label'),input=el('input');input.type='checkbox';input.checked=selectedTags.has(name);input.onchange=()=>{input.checked?selectedTags.add(name):selectedTags.delete(name);page=1;renderCards();};label.append(input,el('span',name));root.append(label);}}
async function refreshTags(){if(!tags)return;try{await tags.load();renderTags();renderCards();$('pack-tag-status').textContent='태그 이름은 검색창으로도 찾을 수 있어. 여러 태그는 모두 포함한 카드를 찾아.';}catch(e){$('pack-tag-status').textContent='태그를 불러오지 못했어. 현재 카드 선택은 유지돼.';}}
function fill(id,values){for(const value of values){const option=el('option',typeof value==='string'?value:value.name);option.value=typeof value==='string'?value:value.id;$(id).append(option);}}
function initializeFilters(){const regular=cards.filter(c=>!c.special),collator=new Intl.Collator('ko');for(const [id,field] of [['pack-type','type'],['pack-race','race'],['pack-attribute','attribute']])fill(id,[...new Set(regular.map(c=>c[field]).filter(Boolean))].sort(collator.compare));fillSubtypeFilter($('pack-subtype'),'');fill('pack-mechanic',meta.card_system.mechanics);fill('pack-group',meta.card_system.groups);fill('pack-release',additions.releases.filter(r=>r.count).map(r=>({id:r.id,name:`${r.date} · ${r.name}`})));}
function resetFilters(){for(const id of Object.values(filters))$(id).value='';fillSubtypeFilter($('pack-subtype'),'');selectedTags.clear();renderTags();stats.reset();$('pack-selected-only').checked=false;$('pack-sort').value='name';page=1;renderCards();}
async function refreshOnline(){rows=await cloud.load();renderList();renderSync();return rows;}
async function auth(session){const generation=++authGeneration;let allowed=false;try{allowed=session?await new DeckCloud(client).editor():false;}catch{}if(generation!==authGeneration)return;canEdit=allowed;$('pack-auth-status').textContent=allowed?`${session.user.email} · 카드팩 편집 가능`:session?'로그인됨 · 이 계정에는 편집 권한이 없어.':'브라우저 편집 가능 · 온라인 저장은 편집자 이메일로 로그인해줘.';renderSync();}
async function connect(){const config=validateCloudConfig(await fetch('data/cloud-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('온라인 연결 설정을 불러올 수 없어.');return r.json();}));client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(10000)})}});cloud=new CardPacksCloud(client);tags=new CardTagsCloud(client);client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>auth(session),0));const session=await client.auth.getSession();if(session.error)throw session.error;await auth(session.data.session);
  const loaded=await Promise.allSettled([refreshOnline(),new CardSettingsCloud(client).load().then(r=>applySettings(cards,r)),new CardLimitsCloud(client).load().then(r=>applyLimits(cards,r)),refreshTags()]);render();
  // Wait for every independent setting read before using the effective pools.
  // A missing pack endpoint must not leave late grade updates behind stale counts.
  const failed=loaded.find(result=>result.status==='rejected');if(failed)throw failed.reason;
}
function summary(document){const pool=cardPackPool(document,cards);return `${document.name} · ${document.cards.length}종 · ${document.enabled?'판매 켜짐':'판매 꺼짐'} · ${Object.entries(pool.pool_counts).map(([t,n])=>`${t} ${n}`).join(' / ')}`;}
function renderConflict(){const show=conflict?.id===active;$('pack-conflict').hidden=!show;if(!show)return;$('pack-local-summary').textContent=summary(pack());$('pack-remote-summary').textContent=summary(conflict.row.document);$('pack-local-list').replaceChildren(...pack().cards.map(c=>el('li',c.name_ko)));$('pack-remote-list').replaceChildren(...conflict.row.document.cards.map(c=>el('li',c.name_ko)));renderSync();}
async function save(compared=false){
  if(saving||storageBlocked||!entry())return;const id=active,d=entry(),captured=clone(d.document),version=compared&&conflict?.id===id?conflict.row.version:d.expectedVersion;saving=true;renderSync();
  try{if(!cloud)await connect();if(!canEdit)throw new Error('poc_editor_required');const document=canonicalCardPack(captured,meta,cards);status(`「${document.name}」 온라인 저장 중…`);const row=await cloud.save(id,document,version);rows=cloud.rows;const target=drafts.get(id);if(target)drafts.set(id,acceptPackSave(target,captured,row));conflict=null;renderConflict();persist();if(active===id){$('pack-name').value=pack().name;$('pack-description').value=pack().description;$('pack-enabled').checked=pack().enabled;render();}status(`「${row.document.name}」 온라인 저장 완료 · 게임 상점에서 팩 목록을 갱신하면 반영돼.`);
  }catch(e){if(e?.message?.includes('poc_pack_conflict')){try{await refreshOnline();const row=rows.find(r=>r.id===id);if(row&&!row.archived&&active===id){conflict={id,row:clone(row)};renderConflict();}}catch{}}status(packCloudError(e)+' 현재 편집본은 유지돼.');}
  finally{saving=false;renderSync();}
}
async function archive(restore=false){const id=restore?$('pack-trash-select').value:active,row=rows.find(r=>r.id===id);if(!row||saving)return;saving=true;renderSync();try{if(!canEdit)throw new Error('poc_editor_required');const saved=await cloud.archive(id,row.version,restore);rows=cloud.rows;if(restore){const previous=drafts.get(id);drafts.set(id,previous?acceptPackSave(previous,saved.document,saved):{id,expectedVersion:saved.version,document:clone(saved.document),baseline:clone(saved)});$('pack-trash').close();use(id);status('카드팩을 복원했어. 기존 브라우저 편집본은 유지돼. 판매 설정과 카드 목록을 확인해줘.');}else{download('card-pack-before-archive.json',{id,document:clone(pack())});renderList();const next=listPacks()[0]?.[0];if(next)use(next);else create();status('카드팩을 삭제 보관했어. 삭제한 팩 복원에서 되돌릴 수 있어.');}persist();}catch(e){status(packCloudError(e));}finally{saving=false;renderSync();}}
for(const [key,id] of Object.entries(filters))$(id).addEventListener(key==='query'?'input':'change',()=>{if(key==='type')fillSubtypeFilter($('pack-subtype'),$(id).value);page=1;renderCards();});
$('pack-name').oninput=()=>{pack().name=$('pack-name').value;renderList();persist();renderConflict();};$('pack-description').oninput=()=>{pack().description=$('pack-description').value;persist();renderConflict();};$('pack-enabled').onchange=()=>{pack().enabled=$('pack-enabled').checked;renderReadiness();persist();renderConflict();};
$('pack-sort').onchange=$('pack-selected-only').onchange=()=>{page=1;renderCards();};$('reset-pack-filters').onclick=resetFilters;$('refresh-pack-tags').onclick=refreshTags;
$('pack-select').onchange=()=>use($('pack-select').value);$('new-pack').onclick=create;$('save-pack').onclick=()=>save();$('save-compared-pack').onclick=()=>save(true);$('dismiss-pack-conflict').onclick=()=>{conflict=null;renderConflict();renderSync();};
$('pack-prev').onclick=()=>{page--;renderCards();$('pack-results').scrollIntoView({block:'start'});};$('pack-next').onclick=()=>{page++;renderCards();$('pack-results').scrollIntoView({block:'start'});};
$('close-pack-detail').onclick=()=>$('pack-card-detail').close();$('pack-card-detail').addEventListener('close',()=>detailCard=null);
$('refresh-packs').onclick=async()=>{try{if(!cloud)await connect();else{const loaded=await Promise.allSettled([refreshOnline(),new CardSettingsCloud(client).load().then(r=>applySettings(cards,r)),new CardLimitsCloud(client).load().then(r=>applyLimits(cards,r))]);render();const failed=loaded.find(result=>result.status==='rejected');if(failed)throw failed.reason;}status('온라인 팩 목록·카드 설정을 갱신했어. 브라우저 편집본은 유지돼.');}catch(e){status(packCloudError(e));}};
$('load-pack').onclick=async()=>{const id=active;try{await refreshOnline();const row=rows.find(r=>r.id===id&&!r.archived);if(!row||active!==id)return;download('card-pack-before-online-load.json',{id,document:clone(pack())});drafts.set(id,{id,expectedVersion:row.version,document:clone(row.document),baseline:clone(row)});use(id);status('이 카드팩 온라인 저장본을 불러왔어. 이전 편집본은 JSON으로 백업했어.');}catch(e){status(packCloudError(e));}};
$('export-pack').onclick=()=>download('card-pack-source.json',{schema_version:1,kind:'poc-card-pack-source',id:active,document:pack()});$('import-pack').onclick=()=>$('pack-file').click();$('pack-file').onchange=async()=>{try{const file=$('pack-file').files[0];if(!file)return;if(file.size>512*1024)throw new Error('카드팩 JSON은 512KB 이하로 골라줘.');const value=JSON.parse(await file.text()),document=canonicalCardPack(value.document||value,meta,cards);download('card-pack-before-import.json',{id:active,document:clone(pack())});entry().document=document;use(active);status('카드팩 편집본을 불러왔어. 온라인 저장하면 현재 카드팩에 반영돼.');}catch(e){status(packCloudError(e));}finally{$('pack-file').value='';}};
$('archive-pack').onclick=()=>archive();$('restore-pack').onclick=()=>archive(true);$('close-pack-trash').onclick=()=>$('pack-trash').close();$('show-pack-trash').onclick=async()=>{try{if(!cloud)await connect();else await refreshOnline();const archived=rows.filter(r=>r.archived);$('pack-trash-select').replaceChildren(...archived.map(r=>{const o=el('option',r.document.name);o.value=r.id;return o;}));$('restore-pack').disabled=!canEdit||!archived.length;$('pack-trash').showModal();}catch(e){status(packCloudError(e));}};
$('send-pack-login').onclick=async()=>{const button=$('send-pack-login');button.disabled=true;try{if(!client)await connect();const redirect=new URL('card-packs.html',location.href);redirect.search=redirect.hash='';const reply=await client.auth.signInWithOtp({email:$('pack-email').value.trim(),options:{shouldCreateUser:false,emailRedirectTo:redirect.href}});if(reply.error)throw reply.error;$('pack-auth-status').textContent='로그인 메일을 보냈어. 메일의 링크로 돌아와줘.';}catch(e){$('pack-auth-status').textContent=packCloudError(e);}finally{button.disabled=false;}};
$('pack-signout').onclick=async()=>{if(client)await client.auth.signOut();};
async function start(){try{const catalog=await fetch('data/cards.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('카드 자료를 불러올 수 없어.');return r.json();});cards=catalog.cards;meta=catalog.meta;for(const c of cards)c.searchText=builderSearchText(c);readDrafts();try{additions=additionIndex(cards,await fetch('data/card-additions.json',{cache:'no-store'}).then(r=>r.json()));}catch{}initializeFilters();let connectionError=null;try{await connect();}catch(e){connectionError=e;}
  const query=new URLSearchParams(location.search),wanted=query.get('pack');if(query.has('new'))create();else if(wanted&&(drafts.has(wanted)||rows.some(r=>r.id===wanted&&!r.archived)))use(wanted);else if(active&&drafts.has(active)&&!rows.find(r=>r.id===active)?.archived)use(active);else if(listPacks().length)use(listPacks()[0][0]);else create();
  const card=cards.find(c=>c.slot===Number(query.get('card')));if(query.has('new')&&packCardEligible(card)){entry().document=togglePackCard(pack(),card,cards);render();persist();}if(connectionError)status(packCloudError(connectionError)+' 브라우저 편집은 계속할 수 있어.');else if(!query.has('new'))status('카드팩 편집 준비 완료 · 브라우저 편집본은 유지돼. 온라인 저장하면 상점에 반영돼.');if(storageBlocked)status('기존 브라우저 편집본을 읽을 수 없어 보존 중이야. JSON 내보내기로 현재 편집본을 보관해줘.');
}catch(e){status(packCloudError(e));}finally{if(pack()){$('pack-main').inert=false;$('pack-main').setAttribute('aria-busy','false');}}}
start();
