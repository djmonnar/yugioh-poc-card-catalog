// A browsing projection only. Legacy registry, packets and card settings keep
// their original 1426-card dataset; Native035 owns the additional identities.
const ENGINE='unity-native-035';
const CATALOG='77da9b2f053f360c71441b8a493d59ed1e3a6f4007129f4ece7b7f4b7b2b94c6';
const DATASET='0175b46f00f98e3766a8a8053a8e453b0415e05472b347368cc4a658bbacdd85';
const BASE='b73dd51c78aeab8c9beebf936b46e4cac16040e70df3a7980dec38c40db21e09';
const APPROVAL='63717c5b4d8da1adf45a69ae7b5f5f4f2ce9ef8852680bc87dff49294c0a054b';
const defaults=new WeakMap();
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=()=>{throw new Error('Unity 추가 카드 자료가 맞지 않아. 기존 도감은 그대로 유지돼.');};
function fields(value,names){if(!object(value)||Object.keys(value).length!==names.length||names.some(k=>!Object.hasOwn(value,k)))fail();}
function text(value,max){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail();return value;}
const RACES=['전사족','마법사족','천사족','악마족','언데드족','기계족','물족','화염족','암석족','비행야수족','식물족','곤충족','번개족','드래곤족','야수족','야수전사족','공룡족','어류족','해룡족','파충류족','사이킥족','환신야수족','창조신족','환룡족','사이버스족','환상마족'];
const ATTRIBUTES=new Map([[1,'땅'],[2,'물'],[4,'화염'],[8,'바람'],[16,'빛'],[32,'어둠'],[64,'신']]);
function classification(card){
  if([1,2,4].filter(bit=>(card.type&bit)!==0).length!==1)fail();
  if(card.type&1){
    const bit=RACES.findIndex((_,i)=>card.race===2**i);if(bit<0||!ATTRIBUTES.has(card.attribute)||!integer(card.level,1,12))fail();
    return {type:card.type&0x40?'융합 몬스터':card.type&0x80?'의식 몬스터':card.type&0x20?'효과 몬스터':'일반 몬스터',subtype:'',race:RACES[bit],attribute:ATTRIBUTES.get(card.attribute),level:card.level,atk:card.attack,def:card.defense};
  }
  if(card.race!==0||card.attribute!==0||card.level!==0)fail();
  const spell=Boolean(card.type&2);
  const subtype=spell?(card.type&0x80?'의식':card.type&0x80000?'필드':card.type&0x40000?'장착':card.type&0x20000?'지속':card.type&0x10000?'속공':'일반'):(card.type&0x100000?'카운터':card.type&0x20000?'지속':'일반');
  return {type:spell?'마법':'함정',subtype,race:'',attribute:'',level:null,atk:null,def:null};
}
function checkBase(data){
  if(!object(data)||!object(data.meta)||data.meta.total!==1426||data.meta.dataset_id!==DATASET||!Array.isArray(data.cards)||data.cards.length!==1426)fail();
  const slots=new Set(),sources=new Set(),identities=new Set(),codes=new Set();
  for(const card of data.cards){
    if(!object(card)||!integer(card.slot,1,1426)||!integer(card.internal_id,0,65535)||!hash(card.identity_key)||slots.has(card.slot)||sources.has(card.internal_id)||identities.has(card.identity_key)||card.nativeOnly===true||card.engine===ENGINE||card.legacyExportAllowed===false)fail();
    slots.add(card.slot);sources.add(card.internal_id);identities.add(card.identity_key);
    if(card.code!=null){if(!integer(card.code,0,0xffffffff)||codes.has(card.code))fail();codes.add(card.code);}
  }return {slots,sources,identities,codes};
}
const RAW_FIELDS=['requestedName','englishName','slot','internal_id','sourceId','code','identity_key','engine','legacyExportAllowed','legacySlot','nativeLuaPath','nativeLuaSha256','alias','type','level','attribute','race','attack','defense','maxCopies','playable','token','metadataCorrected','nativeDefinitionSha256','nameEnglish','typeName','name','rarity','description','officialDescription','artKey','imageUrl','searchAliases','officialCardUrl'];
function nativeView(raw,seen){
  fields(raw,RAW_FIELDS);
  if(!integer(raw.sourceId,2390,2419)||raw.internal_id!==raw.sourceId||raw.slot!==1427+raw.sourceId-2390||!integer(raw.code,1,0xffffffff)||!hash(raw.identity_key)||raw.engine!==ENGINE||raw.legacyExportAllowed!==false||raw.legacySlot!==null||raw.playable!==true||raw.token!==false||!integer(raw.type,1,0xffffffff)||!integer(raw.alias,0,0xffffffff)||!integer(raw.attack,0,999999)||!integer(raw.defense,0,999999)||!integer(raw.maxCopies,0,3)||!['N','R','SR','UR'].includes(raw.rarity)||!hash(raw.nativeLuaSha256)||!hash(raw.nativeDefinitionSha256)||!Array.isArray(raw.searchAliases)||raw.searchAliases.length>20)fail();
  for(const [set,value] of [[seen.slots,raw.slot],[seen.sources,raw.sourceId],[seen.identities,raw.identity_key],[seen.codes,raw.code]]){if(set.has(value))fail();set.add(value);}
  const name=text(raw.name,200),english=text(raw.nameEnglish,200),description=text(raw.description,20000);raw.searchAliases.forEach(v=>text(v,200));
  let official;try{official=new URL(raw.officialCardUrl);}catch{fail();}
  if(official.protocol!=='https:'||official.hostname!=='www.db.yugioh-card.com'||official.pathname!=='/yugiohdb/card_search.action')fail();
  const card={...structuredClone(raw),...classification(raw),nativeType035:raw.type,nativeRace035:raw.race,nativeAttribute035:raw.attribute,nativeOnly:true,
    name_ko:name,name_en:english,description_ko:description,image:`assets/native035/cards/${raw.sourceId}.jpg`,official_url:official.href,
    deck_limit:raw.maxCopies,deck_limit_without_banlist:3,speed_limit:null,special:false,reward_eligible:true,stock:true,draw_enabled:true,
    rarity_reason:'Unity 원정용 기본 등급',rarity_basis:'expedition-balance035-v1',buy_price:null,sell_price:null,review_note:'',review_kind:'',mechanics:[],card_groups:[],related_cards:[]};
  defaults.set(card,Object.freeze({rarity:raw.rarity,stock:true,draw_enabled:true,rarity_reason:card.rarity_reason}));return card;
}
export function mergeCatalogNative035(data,extension){
  const seen=checkBase(data);
  fields(extension,['schema','kind','engine','version','baseCatalogSha256','baseWebDataset','rootApprovalSha256','nativeMetadataSha256','nativeArchiveSha256','localization','rarityPolicy','cards']);
  if(extension.schema!==1||extension.kind!=='unity-native-expansion035'||extension.engine!==ENGINE||extension.version!=='native-expansion035-v1'||extension.baseCatalogSha256!==BASE||extension.baseWebDataset!==DATASET||extension.rootApprovalSha256!==APPROVAL||!hash(extension.nativeMetadataSha256)||!hash(extension.nativeArchiveSha256)||extension.localization!=='ko-KR'||extension.rarityPolicy!=='expedition-balance035-v1'||!Array.isArray(extension.cards)||extension.cards.length!==30)fail();
  const extra=extension.cards.map(raw=>nativeView(raw,seen)).sort((a,b)=>a.slot-b.slot),cards=[...data.cards,...extra];
  return {cards,release:nativeRelease035(cards)};
}
function newRows(cards){
  if(!Array.isArray(cards))fail();const rows=cards.filter(c=>c?.nativeOnly===true);
  if(rows.length!==30||rows.some(c=>c.engine!==ENGINE||c.legacyExportAllowed!==false||c.legacySlot!==null||!defaults.has(c))||new Set(rows.map(c=>c.sourceId)).size!==30)fail();return rows;
}
export function nativeRelease035(cards){
  const rows=newRows(cards).slice().sort((a,b)=>a.slot-b.slot);
  return {id:'unity035',name:'사이버·앤틱 기어 추가 카드',added_at:'2026-10-26T00:00:00+09:00',cards:rows.map(c=>({slot:c.slot,internal_id:c.internal_id,identity_key:c.identity_key}))};
}
export function applyNativeCatalogSettings035(cards,payload){
  const rows=newRows(cards),bySource=new Map(rows.map(c=>[c.sourceId,c]));
  fields(payload,['schema','kind','engine','catalog_id','version','document','references','updated_at']);
  if(payload.schema!==1||payload.kind!=='unity-native035-library'||payload.engine!==ENGINE||payload.catalog_id!==CATALOG||!integer(payload.version,0,Number.MAX_SAFE_INTEGER)||!(payload.updated_at===null&&payload.version===0||typeof payload.updated_at==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(payload.updated_at)&&Number.isFinite(Date.parse(payload.updated_at))))fail();
  fields(payload.references,['card_limits','characters']);
  if(!Array.isArray(payload.references.card_limits)||payload.references.card_limits.length>2047||!Array.isArray(payload.references.characters)||payload.references.characters.length>256)fail();
  const doc=payload.document;fields(doc,['schema','engine','catalog_id','applySections','decks','starters','chapters','settings']);fields(doc.applySections,['starters','chapters','settings']);
  if(doc.schema!==1||doc.engine!==ENGINE||doc.catalog_id!==CATALOG||Object.values(doc.applySections).some(v=>typeof v!=='boolean')||!Array.isArray(doc.decks)||doc.decks.length>200||!Array.isArray(doc.starters)||doc.starters.length>100||!Array.isArray(doc.chapters)||doc.chapters.length!==3||!Array.isArray(doc.settings)||doc.settings.length>30)fail();
  // Only settings are consumed here. Deck legality and shared character rules
  // remain the responsibility of Native035's editor/server validator.
  const settings=new Map();
  for(const setting of doc.settings){
    fields(setting,['source_id','identity_key','rarity','stock','draw_enabled']);const card=bySource.get(setting.source_id);
    if(!card||setting.identity_key!==card.identity_key||settings.has(setting.source_id)||!['N','R','SR','UR'].includes(setting.rarity)||typeof setting.stock!=='boolean'||typeof setting.draw_enabled!=='boolean')fail();settings.set(setting.source_id,setting);
  }
  const active=payload.version>0&&doc.applySections.settings;
  const changes=rows.map(card=>{const baseline=defaults.get(card),setting=active?settings.get(card.sourceId):null;return {card,values:setting?{rarity:setting.rarity,stock:setting.stock,draw_enabled:setting.draw_enabled,rarity_reason:'Unity 원정 편집기에서 저장한 등급'}:{...baseline}};});
  // Complete validation and target-writability checks precede all mutation.
  for(const {card,values} of changes)for(const key of Object.keys(values)){const descriptor=Object.getOwnPropertyDescriptor(card,key);if(!descriptor?.writable)fail();}
  for(const {card,values} of changes)Object.assign(card,values);
  return active?settings.size:0;
}
