import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthoringDrafts060} from '../authoring060-drafts.js';

const copy=structuredClone,tick=()=>new Promise(resolve=>setImmediate(resolve));
const row=(type,id,content={},version=1)=>({entity_type:type,entity_id:id,version,state:'saved',issues:[],content:copy(content)});
const deck=(id='d')=>row('deck',id,{name:id,deck_name:id,main:[],extra:[]});
const role=(id='1:battle')=>row('chapter_role',id,{chapter:1,role:'battle',lp_bonus:0,entries:[]});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function memory(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function mount({rows=[deck(),role()],storage=memory(),onBatch=null,onSave=null}={}){
  let canonical=copy(rows),owner='a',phase='ready',pending=0,error=null,canEdit=true,writeState=null;
  const batches=[],singles=[],snapshot=()=>({user:owner?{id:owner}:null,canEdit:canEdit&&Boolean(owner),phase,pending,error,writeState:copy(writeState),bootstrap:{authoring:{entities:copy(canonical)}},entities:copy(canonical)});
  let drafts;
  const commit=changes=>{const result=[];for(const change of changes){let next=canonical.find(r=>r.entity_type===change.type&&r.entity_id===change.id);if(!next){next=row(change.type,change.id,{},0);canonical.push(next);}next.content={...next.content,...copy(change.fields)};next.version++;result.push(copy(next));}drafts.observe(snapshot());return {kind:'unified039-write-ack',entities:result};};
  const options={storage,allowedKinds:['deck','chapter_role','character'],onSave:(type,id,fields,opts)=>{singles.push({type,id,fields:copy(fields),...opts});return onSave?onSave():commit([{type,id,fields,...opts}]);},onSaveBatch:changes=>{batches.push(copy(changes));return onBatch?onBatch(changes,commit):commit(changes);}};
  drafts=new AuthoringDrafts060(options);drafts.observe(snapshot());
  return {get drafts(){return drafts;},batches,singles,storage,snapshot,commit,remount(){drafts=new AuthoringDrafts060(options);drafts.observe(snapshot());return drafts;},setState(next){if('owner'in next)owner=next.owner;if('phase'in next)phase=next.phase;if('pending'in next)pending=next.pending;if('error'in next)error=next.error;if('canEdit'in next)canEdit=next.canEdit;if('writeState'in next)writeState=next.writeState;drafts.observe(snapshot());},remote(type,id,fields){const next=canonical.find(r=>r.entity_type===type&&r.entity_id===id);next.content={...next.content,...copy(fields)};next.version++;drafts.observe(snapshot());},remove(type,id){canonical=canonical.filter(r=>r.entity_type!==type||r.entity_id!==id);drafts.observe(snapshot());}};
}
function stage(h){h.drafts.stage('chapter_role','1:battle',{entries:[{entry_id:'enc-1',deck_id:'d',weight:1,encounter:{name:'카이바',skills:[]}}]});h.drafts.stage('deck','d',{deck_name:'함께 저장'});}

test('together sends one frozen batch in dependency order despite earlier role staging and scopes unrelated drafts',async()=>{
  const h=mount({rows:[deck(),role(),deck('other'),row('character','c',{name:'기존'})]});stage(h);h.drafts.stage('deck','other',{deck_name:'나중'});h.drafts.stage('character','c',{name:'캐릭터 초안'});
  const result=await h.drafts.saveTogether068({keys:[{type:'chapter_role',id:'1:battle'},{type:'deck',id:'d'}]});
  assert.deepEqual(result,{success:true,atomic068:true,saved:2,alreadyCurrent:0});assert.equal(h.batches.length,1);assert.equal(h.singles.length,0);assert.deepEqual(h.batches[0].map(r=>r.type),['deck','chapter_role']);assert.ok(h.batches[0].every(r=>r.baseVersion===1&&r.baseContent));assert.deepEqual(h.drafts.summary().items.map(r=>r.id),['other','c']);
});
test('generic saveAll keeps its original insertion order and never calls the batch callback',async()=>{
  const h=mount();stage(h);await h.drafts.saveAll();assert.deepEqual(h.singles.map(r=>r.type),['chapter_role','deck']);assert.equal(h.batches.length,0);
});
test('double Together Save shares one pending request and preserves edits made after its snapshot',async()=>{
  const waiting=deferred(),h=mount({onBatch:()=>waiting.promise});stage(h);const first=h.drafts.saveTogether068(),again=h.drafts.saveTogether068();assert.equal(first,again);
  h.drafts.stage('deck','d',{deck_name:'전송 뒤 수정'});h.drafts.stage('chapter_role','1:battle',{lp_bonus:700});await tick();assert.equal(h.batches.length,1);assert.equal(h.drafts.summary().submittedCount,2);assert.equal(h.batches[0][0].fields.deck_name,'함께 저장');assert.throws(()=>h.drafts.cancel(),/전송/);
  waiting.resolve(h.commit(h.batches[0]));assert.equal((await first).success,true);assert.equal(h.drafts.summary().dirtyCount,2);assert.deepEqual(h.drafts.summary().items.find(r=>r.type==='deck').fields,{deck_name:'전송 뒤 수정'});assert.deepEqual(h.drafts.summary().items.find(r=>r.type==='chapter_role').fields,{lp_bonus:700});
});
test('all selected records are validated before any write or submitted-state mutation',async()=>{
  for(const mode of ['conflict','deleted']){const h=mount();stage(h);if(mode==='conflict')h.remote('chapter_role','1:battle',{entries:[{entry_id:'remote'}]});else h.remove('chapter_role','1:battle');assert.throws(()=>h.drafts.saveTogether068(),/같은 필드|삭제/);assert.equal(h.batches.length,0);assert.equal(h.drafts.summary().submittedCount,0);assert.equal(h.drafts.summary().dirtyCount,2);}
});
test('a refresh between Save and enqueue refuses a new touched-field collision for the whole batch',async()=>{
  const h=mount();stage(h);const saving=h.drafts.saveTogether068();h.remote('chapter_role','1:battle',{entries:[{entry_id:'new-remote'}]});await assert.rejects(saving,/DB에서 같은 필드/);assert.equal(h.batches.length,0);assert.equal(h.drafts.summary().submittedCount,0);assert.equal(h.drafts.summary().dirtyCount,2);
});
test('synchronous store preflight restores every draft and permits a later corrected atomic save',async()=>{
  let reject=true;const h=mount({onBatch:(changes,commit)=>{if(reject)throw Error('편성 특성을 확인해 주세요.');return commit(changes);}});stage(h);await assert.rejects(h.drafts.saveTogether068(),/특성/);assert.equal(h.drafts.summary().submittedCount,0);assert.equal(h.drafts.summary().dirtyCount,2);assert.equal(h.snapshot().entities[0].content.deck_name,'d');reject=false;assert.equal((await h.drafts.saveTogether068()).saved,2);assert.equal(h.batches.length,2);
});
test('an unknown timeout retains every submitted member across reload and refuses independent saves',async()=>{
  const h=mount({onBatch:()=>Promise.reject(Error('network timeout'))});stage(h);await assert.rejects(h.drafts.saveTogether068(),/timeout/);assert.equal(h.drafts.summary().submittedCount,2);assert.ok(h.drafts.summary().items.every(r=>r.submitted.uncertain));
  h.remount();h.remote('deck','d',{deck_name:'함께 저장'});assert.equal(h.drafts.summary().submittedCount,2,'One matching row cannot certify an atomic request');assert.throws(()=>h.drafts.saveAll(),/기존 요청|이전 저장/);assert.throws(()=>h.drafts.saveTogether068(),/기존 요청|이전 저장/);assert.equal(h.batches.length,1);
  h.remote('chapter_role','1:battle',h.batches[0][1].fields);assert.equal(h.drafts.summary().submittedCount,0);assert.equal(h.drafts.summary().dirtyCount,0);
});
test('an incomplete batch ACK cannot settle only the deck or invent partial success',async()=>{
  const h=mount({onBatch:changes=>({kind:'unified039-write-ack',entities:[row('deck','d',{...deck().content,...changes[0].fields},2)]})});stage(h);await assert.rejects(h.drafts.saveTogether068(),/모든 항목/);assert.equal(h.drafts.summary().submittedCount,2);assert.equal(h.drafts.summary().items.length,2);
});
test('an all-current batch certificate settles all members without reporting a new mutation',async()=>{
  const h=mount({onBatch:changes=>({kind:'already-current-batch',alreadyCurrent:true,batch068:true,entities:changes.map(c=>row(c.type,c.id,{...c.baseContent,...c.fields},2))})});stage(h);assert.deepEqual(await h.drafts.saveTogether068(),{success:true,atomic068:true,saved:0,alreadyCurrent:2});assert.equal(h.drafts.summary().dirtyCount,0);
});
test('a complete authoritative ACK settles normalized deck metadata without a false conflict or partial draft',async()=>{
  const h=mount({onBatch:(changes,commit)=>commit(changes.map(change=>change.type==='deck'?{...change,fields:{...change.fields,name:'중립 덱 이름',profile_id:'yugi'}}:change))});stage(h);h.drafts.stage('deck','d',{name:'상대 표시 이름',profile_id:'kaiba'});const result=await h.drafts.saveTogether068();assert.equal(result.success,true);assert.equal(result.saved,2);assert.equal(h.drafts.summary().submittedCount,0);assert.equal(h.drafts.summary().dirtyCount,0);assert.equal(h.drafts.summary().error,null);assert.equal(h.snapshot().entities.find(r=>r.entity_type==='deck').content.profile_id,'yugi');
});
test('the batch limit and supported entity kinds fail before any callback',async()=>{
  const h=mount({rows:Array.from({length:33},(_,i)=>deck(String(i)))});for(let i=0;i<33;i++)h.drafts.stage('deck',String(i),{deck_name:'수정'});assert.throws(()=>h.drafts.saveTogether068(),/32개/);assert.equal(h.batches.length,0);assert.equal(h.drafts.summary().submittedCount,0);
  const other=mount({rows:[deck(),row('character','c',{name:'기존'})]});other.drafts.stage('deck','d',{deck_name:'덱'});other.drafts.stage('character','c',{name:'새 이름'});assert.throws(()=>other.drafts.saveTogether068(),/덱과 기존 장별 편성/);assert.equal(other.batches.length,0);
});
test('the maximum batch of32 sorts deck then role IDs and receives one ACK',async()=>{
  const rows=[...Array.from({length:24},(_,i)=>deck(String(i).padStart(2,'0'))),...Array.from({length:8},(_,i)=>role(String(i)))],h=mount({rows});for(const r of [...rows].reverse())h.drafts.stage(r.entity_type,r.entity_id,r.entity_type==='deck'?{deck_name:'수정'}:{lp_bonus:100});assert.equal((await h.drafts.saveTogether068()).saved,32);assert.equal(h.batches.length,1);assert.deepEqual(h.batches[0].slice(0,24).map(r=>r.id),rows.slice(0,24).map(r=>r.entity_id));assert.ok(h.batches[0].slice(24).every(r=>r.type==='chapter_role'));
});
test('owner changes before enqueue stop the whole operation without sending either entity',async()=>{
  const h=mount();stage(h);const saving=h.drafts.saveTogether068();h.setState({owner:'b'});assert.equal((await saving).success,false);await tick();assert.equal(h.batches.length,0);h.setState({owner:'a'});assert.equal(h.drafts.summary().dirtyCount,2);assert.equal(h.drafts.summary().submittedCount,0);
});
test('an owner switch during the submitted-state notification still prevents the batch callback',async()=>{
  const h=mount();stage(h);let switched=false;h.drafts.onChange=()=>{if(!switched&&h.drafts.summary().submittedCount){switched=true;h.setState({owner:'b'});}};assert.equal((await h.drafts.saveTogether068()).success,false);assert.equal(h.batches.length,0);h.setState({owner:'a'});assert.equal(h.drafts.summary().dirtyCount,2);assert.equal(h.drafts.summary().submittedCount,0);
});
test('missing edit rights or an existing error or pending request block every batch member',()=>{
  for(const state of [{canEdit:false},{phase:'loading'},{phase:'conflict'},{phase:'invalid'},{phase:'error',error:'network'},{pending:1}]){const h=mount();stage(h);h.setState(state);assert.throws(()=>h.drafts.saveTogether068(),/로그인|저장|연결/);assert.equal(h.batches.length,0);assert.equal(h.drafts.summary().submittedCount,0);}
});
test('a late network rejection cannot resurrect a batch already proven complete by a fresh snapshot',async()=>{
  const waiting=deferred(),h=mount({onBatch:()=>waiting.promise});stage(h);const saving=h.drafts.saveTogether068();await tick();h.commit(h.batches[0]);assert.equal(h.drafts.summary().dirtyCount,0);waiting.reject(Error('late timeout'));await assert.rejects(saving,/timeout/);assert.equal(h.drafts.summary().submittedCount,0);assert.equal(h.drafts.summary().error,null);
});
test('a late atomic ACK stays in the original owner bank and cannot clear the next owner draft',async()=>{
  const waiting=deferred(),h=mount({onBatch:()=>waiting.promise});stage(h);const saving=h.drafts.saveTogether068();await tick();h.setState({owner:'b'});h.drafts.stage('deck','d',{deck_name:'B 개인 초안'});assert.equal((await saving).ownerChanged,true);waiting.resolve({kind:'unified039-write-ack',entities:h.batches[0].map(c=>row(c.type,c.id,{...c.baseContent,...c.fields},2))});await tick();assert.equal(h.drafts.summary().items[0].fields.deck_name,'B 개인 초안');h.setState({owner:'a'});assert.equal(h.drafts.summary().submittedCount,0);
});
function rejection(h){const changes=copy(h.batches[0]);h.setState({phase:'invalid',writeState:{rejected:true,batch068:true,batchId:'batch-1',changes:changes.map(c=>({entityType:c.type,entityId:c.id}))}});return {batchId:'batch-1',changes};}
test('certified batch recovery persists all members together and keeps newer local input before release',async()=>{
  const waiting=deferred(),h=mount({onBatch:()=>waiting.promise});stage(h);const saving=h.drafts.saveTogether068();await tick();h.drafts.stage('deck','d',{deck_name:'더 최신 이름'});const value=rejection(h);assert.equal(h.drafts.recoverRejectedBatch068(value).keys.length,2);const persisted=JSON.parse(h.storage.getItem(h.drafts.storageKey()));assert.equal(persisted.items.length,2);assert.ok(persisted.items.every(r=>r.submitted===null));waiting.resolve({discarded:true});assert.equal((await saving).success,false);assert.equal(h.drafts.summary().submittedCount,0);assert.equal(h.drafts.summary().items.find(r=>r.type==='deck').fields.deck_name,'더 최신 이름');assert.equal(h.drafts.summary().dirtyCount,2);
});
test('batch recovery refuses partial members, wrong batch, no storage and quota failure without losing either input',async()=>{
  for(const mode of ['partial','wrong','null','quota']){const waiting=deferred(),h=mount({onBatch:()=>waiting.promise});stage(h);const saving=h.drafts.saveTogether068();await tick();const value=rejection(h),before=copy(h.drafts.summary().items);if(mode==='partial')value.changes.pop();if(mode==='wrong')value.batchId='other';if(mode==='null')h.drafts.storage=null;if(mode==='quota')h.storage.setItem=()=>{throw Error('quota');};assert.throws(()=>h.drafts.recoverRejectedBatch068(value),/모든 항목|현재 거절|보관소|보관하지 못해/);assert.deepEqual(h.drafts.summary().items,before);waiting.resolve({discarded:true});await saving;}
});
test('malformed persisted atomic membership never restores only the readable subset',()=>{
  const storage=memory(),h=mount({storage});stage(h);const raw={schema:1,owner:'a',items:h.drafts.summary().items.map(r=>({type:r.type,id:r.id,operation:r.operation,baseVersion:r.baseVersion,baseContent:r.type==='deck'?deck().content:role().content,fields:{},submitted:{operation:r.operation,fields:r.fields,baseVersion:r.baseVersion,baseContent:r.type==='deck'?deck().content:role().content,batchKeys068:['missing-key']}}))};const text=JSON.stringify(raw);storage.setItem(h.drafts.storageKey(),text);h.remount();assert.equal(h.drafts.summary().dirtyCount,0);assert.match(h.drafts.summary().storageError,/읽지 못/);assert.equal(storage.getItem(h.drafts.storageKey()),text);
});
