export const PACK_DRAFT_KEY='poc-card-pack-drafts-v1';
export const PACK_RULES=Object.freeze({price:200,cards_per_pack:5,odds:Object.freeze({UR:2,SR:6,R:42,N:50})});
const tiers=Object.keys(PACK_RULES.odds),identity=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const validPackId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const fail=message=>{throw new Error(message);};
const text=(value,max,label)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)?value:fail(`${label}을 확인해줘.`);
export function packCardRef(card){
  if(!Number.isInteger(card?.slot)||card.slot<1||card.slot>2047||!Number.isInteger(card.internal_id)||card.internal_id<0||card.internal_id>65535||!identity(card.identity_key))fail('카드 식별값을 확인해줘.');
  return {slot:card.slot,internal_id:card.internal_id,identity_key:card.identity_key,name_ko:text(card.name_ko,200,'카드 이름')};
}
export function resolvePackCard(ref,cards){
  const found=cards.filter(c=>c.internal_id===ref.internal_id&&(c.identity_key===ref.identity_key||c.previous_identity_keys?.includes(ref.identity_key)));
  return found.length===1?found[0]:undefined;
}
export function packCardEligible(card){return Boolean(card&&!card.special&&tiers.includes(card.rarity)&&card.reward_eligible===true&&card.draw_enabled!==false&&card.deck_limit!==0);}
export function newCardPack(dataset){return {schema_version:1,kind:'poc-card-pack',catalog_dataset_id:dataset,name:'새 카드팩',description:'',cover:'',enabled:false,...PACK_RULES,odds:{...PACK_RULES.odds},cards:[]};}
export function parseCardPack(value){
  if(!value||value.schema_version!==1||value.kind!=='poc-card-pack'||!identity(value.catalog_dataset_id)||value.price!==PACK_RULES.price||value.cards_per_pack!==PACK_RULES.cards_per_pack||JSON.stringify(Object.entries(value.odds||{}).sort())!==JSON.stringify(Object.entries(PACK_RULES.odds).sort())||typeof value.enabled!=='boolean'||value.cover!=='')fail('카드팩 형식·가격·확률을 확인해줘.');
  if(!Array.isArray(value.cards)||value.cards.length>2047)fail('카드팩의 카드 목록을 확인해줘.');
  const names=new Set(),slots=new Set();const cards=value.cards.map(c=>{const ref=packCardRef(c);if(names.has(ref.identity_key)||slots.has(ref.slot))fail('같은 카드가 카드팩에 두 번 있어.');names.add(ref.identity_key);slots.add(ref.slot);return ref;});
  return {schema_version:1,kind:'poc-card-pack',catalog_dataset_id:value.catalog_dataset_id,name:text(value.name,100,'카드팩 이름'),description:text(value.description,2000,'카드팩 설명'),cover:'',enabled:value.enabled,price:200,cards_per_pack:5,odds:{...PACK_RULES.odds},cards};
}
export function canonicalCardPack(value,meta,cards){
  const pack=parseCardPack(value);if(!pack.name.trim())fail('카드팩 이름을 적어줘.');
  pack.catalog_dataset_id=meta.dataset_id;pack.cards=pack.cards.map(ref=>{const card=resolvePackCard(ref,cards);if(!card||card.special)fail(`${ref.name_ko} 카드를 현재 도감에서 확인할 수 없어. 이 카드를 제거하고 다시 골라줘.`);return packCardRef(card);});return parseCardPack(pack);
}
export function cardPackRows(value){
  if(!Array.isArray(value)||value.length>100)fail('온라인 카드팩 목록을 확인할 수 없어.');
  const ids=new Set();return value.map(row=>{if(!validPackId(row?.id)||ids.has(row.id)||!Number.isSafeInteger(row.version)||row.version<1||typeof row.archived!=='boolean')fail('온라인 카드팩 버전을 확인할 수 없어.');ids.add(row.id);return {id:row.id,version:row.version,archived:row.archived,document:parseCardPack(row.document)};});
}
export function cardPackPool(value,cards){
  const pack=parseCardPack(value),buckets=Object.fromEntries(tiers.map(t=>[t,[]])),unresolved=[],excluded=[],resolvedSlots=new Set();
  for(const ref of pack.cards){const card=resolvePackCard(ref,cards);if(!card||resolvedSlots.has(card.slot))unresolved.push(ref);else{resolvedSlots.add(card.slot);if(!packCardEligible(card))excluded.push(card);else buckets[card.rarity].push(card);}}
  const missing=tiers.filter(t=>!buckets[t].length),pool_counts=Object.fromEntries(tiers.map(t=>[t,buckets[t].length]));
  const reason=unresolved.length?'현재 도감에서 확인할 수 없는 카드가 있어.':missing.length?`${missing.join(' · ')} 등급의 뽑기 대상 카드를 추가해줘.`:!pack.enabled?'판매 설정이 꺼져 있어.':'';
  return {buckets,pool_counts,missing,unresolved,excluded,available:pack.enabled&&!missing.length&&!unresolved.length,reason};
}
export function togglePackCard(value,card,cards){
  const pack=parseCardPack(value),found=pack.cards.findIndex(ref=>resolvePackCard(ref,cards)?.identity_key===card.identity_key||ref.identity_key===card.identity_key);
  if(found>=0)pack.cards.splice(found,1);else{if(!packCardEligible(card))fail('이 카드는 현재 랜덤 뽑기 대상이 아니야. 카드 도감의 등급·금제·뽑기 설정을 확인해줘.');pack.cards.push(packCardRef(card));}return pack;
}
export function parsePackDrafts(value){
  if(!value||value.schema_version!==1||!Array.isArray(value.entries)||value.entries.length>100)fail('브라우저 카드팩 편집본을 확인할 수 없어.');
  const ids=new Set();const entries=value.entries.map(entry=>{if(!validPackId(entry.id)||ids.has(entry.id)||!Number.isSafeInteger(entry.expectedVersion)||entry.expectedVersion<0)fail('카드팩 편집본의 버전을 확인해줘.');ids.add(entry.id);const baseline=entry.baseline==null?null:cardPackRows([entry.baseline])[0];return {id:entry.id,expectedVersion:entry.expectedVersion,document:parseCardPack(entry.document),baseline};});
  return {schema_version:1,active:validPackId(value.active)?value.active:'',entries};
}
export function sameCardPack(a,b){try{return JSON.stringify(parseCardPack(a))===JSON.stringify(parseCardPack(b));}catch{return false;}}
// A saved snapshot must never replace edits made while its request is in flight.
export function acceptPackSave(entry,captured,row){
  const saved=cardPackRows([row])[0];if(entry.id!==saved.id)fail('저장한 카드팩이 현재 편집본과 달라.');
  return {...entry,expectedVersion:saved.version,baseline:structuredClone(saved),document:sameCardPack(entry.document,captured)?structuredClone(saved.document):entry.document};
}
export function packCloudError(error){
  const message=error?.message||'';
  if(message.includes('poc_pack_conflict'))return '다른 곳에서 이 카드팩을 변경했어. 현재 편집본은 유지돼. 아래 저장본과 비교해줘.';
  if(message.includes('poc_editor_required')||error?.code==='42501')return '카드 도감에서 편집 권한이 있는 이메일로 로그인해줘.';
  if(message.includes('poc_pack_archived'))return '삭제된 카드팩이야. 삭제한 팩 복원에서 되돌려줘.';
  if(message.includes('poc_pack_limit'))return '카드팩은 삭제 보관본을 포함해서 100개까지야.';
  if(message.includes('poc_invalid_catalog')||message.includes('poc_invalid_pack_card'))return '카드 자료가 바뀌었어. 현재 도감에서 카드를 다시 확인해줘.';
  if(message.includes('poc_invalid_pack'))return '카드팩 이름·카드 목록·가격·확률을 확인해줘.';
  return error?.message&&!message.includes('poc_')?error.message:'온라인 카드팩 연결에 실패했어. 브라우저 편집본은 유지돼.';
}
export class CardPacksCloud{
  constructor(client){this.client=client;this.rows=null;}
  async load(){const {data,error}=await this.client.rpc('poc_load_card_packs');if(error)throw error;this.rows=cardPackRows(data);return this.rows;}
  accept(data,id){const row=cardPackRows([data])[0];if(row.id!==id)fail('카드팩 저장 결과가 달라.');this.rows=[...(this.rows||[]).filter(r=>r.id!==id),row];return row;}
  async save(id,document,expectedVersion){if(!validPackId(id)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)fail('카드팩 버전을 확인해줘.');const {data,error}=await this.client.rpc('poc_save_card_pack',{p_pack_id:id,p_document:parseCardPack(document),p_expected_version:expectedVersion});if(error)throw error;return this.accept(data,id);}
  async archive(id,expectedVersion,restore=false){if(!validPackId(id)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('카드팩 버전을 확인해줘.');const {data,error}=await this.client.rpc(restore?'poc_restore_card_pack':'poc_archive_card_pack',{p_pack_id:id,p_expected_version:expectedVersion});if(error)throw error;return this.accept(data,id);}
  async member(meta,card,id,included,expectedVersion){if(!validPackId(id)||typeof included!=='boolean'||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('카드팩 선택을 확인해줘.');const {data,error}=await this.client.rpc('poc_set_card_pack_member',{p_pack_id:id,p_dataset:meta.dataset_id,p_card:packCardRef(card),p_included:included,p_expected_version:expectedVersion});if(error)throw error;return this.accept(data,id);}
}
