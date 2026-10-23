import {StarterEditor026,deckFromStarter026,replaceStarter026,DRAFT_KEY026} from './starters026-core.js?v=20261023-026';
import {StarterCloud153,starterCloudError153} from './roguelite153-starters.js';
import {loadCatalog,browserDecks,onlineDecks,importedDecks} from './roguelite-data.js';
import {validatePlayerDeck} from './roguelite-core.js?v=20261015-147';
import {adjustCard,resolveCard} from './ai-deck-core.js';
import {validateCloudConfig} from './supabase-cloud.js';
import {applyLimits,CardLimitsCloud} from './card-limits.js';
import {applySettings,CardSettingsCloud} from './card-settings.js';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';

const $=id=>document.getElementById(id),copy=structuredClone;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls)=>{const n=node('button',text,cls);n.type='button';n.onclick=()=>safe(fn);return n;};
let model=null,cards=[],meta={},selected='',sources=[],sourceCards=[],client=null,page=1,uiBusy=false,canEdit=false;
function message(value){$('status026').textContent=value;}
function download(value,name='roguelite-starters-draft.json'){const raw=typeof value==='string'?value:JSON.stringify(value,null,2),url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function safe(fn){if(uiBusy)return;uiBusy=true;renderState();try{await fn();}catch(error){message(starterCloudError153(error));}finally{uiBusy=false;renderState();}}
const chosen=()=>model?.document?.starters.find(s=>s.starter_id===selected);
const source=()=>sources[Number($('source026').value)]??null;
const counts=deck=>`메인 ${deck.groups.main.reduce((n,r)=>n+r.count,0)}장 · 엑스트라 ${deck.groups.extra.reduce((n,r)=>n+r.count,0)}장`;
function renderState(){
 const ready=!!model?.document,starter=chosen(),busy=uiBusy||model?.busy;
 for(const id of ['save026','refresh026','load026','export026','starter026','name026','rename026','up026','down026','edit026','delete026','online-source026','browser-source026','import-source026','source026','add026','replace026','apply026','cancel026','review026'])$(id).disabled=!!busy;
 $('refresh026').disabled=!!busy||!model;$('export026').disabled=!!busy||!ready;$('load026').disabled=!!busy||!model?.online;
 $('save026').disabled=!!busy||!ready||!model?.loaded||model?.base===null||!canEdit||!!model?.work;
 $('apply026').disabled=!!busy||!model?.work||!validatePlayerDeck(model.work.deck,cards,{allowSide:true}).valid;
 for(const id of ['starter026','name026','rename026','up026','down026','edit026','delete026'])$(id).disabled=!!busy||!starter||!!model?.work;
 $('source026').disabled=!!busy||!sources.length;$('add026').disabled=!!busy||!ready||!source()||!!model?.work;$('replace026').disabled=$('add026').disabled||!starter;
 $('review026').disabled=!!busy||!canEdit||!!model?.work;
 $('library026').setAttribute('aria-busy',String(!ready));
 if(!ready)return;
 const changed=JSON.stringify(model.document)!==JSON.stringify(model.baseline?.document);
 $('summary026').textContent=`브라우저 ${model.document.starters.length}개 · 온라인 ${model.online?.document.starters.length??'미확인'}개 · 편집 기준 버전 ${model.base??'미확인'}${model.work?' · 카드 수정 중':changed?' · 온라인 미반영 변경 있음':' · 저장본과 같음'}`;
 $('conflict026').hidden=!model.online||model.online.version===model.base;
 for(const [id,items] of [['local026',model.document.starters],['remote026',model.online?.document.starters??[]]])$(id).replaceChildren(...items.map(s=>node('li',`${s.name} · ${counts(s)}`)));
}
function detail(card){$('detail-title026').textContent=card.name_ko;const body=$('detail-body026');body.replaceChildren();if(card.image){const img=node('img');img.src=card.image;img.alt=card.name_ko;body.append(img);}body.append(node('p',`${card.type} · ${card.rarity}${card.race?' · '+card.race:''}${card.level?' · 레벨 '+card.level:''}`));if(card.atk!==null&&card.atk!==undefined)body.append(node('p',`공격력 ${card.atk} / 수비력 ${card.def}`));body.append(node('p',card.description_ko||'효과 설명 없음'));$('detail026').showModal();}
function deckView(deck,pool,{edit=false}={}){
 const box=node('div');for(const [group,label] of [['main','메인 덱'],['extra','엑스트라 덱'],['side','예비 카드']]){
  if(group==='side'&&!deck.groups.side.length)continue;const section=node('section',undefined,'deck-group');section.append(node('h3',`${label} · ${deck.groups[group].reduce((n,r)=>n+r.count,0)}장`));
  for(const row of deck.groups[group]){const card=resolveCard(row,pool),line=node('div',undefined,'deck-row');line.append(button(row.name_ko,()=>{if(card)detail(card);},'card-name'),node('span','×'+row.count,'count'));
   if(edit&&card)for(const [label,delta] of [['−',-1],['＋',1]])line.append(button(label,()=>editCard(card,group,delta),'adjust'));section.append(line);
  }box.append(section);
 }return box;
}
function renderLibrary(){
 const list=model.document.starters;if(!list.some(s=>s.starter_id===selected))selected=list[0]?.starter_id??'';
 $('starter026').replaceChildren(...list.map(s=>{const o=node('option',s.name);o.value=s.starter_id;return o;}));if(!list.length){const o=node('option','아직 등록한 시작 덱이 없어. 아래에서 준비한 덱을 가져와줘.');o.value='';$('starter026').append(o);}$('starter026').value=selected;
 const starter=chosen();$('name026').value=starter?.name??'';$('deck026').replaceChildren(...(starter?[deckView(starter,starter.collection.map(e=>e.card))]:[node('p','스피드 덱을 등록하면 게임에서 새 원정을 시작할 때 고를 수 있어.')]));
 renderEditor();renderState();
}
function renderEditor(){
 $('editor026').hidden=!model.work;if(!model.work)return;
 const check=validatePlayerDeck(model.work.deck,cards,{allowSide:true});$('validation026').textContent=counts(model.work.deck)+(check.valid?' · 등록 가능한 덱이야.':'\n'+check.issues.join('\n'));$('validation026').classList.toggle('invalid',!check.valid);$('apply026').disabled=!check.valid;
 $('working026').replaceChildren(deckView(model.work.deck,cards,{edit:true}));renderCards();
}
function renderCards(){
 if(!model?.work)return;const query=$('search026').value.trim().toLowerCase(),type=$('type026').value;
 const rows=cards.filter(c=>!c.special&&(!type||(type==='monster'?c.type.includes('몬스터'):c.type===type))&&(!query||[c.name_ko,c.name_en,c.description_ko,c.race,c.slot,c.internal_id].join(' ').toLowerCase().includes(query)));
 const pages=Math.max(1,Math.ceil(rows.length/16));page=Math.min(page,pages);$('found026').textContent=`검색 결과 ${rows.length}장 · 이름을 누르면 카드 능력과 효과를 볼 수 있어.`;
 $('cards026').replaceChildren(...rows.slice((page-1)*16,page*16).map(c=>{const tile=node('article',undefined,'card-tile'),info=button('',()=>detail(c)),img=node('img'),text=node('span',c.name_ko);img.src=c.image;img.alt='';img.loading='lazy';text.append(node('small',`${c.rarity} · ${c.type}`));info.append(img,text);tile.append(info,button('＋ 덱에 넣기',()=>editCard(c,c.type==='융합 몬스터'?'extra':'main',1),'add-card'));return tile;}));
 $('page026').textContent=`${page} / ${pages}`;$('prev026').disabled=page===1;$('next026').disabled=page===pages;
}
function editCard(card,group,delta){const deck=copy(model.work.deck);adjustCard(deck,card,group,delta,cards);model.updateWork(deck);renderEditor();renderState();}
function assertNoWork(){if(model.work)throw Error('카드 수정을 적용하거나 취소한 뒤 목록을 바꿔줘.');}
function setSources(decks,pool,label){sources=decks.filter(d=>d.ruleset==='duel_links_plan');sourceCards=pool;$('source026').replaceChildren(...sources.map((d,i)=>{const o=node('option',`${d.name} · ${counts(d)}`);o.value=i;return o;}));$('source-status026').textContent=`${label} · 스피드 덱 ${sources.length}개`;renderSource();renderState();}
function renderSource(){const deck=source();$('source-deck026').replaceChildren(...(deck?[node('p',validatePlayerDeck(deck,sourceCards,{allowSide:true}).issues.join(' ')||'시작 덱으로 등록할 수 있어.'),deckView(deck,sourceCards)]:[]));}
async function refresh(){await model.refresh();canEdit=await model.cloud.editor().catch(()=>false);$('auth026').textContent=canEdit?'편집자 로그인됨 · 온라인 저장 가능':'목록 조회 가능 · 저장하려면 기존 편집자 계정으로 로그인한 뒤 온라인 버전을 다시 확인해줘.';renderLibrary();message(`온라인 버전 ${model.online.version} · 시작 덱 ${model.online.document.starters.length}개를 확인했어. 새로고침은 현재 편집본을 덮어쓰지 않아.`);}
async function save(reviewedVersion=null){const row=await model.save({reviewedVersion});message(`온라인 버전 ${row.version} · 시작 덱 ${row.document.starters.length}개 저장 완료. 게임에서 온라인 목록을 다시 읽고 새 원정을 시작해줘.`);renderLibrary();}
$('refresh026').onclick=()=>safe(refresh);
$('load026').onclick=()=>safe(()=>{if(!confirm('현재 편집본을 백업하고 온라인 목록으로 바꿀까?'))return;download(model.backup(),'roguelite-starters-before-load.json');model.useOnline();renderLibrary();message('온라인 목록을 불러왔어. 기존 원정 슬롯은 그대로야.');});
$('save026').onclick=()=>safe(()=>save());
$('review026').onclick=()=>safe(()=>{if(confirm('두 목록을 비교했어? 온라인 저장본을 현재 편집본으로 바꿀게. 변경 전 자료는 브라우저 백업에 보관돼.'))return save(model.online.version);});
$('export026').onclick=()=>safe(()=>download(model.backup()));
$('starter026').onchange=()=>{selected=$('starter026').value;renderLibrary();};
$('rename026').onclick=()=>safe(()=>{model.rename(selected,$('name026').value);renderLibrary();});
for(const [id,step] of [['up026',-1],['down026',1]])$(id).onclick=()=>safe(()=>{assertNoWork();model.move(selected,step);renderLibrary();});
$('delete026').onclick=()=>safe(()=>{assertNoWork();if(confirm(`‘${chosen().name}’을 시작 덱 목록에서 뺄까? AI 덱과 기존 원정 슬롯은 유지돼.`)){model.backup();model.remove(selected);renderLibrary();}});
$('edit026').onclick=()=>safe(()=>{model.begin(selected);renderLibrary();$('editor026').scrollIntoView({behavior:'smooth',block:'start'});});
$('apply026').onclick=()=>safe(()=>{model.applyWork();renderLibrary();message('카드 수정을 브라우저 편집본에 적용했어. 마지막으로 ‘이 목록 온라인 저장’을 눌러줘.');});
$('cancel026').onclick=()=>safe(()=>{if(confirm('진행 중인 카드 수정을 취소할까?')){model.cancelWork();renderLibrary();}});
$('search026').oninput=()=>{page=1;renderCards();};$('type026').onchange=()=>{page=1;renderCards();};$('prev026').onclick=()=>{page--;renderCards();};$('next026').onclick=()=>{page++;renderCards();};
$('online-source026').onclick=()=>safe(async()=>{const result=await onlineDecks(cards,meta,{createClient});setSources(result.decks,result.cards,'온라인 저장 AI 덱');});
$('browser-source026').onclick=()=>safe(()=>setSources(browserDecks(localStorage,cards),cards,'이 브라우저 AI 덱'));
$('import-source026').onclick=()=>$('file026').click();$('file026').onchange=()=>safe(async()=>{const file=$('file026').files[0];if(!file)return;if(file.size>4000000)throw Error('AI 덱 JSON은 4MB 이하로 가져와줘.');setSources(importedDecks(JSON.parse(await file.text()),cards),cards,'가져온 AI 덱');$('file026').value='';});
$('source026').onchange=()=>{renderSource();renderState();};
$('add026').onclick=()=>safe(()=>{assertNoWork();const original=model.cards;try{model.cards=sourceCards;selected=model.add(source());}finally{model.cards=original;}renderLibrary();message('새 시작 덱을 등록했어. 목록 온라인 저장을 눌러야 게임에서 불러올 수 있어.');});
$('replace026').onclick=()=>safe(()=>{assertNoWork();if(!confirm(`‘${chosen().name}’의 카드를 ‘${source().name}’ 덱으로 교체할까?`))return;model.backup();const replacement=copy(source());replacement.name=chosen().name;model.setDocument(replaceStarter026(model.document,selected,replacement,sourceCards,meta));renderLibrary();message('선택한 시작 덱의 카드 구성을 교체했어. 목록 온라인 저장을 눌러줘.');});
$('close026').onclick=()=>$('detail026').close();$('detail026').onclick=e=>{if(e.target===$('detail026'))$('detail026').close();};
window.addEventListener('storage',e=>{if(e.key===DRAFT_KEY026){uiBusy=true;renderState();$('export026').disabled=false;$('export026').onclick=()=>download({document:model?.document,work:model?.work,baseline:model?.baseline},'roguelite-starters-other-tab-backup.json');message('다른 창에서 시작 덱 초안을 바꿨어. 이 창의 편집본도 보존돼. JSON으로 보관한 뒤 새로고침해줘.');}});
async function init(){try{
 const catalog=await loadCatalog();cards=catalog.cards;meta=catalog.meta;
 const response=await fetch('./data/cloud-config.json',{cache:'no-store'});if(!response.ok)throw Error('온라인 연결 설정을 읽지 못했어.');const config=validateCloudConfig(await response.json());
 client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(10000)})}});
 const [limits,settings]=await Promise.all([new CardLimitsCloud(client).load(),new CardSettingsCloud(client).load()]);applyLimits(cards,limits);applySettings(cards,settings);
 model=new StarterEditor026({storage:localStorage,cloud:new StarterCloud153(client),cards,meta});
 if(model.document){selected=model.work?.id??'';renderLibrary();}
 client.auth.onAuthStateChange(()=>{canEdit=false;renderState();});await safe(refresh);
 }catch(error){message(starterCloudError153(error)+' 기존 브라우저 초안은 덮어쓰지 않았어.');const raw=localStorage.getItem(DRAFT_KEY026);if(raw!==null){$('export026').disabled=false;$('export026').onclick=()=>download(raw,'roguelite-starters-original-draft.json');}for(const id of ['online-source026','browser-source026','import-source026'])$(id).disabled=true;}}
init();
