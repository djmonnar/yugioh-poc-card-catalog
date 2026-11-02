// One durable queue item maps to one atomic server intent. Legacy items stay unchanged.
export const batchChanges068=item=>item?.batch068===true?item.changes:[item];
export const batchFields068=item=>[...new Set(batchChanges068(item).flatMap(change=>Object.keys(change?.fields??{})))];
export const batchWriteState068=item=>item?.batch068===true?{batch068:true,batchId:item.batchId,changes:item.changes.map(change=>({type:change.type,id:change.id,operation:change.operation,fields:Object.keys(change.fields)}))}:{};
const allowed=change=>['deck','chapter_role'].includes(change.type)&&['create','patch'].includes(change.operation)&&!(change.type==='chapter_role'&&change.operation!=='patch');
const ordered=changes=>[...changes].sort((a,b)=>(a.type==='deck'?0:1)-(b.type==='deck'?0:1)||(a.id<b.id?-1:a.id>b.id?1:0));
const wire=change=>({entity_type:change.type,entity_id:change.id,expected_entity_version:change.baseVersion,operation:change.operation,fields:structuredClone(change.fields)});
function checkChanges(changes,c){
  c.need(Array.isArray(changes)&&changes.length>=1&&changes.length<=32,'함께 저장할 항목은 1~32개여야 합니다.');
  const seen=new Set();
  for(const change of changes){
    c.need(c.object(change)&&allowed(change)&&typeof change.id==='string'&&change.id.length>=1&&change.id.length<=200&&!/[\u0000-\u001f\u007f]/.test(change.id)&&c.object(change.fields)&&Object.keys(change.fields).length>0&&c.integer(change.baseVersion)&&c.object(change.baseContent),'함께 저장할 덱과 편성을 확인해 주세요.');
    c.safe(change.fields);c.safe(change.baseContent);const key=c.key(change.type,change.id);c.need(!seen.has(key),'같은 항목을 두 번 함께 저장할 수 없습니다.');seen.add(key);
  }
}
function persist(store,queue,c){
  const key=store.outboxKey();c.need(key&&typeof store.storage?.setItem==='function'&&typeof store.storage?.getItem==='function','저장 대기분을 이 기기에 보관할 수 없습니다. 초안은 유지됩니다.');
  const text=JSON.stringify({schema:1,items:queue.map(({resolve,...item})=>item)});
  try{store.storage.setItem(key,text);c.need(store.storage.getItem(key)===text,'storage');}
  catch{throw Error('함께 저장할 요청을 이 기기에 보관하지 못했습니다. 초안은 유지되며 다시 저장할 수 있습니다.');}
}
export function restoreBatch068(store,item,c){
  c.need(item.batch068===true&&c.UUID.test(item.batchId)&&item.owner068===store.user?.id,'outbox batch owner');
  checkChanges(item.changes,c);c.need(c.equal(item.changes,ordered(item.changes)),'outbox batch order');
  c.need(Boolean(item.body)===Boolean(item.requestId),'outbox incomplete batch request');
  if(item.body){
    c.need(c.UUID.test(item.requestId)&&item.body.request_id===item.requestId&&item.body.project_id===c.PROJECT039&&item.body.schema===1&&c.integer(item.body.expected_project_revision)&&c.equal(item.body.changes,item.changes.map(wire)),'outbox batch body');
    c.safe(item.body);
  }
  c.need(!item.rejected||!item.body&&!item.requestId,'outbox rejected batch');
}
export function enqueueBatch068(store,input,c){
  const snapshot=store.snapshot();c.need(snapshot.canEdit,'편집자로 로그인해 주세요.');
  c.need(!store.stopped&&!store.busy&&!store.queue.length&&!store.error&&!['error','conflict','invalid','loading'].includes(store.phase),'기존 저장 요청을 확인한 뒤 덱과 편성을 함께 저장해 주세요.');
  c.need(Array.isArray(input),'함께 저장할 항목을 확인해 주세요.');
  const changes=ordered(input.map(value=>{
    c.need(c.object(value),'함께 저장할 항목을 확인해 주세요.');
    const {type,id,fields,operation='patch'}=value,row=store.getRow(type,id);
    c.need(operation==='create'?!row:!!row,'함께 저장할 DB 항목이 바뀌었습니다. 초안을 확인해 주세요.');
    const baseVersion=value.baseVersion??row?.version??0,baseContent=value.baseContent??row?.content??{};
    c.need(c.integer(baseVersion)&&c.object(baseContent)&&c.object(fields),'함께 저장할 기준을 확인해 주세요.');
    if(operation==='patch')c.need(Object.keys(fields).every(field=>c.equal(row.content[field],baseContent[field])||c.equal(row.content[field],fields[field])),'DB에서 같은 필드가 바뀌었습니다. 초안은 유지됩니다.');
    return {type,id,operation,fields:c.clone(fields),baseVersion:row?.version??0,baseContent:c.clone(row?.content??{})};
  }));
  checkChanges(changes,c);
  const preview=c.clone(snapshot);
  for(const change of changes){
    c.validateAuthoringChange066(preview,change.type,change.id,change.fields,{operation:change.operation});
    const index=preview.entities.findIndex(row=>row.entity_type===change.type&&row.entity_id===change.id),row=index<0?{entity_type:change.type,entity_id:change.id,version:0,content:{}}:preview.entities[index];
    const next={...row,content:{...row.content,...c.clone(change.fields)}};if(index<0)preview.entities.push(next);else preview.entities[index]=next;
  }
  const item={batch068:true,batchId:store.crypto.randomUUID(),owner068:store.user.id,changes,resolve:[]};
  persist(store,[item],c);store.queue.push(item);
  const promise=new Promise(resolve=>item.resolve.push(resolve));store.phase='pending';store.error=null;store.conflictInfo=null;store.emit();store.schedule();return promise;
}
function rowFor(store,change){return store.getRow(change.type,change.id);}
function alreadyCurrent(store,change,c){const row=rowFor(store,change);return row&&Object.keys(change.fields).every(field=>c.equal(row.content[field],change.fields[field]));}
function compatible(store,change,c){const row=rowFor(store,change);return change.operation==='create'?!row:row&&Object.keys(change.fields).every(field=>c.equal(row.content[field],change.baseContent[field])||c.equal(row.content[field],change.fields[field]));}
function reset(store){store.error=null;store.failures=0;store.retryRequestId=null;store.retryNotBefore=0;store.conflictInfo=null;store.phase=store.queue.length?'pending':'ready';}
function advanceWaiting(store,committed,rows,entities,c){
  for(const waitingItem of store.queue.slice(1))for(const waiting of batchChanges068(waitingItem))for(const sent of committed){
    if(waitingItem.body||waiting.type!==sent.type||waiting.id!==sent.id)continue;
    const acknowledged=rows.find(row=>row.entity_type===sent.type&&row.entity_id===sent.id),current=entities.find(row=>row.entity_type===sent.type&&row.entity_id===sent.id);
    if(waiting.baseVersion===sent.baseVersion&&(!acknowledged||acknowledged.deleted||current?.version===acknowledged.version)){waiting.baseVersion=current?.version??0;waiting.baseContent=c.clone(current?.content??{});}
    else if(acknowledged&&!acknowledged.deleted&&waiting.operation==='patch'&&waiting.baseVersion<=acknowledged.version)for(const field of Object.keys(sent.fields))waiting.baseContent[field]=c.clone(acknowledged.content[field]);
  }
}
export async function drainBatch068(store,c){
  if(store.busy||!store.queue[0]?.batch068||!store.snapshot().canEdit||['conflict','invalid'].includes(store.phase)||store.stopped)return;
  const item=store.queue[0],generation=store.generation,owns=()=>generation===store.generation&&item.owner068===store.user?.id&&!store.stopped;
  store.busy=true;store.emit();
  try{
    c.need(owns(),'함께 저장할 편집 계정이 바뀌었습니다.');
    if(!item.body){item.requestId=store.crypto.randomUUID();item.body={schema:1,project_id:c.PROJECT039,request_id:item.requestId,expected_project_revision:store.bootstrap.project_revision,changes:item.changes.map(wire)};}
    persist(store,store.queue,c);if(!owns())return;
    const result=await store.client.rpc('poc_apply_intent039',{p_intent:c.clone(item.body)});if(!owns())return;
    if(result.error){
      if(result.error.code==='P0001'&&/^unified039_conflict(?:$|\b)/.test(result.error.message??'')){
        await store.refresh(true);if(!owns())return;
        if(item.changes.every(change=>alreadyCurrent(store,change,c))){
          const entities=item.changes.map(change=>c.clone(rowFor(store,change)));advanceWaiting(store,item.changes,entities,store.bootstrap.authoring.entities,c);persist(store,store.queue.slice(1),c);store.queue.shift();
          const outcome={kind:'already-current-batch',alreadyCurrent:true,batch068:true,batchId:item.batchId,entities,observedProjectRevision:store.bootstrap.project_revision};for(const resolve of Array.isArray(item.resolve)?item.resolve:[])resolve(outcome);reset(store);return;
        }
        if(item.changes.every(change=>compatible(store,change,c))){
          for(const change of item.changes){const row=rowFor(store,change);change.baseVersion=row?.version??0;change.baseContent=c.clone(row?.content??{});}delete item.body;delete item.requestId;store.phase='pending';store.conflictInfo=null;persist(store,store.queue,c);
        }else{
          const changes=item.changes.map(change=>{const row=rowFor(store,change);return {type:change.type,id:change.id,baselineVersion:change.baseVersion,currentVersion:row?.version??null,currentMissing:!row,fields:Object.keys(change.fields).map(field=>({field,changedSinceBase:!row||!c.equal(row.content[field],change.baseContent[field]),alreadyDesired:!!row&&c.equal(row.content[field],change.fields[field])}))};});
          store.phase='conflict';store.error='DB에서 덱 또는 편성의 같은 필드가 바뀌었습니다. 함께 저장할 초안 전체를 확인해 주세요.';store.conflictInfo={batch068:true,changes,fields:changes.flatMap(change=>change.fields.map(field=>({...field,type:change.type,id:change.id})))};persist(store,store.queue,c);
        }return;
      }
      if(/unified039_(validation|invalid|forbidden|unauthorized|editor_required)/.test(result.error.message??'')){
        delete item.body;delete item.requestId;item.rejected=true;item.rejectionReason=c.rejectionReason065(result.error);store.phase='invalid';store.error=c.validationInfo065(item.rejectionReason,item.changes.flatMap(change=>Object.keys(change.fields))).message;persist(store,store.queue,c);return;
      }throw result.error;
    }
    const ack=result.data;
    c.need(ack?.schema===1&&ack.kind==='unified039-write-ack'&&ack.request_id===item.requestId&&c.integer(ack.applied_revision)&&c.integer(ack.observed_project_revision)&&Array.isArray(ack.entities),'함께 저장한 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인합니다.');
    const rows=[...ack.entities,...c.categoryGroupRows055(ack.category_groups055),...c.categoryGroupOrderRows056(ack.category_group_order056)],seen=new Set();
    for(const row of rows){c.validEntity(row);const key=c.key(row.entity_type,row.entity_id);c.need(!seen.has(key),'함께 저장한 응답에 중복 항목이 있습니다.');seen.add(key);}
    // The server can normalize accepted metadata. Its complete versioned ACK
    // is authoritative; field equality is reserved for no-write CAS proofs.
    for(const change of item.changes){const row=rows.find(row=>row.entity_type===change.type&&row.entity_id===change.id);c.need(row&&!row.deleted&&row.version===ack.applied_revision,'함께 저장한 항목 전체를 확인하지 못했습니다. 같은 요청으로 다시 확인합니다.');}
    const next=c.clone(store.bootstrap);
    if(ack.applied_revision>=next.project_revision){
      for(const row of rows){const index=next.authoring.entities.findIndex(value=>value.entity_type===row.entity_type&&value.entity_id===row.entity_id);if(row.deleted){if(index>=0)next.authoring.entities.splice(index,1);}else if(index<0)next.authoring.entities.push(c.clone(row));else next.authoring.entities[index]=c.clone(row);}next.project_revision=ack.applied_revision;
    }
    advanceWaiting(store,item.changes,rows,next.authoring.entities,c);persist(store,store.queue.slice(1),c);
    if(c.HASH.test(ack.game_source_fingerprint)&&ack.game_source_fingerprint!==store.bootstrap.game?.source_fingerprint||Array.isArray(ack.issues)&&ack.issues.length)store.pendingRevision=Math.max(store.pendingRevision??0,ack.applied_revision);
    store.bootstrap=next;store.queue.shift();for(const resolve of Array.isArray(item.resolve)?item.resolve:[])resolve(ack);reset(store);
  }catch(error){if(owns()){
    if(item.rejected||store.phase==='conflict'){store.phase=item.rejected?'invalid':'conflict';store.error=error.message??String(error);store.emit();}
    else{store.failures++;if(item.body){store.retryRequestId=item.requestId;store.retryNotBefore=Date.now()+Math.min(30000,1000*2**Math.min(store.failures,5));}store.setError(error);}
  }}
  finally{if(generation===store.generation){store.busy=false;store.emit();if(store.queue.length&&store.phase!=='conflict')store.schedule(store.phase==='error'?Math.min(30000,1000*2**Math.min(store.failures,5)):0);else store.scheduleIdleRefresh();}}
}
export function getRejectedBatch068(store,c){
  const item=store.queue[0];c.need(store.snapshot().canEdit&&store.phase==='invalid'&&!store.busy&&item?.batch068===true&&item.owner068===store.user?.id&&item.rejected===true&&!item.body&&!item.requestId,'서버가 거절한 함께 저장 요청만 초안으로 돌릴 수 있습니다.');
  return c.clone({batchId:item.batchId,changes:item.changes});
}
export function releaseRejectedBatch068(store,{batchId}={},c){
  const record=getRejectedBatch068(store,c);c.need(record.batchId===batchId,'함께 저장할 요청이 바뀌었습니다. 다시 확인해 주세요.');const item=store.queue[0];
  persist(store,store.queue.slice(1),c);store.queue.shift();for(const resolve of Array.isArray(item.resolve)?item.resolve:[])resolve({discarded:true,batch068:true,batchId});reset(store);store.emit();store.schedule(0);return record;
}
export function resolveBatchConflict068(store,choice,c){
  const item=store.queue[0];c.need(store.phase==='conflict'&&item?.batch068===true&&item.owner068===store.user?.id,'충돌한 함께 저장 요청을 확인해 주세요.');
  if(choice==='remote'){persist(store,store.queue.slice(1),c);store.queue.shift();for(const resolve of Array.isArray(item.resolve)?item.resolve:[])resolve({discarded:true,batch068:true,batchId:item.batchId});}
  else{
    c.need(choice==='retry','충돌 처리 방법을 확인해 주세요.');for(const change of item.changes){const row=rowFor(store,change);c.need(change.operation==='create'?!row:!!row,'항목이 생성되거나 삭제됐습니다. 초안을 먼저 확인해 주세요.');}
    for(const change of item.changes){const row=rowFor(store,change);change.baseVersion=row?.version??0;change.baseContent=c.clone(row?.content??{});}delete item.body;delete item.requestId;persist(store,store.queue,c);
  }reset(store);store.emit();store.schedule(0);
}
