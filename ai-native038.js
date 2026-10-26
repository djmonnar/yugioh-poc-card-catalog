// Adapter for the existing AI builder. Native035 owns the wire/store; legacy
// deck packets and their browser keys never pass through this module.
import {NATIVE035_ENGINE,NATIVE035_CATALOG,emptyNative035,parseNative035,cardRef035,isExtra035} from './native035-core.js';
import {NativeCloud035} from './native035-cloud.js';

export const NATIVE_DRAFT_KEY038='poc-ai-native035-drafts-v1';
export const NATIVE_DRAFT_BACKUP_KEY038=NATIVE_DRAFT_KEY038+'-before-replace';
export const NATIVE_DRAFT_KIND038='unity-native035-ai-builder-draft';
const clone=structuredClone,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const fail=m=>{throw Error(m);};
const deckId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);

export function assertNativeViews038(index,views){
  if(index?.cards?.length!==1456||!Array.isArray(views)||views.length!==1456)fail('Unity 카드 목록의 수가 다릅니다.');
  const seen=new Set();
  for(const view of views){
    const c=index.bySource.get(view.internal_id);
    if(!c||seen.has(c.sourceId)||view.slot!==c.slot||view.identity_key!==c.identity_key||view.code!=null&&view.code!==c.code||Boolean(view.nativeOnly)!==Boolean(c.expanded))fail('카드 도감과 Unity 카드 번호가 다릅니다.');
    if(c.expanded&&(view.engine!==NATIVE035_ENGINE||view.legacyExportAllowed!==false||view.nativeType035!==c.type))fail('Unity 추가 카드의 엔진 정보가 다릅니다.');
    seen.add(c.sourceId);
  }return true;
}
function oneDeck(typed,index,allowIncomplete){
  if(!object(typed)||typeof typed.name!=='string'||typed.name.length>100)fail('덱 이름을 100자 이내로 입력하세요.');
  const emptyName=allowIncomplete&&!typed.name.trim(),doc=emptyNative035();
  doc.decks=[emptyName?{...typed,name:'편집 중인 덱'}:typed];
  const parsed=parseNative035(doc,index,{allowIncomplete}).decks[0];
  // An incomplete local draft keeps the exact empty name for later editing.
  if(emptyName)parsed.name=typed.name;return parsed;
}
export function toBuilderNative038(typed,index,views=null){
  const d=oneDeck(typed,index,true),browse=views?new Map(views.map(c=>[c.internal_id,c])):null;
  const section=rows=>rows.map(r=>{const c=index.bySource.get(r.source_id),view=browse?.get(c.sourceId);return {identity_key:c.identity_key,slot:c.slot,internal_id:c.sourceId,name_ko:view?.name_ko??c.name,name_en:view?.name_en??c.nameEnglish,count:r.count};});
  return {deck_id:d.deck_id,name:d.name,ruleset:'duel_links_plan',banlist_enabled:d.banlist_enabled,difficulty:3,
    character_id:d.character_id,character_skill_profile_id:d.character_skill_profile_id,
    strategy:{goal:'',priorities:'',combos:'',avoid:''},groups:{main:section(d.main),extra:section(d.extra),side:[]}};
}
export function fromBuilderNative038(ui,index,{allowIncomplete=false}={}){
  if(!object(ui)||!deckId(ui.deck_id)||!object(ui.groups)||ui.ruleset!==undefined&&ui.ruleset!=='duel_links_plan')fail('Unity 원정은 메인 덱 20~30장 형식으로 만드세요.');
  if(!Array.isArray(ui.groups.side??[])||(ui.groups.side??[]).length)fail('Unity 원정에는 사이드 덱을 사용할 수 없습니다. 원본 덱은 그대로 보관하세요.');
  const section=(rows,extra)=>{
    if(!Array.isArray(rows))fail('메인·엑스트라 덱 목록을 확인하세요.');
    return rows.map(r=>{
      const c=index.bySource.get(r?.internal_id);
      if(!c||c.slot!==r.slot||c.identity_key!==r.identity_key||!c.playable||c.token||isExtra035(c)!==extra||!integer(r.count,1,3))fail('덱 카드의 번호·종류·매수를 확인하세요.');
      return {...cardRef035(c),count:r.count};
    });
  };
  const typed={deck_id:ui.deck_id,name:ui.name,character_id:ui.character_id??null,character_skill_profile_id:ui.character_skill_profile_id??null,use_shared_skills:true,
    banlist_enabled:ui.banlist_enabled===undefined?false:ui.banlist_enabled,main:section(ui.groups.main,false),extra:section(ui.groups.extra,true)};
  return oneDeck(typed,index,allowIncomplete);
}
export function validateBuilderNative038(ui,index){
  const amount=rows=>Array.isArray(rows)?rows.reduce((sum,r)=>sum+(Number.isSafeInteger(r?.count)?r.count:0),0):0;
  const counts={main:amount(ui?.groups?.main),extra:amount(ui?.groups?.extra),side:amount(ui?.groups?.side)},issues=[];
  try{fromBuilderNative038(ui,index);}catch(error){issues.push(error.message);}
  return {counts,issues,ready_for_game:issues.length===0};
}
export function adjustBuilderNative038(ui,card,group,delta,index){
  if(!['main','extra'].includes(group)||![1,-1].includes(delta))fail('Unity 원정의 카드 이동 위치를 확인하세요.');
  const c=index.bySource.get(card?.internal_id??card?.sourceId);
  if(!c||c.identity_key!==card.identity_key||c.slot!==card.slot||!c.playable||c.token||isExtra035(c)!==(group==='extra'))fail('이 카드는 선택한 덱 위치에 넣을 수 없습니다.');
  const next=clone(ui),rows=next.groups[group],existing=rows.find(r=>r.internal_id===c.sourceId);
  if(delta<0){if(!existing)return ui;existing.count--;if(!existing.count)next.groups[group]=rows.filter(r=>r!==existing);}
  else if(existing)existing.count++;
  else rows.push({identity_key:c.identity_key,slot:c.slot,internal_id:c.sourceId,name_ko:card.name_ko??c.name,name_en:card.name_en??c.nameEnglish,count:1});
  fromBuilderNative038(next,index,{allowIncomplete:true});Object.assign(ui,next);return ui;
}
function parseDraft(value,index){
  if(!object(value)||value.schema!==1||value.kind!==NATIVE_DRAFT_KIND038||value.engine!==NATIVE035_ENGINE||value.catalog_id!==NATIVE035_CATALOG||Object.keys(value).some(k=>!['schema','kind','engine','catalog_id','decks','active','baseVersion'].includes(k))||!Array.isArray(value.decks)||value.decks.length>200||value.baseVersion!==null&&!integer(value.baseVersion,0,Number.MAX_SAFE_INTEGER))fail('Unity AI 덱 편집본의 형식·버전이 다릅니다. 원본 JSON을 보관하세요.');
  const seen=new Set(),decks=value.decks.map(d=>{const parsed=oneDeck(d,index,true);if(seen.has(parsed.deck_id))fail('Unity 편집본의 덱 ID가 중복되었습니다.');seen.add(parsed.deck_id);return parsed;});
  if(value.active!==null&&(!deckId(value.active)||!seen.has(value.active)))fail('Unity 편집본에서 선택한 덱을 찾을 수 없습니다.');
  return {...value,decks};
}
export function loadNativeDraft038(storage,index){
  let raw=null;
  try{
    raw=storage.getItem(NATIVE_DRAFT_KEY038);
    if(raw===null)return {decks:[],active:null,baseVersion:null,present:false,blocked:false,error:null,raw};
    if(raw.length>4000000)fail('Unity AI 편집본이 너무 큽니다. 원본 JSON을 보관하세요.');
    const p=parseDraft(JSON.parse(raw),index);
    return {decks:p.decks.map(d=>toBuilderNative038(d,index)),active:p.active,baseVersion:p.baseVersion,present:true,blocked:false,error:null,raw};
  }catch(error){return {decks:[],active:null,baseVersion:null,present:raw!==null,blocked:true,error:error.message,raw};}
}
export function saveNativeDraft038(storage,index,{decks,active,baseVersion},{backup=false}={}){
  if(!Array.isArray(decks))fail('Unity AI 편집본의 덱 목록을 확인하세요.');
  const p=parseDraft({schema:1,kind:NATIVE_DRAFT_KIND038,engine:NATIVE035_ENGINE,catalog_id:NATIVE035_CATALOG,decks:decks.map(d=>fromBuilderNative038(d,index,{allowIncomplete:true})),active,baseVersion},index);
  let before=null;
  try{
    before=storage.getItem(NATIVE_DRAFT_KEY038);
    if(before!==null){if(!backup)parseDraft(JSON.parse(before),index);else storage.setItem(NATIVE_DRAFT_BACKUP_KEY038,before);}
    const text=JSON.stringify(p);if(text.length>4000000)fail('Unity AI 편집본이 너무 큽니다. JSON을 내려받아 보관하세요.');
    storage.setItem(NATIVE_DRAFT_KEY038,text);return p;
  }catch(cause){const error=Error('Unity 편집본을 저장하지 못했습니다. 기존 저장과 현재 편집 내용을 JSON으로 보관하세요. '+cause.message);error.cause=cause;error.recoveryRaw=before;throw error;}
}
export class NativeSession038{
  #cloud;#book=null;#busy=false;
  constructor(client,index){
    // Validate versions before NativeCloud035.accept can replace its index.
    const guarded={rpc:async(name,args)=>{
      const result=await client.rpc(name,args);if(result?.error)return result;
      if(name==='poc_save_native035_library'&&(!integer(result?.data?.version,0,Number.MAX_SAFE_INTEGER)||result.data.version!==args.p_expected_version+1))fail('저장 응답의 온라인 버전이 다릅니다. 편집본을 보관하고 다시 확인하세요.');
      if(name==='poc_load_native035_library'&&this.#book&&result?.data?.version<this.#book.version)fail('이전에 확인한 온라인 버전보다 오래된 응답입니다. 현재 편집본을 유지합니다.');
      return result;
    }};
    this.#cloud=new NativeCloud035(guarded,index);
  }
  get loaded(){return this.#book!==null;}
  get busy(){return this.#busy;}
  get version(){return this.#book?.version??null;}
  get book(){return this.#book===null?null:clone(this.#book);}
  get index(){return this.#cloud.index;}
  async load(){
    if(this.#busy)fail('온라인 덱 작업이 진행 중입니다. 완료한 뒤 다시 시도하세요.');
    this.#busy=true;try{const next=await this.#cloud.load();this.#book=clone(next);return this.book;}finally{this.#busy=false;}
  }
  async saveSelected(typed,expectedVersion){
    if(this.#busy)fail('온라인 덱 작업이 진행 중입니다. 완료한 뒤 다시 시도하세요.');
    if(!this.loaded||!integer(expectedVersion,0,Number.MAX_SAFE_INTEGER)||expectedVersion!==this.version)fail('편집본의 기준 온라인 버전이 다릅니다. 편집본을 백업하고 온라인 저장본과 비교하세요.');
    const selected=oneDeck(typed,this.index,false),next=clone(this.#book.document),position=next.decks.findIndex(d=>d.deck_id===selected.deck_id);
    if(position<0)next.decks.push(selected);else next.decks[position]=selected;
    // Never load a new version here: a stale selected deck must not be rebased
    // onto fresh remote chapters, starters or settings without user review.
    this.#busy=true;try{const saved=await this.#cloud.save(next,expectedVersion);this.#book=clone(saved);return this.book;}finally{this.#busy=false;}
  }
}
