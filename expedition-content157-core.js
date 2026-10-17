// Shared authoring/runtime policy. IDs and implemented effects are registered
// here; editable prose and appearance settings never create executable effects.
export const CONTENT_KIND157='poc-expedition-content';
export const LIBRARY_KIND157='poc-expedition-content-library';
export const DRAFT_KEY157='yugioh-classic-expedition-content157-draft';
const RELICS157=[
  {id:'golden_scarab',name:'황금 풍뎅이',description:'전투 승리 시 원정 금화 +20.'},
  {id:'restoring_ankh',name:'재생의 앙크',description:'전투 승리 시 LP 200 회복.'},
  {id:'card_slate',name:'카드의 석판',description:'전투 카드 보상 후보 +1. 기본 5장에서 6장으로 늘어나.'},
  {id:'merchant_seal',name:'상인의 인장',description:'원정 상점 가격 15% 할인.'},
  {id:'life_fragment',name:'생명의 조각',description:'획득 즉시 최대 LP +250. 현재 LP는 그대로야.'},
  {id:'kuriboh_charm',name:'크리보의 부적',description:'매 듀얼 처음 받는 LP 피해를 한 번 막아. LP를 지불하는 비용에는 적용되지 않아.'},
  {id:'destiny_draw',name:'운명의 패',description:'지정한 메인 덱 카드 1장이 처음 받는 4장 안에 반드시 들어와. 패 매수는 늘어나지 않아.'}
];
const EVENTS157=[
  {id:'healing_pool',title:'수호자의 샘',description:'돌 수호자가 별빛이 담긴 샘을 가리킨다. 작은 공물을 놓으면 상처가 아물 듯하다.',name:'금화 50을 바치고 LP 1,000 회복',effect:'원정 금화 -50 · LP +1,000 (최대 LP까지)'},
  {id:'life_inscription',title:'생명의 비문',description:'빛나는 비문이 맥박에 맞춰 반짝인다. 잠깐의 생명력을 내어주면 생명의 그릇을 넓힐 수 있다.',name:'LP 300을 바치고 최대 LP +500',effect:'현재 LP -300 · 최대 LP +500 (현재 LP 추가 회복 없음)'},
  {id:'golden_idol',title:'황금 우상의 계약',description:'황금 우상이 동전 한 줌을 내민다. 대가를 치를지, 아무것도 받지 않고 지나갈지는 너의 선택이다.',name:'LP 500을 바치고 금화 120 획득',effect:'현재 LP -500 · 원정 금화 +120'},
  {id:'mirror_exchange',title:'가능성의 거울',description:'거울 속 카드의 그림이 천천히 바뀐다. 카드 한 장을 비추면 같은 등급의 다른 가능성과 교환할 수 있다.',name:'보유 카드 1장을 같은 등급의 다른 카드로 교환',effect:'선택 카드 1매 영구 반납 · 같은 등급 카드 1매 획득'},
  {id:'card_reforge',title:'봉인된 연성로',description:'오래된 연성로에 희미한 불꽃이 남아 있다. 카드와 금화를 바치면 한 단계 높은 힘이 깨어난다.',name:'금화 75와 카드 1장을 바치고 등급 상향',effect:'원정 금화 -75 · N→R / R→SR / SR→UR 카드 1매 교환'},
  {id:'relic_bargain',title:'잊힌 유물의 수집가',description:'방랑하는 수집가가 아직 손에 넣지 못한 유물 하나를 펼쳐 보인다. 그는 동전 대신 생명력을 원한다.',name:'LP 800을 바치고 미보유 유물 획득',effect:'현재 LP -800 · 아직 보유하지 않은 유물 1개 획득'},
  {id:'card_duplication',title:'복제의 거울',description:'거울 너머에서 네 카드와 똑같은 그림이 빛난다. 카드 한 장을 비추면 그 힘을 한 번 더 손에 넣을 수 있을 듯하다.',name:'보유 카드 1장을 골라 같은 카드 1장 획득',effect:'선택 카드 +1매 · 원정 카드함에 보관 · 덱에는 자동으로 넣지 않아.'}
];
const clone=value=>structuredClone(value),fail=message=>{throw new Error(message);};
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function exact(value,keys,label){if(!record(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(`${label}의 항목을 확인해줘.`);}
function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)fail(`${label}은 ${min.toLocaleString('ko')}~${max.toLocaleString('ko')} 사이 정수로 입력해줘.`);return value;}
function bool(value,label){if(typeof value!=='boolean')fail(`${label}의 사용 여부를 확인해줘.`);return value;}
function text(value,max,label){if(typeof value!=='string'||value.length>max||!value.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail(`${label}은 비어 있지 않은 ${max}자 이하 문장으로 입력해줘.`);return value.normalize('NFC').trim();}
const key=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function eligibleContentCard157(card){return !!card&&!card.special&&['N','R','SR','UR'].includes(card.rarity)&&card.reward_eligible===true&&card.draw_enabled!==false&&card.deck_limit!==0&&card.speed_limit!==0&&key(card.identity_key);}
export function defaultContent157(){
  return {schema_version:1,kind:CONTENT_KIND157,
    relics:RELICS157.map(row=>({...row,enabled:true,shop_enabled:true,weight:1,price:250})),
    events:EVENTS157.map(row=>({...row,enabled:true,weight:1})),
    shop:{card_count:5,relic_count:3,card_pool_mode:'all',card_pool:[],rarity_weights:{N:50,R:42,SR:6,UR:2},card_prices:{N:50,R:100,SR:180,UR:300},removal_price:75,removal_increase:25}};
}
function registered(rows,definitions,keys,label,parse){
  if(!Array.isArray(rows)||rows.length!==definitions.length)fail(`${label}은 등록된 ${definitions.length}종을 모두 보관해줘. 숨기려면 사용 설정을 꺼줘.`);
  const found=new Map();
  for(const row of rows){exact(row,keys,label);if(!definitions.some(d=>d.id===row.id)||found.has(row.id))fail(`${label}에 등록되지 않은 종류나 중복이 있어. 새 효과는 개발 후 등록할 수 있어.`);found.set(row.id,row);}
  return definitions.map(definition=>parse(found.get(definition.id),definition));
}
export function cleanContent157(value,cards){
  exact(value,['schema_version','kind','relics','events','shop'],'원정 설정');
  if(value.schema_version!==1||value.kind!==CONTENT_KIND157)fail('원정 설정 파일 버전을 확인해줘.');
  if(new TextEncoder().encode(JSON.stringify(value)).length>600000)fail('원정 설정 파일이 너무 커.');
  const relics=registered(value.relics,RELICS157,['id','name','description','enabled','shop_enabled','weight','price'],'유물',(row,definition)=>({
    id:definition.id,name:text(row.name,100,'유물 이름'),description:text(row.description,2000,'유물 설명'),
    enabled:bool(row.enabled,'유물'),shop_enabled:bool(row.shop_enabled,'상점 유물'),weight:integer(row.weight,0,10000,'유물 출현 가중치'),price:integer(row.price,0,2000000000,'유물 가격')}));
  const events=registered(value.events,EVENTS157,['id','title','description','name','effect','enabled','weight'],'이벤트',(row,definition)=>{
    if(row.effect!==definition.effect)fail('등록된 이벤트 효과는 이 화면에서 바꿀 수 없어. 제목과 이야기·선택 문구를 편집해줘.');
    return {id:definition.id,title:text(row.title,100,'이벤트 제목'),description:text(row.description,4000,'이벤트 이야기'),
      name:text(row.name,250,'이벤트 선택 문구'),effect:definition.effect,enabled:bool(row.enabled,'이벤트'),weight:integer(row.weight,0,10000,'이벤트 출현 가중치')};
  });
  const source=value.shop;
  exact(source,['card_count','relic_count','card_pool_mode','card_pool','rarity_weights','card_prices','removal_price','removal_increase'],'원정 상점');
  if(!['all','selected'].includes(source.card_pool_mode)||!Array.isArray(source.card_pool)||source.card_pool.length>2047||source.card_pool.some(id=>!key(id))||new Set(source.card_pool).size!==source.card_pool.length)fail('상점 판매 후보의 카드 식별값을 확인해줘.');
  if(cards!==undefined){
    if(!Array.isArray(cards)||cards.length>8192)fail('상점 카드 자료를 확인해줘.');
    const available=new Set(cards.filter(eligibleContentCard157).map(card=>card.identity_key));
    if(source.card_pool.some(id=>!available.has(id)))fail('판매 후보 중 현재 도감에 없거나 판매할 수 없는 카드가 있어. 후보 목록을 확인해줘.');
  }
  exact(source.rarity_weights,['N','R','SR','UR'],'등급 출현 가중치');exact(source.card_prices,['N','R','SR','UR'],'등급별 가격');
  const rarity_weights={},card_prices={};
  for(const tier of ['N','R','SR','UR']){rarity_weights[tier]=integer(source.rarity_weights[tier],0,10000,`${tier} 출현 가중치`);card_prices[tier]=integer(source.card_prices[tier],0,2000000000,`${tier} 카드 가격`);}
  if(Object.values(rarity_weights).every(weight=>weight===0))fail('카드 등급 중 한 종류 이상은 출현 가중치를 1 이상으로 입력해줘.');
  return {schema_version:1,kind:CONTENT_KIND157,relics,events,shop:{card_count:integer(source.card_count,1,10,'상점 카드 진열 수'),
    relic_count:integer(source.relic_count,0,5,'상점 유물 진열 수'),card_pool_mode:source.card_pool_mode,card_pool:[...source.card_pool].sort(),rarity_weights,card_prices,
    removal_price:integer(source.removal_price,0,2000000000,'카드 제거 기본 가격'),removal_increase:integer(source.removal_increase,0,2000000000,'카드 제거 추가 가격')}};
}
export function cleanLibrary157(value,cards){
  exact(value,['schema','kind','version','document','updated_at'],'온라인 원정 설정');
  if(value.schema!==1||value.kind!==LIBRARY_KIND157)fail('온라인 원정 설정 형식을 확인해줘.');
  integer(value.version,0,Number.MAX_SAFE_INTEGER,'온라인 버전');
  let document=value.document===null&&value.version===0?defaultContent157():cleanContent157(value.document,cards);
  if(value.version===0){if(value.updated_at!==null||JSON.stringify(document)!==JSON.stringify(defaultContent157()))fail('아직 저장되지 않은 원정 설정이 기본값과 달라.');}
  else if(typeof value.updated_at!=='string'||!Number.isFinite(Date.parse(value.updated_at)))fail('온라인 원정 설정의 저장 시각을 확인해줘.');
  return {schema:1,kind:LIBRARY_KIND157,version:value.version,document,updated_at:value.updated_at};
}
export const normalizeContent157Library=cleanLibrary157;
export const registeredEffects157=()=>({relics:clone(RELICS157),events:clone(EVENTS157)});
