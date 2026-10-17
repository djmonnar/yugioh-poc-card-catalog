import {cleanContent157,eligibleContentCard157,defaultContent157,registeredEffects157} from './expedition-content157-core.js?v=20261017-157';

export const CONTENT_KIND158='poc-expedition-content';
export const LIBRARY_KIND158='poc-expedition-content-library';
export const DRAFT_KEY158='yugioh-classic-expedition-content158-draft';
export const LEGACY_DRAFT_KEY158='yugioh-classic-expedition-content157-draft';
export const FIELD_OPTIONS158=Object.freeze([
  {id:'mountain',name:'산',internal_id:331,identity_key:'fc8ef10da68ed4d302c5022da8b288eee84b9141295d46b6702fd41d0b4cbbc5'},
  {id:'sogen',name:'초원',internal_id:332,identity_key:'03cb347f3f65bd9a1295dc97533dd4ee1aba840ea0a98c57026ae0b3aec6b81a'},
  {id:'yami',name:'어둠',internal_id:334,identity_key:'27bf0a25dc6d4ff751576acc2f70ea53b416840321345203ce7623441c791fcf'},
  {id:'umi',name:'바다',internal_id:333,identity_key:'6961a3507f2f54f2a8a88248bd6bc7db81dcf9198375c486d4d48ac12e3c6896'},
  {id:'forest',name:'숲',internal_id:329,identity_key:'f57735d759d84c2f500a6702fd3f356d0d17fb7782646081e1f11c003d1ef969'},
  {id:'wasteland',name:'황야',internal_id:330,identity_key:'19b203f677427148a520f62a3f21f8011cd1d93e3cad83a29c073c154c060690'}
].map(Object.freeze));
const legacy=registeredEffects157();
const RELICS158=[
  ...legacy.relics.map((row,index)=>({...row,rarity:['R','R','SR','R','N','SR','UR'][index],params:[{gold:20},{lp:200},{extra_choices:1},{discount_percent:15},{max_lp:250},{},{}][index]})),
  {id:'field_legacy',name:'태고의 지형',description:'획득한 뒤 허용된 지형 중 하나를 고르면 이후 듀얼을 그 필드 마법과 함께 시작해.',rarity:'SR',params:{fields:FIELD_OPTIONS158.map(row=>row.id)}},
  {id:'draw_scroll',name:'드로우 두루마리',description:'원정 중 원하는 듀얼에서 사용할 수 있는 드로우 1회분.',rarity:'R',params:{charges:1,draw:1}},
  {id:'draw_tome',name:'드로우 마도서',description:'원정 중 원하는 듀얼에서 나누어 사용할 수 있는 드로우 2회분.',rarity:'SR',params:{charges:2,draw:1}},
  {id:'healing_potion',name:'생명의 물약',description:'듀얼 중 LP를 500 회복하는 원정 소모품.',rarity:'N',params:{charges:1,heal:500}},
  {id:'greater_healing_potion',name:'상급 생명의 물약',description:'듀얼 중 LP를 1,000 회복하는 원정 소모품.',rarity:'R',params:{charges:1,heal:1000}},
  {id:'rare_cache',name:'희귀 카드 보급함',description:'획득 즉시 무작위 R 카드 2장을 원정 카드함에 받아.',rarity:'R',params:{count:2,rarity:'R'}},
  {id:'fusion_cache',name:'융합술사의 보급함',description:'융합 마법 1장, 무작위 정식 융합 몬스터 1장과 그 정식 소재를 각각 2장 받아.',rarity:'SR',params:{material_copies:2}}
];
const EVENTS158=[
  ...legacy.events.map(row=>({...row,params:{}})),
  {id:'race_blessing',title:'종족의 수호 문장',description:'오래된 문장이 여러 종족의 모습으로 바뀐다. 앞으로 함께할 몬스터의 종족을 골라보자.',name:'종족을 고르고 이후 몬스터 카드 보상에서 더 자주 만나기',effect:'선택 종족의 몬스터 카드 보상 가중치 상승 · 새 선택으로 이전 선택 교체',params:{multiplier:3}},
  {id:'challenge_duel',title:'선택받은 자의 결투',description:'봉인된 문 너머에서 도전자가 기다린다. 승리하면 특별한 SR 보상을 받지만, 평소 전투 보상은 얻지 못한다.',name:'상대를 골라 특별 결투에 도전',effect:'특별 전투 승리 시 SR 후보 3장 중 1장 · 일반 전투 보상 없음 · 도전 거절 가능',params:{encounter_key:null}},
  {id:'relic_recovery',title:'잊힌 제단의 공양',description:'제단이 네 유물 하나를 요구한다. 그 힘을 돌려주면 지친 생명력을 모두 되찾을 수 있다.',name:'보유 유물 1개를 잃고 LP 전부 회복',effect:'선택 유물 1개 영구 제거 · LP를 최대 LP까지 회복',params:{}},
  {id:'twin_sacrifice',title:'쌍둥이 카드의 제단',description:'제단의 두 홈이 비어 있다. 덱에 담긴 카드 두 장을 바치면 더 강한 가능성을 고를 수 있다.',name:'덱 카드 2장을 바치고 SR 후보 5장 중 1장 선택',effect:'활성 덱 카드 정확히 2매 영구 제거 · SR 후보 5장 중 1장 · 메인 덱 최소 20장 유지',params:{remove_count:2,reward_count:5,rarity:'SR'}}
];
const fail=message=>{throw new Error(message);},copy=structuredClone;
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function exact(value,keys,label){if(!record(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(`${label} 항목을 확인해줘.`);}
function int(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)fail(`${label}은 ${min.toLocaleString('ko')}~${max.toLocaleString('ko')} 사이 정수로 입력해줘.`);return value;}
function bool(value,label){if(typeof value!=='boolean')fail(`${label} 사용 여부를 확인해줘.`);return value;}
function text(value,max,label){if(typeof value!=='string'||value.length>max||!value.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail(`${label}은 비어 있지 않은 ${max}자 이하 문장으로 적어줘.`);return value.normalize('NFC').trim();}
const identity=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const template=value=>typeof value==='string'&&/^[A-Za-z0-9_:-]{1,210}$/.test(value);
export const eligibleContentCard158=eligibleContentCard157;
export function relicParams158(id,params){
  const numbers={golden_scarab:['gold',0,2e9],restoring_ankh:['lp',0,60000],card_slate:['extra_choices',0,5],merchant_seal:['discount_percent',0,100],life_fragment:['max_lp',0,60000]};
  if(numbers[id]){const [key,min,max]=numbers[id];exact(params,[key],'유물 수치');return {[key]:int(params[key],min,max,'유물 수치')};}
  if(['kuriboh_charm','destiny_draw'].includes(id)){exact(params,[],'고정 유물 효과');return {};}
  if(id==='field_legacy'){
    exact(params,['fields'],'시작 필드 후보');
    if(!Array.isArray(params.fields)||!params.fields.length||params.fields.length>FIELD_OPTIONS158.length||new Set(params.fields).size!==params.fields.length||params.fields.some(id=>!FIELD_OPTIONS158.some(field=>field.id===id)))fail('시작 필드 후보는 등록된 지형 중 한 가지 이상 골라줘.');
    return {fields:FIELD_OPTIONS158.filter(field=>params.fields.includes(field.id)).map(field=>field.id)};
  }
  if(['draw_scroll','draw_tome'].includes(id)){exact(params,['charges','draw'],'드로우 소모품');if(params.draw!==1)fail('드로우 소모품은 1회에 카드 1장을 뽑아.');return {charges:int(params.charges,1,10,'원정 전체 사용 횟수'),draw:1};}
  if(['healing_potion','greater_healing_potion'].includes(id)){exact(params,['charges','heal'],'회복 소모품');return {charges:int(params.charges,1,10,'원정 전체 사용 횟수'),heal:int(params.heal,1,60000,'소모품 LP 회복량')};}
  if(id==='rare_cache'){exact(params,['count','rarity'],'희귀 카드 보급');if(params.rarity!=='R')fail('희귀 카드 보급함은 R 카드로 등록되어 있어.');return {count:int(params.count,1,10,'받을 R 카드 수'),rarity:'R'};}
  if(id==='fusion_cache'){exact(params,['material_copies'],'융합 카드 보급');return {material_copies:int(params.material_copies,1,3,'소재별 지급 매수')};}
  fail('등록되지 않은 유물 효과야.');
}
function eventParams(id,params,encounters){
  if(legacy.events.some(row=>row.id===id)||id==='relic_recovery'){exact(params,[],'고정 이벤트 효과');return {};}
  if(id==='race_blessing'){exact(params,['multiplier'],'종족 보상 가중치');return {multiplier:int(params.multiplier,1,100,'선택 종족 보상 가중치')};}
  if(id==='challenge_duel'){
    exact(params,['encounter_key'],'특별 결투 상대');if(params.encounter_key!==null&&!template(params.encounter_key))fail('특별 결투는 등록된 상대를 골라줘.');
    if(encounters!==undefined&&params.encounter_key!==null){if(!Array.isArray(encounters)||!encounters.some(row=>row.template_id===params.encounter_key))fail('특별 결투 상대가 현재 등록 목록에 없어.');}
    return {encounter_key:params.encounter_key};
  }
  if(id==='twin_sacrifice'){exact(params,['remove_count','reward_count','rarity'],'두 카드의 공양');if(params.remove_count!==2||params.reward_count!==5||params.rarity!=='SR')fail('두 카드의 공양은 카드 2매와 SR 후보 5장으로 등록되어 있어.');return {remove_count:2,reward_count:5,rarity:'SR'};}
  fail('등록되지 않은 이벤트 효과야.');
}
function rows(value,definitions,keys,label,clean){
  if(!Array.isArray(value)||value.length!==definitions.length)fail(`${label}은 등록된 ${definitions.length}종을 모두 보관해줘. 숨기려면 사용을 꺼줘.`);
  const by=new Map();for(const row of value){exact(row,keys,label);if(!definitions.some(d=>d.id===row.id)||by.has(row.id))fail(`${label}에 중복되거나 등록되지 않은 종류가 있어.`);by.set(row.id,row);}
  return definitions.map(definition=>clean(by.get(definition.id),definition));
}
export function defaultContent158(){
  const previous=defaultContent157();return {schema_version:2,kind:CONTENT_KIND158,
    relics:RELICS158.map(row=>({...copy(row),enabled:true,shop_enabled:true,weight:1,price:250})),
    events:EVENTS158.map(row=>({...copy(row),enabled:true,weight:1})),
    shop:{...previous.shop,fixed_cards:[],fixed_relics:[],fusion_pair_count:1,ritual_pair_count:1}};
}
export function migrateContent157To158(value,cards){
  const previous=cleanContent157(value,cards),defaults=defaultContent158(),relics=new Map(previous.relics.map(row=>[row.id,row])),events=new Map(previous.events.map(row=>[row.id,row]));
  return {...defaults,relics:defaults.relics.map(row=>relics.has(row.id)?{...row,...relics.get(row.id)}:row),events:defaults.events.map(row=>events.has(row.id)?{...row,...events.get(row.id)}:row),shop:{...defaults.shop,...previous.shop}};
}
export function cleanContent158(value,cards,encounters){
  if(value?.schema_version===1)return cleanContent158(migrateContent157To158(value,cards),cards,encounters);
  exact(value,['schema_version','kind','relics','events','shop'],'원정 설정');if(value.schema_version!==2||value.kind!==CONTENT_KIND158)fail('원정 설정 파일 버전을 확인해줘.');
  if(new TextEncoder().encode(JSON.stringify(value)).length>600000)fail('원정 설정 파일은 600KB 이하로 보관해줘.');
  const relics=rows(value.relics,RELICS158,['id','name','description','enabled','shop_enabled','weight','price','rarity','params'],'유물',(row,definition)=>{
    if(!['N','R','SR','UR'].includes(row.rarity))fail('유물 등급을 N·R·SR·UR 중에서 골라줘.');
    return {id:definition.id,name:text(row.name,100,'유물 이름'),description:text(row.description,2000,'유물 설명'),rarity:row.rarity,params:relicParams158(row.id,row.params),enabled:bool(row.enabled,'유물'),shop_enabled:bool(row.shop_enabled,'상점 유물'),weight:int(row.weight,0,10000,'유물 가중치'),price:int(row.price,0,2e9,'유물 가격')};
  });
  const events=rows(value.events,EVENTS158,['id','title','description','name','effect','enabled','weight','params'],'이벤트',(row,definition)=>{
    if(row.effect!==definition.effect)fail('이벤트의 등록된 효과 문구는 바꿀 수 없어. 효과 수치 항목과 이야기·선택 문구를 편집해줘.');
    return {id:definition.id,title:text(row.title,100,'이벤트 제목'),description:text(row.description,4000,'이벤트 이야기'),name:text(row.name,250,'이벤트 선택 문구'),effect:definition.effect,params:eventParams(row.id,row.params,encounters),enabled:bool(row.enabled,'이벤트'),weight:int(row.weight,0,10000,'이벤트 가중치')};
  });
  const source=value.shop,extra=['fixed_cards','fixed_relics','fusion_pair_count','ritual_pair_count'];
  exact(source,[...Object.keys(defaultContent157().shop),...extra],'원정 상점');
  const legacyShop=Object.fromEntries(Object.entries(source).filter(([key])=>!extra.includes(key))),base=defaultContent157();base.shop=legacyShop;
  const shop=cleanContent157(base,cards).shop;
  if(!Array.isArray(source.fixed_cards)||source.fixed_cards.length>100||source.fixed_cards.some(id=>!identity(id))||new Set(source.fixed_cards).size!==source.fixed_cards.length)fail('상시 판매 카드는 중복 없이 100종까지 골라줘.');
  if(cards!==undefined){if(!Array.isArray(cards)||source.fixed_cards.some(id=>!cards.some(card=>card.identity_key===id&&eligibleContentCard158(card))))fail('상시 판매 카드 중 도감에 없거나 판매할 수 없는 카드가 있어.');}
  if(!Array.isArray(source.fixed_relics)||source.fixed_relics.length>RELICS158.length||new Set(source.fixed_relics).size!==source.fixed_relics.length||source.fixed_relics.some(id=>!RELICS158.some(row=>row.id===id)))fail('상시 판매 유물은 등록된 목록에서 중복 없이 골라줘.');
  if(source.fusion_pair_count!==1||source.ritual_pair_count!==1)fail('상점에는 무작위 융합 세트와 의식 세트를 각각 1개씩 진열해.');
  return {schema_version:2,kind:CONTENT_KIND158,relics,events,shop:{...shop,fixed_cards:[...source.fixed_cards].sort(),fixed_relics:RELICS158.filter(row=>source.fixed_relics.includes(row.id)).map(row=>row.id),fusion_pair_count:1,ritual_pair_count:1}};
}
const canonical=value=>JSON.stringify(value);
export function cleanLibrary158(value,cards,encounters){
  exact(value,['schema','kind','version','document','updated_at'],'온라인 원정 설정');if(value.schema!==1||value.kind!==LIBRARY_KIND158)fail('온라인 원정 설정 형식을 확인해줘.');
  int(value.version,0,Number.MAX_SAFE_INTEGER,'온라인 버전');const document=value.document===null&&value.version===0?cleanContent158(defaultContent158()):cleanContent158(value.document,cards,encounters);
  if(value.version===0){if(value.updated_at!==null||canonical(document)!==canonical(cleanContent158(defaultContent158())))fail('미설정 원정 설정이 기본값과 달라.');}
  else if(typeof value.updated_at!=='string'||!Number.isFinite(Date.parse(value.updated_at)))fail('온라인 원정 설정 저장 시각을 확인해줘.');
  return {schema:1,kind:LIBRARY_KIND158,version:value.version,document,updated_at:value.updated_at};
}
export const normalizeContent158Library=cleanLibrary158;
export const registeredEffects158=()=>({relics:copy(RELICS158),events:copy(EVENTS158)});
export function relicEffectText158(row){
  const p=relicParams158(row.id,row.params);
  const text={golden_scarab:`전투 승리 시 원정 금화 +${p.gold?.toLocaleString('ko')}.`,restoring_ankh:`전투 승리 시 LP ${p.lp?.toLocaleString('ko')} 회복.`,card_slate:`전투 카드 보상 후보 +${p.extra_choices}.`,merchant_seal:`원정 상점 가격 ${p.discount_percent}% 할인.`,life_fragment:`획득 즉시 최대 LP +${p.max_lp?.toLocaleString('ko')}. 현재 LP는 그대로야.`,
    kuriboh_charm:legacy.relics[5].description,destiny_draw:legacy.relics[6].description,
    field_legacy:`${p.fields?.map(id=>FIELD_OPTIONS158.find(row=>row.id===id).name).join('·')} 중 획득 후 하나를 골라 이후 듀얼의 시작 필드로 고정해.`,
    draw_scroll:`듀얼 중 카드 1장 드로우 · 원정 전체 ${p.charges}회 사용.`,draw_tome:`듀얼 중 카드 1장 드로우 · 원정 전체 ${p.charges}회 사용.`,
    healing_potion:`듀얼 중 LP ${p.heal?.toLocaleString('ko')} 회복 · 원정 전체 ${p.charges}회 사용.`,greater_healing_potion:`듀얼 중 LP ${p.heal?.toLocaleString('ko')} 회복 · 원정 전체 ${p.charges}회 사용.`,
    rare_cache:`획득 즉시 무작위 R 카드 ${p.count}장. 원정 카드함에 보관해.`,fusion_cache:`획득 즉시 융합 마법 1장·무작위 융합 몬스터 1장·정식 소재 각각 ${p.material_copies}장. 원정 카드함에 보관해.`};return text[row.id];
}
export function eventEffectText158(row){const definition=EVENTS158.find(d=>d.id===row.id);if(!definition)fail('등록되지 않은 이벤트야.');const p=eventParams(row.id,row.params);return row.id==='race_blessing'?`선택한 종족의 몬스터 카드 보상 가중치 ×${p.multiplier}. 새 종족 선택으로 이전 선택을 바꿔.`:definition.effect;}
