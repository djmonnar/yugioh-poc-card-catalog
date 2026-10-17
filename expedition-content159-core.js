import {defaultContent158,cleanContent158,registeredEffects158,relicParams158,relicEffectText158,eventEffectText158,eligibleContentCard158,FIELD_OPTIONS158} from './expedition-content158-core.js?v=20261017-158';
export {FIELD_OPTIONS158 as FIELD_OPTIONS159};
export const CONTENT_KIND159='poc-expedition-content',LIBRARY_KIND159='poc-expedition-content-library';
export const DRAFT_KEY159='yugioh-classic-expedition-content159-draft',LEGACY_DRAFT_KEY159='yugioh-classic-expedition-content158-draft';
export const eligibleContentCard159=eligibleContentCard158;
const copy=structuredClone,legacy=registeredEffects158(),tiers=['N','R','SR','UR'];
const addedRelics=[
 {id:'destruction_scroll',name:'파괴 주문서',description:'듀얼 중 양쪽 필드의 카드 1장을 골라 파괴해. 발동에 체인할 수 없고, 파괴 면역과 파괴 대체는 정상 적용돼.',rarity:'N',params:{charges:1}},
 {id:'flame_scroll',name:'화염 주문서',description:'듀얼 중 상대에게 효과 피해 500을 줘. 원정 전체에서 2번 사용해.',rarity:'N',params:{charges:2,damage:500}},
 {id:'thorn_armor',name:'가시 갑옷',description:'듀얼 중 LP 피해를 받으면 상대에게 피해 200을 돌려줘. LP 지불 비용에는 발동하지 않아.',rarity:'R',params:{damage:200}},
 {id:'golden_pot',name:'욕망의 항아리',description:'획득 즉시 원정 금화 200을 받아.',rarity:'R',params:{gold:200}},
 {id:'wise_burial',name:'현명한 매장',description:'선택한 메인 덱 카드 1장을 처음 패를 받기 전에 묘지로 보내.',rarity:'R',params:{}},
 {id:'prepared_trap',name:'준비된 함정',description:'선택한 메인 덱 함정 카드 1장이 처음 받는 4장 안에 들어와.',rarity:'R',params:{}},
 {id:'prepared_spell',name:'준비된 마법',description:'선택한 메인 덱 마법 카드 1장이 처음 받는 4장 안에 들어와.',rarity:'R',params:{}},
 {id:'prepared_monster',name:'준비된 괴수',description:'선택한 메인 덱 몬스터 카드 1장이 처음 받는 4장 안에 들어와.',rarity:'R',params:{}},
 {id:'weak_power',name:'약자의 힘',description:'자신의 레벨 3 이하 몬스터가 소환될 때 원래 공격력이 300 상승해.',rarity:'SR',params:{atk:300,max_level:3}}
];
const addedEvents=[
 {id:'relic_choice',title:'유물의 선택',description:'상인은 세 개의 상자를 연다. 가벼운 유물은 선물이고, 더 강한 힘에는 동전이 필요하다.',name:'원하는 등급의 무작위 미보유 유물 선택',effect:'N 유물 무료 · 금화 50으로 R 유물 · 금화 100으로 SR 유물 · 하나만 선택',params:{}},
 {id:'card_choice',title:'카드의 선택',description:'몬스터, 마법, 함정의 문장이 서로 다른 문 위에서 빛난다. 필요한 힘이 있는 문을 열자.',name:'몬스터·마법·함정 중 필요한 카드 종류 선택',effect:'고른 종류의 카드 후보 5장 중 1장 획득',params:{}},
 {id:'evolution',title:'진화',description:'성소의 빛이 몬스터 카드의 별을 하나 더 비춘다. 익숙한 동료와 작별하면 새로운 동료가 나타난다.',name:'덱의 몬스터 1장을 레벨이 하나 높은 무작위 몬스터로 교환',effect:'선택한 덱 몬스터 1매 제거 · 정확히 레벨 +1인 무작위 몬스터 1매 획득',params:{}},
 {id:'mana_furnace',title:'마나 용광로',description:'푸른 불꽃이 마법의 조각을 삼킨다. 선물을 받거나, 동전이나 마법 카드를 바쳐 더 나은 가능성을 고를 수 있다.',name:'마법 카드를 받거나 대가를 바치고 선택',effect:'무작위 마법 1장 · 금화 50으로 마법 3장 중 1장 · 보유 마법 1매 제거 후 SR 마법 3장 중 1장',params:{}},
 {id:'deck_transform',title:'덱 변환',description:'세 전설의 그림자가 제단 위에 나타난다. 지금 덱의 일부를 내어주고 한 전설의 힘을 받아보자.',name:'덱 카드 2장을 바치고 테마 카드 3장 획득',effect:'덱 카드 정확히 2매 제거 · 붉은 눈/푸른 눈/블랙 매지션 중 선택한 테마의 무작위 카드 3매 획득 · 메인 최소 20장 유지',params:{}}
];
const relics=[...legacy.relics,...addedRelics],events=[...legacy.events,...addedEvents];
const fail=message=>{throw new Error(message);};
function exact(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(`${label} 형식을 확인해줘.`);}
function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)fail(`${label}은 ${min}~${max} 사이 정수로 입력해줘.`);return value;}
function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail(`${label} 내용을 확인해줘.`);return value.normalize('NFC').trim();}
function bool(value){if(typeof value!=='boolean')fail('사용 여부를 확인해줘.');return value;}
function prices(value){exact(value,tiers,'유물 등급별 가격');return Object.fromEntries(tiers.map(tier=>[tier,integer(value[tier],0,2e9,'유물 가격')]));}
export function relicParams159(id,params){
 if(legacy.relics.some(row=>row.id===id))return relicParams158(id,params);
 const fields={destruction_scroll:[['charges',1,10]],flame_scroll:[['charges',1,10],['damage',1,60000]],thorn_armor:[['damage',0,60000]],golden_pot:[['gold',0,2e9]],wise_burial:[],prepared_trap:[],prepared_spell:[],prepared_monster:[],weak_power:[['atk',0,9999],['max_level',1,12]]}[id];
 if(!fields)fail('등록되지 않은 유물이야.');exact(params,fields.map(row=>row[0]),'유물 수치');return Object.fromEntries(fields.map(([key,min,max])=>[key,integer(params[key],min,max,'유물 수치')]));
}
export function defaultContent159(){const old=defaultContent158();return {...old,schema_version:3,relics:[...old.relics,...addedRelics.map(row=>({...copy(row),enabled:true,shop_enabled:true,weight:1,price:{N:75,R:125,SR:200,UR:300}[row.rarity]}))],events:[...old.events,...addedEvents.map(row=>({...copy(row),enabled:true,weight:1}))],shop:{...old.shop,relic_prices:{N:75,R:125,SR:200,UR:300}},battle_rewards:{battle:50,elite:100}};}
export function migrateContent158To159(value,cards,encounters){const previous=cleanContent158(value,cards,encounters),defaults=defaultContent159();return {...defaults,relics:defaults.relics.map(row=>copy(previous.relics.find(prior=>prior.id===row.id)??row)),events:defaults.events.map(row=>copy(previous.events.find(prior=>prior.id===row.id)??row)),shop:{...previous.shop,relic_prices:defaults.shop.relic_prices}};}
export function cleanContent159(value,cards,encounters){
 if([1,2].includes(value?.schema_version))return cleanContent159(migrateContent158To159(value,cards,encounters),cards,encounters);
 exact(value,['schema_version','kind','relics','events','shop','battle_rewards'],'원정 설정');if(value.schema_version!==3||value.kind!==CONTENT_KIND159)fail('원정 설정 버전을 확인해줘.');if(new TextEncoder().encode(JSON.stringify(value)).length>600000)fail('원정 설정은 600KB 이하로 보관해줘.');
 function registry(input,definitions,keys,clean){if(!Array.isArray(input)||input.length!==definitions.length)fail('등록된 유물·이벤트 목록을 모두 보관해줘.');const by=new Map();for(const row of input){exact(row,keys,'등록 항목');if(!definitions.some(def=>def.id===row.id)||by.has(row.id))fail('중복되거나 미등록인 항목이 있어.');by.set(row.id,row);}return definitions.map(def=>clean(by.get(def.id),def));}
 const base=defaultContent158();base.relics=value.relics?.filter(row=>legacy.relics.some(def=>def.id===row.id));base.events=value.events?.filter(row=>legacy.events.some(def=>def.id===row.id));
 const shop={...value.shop};delete shop.relic_prices;shop.fixed_relics=Array.isArray(shop.fixed_relics)?shop.fixed_relics.filter(id=>legacy.relics.some(row=>row.id===id)):shop.fixed_relics;base.shop=shop;
 // Legacy IDs retain exactly the frozen 158 validation, including current card eligibility.
 const checked=cleanContent158(base,cards,encounters);
 const normalizedRelics=registry(value.relics,relics,['id','name','description','enabled','shop_enabled','weight','price','rarity','params'],(row,def)=>{
  if(legacy.relics.some(old=>old.id===def.id))return checked.relics.find(old=>old.id===def.id);
  if(!tiers.includes(row.rarity))fail('유물 등급을 확인해줘.');return {id:def.id,name:text(row.name,100,'유물 이름'),description:text(row.description,2000,'유물 설명'),rarity:row.rarity,params:relicParams159(row.id,row.params),enabled:bool(row.enabled),shop_enabled:bool(row.shop_enabled),weight:integer(row.weight,0,10000,'출현 가중치'),price:integer(row.price,0,2e9,'이전 유물 가격')};
 });
 const normalizedEvents=registry(value.events,events,['id','title','description','name','effect','enabled','weight','params'],(row,def)=>{
  if(legacy.events.some(old=>old.id===def.id))return checked.events.find(old=>old.id===def.id);
  exact(row.params,[],'고정 이벤트 수치');if(row.effect!==def.effect)fail('등록된 이벤트 효과는 바꿀 수 없어.');return {id:def.id,title:text(row.title,100,'이벤트 제목'),description:text(row.description,4000,'이벤트 이야기'),name:text(row.name,250,'이벤트 선택 문구'),effect:def.effect,params:{},enabled:bool(row.enabled),weight:integer(row.weight,0,10000,'출현 가중치')};
 });
 exact(value.shop,[...Object.keys(defaultContent158().shop),'relic_prices'],'원정 상점');
 // New relic IDs in fixed stock are checked separately from the legacy validator.
 const fixed=value.shop.fixed_relics;if(!Array.isArray(fixed)||fixed.length>relics.length||new Set(fixed).size!==fixed.length||fixed.some(id=>!relics.some(row=>row.id===id)))fail('상시 판매 유물을 확인해줘.');
 exact(value.battle_rewards,['battle','elite'],'전투 승리 금화');
 return {schema_version:3,kind:CONTENT_KIND159,relics:normalizedRelics,events:normalizedEvents,shop:{...checked.shop,fixed_relics:relics.filter(row=>fixed.includes(row.id)).map(row=>row.id),relic_prices:prices(value.shop.relic_prices)},battle_rewards:{battle:integer(value.battle_rewards.battle,0,2e9,'일반 승리 금화'),elite:integer(value.battle_rewards.elite,0,2e9,'엘리트 승리 금화')}};
}
export function cleanLibrary159(value,cards,encounters){exact(value,['schema','kind','version','document','updated_at'],'온라인 원정 설정');if(value.schema!==1||value.kind!==LIBRARY_KIND159)fail('온라인 원정 설정 형식을 확인해줘.');integer(value.version,0,Number.MAX_SAFE_INTEGER,'온라인 버전');const document=value.version===0&&value.document===null?cleanContent159(defaultContent159()):cleanContent159(value.document,cards,encounters);if(value.version===0){if(value.updated_at!==null||JSON.stringify(document)!==JSON.stringify(cleanContent159(defaultContent159())))fail('미설정 기본값이 달라.');}else if(typeof value.updated_at!=='string'||!Number.isFinite(Date.parse(value.updated_at)))fail('온라인 저장 시각을 확인해줘.');return {schema:1,kind:LIBRARY_KIND159,version:value.version,document,updated_at:value.updated_at};}
export const normalizeContent159Library=cleanLibrary159;
export const registeredEffects159=()=>({relics:copy(relics),events:copy(events)});
export function relicEffectText159(row){if(legacy.relics.some(def=>def.id===row.id))return relicEffectText158(row);const p=relicParams159(row.id,row.params);return {destruction_scroll:`필드 카드 1장 선택 파괴 · 발동에 체인 불가 · 파괴 면역·대체 적용 · 원정 전체 ${p.charges}회.`,flame_scroll:`상대에게 효과 피해 ${p.damage?.toLocaleString('ko')} · 원정 전체 ${p.charges}회.`,thorn_armor:`LP 피해를 받으면 상대에게 ${p.damage?.toLocaleString('ko')} 피해 · 비용 제외.`,golden_pot:`획득 즉시 원정 금화 +${p.gold?.toLocaleString('ko')}.`,wise_burial:addedRelics[4].description,prepared_trap:addedRelics[5].description,prepared_spell:addedRelics[6].description,prepared_monster:addedRelics[7].description,weak_power:`자신의 레벨 ${p.max_level} 이하 몬스터가 소환될 때 원래 공격력이 ${p.atk?.toLocaleString('ko')} 상승해.`}[row.id];}
export function eventEffectText159(row){if(legacy.events.some(def=>def.id===row.id))return eventEffectText158(row);const def=addedEvents.find(def=>def.id===row.id);if(!def)fail('등록되지 않은 이벤트야.');return def.effect;}
