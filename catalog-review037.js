// Local review transport only. No cloud writes or executable card-effect data.
import {STORAGE_KEY, EXPORT_KIND, exportPayload, parseImport, reviewMarkdown} from './review-core.js';

export const NATIVE_REVIEW_KEY037='poc-native035-card-catalog-reviews-v1';
export const RECOVERY_KEY037='poc-card-catalog-reviews-recovery037';
export const IMPORT_BACKUP_KEY037='poc-card-catalog-reviews-before-import037';
export const RESET_BACKUP_KEY037='poc-card-catalog-reviews-before-reset037';
export const NATIVE_REVIEW_KIND037='unity-native035-card-catalog-review';
export const REVIEW_BUNDLE_KIND037='poc-card-catalog-review-bundle037';
const CATALOG='77da9b2f053f360c71441b8a493d59ed1e3a6f4007129f4ece7b7f4b7b2b94c6';
const ENGINE='unity-native-035',RECOVERY_KIND='poc-card-catalog-review-recovery037';
const keys={legacy:STORAGE_KEY,native035:NATIVE_REVIEW_KEY037};
const domains=['legacy','native035'],rowDomains=new WeakMap(),needsBackup=new WeakSet(),collisionData=new WeakMap(),storageBases=new WeakMap();
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>{throw new Error(message);};
const now=()=>new Date().toISOString();
function catalogIndex(cards){
  if(!Array.isArray(cards))fail('검토에 사용할 카드 목록을 확인하세요.');
  const byKey=new Map(),bySource=new Map(),lists={legacy:[],native035:[]};
  for(const card of cards){
    const native=card?.nativeOnly===true;
    if(!object(card)||!/^[a-f0-9]{64}$/.test(card.identity_key??''))fail('검토 카드의 식별값을 확인하세요.');
    if(native&&(card.engine!==ENGINE||card.legacyExportAllowed!==false||card.internal_id<2390||card.internal_id>2419||card.slot!==1427+card.internal_id-2390))fail('Unity 검토 카드의 정체성을 확인하세요.');
    if(!native&&(card.engine===ENGINE||card.legacyExportAllowed===false||card.internal_id>=2390&&card.internal_id<=2419))fail('기존 카드와 Unity 카드가 섞여 있습니다.');
    const domain=native?'native035':'legacy';lists[domain].push(card);
    if(bySource.has(card.internal_id))fail('검토 카드 ID가 중복되었습니다.');bySource.set(card.internal_id,{card,domain});
    for(const key of [card.identity_key,...(card.previous_identity_keys??[])]){
      if(!/^[a-f0-9]{64}$/.test(key)||byKey.has(key))fail('검토 카드의 현재·이전 식별값이 중복되었습니다.');
      byKey.set(key,{card,domain});
    }
  }
  return {byKey,bySource,lists};
}
function rowDomain(row,index){
  if(!object(row))fail('검토 항목을 확인하세요.');
  const known=index.byKey.get(row.identity_key),marked=rowDomains.get(row);
  if(known&&marked&&known.domain!==marked)fail('검토 파일의 카드 종류가 다릅니다.');
  if(known)return known.domain;
  if(marked)return marked;
  // An unmatched row has no current card to authorize its namespace.
  fail('미일치 의견의 원본 파일 종류를 확인할 수 없습니다. 원본 검토 JSON을 다시 불러오세요.');
}
function nativePayload(rows=[],unmatched=[]){return {schema_version:1,kind:NATIVE_REVIEW_KIND037,exported_at:now(),catalog:{engine:ENGINE,catalog_id:CATALOG},reviews:rows.slice().sort((a,b)=>a.slot-b.slot),unmatched_reviews:unmatched};}
function parts(meta,cards,rows,unmatched){
  const index=catalogIndex(cards),split={legacy:{valid:[],unmatched:[]},native035:{valid:[],unmatched:[]}},seen=new Set();
  for(const [items,target] of [[rows,'valid'],[unmatched,'unmatched']]){
    if(!Array.isArray(items))fail('검토 목록을 확인하세요.');
    for(const row of items){
      const domain=rowDomain(row,index),key=domain+':'+row.identity_key;
      if(seen.has(key))fail('일치 의견과 미일치 의견에 같은 카드가 중복되었습니다.');seen.add(key);
      split[domain][target].push(row);
    }
  }
  return {legacy:exportPayload(meta,split.legacy.valid,split.legacy.unmatched),native035:nativePayload(split.native035.valid,split.native035.unmatched)};
}
const count=p=>p.reviews.length+(p.unmatched_reviews??[]).length;
export function payloadReviews037(meta,cards,rows,unmatched=[]){
  const p=parts(meta,cards,rows,unmatched);
  if(!count(p.native035))return p.legacy;
  if(!count(p.legacy))return p.native035;
  return {schema_version:1,kind:REVIEW_BUNDLE_KIND037,exported_at:now(),legacy:p.legacy,native035:p.native035};
}
function parseDomain(payload,domain,index){
  if(!object(payload))fail('검토 JSON의 파일 종류를 확인하세요.');
  const all=[...(Array.isArray(payload.reviews)?payload.reviews:[]),...(Array.isArray(payload.unmatched_reviews)?payload.unmatched_reviews:[])];
  if(domain==='legacy'){
    if(payload.kind!==EXPORT_KIND)fail('기존 카드 검토 파일의 종류가 다릅니다.');
    for(const row of all)if(index.byKey.get(row?.identity_key)?.domain==='native035'||row?.internal_id>=2390&&row?.internal_id<=2419)fail('Unity 카드 의견을 기존 카드 검토 파일에 넣을 수 없습니다.');
  }else{
    if(payload.kind!==NATIVE_REVIEW_KIND037||payload.catalog?.engine!==ENGINE||payload.catalog?.catalog_id!==CATALOG||Object.keys(payload.catalog).length!==2)fail('Unity 검토 파일의 카드풀 버전이 다릅니다.');
    for(const row of all)if(index.byKey.get(row?.identity_key)?.domain==='legacy'||index.bySource.get(row?.internal_id)?.domain==='legacy')fail('기존 카드 의견을 Unity 검토 파일에 넣을 수 없습니다.');
  }
  const adapted=domain==='legacy'?payload:{...payload,kind:EXPORT_KIND,catalog:{dataset_id:CATALOG}};
  const parsed=parseImport(adapted,index.lists[domain]);
  for(const row of [...parsed.valid,...parsed.unmatched])rowDomains.set(row,domain);
  return parsed;
}
export function parseReviews037(payload,cards){
  const index=catalogIndex(cards);
  if(payload?.kind===REVIEW_BUNDLE_KIND037){
    if(payload.schema_version!==1||!object(payload.legacy)||!object(payload.native035)||Object.keys(payload).some(k=>!['schema_version','kind','exported_at','legacy','native035'].includes(k)))fail('검토 묶음의 형식을 확인하세요.');
    // Validate both namespaces before returning any imported row.
    const legacy=parseDomain(payload.legacy,'legacy',index),native=parseDomain(payload.native035,'native035',index);
    return {valid:[...legacy.valid,...native.valid],unmatched:[...legacy.unmatched,...native.unmatched]};
  }
  return parseDomain(payload,payload?.kind===NATIVE_REVIEW_KIND037?'native035':'legacy',index);
}
function semantic(value){
  if(Array.isArray(value))return value.map(semantic);
  if(!object(value))return value;
  return Object.fromEntries(Object.keys(value).filter(k=>k!=='exported_at'&&k!=='updated_at').sort().map(k=>[k,semantic(value[k])]));
}
const same=(a,b)=>JSON.stringify(semantic(a))===JSON.stringify(semantic(b));
const content=p=>({reviews:p.reviews,unmatched_reviews:p.unmatched_reviews??[]});
export function mergeReviews037(cards,currentRows,currentUnmatched,incoming,{preferIncoming=true}={}){
  const index=catalogIndex(cards),valid=new Map(),unmatched=new Map(),collisions=[];
  const put=(row,isValid,prefer)=>{
    const domain=rowDomain(row,index),key=domain+':'+row.identity_key,store=isValid?valid:unmatched;
    const previous=store.get(key);
    if(previous&&!same(previous,row))collisions.push({domain,identity_key:row.identity_key,kept:prefer?row:previous,displaced:prefer?previous:row,reason:'opinion-conflict'});
    if(!previous||prefer)store.set(key,row);
  };
  currentRows.forEach(r=>put(r,true,true));currentUnmatched.forEach(r=>put(r,false,true));
  incoming.valid.forEach(r=>put(r,true,preferIncoming));incoming.unmatched.forEach(r=>put(r,false,preferIncoming));
  for(const [key,row] of valid)if(unmatched.has(key)){
    const displaced=unmatched.get(key);unmatched.delete(key);
    collisions.push({domain:rowDomain(row,index),identity_key:row.identity_key,kept:row,displaced,reason:'matched-and-unmatched'});
  }
  for(const item of collisions){needsBackup.add(item.kept);collisionData.set(item.kept,[...(collisionData.get(item.kept)??[]),item]);}
  return {valid:[...valid.values()],unmatched:[...unmatched.values()],collisions};
}
function recoveryDocument(raw,attempted=null){return {schema_version:1,kind:RECOVERY_KIND,state:'pending',created_at:now(),before:{...raw},attempted:attempted?{...attempted}:null};}
function parseRecovery(raw){
  const p=JSON.parse(raw);
  if(p?.schema_version!==1||p.kind!==RECOVERY_KIND||!['pending','committed'].includes(p.state)||!object(p.before)||domains.some(d=>p.before[d]!==null&&typeof p.before[d]!=='string')||!object(p.attempted)||domains.some(d=>p.attempted[d]!==null&&typeof p.attempted[d]!=='string'))fail('검토 복구 기록의 형식을 확인하세요.');return p;
}
export function loadReviews037(storage,cards){
  const index=catalogIndex(cards),result={valid:[],unmatched:[],errors:[],blockedDomains:[],recoveryPayload:null,collisionRecovery:null},raw={legacy:null,native035:null},loaded={legacy:content({reviews:[]}),native035:content({reviews:[]})};
  for(const domain of domains){
    try{raw[domain]=storage.getItem(keys[domain]);if(raw[domain]!==null){const parsed=parseDomain(JSON.parse(raw[domain]),domain,index);result.valid.push(...parsed.valid);result.unmatched.push(...parsed.unmatched);loaded[domain]={reviews:parsed.valid,unmatched_reviews:parsed.unmatched};}}
    catch(error){result.blockedDomains.push(domain);result.errors.push((domain==='legacy'?'기존':'Unity')+' 의견을 읽지 못했습니다: '+error.message);}
  }
  try{
    const saved=storage.getItem(RECOVERY_KEY037);
    if(saved!==null){const recovery=parseRecovery(saved);
      if(recovery.collisions?.length)result.collisionRecovery=recovery;
      if(recovery.state==='pending'&&!domains.every(d=>raw[d]===recovery.before[d])&&!domains.every(d=>raw[d]===recovery.attempted[d])){
        result.blockedDomains=domains.slice();result.errors.push('이전 검토 저장이 일부만 완료되었습니다. 복구 백업을 내려받아 보관하세요.');result.recoveryPayload=recovery;
      }
    }
  }catch(error){result.blockedDomains=domains.slice();result.errors.push('검토 복구 기록을 읽지 못했습니다: '+error.message);}
  if(result.errors.length&&!result.recoveryPayload)result.recoveryPayload={schema_version:1,kind:RECOVERY_KIND,state:'read-error',before:raw,errors:result.errors.slice()};
  if(!result.errors.length)storageBases.set(storage,{raw:{...raw},content:semantic(loaded)});
  return result;
}
export function persistReviews037(storage,meta,cards,rows,unmatched=[],{backupKey=null,backupPayload=null}={}){
  const p=parts(meta,cards,rows,unmatched),payload=payloadReviews037(meta,cards,rows,unmatched),raw={legacy:null,native035:null},changed=[];
  let recovery=null,backupRaw=null,backupWritten=false;const written=[],base=storageBases.get(storage);
  try{
    for(const domain of domains){
      raw[domain]=storage.getItem(keys[domain]);
      if(raw[domain]===null){
        if(base&&same(content(p[domain]),base.content[domain]))continue;
        if(base&&base.raw[domain]!==null)fail('다른 탭에서 검토 목록을 변경했습니다. 현재 의견을 내보낸 뒤 다시 불러오세요.');
        if(count(p[domain]))changed.push(domain);continue;
      }
      const previous=JSON.parse(raw[domain]),parsed=parseDomain(previous,domain,catalogIndex(cards));
      const normalized=domain==='legacy'?exportPayload(previous.catalog,parsed.valid,parsed.unmatched):nativePayload(parsed.valid,parsed.unmatched);
      if(base&&same(content(p[domain]),base.content[domain]))continue;
      if(base&&raw[domain]!==base.raw[domain]&&!same(content(normalized),content(p[domain])))fail('다른 탭에서 같은 카드 검토를 변경했습니다. 현재 의견을 내보낸 뒤 다시 불러오세요.');
      if(!same(normalized,p[domain]))changed.push(domain);
    }
    const staged=storage.getItem(RECOVERY_KEY037);
    if(staged!==null){const prior=parseRecovery(staged);if(prior.state==='pending'&&!domains.every(d=>raw[d]===prior.before[d])&&!domains.every(d=>raw[d]===prior.attempted[d]))fail('이전 검토 저장의 복구를 먼저 확인하세요.');}
    if(!changed.length){if(!base)storageBases.set(storage,{raw:{...raw},content:semantic({legacy:content(p.legacy),native035:content(p.native035)})});return {payload,changedDomains:[],durable:true};}
    if([...rows,...unmatched].some(row=>needsBackup.has(row))&&(!backupKey||!backupPayload))fail('충돌한 이전 의견을 백업한 뒤 저장하세요.');
    if(backupKey!==null){
      if(typeof backupKey!=='string'||!backupKey||Object.values(keys).includes(backupKey)||backupKey===RECOVERY_KEY037)fail('검토 백업 저장 위치를 확인하세요.');
      if(!backupPayload)fail('저장 전 검토 백업을 확인하세요.');parseReviews037(backupPayload,cards);
      if([STORAGE_KEY+'-before-import',STORAGE_KEY+'-before-reset'].includes(backupKey)&&backupPayload.kind!==EXPORT_KIND)fail('Unity 검토 백업은 별도 저장 위치를 사용하세요.');
      backupRaw=storage.getItem(backupKey);
    }
    const attempted={...raw};for(const domain of changed)attempted[domain]=JSON.stringify(p[domain]);
    recovery=recoveryDocument(raw,attempted);
    recovery.collisions=[...new Set([...rows,...unmatched].flatMap(row=>collisionData.get(row)??[]))];
    if(backupKey)recovery.beforeBackup={key:backupKey,raw:backupRaw};
    storage.setItem(RECOVERY_KEY037,JSON.stringify(recovery));
    if(backupKey){storage.setItem(backupKey,JSON.stringify(backupPayload,null,2)+'\n');backupWritten=true;}
    for(const domain of changed){storage.setItem(keys[domain],attempted[domain]);written.push(domain);}
    storage.setItem(RECOVERY_KEY037,JSON.stringify({...recovery,state:'committed'}));
    const next=base??{raw:{...raw},content:semantic({legacy:content(p.legacy),native035:content(p.native035)})};
    for(const domain of changed){next.raw[domain]=attempted[domain];next.content[domain]=semantic(content(p[domain]));}storageBases.set(storage,next);
    for(const row of [...rows,...unmatched]){needsBackup.delete(row);collisionData.delete(row);}
    return {payload,changedDomains:changed,durable:true,recoveryPayload:{...recovery,state:'committed'}};
  }catch(cause){
    const rollbackErrors=[];
    // Failed writes are before mutation, but earlier keys may already have committed.
    if(recovery)for(const domain of written){try{if(raw[domain]===null)storage.removeItem(keys[domain]);else storage.setItem(keys[domain],raw[domain]);}catch(error){rollbackErrors.push(domain+': '+error.message);}}
    if(backupWritten)try{if(backupRaw===null)storage.removeItem(backupKey);else storage.setItem(backupKey,backupRaw);}catch(error){rollbackErrors.push('backup: '+error.message);}
    const error=new Error(rollbackErrors.length?'검토 저장이 일부만 완료되어 복구가 필요합니다. 백업 JSON을 내려받아 보관하세요.':'검토를 저장하지 못했습니다. 기존 의견을 유지합니다. '+cause.message);
    error.cause=cause;error.recovery=recovery??recoveryDocument(raw);error.recoveryPayload=error.recovery;error.rollbackComplete=rollbackErrors.length===0;error.rollbackErrors=rollbackErrors;throw error;
  }
}
export function reviewRows037(payload){
  if(payload?.kind===REVIEW_BUNDLE_KIND037)return [...payload.legacy.reviews,...payload.native035.reviews];
  return payload?.reviews??[];
}
export function reviewMarkdown037(payload){
  if(payload?.kind===REVIEW_BUNDLE_KIND037)return reviewMarkdown037(payload.legacy)+'\n\n'+reviewMarkdown037(payload.native035);
  if(payload?.kind===NATIVE_REVIEW_KIND037){
    const adapted={...payload,catalog:{dataset_id:CATALOG,snapshot_date:'Unity Native035'}};
    return reviewMarkdown(adapted).replace('# Power of Chaos 카드 검토 의견','# Unity 추가 카드 검토 의견');
  }
  return reviewMarkdown(payload);
}
