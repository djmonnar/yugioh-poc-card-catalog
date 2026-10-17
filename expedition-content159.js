import {defaultContent159,cleanContent159,cleanLibrary159,registeredEffects159,eligibleContentCard159,DRAFT_KEY159,LEGACY_DRAFT_KEY159,LIBRARY_KIND159,FIELD_OPTIONS159,relicEffectText159,eventEffectText159} from './expedition-content159-core.js?v=20261017-159';
import {ContentCloud159,ContentSync159,contentError159} from './expedition-content159-sync.js?v=20261017-159';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig,DeckCloud} from './supabase-cloud.js?v=20261008-70';
import {CardSettingsCloud,applySettings} from './card-settings.js?v=20261007-49';
import {CardLimitsCloud,applyLimits} from './card-limits.js?v=20261008-limits-labels';
import {CardTagsCloud} from './card-tags.js?v=20261011-tags';
import {createStatFilters} from './card-filters.js?v=20261007-44';
import {fillSubtypeFilter} from './card-subtypes.js?v=20261011-tags';
import {additionIndex} from './card-additions.js?v=20261008-additions';
import {builderCardMatches,builderSearchText,sortBuilderCards} from './ai-deck-filters.js?v=20261012-filters122';

const $=id=>document.getElementById(id),copy=structuredClone,PER_PAGE=24;
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=text;if(cls)node.className=cls;return node;};
const definitions=registeredEffects159(),tiers=['N','R','SR','UR'];
const filters={query:'content-search',tier:'content-tier',type:'content-type',race:'content-race',attribute:'content-attribute',subtype:'content-subtype',mechanic:'content-mechanic',group:'content-group',release:'content-release'};
let document159=defaultContent159(),cards=[],encounters=[],meta={},client=null,tags=null,sync=null,connection=null,canEdit=false,cardSettingsReady=false,authGeneration=0,page=1,pickerTarget='random',migratedDraft=false;
let additions={byIdentity:new Map(),releases:[],latest:null},rawDraft=null,draftBlocked=false,storageBlocked=false,externalChange=false,loadedDraft=false;
let draftBase=null,draftBaseline=null,detailCard=null,toastTimer,lastMessage='';
const selectedTags=new Set();
$('editor-main').inert=true;
const stats=createStatFilters($('content-stat-filters'),()=>{page=1;renderCards();});
function message(value){lastMessage=value;$('content-status').textContent=value;}
function toast(value){$('content-toast').textContent=value;$('content-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('content-toast').hidden=true,4000);}
function download(name,value){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}));const anchor=el('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function summary(value){return `유물 ${value.relics.filter(r=>r.enabled&&r.weight>0).length}종 · 이벤트 ${value.events.filter(r=>r.enabled&&r.weight>0).length}종 · 랜덤 카드 ${value.shop.card_count}장 / 유물 ${value.shop.relic_count}개 · 고정 카드 ${value.shop.fixed_cards.length}종 / 유물 ${value.shop.fixed_relics.length}종` ;}
function validDraft(){try{cleanContent159(document159);return true;}catch{return false;}}
function persist(){
  if(draftBlocked||storageBlocked||externalChange)return false;
  let checked;try{checked=cleanContent159(document159);}catch(error){message(error.message);renderSync();return false;}
  const state=sync?.state();
  try{localStorage.setItem(DRAFT_KEY159,JSON.stringify({schema_version:1,kind:'poc-expedition-content-draft',document:checked,base_version:state?.base_version??draftBase,baseline:state?.baseline??draftBaseline}));renderSync();return true;}
  catch{storageBlocked=true;message('브라우저 저장 공간을 사용할 수 없어. JSON 내보내기로 편집본을 보관해줘.');renderSync();return false;}
}
function readDraft(){
  try{rawDraft=localStorage.getItem(DRAFT_KEY159);if(rawDraft===null){rawDraft=localStorage.getItem(LEGACY_DRAFT_KEY159);migratedDraft=rawDraft!==null;}if(rawDraft===null)return;
    const value=JSON.parse(rawDraft);if(value?.schema_version!==1||value.kind!=='poc-expedition-content-draft'||!(value.base_version===null||Number.isSafeInteger(value.base_version)&&value.base_version>=0))throw new Error('draft');
    document159=cleanContent159(value.document);draftBase=value.base_version;draftBaseline=value.baseline===null?null:cleanLibrary159(value.baseline);
    if(draftBaseline&&draftBaseline.version!==draftBase)throw new Error('draft');loadedDraft=true;
  }catch{draftBlocked=true;$('draft-warning').hidden=false;document159=defaultContent159();}
}
function renderSync(){
  const state=sync?.state(),validation=validDraft();
  $('content-sync').textContent=`${storageBlocked?'브라우저 저장 불가 · ':draftBlocked?'초안 원본 보존 중 · ':externalChange?'다른 창의 초안 변경 확인 필요 · ':migratedDraft?'이전 편집본을 보존해 확장 · ':'브라우저 초안 자동 저장 · '}${summary(document159)}${state?.online?` · 온라인 버전 ${state.online.version}${state.same?' · 온라인과 동일':' · 온라인 미반영 변경 있음'}`:' · 온라인 미확인'}`;
  $('save-content').disabled=!canEdit||!cardSettingsReady||!!state?.busy||!validation||draftBlocked||storageBlocked||externalChange;
  for(const id of ['refresh-content','load-content','load-compared'])$(id).disabled=!!state?.busy;
  $('save-compared').disabled=!canEdit||!cardSettingsReady||!!state?.busy||!state?.conflict||!validation||draftBlocked||storageBlocked||externalChange;
  const show=!!state?.conflict;$('content-conflict').hidden=!show;
  if(show){$('local-summary').textContent=summary(document159);$('online-summary').textContent=`버전 ${state.online.version} · ${summary(state.online.document)}`;$('local-compare').textContent=JSON.stringify(document159,null,2);$('online-compare').textContent=JSON.stringify(state.online.document,null,2);}
  $('content-form').inert=draftBlocked;
}
function changed(){persist();renderSync();renderPoolSummary();renderEffects();}
function inputField(label,value,{type='text',max=100,min=0,onChange}={}){
  const root=el('label',label),input=el(type==='textarea'?'textarea':'input');
  if(type!=='textarea')input.type=type;else input.rows=3;
  input.required=true;
  if(type==='number'){input.min=String(min);input.max=String(max);input.step='1';}else input.maxLength=max;
  input.value=value;input.addEventListener('input',()=>{onChange(type==='number'?(Number.isNaN(input.valueAsNumber)?null:input.valueAsNumber):input.value);changed();});root.append(input);return root;
}
function check(label,value,onChange){const root=el('label',null,'check'),input=el('input');input.type='checkbox';input.checked=value;input.onchange=()=>{onChange(input.checked);changed();};root.append(input,el('span',label));return root;}
function icon(index,id){const node=el('span',null,'relic-icon159');node.setAttribute('aria-hidden','true');node.style.backgroundPosition=`${index%3*50}% ${Math.floor(index/3)*50}%`;if(id&&definitions.relics.findIndex(row=>row.id===id)>=7){const generation=definitions.relics.findIndex(row=>row.id===id)>=14?159:158;node.style.backgroundImage=`url('assets/expedition${generation}/relic-${id}.svg')`;node.style.backgroundSize='contain';node.style.backgroundPosition='center';}return node;}
function selectField(label,value,options,onChange){const root=el('label',label),select=el('select');for(const row of options){const option=el('option',row.name);option.value=row.id;select.append(option);}select.value=value;select.onchange=()=>{onChange(select.value);changed();};root.append(select);return root;}
function paramField(row,key,label,max,min=0){const field=inputField(label,row.params[key],{type:'number',min,max,onChange:value=>row.params[key]=value});field.querySelector('input').dataset.param=key;field.querySelector('input').dataset.owner=row.id;return field;}
function relicParams(row){
  const root=el('div',null,'effect-params'),settings={golden_scarab:['gold','승리 금화 추가',2e9],restoring_ankh:['lp','승리 LP 회복',60000],card_slate:['extra_choices','카드 보상 후보 추가',5],merchant_seal:['discount_percent','상점 할인율 (%)',100],life_fragment:['max_lp','획득 시 최대 LP 추가',60000]};
  if(settings[row.id])root.append(paramField(row,...settings[row.id]));
  else if(row.id==='field_legacy'){
    const choices=el('fieldset',null,'field-choices');choices.append(el('legend','획득 후 선택할 수 있는 시작 필드'));
    for(const field of FIELD_OPTIONS159)choices.append(check(field.name,row.params.fields.includes(field.id),value=>{const selected=new Set(row.params.fields);value?selected.add(field.id):selected.delete(field.id);row.params.fields=FIELD_OPTIONS159.filter(field=>selected.has(field.id)).map(field=>field.id);}));root.append(choices,el('p','플레이어가 유물을 얻은 뒤 하나를 골라 고정해. 허용 후보는 한 가지 이상 남겨줘.','muted'));
  }else if(['draw_scroll','draw_tome','healing_potion','greater_healing_potion'].includes(row.id)){
    root.append(paramField(row,'charges','원정 전체 사용 횟수',10,1));if(Object.hasOwn(row.params,'heal'))root.append(paramField(row,'heal','사용 시 LP 회복량',60000,1));
    else root.append(el('p','한 번 사용할 때 카드 1장을 드로우해.','muted'));
  }else if(row.id==='rare_cache')root.append(paramField(row,'count','획득 시 받을 R 카드 수',10,1));
  else if(row.id==='fusion_cache')root.append(paramField(row,'material_copies','각 정식 소재를 받을 매수',3,1));
  else if(['destruction_scroll','flame_scroll'].includes(row.id)){root.append(paramField(row,'charges','원정 전체 사용 횟수',10,1));if(row.id==='flame_scroll')root.append(paramField(row,'damage','상대에게 주는 효과 피해',60000,1));}
  else if(row.id==='thorn_armor')root.append(paramField(row,'damage','피해를 받았을 때 상대에게 주는 피해',60000));
  else if(row.id==='golden_pot')root.append(paramField(row,'gold','획득 시 원정 금화',2e9));
  else if(row.id==='weak_power')root.append(paramField(row,'atk','몬스터 공격력 증가',9999),paramField(row,'max_level','적용 몬스터 최대 레벨',12,1));
  return root;
}
function eventParams(row){
  const root=el('div',null,'effect-params');
  if(row.id==='race_blessing')root.append(paramField(row,'multiplier','선택 종족 보상 가중치',100,1));
  if(row.id==='challenge_duel'){
    const options=[{id:'',name:'원정에 등록된 상대 중 플레이어가 선택'},...encounters.map(enemy=>({id:enemy.template_id,name:`${enemy.opponent_name} · ${enemy.battle_name}`}))];
    if(row.params.encounter_key&&!options.some(option=>option.id===row.params.encounter_key))options.push({id:row.params.encounter_key,name:`현재 후보 목록에서 찾지 못함 · ${row.params.encounter_key}`});
    root.append(selectField('특별 결투 상대',row.params.encounter_key||'',options,value=>row.params.encounter_key=value||null),el('p','그 원정에 출현하도록 등록된 상대가 있어야 도전을 수락할 수 있어. 없으면 거절하고 지나갈 수 있어.','muted'));
  }
  return root;
}
function renderEffects(){for(const node of document.querySelectorAll('[data-effect-owner]')){const row=(node.dataset.effectKind==='event'?document159.events:document159.relics).find(row=>row.id===node.dataset.effectOwner);try{node.textContent=node.dataset.effectKind==='event'?eventEffectText159(row):relicEffectText159(row);}catch(error){node.textContent=error.message;}}}
function renderDefinitions(){
  $('relic-list').replaceChildren(...document159.relics.map((row,index)=>{
    const box=el('article',null,'definition-card'),head=el('div',null,'definition-head'),text=el('div'),title=el('h3',row.name);box.dataset.relic=row.id;text.append(title,el('small',`유물 ${index+1}`));head.append(icon(index<7?index:8,row.id),text);
    const options=el('div',null,'definition-options');options.append(check('등장 사용',row.enabled,v=>row.enabled=v),check('상점에서 판매',row.shop_enabled,v=>row.shop_enabled=v));
    const numbers=el('div',null,'definition-numbers');numbers.append(selectField('유물 등급',row.rarity,tiers.map(id=>({id,name:id})),value=>row.rarity=value),inputField('출현 가중치',row.weight,{type:'number',max:10000,onChange:v=>row.weight=v}),el('span','판매 가격은 상점의 등급별 가격표 적용','muted'));
    const effect=el('div',null,'effect-summary'),value=el('span');value.dataset.effectOwner=row.id;value.dataset.effectKind='relic';effect.append(el('strong','현재 수치로 적용되는 효과'),value);
    const prose=el('details');prose.append(el('summary','이름·표시 설명 편집'),inputField('유물 이름',row.name,{max:100,onChange:v=>{row.name=v;title.textContent=v;}}),inputField('표시 설명',row.description,{type:'textarea',max:2000,onChange:v=>row.description=v}));
    box.append(head,options,numbers,relicParams(row),effect,prose);return box;
  }));
  $('event-list').replaceChildren(...document159.events.map((row,index)=>{
    const box=el('article',null,'definition-card'),head=el('div',null,'definition-head'),title=el('h3',row.title);box.dataset.event=row.id;head.append(icon(row.id==='card_duplication'?7:8),title);
    const options=el('div',null,'definition-options');options.append(check('이벤트 등장',row.enabled,v=>row.enabled=v));
    const effect=el('div',null,'effect-summary'),value=el('span');value.dataset.effectOwner=row.id;value.dataset.effectKind='event';effect.append(el('strong','등록된 선택 효과'),value);
    const prose=el('details');prose.append(el('summary','이야기·선택 문구 편집'),inputField('이벤트 제목',row.title,{max:100,onChange:v=>{row.title=v;title.textContent=v;}}),inputField('이벤트 이야기',row.description,{type:'textarea',max:4000,onChange:v=>row.description=v}),inputField('선택 문구',row.name,{max:250,onChange:v=>row.name=v}));
    box.append(head,options,inputField('출현 가중치',row.weight,{type:'number',max:10000,onChange:v=>row.weight=v}),eventParams(row),effect,prose);return box;
  }));renderEffects();
}
function renderShop(){
  for(const input of document.querySelectorAll('[data-battle-reward]'))input.value=document159.battle_rewards[input.dataset.battleReward];
  $('relic-price-settings').replaceChildren(...tiers.map(tier=>inputField(`${tier} 유물 가격`,document159.shop.relic_prices[tier],{type:'number',max:2e9,onChange:value=>document159.shop.relic_prices[tier]=value}))); 
  for(const input of $('panel-shop').querySelectorAll('[data-shop]'))input.value=document159.shop[input.dataset.shop];
  for(const input of document.querySelectorAll('[name=pool-mode]'))input.checked=input.value===document159.shop.card_pool_mode;
  $('rarity-settings').replaceChildren(...tiers.map(tier=>{const row=el('div',null,'rarity-row');row.append(el('strong',tier),inputField('출현 가중치',document159.shop.rarity_weights[tier],{type:'number',max:10000,onChange:v=>document159.shop.rarity_weights[tier]=v}),inputField('기본 가격',document159.shop.card_prices[tier],{type:'number',max:2000000000,onChange:v=>document159.shop.card_prices[tier]=v}));return row;}));
  renderFixedRelics();renderPoolSummary();
}
function renderFixedRelics(){const selected=new Set(document159.shop.fixed_relics);$('fixed-relics').replaceChildren(...document159.relics.map(row=>check(`${row.name} · ${row.rarity}${row.enabled&&row.shop_enabled?'':' · 현재 판매 꺼짐'}`,selected.has(row.id),value=>{const next=new Set(document159.shop.fixed_relics);value?next.add(row.id):next.delete(row.id);document159.shop.fixed_relics=document159.relics.filter(row=>next.has(row.id)).map(row=>row.id);})));}
function selectedPool(){return document159.shop[pickerTarget==='fixed'?'fixed_cards':'card_pool'];}
function renderPoolSummary(){
  const pool=document159.shop.card_pool,selected=new Set(pool),available=cards.filter(eligibleContentCard159),usable=available.filter(card=>document159.shop.card_pool_mode==='all'||selected.has(card.identity_key));
  $('pool-summary').textContent=`랜덤 후보 ${usable.length}종 · 상시 판매 카드 ${document159.shop.fixed_cards.length}종 · 상시 유물 ${document159.shop.fixed_relics.length}종${usable.length<document159.shop.card_count?' · 후보가 적으면 있는 만큼 진열돼':''}`;
  const unavailable=['random','fixed'].flatMap(target=>(target==='fixed'?document159.shop.fixed_cards:pool).filter(id=>!available.some(card=>card.identity_key===id)).map(id=>({id,target})));
  $('unavailable-cards').replaceChildren(...unavailable.map(({id,target})=>{const row=el('p',`${cards.find(c=>c.identity_key===id)?.name_ko||'현재 도감에 없는 카드'} · ${target==='fixed'?'상시 상품':'랜덤 후보'} 판매 제외 `),button=el('button','목록에서 빼기');button.type='button';button.onclick=()=>{const key=target==='fixed'?'fixed_cards':'card_pool';document159.shop[key]=document159.shop[key].filter(value=>value!==id);changed();renderCards();};row.append(button);return row;}));
}
function renderAll(){renderDefinitions();renderShop();renderCards();renderSync();}
function fill(id,values){$(id).replaceChildren(el('option','전체'));for(const value of values){const option=el('option',typeof value==='string'?value:value.name);option.value=typeof value==='string'?value:value.id;$(id).append(option);}$(id).options[0].value='';}
function filterOptions(){const regular=cards.filter(c=>!c.special),collator=new Intl.Collator('ko');for(const [id,field] of [['content-type','type'],['content-race','race'],['content-attribute','attribute']])fill(id,[...new Set(regular.map(c=>c[field]).filter(Boolean))].sort(collator.compare));fillSubtypeFilter($('content-subtype'),'');fill('content-mechanic',meta.card_system?.mechanics||[]);fill('content-group',meta.card_system?.groups||[]);fill('content-release',additions.releases.filter(r=>r.count).map(r=>({id:r.id,name:`${r.date} · ${r.name}`})));}
function renderTags(){const root=$('content-tag-filters');root.replaceChildren(...(tags?.state?.categories||[]).map(({name})=>{const label=el('label',null,'check'),input=el('input');input.type='checkbox';input.checked=selectedTags.has(name);input.onchange=()=>{input.checked?selectedTags.add(name):selectedTags.delete(name);page=1;renderCards();};label.append(input,el('span',name));return label;}));}
function renderCards(){
  const selection=new Set(selectedPool()),criteria=Object.fromEntries(Object.entries(filters).map(([key,id])=>[key,$(id).value]));criteria.statConditions=stats.values();criteria.tags=[...selectedTags];
  const found=sortBuilderCards(cards.filter(card=>(eligibleContentCard159(card)||selection.has(card.identity_key))&&(!$('selected-only').checked||selection.has(card.identity_key))&&builderCardMatches(card,criteria,{tagsState:tags?.state,additions})),$('content-sort').value,additions);
  const pages=Math.max(1,Math.ceil(found.length/PER_PAGE));page=Math.min(Math.max(page,1),pages);$('cards-found').textContent=`${pickerTarget==='fixed'?'상시 판매 카드':'랜덤 판매 후보'} · 검색 결과 ${found.length}종 · 다시 누르면 선택 취소`;
  $('content-results').replaceChildren(...found.slice((page-1)*PER_PAGE,page*PER_PAGE).map(card=>{
    const tile=el('article',null,'content-card'+(selection.has(card.identity_key)?' selected':''));tile.dataset.identity=card.identity_key;
    const view=el('button',null,'card-view'),image=el('img');view.type='button';view.setAttribute('aria-label',`${card.name_ko} 카드 능력 보기`);image.src=card.image;image.alt='';image.loading='lazy';
    view.append(image,el('h4',card.name_ko),el('small',[card.type,card.race,card.attribute].filter(Boolean).join(' · ')),el('small',card.level==null?card.subtype||'':`★${card.level} · ${card.atk} / ${card.def}`));view.onclick=()=>showCard(card);
    const button=el('button',selection.has(card.identity_key)?'✓ 선택됨 · 빼기':pickerTarget==='fixed'?'+ 상시 상품 선택':'+ 랜덤 후보 선택','card-toggle');button.type='button';button.setAttribute('aria-pressed',String(selection.has(card.identity_key)));button.onclick=()=>toggleCard(card);
    tile.append(view,el('span',card.rarity,'rarity '+card.rarity),button);if(!eligibleContentCard159(card))tile.append(el('small','현재 판매 제외 카드'));return tile;
  }));$('cards-page').textContent=`${page} / ${pages}`;$('cards-prev').disabled=page<=1;$('cards-next').disabled=page>=pages;
}
function toggleCard(card){
  const root=$('content-results'),tiles=[...root.children],anchor=tiles.find(node=>node.dataset.identity===card.identity_key),top=anchor?.getBoundingClientRect().top,x=scrollX,y=scrollY;
  const keys=new Set(selectedPool());keys.has(card.identity_key)?keys.delete(card.identity_key):keys.add(card.identity_key);document159.shop[pickerTarget==='fixed'?'fixed_cards':'card_pool']=[...keys].sort();
  if(pickerTarget==='random'){document159.shop.card_pool_mode='selected';for(const input of document.querySelectorAll('[name=pool-mode]'))input.checked=input.value==='selected';}
  if($('selected-only').checked)renderCards();else for(const tile of root.children){const chosen=keys.has(tile.dataset.identity),button=tile.querySelector('.card-toggle');tile.classList.toggle('selected',chosen);button.textContent=chosen?'✓ 선택됨 · 빼기':pickerTarget==='fixed'?'+ 상시 상품 선택':'+ 랜덤 후보 선택';button.setAttribute('aria-pressed',String(chosen));}
  changed();if(detailCard?.identity_key===card.identity_key&&$('card-detail').open)detailButton();
  const offset=anchor?.isConnected&&Number.isFinite(top)?anchor.getBoundingClientRect().top-top:0;scrollTo({left:x,top:y+offset,behavior:'instant'});
}
function detailButton(){const chosen=selectedPool().includes(detailCard.identity_key),button=$('detail-toggle');button.textContent=chosen?'선택 목록에서 빼기':pickerTarget==='fixed'?'상시 상품에 추가':'랜덤 후보에 추가';button.disabled=!chosen&&!eligibleContentCard159(detailCard);}
function showCard(card){
  detailCard=card;const layout=el('div',null,'detail-layout'),image=el('img'),info=el('div');image.src=card.image;image.alt=card.name_ko;
  const title=el('h2',card.name_ko);title.id='detail-title';const button=el('button',null,'primary');button.type='button';button.id='detail-toggle';button.onclick=()=>toggleCard(card);
  info.append(el('span',card.rarity,'rarity '+card.rarity),title,el('p',card.name_en,'muted'),el('p',[card.type,card.subtype,card.race,card.attribute,card.level==null?'':`★${card.level}`,card.atk==null?'':`ATK ${card.atk} / DEF ${card.def}`].filter(Boolean).join(' · '),'muted'),el('div',card.description_ko,'description'),button);
  layout.append(image,info);$('detail-body').replaceChildren(layout);detailButton();if(!$('card-detail').open)$('card-detail').showModal();
}
async function auth(session){const generation=++authGeneration;let allowed=false;try{allowed=!!session&&await new DeckCloud(client).editor();}catch{}if(generation!==authGeneration)return;canEdit=allowed;$('auth-status').textContent=allowed?'로그인됨 · 원정 콘텐츠 편집 가능':session?'로그인됨 · 이 계정에는 편집 권한이 없어.':'브라우저 편집 가능 · 온라인 저장은 편집자 이메일로 로그인해줘.';renderSync();}
async function connect({refresh=false}={}){
  if(connection)return connection;if(sync&&cardSettingsReady&&!refresh)return sync;
  connection=(async()=>{
    if(!client){
      const response=await fetch('data/cloud-config.json',{cache:'no-store'});if(!response.ok)throw new Error('온라인 연결 설정을 읽지 못했어.');const config=validateCloudConfig(await response.json());
      client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(10000)})}});
      client.auth.onAuthStateChange((_event,session)=>setTimeout(()=>auth(session),0));
    }
    if(!sync)sync=new ContentSync159({cloud:new ContentCloud159(client),getDocument:()=>document159,replaceDocument:value=>{document159=value;renderAll();},baseVersion:draftBase,baseline:draftBaseline,cards:()=>cards,changed:state=>{message(state.message);renderSync();if(validDraft())persist();}});
    const session=await client.auth.getSession();if(session.error)throw session.error;await auth(session.data.session);
    tags=new CardTagsCloud(client);
    const loaded=await Promise.allSettled([new CardSettingsCloud(client).load().then(settings=>applySettings(cards,settings)),new CardLimitsCloud(client).load().then(limits=>applyLimits(cards,limits)),tags.load()]);
    cardSettingsReady=loaded.slice(0,2).every(r=>r.status==='fulfilled');
    renderTags();renderCards();renderPoolSummary();renderSync();if(loaded.some(r=>r.status==='rejected'))$('tag-status').textContent='일부 온라인 카드 설정·태그를 읽지 못했어. 현재 선택은 유지돼. 위의 온라인 버전 확인을 눌러 다시 연결해줘.';
    else $('tag-status').textContent='태그는 검색창으로도 찾을 수 있어. 여러 태그를 고르면 모두 포함한 카드를 찾아.';
    return sync;
  })();try{return await connection;}finally{connection=null;}
}
async function safe(callback){try{await callback();}catch(error){message(contentError159(error));renderSync();}}
function assertStorage(){if(draftBlocked||storageBlocked||externalChange)throw new Error('초안 원본을 보관하고 브라우저 저장 상태를 먼저 확인해줘.');}
$('content-form').onsubmit=event=>event.preventDefault();
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{for(const name of ['relics','events','shop']){$(`panel-${name}`).hidden=name!==button.dataset.tab;$(`tab-${name}`).setAttribute('aria-selected',String(name===button.dataset.tab));}if(button.dataset.tab==='shop')renderFixedRelics();};
for(const button of document.querySelectorAll('[data-card-target]'))button.onclick=()=>{pickerTarget=button.dataset.cardTarget;for(const target of document.querySelectorAll('[data-card-target]'))target.setAttribute('aria-pressed',String(target===button));page=1;renderCards();};
for(const input of document.querySelectorAll('[data-battle-reward]'))input.oninput=()=>{document159.battle_rewards[input.dataset.battleReward]=Number.isNaN(input.valueAsNumber)?null:input.valueAsNumber;changed();};
for(const input of document.querySelectorAll('[data-shop]'))input.oninput=()=>{document159.shop[input.dataset.shop]=Number.isNaN(input.valueAsNumber)?null:input.valueAsNumber;changed();};
for(const input of document.querySelectorAll('[name=pool-mode]'))input.onchange=()=>{document159.shop.card_pool_mode=input.value;changed();};
for(const [key,id] of Object.entries(filters))$(id).addEventListener(key==='query'?'input':'change',()=>{if(key==='type')fillSubtypeFilter($('content-subtype'),$(id).value);page=1;renderCards();});
for(const id of ['content-sort','selected-only'])$(id).onchange=()=>{page=1;renderCards();};
$('reset-filters').onclick=()=>{for(const id of Object.values(filters))$(id).value='';fillSubtypeFilter($('content-subtype'),'');selectedTags.clear();renderTags();stats.reset();$('selected-only').checked=false;$('content-sort').value='name';page=1;renderCards();};
$('cards-prev').onclick=()=>{page--;renderCards();};$('cards-next').onclick=()=>{page++;renderCards();};
$('close-detail').onclick=()=>$('card-detail').close();$('card-detail').onclose=()=>detailCard=null;
$('refresh-content').onclick=()=>safe(async()=>{await(await connect({refresh:true})).refresh();});
async function loadOnline(){assertStorage();download('expedition-content-before-load.json',document159);await(await connect()).loadIntoDraft();renderAll();persist();}
$('load-content').onclick=$('load-compared').onclick=()=>safe(loadOnline);
async function saveOnline(compared=false){assertStorage();cleanContent159(document159,cards);const connection=await connect();if(!cardSettingsReady)throw new Error('현재 카드 판매 설정을 확인하지 못했어. 온라인 버전 확인을 눌러 다시 연결해줘.');await connection.save({compared});persist();}
$('save-content').onclick=()=>safe(()=>saveOnline());$('save-compared').onclick=()=>safe(()=>saveOnline(true));
$('export-content').onclick=()=>safe(()=>download('expedition-content.json',document159));
$('import-content').onclick=()=>$('content-file').click();$('content-file').onchange=()=>safe(async()=>{const file=$('content-file').files[0];try{if(!file)return;if(file.size>600000)throw new Error('원정 설정 JSON은 600KB 이하로 골라줘.');const value=JSON.parse(await file.text()),doc=value?.kind===LIBRARY_KIND159?cleanLibrary159(value).document:cleanContent159(value);assertStorage();download('expedition-content-before-import.json',document159);document159=copy(doc);renderAll();persist();message('JSON 편집본을 불러왔어. 온라인 저장은 별도로 눌러줘.');}finally{$('content-file').value='';}});
$('export-raw').onclick=()=>{if(rawDraft!==null)download('expedition-content-original-draft.json',rawDraft);};$('reset-draft').onclick=()=>{if(rawDraft!==null)download('expedition-content-original-draft.json',rawDraft);draftBlocked=false;rawDraft=null;document159=defaultContent159();draftBase=null;draftBaseline=null;$('draft-warning').hidden=true;renderAll();persist();message('기존 초안을 백업하고 기본 설정으로 새 편집을 시작했어.');};
$('send-login').onclick=()=>safe(async()=>{const button=$('send-login');button.disabled=true;try{await connect();if(!$('content-email').reportValidity())throw new Error('편집자 이메일을 입력해줘.');const redirect=new URL('expedition-content159.html',location.href);redirect.search=redirect.hash='';const response=await client.auth.signInWithOtp({email:$('content-email').value.trim(),options:{shouldCreateUser:false,emailRedirectTo:redirect.href}});if(response.error)throw response.error;$('auth-status').textContent='로그인 메일을 보냈어. 메일의 링크로 돌아와줘.';}finally{button.disabled=false;}});
$('signout').onclick=()=>safe(async()=>{if(client){const result=await client.auth.signOut();if(result.error)throw result.error;}});
addEventListener('storage',event=>{if(event.key===DRAFT_KEY159||event.key===null){externalChange=true;message('다른 창에서 브라우저 초안이 바뀌었어. 이 편집본을 JSON으로 보관한 뒤 페이지를 다시 열어줘.');renderSync();}});
async function start(){
  try{
    const response=await fetch('data/cards.json',{cache:'no-store'});if(!response.ok)throw new Error('카드 도감을 읽지 못했어.');const catalog=await response.json();if(!Array.isArray(catalog.cards))throw new Error('카드 자료가 잘못됐어.');cards=catalog.cards;meta=catalog.meta||{};for(const card of cards)card.searchText=builderSearchText(card);
    try{additions=additionIndex(cards,await fetch('data/card-additions.json',{cache:'no-store'}).then(r=>r.json()));}catch{}
    try{const data=await fetch('data/roguelite-opponents.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('opponents');return r.json();});if(!Array.isArray(data.pool))throw new Error('opponents');encounters=data.pool.filter(row=>typeof row?.template_id==='string'&&typeof row.opponent_name==='string'&&typeof row.battle_name==='string');}catch{encounters=[];}
    readDraft();filterOptions();renderAll();
    try{const connected=await connect();if(!loadedDraft&&!draftBlocked)await connected.loadIntoDraft();else await connected.refresh();renderAll();persist();}
    catch(error){message(`${contentError159(error)} 브라우저 편집과 JSON 보관은 계속할 수 있어.`);}
  }catch(error){message(error.message);renderDefinitions();renderShop();renderSync();}
  finally{$('editor-main').inert=false;$('editor-main').setAttribute('aria-busy','false');if(!lastMessage)message('원정 설정 편집 준비 완료.');}
}
start();
