import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {AuthoringDrafts060} from '../authoring060-drafts.js';
import {planEnemyRoutes071,applyCommonRoutes071,effectiveLp071} from '../authoring071-route-model.js';

// Synthetic fixtures only. These tests never contact the database or parse a player save.
const copy=structuredClone,hash=x=>createHash('sha256').update(x).digest('hex');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const flush=async()=>{await tick();await tick();};
class Memory071 {
  constructor(){this.values=new Map();this.fail=false;this.writes=0;}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){if(this.fail)throw Error('synthetic quota');this.writes++;this.values.set(key,String(value));}
  removeItem(key){if(this.fail)throw Error('synthetic quota');this.values.delete(key);}
}
const row=(entity_type,entity_id,content,version=1)=>({entity_type,entity_id,content:copy(content),version,state:'saved',issues:[]});
const heal=value=>({kind:'heal_once',value,threshold:0,sourceId:-1,position:0,entries:[]});
const encounter=(name,lp=0,fields={})=>({name,deck_name:name+' deck',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:lp,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false,...copy(fields)});
const entry=(id,deckId='deck-a',fields={})=>({entry_id:id,deck_id:deckId,weight:3,encounter:encounter(id,300),...copy(fields)});
const roles071=['1:battle','1:elite','1:boss','2:battle','2:elite','2:boss','3:battle','3:elite','3:boss'];
const characters=[
  {id:'character-yugi',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',profile:{name:'Synthetic Yugi',skills:[{kind:'lp_bonus',value:500}],skill_profiles:[]}},
  {id:'character-yugi-alt',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',profile:{name:'Synthetic alternate Yugi',skills:[{kind:'lp_bonus',value:700}],skill_profiles:[{profile_id:'royal',name:'Synthetic named trait',skills:[{kind:'lp_bonus',value:1800}]}]}}
];
const cards=Array.from({length:40},(_,i)=>({source_id:i+1,code:10001+i,alias:0,identity_key:hash('synthetic071-'+i),web_slot:i+1,native_type:17,playable:true,token:false,name:'Synthetic '+i,name_english:'Synthetic '+i,description:'Synthetic fixture',rarity:'N',stock:true,draw_enabled:true,normal_limit:3,speed_limit:null}));
const deck=id=>row('deck',id,{name:id,deck_name:id,profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,main:cards.slice(id==='deck-a'?0:20,id==='deck-a'?20:40).map(c=>({source_id:c.source_id,identity_key:c.identity_key,count:1})),extra:[],lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
function initialRows(){
  return [deck('deck-a'),deck('deck-b'),...roles071.map(id=>{
    const [chapter,role]=id.split(':'),entries=id==='1:battle'?[entry('a-1','deck-a',{encounter:encounter('First',300,{skills:[heal(200)],shared_character_id:'character-yugi'})}),entry('a-2','deck-a',{weight:7,encounter:encounter('Second',800,{opening_draw_bonus:2,shared_character_id:'character-yugi-alt',shared_skill_profile_id:'royal',use_shared_skills:true})}),entry('other-1','deck-b')]:id==='2:elite'?[entry('a-3','deck-a',{weight:11,encounter:encounter('Third',0,{shared_character_id:'character-yugi-alt',shared_skill_profile_id:'royal',use_shared_skills:true,skills:[heal(400)]})})]:[];
    return row('chapter_role',id,{chapter:Number(chapter),role,lp_bonus:id==='1:battle'?250:id==='2:elite'?1400:-500,entries});
  })];
}
async function setup(t,{remote=null,storeStorage=new Memory071(),draftStorage=new Memory071()}={}){
  remote??={rows:initialRows(),revision:1,calls:[],requests:new Map(),commits:0,rejectOnce:null,offlineOnce:false,loseAckOnce:false,partialOnce:false,hold:null};
  const capabilities=JSON.parse(fs.readFileSync(new URL('./fixtures/authoring-capabilities066.json',import.meta.url),'utf8'));
  const payload=JSON.stringify({catalog:cards,deck_rules035:{rows:[]},opponents:{opponents:[],chapters:[]},starters:{starters:[]},content022:{relics:[],events:[]},meta017:{},characters,shop_rules:{}});
  const wire=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,permissions:{can_edit:true},capabilities:copy(capabilities),catalog:{cards:copy(cards)},characters:copy(characters),authoring:{entities:copy(remote.rows)},game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:1,metadata_revision:'1',identity:IDENTITY039,payload_json:payload,source_fingerprint:hash(payload)}});
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic071-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
    if(name==='poc_bootstrap039')return {data:wire()};
    assert.equal(name,'poc_apply_intent039');const intent=copy(args.p_intent);remote.calls.push(intent);
    if(remote.hold){const held=remote.hold;remote.hold=null;await held;}
    if(remote.offlineOnce){remote.offlineOnce=false;throw Error('synthetic offline');}
    if(remote.requests.has(intent.request_id))return {data:copy(remote.requests.get(intent.request_id))};
    if(remote.rejectOnce){const error=remote.rejectOnce;remote.rejectOnce=null;return {error};}
    if(intent.expected_project_revision!==remote.revision)return {error:{code:'P0001',message:'unified039_conflict'}};
    // The fake authority validates every member before committing any of them.
    for(const change of intent.changes){
      const previous=remote.rows.find(r=>r.entity_type===change.entity_type&&r.entity_id===change.entity_id);
      if((previous?.version??0)!==change.expected_entity_version)return {error:{code:'P0001',message:'unified039_conflict'}};
      if(change.entity_type==='chapter_role'&&change.fields.entries?.length>100)return {error:{code:'P0001',message:'unified039_invalid_role'}};
    }
    const revision=remote.revision+1,next=copy(remote.rows),changed=[];
    for(const change of intent.changes){
      const index=next.findIndex(r=>r.entity_type===change.entity_type&&r.entity_id===change.entity_id),updated=row(change.entity_type,change.entity_id,{...(next[index]?.content??{}),...copy(change.fields)},revision);
      if(index<0)next.push(updated);else next[index]=updated;changed.push(copy(updated));
    }
    const globalIds=next.filter(r=>r.entity_type==='chapter_role').flatMap(r=>r.content.entries.map(e=>e.entry_id));
    if(new Set(globalIds).size!==globalIds.length)return {error:{code:'P0001',message:'unified039_duplicate_global_encounter_id'}};
    remote.rows=next;remote.revision=revision;remote.commits++;
    const ack={schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:revision,observed_project_revision:revision,entities:changed,game_source_fingerprint:hash(payload),issues:[]};
    remote.requests.set(intent.request_id,copy(ack));
    if(remote.afterCommit){const callback=remote.afterCommit;remote.afterCommit=null;await callback();}
    if(remote.loseAckOnce){remote.loseAckOnce=false;throw Error('synthetic accepted but response lost');}
    if(remote.partialOnce){remote.partialOnce=false;return {data:{...copy(ack),entities:copy(ack.entities.slice(0,1))}};}
    return {data:ack};
  }};
  const store=new AuthoringStore039({client,storage:storeStorage,crypto:webcrypto,events:{},debounceMs:100000,idleRefreshMs:100000,pollMs:0});await store.start();
  const drafts=new AuthoringDrafts060({storage:draftStorage,allowedKinds:['deck','chapter_role'],onSave:(type,id,fields,options)=>store.patch(type,id,fields,options),onSaveBatch:changes=>store.patchTogether068(changes)});
  const unsubscribe=store.subscribe(snapshot=>drafts.observe(snapshot));drafts.observe(store.snapshot());
  t.after(()=>{unsubscribe();store.stop();});
  const overlay=()=>drafts.overlay(store.snapshot()).entities;
  const canonical=(type,id)=>remote.rows.find(r=>r.entity_type===type&&r.entity_id===id);
  const edit=(type,id,fields)=>{remote.revision++;const r=canonical(type,id);Object.assign(r.content,copy(fields));r.version=remote.revision;};
  return {store,drafts,remote,storeStorage,draftStorage,client,overlay,canonical,edit,unsubscribe};
}
const editTargets=()=>[{roleId:'1:battle',entryId:'a-1',create:false,encounter:{lp_bonus:1200}},{roleId:'2:elite',entryId:'a-3',create:false,encounter:{lp_bonus:1700}}];
const plan=(m,targets=editTargets())=>planEnemyRoutes071({entities:m.overlay(),deckId:'deck-a',targets});
function stage(m,planned,extra=[]){
  const changes=[...planned.changes,...extra];m.drafts.stageTogether071(changes);
  return changes.map(({type,id})=>({type,id}));
}
async function queued(m){await flush();assert.equal(m.store.queue.length,1,'One complete durable outbox item');}
async function settle(m,saving){await queued(m);await m.store.drain();const result=await saving;assert.equal(result.success,true);return result;}

test('071 all nine pools plus the shared deck travel in one real Store/DraftManager intent',async t=>{
  const m=await setup(t),before=copy(m.remote.rows),targets=roles071.map((roleId,i)=>({roleId,entryId:'new071-'+i,create:true,weight:i+1,encounter:encounter('New '+i,100*(i+1))}));
  const planned=plan(m,targets),keys=stage(m,planned,[{type:'deck',id:'deck-a',fields:{name:'Renamed',deck_name:'Renamed'}}]),saving=m.drafts.saveTogether068({keys});
  await settle(m,saving);assert.equal(m.remote.calls.length,1);assert.equal(m.remote.commits,1);assert.equal(m.remote.calls[0].changes.length,10);assert.equal(m.remote.calls[0].changes[0].entity_type,'deck');
  for(const roleId of roles071){const old=before.find(r=>r.entity_type==='chapter_role'&&r.entity_id===roleId),after=m.canonical('chapter_role',roleId);assert.equal(after.content.lp_bonus,old.content.lp_bonus);assert.deepEqual(after.content.entries.slice(0,old.content.entries.length),old.content.entries);}
  assert.equal(m.drafts.summary().dirtyCount,0);assert.equal(m.drafts.summary().submittedCount,0);
});

test('071 explicit common LP changes only selected encounters, preserving mixed traits, duplicates, weights and latest unrelated entries',async t=>{
  const m=await setup(t),originalTargets=editTargets().map(({encounter,...x})=>({...x,encounter:{}})),original=copy(originalTargets);
  const latest=copy(m.canonical('chapter_role','1:battle').content.entries);latest[1].encounter.opening_draw_bonus=3;latest.push(entry('remote-new','deck-b',{weight:19}));
  m.edit('chapter_role','1:battle',{entries:latest});await m.store.refresh(true);
  const before=copy(m.remote.rows),selected=applyCommonRoutes071(originalTargets,{lp_bonus:2200});assert.deepEqual(originalTargets,original);
  const planned=plan(m,selected),keys=stage(m,planned),saving=m.drafts.saveTogether068({keys});await settle(m,saving);
  for(const [roleId,id] of [['1:battle','a-1'],['2:elite','a-3']]){
    const old=before.find(r=>r.entity_id===roleId).content.entries.find(e=>e.entry_id===id),actual=m.canonical('chapter_role',roleId).content.entries.find(e=>e.entry_id===id);
    assert.deepEqual(actual,{...old,encounter:{...old.encounter,lp_bonus:2200}});
  }
  assert.deepEqual(m.canonical('chapter_role','1:battle').content.entries.slice(1),latest.slice(1));
  assert.equal(m.remote.calls[0].changes.length,2);
});

test('071 multiple new appearances in one pool consolidate to one entries CAS and stable retry IDs',async t=>{
  const m=await setup(t),targets=[{roleId:'3:boss',entryId:'new-a',create:true,encounter:encounter('A',400)},{roleId:'3:boss',entryId:'new-b',create:true,encounter:encounter('B',900)}],planned=plan(m,targets);
  assert.equal(planned.changes.length,1);const keys=stage(m,planned),saving=m.drafts.saveTogether068({keys});await settle(m,saving);
  assert.equal(m.remote.calls[0].changes.length,1);assert.deepEqual(m.canonical('chapter_role','3:boss').content.entries.map(e=>e.entry_id),['new-a','new-b']);
  assert.equal(plan(m,targets).changes.length,0,'Preparing the same new IDs twice must not append duplicates');
});

test('071 one invalid destination prevents local stage, outbox and RPC prefixes',async t=>{
  const m=await setup(t),before=JSON.stringify(m.overlay()),targets=editTargets();targets[1].encounter.lp_bonus=50;
  assert.throws(()=>plan(m,targets),/100/);assert.equal(JSON.stringify(m.overlay()),before);assert.equal(m.drafts.summary().dirtyCount,0);assert.equal(m.store.queue.length,0);assert.equal(m.remote.calls.length,0);
});

test('071 stageTogether rolls back all local members if a later target disappeared',async t=>{
  const m=await setup(t),planned=plan(m),before=copy(m.drafts.summary()),saved=[...m.draftStorage.values],changes=[...planned.changes,{type:'chapter_role',id:'3:missing',fields:{entries:[]}}];
  assert.throws(()=>m.drafts.stageTogether071(changes),/DB/);assert.deepEqual(m.drafts.summary().items,before.items);assert.deepEqual([...m.draftStorage.values],saved);assert.equal(m.store.queue.length,0);assert.equal(m.remote.calls.length,0);
});

test('071 a concurrent other-encounter edit conflicts the entire entries batch without committing any role',async t=>{
  const m=await setup(t),keys=stage(m,plan(m)),saving=m.drafts.saveTogether068({keys});await queued(m);
  const next=copy(m.canonical('chapter_role','1:battle').content.entries);next[1].encounter.name='Remote changed another appearance';m.edit('chapter_role','1:battle',{entries:next});
  await m.store.drain();assert.equal(m.store.phase,'conflict');assert.equal(m.remote.commits,0);assert.equal(m.drafts.summary().submittedCount,2);assert.equal(m.canonical('chapter_role','2:elite').content.entries[0].encounter.lp_bonus,0);
  m.store.resolveConflict('remote');const outcome=await saving;assert.equal(outcome.success,false);assert.equal(m.drafts.summary().submittedCount,0);assert.equal(m.drafts.summary().dirtyCount,2);assert.equal(m.canonical('chapter_role','1:battle').content.entries[1].encounter.name,'Remote changed another appearance');
});

test('071 a confirmed rejection recovers all drafts, keeps newer input, and resaves every role together',async t=>{
  const m=await setup(t),keys=stage(m,plan(m));m.remote.rejectOnce={code:'P0001',message:'unified039_invalid_encounter_reference'};
  const saving=m.drafts.saveTogether068({keys});await queued(m);await m.store.drain();assert.equal(m.store.phase,'invalid');assert.equal(m.remote.commits,0);assert.equal(m.drafts.summary().submittedCount,2);
  const newer=copy(m.overlay().find(r=>r.entity_id==='2:elite').content.entries);newer[0].encounter.lp_bonus=2400;m.drafts.stage('chapter_role','2:elite',{entries:newer});
  const rejected=m.store.getRejectedBatch068();assert.equal(rejected.changes.length,2);m.drafts.recoverRejectedBatch068(rejected);m.store.releaseRejectedBatch068({batchId:rejected.batchId});assert.equal((await saving).success,false);
  const retry=m.drafts.saveTogether068({keys});await settle(m,retry);assert.equal(m.remote.commits,1);assert.equal(m.remote.calls.length,2);assert.notEqual(m.remote.calls[0].request_id,m.remote.calls[1].request_id);assert.equal(m.canonical('chapter_role','2:elite').content.entries[0].encounter.lp_bonus,2400);assert.equal(m.canonical('chapter_role','1:battle').content.entries[0].encounter.lp_bonus,1200);
});

test('071 offline before receipt retains all submitted roles and retries the exact frozen request',async t=>{
  const m=await setup(t),keys=stage(m,plan(m));m.remote.offlineOnce=true;const saving=m.drafts.saveTogether068({keys});await queued(m);await m.store.drain();
  assert.equal(m.store.phase,'error');assert.equal(m.remote.commits,0);assert.equal(m.drafts.summary().submittedCount,2);const frozen=copy(m.store.queue[0].body);
  await m.store.drain();assert.equal((await saving).success,true);assert.equal(m.remote.commits,1);assert.deepEqual(m.remote.calls[0],m.remote.calls[1]);assert.deepEqual(m.remote.calls[1],frozen);
});

test('071 accepted-but-lost ACK and reload replay the same multi-role request once',async t=>{
  const m=await setup(t),keys=stage(m,plan(m));m.remote.loseAckOnce=true;m.drafts.saveTogether068({keys});await queued(m);await m.store.drain();
  assert.equal(m.remote.commits,1);assert.equal(m.drafts.summary().submittedCount,2);const frozen=copy(m.store.queue[0].body);m.unsubscribe();m.store.stop();
  const restored=await setup(t,{remote:m.remote,storeStorage:m.storeStorage,draftStorage:m.draftStorage});assert.equal(restored.store.queue.length,1);await restored.store.drain();await flush();
  assert.equal(restored.remote.commits,1);assert.deepEqual(restored.remote.calls.at(-1),frozen);assert.equal(restored.drafts.summary().submittedCount,0);assert.equal(restored.drafts.summary().dirtyCount,0);
});

test('071 a partial ACK cannot clear only one role or lose either draft',async t=>{
  const m=await setup(t),keys=stage(m,plan(m));m.remote.partialOnce=true;const saving=m.drafts.saveTogether068({keys});await queued(m);await m.store.drain();
  assert.equal(m.remote.commits,1);assert.equal(m.store.phase,'error');assert.equal(m.store.queue[0].changes.length,2);assert.equal(m.drafts.summary().submittedCount,2);assert.equal(m.store.bootstrap.authoring.entities.find(r=>r.entity_id==='1:battle').content.entries[0].encounter.lp_bonus,300);
  await m.store.drain();assert.equal((await saving).success,true);assert.equal(m.remote.commits,1);assert.equal(m.drafts.summary().dirtyCount,0);
});

test('071 HP preview uses official shared value rules and never writes a pool-wide bonus',async t=>{
  const m=await setup(t),role=m.canonical('chapter_role','2:elite'),current=copy(role.content.entries[0].encounter);
  assert.deepEqual(effectiveLp071(current,role,characters),{base:4000,additional:1800,region:1400,total:7200,inherited:true});
  const explicit={...current,lp_bonus:900};assert.equal(effectiveLp071(explicit,role,characters).total,6300);
  const disabled={...current,use_shared_skills:false};assert.equal(effectiveLp071(disabled,role,characters).total,5400);
  const planned=plan(m,[{roleId:'2:elite',entryId:'a-3',create:false,encounter:{lp_bonus:900}}]);assert.deepEqual(Object.keys(planned.changes[0].fields),['entries']);assert.equal(role.content.lp_bonus,1400);
});

test('071 failed local staging during an in-flight save retains ACK ownership even after a newer canonical refresh',async t=>{
  const m=await setup(t),keys=stage(m,plan(m));let release;
  m.remote.hold=new Promise(resolve=>{release=resolve;});
  const saving=m.drafts.saveTogether068({keys});await queued(m);
  const flight=m.store.drain();await flush();
  const before=copy(m.drafts.summary().items),changed=copy(m.overlay().find(r=>r.entity_id==='1:battle').content.entries);changed[0].encounter.lp_bonus=2600;
  assert.throws(()=>m.drafts.stageTogether071([{type:'chapter_role',id:'1:battle',fields:{entries:changed}},{type:'chapter_role',id:'3:missing',fields:{entries:[]}}]),/DB/);
  assert.deepEqual(m.drafts.summary().items,before);
  m.remote.afterCommit=async()=>{
    const latest=copy(m.canonical('chapter_role','2:elite').content.entries);latest.push(entry('later-remote','deck-b'));
    m.edit('chapter_role','2:elite',{entries:latest});await m.store.refresh(true);
  };
  release();await flight;assert.equal((await saving).success,true);
  assert.equal(m.remote.commits,1);assert.equal(m.store.queue.length,0);
  assert.equal(m.drafts.summary().submittedCount,0,'The full authoritative ACK must settle the original submitted records');
  assert.equal(m.drafts.summary().dirtyCount,0);assert.ok(m.canonical('chapter_role','2:elite').content.entries.some(e=>e.entry_id==='later-remote'));
});
