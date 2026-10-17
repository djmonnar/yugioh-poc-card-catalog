import {CAMPAIGN_DRAFT_KEY164,CAMPAIGN_LIBRARY_KIND164,CAMPAIGN_KINDS164,cleanCampaign164,cleanCampaignLibrary164,campaignReady164,campaignCategoryLP164,classifyCampaignTemplate164} from './campaign164-core.js?v=20261018-164';
import {CampaignCloud164,CampaignSync164,campaignError164} from './campaign164-sync.js?v=20261018-164';
import {loadCatalog,browserDecks,onlineDecks} from './roguelite-data.js';
import {cleanEncounterPool,buildEncounterPool,browserEncounterPool} from './roguelite-encounters.js?v=20261014-138';
import {parseRemoteScenarios} from './story-library.js?v=20261012-shared127';
import {parseCharacters,CHARACTER_KEY} from './character-library.js?v=20261012-shared127';
import {SKILLS,parseSkills,cardRef} from './story-core.js?v=20261012-shared127';
import {NUMERIC_SKILLS} from './story-skills.js?v=20261009-73';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig} from './supabase-cloud.js?v=20261008-70';

const $=id=>document.getElementById(id),copy=structuredClone,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const names={battle:'일반 전투',elite:'엘리트 전투',boss:'보스 전투'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls)=>{const n=el('button',text,cls);n.type='button';n.onclick=()=>safe(fn);return n;};
const field=(name,input)=>{const label=el('label',name);label.append(input);return label;};
let doc=null,defaultDoc=null,cards=[],meta={},source=[],sourceLabel='설치 기본 상대',characters=[],chapterIndex=0,poolKind='battle',client=null,sync=null,canEdit=false,connection=null,authGeneration=0;
let rawDraft=null,draftBlocked=false,storageBlocked=false,externalChange=false,draftBase=null,draftBaseline=null,loadedDraft=false,toastTimer,pickFilter=null,pickCallback=null,cardPage=1;
$('main164').inert=true;
function message(text){$('status164').textContent=text;}
function toast(text){$('toast164').textContent=text;$('toast164').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast164').hidden=true,4000);}
async function safe(fn){try{return await fn();}catch(error){message(campaignError164(error));toast(campaignError164(error));renderSync();}}
function download(name,value){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function summary(d){return d.chapters.map(ch=>`${ch.name}: 일반 ${ch.battle.pool.length} · 엘리트 ${ch.elite.pool.length} · 보스 ${ch.boss.pool.length}`).join(' / ');}
function assertStorage(){if(draftBlocked||storageBlocked||externalChange)throw Error('초안 원본을 보관한 뒤 브라우저 저장 상태를 확인해줘.');}
function persist(){
 if(!doc||draftBlocked||storageBlocked||externalChange)return false;const s=sync?.state();
 try{localStorage.setItem(CAMPAIGN_DRAFT_KEY164,JSON.stringify({schema_version:1,kind:'poc-expedition-campaign-draft',document:cleanCampaign164(doc),base_version:s?.base_version??draftBase,baseline:s?.baseline??draftBaseline}));return true;}
 catch(error){storageBlocked=true;message('브라우저 초안을 저장할 수 없어. JSON 내보내기로 보관해줘.');renderSync();return false;}
}
function readDraft(){
 try{rawDraft=localStorage.getItem(CAMPAIGN_DRAFT_KEY164);if(rawDraft===null)return;const value=JSON.parse(rawDraft);if(value.schema_version!==1||value.kind!=='poc-expedition-campaign-draft'||!(value.base_version===null||Number.isSafeInteger(value.base_version)&&value.base_version>=0))throw Error('draft');
  const candidate=cleanCampaign164(value.document);let baseline=null;if(value.baseline!==null){baseline=cleanCampaignLibrary164(value.baseline);if(baseline.version!==value.base_version)throw Error('draft version');}else if(value.base_version!==null)throw Error('draft baseline');
  doc=candidate;draftBase=value.base_version;draftBaseline=baseline;loadedDraft=true;
 }catch{draftBlocked=true;message('기존 브라우저 초안을 보존했어. 원본을 내려받아 확인해줘.');}
}
function changed(mutator,{render=true}={}){assertStorage();const next=copy(doc);mutator(next);const checked=cleanCampaign164(next);doc=checked;persist();if(render)renderAll();else renderSync();}
function renderSync(){
 const state=sync?.state(),blocked=draftBlocked||storageBlocked||externalChange,ready=doc?campaignReady164(doc):{valid:false};
 $('save164').disabled=!doc||!canEdit||!!state?.busy||blocked||!ready.valid;
 for(const id of ['check164','load164','compared164','remote164'])$(id).disabled=!!state?.busy||(id!=='check164'&&blocked);
 $('sync164').textContent=state?`${state.message} 브라우저 기준 ${state.base_version??'미확인'} · 온라인 ${state.online?.version??'미확인'}${state.same?' · 저장본과 같음':' · 편집본 별도 유지'}`:'브라우저 편집본을 자동 보관해. 온라인 저장은 별도로 눌러줘.';
 $('conflict164').hidden=!state?.conflict;
 if(state?.online){$('local-summary164').textContent=summary(doc);$('remote-summary164').textContent=summary(state.online.document);$('local-json164').textContent=JSON.stringify(doc,null,2);$('remote-json164').textContent=JSON.stringify(state.online.document,null,2);}
 $('draft-warning164').hidden=!blocked;$('ready164').textContent=doc?(ready.valid?'세 장의 상대가 모두 준비됐어. 새 원정 시작 시 이 구성을 함께 보관해.':ready.issues.join(' ')):'';
 if(doc&&$('pool164').open)$('pool-count164').textContent=`검색 ${poolRows().length}명 · 현재 선택 ${doc.chapters[chapterIndex][poolKind].pool.length}명`;
}
function skillText(s){
 let tail=s.card?.name_ko||'';if(Object.hasOwn(s,'value'))tail=String(s.value)+(s.kind.includes('draw')?'장':' LP');if(s.kind==='draw_once')tail+=` · LP ${s.threshold} 이하`;if(s.kind==='start_monster')tail+=` · ${{attack:'공격',defense:'수비',set:'뒷면 수비'}[s.position]}`;if(s.kind==='start_grave')tail=s.entries.map(e=>`${e.card.name_ko} ×${e.count}`).join(', ');return `${SKILLS[s.kind]}${tail?`: ${tail}`:''}`;
}
function skillList(skills,overrides=[]){const ul=el('ul',null,'skill-list');if(!skills.length)ul.append(el('li','기본 특성 없음'));for(const s of skills)ul.append(el('li',skillText(s)+(overrides.some(t=>t.kind===s.kind)?' → 구역 특성으로 교체':'')));return ul;}
function renderAll(){
 if(!doc)return;const tabs=$('chapters164');tabs.replaceChildren(...doc.chapters.map((ch,i)=>{const b=button(`${i+1}장 · ${ch.name}`,()=>{chapterIndex=i;renderAll();});b.setAttribute('aria-pressed',String(i===chapterIndex));return b;}));
 const ch=doc.chapters[chapterIndex],root=$('chapter164');root.replaceChildren(el('h2',`${chapterIndex+1}장 · 15층`));
 const fields=el('div',null,'chapter-fields'),name=el('input'),description=el('textarea');name.value=ch.name;name.maxLength=100;name.onchange=()=>safe(()=>changed(d=>d.chapters[chapterIndex].name=name.value));description.value=ch.description;description.maxLength=2000;description.onchange=()=>safe(()=>changed(d=>d.chapters[chapterIndex].description=description.value));fields.append(field('구역 이름',name),field('구역 설명',description));root.append(fields);
 for(const kind of CAMPAIGN_KINDS164){const category=ch[kind],section=el('section',null,'category'),head=el('div',null,'category-head'),info=el('div',null,'category-info');head.append(el('h3',names[kind]),button(`상대 후보 고르기 · ${category.pool.length}명`,()=>openPool(kind),'primary'));section.append(head);
  const lp=el('input');lp.type='number';lp.min='0';lp.max='8000';lp.step='100';lp.value=category.lp_bonus;lp.onchange=()=>safe(()=>changed(d=>{d.chapters[chapterIndex][kind].lp_bonus=Number(lp.value);}));info.append(field('공통 추가 LP',lp),el('p','0 또는 100~8,000. 상대 기본 LP 특성에 더해지며 합계는 +8,000까지야.','muted'));section.append(info);
  if(!category.pool.length)section.append(el('p','이 종류의 상대를 한 명 이상 골라줘.','empty'));
  const list=el('div',null,'opponents');for(const t of category.pool){const tile=el('article',null,'opponent'),img=el('img'),body=el('div'),tools=el('div',null,'tools');img.src=t.portrait||'assets/icon.svg';img.alt='';body.append(el('strong',t.opponent_name),el('small',t.battle_name),el('small',t.deck_name),el('p',`시작 LP ${campaignCategoryLP164(t,category).toLocaleString()}`),skillList(t.skills,category.traits));tools.append(button('덱·특성 보기',()=>showDeck(t)),button('후보에서 빼기',()=>changed(d=>d.chapters[chapterIndex][kind].pool=d.chapters[chapterIndex][kind].pool.filter(x=>x.template_id!==t.template_id))));tile.append(img,body,tools);list.append(tile);}section.append(list);
  if(kind!=='battle')renderTraits(section,kind);else section.append(el('p','일반 전투는 선택한 상대의 기본 특성을 사용해.','muted'));root.append(section);
 }
 $('source164').textContent=`${sourceLabel} · ${source.length}개 전투 · 공용 캐릭터 ${characters.length}명`;renderSync();
}
function numeric(value,min,max,onchange){const input=el('input');input.type='number';input.min=min;input.max=max;input.value=value;input.onchange=()=>safe(()=>onchange(Number(input.value)));return input;}
function renderTraits(root,kind){
 const category=doc.chapters[chapterIndex][kind],box=el('div');box.append(el('h4','이 구역에 적용할 공통 특성'),el('p','같은 종류가 있으면 아래 값으로 교체하고, 나머지 상대 기본 특성은 유지해. 아래에서 제거하면 그 상대의 기본 특성이 다시 적용돼.','muted'));
 category.traits.forEach((s,index)=>{const row=el('div',null,'trait-row');row.append(el('strong',SKILLS[s.kind]),button('추가 특성 제거',()=>changed(d=>d.chapters[chapterIndex][kind].traits.splice(index,1))));
  const set=(key,value)=>changed(d=>d.chapters[chapterIndex][kind].traits[index][key]=value);
  if(NUMERIC_SKILLS[s.kind]){const [min,max,,label]=NUMERIC_SKILLS[s.kind];row.append(field(label,numeric(s.value,min,max,v=>set('value',v))));if(s.kind==='draw_once')row.append(field('발동 LP 이하',numeric(s.threshold,100,16000,v=>set('threshold',v))));}
  else if(s.kind==='start_grave'){
   const entries=el('div',null,'entries');s.entries.forEach((entry,ei)=>{const item=el('div');item.append(button(entry.card.name_ko,()=>openCards(c=>!c.special&&c.type!=='융합 몬스터',c=>changed(d=>d.chapters[chapterIndex][kind].traits[index].entries[ei].card=cardRef(c)))),numeric(entry.count,1,12,v=>changed(d=>d.chapters[chapterIndex][kind].traits[index].entries[ei].count=v)));if(s.entries.length>1)item.append(button('빼기',()=>changed(d=>d.chapters[chapterIndex][kind].traits[index].entries.splice(ei,1))));entries.append(item);});
   if(s.entries.reduce((n,e)=>n+e.count,0)<12)entries.append(button('묘지 카드 추가',()=>openCards(c=>!c.special&&c.type!=='융합 몬스터'&&!s.entries.some(e=>e.card.slot===c.slot),c=>changed(d=>d.chapters[chapterIndex][kind].traits[index].entries.push({card:cardRef(c),count:1})))));row.append(entries);
  }else if(s.card){row.append(button(s.card.name_ko,()=>openCards(c=>eligibleSkillCard(c,s.kind),c=>set('card',cardRef(c)))));if(s.kind==='start_monster'){const select=el('select');for(const [value,label]of Object.entries({attack:'앞면 공격',defense:'앞면 수비',set:'뒷면 수비'})){const option=el('option',label);option.value=value;select.append(option);}select.value=s.position;select.onchange=()=>safe(()=>set('position',select.value));row.append(field('시작 표시',select));}}
  box.append(row);
 });
 const actions=el('div',null,'trait-actions'),select=el('select');for(const [kind,label]of Object.entries(SKILLS))if(!category.traits.some(s=>s.kind===kind)){const option=el('option',label);option.value=kind;select.append(option);}actions.append(select,button('특성 추가',()=>addTrait(kind,select.value)));
 const profiles=characters.flatMap(c=>[{name:`${c.profile.name} · 기본`,skills:c.profile.skills||[]},...(c.profile.skill_profiles||[]).map(p=>({name:`${c.profile.name} · ${p.name}`,skills:p.skills}))]);
 if(profiles.length){const choose=el('select');choose.append(el('option','공용 캐릭터 특성 묶음 선택'));profiles.forEach((p,i)=>{const option=el('option',p.name);option.value=String(i);choose.append(option);});choose.options[0].value='';actions.append(choose,button('이 구역 특성으로 가져오기',()=>{if(choose.value==='')throw Error('공용 캐릭터 묶음을 먼저 골라줘.');changed(d=>d.chapters[chapterIndex][kind].traits=parseSkills(profiles[Number(choose.value)].skills));}));}
 box.append(actions);root.append(box);
}
function eligibleSkillCard(c,kind){return !c.special&&c.type!=='융합 몬스터'&&(kind==='start_monster'?c.type.includes('몬스터'):kind==='start_field'?['마법','함정'].includes(c.type):true);}
function addTrait(category,kind){
 if(!kind)throw Error('모든 종류의 특성이 이미 추가돼 있어.');const append=value=>changed(d=>d.chapters[chapterIndex][category].traits.push(value));
 if(NUMERIC_SKILLS[kind]){append({kind,value:NUMERIC_SKILLS[kind][2],...(kind==='draw_once'?{threshold:2000}:{})});return;}
 if(kind==='parasite_deck'){append({kind});return;}
 openCards(c=>eligibleSkillCard(c,kind),c=>append(kind==='start_grave'?{kind,entries:[{card:cardRef(c),count:1}]}:{kind,card:cardRef(c),...(kind==='start_monster'?{position:'defense'}:{})}));
}
function openPool(kind){poolKind=kind;$('pool-title164').textContent=`${doc.chapters[chapterIndex].name} · ${names[kind]} 상대`;$('pool-search164').value='';$('pool-only164').checked=false;$('pool-help164').textContent='캐릭터와 연결된 모든 완성 덱에서 골라줘. 선택한 상대를 이 전투 종류로 분류해 저장해. 같은 상대를 다시 누르면 취소해. 원본을 바꿨다면 최신 자료로 갱신할 수 있어.';renderPool();$('pool164').showModal();}
function poolRows(){
 const category=doc.chapters[chapterIndex][poolKind],combined=new Map(source.map(t=>[t.template_id,t]));
 for(const t of category.pool)if(!combined.has(t.template_id))combined.set(t.template_id,t);
 const q=$('pool-search164').value.normalize('NFKC').toLowerCase().trim();
 return [...combined.values()].filter(t=>(!$('pool-only164').checked||category.pool.some(p=>p.template_id===t.template_id))&&`${t.opponent_name} ${t.deck_name} ${t.battle_name}`.normalize('NFKC').toLowerCase().includes(q));
}
function renderPool(){
 const rows=poolRows(),selected=doc.chapters[chapterIndex][poolKind].pool;
 $('pool-count164').textContent=`검색 ${rows.length}명 · 현재 선택 ${selected.length}명`;
 $('pool-rows164').replaceChildren(...rows.map(sourceTemplate=>{
  const t=classifyCampaignTemplate164(sourceTemplate,poolKind),chosen=selected.find(p=>p.template_id===t.template_id),tile=el('article',null,'pool-row'+(chosen?' selected':'')),image=el('img'),body=el('div'),tools=el('div',null,'toolbar');image.src=t.portrait||'assets/icon.svg';image.alt='';
  body.append(el('strong',t.opponent_name),el('small',t.battle_name),el('small',t.deck_name),el('small',`난이도 ${t.difficulty} · ${t.source.scenario_name}`));
  tools.append(button(chosen?'✓ 선택됨 · 빼기':'+ 후보에 추가',()=>togglePool(tile,t)),button('덱 보기',()=>showDeck(t)));
  tools.firstChild.setAttribute('aria-pressed',String(!!chosen));
  if(chosen&&!same(t,chosen))tools.append(button('최신 자료로 갱신',()=>{const scroll=$('pool164').scrollTop;changed(d=>{const p=d.chapters[chapterIndex][poolKind].pool;p[p.findIndex(x=>x.template_id===t.template_id)]=copy(t);});renderPool();$('pool164').scrollTop=scroll;}));
  tile.append(image,body,tools);return tile;
 }));
}
function togglePool(tile,t){
 const scroll=$('pool164').scrollTop;
 changed(d=>{const pool=d.chapters[chapterIndex][poolKind].pool,index=pool.findIndex(p=>p.template_id===t.template_id);if(index<0)pool.push(copy(t));else pool.splice(index,1);},{render:false});
 if($('pool-only164').checked)renderPool();else{const chosen=doc.chapters[chapterIndex][poolKind].pool.some(p=>p.template_id===t.template_id),control=tile.querySelector('button');tile.classList.toggle('selected',chosen);control.textContent=chosen?'✓ 선택됨 · 빼기':'+ 후보에 추가';control.setAttribute('aria-pressed',String(chosen));}
 renderAll();$('pool164').scrollTop=scroll;
}
function openCards(filter,callback){pickFilter=filter;pickCallback=callback;cardPage=1;$('card-search164').value='';renderCards();$('card164').showModal();}
function renderCards(){const q=$('card-search164').value.normalize('NFKC').toLowerCase().trim(),rows=cards.filter(c=>pickFilter?.(c)&&`${c.name_ko} ${c.name_en} ${c.description_ko} ${c.race} ${c.slot}`.normalize('NFKC').toLowerCase().includes(q)),pages=Math.max(1,Math.ceil(rows.length/24));cardPage=Math.min(Math.max(cardPage,1),pages);$('card-grid164').replaceChildren(...rows.slice((cardPage-1)*24,cardPage*24).map(c=>{const b=button('',()=>{pickCallback(c);$('card164').close();}),img=el('img');img.src=c.image;img.alt='';img.loading='lazy';b.append(img,el('strong',c.name_ko),el('small',[c.type,c.race,c.level?`★${c.level}`:'',c.atk==null?'':`${c.atk}/${c.def}`].filter(Boolean).join(' · ')));return b;}));$('card-page164').textContent=`${cardPage} / ${pages} · ${rows.length}종`;$('card-prev164').disabled=cardPage<=1;$('card-next164').disabled=cardPage>=pages;}
function showDeck(t){const root=$('detail-body164');$('detail-title164').textContent=`${t.opponent_name} · ${t.deck_name}`;root.replaceChildren(el('p',`${t.battle_name} · 난이도 ${t.difficulty} · ${t.recipe}`),el('h3','상대 기본 특성'),skillList(t.skills));for(const group of ['main','extra','side']){root.append(el('h3',`${{main:'메인 덱',extra:'엑스트라 덱',side:'사이드 덱'}[group]} · ${t.deck.groups[group].reduce((n,c)=>n+c.count,0)}장`));const grid=el('div',null,'deck-cards');for(const ref of t.deck.groups[group]){const c=cards.find(x=>x.identity_key===ref.identity_key),box=el('article',null,'deck-card');if(c){const img=el('img');img.src=c.image;img.alt='';img.loading='lazy';const details=el('details');details.append(el('summary','카드 효과'),el('p',c.description_ko));box.append(img,el('strong',`${c.name_ko} ×${ref.count}`),el('p',[c.type,c.race,c.level?`★${c.level}`:'',c.atk==null?'':`ATK ${c.atk} / DEF ${c.def}`].filter(Boolean).join(' · ')),details);}else box.append(el('strong',`${ref.name_ko} ×${ref.count}`),el('p','현재 도감에 없는 이전 카드 자료'));grid.append(box);}root.append(grid);}if(!$('detail164').open)$('detail164').showModal();}
async function auth(session){const generation=++authGeneration;let allowed=false;try{allowed=!!session&&await new CampaignCloud164(client).editor();}catch{}if(generation!==authGeneration)return;canEdit=allowed;$('auth164').textContent=allowed?'로그인됨 · 원정 구성 편집 가능':session?'이 계정에는 온라인 편집 권한이 없어.':'브라우저 편집 가능 · 온라인 저장은 편집자 이메일로 로그인해줘.';renderSync();}
async function connect(){if(connection)return connection;if(sync)return sync;connection=(async()=>{const response=await fetch('data/cloud-config.json',{cache:'no-store'});if(!response.ok)throw Error('온라인 연결 설정을 읽지 못했어.');const config=validateCloudConfig(await response.json());client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(15000)})}});client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>auth(session),0));sync=new CampaignSync164({cloud:new CampaignCloud164(client),getDocument:()=>doc,replaceDocument:value=>{doc=value;renderAll();},baseVersion:draftBase,baseline:draftBaseline,cards:()=>cards,changed:()=>{renderSync();persist();}});const session=await client.auth.getSession();if(session.error)throw session.error;await auth(session.data.session);return sync;})();try{return await connection;}finally{connection=null;}}
async function loadOnline(){assertStorage();download('campaign-before-online-load.json',doc);await(await connect()).loadIntoDraft();persist();renderAll();}
async function loadSource(kind){
 if(kind==='bundled'){const response=await fetch('data/roguelite-opponents.json',{cache:'no-store'});if(!response.ok)throw Error('설치 기본 상대를 불러오지 못했어.');source=cleanEncounterPool((await response.json()).pool);sourceLabel='설치 기본 상대';}
 else if(kind==='browser'){const next=browserEncounterPool(localStorage,browserDecks(localStorage,cards),cards),actors=parseCharacters(JSON.parse(localStorage.getItem(CHARACTER_KEY)||'[]'));source=next.pool;characters=actors;sourceLabel=`브라우저 AI 배틀${next.issues.length?` · 자료 확인 필요 ${next.issues.length}개`:''}`;}
 else{await connect();const loaded=await onlineDecks(cards,meta,{createClient});const [scenarios,shared]=await Promise.all([client.rpc('poc_load_scenarios'),client.rpc('poc_load_characters')]);if(scenarios.error)throw scenarios.error;if(shared.error)throw shared.error;const actors=parseCharacters(shared.data),next=buildEncounterPool({scenarios:parseRemoteScenarios(scenarios.data),characters:actors,decks:loaded.decks,cards:loaded.cards});source=next.pool;characters=actors;cards=loaded.cards;sourceLabel=`온라인 저장 AI 배틀${next.issues.length?` · 자료 확인 필요 ${next.issues.length}개`:''}`;}
 renderAll();message(`${sourceLabel} ${source.length}개를 읽었어. 현재 선택한 후보는 유지했어.`);
}
for(const close of document.querySelectorAll('[data-close]'))close.onclick=()=>$(close.dataset.close).close();
$('pool-search164').oninput=$('pool-only164').onchange=renderPool;$('card-search164').oninput=()=>{cardPage=1;renderCards();};$('card-prev164').onclick=()=>{cardPage--;renderCards();};$('card-next164').onclick=()=>{cardPage++;renderCards();};
$('check164').onclick=()=>safe(async()=>{await(await connect()).refresh();persist();});$('load164').onclick=$('remote164').onclick=()=>safe(loadOnline);
$('save164').onclick=()=>safe(async()=>{assertStorage();await(await connect()).save();persist();});$('compared164').onclick=()=>safe(async()=>{assertStorage();await(await connect()).save({compared:true});persist();});
$('export164').onclick=()=>download('campaign164.json',doc);$('import164').onclick=()=>$('file164').click();$('file164').onchange=()=>safe(async()=>{try{const file=$('file164').files[0];if(!file)return;if(file.size>1500000)throw Error('원정 구성 JSON은 1.5MB 이하로 골라줘.');const value=JSON.parse(await file.text()),next=value.kind===CAMPAIGN_LIBRARY_KIND164?cleanCampaignLibrary164(value,cards).document:cleanCampaign164(value,cards);assertStorage();download('campaign-before-import.json',doc);doc=next;persist();renderAll();message('JSON을 편집본으로 읽었어. 온라인 저장은 별도로 눌러줘.');}finally{$('file164').value='';}});
$('raw164').onclick=()=>{if(rawDraft!==null)download('campaign-original-draft.json',rawDraft);};$('reset164').onclick=()=>safe(()=>{if(externalChange)throw Error('다른 창에서 초안이 바뀌었어. 현재 편집본을 내보낸 뒤 새로고침해줘.');if(rawDraft!==null)download('campaign-original-draft.json',rawDraft);draftBlocked=false;storageBlocked=false;doc=copy(defaultDoc);draftBase=null;draftBaseline=null;if(sync){sync.baseVersion=null;sync.baseline=null;sync.online=null;}persist();renderAll();message('원본을 백업하고 기본 구성으로 편집을 시작했어.');});
for(const kind of ['bundled','browser','online'])$(`${kind}-source164`).onclick=()=>safe(()=>loadSource(kind));
$('login164').onclick=()=>safe(async()=>{await connect();const input=$('email164');if(!input.reportValidity()||!input.value.trim())throw Error('편집자 이메일을 입력해줘.');const redirect=new URL('campaign164.html',location.href);redirect.hash=redirect.search='';const {error}=await client.auth.signInWithOtp({email:input.value.trim(),options:{shouldCreateUser:false,emailRedirectTo:redirect.href}});if(error)throw error;$('auth164').textContent='로그인 메일을 보냈어. 메일의 링크로 돌아와줘.';});$('logout164').onclick=()=>safe(async()=>{if(client){const {error}=await client.auth.signOut();if(error)throw error;}});
addEventListener('storage',event=>{if(event.key===CAMPAIGN_DRAFT_KEY164||event.key===null){externalChange=true;message('다른 창에서 초안이 바뀌었어. 이 편집본을 내보낸 뒤 새로고침해줘.');renderSync();}});
async function start(){try{const [catalog,response]=await Promise.all([loadCatalog(),fetch('data/campaign164.json?v=20261018-164',{cache:'no-store'})]);if(!response.ok)throw Error('기본 원정 구성을 읽지 못했어.');cards=catalog.cards;meta=catalog.meta;defaultDoc=cleanCampaign164(await response.json(),cards);doc=copy(defaultDoc);readDraft();await loadSource('bundled');renderAll();try{const linked=await connect();if(!loadedDraft&&!draftBlocked)await linked.loadIntoDraft();else await linked.refresh();persist();renderAll();}catch(error){message(`${campaignError164(error)} 브라우저 편집과 JSON 보관은 계속할 수 있어.`);}}catch(error){message(error.message);}finally{$('main164').inert=false;$('main164').setAttribute('aria-busy','false');}}
start();
