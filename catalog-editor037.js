// Match app.js's frozen projection-module URL: its WeakMap owns the view rows.
import {applyNativeCatalogSettings035} from './catalog-native035.js?v=20261026-036';
const ENGINE='unity-native-035',CATALOG='77da9b2f053f360c71441b8a493d59ed1e3a6f4007129f4ece7b7f4b7b2b94c6',LEGACY='0175b46f00f98e3766a8a8053a8e453b0415e05472b347368cc4a658bbacdd85';
const managers=new Set(['poc_rename_card_category','poc_archive_card_category','poc_restore_card_category']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
function registered(cards,slot,key){const card=cards.find(c=>c.slot===slot&&c.identity_key===key);if(!card)throw Error('카드가 현재 도감과 달라. 새로 불러온 뒤 다시 확인해줘.');return card;}
function native(card){return card.nativeOnly===true&&card.engine===ENGINE&&card.legacyExportAllowed===false;}
export function catalogError037(error){
  const message=error?.message||'';
  if(message.includes('conflict'))return '다른 곳에서 설정을 변경했어. 현재 입력은 유지돼. 설정을 새로 불러온 뒤 다시 확인해줘.';
  if(message.includes('editor_required')||['42501','42503'].includes(error?.code))return '편집 권한이 있는 이메일로 로그인해줘.';
  if(message.includes('inactive_settings'))return '다른 카드의 작성 중인 설정도 있어. 목록을 다시 불러온 뒤 적용할 설정을 확인해줘.';
  if(message.includes('invalid_catalog')||message.includes('identity'))return '카드 자료가 현재 도감과 달라. 페이지를 새로 불러와줘.';
  if(message&&!message.includes('poc_')&&message.length<400)return message;
  return '온라인 설정을 저장하지 못했어. 입력은 유지돼. 잠시 후 다시 시도해줘.';
}
// Keep CardTagsUI's existing forms, category namespace and per-row CAS. Only
// the read/save capability changes; old consumers keep their old RPC contract.
export function catalogGateway037(client,getCards){
  return {async rpc(name,args){
    const cards=typeof getCards==='function'?getCards():getCards;
    if(name==='poc_load_card_annotations')return client.rpc('poc_load_catalog037_annotations');
    if(name==='poc_save_card_annotation'){
      const card=registered(cards,args?.p_slot,args?.p_identity_key),dataset=native(card)?CATALOG:LEGACY;
      if(args.p_dataset!==LEGACY&&args.p_dataset!==dataset)throw Error('카드 목록의 버전이 달라. 페이지를 새로 불러와줘.');
      if(!Array.isArray(args.p_links)||args.p_links.length>20)throw Error('관련 카드를 확인해줘.');
      const seen=new Set();for(const ref of args.p_links){registered(cards,ref?.slot,ref?.identity_key);if(ref.slot===card.slot||seen.has(ref.slot))throw Error('관련 카드는 중복 없이 선택해줘.');seen.add(ref.slot);}
      return client.rpc('poc_save_catalog037_annotation',{...args,p_dataset:dataset});
    }
    const result=await client.rpc(name,args);
    if(result.error||!managers.has(name))return result;
    const merged=await client.rpc('poc_load_catalog037_annotations');
    if(merged.error)return {data:null,error:{...merged.error,message:'카테고리 변경은 저장했지만 목록을 다시 읽지 못했어. 설정 새로 불러오기를 눌러줘.'}};
    return merged;
  }};
}
function pendingFrom(error,cards,expected){
  if(!(error?.message||'').includes('poc_native037_inactive_settings'))return null;
  let detail;try{detail=typeof error.details==='string'?JSON.parse(error.details):error.details;}catch{return null;}
  if(!object(detail)||Object.keys(detail).length!==5||detail.schema!==1||detail.kind!=='native037-inactive-settings'||detail.catalog_id!==CATALOG||detail.version!==expected||!Array.isArray(detail.pending_settings)||detail.pending_settings.length>30)return null;
  const seen=new Set(),rows=[];
  for(const row of detail.pending_settings){
    if(!object(row)||Object.keys(row).length!==5||!integer(row.source_id)||seen.has(row.source_id)||!['N','R','SR','UR'].includes(row.rarity)||typeof row.stock!=='boolean'||typeof row.draw_enabled!=='boolean')return null;
    const card=cards.find(c=>native(c)&&c.sourceId===row.source_id&&c.identity_key===row.identity_key);if(!card)return null;
    seen.add(row.source_id);rows.push({...row,name:card.name_ko});
  }return {version:expected,rows};
}
export class NativeCatalogEditor037{
  constructor(client,getCards){this.client=client;this.getCards=typeof getCards==='function'?getCards:()=>getCards;this.library=null;}
  get ready(){return this.library!==null;}
  get version(){return this.library?.version??null;}
  accept(payload,minimum=0){const safe=structuredClone(payload);if(!integer(safe?.version)||safe.version<Math.max(minimum,this.version??0))throw Error('이전 버전의 응답은 적용하지 않았어. 설정을 다시 불러와줘.');applyNativeCatalogSettings035(this.getCards(),safe);this.library=safe;return safe;}
  async load(){const result=await this.client.rpc('poc_load_native035_library');if(result.error)throw Error(catalogError037(result.error));return this.accept(result.data);}
  async save(card,change,expected,{activatePending=false}={}){
    const cards=this.getCards(),target=registered(cards,card?.slot,card?.identity_key);
    if(!native(target)||!integer(expected)||!object(change)||!['N','R','SR','UR'].includes(change.rarity)||typeof change.stock!=='boolean'||typeof change.draw_enabled!=='boolean'||typeof activatePending!=='boolean')throw Error('Unity 카드 설정을 확인해줘.');
    const result=await this.client.rpc('poc_save_native035_card_setting',{p_catalog_id:CATALOG,p_source_id:target.sourceId,p_identity_key:target.identity_key,p_rarity:change.rarity,p_stock:change.stock,p_draw_enabled:change.draw_enabled,p_expected_version:expected,p_activate_pending:activatePending});
    if(result.error){const error=Error(catalogError037(result.error)),pending=pendingFrom(result.error,cards,expected);error.pending=pending?.rows.some(r=>r.source_id!==target.sourceId)?pending:null;throw error;}
    return this.accept(result.data,expected+1);
  }
}
