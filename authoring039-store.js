// One database snapshot and one serial, idempotent authoring queue.
// Local storage holds only unfinished writes/recovery receipts, never a second catalog.
import {parseMapRules052,parseMapPatch052} from './authoring052-map.js?v=20261030-052';
export const PROJECT039 = 'ygoclassic-expedition';
export const IDENTITY039 = Object.freeze({base_catalog_sha256:'b73dd51c78aeab8c9beebf936b46e4cac16040e70df3a7980dec38c40db21e09',catalog035_sha256:'b5f1e9749cec0c1497c5fdcbfb2dc9c64895dcd859f083ec0ec4014580f05308',native_manifest_sha256:'4674de031c9e3044c86b90fcd402d9533d9353347802f268863746bf3bd7e4d7'});
export const LEGACY_CREATION_KEYS039 = Object.freeze([
  'poc-ai-decks-v1','poc-ai-native035-drafts-v1','poc-native035-draft-v1',
  'poc-card-catalog-reviews-v1','poc-native035-card-catalog-reviews-v1',
  'poc-ai-decks-v1-before-import','poc-ai-native035-drafts-v1-before-replace',
  'poc-native035-before-load038','poc-card-catalog-reviews-before-import037',
  'poc-card-catalog-reviews-before-reset037','poc-card-catalog-reviews-recovery037',
  'poc-card-pack-drafts-v1','yugioh-classic-campaign164-draft',
  'yugioh-classic-expedition-content166-draft','yugioh-classic-expedition-content163-draft',
  'yugioh-classic-expedition-content159-draft','yugioh-classic-expedition-content158-draft',
  'yugioh-classic-expedition-content157-draft','poc-character-editor-v1',
  'poc-character-transfer-v1','poc-character-library-v1',
  'poc-starting-deck-editor026','poc-starting-deck-backup026'
]);
const HASH = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const KINDS = new Set(['card_display','card_setting','card_annotation','card_limit','category','category_group','category_group_order','character','deck','chapter_role','starter_list','relic','event','shop_rules','map_rules','meta_pack','meta_score','recovery_archive']);
const clone = value => structuredClone(value);
const equal = (a,b) => {
  if(a===b)return true;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>equal(value,b[i]));
  if(!object(a)||!object(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(name=>Object.hasOwn(b,name)&&equal(a[name],b[name]));
};
const key = (type,id) => `${type}\n${id}`;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
function need(ok,message) { if (!ok) throw new Error(message); }
function explain(error) {
  const message=String(error?.message??error??'DB 연결을 확인해줘.');
  if(error?.code==='57014'||/statement timeout/i.test(message))return '서버 처리 시간이 초과됐습니다. 저장 요청은 보관되어 있으며 같은 요청으로 다시 확인합니다.';
  if(/unified039_duplicate_deck/.test(message+' '+String(error?.details??'')))return '같은 카드 구성의 덱이 이미 있습니다. 기존 덱을 선택해 주세요.';
  if(/unified039_encounter_settings_belong_to_chapter/.test(message+' '+String(error?.details??'')))return '상대 LP와 특성은 장별 적 편성에서 수정해 주세요. 화면을 새로고침하면 새 편집기를 사용할 수 있습니다.';
  if(/unified039_editor_required/.test(message))return '편집 권한을 확인하지 못했어. 편집 계정으로 다시 로그인해줘.';
  if(/unified039_(validation|invalid)/.test(message))return '입력값을 저장할 수 없어. 카드 매수와 항목의 허용 범위를 확인해줘.';
  return message;
}
function safe(value,depth=0) {
  need(depth < 32,'제작 데이터가 너무 깊게 중첩되어 있어.');
  if (Array.isArray(value)) { need(value.length <= 20000,'제작 데이터 항목이 너무 많아.'); for (const v of value) safe(v,depth+1); }
  else if (object(value)) for (const [k,v] of Object.entries(value)) { need(!['__proto__','constructor','prototype'].includes(k),'허용되지 않은 데이터 키야.'); safe(v,depth+1); }
  else need(value === null || ['string','boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value),'제작 데이터 형식을 확인해줘.');
  return value;
}
function validEntity(row) {
  need(object(row) && KINDS.has(row.entity_type) && typeof row.entity_id === 'string' && row.entity_id.length <= 200 && integer(row.version),'DB 항목의 식별자와 버전을 확인할 수 없어.');
  need(row.deleted === true || object(row.content),'DB 항목의 내용이 올바르지 않아.');
  if(row.entity_type==='map_rules'){need(row.entity_id==='main'&&row.deleted!==true,'맵 분포 항목을 확인해 주세요.');parseMapRules052(row.content);}
  if(row.entity_type==='category_group'){
    const text=value=>typeof value==='string'&&value.length>=1&&value.length<=40&&value===value.trim()&&!/[\u0000-\u001f\u007f]/.test(value),value=row.content;
    need(/^category-group-[a-z0-9-]{1,64}$/.test(row.entity_id)&&row.deleted!==true&&object(value)&&Object.keys(value).length===3&&text(value.name)&&typeof value.archived==='boolean'&&Array.isArray(value.categories)&&value.categories.length<=128&&value.categories.every(text)&&new Set(value.categories).size===value.categories.length,'카테고리 묶음의 이름과 포함 항목을 확인해 주세요.');
  }
  if(row.entity_type==='category_group_order'){
    const value=row.content;
    need(row.entity_id==='main'&&row.deleted!==true&&object(value)&&Object.keys(value).length===1&&Array.isArray(value.group_ids)&&value.group_ids.length<=64&&value.group_ids.every(id=>typeof id==='string'&&/^category-group-[a-z0-9-]{1,64}$/.test(id))&&new Set(value.group_ids).size===value.group_ids.length,'카테고리 묶음 순서를 확인해 주세요.');
  }
  return safe(row);
}
// New entity kinds travel outside the legacy entities array so older web and
// Unity clients can keep reading the same bootstrap and category-rename ACKs.
function categoryGroupRows055(envelope){
  if(envelope==null)return [];
  need(object(envelope)&&Object.keys(envelope).length===2&&envelope.schema===1&&Array.isArray(envelope.groups)&&envelope.groups.length<=64,'카테고리 묶음 응답을 확인할 수 없습니다.');
  const ids=new Set();
  for(const row of envelope.groups){validEntity(row);need(row.entity_type==='category_group'&&!ids.has(row.entity_id),'카테고리 묶음 목록이 중복되었습니다.');ids.add(row.entity_id);}
  return envelope.groups;
}
function categoryGroupOrderRows056(envelope){
  if(envelope==null)return [];
  need(object(envelope)&&Object.keys(envelope).length===2&&envelope.schema===1&&Object.hasOwn(envelope,'entity'),'카테고리 묶음 순서 응답을 확인할 수 없습니다.');
  if(envelope.entity===null)return [];
  validEntity(envelope.entity);need(envelope.entity.entity_type==='category_group_order','카테고리 묶음 순서 항목을 확인할 수 없습니다.');
  return [envelope.entity];
}
async function digest(text,crypto) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function normalizeBootstrap039(raw,crypto=globalThis.crypto) {
  need(object(raw) && raw.schema === 1 && raw.kind === 'unified039-bootstrap' && raw.project_id === PROJECT039 && integer(raw.project_revision) && typeof raw.unchanged === 'boolean','통합 DB 응답을 확인할 수 없어.');
  need(object(raw.permissions) && typeof raw.permissions.can_edit === 'boolean','DB 편집 권한 응답이 올바르지 않아.');
  let mapRules052=null;
  if(raw.map_rules052!==undefined){
    const envelope=raw.map_rules052;need(object(envelope)&&Object.keys(envelope).length===4&&envelope.schema===1&&integer(envelope.revision)&&typeof envelope.config_json==='string'&&envelope.config_json.length<=2048&&HASH.test(envelope.sha256),'맵 분포 응답을 확인해 주세요.');
    need(await digest(envelope.config_json,crypto)===envelope.sha256,'맵 분포의 검증값이 일치하지 않습니다.');
    mapRules052={schema:1,revision:envelope.revision,sha256:envelope.sha256,config:parseMapRules052(safe(JSON.parse(envelope.config_json)))};
  }
  const categoryGroups055=categoryGroupRows055(raw.category_groups055),categoryGroupOrder056=categoryGroupOrderRows056(raw.category_group_order056);
  if (raw.unchanged) return {...clone(raw),mapRules052};
  const graph=raw.authoring044;
  if(graph!=null){
    need(object(graph)&&graph.schema===1&&Array.isArray(graph.decks)&&graph.decks.length<=1536&&Array.isArray(graph.chapter_roles)&&graph.chapter_roles.length<=9,'공유 덱 자료의 형식을 확인할 수 없어.');
    safe(graph);const ids=new Set();
    for(const row of graph.decks){validEntity(row);need(row.entity_type==='deck'&&!row.deleted&&!ids.has(row.entity_id),'공유 덱 목록이 올바르지 않아.');ids.add(row.entity_id);}
    const roles=new Set(),encounters=new Set();
    for(const row of graph.chapter_roles){validEntity(row);need(row.entity_type==='chapter_role'&&!row.deleted&&!roles.has(row.entity_id)&&Array.isArray(row.content.entries),'장별 편성 자료가 올바르지 않아.');roles.add(row.entity_id);for(const entry of row.content.entries){need(ids.has(entry.deck_id)&&typeof entry.entry_id==='string'&&!encounters.has(entry.entry_id)&&object(entry.encounter),'장별 편성의 덱 연결이 올바르지 않아.');encounters.add(entry.entry_id);}}
    validEntity(graph.starter_list);need(graph.starter_list.entity_type==='starter_list'&&!graph.starter_list.deleted&&Array.isArray(graph.starter_list.content.entries)&&graph.starter_list.content.entries.every(entry=>ids.has(entry.deck_id)),'시작 덱 연결이 올바르지 않아.');
  }
  const env = raw.game;
  need(object(env) && env.schema === 1 && env.kind === 'poc-unified-game039' && integer(env.game_revision) && integer(env.authoring_revision) && /^\d+$/.test(env.metadata_revision) && HASH.test(env.source_fingerprint) && typeof env.payload_json === 'string','게임용 제작 데이터의 형식이 올바르지 않아.');
  need(env.authoring_revision<=raw.project_revision&&env.game_revision<=raw.project_revision&&Object.entries(IDENTITY039).every(([k,v])=>env.identity?.[k]===v),'제작 데이터의 게임 버전이 일치하지 않아.');
  need(await digest(env.payload_json,crypto) === env.source_fingerprint,'게임용 제작 데이터의 검증값이 일치하지 않아.');
  const payload = safe(JSON.parse(env.payload_json));
  for (const field of ['catalog','deck_rules035','opponents','starters','content022','meta017','characters','shop_rules']) need(payload[field] !== undefined,`게임용 ${field} 데이터가 없어.`);
  const legacyRows = raw.authoring?.entities ?? [];
  need(Array.isArray(legacyRows),'제작 항목 목록이 올바르지 않아.');
  const rows = [...legacyRows,...categoryGroups055,...categoryGroupOrder056];
  need(Array.isArray(rows),'제작 항목 목록이 올바르지 않아.');
  const seen = new Set();
  for (const row of rows) { validEntity(row); const k=key(row.entity_type,row.entity_id); need(!seen.has(k),'DB에 중복된 제작 항목이 있어.'); seen.add(k); }
  const normalized={...clone(raw),mapRules052,gameEnvelope:clone(env),gamePayload:payload,game:{...clone(env),...payload}};
  if(raw.authoring||categoryGroups055.length||categoryGroupOrder056.length)normalized.authoring={...(clone(raw.authoring)??{}),entities:clone(rows)};
  return normalized;
}

export class AuthoringStore039 {
  constructor({client,storage=globalThis.localStorage,crypto=globalThis.crypto,debounceMs=400,idleRefreshMs=400,pollMs=15000,redirectUrl=globalThis.location?.href,events=globalThis}={}) {
    need(client?.rpc && client?.auth,'DB 연결이 필요해.');
    Object.assign(this,{client,storage,crypto,debounceMs,idleRefreshMs,pollMs,redirectUrl,events});
    this.listeners=new Set(); this.queue=[]; this.user=null; this.bootstrap=null; this.phase='loading'; this.error=null; this.pendingRevision=null; this.fetchedRevision=null; this.generation=0; this.busy=false; this.stopped=false; this.failures=0; this.refreshTask=null; this.retryRequestId=null; this.retryNotBefore=0; this.conflictInfo=null;
    this.online=()=>this.retry();
  }
  subscribe(fn) { this.listeners.add(fn); fn(this.snapshot()); return ()=>this.listeners.delete(fn); }
  snapshot() {
    const entities=clone(this.bootstrap?.authoring?.entities ?? []);
    for (const q of this.queue) {
      const i=entities.findIndex(e=>key(e.entity_type,e.entity_id)===key(q.type,q.id));
      if(q.operation==='delete') { if(i>=0) entities.splice(i,1); continue; }
      const next={...(i<0?{entity_type:q.type,entity_id:q.id,version:0,state:'draft',issues:[]}:entities[i]),content:{...(entities[i]?.content??{}),...clone(q.fields)},pending:true};
      if(i<0) entities.push(next); else entities[i]=next;
    }
    const status=this.phase==='conflict'?'현재 DB와 저장 대기분을 확인해 주세요.':this.phase==='invalid'?'수정할 값을 확인해줘.':this.phase==='error'?'저장을 다시 시도할게.':this.busy?'저장 중…':this.queue.length?'변경 사항 저장 대기 중…':this.phase==='loading'?'제작 데이터 불러오는 중…':'자동 저장됨';
    const head=this.queue[0],writeState=head?{entityType:head.type,entityId:head.id,operation:head.operation,phase:this.phase,rejected:head.rejected===true,uncertain:this.phase==='error'&&Boolean(head.body),...(this.phase==='conflict'&&this.conflictInfo?{conflict:clone(this.conflictInfo)}:{})}:null;
    return {bootstrap:clone(this.bootstrap),entities,gamePayload:clone(this.bootstrap?.gamePayload??null),phase:this.phase,status,error:this.error,writeState,user:this.user?{id:this.user.id,email:this.user.email}:null,canEdit:!!this.user&&this.bootstrap?.permissions?.can_edit===true,pending:this.queue.length};
  }
  emit() { const snap=this.snapshot(); for(const fn of this.listeners) fn(snap); }
  getRow(type,id) { return this.bootstrap?.authoring?.entities?.find(e=>e.entity_type===type&&e.entity_id===id); }
  outboxKey() { return this.user?`poc-authoring039-outbox:${this.user.id}`:null; }
  persist() {
    if(!this.outboxKey()) return;
    try { this.storage?.setItem(this.outboxKey(),JSON.stringify({schema:1,items:this.queue.map(({resolve,...q})=>q)})); }
    catch { this.error='이 기기에 저장 대기분을 보관할 수 없어. DB 연결이 돌아올 때까지 이 창을 유지해줘.'; }
  }
  restore() {
    try {
      const raw=this.storage?.getItem(this.outboxKey()); if(!raw) return;
      const data=JSON.parse(raw); need(data.schema===1&&Array.isArray(data.items)&&data.items.length<=1000,'outbox');
      for(const q of data.items) {
        need(KINDS.has(q.type)&&typeof q.id==='string'&&q.id.length<=200&&['create','patch','delete'].includes(q.operation)&&object(q.fields)&&integer(q.baseVersion)&&object(q.baseContent),'outbox'); safe(q.fields);
        if(q.type==='map_rules'){need(q.id==='main'&&q.operation==='patch','outbox map rules');parseMapPatch052(q.fields);}
        if(q.type==='category_group_order'){need(q.id==='main'&&q.operation==='patch','outbox category group order');validEntity({entity_type:q.type,entity_id:q.id,version:0,content:q.fields});}
        if(q.body) { need(UUID.test(q.requestId)&&q.body.request_id===q.requestId&&q.body.project_id===PROJECT039&&q.body.schema===1&&integer(q.body.expected_project_revision),'outbox'); const c=q.body.changes; need(c?.length===1&&c[0].entity_type===q.type&&c[0].entity_id===q.id&&c[0].operation===q.operation&&c[0].expected_entity_version===q.baseVersion&&equal(c[0].fields,q.fields),'outbox'); }
      }
      this.queue=data.items.map(q=>({...q,resolve:()=>{}}));
    } catch { this.error='이전 저장 대기분을 자동으로 읽지 못했어. 원본은 보존되어 있어.'; }
  }
  async start() {
    if(!this.watching) { this.watching=true; this.events.addEventListener?.('online',this.online);
      this.authSubscription=this.client.auth.onAuthStateChange?.((_event,session)=>queueMicrotask(()=>this.acceptSession(session).catch(e=>this.setError(e)))); }
    let result;try { result=await this.client.auth.getSession(); if(result.error) throw result.error; }
    catch(error) { this.setError(error); throw error; }
    await this.acceptSession(result.data?.session??null);
    if(this.pollMs&&!this.poll) { this.poll=setInterval(()=>{const generation=this.generation;if(!this.busy&&!this.queue.length)this.refresh().catch(e=>{if(generation===this.generation)this.setError(e);});},this.pollMs); this.poll.unref?.(); }
    return this;
  }
  async acceptSession(session) {
    const id=session?.user?.id??null;
    if(this.started&&id===(this.user?.id??null)) return;
    this.started=true; this.persist(); this.generation++; const generation=this.generation; clearTimeout(this.idleTimer); this.pendingRevision=null; this.retryRequestId=null; this.retryNotBefore=0; this.conflictInfo=null; this.user=session?.user??null; this.queue=[]; this.bootstrap=null; this.fetchedRevision=null; this.phase='loading'; this.error=null; this.emit();
    try { await this.refresh(true); if(generation!==this.generation)return; if(this.snapshot().canEdit) { this.restore(); await this.archiveLegacy(); if(generation===this.generation&&this.queue.length) this.schedule(0); } }
    catch(e) { if(generation===this.generation){this.setError(e);throw e;} }
  }
  async refresh(force=false) {
    const generation=this.generation;
    if(this.stopped)return;
    const active=this.refreshTask;
    if(active){
      if(active.generation===generation&&(!force||active.force))return active.promise;
      // A forced read must still run after a conditional read fails. Requests
      // made for a new account also wait for the old read without using it.
      try{await active.promise;}catch{/* The follow-up has its own result. */}
      if(generation!==this.generation||this.stopped)return;
      return this.refresh(force||active.generation!==generation);
    }
    const task={generation,force,pendingAtStart:this.pendingRevision,canFollowAck:false,promise:null};this.refreshTask=task;
    task.promise=this.refreshOnce(force,generation).then(()=>{task.canFollowAck=true;}).catch(e=>{if(e.code==='authoring039_stale_read')task.canFollowAck=true;if(generation===this.generation)throw e;}).finally(()=>{
      if(this.refreshTask===task){
        this.refreshTask=null;
        // An idle read can have joined a request that began before its ACK.
        // Follow that new revision after a valid or locally obsolete response,
        // without looping server failures or repeatedly stale reads or
        // bypassing a queued write's backoff.
        if(task.canFollowAck&&generation===this.generation&&this.pendingRevision!==null&&this.pendingRevision>this.fetchedRevision&&this.pendingRevision>(task.pendingAtStart??0))this.scheduleIdleRefresh();
      }
    });
    return task.promise;
  }
  async refreshOnce(force,generation) {
    const result=await this.client.rpc('poc_bootstrap039',{p_view:'authoring',p_known_revision:force?null:this.fetchedRevision});
    if(generation!==this.generation)return;
    if(result.error) throw result.error;
    const next=await normalizeBootstrap039(result.data,this.crypto); if(generation!==this.generation) return;
    if(!next.unchanged) { if(this.bootstrap&&next.project_revision<this.bootstrap.project_revision){const error=Error('이전 DB 개정이 도착했어. 다시 확인할게.');error.code='authoring039_stale_read';throw error;} this.bootstrap=next; this.fetchedRevision=next.project_revision; }
    else { need(this.bootstrap,'DB가 첫 응답을 생략했어. 다시 연결해줘.'); this.bootstrap.permissions=clone(next.permissions);if(next.mapRules052){need(!this.bootstrap.mapRules052||next.mapRules052.revision>=this.bootstrap.mapRules052.revision,'이전 맵 분포가 도착했습니다. 다시 불러와 주세요.');this.bootstrap.mapRules052=clone(next.mapRules052);this.bootstrap.map_rules052=clone(next.map_rules052);} }
    if(this.pendingRevision!==null&&this.fetchedRevision>=this.pendingRevision) this.pendingRevision=null;
    if(!this.queue.length) { this.phase='ready'; this.error=null; } this.emit();
  }
  patch(type,id,fields,{operation='patch'}={}) {
    need(this.snapshot().canEdit,'편집자로 로그인해줘.'); need(KINDS.has(type)&&typeof id==='string'&&id.length>0&&id.length<=200&&object(fields)&&['create','patch','delete'].includes(operation),'저장할 항목을 확인해줘.'); safe(fields);
    if(type==='map_rules'){need(id==='main'&&operation==='patch','맵 분포는 기존 항목에서 변경해 주세요.');parseMapPatch052(fields);}
    if(type==='category_group_order'){need(id==='main'&&operation==='patch','묶음 순서는 기존 설정에서 변경해 주세요.');validEntity({entity_type:type,entity_id:id,version:0,content:fields});}
    const row=this.getRow(type,id),tail=this.queue.at(-1),rejected=this.queue.find(q=>q.rejected&&q.type===type&&q.id===id&&q.operation!=='delete');
    need(operation==='create'||row||this.queue.some(q=>q.type===type&&q.id===id&&q.operation==='create'),'수정할 DB 항목을 찾을 수 없어.');
    let q;
    if(operation==='patch'&&rejected) { q=rejected; q.fields={...q.fields,...clone(fields)}; q.rejected=false; }
    else if(operation==='patch'&&tail&&tail.type===type&&tail.id===id&&!tail.body&&tail.operation!=='delete') { q=tail; q.fields={...q.fields,...clone(fields)}; }
    else { q={type,id,operation,fields:clone(fields),baseVersion:row?.version??0,baseContent:clone(row?.content??{}),resolve:[]}; this.queue.push(q); }
    if(!Array.isArray(q.resolve)) q.resolve=[];
    const promise=new Promise(resolve=>q.resolve.push(resolve));
    this.error=null; if(this.phase!=='conflict') this.phase=this.queue[0]?.rejected?'invalid':'pending'; this.persist(); this.emit(); this.schedule(); return promise;
  }
  schedule(delay=this.debounceMs) { clearTimeout(this.timer); clearTimeout(this.idleTimer); const head=this.queue[0],retryWait=head?.body&&head.requestId===this.retryRequestId?Math.max(0,this.retryNotBefore-Date.now()):0; if(!this.stopped&&!['conflict','invalid'].includes(this.phase)) this.timer=setTimeout(()=>this.drain(),Math.max(delay,retryWait)); this.timer?.unref?.(); }
  scheduleIdleRefresh() {
    clearTimeout(this.idleTimer);
    if(this.stopped||this.busy||this.queue.length||this.pendingRevision===null) return;
    const generation=this.generation;
    this.idleTimer=setTimeout(()=>{
      if(this.stopped||this.busy||this.queue.length||this.pendingRevision===null) return;
      this.refresh().catch(e=>{if(!this.stopped&&generation===this.generation)this.setError(e);});
    },this.idleRefreshMs);
    this.idleTimer?.unref?.();
  }
  setError(error) { this.phase='error'; this.error=explain(error); this.emit(); }
  async drain() {
    if(this.busy||!this.queue.length||!this.snapshot().canEdit||['conflict','invalid'].includes(this.phase)||this.stopped) return;
    const q=this.queue[0],generation=this.generation; this.busy=true; this.emit();
    try {
      if(!q.body) { q.requestId=this.crypto.randomUUID(); q.body={schema:1,project_id:PROJECT039,request_id:q.requestId,expected_project_revision:this.bootstrap.project_revision,changes:[{entity_type:q.type,entity_id:q.id,expected_entity_version:q.baseVersion,operation:q.operation,fields:clone(q.fields)}]}; this.persist(); }
      const result=await this.client.rpc('poc_apply_intent039',{p_intent:clone(q.body)});
      if(generation!==this.generation) return;
      if(result.error) {
        if(result.error.code==='P0001'&&/^unified039_conflict(?:$|\b)/.test(result.error.message??'')) {
          await this.refresh(true); const row=this.getRow(q.type,q.id);
          const fields=Object.keys(q.fields),alreadyCurrent=q.operation==='patch'?row&&fields.every(f=>equal(row.content[f],q.fields[f])):q.operation==='delete'&&!row;
          if(alreadyCurrent){
            this.queue.shift();
            // A copied/restored predecessor may already be current. Advance
            // only its own field baselines; retain the old version so later
            // edits still check unrelated changes against their own baseline.
            if(q.operation==='patch')for(const waiting of this.queue)if(waiting.type===q.type&&waiting.id===q.id&&!waiting.body&&waiting.baseVersion===q.baseVersion)for(const field of fields)waiting.baseContent[field]=clone(row.content[field]);
            const outcome={kind:'already-current',alreadyCurrent:true,entityType:q.type,entityId:q.id,observedProjectRevision:this.bootstrap.project_revision,entity:row?clone(row):null};
            for(const resolve of Array.isArray(q.resolve)?q.resolve:[])resolve(outcome);
            this.phase=this.queue.length?'pending':'ready';this.error=null;this.failures=0;this.retryRequestId=null;this.retryNotBefore=0;this.conflictInfo=null;this.persist();return;
          }
          const compatible=q.operation==='create'?!row:q.operation==='delete'?row?.version===q.baseVersion:row&&fields.every(f=>equal(row.content[f],q.baseContent[f])||equal(row.content[f],q.fields[f]));
          if(compatible) { q.baseVersion=row?.version??0; q.baseContent=clone(row?.content??{}); delete q.body; delete q.requestId; this.phase='pending'; this.conflictInfo=null; this.persist(); }
          else { this.phase='conflict'; this.error='저장 기준과 현재 DB의 같은 항목이 달라졌습니다. 저장 대기분은 보관되어 있습니다.'; this.conflictInfo={baselineVersion:q.baseVersion,currentVersion:row?.version??null,currentMissing:!row,fields:fields.map(field=>({field,changedSinceBase:!row||!equal(row.content[field],q.baseContent[field]),alreadyDesired:!!row&&equal(row.content[field],q.fields[field])}))}; this.persist(); }
          return;
        }
        if(/unified039_(validation|invalid|forbidden|unauthorized|editor_required)/.test(result.error.message??'')) {
          // A typed server rejection certifies no mutation; a timeout does not.
          delete q.body; delete q.requestId; q.rejected=true; this.phase='invalid'; this.error=explain(result.error); this.persist(); return;
        }
        throw result.error;
      }
      const ack=result.data;
      need(ack?.schema===1&&ack.kind==='unified039-write-ack'&&ack.request_id===q.requestId&&integer(ack.applied_revision)&&integer(ack.observed_project_revision)&&Array.isArray(ack.entities),'저장 완료 응답을 확인하지 못했어. 같은 요청으로 다시 확인할게.');
      const ackRows=[...ack.entities,...categoryGroupRows055(ack.category_groups055),...categoryGroupOrderRows056(ack.category_group_order056)],ackKeys=new Set();
      for(const row of ackRows){validEntity(row);const id=key(row.entity_type,row.entity_id);need(!ackKeys.has(id),'저장 완료 항목이 중복되었습니다.');ackKeys.add(id);}
      if((HASH.test(ack.game_source_fingerprint)&&ack.game_source_fingerprint!==this.bootstrap.game?.source_fingerprint)||(Array.isArray(ack.issues)&&ack.issues.length)) this.pendingRevision=Math.max(this.pendingRevision??0,ack.applied_revision);
      if(ack.applied_revision>=this.bootstrap.project_revision) {
        for(const row of ackRows) {
          const rows=this.bootstrap.authoring.entities,i=rows.findIndex(e=>key(e.entity_type,e.entity_id)===key(row.entity_type,row.entity_id));
          if(row.deleted) { if(i>=0)rows.splice(i,1); } else if(i<0)rows.push(clone(row)); else rows[i]=clone(row);
        }
        this.bootstrap.project_revision=ack.applied_revision;
      }
      this.queue.shift();
      const acknowledged=ackRows.find(row=>row.entity_type===q.type&&row.entity_id===q.id);
      for(const waiting of this.queue)if(waiting.type===q.type&&waiting.id===q.id&&!waiting.body){
        const row=this.getRow(q.type,q.id);
        if(waiting.baseVersion===q.baseVersion&&(!acknowledged||acknowledged.deleted||row?.version===acknowledged.version)){
          waiting.baseVersion=row?.version??0;waiting.baseContent=clone(row?.content??{});
        }else if(acknowledged&&!acknowledged.deleted&&waiting.operation==='patch'&&waiting.baseVersion<=acknowledged.version){
          // A predecessor may have rebased after this edit was queued, or a
          // later snapshot may already contain unrelated changes. Carry only
          // our committed fields forward and let CAS check the other fields.
          for(const field of Object.keys(q.fields))waiting.baseContent[field]=clone(acknowledged.content[field]);
        }
      }
      for(const resolve of Array.isArray(q.resolve)?q.resolve:[]) resolve(ack);
      this.phase=this.queue.length?'pending':'ready'; this.error=null; this.failures=0; this.retryRequestId=null; this.retryNotBefore=0; this.conflictInfo=null; this.persist();
    } catch(e) { if(generation===this.generation) { this.failures++; if(q.body){this.retryRequestId=q.requestId;this.retryNotBefore=Date.now()+Math.min(30000,1000*2**Math.min(this.failures,5));} this.setError(e); } }
    finally {
      this.busy=false; this.emit();
      if(this.queue.length&&this.phase!=='conflict') this.schedule(this.phase==='error'?Math.min(30000,1000*2**Math.min(this.failures,5)):0);
      else this.scheduleIdleRefresh();
    }
  }
  retry() { if(this.phase==='conflict')return; this.retryNotBefore=0; this.error=null; const generation=this.generation;if(!this.started)return this.start().catch(e=>{if(generation===this.generation)this.setError(e);}); if(!this.bootstrap)return this.refresh(true).catch(e=>{if(generation===this.generation)this.setError(e);}); if(!this.queue.length&&this.pendingRevision!==null)return this.refresh().catch(e=>{if(generation===this.generation)this.setError(e);}); this.phase=this.queue.length?'pending':'ready'; this.schedule(0); this.emit(); }
  resolveConflict(choice) {
    need(this.phase==='conflict'&&this.queue.length,'충돌한 수정이 없어.'); const q=this.queue[0];
    if(choice==='remote') { this.queue.shift(); for(const resolve of Array.isArray(q.resolve)?q.resolve:[]) resolve({discarded:true}); }
    else { need(choice==='retry','충돌 처리 방법을 확인해줘.'); const row=this.getRow(q.type,q.id); q.baseVersion=row?.version??0; q.baseContent=clone(row?.content??{}); delete q.body; delete q.requestId; }
    this.phase=this.queue.length?'pending':'ready'; this.error=null; this.conflictInfo=null; this.persist(); this.emit(); this.schedule(0);
  }
  async archiveLegacy() {
    for(const source_key of LEGACY_CREATION_KEYS039) {
      let raw_json; try { raw_json=this.storage?.getItem(source_key); } catch { continue; }
      if(!raw_json||new TextEncoder().encode(raw_json).length>4194304) continue;
      const sha256=await digest(raw_json,this.crypto),id=await digest(source_key+'\n'+raw_json,this.crypto);
      if(this.getRow('recovery_archive',id)||this.queue.some(q=>q.type==='recovery_archive'&&q.id===id))continue;
      this.patch('recovery_archive',id,{source_key,sha256,raw_json,origin:'browser'},{operation:'create'});
    }
  }
  async login(email) { const result=await this.client.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:this.redirectUrl}}); if(result.error)throw result.error; }
  async readRecovery(id) {
    need(this.snapshot().canEdit&&HASH.test(id),'복구 자료를 열 권한을 확인해줘.');
    const result=await this.client.rpc('poc_read_recovery039',{p_id:id}); if(result.error)throw result.error;
    const row=result.data;need(object(row)&&LEGACY_CREATION_KEYS039.includes(row.source_key)&&typeof row.raw_json==='string'&&new TextEncoder().encode(row.raw_json).length<=4194304&&await digest(row.raw_json,this.crypto)===row.sha256&&await digest(row.source_key+'\n'+row.raw_json,this.crypto)===id,'복구 자료의 검증값이 다릅니다.');return row;
  }
  async logout() { this.persist(); const result=await this.client.auth.signOut(); if(result.error)throw result.error; await this.acceptSession(null); }
  stop() { this.stopped=true; clearTimeout(this.timer); clearTimeout(this.idleTimer); clearInterval(this.poll); this.events.removeEventListener?.('online',this.online); this.authSubscription?.data?.subscription?.unsubscribe(); }
}
