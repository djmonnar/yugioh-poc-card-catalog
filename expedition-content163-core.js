import {defaultContent159,cleanContent159,registeredEffects159,relicParams159,relicEffectText159,eventEffectText159,eligibleContentCard159,FIELD_OPTIONS159} from './expedition-content159-core.js?v=20261017-159';
export {FIELD_OPTIONS159 as FIELD_OPTIONS163};
export const CONTENT_KIND163='poc-expedition-content',LIBRARY_KIND163='poc-expedition-content-library';
export const DRAFT_KEY163='yugioh-classic-expedition-content163-draft',LEGACY_DRAFT_KEY163='yugioh-classic-expedition-content159-draft';
export const eligibleContentCard163=eligibleContentCard159;
const copy=structuredClone,legacy=registeredEffects159(),tiers=['N','R','SR','UR'];
export const NEW_RELICS163=[
 {id:'forge_attack',name:'카드 제련 (공격)',description:'덱의 몬스터 카드 1매를 골라 이번 원정 동안 공격력을 올려. 유물을 잃어도 강화는 남고, 해당 카드를 팔거나 제거하면 사라져.',rarity:'N',params:{atk:100}},
 {id:'forge_defense',name:'카드 제련 (수비)',description:'덱의 몬스터 카드 1매를 골라 이번 원정 동안 수비력을 올려. 유물을 잃어도 강화는 남고, 해당 카드를 팔거나 제거하면 사라져.',rarity:'N',params:{def:100}},
 {id:'dreamcatcher',name:'드림캐쳐',description:'휴식 선택 후 카드 보상을 한 번 더 받아. 구역 확률과 SR·UR 천장을 적용한 후보 중 1장을 골라.',rarity:'R',params:{choices:5}},
 {id:'reload',name:'리로드',description:'각 전투의 첫 드로우 후 손패 1장을 골라 덱에 넣고 섞은 다음 1장 뽑을 수 있어. 건너뛸 수 있어.',rarity:'R',params:{count:1}},
 {id:'tactics_manual',name:'병법서',description:'누적 10장 드로우마다 1장을 더 뽑아. 전투가 끝나도 진행 수치를 유지하고, 추가로 뽑은 카드도 포함해.',rarity:'R',params:{threshold:10,draw:1}},
 {id:'lizard_tail',name:'도마뱀 꼬리',description:'듀얼 중 사용하면 무승부로 끝내고 전투 직전 위치와 LP로 돌아가. 다 쓴 뒤 다시 얻으면 새 횟수를 받아.',rarity:'R',params:{charges:1}},
 {id:'mystery_card',name:'물음표 카드',description:'전투 시작 시 무작위 카드 1장을 추가 손패로 받아. 해당 전투에서만 존재하며 무승부에도 사라져.',rarity:'R',params:{count:1}},
 {id:'lamb_charm',name:'어린 양',description:'전투 시작 시 양 토큰을 앞면 수비 표시로 소환해. 어드밴스 소환을 위해 릴리스할 수 없어.',rarity:'R',params:{count:1}}
];
const fail=m=>{throw Error(m);},record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys,label)=>{if(!record(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail(`${label} 형식을 확인해줘.`);};
const integer=(v,a,b,label)=>{if(!Number.isSafeInteger(v)||v<a||v>b)fail(`${label}은 ${a}~${b} 사이 정수로 입력해줘.`);return v;};
const text=(v,n,label)=>{if(typeof v!=='string'||!v.trim()||v.length>n||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail(`${label} 내용을 확인해줘.`);return v.normalize('NFC').trim();};
export function relicParams163(id,params){
 if(legacy.relics.some(r=>r.id===id))return relicParams159(id,params);
 const fields={forge_attack:[['atk',1,9999]],forge_defense:[['def',1,9999]],dreamcatcher:[['choices',1,10]],reload:[['count',1,1]],tactics_manual:[['threshold',2,1000],['draw',1,1]],lizard_tail:[['charges',1,10]],mystery_card:[['count',1,1]],lamb_charm:[['count',1,1]]}[id];
 if(!fields)fail('등록되지 않은 유물이야.');exact(params,fields.map(r=>r[0]),'유물 수치');return Object.fromEntries(fields.map(([k,a,b])=>[k,integer(params[k],a,b,'유물 수치')]));
}
export function defaultContent163(){const old=defaultContent159();return {...old,schema_version:4,relics:[...old.relics,...NEW_RELICS163.map(r=>({...copy(r),enabled:true,shop_enabled:true,weight:1,price:{N:75,R:125,SR:200,UR:300}[r.rarity]}))]};}
export function migrateContent159To163(value,cards,encounters){const prior=cleanContent159(value,cards,encounters),defaults=defaultContent163();return {...prior,schema_version:4,relics:[...prior.relics,...defaults.relics.filter(r=>!prior.relics.some(p=>p.id===r.id))]};}
export const migrateContent158To163=migrateContent159To163;
export function cleanContent163(value,cards,encounters){
 if([1,2,3].includes(value?.schema_version))return cleanContent163(migrateContent159To163(value,cards,encounters),cards,encounters);
 exact(value,['schema_version','kind','relics','events','shop','battle_rewards'],'원정 설정');if(value.schema_version!==4||value.kind!==CONTENT_KIND163)fail('원정 설정 버전을 확인해줘.');
 if(!Array.isArray(value.relics)||value.relics.length!==legacy.relics.length+NEW_RELICS163.length||new Set(value.relics.map(r=>r.id)).size!==value.relics.length)fail('등록된 유물 목록을 모두 보관해줘.');
 const fixed=value.shop?.fixed_relics,known=[...legacy.relics,...NEW_RELICS163];if(!Array.isArray(fixed)||fixed.length>known.length||new Set(fixed).size!==fixed.length||fixed.some(id=>!known.some(r=>r.id===id)))fail('상시 판매 유물을 확인해줘.');
 const prior=cleanContent159({...value,schema_version:3,relics:value.relics.filter(r=>legacy.relics.some(p=>p.id===r.id)),shop:{...value.shop,fixed_relics:fixed.filter(id=>legacy.relics.some(r=>r.id===id))}},cards,encounters);
 const added=NEW_RELICS163.map(def=>{const row=value.relics.find(r=>r.id===def.id);exact(row,['id','name','description','enabled','shop_enabled','weight','price','rarity','params'],'신규 유물');if(!tiers.includes(row.rarity)||typeof row.enabled!=='boolean'||typeof row.shop_enabled!=='boolean')fail('유물 등급·사용 여부를 확인해줘.');return {id:def.id,name:text(row.name,100,'유물 이름'),description:text(row.description,2000,'유물 설명'),enabled:row.enabled,shop_enabled:row.shop_enabled,weight:integer(row.weight,0,10000,'출현 가중치'),price:integer(row.price,0,2e9,'이전 유물 가격'),rarity:row.rarity,params:relicParams163(row.id,row.params)};});
 return {...prior,schema_version:4,relics:[...prior.relics,...added],shop:{...prior.shop,fixed_relics:known.filter(r=>fixed.includes(r.id)).map(r=>r.id)}};
}
export function cleanLibrary163(value,cards,encounters){exact(value,['schema','kind','version','document','updated_at'],'온라인 원정 설정');if(value.schema!==1||value.kind!==LIBRARY_KIND163)fail('온라인 원정 설정 형식을 확인해줘.');integer(value.version,0,Number.MAX_SAFE_INTEGER,'온라인 버전');const document=value.version===0&&value.document===null?cleanContent163(defaultContent163()):cleanContent163(value.document,cards,encounters);if(value.version===0){if(value.updated_at!==null||JSON.stringify(document)!==JSON.stringify(cleanContent163(defaultContent163())))fail('미설정 기본값이 달라.');}else if(typeof value.updated_at!=='string'||!Number.isFinite(Date.parse(value.updated_at)))fail('온라인 저장 시각을 확인해줘.');return {schema:1,kind:LIBRARY_KIND163,version:value.version,document,updated_at:value.updated_at};}
export const normalizeContent163Library=cleanLibrary163;
export const registeredEffects163=()=>({relics:[...copy(legacy.relics),...copy(NEW_RELICS163)],events:copy(legacy.events)});
export function relicEffectText163(row){if(legacy.relics.some(r=>r.id===row.id))return relicEffectText159(row);const p=relicParams163(row.id,row.params);return {forge_attack:`획득 시 덱 몬스터 1매 선택 · 해당 1매 공격력 +${p.atk} · 이번 원정 영구 강화.`,forge_defense:`획득 시 덱 몬스터 1매 선택 · 해당 1매 수비력 +${p.def} · 이번 원정 영구 강화.`,dreamcatcher:`휴식 후 카드 후보 ${p.choices}장 중 1장 추가 보상 · 구역 확률·천장 적용.`,reload:'첫 드로우 후 손패 1장 덱에 넣고 섞기 → 1장 드로우 · 전투당 1회 · 선택 가능.',tactics_manual:`누적 ${p.threshold}장 드로우마다 ${p.draw}장 추가 드로우 · 전투 간 진행 유지.`,lizard_tail:`전투 무승부·직전 위치와 LP 복원 · 원정 전체 ${p.charges}회.`,mystery_card:'전투 시작 시 무작위 카드 1장 추가 손패 · 이 전투에서만 유지.',lamb_charm:'시작 필드에 양 토큰 1장 앞면 수비 표시 · 어드밴스 소환 릴리스 불가.'}[row.id];}
export const eventEffectText163=eventEffectText159;
