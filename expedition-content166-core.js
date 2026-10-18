import * as legacy from './expedition-content163-core.js?v=20261018-163';
export {FIELD_OPTIONS163,eligibleContentCard163} from './expedition-content163-core.js?v=20261018-163';
export const CONTENT_KIND166=legacy.CONTENT_KIND163,LIBRARY_KIND166=legacy.LIBRARY_KIND163;
export const CONTENT_KIND163=CONTENT_KIND166,LIBRARY_KIND163=LIBRARY_KIND166;
export const DRAFT_KEY166='yugioh-classic-expedition-content166-draft',LEGACY_DRAFT_KEY166=legacy.DRAFT_KEY163;
export const DRAFT_KEY163=DRAFT_KEY166,LEGACY_DRAFT_KEY163=LEGACY_DRAFT_KEY166;
const copy=structuredClone,tiers=['N','R','SR','UR'],fail=m=>{throw Error(m);};
export const NEW_RELICS166=Object.freeze([
 {id:'white_dragon_eye',name:'백룡의 눈',description:'덱의 레벨 8 몬스터 1매를 선택해 어드밴스 소환 릴리스를 1장으로 줄여. 대상이 없으면 푸른 눈의 백룡 1장을 받아. 받은 카드는 자동 강화되지 않아.',rarity:'SR',params:{level:8,tributes:1}},
 {id:'red_dragon_eye',name:'흑룡의 눈',description:'덱의 레벨 7 몬스터 1매의 공격력을 600 올려. 대상이 없으면 붉은 눈의 흑룡 1장을 받아. 받은 카드는 자동 강화되지 않아.',rarity:'SR',params:{level:7,atk:600}},
 {id:'magician_grimoire',name:'매지션의 마도서',description:'강화되지 않은 덱의 마법사족 1매에 특수 소환 시 덱의 마법 카드 1장 서치를 추가해. 마법사족이 아예 없으면 블랙 매지션 1장을 받아. 받은 카드는 자동 강화되지 않아.',rarity:'SR',params:{}},
 {id:'moon_book',name:'달의 서',description:'전투마다 1번 앞면 표시 몬스터 1장을 뒷면 수비 표시로 바꿔. 유물은 소모되지 않아.',rarity:'SR',params:{uses_per_battle:1}},
 {id:'blood_book',name:'흡혈의 서',description:'상대의 남은 LP보다 큰 피해를 주면 초과한 만큼 LP를 회복해. 최대 LP는 넘지 않아.',rarity:'UR',params:{}},
 {id:'bone',name:'말뼈',description:'획득 즉시 최대 LP가 500 증가해. 현재 LP는 그대로 유지돼.',rarity:'SR',params:{max_lp:500}}
]);
export const NEW_EVENTS166=Object.freeze([
 {id:'card_enhancement',title:'카드 강화',description:'오래된 제련대에 한 장의 카드를 올린다. 칼날과 방패 중 어느 문장을 새길까?',name:'덱 몬스터 1매를 골라 공격 또는 수비 강화',effect:'선택한 몬스터 1매의 공격력 또는 수비력 +100 · 이번 원정 유지',params:{amount:100}},
 {id:'card_sealing',title:'카드 봉인',description:'석문 너머의 마력이 동료를 부른다. 세 번의 결투 동안 봉인하면 더 강한 모습으로 돌아온다.',name:'강화되지 않은 덱 몬스터 1매를 세 전투 동안 봉인',effect:'선택한 1매는 다음 완료 전투 3회 동안 사용 불가 · 이후 공격력 +100 / 수비력 +300 · 사용 가능한 메인 덱 최소 20장',params:{battles:3,atk:100,def:300}}
]);
const exact=(v,keys,label)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail(`${label} 형식을 확인해줘.`);};
const integer=(v,a,b)=>{if(!Number.isSafeInteger(v)||v<a||v>b)fail(`수치는 ${a}~${b} 정수여야 해.`);return v;};
const text=(v,n)=>{if(typeof v!=='string'||!v.trim()||v.length>n||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail('이름과 설명을 확인해줘.');return v.normalize('NFC').trim();};
export function relicParams166(id,p){
 if(!NEW_RELICS166.some(r=>r.id===id))return legacy.relicParams163(id,p);
 const fields={white_dragon_eye:[['level',8,8],['tributes',1,1]],red_dragon_eye:[['level',7,7],['atk',0,9999]],magician_grimoire:[],moon_book:[['uses_per_battle',1,1]],blood_book:[],bone:[['max_lp',1,60000]]}[id];
 exact(p,fields.map(f=>f[0]),'유물 수치');return Object.fromEntries(fields.map(([k,a,b])=>[k,integer(p[k],a,b)]));
}
export const relicParams163=relicParams166;
export function eventParams166(id,p){const fields={card_enhancement:[['amount',1,9999]],card_sealing:[['battles',3,3],['atk',0,9999],['def',0,9999]]}[id];if(!fields)fail('등록되지 않은 이벤트야.');exact(p,fields.map(f=>f[0]),'이벤트 수치');return Object.fromEntries(fields.map(([k,a,b])=>[k,integer(p[k],a,b)]));}
export function defaultContent166(){const old=legacy.defaultContent163();return {...old,schema_version:5,relics:[...old.relics,...NEW_RELICS166.map(r=>({...copy(r),enabled:true,shop_enabled:true,weight:1,price:r.rarity==='UR'?300:200}))],events:[...old.events,...NEW_EVENTS166.map(e=>({id:e.id,title:e.title,description:e.description,name:e.name,enabled:true,weight:1,params:copy(e.params)}))]};}
export function migrateContent163To166(v,cards,encounters){const old=legacy.cleanContent163(v,cards,encounters),d=defaultContent166();return {...old,schema_version:5,relics:[...old.relics,...d.relics.filter(r=>NEW_RELICS166.some(x=>x.id===r.id))],events:[...old.events,...d.events.filter(r=>NEW_EVENTS166.some(x=>x.id===r.id))]};}
export function cleanContent166(v,cards,encounters){
 if([1,2,3,4].includes(v?.schema_version))return cleanContent166(migrateContent163To166(v,cards,encounters),cards,encounters);
 exact(v,['schema_version','kind','relics','events','shop','battle_rewards'],'원정 설정');if(v.schema_version!==5||v.kind!==CONTENT_KIND166)fail('원정 설정 버전이 달라.');
 const defs=legacy.registeredEffects163(),newIds=NEW_RELICS166.map(r=>r.id),eventIds=NEW_EVENTS166.map(e=>e.id);
 if(!Array.isArray(v.relics)||v.relics.length!==defs.relics.length+newIds.length||new Set(v.relics.map(r=>r.id)).size!==v.relics.length||!Array.isArray(v.events)||v.events.length!==defs.events.length+eventIds.length||new Set(v.events.map(e=>e.id)).size!==v.events.length)fail('등록된 유물·이벤트 목록을 모두 보관해줘.');
 const fixed=v.shop?.fixed_relics;if(!Array.isArray(fixed)||new Set(fixed).size!==fixed.length||fixed.some(id=>![...defs.relics.map(r=>r.id),...newIds].includes(id)))fail('상시 판매 유물을 확인해줘.');
 const old=legacy.cleanContent163({...v,schema_version:4,relics:v.relics.filter(r=>!newIds.includes(r.id)),events:v.events.filter(e=>!eventIds.includes(e.id)),shop:{...v.shop,fixed_relics:fixed.filter(id=>!newIds.includes(id))}},cards,encounters);
 const relics=NEW_RELICS166.map(d=>{const r=v.relics.find(r=>r.id===d.id);exact(r,['id','name','description','enabled','shop_enabled','weight','price','rarity','params'],'신규 유물');if(!tiers.includes(r.rarity)||typeof r.enabled!=='boolean'||typeof r.shop_enabled!=='boolean')fail('유물 등급·사용 여부가 달라.');return {id:d.id,name:text(r.name,100),description:text(r.description,2000),enabled:r.enabled,shop_enabled:r.shop_enabled,weight:integer(r.weight,0,10000),price:integer(r.price,0,2e9),rarity:r.rarity,params:relicParams166(d.id,r.params)};});
 const events=NEW_EVENTS166.map(d=>{const e=v.events.find(e=>e.id===d.id);exact(e,['id','title','description','name','enabled','weight','params'],'신규 이벤트');if(typeof e.enabled!=='boolean')fail('이벤트 사용 여부가 달라.');return {id:d.id,title:text(e.title,100),description:text(e.description,2000),name:text(e.name,100),enabled:e.enabled,weight:integer(e.weight,0,10000),params:eventParams166(d.id,e.params)};});
 return {...old,schema_version:5,relics:[...old.relics,...relics],events:[...old.events,...events],shop:{...old.shop,fixed_relics:[...defs.relics,...NEW_RELICS166].filter(r=>fixed.includes(r.id)).map(r=>r.id)}};
}
export function cleanLibrary166(v,cards,encounters){exact(v,['schema','kind','version','document','updated_at'],'온라인 원정 설정');if(v.schema!==1||v.kind!==LIBRARY_KIND166)fail('온라인 원정 설정 버전이 달라.');integer(v.version,0,Number.MAX_SAFE_INTEGER);const document=cleanContent166(v.version===0&&v.document===null?defaultContent166():v.document,cards,encounters);if(v.version===0&&(v.updated_at!==null||JSON.stringify(document)!==JSON.stringify(cleanContent166(defaultContent166()))))fail('미설정 기본값이 달라.');if(v.version>0&&(typeof v.updated_at!=='string'||!Number.isFinite(Date.parse(v.updated_at))))fail('저장 시각이 달라.');return {schema:1,kind:LIBRARY_KIND166,version:v.version,document,updated_at:v.updated_at};}
export const cleanLibrary163=cleanLibrary166,normalizeContent163Library=cleanLibrary166,cleanContent163=cleanContent166,defaultContent163=defaultContent166,migrateContent158To163=migrateContent163To166,migrateContent159To163=migrateContent163To166;
export const registeredEffects166=()=>{const d=legacy.registeredEffects163();return {relics:[...d.relics,...copy(NEW_RELICS166)],events:[...d.events,...copy(NEW_EVENTS166)]};};
export const registeredEffects163=registeredEffects166;
export function relicEffectText166(r){if(!NEW_RELICS166.some(d=>d.id===r.id))return legacy.relicEffectText163(r);const p=relicParams166(r.id,r.params);return {white_dragon_eye:'덱의 레벨 8 몬스터 1매 · 어드밴스 소환 릴리스 1장. 대상 없음: 푸른 눈의 백룡 1장만 획득.',red_dragon_eye:`덱의 레벨 7 몬스터 1매 · 공격력 +${p.atk}. 대상 없음: 붉은 눈의 흑룡 1장만 획득.`,magician_grimoire:'강화되지 않은 마법사족 1매 · 특수 소환 시 마법 카드 서치. 마법사족 없음: 블랙 매지션 1장만 획득.',moon_book:'전투마다 1번 · 앞면 몬스터 1장을 뒷면 수비로 변경 · 소모되지 않음.',blood_book:'상대의 남은 LP를 초과해 준 피해만큼 회복 · 최대 LP 제한.',bone:`최대 LP +${p.max_lp} · 현재 LP 유지.`}[r.id];}
export const relicEffectText163=relicEffectText166;
export function eventEffectText166(e){if(!NEW_EVENTS166.some(d=>d.id===e.id))return legacy.eventEffectText163(e);const p=eventParams166(e.id,e.params);return e.id==='card_enhancement'?`덱 몬스터 1매의 공격력 또는 수비력 +${p.amount}`:`강화되지 않은 덱 몬스터 1매를 완료 전투 ${p.battles}회 봉인 → 공격력 +${p.atk} / 수비력 +${p.def}`;}
export const eventEffectText163=eventEffectText166;
