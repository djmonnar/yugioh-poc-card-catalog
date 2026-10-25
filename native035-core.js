import {limitRows} from './card-limits.js?v=20261008-61';
import {parseCharacters} from './character-library.js?v=20261012-shared127';
// Native035 has its own identity and storage domain. Never emit a legacy .ydc packet.
export const NATIVE035_ENGINE='unity-native-035';
export const NATIVE035_CATALOG='77da9b2f053f360c71441b8a493d59ed1e3a6f4007129f4ece7b7f4b7b2b94c6';
export const NATIVE035_BASE='b73dd51c78aeab8c9beebf936b46e4cac16040e70df3a7980dec38c40db21e09';
export const NATIVE035_BASE_BINDINGS='3889a4f651854c23ddb8b03d90841a6c380c8be4a6d4f1858d6fd59e4968586e';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=m=>{throw Error(m);};
const fields=(o,allowed)=>{if(!object(o)||Object.keys(o).some(k=>!allowed.includes(k)))fail('알 수 없는 항목이 있어. 현재 편집기에서 다시 확인해줘.');};
export const isExtra035=c=>Boolean(c.type&(0x40|0x2000|0x800000|0x4000000));
export const cardRef035=c=>({source_id:c.sourceId,identity_key:c.identity_key});
export function emptyNative035(){return {schema:1,engine:NATIVE035_ENGINE,catalog_id:NATIVE035_CATALOG,applySections:{starters:false,chapters:false,settings:false},decks:[],starters:[],chapters:[1,2,3].map(chapter=>({chapter,...Object.fromEntries(['battle','elite','boss'].map(k=>[k,{enabled:false,lp_bonus:0,entries:[]}]))})),settings:[]};}
export async function sha256035(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function indexNative035(base,extension,legacyCards=[]){
  if(base?.schema!==1||base.kind!=='unity-native-base035'||base.engine!==NATIVE035_ENGINE||base.baseCatalogSha256!==NATIVE035_BASE||base.cards?.length!==1426)fail('기존 카드 연결 자료가 맞지 않아.');
  if(extension?.schema!==1||extension.kind!=='unity-native-expansion035'||extension.engine!==NATIVE035_ENGINE||extension.baseCatalogSha256!==NATIVE035_BASE||extension.cards?.length!==30)fail('Unity 추가 카드 연결 자료가 맞지 않아.');
  const legacy=new Map(legacyCards.map(c=>[c.slot,c])),bySource=new Map(),byCode=new Map(),slots=new Set(),identities=new Set();
  for(const [i,raw] of [...base.cards,...extension.cards].entries()){
    const baseNoCode=i<1426&&raw.slot===1107&&raw.sourceId===1910&&raw.code===0&&raw.playable===false;
    if(!integer(raw.sourceId,0,65535)||!integer(raw.code,baseNoCode?0:1,0xffffffff)||!integer(raw.slot,1,65535)||!hash(raw.identity_key)||bySource.has(raw.sourceId)||byCode.has(raw.code)||slots.has(raw.slot)||identities.has(raw.identity_key))fail('카드 식별자가 중복되거나 잘못되었어.');
    const expanded=i>=1426;
    if(expanded&&(raw.engine!==NATIVE035_ENGINE||raw.legacyExportAllowed!==false||raw.legacySlot!==null||raw.sourceId!==2390+i-1426||raw.slot!==1427+i-1426))fail('추가 카드의 엔진 경계가 잘못되었어.');
    if(!expanded&&(raw.engine!=='legacy-compatible'||raw.legacyExportAllowed!==true||raw.legacySlot!==raw.slot))fail('기존 카드의 엔진 경계가 잘못되었어.');
    const old=legacy.get(raw.slot);
    if(!expanded&&old&&(old.internal_id!==raw.sourceId||old.identity_key!==raw.identity_key))fail('기존 카드와 연결 정보가 달라.');
    const row={...structuredClone(raw),expanded,deckLimit:old?.deck_limit??raw.deck_limit??raw.maxCopies,speedLimit:old?.speed_limit??raw.speed_limit??null,rarity:old?.rarity??raw.rarity,stock:old?.stock??false,draw_enabled:old?.draw_enabled??true,image:expanded?`assets/native035/cards/${raw.sourceId}.jpg`:old?.image??`assets/cards/${String(raw.slot).padStart(4,'0')}.webp`};
    bySource.set(row.sourceId,row);byCode.set(row.code,row);slots.add(row.slot);identities.add(row.identity_key);
  }
  return {cards:[...bySource.values()],bySource,byCode};
}
export function parseNative035(value,index,{characterIds=null,characterRows=null,allowIncomplete=false}={}){
  fields(value,['schema','engine','catalog_id','applySections','decks','starters','chapters','settings']);
  if(value.schema!==1||value.engine!==NATIVE035_ENGINE||value.catalog_id!==NATIVE035_CATALOG)fail('Unity 카드 버전이 맞지 않아. 페이지를 새로 열어줘.');
  fields(value.applySections,['starters','chapters','settings']);
  for(const k of ['starters','chapters','settings'])if(typeof value.applySections[k]!=='boolean')fail('적용 범위를 확인해줘.');
  if(!Array.isArray(value.decks)||value.decks.length>200||!Array.isArray(value.starters)||value.starters.length>100||!Array.isArray(value.chapters)||value.chapters.length!==3||!Array.isArray(value.settings)||value.settings.length>30)fail('목록 크기를 확인해줘.');
  // A card which is not in this deck can still share its printed name. The
  // entire catalog family uses its lowest current limit, as the Native book does.
  const familyLimits=new Map();
  for(const c of index.cards)if(c.playable&&!c.token){const key=c.alias||c.code;familyLimits.set(key,Math.min(familyLimits.get(key)??3,c.deckLimit));}
  const seen=new Set(),decks=value.decks.map(d=>{
    fields(d,['deck_id','name','character_id','character_skill_profile_id','use_shared_skills','banlist_enabled','main','extra']);
    if(!id(d.deck_id)||seen.has(d.deck_id)||typeof d.name!=='string'||!d.name.trim()||d.name.length>100||typeof d.banlist_enabled!=='boolean'||d.use_shared_skills!==true||d.character_id!==null&&(!id(d.character_id)||characterIds&&!characterIds.has(d.character_id)))fail('덱 이름·캐릭터·제한 설정을 확인해줘.');
    if(d.character_skill_profile_id!==null&&(!id(d.character_skill_profile_id)||d.character_id===null||characterRows&&!characterRows.find(c=>c.id===d.character_id)?.profile.skill_profiles?.some(p=>p.profile_id===d.character_skill_profile_id)))fail('캐릭터의 특성 묶음을 다시 골라줘.');
    seen.add(d.deck_id);const quantities=new Map(),nameLimits=new Map(),speedUsed=[0,0,0,0];
    const section=(rows,extra)=>{
      if(!Array.isArray(rows)||rows.length>60)fail('덱 카드 목록을 확인해줘.');
      const sources=new Set();let total=0;
      const out=rows.map(r=>{
        fields(r,['source_id','identity_key','count']);const c=index.bySource.get(r.source_id);
        if(!c||c.identity_key!==r.identity_key||!c.playable||c.token||sources.has(c.sourceId)||!integer(r.count,1,3)||isExtra035(c)!==extra)fail('카드 종류·매수·식별자를 확인해줘.');
        sources.add(c.sourceId);total+=r.count;const key=c.alias||c.code;quantities.set(key,(quantities.get(key)||0)+r.count);
        nameLimits.set(key,Math.min(nameLimits.get(key)??3,d.banlist_enabled?familyLimits.get(key):3));
        if(quantities.get(key)>nameLimits.get(key))fail(`${c.name}: 같은 이름의 카드 제한을 초과했어.`);
        if(d.banlist_enabled&&c.speedLimit===0)fail(`${c.name}: 현재 금지 카드야.`);
        if(d.banlist_enabled&&c.speedLimit>0&&c.speedLimit<=3){speedUsed[c.speedLimit]+=r.count;if(speedUsed[c.speedLimit]>c.speedLimit)fail(`제한 ${c.speedLimit} 카드의 합계 매수를 초과했어.`);}
        return {...cardRef035(c),count:r.count};
      });
      if(extra?total>15:total>30||!allowIncomplete&&total<20)fail(extra?'엑스트라 덱은 15장까지야.':'메인 덱은 20~30장으로 맞춰줘.');
      return out;
    };
    return {deck_id:d.deck_id,name:d.name.trim(),character_id:d.character_id,character_skill_profile_id:d.character_skill_profile_id,use_shared_skills:true,banlist_enabled:d.banlist_enabled,main:section(d.main,false),extra:section(d.extra,true)};
  });
  const starters=value.starters.map(v=>{if(!id(v)||!seen.has(v)||!decks.find(d=>d.deck_id===v).banlist_enabled)fail('시작 덱은 제한 적용을 켠 덱으로 등록해줘.');return v;});
  if(new Set(starters).size!==starters.length||value.applySections.starters&&!starters.length)fail('시작 덱을 한 개 이상 골라줘.');
  const chapterSet=new Set();
  const chapters=value.chapters.map(ch=>{
    fields(ch,['chapter','battle','elite','boss']);if(!integer(ch.chapter,1,3)||chapterSet.has(ch.chapter))fail('1~3장의 적 구성을 확인해줘.');chapterSet.add(ch.chapter);
    const out={chapter:ch.chapter};
    for(const role of ['battle','elite','boss']){
      const c=ch[role];fields(c,['enabled','lp_bonus','entries']);
      if(typeof c.enabled!=='boolean'||!integer(c.lp_bonus,-3000,50000)||!Array.isArray(c.entries)||c.entries.length>100||c.enabled&&!c.entries.length)fail('전투별 적용 여부·LP·덱 목록을 확인해줘.');
      const used=new Set();out[role]={enabled:c.enabled,lp_bonus:c.lp_bonus,entries:c.entries.map(e=>{
        fields(e,['deck_id','weight']);if(!id(e.deck_id)||!seen.has(e.deck_id)||used.has(e.deck_id)||!integer(e.weight,1,10000))fail('적 덱·등장 가중치를 확인해줘.');used.add(e.deck_id);return {deck_id:e.deck_id,weight:e.weight};
      })};
    }return out;
  }).sort((a,b)=>a.chapter-b.chapter);
  const settingsSet=new Set(),settings=value.settings.map(s=>{
    fields(s,['source_id','identity_key','rarity','stock','draw_enabled']);const c=index.bySource.get(s.source_id);
    if(!c?.expanded||s.identity_key!==c.identity_key||settingsSet.has(c.sourceId)||!['N','R','SR','UR'].includes(s.rarity)||typeof s.stock!=='boolean'||typeof s.draw_enabled!=='boolean')fail('추가 카드 설정을 확인해줘.');
    settingsSet.add(c.sourceId);return {...cardRef035(c),rarity:s.rarity,stock:s.stock,draw_enabled:s.draw_enabled};
  });
  return {schema:1,engine:NATIVE035_ENGINE,catalog_id:NATIVE035_CATALOG,applySections:{...value.applySections},decks,starters,chapters,settings};
}
export function parseLibrary035(value,index,options){
  if(value?.schema!==1||value.kind!=='unity-native035-library'||value.engine!==NATIVE035_ENGINE||value.catalog_id!==NATIVE035_CATALOG||!integer(value.version,0,Number.MAX_SAFE_INTEGER))fail('온라인 Unity 덱 자료를 확인할 수 없어.');
  const refs=applyReferences035(value.references,index);
  return {...value,references:{card_limits:refs.limits,characters:refs.characters},document:parseNative035(value.document,refs.index,{...options,characterIds:new Set(refs.characters.map(c=>c.id)),characterRows:refs.characters})};
}
export function applyReferences035(value,index){
  fields(value,['card_limits','characters']);
  const limits=structuredClone(limitRows(value.card_limits)),characters=structuredClone(parseCharacters(value.characters));
  const cards=index.cards.map(c=>({...c,deckLimit:c.deck_limit??c.maxCopies,speedLimit:c.speed_limit??null})),bySource=new Map(cards.map(c=>[c.sourceId,c]));
  for(const r of limits){const c=bySource.get(r.internal_id);if(!c||c.expanded||c.slot!==r.slot||c.identity_key!==r.identity_key)fail('온라인 금제와 카드 정보가 달라. 기존 덱은 유지돼.');if(r.normal_limit!==null)c.deckLimit=r.normal_limit;if(r.speed_limit!==null)c.speedLimit=r.speed_limit===-1?null:r.speed_limit;}
  return {limits,characters,index:{cards,bySource,byCode:new Map(cards.map(c=>[c.code,c]))}};
}
export function effectiveSections035(library,old){
  // Preserve old026 when Native035 is absent, version zero, lab-only, or a role is disabled.
  if(!library||library.version===0)return structuredClone(old);
  const d=library.document,out=structuredClone(old);
  if(d.applySections.starters)out.starters=structuredClone(d.starters.map(key=>d.decks.find(deck=>deck.deck_id===key)));
  if(d.applySections.chapters){out.chapters??=[];for(const chapter of d.chapters){let target=out.chapters.find(c=>c.chapter===chapter.chapter);if(!target){target={chapter:chapter.chapter};out.chapters.push(target);}for(const role of ['battle','elite','boss'])if(chapter[role].enabled)target[role]=structuredClone(chapter[role]);}}
  if(d.applySections.settings)out.nativeSettings=structuredClone(d.settings);
  return out;
}
export function assertLegacyExport035(cards){if(cards.some(c=>c.engine===NATIVE035_ENGINE||c.expanded||c.legacyExportAllowed===false))fail('Unity 전용 카드는 구형 게임 덱으로 내보낼 수 없어.');return true;}
export function filterCards035(index,{engine='all',query='',kind='all'}={}){const text=query.normalize('NFKC').toLocaleLowerCase().replace(/\s/g,'');return index.cards.filter(c=>c.playable&&!c.token&&(engine==='all'||(engine==='native')===c.expanded)&&(kind==='all'||kind==='monster'&&c.type&1||kind==='spell'&&c.type&2||kind==='trap'&&c.type&4)&&(!text||[c.name,c.nameEnglish,...(c.searchAliases??[]),String(c.code)].some(s=>s.normalize('NFKC').toLocaleLowerCase().replace(/\s/g,'').includes(text))));}
