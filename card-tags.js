import {cloudError} from './supabase-cloud.js?v=20261006-13';
const identity=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function tagName(value){
  if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))throw new Error('카테고리 이름은 한 줄로 적어줘.');
  const name=value.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(!name||[...name].length>40)throw new Error('카테고리 이름은 1~40자로 적어줘.');return name;
}
export function annotationState(value){
  if(!value||!Array.isArray(value.categories)||value.categories.length>128||!Array.isArray(value.annotations)||value.annotations.length>1115)throw new Error('카테고리 자료를 확인할 수 없어.');
  const names=new Set();for(const c of value.categories){if(tagName(c?.name)!==c.name||names.has(c.name))throw new Error('카테고리 이름이 중복되거나 올바르지 않아.');names.add(c.name);}
  const slots=new Set();for(const row of value.annotations){
    if(!row||!Number.isInteger(row.slot)||row.slot<1||row.slot>2047||!Number.isInteger(row.internal_id)||!identity(row.identity_key)||!Number.isSafeInteger(row.version)||row.version<1||slots.has(row.slot))throw new Error('카드 분류 자료를 확인할 수 없어.');
    slots.add(row.slot);validateSelection(row,row.tags,row.links,names);
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
  version(card){if(this.state===null)throw new Error('온라인 분류를 먼저 불러와야 해.');return annotationFor(this.state,card)?.version??0;}
  async save(meta,card,tags,links,expectedVersion){
    if(!this.state||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('온라인 분류를 먼저 불러와야 해.');
    validateSelection(card,tags,links,new Set(this.state.categories.map(c=>c.name)));
    const {data,error}=await this.client.rpc('poc_save_card_annotation',{p_dataset:meta.dataset_id,p_slot:card.slot,p_identity_key:card.identity_key,p_tags:tags,p_links:links,p_expected_version:expectedVersion});
    if(error)throw new Error(cloudError(error).replace('이 덱','이 카드 분류').replace('온라인 덱','온라인 분류'));
    annotationState({categories:this.state.categories,annotations:[data]});
    if(data.slot!==card.slot||data.identity_key!==card.identity_key||data.internal_id!==card.internal_id)throw new Error('카드가 현재 도감과 달라.');
    this.state={categories:this.state.categories,annotations:[...this.state.annotations.filter(r=>r.slot!==data.slot),data]};return data;
  }
}
