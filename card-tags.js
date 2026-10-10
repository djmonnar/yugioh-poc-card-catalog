import {cloudError} from './supabase-cloud.js?v=20261006-13';
const identity=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function tagName(value){
  if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))throw new Error('카테고리 이름은 한 줄로 적어줘.');
  const name=value.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(!name||[...name].length>40)throw new Error('카테고리 이름은 1~40자로 적어줘.');return name;
}
export function annotationState(value){
  if(!value||!Array.isArray(value.categories)||value.categories.length>128||!Array.isArray(value.annotations)||value.annotations.length>2047)throw new Error('카테고리 자료를 확인할 수 없어.');
  const names=new Set();for(const c of value.categories){if(tagName(c?.name)!==c.name||names.has(c.name)||c.version!=null&&(!Number.isSafeInteger(c.version)||c.version<1))throw new Error('카테고리 이름이 중복되거나 올바르지 않아.');names.add(c.name);}
  const deleted=value.deleted_categories??[];
  if(!Array.isArray(deleted)||deleted.length>128)throw new Error('삭제한 태그 자료를 확인할 수 없어.');
  for(const c of deleted){if(tagName(c?.name)!==c.name||names.has(c.name)||!Number.isSafeInteger(c.version)||c.version<1)throw new Error('삭제한 태그 자료를 확인할 수 없어.');names.add(c.name);}
  const activeNames=new Set(value.categories.map(c=>c.name));
  const slots=new Set();for(const row of value.annotations){
    if(!row||!Number.isInteger(row.slot)||row.slot<1||row.slot>2047||!Number.isInteger(row.internal_id)||!identity(row.identity_key)||!Number.isSafeInteger(row.version)||row.version<1||slots.has(row.slot))throw new Error('카드 분류 자료를 확인할 수 없어.');
    slots.add(row.slot);validateSelection(row,row.tags,row.links,activeNames);
  }return value;
}
export function validateSelection(card,tags,links,categories){
  if(!Array.isArray(tags)||tags.length>12||new Set(tags).size!==tags.length||tags.some(t=>tagName(t)!==t||!categories.has(t)))throw new Error('등록한 카테고리를 12개까지 선택해줘.');
  if(!Array.isArray(links)||links.length>20||new Set(links.map(l=>l.slot)).size!==links.length||links.some(l=>!l||!Number.isInteger(l.slot)||l.slot<1||l.slot>2047||l.slot===card.slot||!identity(l.identity_key)))throw new Error('관련 카드는 중복 없이 20장까지 연결할 수 있어.');
}
export function annotationFor(state,card){return state?.annotations.find(r=>r.slot===card.slot&&r.internal_id===card.internal_id&&r.identity_key===card.identity_key)??null;}
export function tagMatches(state,card,tags){const row=annotationFor(state,card);return tags.every(t=>row?.tags.includes(t));}
export function relatedAnnotations(state,card,cards){
  const result=new Map(),by=new Map(cards.map(c=>[c.slot,c]));
  for(const link of annotationFor(state,card)?.links||[]){const c=by.get(link.slot);if(c?.identity_key===link.identity_key)result.set(c.slot,c);}
  for(const row of state?.annotations||[]){const c=by.get(row.slot);if(c&&annotationFor(state,c)===row&&row.links.some(l=>l.slot===card.slot&&l.identity_key===card.identity_key))result.set(c.slot,c);}
  result.delete(card.slot);return [...result.values()];
}
export class CardTagsCloud{
  constructor(client){this.client=client;this.state=null;}
  async load(){const {data,error}=await this.client.rpc('poc_load_card_annotations');if(error)throw error;this.state=annotationState(data);return this.state;}
  async create(name){name=tagName(name);const {data,error}=await this.client.rpc('poc_create_card_category',{p_name:name});if(error)throw new Error(cloudError(error));if(data?.name!==name)throw new Error('카테고리 저장 결과가 달라.');await this.load();return name;}
  categoryVersion(name,deleted=false){const category=(deleted?this.state?.deleted_categories:this.state?.categories)?.find(c=>c.name===name);if(!Number.isSafeInteger(category?.version)||category.version<1)throw new Error('설정 새로 불러오기로 태그의 현재 상태를 확인해줘.');return category.version;}
  async manage(rpc,args){
    const {data,error}=await this.client.rpc(rpc,args);
    if(error){const message=error.message||'';throw new Error(message.includes('poc_conflict')?'다른 기기에서 태그나 카드 분류를 수정했어. 설정 새로 불러오기를 눌러줘.':message.includes('poc_category_exists')?'이미 있는 태그 이름이야. 다른 이름을 적어줘.':message.includes('poc_category_deleted')?'삭제한 태그 이름이야. 태그 관리에서 먼저 복원해줘.':message.includes('poc_category_restore_full')?'복원할 카드에 태그가 이미 12개 있어. 태그를 하나 줄인 뒤 다시 복원해줘.':cloudError(error));}
    this.state=annotationState(data);return this.state;
  }
  rename(name,newName){name=tagName(name);newName=tagName(newName);return this.manage('poc_rename_card_category',{p_name:name,p_new_name:newName,p_expected_version:this.categoryVersion(name)});}
  remove(name){name=tagName(name);return this.manage('poc_archive_card_category',{p_name:name,p_expected_version:this.categoryVersion(name)});}
  restore(name){name=tagName(name);return this.manage('poc_restore_card_category',{p_name:name,p_expected_version:this.categoryVersion(name,true)});}
  version(card){if(this.state===null)throw new Error('온라인 분류를 먼저 불러와야 해.');return annotationFor(this.state,card)?.version??0;}
  async save(meta,card,tags,links,expectedVersion){
    if(!this.state||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('온라인 분류를 먼저 불러와야 해.');
    validateSelection(card,tags,links,new Set(this.state.categories.map(c=>c.name)));
    const {data,error}=await this.client.rpc('poc_save_card_annotation',{p_dataset:meta.dataset_id,p_slot:card.slot,p_identity_key:card.identity_key,p_tags:tags,p_links:links,p_expected_version:expectedVersion});
    if(error)throw new Error(cloudError(error).replace('이 덱','이 카드 분류').replace('온라인 덱','온라인 분류'));
    annotationState({categories:this.state.categories,annotations:[data]});
    if(data.slot!==card.slot||data.identity_key!==card.identity_key||data.internal_id!==card.internal_id)throw new Error('카드가 현재 도감과 달라.');
    this.state={...this.state,annotations:[...this.state.annotations.filter(r=>r.slot!==data.slot),data]};return data;
  }
}
