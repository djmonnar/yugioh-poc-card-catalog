import {NATIVE035_CATALOG,NATIVE035_BASE_BINDINGS,emptyNative035,indexNative035,parseNative035,sha256035,cardRef035,isExtra035,filterCards035} from './native035-core.js?v=035-2';
import {NativeCloud035} from './native035-cloud.js?v=035-2';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig,cloudError} from './supabase-cloud.js?v=20261008-70';
const $=id=>document.getElementById(id),DRAFT='poc-native035-draft-v1',LOAD_BACKUP='poc-native035-before-load038',clone=structuredClone;
const requestedDeck=new URLSearchParams(location.search).get('deck');
const handoffDeck=requestedDeck&&/^[A-Za-z0-9_-]{1,100}$/.test(requestedDeck)?requestedDeck:null;
function activatePanel(){const tab=['decks','starters','chapters','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'decks';for(const panel of document.querySelectorAll('.tab-panel'))panel.hidden=panel.id!==tab;for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===tab);}
function handoffNotice(remoteVersion){if(!handoffDeck)return;if(remoteVersion!==undefined&&version!==remoteVersion){say('AI 덱 만들기에서 온라인 저장본을 변경했어. 현재 편집본을 유지하고 있으니 온라인 불러오기를 눌러 새 덱을 확인해줘. 불러오기 전 편집본은 백업돼.');return;}const deck=doc.decks.find(d=>d.deck_id===handoffDeck);if(deck){selected=deck.deck_id;renderDeckChoices();renderDeck();say(`${deck.name} 덱을 원정에 편성할 수 있어. 전투의 직접 지정을 켜고 덱을 선택한 뒤 온라인 저장을 눌러줘.`);}else say('AI 덱 만들기에서 저장한 덱을 보려면 온라인 불러오기를 눌러줘. 현재 편집본은 불러오기 전에 백업돼.');}
let index,doc=emptyNative035(),characters=[],selected=null,page=0,cloud=null,client=null,version=null,isEditor=false,busy=false,activeCard=null,draftRestored=false;
const say=t=>$('status').textContent=t;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls){const n=el('button',text,cls);n.type='button';n.addEventListener('click',()=>attempt(fn));return n;}
async function attempt(fn){try{await fn();}catch(e){say(e.message?.includes('poc_conflict')?'다른 곳에서 저장한 변경이 있어. 편집본을 받은 뒤 온라인 저장본과 비교해줘.':e.message?.includes('poc_')?cloudError(e):e.message||'작업을 마치지 못했어.');}}
function persist(){localStorage.setItem(DRAFT,JSON.stringify({schema:1,document:doc,baseVersion:version}));$('version').textContent=version===null?'온라인 저장본 확인 전 · 브라우저에 보관 중':`온라인 버전 ${version} · 편집본은 이 브라우저에 보관 중`;}
function current(){return doc.decks.find(d=>d.deck_id===selected)||null;}
function ready(){if(!index)throw Error('카드 자료를 불러오는 중이야.');}
function uniqueId(){return `deck-${crypto.randomUUID()}`;}
function makeDeck(){return {deck_id:uniqueId(),name:'새 원정 덱',character_id:null,character_skill_profile_id:null,use_shared_skills:true,banlist_enabled:true,main:[],extra:[]};}
function saveDraft(){persist();renderDeckChoices();renderStarters();renderChapters();}
function count(rows){return rows.reduce((n,r)=>n+r.count,0);}
function newDeck(source=null){ready();const d=source?{...clone(source),deck_id:uniqueId(),name:`${source.name} 복사본`.slice(0,100)}:makeDeck();doc.decks.push(d);selected=d.deck_id;saveDraft();renderDeck();say('카드 목록에서 카드를 골라 덱을 만들어줘.');}
function removeDeck(){const d=current();if(!d)return;doc.decks=doc.decks.filter(r=>r.deck_id!==d.deck_id);doc.starters=doc.starters.filter(k=>k!==d.deck_id);for(const ch of doc.chapters)for(const role of ['battle','elite','boss']){ch[role].entries=ch[role].entries.filter(r=>r.deck_id!==d.deck_id);if(!ch[role].entries.length)ch[role].enabled=false;}if(!doc.starters.length)doc.applySections.starters=false;selected=doc.decks[0]?.deck_id??null;saveDraft();renderDeck();say('덱을 편집본에서 삭제했어. 온라인 저장을 누르면 반영돼.');}
function adjust(source,delta){
 ready();const d=current();if(!d)throw Error('먼저 새 덱을 만들어줘.');const c=index.bySource.get(source);if(!c?.playable||c.token)throw Error('이 카드는 덱에 넣을 수 없어.');
 const zone=isExtra035(c)?'extra':'main',next=clone(d),rows=next[zone],row=rows.find(r=>r.source_id===source);
 if(delta<0){if(!row)return;row.count--;if(!row.count)next[zone]=rows.filter(r=>r!==row);}else{if(row)row.count++;else rows.push({...cardRef035(c),count:1});}
 const check=emptyNative035();check.decks=[next];parseNative035(check,index,{allowIncomplete:true,characterIds:new Set(characters.map(c=>c.id))});
 doc.decks[doc.decks.indexOf(d)]=next;persist();renderDeck();say(delta>0?`${c.name} 추가 · ${zone==='main'?'메인':'엑스트라'} ${count(next[zone])}장`:`${c.name} 제외`);
}
function tile(c,quantity=0,origin='catalog'){
 const n=el('div',undefined,`card-tile${c.expanded?' native':''}`);n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('aria-label',`${c.name}${quantity?` ${quantity}장`:''} · 카드 정보`);n.dataset.source=String(c.sourceId);n.dataset.origin=origin;n.draggable=true;
 const image=el('img');image.src=c.image;image.alt=c.name;image.loading='lazy';image.width=100;image.height=145;n.append(image,el('div',c.name,'name'));if(quantity)n.append(el('span',`×${quantity}`,'qty'));if(c.expanded)n.append(el('span','Unity','engine-badge'));
 n.addEventListener('click',()=>{if(n.dataset.suppress==='yes'){delete n.dataset.suppress;return;}showCard(c,origin);});n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showCard(c,origin);}});
 n.addEventListener('dragstart',e=>e.dataTransfer.setData('application/x-native035',JSON.stringify({source:c.sourceId,origin})));
 bindTouchDrag(n,c,origin);return n;
}
function bindTouchDrag(n,c,origin){
 let state=null,timer=null;const clean=()=>{clearTimeout(timer);state?.ghost?.remove();state=null;document.querySelectorAll('.over').forEach(e=>e.classList.remove('over'));};
 n.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||e.button!==0)return;state={id:e.pointerId,x:e.clientX,y:e.clientY};timer=setTimeout(()=>{if(!state)return;state.ghost=el('img',undefined,'drag-ghost');state.ghost.src=c.image;state.ghost.style.left=`${state.x}px`;state.ghost.style.top=`${state.y}px`;document.body.append(state.ghost);n.setPointerCapture(e.pointerId);n.dataset.suppress='yes';},350);});
 n.addEventListener('pointermove',e=>{if(!state||state.id!==e.pointerId)return;if(!state.ghost){if(Math.hypot(e.clientX-state.x,e.clientY-state.y)>9)clean();return;}e.preventDefault();state.ghost.style.left=`${e.clientX}px`;state.ghost.style.top=`${e.clientY}px`;document.querySelectorAll('.over').forEach(e=>e.classList.remove('over'));document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]')?.classList.add('over');},{passive:false});
 n.addEventListener('pointerup',e=>{if(state?.ghost){const zone=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]')?.dataset.zone;attempt(()=>drop({source:c.sourceId,origin},zone));}clean();});n.addEventListener('pointercancel',clean);
}
function drop(payload,zone){if(!payload||!Number.isSafeInteger(payload.source)||!['catalog','main','extra'].includes(payload.origin))return;const c=index.bySource.get(payload.source);if(!c)return;if(zone==='catalog'&&payload.origin!=='catalog')adjust(c.sourceId,-1);else if(zone===(isExtra035(c)?'extra':'main')&&payload.origin==='catalog')adjust(c.sourceId,1);else if(zone&&zone!=='catalog'&&payload.origin==='catalog')throw Error(isExtra035(c)?'융합 몬스터는 엑스트라 덱으로 옮겨줘.':'이 카드는 메인 덱으로 옮겨줘.');}
for(const node of document.querySelectorAll('[data-zone]')){node.addEventListener('dragover',e=>{e.preventDefault();node.classList.add('over');});node.addEventListener('dragleave',()=>node.classList.remove('over'));node.addEventListener('drop',e=>{e.preventDefault();node.classList.remove('over');attempt(()=>drop(JSON.parse(e.dataTransfer.getData('application/x-native035')||'null'),node.dataset.zone));});}
function showCard(c,origin){activeCard=c;$('info-image').src=c.image;$('info-image').alt=c.name;$('info-name').textContent=c.name;$('info-kind').textContent=`${c.rarity} · ${c.typeName}${c.expanded?' · Unity 추가 카드':''}`;$('info-stats').textContent=c.type&1?`레벨 ${c.level} · 공격력 ${c.attack} / 수비력 ${c.defense}`:'';$('info-description').textContent=c.description;$('info-actions').replaceChildren();if(current()){$('info-actions').append(button('덱에 1장 추가',()=>adjust(c.sourceId,1),'gold'));if(origin!=='catalog')$('info-actions').append(button('덱에서 1장 빼기',()=>adjust(c.sourceId,-1)));}if(!$('card-info').open)$('card-info').showModal();}
$('close-info').onclick=()=>$('card-info').close();$('card-info').addEventListener('click',e=>{if(e.target===$('card-info')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function renderDeckChoices(){const list=$('deck-list');list.replaceChildren();if(!doc.decks.length){const o=el('option','새 덱을 만들어줘');o.value='';list.append(o);}for(const d of doc.decks){const o=el('option',d.name);o.value=d.deck_id;list.append(o);}if(!doc.decks.some(d=>d.deck_id===selected))selected=doc.decks[0]?.deck_id??null;list.value=selected??'';}
function renderDeck(){const d=current();for(const name of ['deck-name','character','character-profile','banlist','copy-deck','delete-deck'])$(name).disabled=!d;$('deck-name').value=d?.name??'';$('banlist').checked=d?.banlist_enabled??true;const chars=$('character');chars.replaceChildren();const none=el('option','선택 안 함');none.value='';chars.append(none);for(const row of characters){const o=el('option',row.profile.name);o.value=row.id;chars.append(o);}chars.value=d?.character_id??'';renderCharacterProfiles();for(const zone of ['main','extra']){$(`${zone}-cards`).replaceChildren();for(const r of d?.[zone]??[]){const c=index.bySource.get(r.source_id);if(c)$(`${zone}-cards`).append(tile(c,r.count,zone));}$(`${zone}-count`).textContent=`${count(d?.[zone]??[])} / ${zone==='main'?'20~30':'15'}장`;}}
function renderCharacterProfiles(){const d=current(),select=$('character-profile');select.replaceChildren();const base=el('option','기본 특성');base.value='';select.append(base);const character=characters.find(c=>c.id===d?.character_id);for(const p of character?.profile.skill_profiles??[]){const o=el('option',p.name);o.value=p.profile_id;select.append(o);}select.value=d?.character_skill_profile_id??'';select.disabled=!character;}
function renderCatalog(){if(!index)return;const rows=filterCards035(index,{engine:$('engine').value,query:$('search').value,kind:$('kind').value}),size=36,total=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,total-1);$('match-count').textContent=`${rows.length}장`;$('catalog-cards').replaceChildren(...rows.slice(page*size,(page+1)*size).map(c=>tile(c)));const prev=button('이전',()=>{page--;renderCatalog();}),next=button('다음',()=>{page++;renderCatalog();});prev.disabled=page===0;next.disabled=page===total-1;$('pages').replaceChildren(prev,el('span',`${page+1} / ${total}`),next);}
function renderStarters(){$('apply-starters').checked=doc.applySections.starters;const list=$('starter-list');list.replaceChildren();if(!doc.decks.length)list.append(el('p','덱 만들기에서 시작 덱을 먼저 준비해줘.'));for(const d of doc.decks){const label=el('label',undefined,'choice'),check=el('input');check.type='checkbox';check.checked=doc.starters.includes(d.deck_id);check.disabled=!d.banlist_enabled;check.onchange=()=>{doc.starters=check.checked?[...doc.starters,d.deck_id]:doc.starters.filter(k=>k!==d.deck_id);persist();};const info=el('div');info.append(el('strong',d.name),el('p',`${count(d.main)}장 · ${d.banlist_enabled?'선택 가능':'카드 제한 적용을 켜야 등록 가능'}`));label.append(check,info);list.append(label);}}
function renderChapters(){
 const box=$('chapter-list');box.replaceChildren();$('apply-chapters').checked=doc.applySections.chapters;
 for(const chapter of doc.chapters){
  const block=el('section',undefined,'chapter'),grid=el('div',undefined,'role-grid');block.append(el('h3',`${chapter.chapter}장 · 15층`),grid);
  for(const role of ['battle','elite','boss']){
   const c=chapter[role],cell=el('article',undefined,'role');cell.append(el('h4',({battle:'일반 전투',elite:'엘리트',boss:'최종 보스'})[role]));
   const enabled=el('input'),mode=el('p',c.enabled?'지정한 덱 사용':'기존 편성 유지','role-mode');enabled.type='checkbox';enabled.checked=c.enabled;
   enabled.onchange=()=>{c.enabled=enabled.checked;mode.textContent=c.enabled?'지정한 덱 사용':'기존 편성 유지';persist();};
   const en=el('label',undefined,'check');en.append(enabled,el('span','직접 지정'));cell.append(en,mode);
   const lp=el('input');lp.type='number';lp.min='-3000';lp.max='50000';lp.step='100';lp.value=c.lp_bonus;lp.setAttribute('aria-label',`${chapter.chapter}장 ${role} 추가 LP`);lp.onchange=()=>{c.lp_bonus=Number(lp.value);persist();};
   const lpLine=el('label',undefined,'lp');lpLine.append(el('span','추가 LP'),lp);cell.append(lpLine);
   for(const d of doc.decks){
    const row=el('div',undefined,'pool-row'),check=el('input');check.type='checkbox';const value=c.entries.find(r=>r.deck_id===d.deck_id);check.checked=Boolean(value);const label=el('label');label.append(check,el('span',d.name));
    const weight=el('input');weight.type='number';weight.min='1';weight.max='10000';weight.value=value?.weight??1;weight.disabled=!value;weight.title='등장 가중치';weight.setAttribute('aria-label',`${d.name} 등장 가중치`);
    check.onchange=()=>{if(check.checked)c.entries.push({deck_id:d.deck_id,weight:Number(weight.value)});else c.entries=c.entries.filter(r=>r.deck_id!==d.deck_id);weight.disabled=!check.checked;persist();};
    weight.onchange=()=>{const target=c.entries.find(r=>r.deck_id===d.deck_id);if(target)target.weight=Number(weight.value);persist();};row.append(label,weight);cell.append(row);
   }grid.append(cell);
  }box.append(block);
 }
}
function renderSettings(){$('apply-settings').checked=doc.applySections.settings;$('setting-list').replaceChildren();for(const c of index.cards.filter(c=>c.expanded)){const card=el('article',undefined,'setting'),image=el('img');image.src=c.image;image.alt=c.name;image.loading='lazy';card.append(image,el('h3',c.name));const controls=el('div',undefined,'controls'),before=doc.settings.find(s=>s.source_id===c.sourceId),value=before??{...cardRef035(c),rarity:c.rarity,stock:true,draw_enabled:true};const change=()=>{if(!doc.settings.some(s=>s.source_id===c.sourceId))doc.settings.push(value);persist();};const rarity=el('select');rarity.setAttribute('aria-label',`${c.name} 등급`);for(const r of ['N','R','SR','UR']){const o=el('option',r);o.value=r;rarity.append(o);}rarity.value=value.rarity;rarity.onchange=()=>{value.rarity=rarity.value;change();};controls.append(rarity);for(const [key,text]of [['stock','상점'],['draw_enabled','보상']]){const l=el('label'),input=el('input');input.type='checkbox';input.checked=value[key];input.onchange=()=>{value[key]=input.checked;change();};l.append(input,el('span',text));controls.append(l);}card.append(controls);$('setting-list').append(card);}}
function renderAll(){renderDeckChoices();renderDeck();renderCatalog();renderStarters();renderChapters();renderSettings();persist();}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{history.replaceState(null,'',location.pathname+location.search+'#'+b.dataset.tab);activatePanel();};
window.addEventListener('hashchange',activatePanel);activatePanel();
$('new-deck').onclick=()=>attempt(()=>newDeck());$('copy-deck').onclick=()=>attempt(()=>current()&&newDeck(current()));$('delete-deck').onclick=()=>attempt(removeDeck);$('deck-list').onchange=()=>{selected=$('deck-list').value;renderDeck();};
$('deck-name').onchange=()=>{if(current())current().name=$('deck-name').value;saveDraft();};$('character').onchange=()=>{if(current()){current().character_id=$('character').value||null;current().character_skill_profile_id=null;}renderCharacterProfiles();saveDraft();};$('character-profile').onchange=()=>{if(current())current().character_skill_profile_id=$('character-profile').value||null;saveDraft();};$('banlist').onchange=()=>{if(current())current().banlist_enabled=$('banlist').checked;if(!$('banlist').checked)doc.starters=doc.starters.filter(k=>k!==selected);saveDraft();};
for(const id of ['search','engine','kind'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;renderCatalog();});
for(const section of ['starters','chapters','settings'])$(`apply-${section}`).onchange=()=>{doc.applySections[section]=$(`apply-${section}`).checked;persist();};
$('download').onclick=()=>attempt(()=>{ready();const blob=new Blob([JSON.stringify({schema:1,kind:'unity-native035-draft',document:doc},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='expedition.native035.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);say('편집본을 받았어. Unity 원정 편집기에서 다시 열 수 있어.');});
$('import').onchange=()=>attempt(async()=>{ready();const file=$('import').files[0];if(!file)return;if(file.size>2000000)throw Error('편집본은 2MB 이하로 열어줘.');const value=JSON.parse(await file.text());if(value?.kind!=='unity-native035-draft'||value.schema!==1)throw Error('Unity 원정 편집본 파일을 골라줘.');doc=parseNative035(value.document,index,{allowIncomplete:true,characterIds:new Set(characters.map(c=>c.id))});renderAll();say('편집본을 열었어. 현재 온라인 버전은 유지했어.');});
async function auth(session){isEditor=false;$('logout').hidden=!session;$('login').hidden=Boolean(session);$('email').hidden=Boolean(session);$('account').textContent=session?`${session.user.email} · 권한 확인 중`:'로그인 전 · 열람과 브라우저 편집 가능';if(session){const r=await client.rpc('poc_editor_status');if(!r.error)isEditor=r.data===true;$('account').textContent=`${session.user.email} · ${isEditor?'편집 가능':'열람 계정'}`;}$('save').disabled=!isEditor||busy;}
async function connect(){const config=validateCloudConfig(await fetch('data/cloud-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('온라인 설정을 읽지 못했어.');return r.json();}));client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(15000)})}});cloud=new NativeCloud035(client,index);client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>attempt(()=>auth(session)),0));const r=await client.auth.getSession();if(r.error)throw r.error;await auth(r.data.session);}
async function online(save){
 if(busy)return;if(!cloud)throw Error('온라인 연결을 준비하지 못했어. 새로 열어줘.');busy=true;$('save').disabled=true;
 try{
  const lib=save?await cloud.save(doc,version):await cloud.load();
  if(!save&&JSON.stringify(doc)!==JSON.stringify(lib.document)){
   // A handoff from the AI builder must never discard an older local draft.
   // If its recovery copy cannot be stored, leave the current document alone.
   localStorage.setItem(LOAD_BACKUP,JSON.stringify({schema:1,kind:'unity-native035-draft',document:doc,baseVersion:version}));
   $('download-load-backup').hidden=false;
  }
  index=cloud.index;characters=lib.references.characters;doc=lib.document;version=lib.version;renderAll();
  say(save?'Unity 원정 덱과 적용 범위를 저장했어. 변경한 시작 덱·적 편성은 새 원정부터 적용돼.':lib.version===0?'등록된 Unity 덱은 아직 없어. 기존 게임의 시작 덱·적 편성은 그대로야.':'온라인 Unity 덱을 불러왔어.');
  if(!save)handoffNotice(lib.version);
 }finally{busy=false;$('save').disabled=!isEditor;}
}
$('download-load-backup').onclick=()=>attempt(()=>{
 const raw=localStorage.getItem(LOAD_BACKUP);if(!raw)throw Error('불러오기 전 편집본이 없어.');const saved=JSON.parse(raw);
 if(saved.schema!==1||saved.kind!=='unity-native035-draft'||saved.document?.catalog_id!==NATIVE035_CATALOG)throw Error('백업 형식을 확인할 수 없어. 원본은 보존했어.');
 const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=el('a');a.href=url;a.download='expedition.before-load038.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);
});
$('load').onclick=()=>attempt(()=>online(false));$('save').onclick=()=>attempt(()=>online(true));$('login').onclick=()=>attempt(async()=>{if(!client)throw Error('온라인 연결을 먼저 확인해줘.');const email=$('email').value.trim();if(!email)throw Error('편집 계정 이메일을 입력해줘.');const r=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.href.split('#')[0]}});if(r.error)throw r.error;say('로그인 메일을 보냈어. 같은 기기에서 링크를 열어줘.');});$('logout').onclick=()=>attempt(async()=>{const r=await client.auth.signOut();if(r.error)throw r.error;await auth(null);});
async function pinned(path,pin){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('카드 자료를 읽지 못했어.');const raw=await r.arrayBuffer();if(await sha256035(raw)!==pin)throw Error('카드 자료 버전이 맞지 않아. 새로 열어줘.');return JSON.parse(new TextDecoder().decode(raw));}
await attempt(async()=>{
 const [base,expansion]=await Promise.all([pinned('data/native-base035.json',NATIVE035_BASE_BINDINGS),pinned('data/native-expansion035.json',NATIVE035_CATALOG)]);
 index=indexNative035(base,expansion);
 try{const saved=JSON.parse(localStorage.getItem(DRAFT)||'null');if(saved?.schema===1&&saved.document?.catalog_id===NATIVE035_CATALOG){doc=parseNative035(saved.document,index,{allowIncomplete:true});version=Number.isSafeInteger(saved.baseVersion)?saved.baseVersion:null;draftRestored=true;}}
 catch{say('이전 편집본을 읽지 못했어. 온라인 저장본을 불러와줘.');}
 renderAll();activatePanel();$('download-load-backup').hidden=!localStorage.getItem(LOAD_BACKUP);say('새 덱을 만들거나 온라인 저장본을 불러와줘. 적용을 켜지 않은 항목은 기존 설정을 유지해.');await connect();
 // Always refresh references. A local draft, even an intentionally empty one,
 // is not replaced merely because the page was reopened.
 const lib=await cloud.load();index=cloud.index;characters=lib.references.characters;
 if(!draftRestored){doc=lib.document;version=lib.version;}
 else if(version===null&&lib.version===0)version=0;
 renderAll();
 say(lib.version===0?'기존 시작 덱·적 편성은 유지돼. 새로 지정할 항목만 적용을 켜줘.':draftRestored&&version!==lib.version?'브라우저 편집본을 유지했어. 온라인 버전이 바뀌었으니 저장 전에 비교해줘.':'캐릭터와 금제를 불러왔어. 편집본은 이 브라우저에 보관 중이야.');handoffNotice(lib.version);
});
