import {CardSettingsCloud,applySettings} from './card-settings.js?v=20261007-49';
import {CardLimitsCloud,applyLimits} from './card-limits.js?v=20261008-61';
import {STORY_KEY,SKILLS,parseSkills,parsePreset,emptyStory,newActor,newBattle,parseStory,canonicalStory,validateStory,cardRef,reviewFiles,safePortrait} from './story-core.js?v=20261010-raid90';
import {NUMERIC_SKILLS,skillSets,copyProfile,removeProfile,profilePacket} from './story-skills.js?v=20261009-73';
import {LIBRARY_KEY,scenarioKey,copyBattle,createScenario,readLibrary,parseRemoteScenarios,actorTemplates,importActor} from './story-library.js?v=20261010-raid90';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {MEDIA_EVENTS,defaultPresentation,parsePresentation,safeMedia,validateAudioFile} from './story-media.js?v=20261009-media88';
import {validateCloudConfig,cloudError} from './supabase-cloud.js?v=20261008-70';
import {mergeAIAssets} from './ai-assets.js?v=20261008-70';
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let doc=emptyStory(),cards=[],decks=[],meta,chooseCard,pickerPage=0,pickerSelection=null,filter=()=>true,client,version=null,editor=false,storageBlocked=false;
let library=readLibrary(null),remoteScenarios=[],libraryReady=false,libraryAPI=false;
let installed=[];
let openedActors=new WeakSet(),openedBattles=new WeakSet();
const openedMedia=new WeakSet(),openedMediaEvents=new WeakMap();
async function refreshDecks(){
  try{if(!client)throw new Error('온라인 연결을 확인해줘.');const reply=await client.rpc('poc_load_ai_decks');if(reply.error)throw reply.error;
    decks=await mergeAIAssets(installed,reply.data,cards,meta);renderBattles();check();status('AI 덱 목록을 갱신했어. 저장한 이름으로 고를 수 있어.');
  }catch(e){status(e.message||cloudError(e));}
}
function deckControls(b){
  const box=node('div');box.append(select('AI 덱',b.recipe,[['','덱 선택'],...decks.filter(d=>d.ruleset===b.ruleset).map(d=>[d.source_recipe.filename,d.name])],v=>b.recipe=v));
  const tools=node('div');tools.className='row-actions ai-deck-tools';
  const link=(text,url)=>{const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener';return a;};
  tools.append(link('+ 새 AI 덱',`ai-decks.html?new=1&mode=${b.ruleset}`));
  if(b.recipe)tools.append(link('이 덱 이름·카드 편집',`ai-decks.html?recipe=${encodeURIComponent(b.recipe)}`));
  tools.append(button('AI 덱 목록 새로고침',refreshDecks));box.append(tools);return box;
}
async function fetchScenarios(){
  const reply=await client.rpc('poc_load_scenarios');libraryAPI=!reply.error;
  if(!reply.error)return parseRemoteScenarios(reply.data);
  if(reply.error.code!=='PGRST202')throw reply.error;
  const legacy=await client.rpc('poc_load_story');if(legacy.error)throw legacy.error;
  return legacy.data?parseRemoteScenarios([{...legacy.data,id:'main'}]):[];
}
const entry=()=>library.entries.find(e=>e.id===library.active);
function characterImports(){
  const sources=[];const ids=new Set([...library.entries.map(e=>e.id),...remoteScenarios.map(e=>e.id)]);
  for(const id of ids){if(id===library.active)continue;
    try{const saved=localStorage.getItem(scenarioKey(id)),online=remoteScenarios.find(s=>s.id===id);
      if(saved||online)sources.push({id,document:saved?parseStory(JSON.parse(saved)):online.document});
    }catch{/* Keep unreadable drafts intact; they are not imported. */}
  }
  return actorTemplates(sources,doc);
}
function renderCharacterImports(){
  const choices=characterImports(),select=$('import-actor-select');select.replaceChildren();
  for(const t of choices){const option=node('option',`${t.actor.name} · ${t.source}`);option.value=t.key;select.append(option);}
  $('import-actor-confirm').disabled=!choices.length||doc.actors.length>=100;
  $('import-actor-note').textContent=choices.length?'이름·초상화·기본 특성·난이도별 특성을 복사해. 가져온 캐릭터는 이 시나리오에서 따로 편집할 수 있어.':'가져올 새 캐릭터가 없어. 다른 시나리오의 캐릭터 편집본이나 온라인 저장본을 확인해줘.';
}
function storeLibrary(){localStorage.setItem(LIBRARY_KEY,JSON.stringify({schema:1,...library}));}
function renderScenarios(){const select=$('scenario-select');select.replaceChildren(...library.entries.map(e=>{const o=node('option',e.title||'이름 없는 시나리오');o.value=e.id;return o;}));select.value=library.active;$('new-scenario').disabled=library.entries.length>=20;}
function switchScenario(id){
  if(id===library.active)return;persist();
  try{const saved=localStorage.getItem(scenarioKey(id)),online=remoteScenarios.find(s=>s.id===id);const next=saved?parseStory(JSON.parse(saved)):online?parseStory(online.document):emptyStory();
    library.active=id;doc=next;version=entry().version;storageBlocked=false;$('story-title').value=doc.title;renderScenarios();render();persist();
  }catch(e){status(e.message+' 이전 편집본은 유지돼.');renderScenarios();}
}
const status=msg=>{$('status').textContent=msg;};
function download(name,content){const url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'})),a=node('a');a.download=name;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function check(){const result=validateStory(doc,cards,decks),box=$('validation');box.replaceChildren();box.className=result.issues.length?'story-warning':'story-ok';box.append(node('b',result.issues.length?'확인할 항목':'시나리오 자료 준비 완료'));for(const message of result.issues)box.append(node('p',message));if(!result.issues.length)box.append(node('p',doc.battles.some(b=>b.raid)?'온라인 저장 후 다음 게임 실행의 레이드 전투 메뉴에서 선택할 수 있어. 일반 전투는 스토리 모드에서 선택해.':'온라인 저장 후 다음 게임 실행의 스토리 모드에서 선택할 수 있어.'));}
function persist(){
  if(storageBlocked){status('기존 문서를 보존하고 있어. 현재 편집본은 JSON으로 내려받아줘.');check();return;}
  try{parseStory(doc);}catch(e){status(e.message+' 이전 저장본은 유지돼.');check();return;}
  try{doc.catalog_dataset_id=meta.dataset_id;localStorage.setItem(scenarioKey(library.active),JSON.stringify(doc));entry().title=doc.title;entry().version=version;storeLibrary();renderScenarios();status('이 시나리오 편집본을 브라우저에 저장했어. 게임 반영은 온라인 저장을 눌러줘.');}catch{status('브라우저 저장에 실패했어. JSON으로 내려받아줘.');}check();
}
function redraw(){const y=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));persist();}
function button(text,action,cls){const b=node('button',text);b.type='button';if(cls)b.className=cls;b.addEventListener('click',action);return b;}
function input(label,value,changed,{type='text',max=6000}={}){const l=node('label',label),i=node(type==='textarea'?'textarea':'input');if(type!=='textarea')i.type=type;i.value=value;i.maxLength=max;i.addEventListener('input',()=>{changed(type==='number'?Number(i.value):i.value);persist();});l.append(i);return l;}
function select(label,value,rows,changed){const l=node('label',label),s=node('select');for(const [key,text] of rows){const o=node('option',text);o.value=key;s.append(o);}s.value=value;s.addEventListener('change',()=>{changed(s.value);redraw();});l.append(s);return l;}
function picker(accept,purpose,done,selection=null){filter=accept;chooseCard=done;pickerSelection=selection;pickerPage=0;$('card-search').value='';$('picker-purpose').textContent=purpose;renderPicker();$('card-picker').showModal();$('card-search').focus();}
function renderPicker(){
  const query=$('card-search').value.trim().toLowerCase(),found=cards.filter(c=>filter(c)&&[c.name_ko,c.name_en,c.description_ko,c.race].join(' ').toLowerCase().includes(query)),pages=Math.max(1,Math.ceil(found.length/12));pickerPage=Math.min(pickerPage,pages-1);
  const box=$('picker-results');box.replaceChildren();
  for(const c of found.slice(pickerPage*12,(pickerPage+1)*12)){
    const selected=pickerSelection?.selected(c)===true,full=pickerSelection&&pickerSelection.count()>=(pickerSelection.limit||100);
    const b=button('',()=>{
      if(pickerSelection&&(pickerSelection.selected(c)||pickerSelection.count()>=(pickerSelection.limit||100)))return;
      const dialog=$('card-picker'),scroll=dialog.scrollTop;chooseCard(cardRef(c));
      if(pickerSelection){redraw();renderPicker();dialog.scrollTop=scroll;const next=Array.from($('picker-results').children).find(el=>!el.disabled);(next||$('finish-picker')).focus({preventScroll:true});}
      else{dialog.close();redraw();}
    },'picker-card'),img=node('img'),label=node('span',c.name_ko);
    b.disabled=selected||Boolean(full);b.classList.toggle('is-selected',selected);b.dataset.cardSlot=c.slot;
    img.src=c.image;img.alt='';img.loading='lazy';label.append(node('small',`${c.rarity} · ${c.type} · ${c.race||c.subtype||''}`));
    if(selected){const badge=node('small','✓ 추가됨');badge.className='picker-selected';label.append(badge);}
    b.append(img,label);box.append(b);
  }
  $('picker-page').textContent=`${pickerPage+1} / ${pages} · ${found.length}장`;$('prev-cards').disabled=pickerPage===0;$('next-cards').disabled=pickerPage+1===pages;
  $('finish-picker').hidden=!pickerSelection;$('picker-selection').hidden=!pickerSelection;
  $('picker-selection').textContent=pickerSelection?`${pickerSelection.label||'후보'} ${pickerSelection.count()} / ${pickerSelection.limit||100}장 · ${pickerSelection.count()>=(pickerSelection.limit||100)?'모두 채웠어.':'여러 장을 계속 골라줘.'}`:'';
}
function poolPicker(reward,onCreate){
  let pool=reward;
  picker(c=>!c.special&&(c.reward_eligible||c.rarity==='L'),'랜덤 보상 후보 카드 · 선택 완료를 누르면 닫혀',card=>{
    if(!pool){pool={kind:'card_pool',count:1,entries:[]};onCreate(pool);}
    pool.entries.push({card,weight:1});
  },{selected:c=>pool?.entries.some(e=>e.card.slot===c.slot)===true,count:()=>pool?.entries.length||0});
}
function poolReward(r,remove){
  const box=node('div');box.className='pool-reward';
  const head=node('div');head.className='reward-row';head.append(node('b','지정 카드 랜덤'),button('보상 삭제',remove,'remove-button'));box.append(head);
  const count=input('받을 장수 · 매번 독립 추첨',r.count,v=>r.count=v,{type:'number'});count.lastChild.min=1;count.lastChild.max=3;box.append(count);
  const percentages=[];
  const update=()=>{const total=r.entries.reduce((n,e)=>n+e.weight,0),valid=r.entries.every(e=>Number.isInteger(e.weight)&&e.weight>=1&&e.weight<=10000);percentages.forEach((el,i)=>el.textContent=valid?`${(100*r.entries[i].weight/total).toFixed(1)}%`:'비중 확인');};
  for(const e of r.entries){
    const row=node('div');row.className='pool-candidate';const c=resolveRewardCard(e.card),img=node('img');img.src=c?.image||'';img.alt='';img.loading='lazy';
    const label=node('span',e.card.name_ko),percent=node('span');percent.className='pool-percent';percentages.push(percent);
    const weight=input('비중',e.weight,v=>{e.weight=v;update();},{type:'number'});weight.lastChild.min=1;weight.lastChild.max=10000;
    row.append(img,label,weight,percent,button('후보 삭제',()=>{r.entries=r.entries.filter(x=>x!==e);if(!r.entries.length)remove();else redraw();},'remove-button'));box.append(row);
  }
  update();box.append(node('small','비중 3 : 1이면 75% : 25%. 여러 장을 뽑으면 같은 카드가 다시 나올 수 있어. 보유 한도에 찬 후보는 제외하고 다시 계산해.'));
  const add=button('+ 후보 카드',()=>poolPicker(r));add.disabled=r.entries.length>=100;box.append(add);return box;
}
function resolveRewardCard(ref){return cards.find(c=>c.slot===ref.slot&&c.internal_id===ref.internal_id);}
function rewards(b,kind,title){const box=node('div');box.className='reward-block';box.append(node('h4',title||(kind==='first'?'첫 승리 보상':'이후 승리 보상')));b.rewards[kind].forEach((r,i)=>{const remove=()=>{b.rewards[kind].splice(i,1);redraw();};if(r.kind==='card_pool'){box.append(poolReward(r,remove));return;}const row=node('div');row.className='reward-row';row.append(node('span',r.kind==='gold'?`${r.amount} 골드`:r.kind==='card'?`${r.card.name_ko} ×${r.count}`:`무작위 ${r.rarity==='ANY'?'랜덤 허용 등급':r.rarity} 카드 ×${r.count}`));row.append(button('삭제',remove,'remove-button'));box.append(row);});const add=r=>{if(b.rewards[kind].length>=20){status('보상은 종류별 20개까지야.');return;}b.rewards[kind].push(r);redraw();};
  const tools=node('div');tools.className='row-actions';const amount=node('input');amount.type='number';amount.min=1;amount.max=100000;amount.value=50;amount.style.width='100px';amount.setAttribute('aria-label','추가할 골드');tools.append(amount,button('골드 추가',()=>{const n=Number(amount.value);if(!Number.isInteger(n)||n<1||n>100000)return status('골드는 1~100,000 사이로 입력해줘.');add({kind:'gold',amount:n});}),button('카드 검색',()=>picker(c=>!c.special&&(c.reward_eligible||c.rarity==='L'),'보상으로 받을 카드 · 1장',card=>add({kind:'card',card,count:1}))));
  const tier=node('select');tier.setAttribute('aria-label','무작위 보상 등급');for(const v of ['ANY','N','R','SR','UR']){const o=node('option',v==='ANY'?'랜덤 허용 등급':v);o.value=v;tier.append(o);}tools.append(tier,button('무작위 1장',()=>add({kind:'random',rarity:tier.value,count:1})),button('지정 카드 랜덤 추가',()=>{if(b.rewards[kind].length>=20)return status('보상은 종류별 20개까지야.');poolPicker(null,r=>b.rewards[kind].push(r));}));box.append(tools);return box;
}
function raidControls(b){
  const box=node('div'),toggle=node('label'),on=node('input');toggle.className='battle-unlock';on.type='checkbox';on.checked=!!b.raid;
  on.onchange=()=>{if(on.checked){b.raid={max_hp:20000,milestones:[]};b.requires_previous=false;}else delete b.raid;redraw();};
  toggle.append(on,node('span','레이드 전투'));box.append(toggle);
  if(!b.raid)return box;
  box.append(node('p','양쪽 합계 10턴 · 모든 보스 합계 하루 3회 (한국 시간 자정 초기화). 패배·무승부에도 남은 보스 체력으로 이어서 도전해.'));
  box.append(input('보스 최대 체력 · 1~60,000',b.raid.max_hp,v=>b.raid.max_hp=v,{type:'number'}));
  box.append(node('small','진행 중인 보스의 최대 체력은 처치한 뒤 변경할 수 있어. 체력 구간 보상은 한 회차에 한 번만 받아.'));
  b.raid.milestones.forEach((m,i)=>{
    const section=node('details');section.append(node('summary',`${m.hp.toLocaleString()} HP 이하 보상`));
    section.append(input('남은 체력이 이 값 이하가 되면 지급',m.hp,v=>m.hp=v,{type:'number'}),
      rewards(m,'first','첫 회차 · 체력 구간 보상'),rewards(m,'repeat','두 번째 회차부터 · 체력 구간 보상'),
      button('체력 구간 삭제',()=>{b.raid.milestones.splice(i,1);redraw();},'remove-button'));box.append(section);
  });
  const add=button('+ 체력 구간 보상',()=>{b.raid.milestones.push({milestone_id:crypto.randomUUID(),hp:Math.max(1,Math.floor(b.raid.max_hp/2)),rewards:{first:[],repeat:[]}});redraw();});
  add.disabled=b.raid.milestones.length>=10;box.append(add);return box;
}
function renderBattles(){const root=$('battle-list');root.replaceChildren();doc.battles.forEach((b,index)=>{
  const box=node('details');box.className='story-box fold-box battle-box';box.open=openedBattles.has(b);
  const summary=node('summary');summary.className='fold-summary';
  const heading=node('span');heading.className='fold-name';
  const title=node('span',`${index+1}. ${b.name||'이름 없는 전투'}`),actor=doc.actors.find(a=>a.actor_id===b.actor_id);
  heading.append(title,node('small',`${actor?.name||'상대 미선택'} · ${b.ruleset==='classic'?'일반 듀얼':'스피드 듀얼'}${b.raid?` · 레이드 ${b.raid.max_hp.toLocaleString()} HP`:b.requires_previous===false?' · 자유 도전':''}`));
  const fold=node('span');fold.className='fold-label';fold.setAttribute('aria-hidden','true');summary.append(heading,fold);box.append(summary);
  box.addEventListener('toggle',()=>{if(!box.isConnected)return;if(box.open)openedBattles.add(b);else openedBattles.delete(b);});
  const tools=node('div');tools.className='row-actions';for(const [label,step] of [['↑ 위로',-1],['↓ 아래로',1]]){const move=button(label,()=>{[doc.battles[index],doc.battles[index+step]]=[doc.battles[index+step],doc.battles[index]];redraw();});move.disabled=index+step<0||index+step>=doc.battles.length;tools.append(move);}
  tools.append(button('전투 복사',()=>{if(doc.battles.length>=100)return status('전투는 100개까지야.');const copy=copyBattle(b);doc.battles.splice(index+1,0,copy);openedBattles.add(copy);redraw();}),button('전투 삭제',()=>{doc.battles.splice(index,1);redraw();},'remove-button'));
  const gate=node('label');gate.className='battle-unlock';const required=node('input');required.type='checkbox';required.checked=b.requires_previous!==false;required.disabled=!!b.raid;
  required.onchange=()=>{b.requires_previous=required.checked;redraw();};gate.append(required,node('span','이전 전투 클리어 필요'));
  box.append(gate,node('small',index===0?'첫 전투는 항상 바로 도전할 수 있어. 순서를 옮기면 이 설정이 적용돼.':'끄면 이전 전투를 안 깨도 바로 선택해 대전할 수 있어. 온라인 저장하면 게임에 반영돼.'));
  box.append(tools,input('전투 이름',b.name,v=>{b.name=v;title.textContent=`${index+1}. ${v||'이름 없는 전투'}`;},{max:100}));const grid=node('div');grid.className='story-grid';grid.append(select('전투 상대',b.actor_id,[['','상대 선택'],...doc.actors.map(a=>[a.actor_id,a.name])],v=>{b.actor_id=v;b.skill_profile='';}),select('듀얼 규칙',b.ruleset,[['classic','일반 듀얼 · 40~80장'],['duel_links_plan','스피드 듀얼 · 20~30장']],v=>{b.ruleset=v;b.recipe='';}));box.append(grid,deckControls(b));if(actor)box.append(select('이 전투의 특성 · 난이도',b.skill_profile||'',skillSets(actor).map(p=>[p.profile_id,p.name]),v=>b.skill_profile=v));box.append(input('전투 진입 대사',b.intro,v=>b.intro=v,{type:'textarea'}));const details=node('details');details.append(node('summary','승리·패배 대사'),input('승리 대사',b.win,v=>b.win=v,{type:'textarea'}),input('패배 대사',b.loss,v=>b.loss=v,{type:'textarea'}));box.append(details,raidControls(b),rewards(b,'first',b.raid?'첫 보스 처치 보상':null),rewards(b,'repeat',b.raid?'두 번째 처치부터 보상':null));root.append(box);
});if(!doc.battles.length)root.append(node('p','전투를 추가해서 시나리오를 시작해줘.'));}
function renderActors(){const root=$('actor-list');root.replaceChildren();doc.actors.forEach(a=>{
  const box=node('details');box.className='story-box fold-box actor-box';box.open=openedActors.has(a);
  const summary=node('summary');summary.className='fold-summary';
  if(a.portrait){const img=node('img');img.src=a.portrait;img.alt='';summary.append(img);}
  const title=node('span',a.name||'이름 없는 캐릭터');title.className='fold-name';
  const fold=node('span');fold.className='fold-label';fold.setAttribute('aria-hidden','true');
  summary.append(title,fold);box.append(summary);
  box.addEventListener('toggle',()=>{if(!box.isConnected)return;if(box.open)openedActors.add(a);else openedActors.delete(a);});
  const head=node('div');head.className='actor-head';head.append(input('캐릭터 이름',a.name,v=>{a.name=v;title.textContent=v||'이름 없는 캐릭터';},{max:100}));box.append(head);
  const portrait=input('초상화 주소',a.portrait,v=>{if(safePortrait(v))a.portrait=v;else status('프로젝트 이미지나 상점 이미지 보관소 주소를 사용해줘.');},{max:1000});box.append(portrait);const file=node('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.setAttribute('aria-label','캐릭터 초상화 업로드');file.addEventListener('change',async()=>{const image=file.files[0];if(!image)return;try{if(!client||!editor)throw new Error('초상화 업로드는 이메일로 로그인한 뒤 사용해줘.');if(image.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(image.type))throw new Error('PNG·JPEG·WebP, 3MB 이하 이미지를 골라줘.');const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image.type],path=`portraits/${crypto.randomUUID()}.${ext}`,{error}=await client.storage.from('poc-story-assets').upload(path,image,{contentType:image.type,upsert:false});if(error)throw error;a.portrait=client.storage.from('poc-story-assets').getPublicUrl(path).data.publicUrl;redraw();}catch(e){status(e.message);}});box.append(file,node('p','스킬은 전투 시작 조건·사용 횟수를 설정하는 제작 자료야. 온라인 저장 후 다음 게임 실행부터 상대 캐릭터에 적용돼.'));
  renderMedia(a,box);renderProfiles(a,box);box.append(button('캐릭터 삭제',()=>{doc.actors=doc.actors.filter(x=>x!==a);redraw();},'remove-button'));root.append(box);});}
function renderMedia(a,box){
  const panel=node('details');panel.className='media-settings';panel.open=openedMedia.has(a);panel.addEventListener('toggle',()=>{if(panel.isConnected){if(panel.open)openedMedia.add(a);else openedMedia.delete(a);}});panel.append(node('summary','캐릭터 컷신 · 음성'));
  const value=()=>a.presentation||defaultPresentation(a);
  const set=(change)=>{const v=structuredClone(value());change(v);a.presentation=parsePresentation(v);redraw();};
  const toggle=(label,key)=>{const l=node('label'),c=node('input');c.type='checkbox';c.checked=value()[key];c.onchange=()=>set(v=>v[key]=c.checked);l.append(c,node('span',label));return l;};
  panel.append(toggle('이 캐릭터의 외부 컷신·음성 사용','enabled'),toggle('상황별 이미지가 없으면 초상화 사용','portrait'),node('p','유희·카이바·조이 외에는 기존 초상화를 기본 컷인으로 사용해. 한 장의 이미지에 게임의 기존 움직임을 적용하고, 상황별 파일을 올리면 그 파일로 바뀌어. 유희·카이바·조이는 지정하지 않은 음성을 원본으로 유지하고, 다른 캐릭터는 등록한 음성만 재생해. PNG·JPEG·WebP는 3MB, 음성은 12초 이하 PCM WAV로 올려줘.'));
  const rowFor=key=>value().events[key]||{image:'',audio:''};
  const change=(key,kind,url)=>{if(!safeMedia(url,kind))return status('프로젝트 에셋이나 이 도감의 이미지·음성 보관소 주소를 사용해줘.');set(v=>{v.events[key]={...rowFor(key),[kind]:url};});};
  const upload=(event,kind)=>{const file=node('input');file.type='file';file.accept=kind==='audio'?'.wav,audio/wav,audio/x-wav':'image/png,image/jpeg,image/webp';file.setAttribute('aria-label',`${MEDIA_EVENTS[event]} ${kind==='audio'?'음성':'이미지'} 업로드`);file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(!client||!editor)throw new Error('에셋 업로드는 이메일 로그인 후 사용해줘.');let ext,mime;if(kind==='audio'){await validateAudioFile(f);ext='wav';mime='audio/wav';}else{if(f.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(f.type))throw new Error('PNG·JPEG·WebP, 3MB 이하 이미지를 골라줘.');ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[f.type];mime=f.type;}const path=`media/${crypto.randomUUID()}.${ext}`,reply=await client.storage.from('poc-story-assets').upload(path,f,{contentType:mime,upsert:false});if(reply.error)throw reply.error;change(event,kind,client.storage.from('poc-story-assets').getPublicUrl(path).data.publicUrl);}catch(e){status(e.message);}finally{file.value='';}};return file;};
  for(const [key,label] of Object.entries(MEDIA_EVENTS)){
    const row=node('details');row.className='media-event';row.open=openedMediaEvents.get(a)?.has(key)||false;row.addEventListener('toggle',()=>{if(!row.isConnected)return;if(!openedMediaEvents.has(a))openedMediaEvents.set(a,new Set());const opened=openedMediaEvents.get(a);if(row.open)opened.add(key);else opened.delete(key);});row.append(node('summary',`${label}${rowFor(key).image?' · 이미지':''}${rowFor(key).audio?' · 음성':''}`));
    for(const [kind,title] of [['image','이미지'],['audio','음성']]){row.append(input(`${label} ${title} 주소`,rowFor(key)[kind],v=>change(key,kind,v),{max:1000}),upload(key,kind));}
    row.append(button(`${label} 미리보기`,()=>{const v=rowFor(key),dialog=node('dialog');dialog.className='media-preview';dialog.setAttribute('aria-label',`${a.name} ${label} 미리보기`);dialog.append(node('h2',`${a.name} · ${label}`));const image=v.image||(value().portrait?a.portrait:'');if(image){const im=node('img');im.src=image;im.alt=`${a.name} ${label} 컷인`;dialog.append(im);}else dialog.append(node('p','등록한 이미지가 없어.'));if(v.audio){const sound=node('audio');sound.src=v.audio;sound.controls=true;sound.preload='metadata';dialog.append(sound);}else dialog.append(node('p','등록한 음성이 없어.'));dialog.append(button('닫기',()=>dialog.close()));dialog.addEventListener('close',()=>{dialog.querySelector('audio')?.pause();dialog.remove();});document.body.append(dialog);dialog.showModal();}));panel.append(row);
  }
  panel.append(button('컷신·음성 JSON 내보내기',()=>download('character-media.json',JSON.stringify({schema_version:1,kind:'poc-character-media',name:a.name,presentation:value()},null,2))));
  const json=node('input');json.type='file';json.accept='.json,application/json';json.setAttribute('aria-label','컷신·음성 JSON 불러오기');json.onchange=async()=>{try{const f=json.files[0];if(!f)return;if(f.size>32000)throw new Error('에셋 설정 JSON은 32KB 이하로 골라줘.');const v=JSON.parse(await f.text());if(v.schema_version!==1||v.kind!=='poc-character-media')throw new Error('컷신·음성 JSON을 골라줘.');a.presentation=parsePresentation(v.presentation);redraw();}catch(e){status(e.message);}finally{json.value='';}};panel.append(json);box.append(panel);
}
function renderSkillSet(profile,box){
  for(const [kind,label] of Object.entries(SKILLS)){
    const row=node('div');row.className='skill-row';const l=node('label'),toggle=node('input');toggle.type='checkbox';toggle.checked=profile.skills.some(s=>s.kind===kind);l.append(toggle,node('span',label));row.append(l);
    const accept=c=>!c.special&&c.type!=='융합 몬스터'&&(kind!=='start_field'||['마법','함정'].includes(c.type))&&(kind!=='start_monster'||c.type.includes('몬스터'));
    const gravePicker=skill=>{let current=skill;picker(accept,'시작 묘지 카드 · 여러 장을 고른 뒤 선택 완료',card=>{if(!current){current={kind,entries:[]};profile.skills.push(current);}current.entries.push({card,count:1});},{selected:c=>current?.entries.some(e=>e.card.slot===c.slot)===true,count:()=>current?.entries.reduce((n,e)=>n+e.count,0)||0,limit:12,label:'묘지 합계'});};
    toggle.onchange=()=>{profile.skills=profile.skills.filter(s=>s.kind!==kind);if(toggle.checked){const bounds=NUMERIC_SKILLS[kind];if(kind==='start_grave')gravePicker();else if(kind==='parasite_deck'){profile.skills.push({kind});redraw();}else if(bounds){profile.skills.push({kind,value:bounds[2],...(kind==='draw_once'?{threshold:2000}:{})});redraw();}else picker(accept,label,card=>profile.skills.push({kind,card,...(kind==='start_monster'?{position:'attack'}:{})}));}else redraw();};
    const skill=profile.skills.find(s=>s.kind===kind);
    if(skill){if(kind==='start_grave'){
        const total=node('small'),updateTotal=()=>{total.textContent=`묘지 합계 ${skill.entries.reduce((n,e)=>n+e.count,0)} / 12장 · 덱 장수는 유지되고 특성으로 별도 추가돼.`;};
        for(const entry of skill.entries){const line=node('div');line.className='reward-row grave-entry';line.append(node('span',entry.card.name_ko));const count=input('묘지에 둘 장수',entry.count,v=>{entry.count=v;updateTotal();check();},{type:'number'});count.lastChild.min=1;count.lastChild.max=12;line.append(count,button('제거',()=>{skill.entries=skill.entries.filter(e=>e!==entry);if(!skill.entries.length)profile.skills=profile.skills.filter(s=>s!==skill);redraw();},'remove-button'));row.append(line);}
        updateTotal();row.append(button('+ 묘지 카드 추가',()=>gravePicker(skill)),total);
      }else if(kind==='parasite_deck')row.append(node('small','상대 덱의 무작위 위치에 앞면 기생충 1장을 넣어. 뽑으면 수비 표시로 특수 소환되고 1,000 데미지와 곤충족 변경 효과가 적용돼.'));
      else if(skill.card)row.append(button(skill.card.name_ko+' · 바꾸기',()=>picker(accept,label,card=>skill.card=card)));else{const bounds=NUMERIC_SKILLS[kind],field=input(bounds[3],skill.value,v=>skill.value=v,{type:'number'});field.lastChild.min=bounds[0];field.lastChild.max=bounds[1];row.append(field);}
      if(kind==='start_monster')row.append(select('시작 몬스터의 표시 형식',skill.position,[['attack','앞면 공격 표시'],['defense','앞면 수비 표시'],['set','뒷면 수비 표시']],v=>skill.position=v));
      if(kind==='draw_once'){const threshold=input('내 LP가 이 값 이하일 때',skill.threshold,v=>skill.threshold=v,{type:'number'});threshold.lastChild.min=100;threshold.lastChild.max=16000;row.append(threshold);}}
    const hints={opening_draw:'기본 시작 패에 덱 위에서 1~3장을 더 뽑아. 지정 카드 추가와 함께 쓸 수 있어.',draw_once:'상대의 메인 페이즈에 조건을 만족하면 한 번만 덱에서 뽑아.',heal_once:'회복량만큼 LP가 줄어든 뒤 상대 메인 페이즈에 한 번 회복해.',add_hand_once:'상대 메인 페이즈에 패가 3장 이하이면 지정 카드를 한 번 받아.',start_field:'필드·지속 마법은 앞면, 다른 마법·함정은 세트 상태로 시작해.'};if(hints[kind])row.append(node('small',hints[kind]));box.append(row);
  }
}
function renderProfiles(a,box){
  const selected=a._editingProfile||'',profiles=skillSets(a),profile=profiles.find(p=>p.profile_id===selected)||profiles[0];
  // The default profile is a view; assign its array back after editing.
  const target=profile.profile_id?profile:a;
  box.append(select('편집할 특성 묶음 · 난이도별로 이름을 붙여줘',profile.profile_id,profiles.map(p=>[p.profile_id,p.name]),v=>{Object.defineProperty(a,'_editingProfile',{value:v,writable:true,configurable:true,enumerable:false});}));
  const tools=node('div');tools.className='row-actions';
  tools.append(button('+ 특성 묶음 추가',()=>{try{const p=copyProfile(a,'새 난이도 특성',target.skills);Object.defineProperty(a,'_editingProfile',{value:p.profile_id,writable:true,configurable:true,enumerable:false});redraw();}catch(e){status(e.message);}}),button('특성 JSON 내보내기',()=>{try{parseSkills(target.skills);download('skill-preset.json',JSON.stringify(profilePacket(a,{name:profile.name,skills:target.skills}),null,2));}catch(e){status(e.message);}}));
  const file=node('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
  file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>100000)throw new Error('특성 JSON은 100KB 이하로 골라줘.');const p=parsePreset(JSON.parse(await f.text()));const clean=canonicalStory({...emptyStory(),actors:[{...newActor('preset-check'),skills:p.skills}]},meta,cards).actors[0].skills;const next=copyProfile(a,p.name,clean);Object.defineProperty(a,'_editingProfile',{value:next.profile_id,writable:true,configurable:true,enumerable:false});redraw();}catch(e){status(e.message);}finally{file.value='';}};
  tools.append(button('특성 JSON 불러오기',()=>file.click()),file);box.append(tools);
  const reuse=node('select');reuse.setAttribute('aria-label','가져올 캐릭터 특성');const sources=doc.actors.flatMap(actor=>skillSets(actor).map(p=>({actor,profile:p})));
  sources.forEach(({actor,profile},i)=>{const o=node('option',`${actor.name} · ${profile.name}`);o.value=i;reuse.append(o);});
  const reuseTools=node('div');reuseTools.className='row-actions';reuseTools.append(reuse,button('선택한 특성 가져오기',()=>{try{const source=sources[Number(reuse.value)];const next=copyProfile(a,source.profile.name,source.profile.skills);Object.defineProperty(a,'_editingProfile',{value:next.profile_id,writable:true,configurable:true,enumerable:false});redraw();}catch(e){status(e.message);}}));box.append(reuseTools);
  if(profile.profile_id)box.append(input('특성 이름 · 예: 초급 / 중급 / 보스',profile.name,v=>profile.name=v,{max:100}),button('이 특성 삭제',()=>{try{removeProfile(doc,a,profile.profile_id);a._editingProfile='';redraw();}catch(e){status(e.message);}},'remove-button'));
  box.append(node('p','전투마다 아래 특성 묶음 중 하나를 선택해. 온라인 저장하면 다른 기기에서도 같은 캐릭터 특성을 불러올 수 있어.'));renderSkillSet(target,box);
}
function render(){renderBattles();renderActors();check();}
async function cloudInit(){
  try{
    const config=validateCloudConfig(await fetch('data/cloud-config.json',{cache:'no-store'}).then(r=>r.json()));
    client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
    await new CardSettingsCloud(client).load().then(rows=>applySettings(cards,rows));
    applyLimits(cards,await new CardLimitsCloud(client).load());
    const [stories,access,recipes]=await Promise.all([fetchScenarios(),client.rpc('poc_editor_status'),client.rpc('poc_load_ai_decks')]);
    remoteScenarios=stories;editor=access.data===true;libraryReady=true;
    for(const s of remoteScenarios){const existing=library.entries.find(e=>e.id===s.id);if(!existing)library.entries.push({id:s.id,title:s.document.title,version:s.version});else if(existing.version===null)existing.version=s.version;}
    version=entry().version??0;entry().version=version;if(!storageBlocked)storeLibrary();
    if(recipes.error)throw recipes.error;decks=await mergeAIAssets(installed,recipes.data,cards,meta);
    renderScenarios();renderBattles();status(storageBlocked?'기존 저장본을 보존하고 있어. JSON을 확인한 뒤 불러와줘.':`온라인 시나리오 ${remoteScenarios.length}개 · ${editor?'이메일 로그인 확인됨':'온라인 저장은 도감에서 이메일 로그인 후 사용해줘'}`);
  }catch{libraryReady=false;status(storageBlocked?'기존 저장본을 읽을 수 없어 보존했어.':'브라우저 편집 가능 · 온라인 시나리오 연결을 확인하지 못했어. 저장할 때 다시 연결할게.');}
}
async function start(){try{const [catalog,opponents,actors]=await Promise.all(['data/cards.json','data/ai-opponents.json','data/ai-actors.json'].map(url=>fetch(url,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('자료를 불러올 수 없어.');return r.json();})));cards=catalog.cards;meta=catalog.meta;installed=opponents.decks;decks=structuredClone(installed);try{library=readLibrary(JSON.parse(localStorage.getItem(LIBRARY_KEY)));}catch{storageBlocked=true;status('기존 시나리오 목록을 보존하고 있어.');}version=entry().version;const saved=localStorage.getItem(scenarioKey(library.active));if(saved){try{doc=parseStory(JSON.parse(saved));}catch{storageBlocked=true;status('기존 저장본을 읽을 수 없어 보존했어. JSON을 내보내기 전에 확인해줘.');}}else{doc.actors=actors.actors.map(a=>({actor_id:a.actor_id,name:a.name,portrait:a.portrait,skills:[]}));const b=newBattle('first-battle');b.name='용만과 첫 결투';b.actor_id=doc.actors[0]?.actor_id||'';b.recipe='DLR_000.ydc';b.intro='공룡의 힘을 보여주마!';b.rewards.first=[{kind:'gold',amount:100},{kind:'random',rarity:'SR',count:1}];b.rewards.repeat=[{kind:'gold',amount:20}];doc.battles.push(b);}doc.catalog_dataset_id=meta.dataset_id;$('story-title').value=doc.title;renderScenarios();render();if(!storageBlocked)persist();await cloudInit();}catch(e){status(e.message);}}
$('story-title').addEventListener('input',()=>{doc.title=$('story-title').value;persist();});$('add-battle').onclick=()=>{if(doc.battles.length<100){const battle=newBattle();doc.battles.push(battle);openedBattles.add(battle);redraw();requestAnimationFrame(()=>$('battle-list').lastElementChild.querySelector('input').focus());}};$('add-actor').onclick=()=>{if(doc.actors.length<100){const actor=newActor();doc.actors.push(actor);openedActors.add(actor);redraw();requestAnimationFrame(()=>$('actor-list').lastElementChild.querySelector('input').focus());}};
$('collapse-actors').onclick=()=>{openedActors=new WeakSet();renderActors();};
$('import-actor').onclick=()=>{renderCharacterImports();$('actor-importer').showModal();};
$('close-actor-importer').onclick=()=>$('actor-importer').close();
$('import-actor-confirm').onclick=()=>{
  const template=characterImports().find(t=>t.key===$('import-actor-select').value);if(!template||doc.actors.length>=100)return;
  const actor=importActor(template);doc.actors.push(actor);openedActors.add(actor);redraw();renderCharacterImports();status(`${actor.name} 캐릭터를 가져왔어. 전투 상대에서 골라준 뒤 온라인 저장해줘.`);
};
$('collapse-battles').onclick=()=>{openedBattles=new WeakSet();renderBattles();};
for(const kind of ['battles','actors'])$(`tab-${kind}`).onclick=()=>{for(const k of ['battles','actors']){$(`${k}-panel`).hidden=k!==kind;$(`tab-${k}`).setAttribute('aria-selected',String(k===kind));}};
$('export').onclick=()=>download('story-source.json',JSON.stringify(doc,null,2)+'\n');$('pack').onclick=async()=>{try{const files=await reviewFiles(doc,meta,cards,decks);download('story-source.json',files.source);download('pack.json',JSON.stringify(files.pack,null,2)+'\n');status('두 JSON 파일을 같은 폴더에 두면 콘텐츠 파이프라인에서 검사할 수 있어.');}catch(e){status(e.message);}};
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async()=>{try{const file=$('import-file').files[0];if(!file)return;if(file.size>1024*1024)throw new Error('스토리 JSON은 1MB 이하로 골라줘.');const next=parseStory(JSON.parse(await file.text()));doc=next;storageBlocked=false;$('story-title').value=doc.title;render();persist();}catch(e){status(e.message);}finally{$('import-file').value='';}};
$('close-picker').onclick=()=>$('card-picker').close();$('finish-picker').onclick=()=>$('card-picker').close();$('card-picker').addEventListener('close',()=>{pickerSelection=null;renderActors();});$('card-search').oninput=()=>{pickerPage=0;renderPicker();};$('prev-cards').onclick=()=>{pickerPage--;renderPicker();};$('next-cards').onclick=()=>{pickerPage++;renderPicker();};
// Sharing the catalogue's email session avoids a second editor account.
const toolbar=$('export').parentNode;
toolbar.append(button('이 시나리오 온라인 저장',async()=>{
  try{
    if(!client||!libraryReady)await cloudInit();if(!libraryReady)throw new Error('온라인 시나리오 연결을 확인해줘.');
    if(!editor)throw new Error('카드 도감에서 이메일로 로그인한 뒤 이 페이지를 다시 열어줘.');
    const value=canonicalStory(doc,meta,cards),issues=validateStory(value,cards,decks).issues;if(issues.length)throw new Error(issues.join(' '));
    if(!libraryAPI)await fetchScenarios();
    if(!libraryAPI&&library.active!=='main')throw new Error('새 시나리오 온라인 저장은 Supabase의 시나리오 추가 SQL 적용 후 사용할 수 있어. 편집본은 브라우저에 보관돼.');
    const {data,error}=libraryAPI?await client.rpc('poc_save_scenario',{p_scenario_id:library.active,p_document:value,p_expected_version:version??0}):await client.rpc('poc_save_story',{p_document:value,p_expected_version:version??0});
    if(error)throw error;version=data.version;entry().version=version;doc=value;
    remoteScenarios=remoteScenarios.filter(s=>s.id!==library.active);remoteScenarios.push(data);persist();
    status(`「${doc.title}」 온라인 저장 완료 · 다음 게임 실행 때 반영돼.`);
  }catch(e){status(e.message?.includes('poc_')?cloudError(e):e.message);}
}),button('이 시나리오 온라인 불러오기',async()=>{
  try{
    if(!client||!libraryReady)await cloudInit();if(!libraryReady)throw new Error('온라인 연결을 확인해줘.');
    remoteScenarios=await fetchScenarios();
    const row=remoteScenarios.find(s=>s.id===library.active);if(!row)return status('이 시나리오는 아직 온라인에 저장하지 않았어.');
    if(!confirm('이 시나리오의 온라인 저장본을 불러올까? 현재 편집본은 JSON으로 백업할게.'))return;
    download('story-before-online-load.json',JSON.stringify(doc,null,2));doc=row.document;version=row.version;storageBlocked=false;
    $('story-title').value=doc.title;render();persist();
  }catch(e){status(cloudError(e));}
}));
$('scenario-select').addEventListener('change',()=>switchScenario($('scenario-select').value));
$('new-scenario').addEventListener('click',()=>{
  if(storageBlocked)return status('기존 저장을 보존 중이야. JSON을 먼저 보관해줘.');
  if(library.entries.length>=20)return status('시나리오는 20개까지 만들 수 있어.');
  persist();const next=createScenario(doc);library.entries.push({id:next.id,title:next.document.title,version:0});library.active=next.id;
  doc=next.document;version=0;$('story-title').value=doc.title;renderScenarios();render();persist();$('story-title').focus();
});
start();
window.addEventListener('focus',()=>{if(client)refreshDecks();});
