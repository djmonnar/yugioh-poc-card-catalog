import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultContent157,cleanContent157,cleanLibrary157,eligibleContentCard157,LIBRARY_KIND157} from '../expedition-content157-core.js';
import {ContentCloud157,ContentSync157} from '../expedition-content157-sync.js';

const copy=structuredClone;
const library=(document=defaultContent157(),version=1)=>({schema:1,kind:LIBRARY_KIND157,version,document:copy(document),updated_at:version?'2026-10-17T00:00:00.000Z':null});
const card={identity_key:'a'.repeat(64),rarity:'N',reward_eligible:true,draw_enabled:true,deck_limit:3,speed_limit:null};
function session(initial=defaultContent157(),online=library(),baseVersion=online.version){
  let draft=copy(initial),stored=copy(online),posts=0;
  const cloud={load:async()=>copy(stored),editor:async()=>true,save:async(document,expected)=>{
    posts++;if(expected!==stored.version)throw new Error('poc_conflict');stored=library(document,stored.version+1);return copy(stored);
  }};
  const sync=new ContentSync157({cloud,getDocument:()=>draft,replaceDocument:value=>draft=value,baseVersion,baseline:baseVersion===null?null:copy(online)});
  return {sync,cloud,get draft(){return draft;},set draft(value){draft=value;},get stored(){return stored;},set stored(value){stored=value;},get posts(){return posts;}};
}

// The local release additionally checks registry parity against frozen native154
// definitions. That desktop-only parent source is not shipped in this website.
test('version zero null normalizes idempotently; custom zero policy and malformed envelopes fail',()=>{
  const empty=library(null,0),normalized=cleanLibrary157(empty);
  assert.deepEqual(cleanLibrary157(normalized),normalized);
  normalized.document.shop.card_count=6;assert.throws(()=>cleanLibrary157(normalized));
  for(const changed of [{extra:true},{updated_at:'bad'},{version:-1}])assert.throws(()=>cleanLibrary157({...library(),...changed}));
});
test('fixed registered IDs and readonly event effects reject executable policy changes',()=>{
  for(const mutate of [d=>d.relics[0].id='new_effect',d=>d.events[0].effect='LP +99999',d=>d.events.pop(),d=>d.events.push(copy(d.events[0])),d=>d.relics[0].execute='draw',d=>d.shop.execute='anything']){
    const document=defaultContent157();mutate(document);assert.throws(()=>cleanContent157(document));
  }
  const document=defaultContent157();document.events.reverse();document.relics.reverse();
  assert.deepEqual(cleanContent157(document),defaultContent157());
});
test('display prose, zero weights/disabled lists and shop policy normalize without changing effects',()=>{
  const document=defaultContent157();document.events.forEach(row=>{row.enabled=false;row.weight=0;});document.relics.forEach(row=>{row.enabled=false;row.weight=0;});
  document.relics[0].name='  나의 유물  ';document.events[0].description='새로운 이야기\n두 번째 줄';document.shop.card_count=10;document.shop.relic_count=0;document.shop.card_prices.UR=0;
  const normalized=cleanContent157(document);assert.equal(normalized.relics[0].name,'나의 유물');assert.equal(normalized.shop.relic_count,0);assert.equal(normalized.events[0].effect,defaultContent157().events[0].effect);
  for(const mutate of [d=>d.shop.card_count=0,d=>d.shop.relic_count=6,d=>d.relics[0].price=2e9+1,d=>d.events[0].weight=1.5,d=>d.relics[0].name='\0bad',d=>Object.keys(d.shop.rarity_weights).forEach(k=>d.shop.rarity_weights[k]=0)]){
    const invalid=copy(document);mutate(invalid);assert.throws(()=>cleanContent157(invalid));
  }
});
test('selected pool validates catalog identity, current eligibility and uniqueness while absent card catalog preserves frozen keys',()=>{
  const document=defaultContent157();document.shop.card_pool_mode='selected';document.shop.card_pool=[card.identity_key];
  assert.deepEqual(cleanContent157(document,[card]).shop.card_pool,[card.identity_key]);
  assert.deepEqual(cleanContent157(document).shop.card_pool,[card.identity_key]);
  for(const delta of [{special:true},{reward_eligible:false},{draw_enabled:false},{deck_limit:0},{speed_limit:0},{rarity:'L'}]){
    assert.equal(eligibleContentCard157({...card,...delta}),false);assert.throws(()=>cleanContent157(document,[{...card,...delta}]));
  }
  assert.throws(()=>cleanContent157(document,[]));document.shop.card_pool.push(card.identity_key);assert.throws(()=>cleanContent157(document));
});
test('refresh only observes the online policy and preserves edited draft/base',async()=>{
  const state=session();state.draft.shop.card_count=8;state.stored=library(defaultContent157(),2);
  await state.sync.refresh();assert.equal(state.draft.shop.card_count,8);assert.equal(state.sync.baseVersion,1);assert.equal(state.sync.state().conflict,true);assert.equal(state.posts,0);
});
test('CAS conflict preserves local edit, explicit comparison uses only observed revision',async()=>{
  const state=session();state.draft.shop.card_count=7;state.stored=library(defaultContent157(),2);
  await assert.rejects(state.sync.save(),/poc_conflict/);assert.equal(state.draft.shop.card_count,7);assert.equal(state.stored.document.shop.card_count,5);assert.equal(state.sync.baseVersion,1);
  await state.sync.save({compared:true});assert.equal(state.stored.document.shop.card_count,7);assert.equal(state.sync.baseVersion,3);
  state.stored=library(defaultContent157(),4);await assert.rejects(state.sync.save({compared:true}),/poc_conflict/);assert.equal(state.stored.version,4);
});
test('lost POST reply is reconciled with one authoritative read and no second write',async()=>{
  const state=session();state.draft.shop.card_count=9;const save=state.cloud.save;state.cloud.save=async(...args)=>{await save(...args);throw new Error('network response lost');};
  await state.sync.save();assert.equal(state.posts,1);assert.equal(state.sync.baseVersion,2);assert.equal(state.draft.shop.card_count,9);assert.equal(state.sync.state().same,true);
});
test('edits while saving are preserved; concurrent loads cannot overwrite newly edited fields',async()=>{
  const state=session();let release;const save=state.cloud.save;state.cloud.save=async(...args)=>{await new Promise(resolve=>release=resolve);return save(...args);};
  const pending=state.sync.save();while(!release)await new Promise(resolve=>setImmediate(resolve));state.draft.shop.card_count=10;release();await pending;
  assert.equal(state.draft.shop.card_count,10);assert.equal(state.stored.document.shop.card_count,5);assert.equal(state.sync.state().same,false);
  state.cloud.load=async()=>{await new Promise(resolve=>release=resolve);return copy(state.stored);};release=null;
  const load=state.sync.loadIntoDraft();while(!release)await new Promise(resolve=>setImmediate(resolve));state.draft.shop.relic_count=4;release();await assert.rejects(load,/편집본이 바뀌/);assert.equal(state.draft.shop.relic_count,4);
});
test('editor permission and single in-flight request are enforced before save',async()=>{
  const state=session();state.cloud.editor=async()=>false;await assert.rejects(state.sync.save(),/editor/);assert.equal(state.posts,0);
  state.cloud.editor=async()=>true;let release;state.cloud.load=()=>new Promise(resolve=>release=()=>resolve(copy(state.stored)));
  const pending=state.sync.refresh();await assert.rejects(state.sync.save(),/연결 작업/);release();await pending;
});
test('RPC wrapper sends only document and expected version; mismatched save reply rejects',async()=>{
  const calls=[],document=defaultContent157(),client={rpc:async(name,args)=>{calls.push({name,args});return {data:library(document,2),error:null};}},cloud=new ContentCloud157(client);
  await cloud.save(document,1);assert.deepEqual(calls[0],{name:'save_poc_expedition_content157',args:{p_document:document,p_expected_version:1}});
  client.rpc=async()=>({data:library({...document,shop:{...document.shop,card_count:9}},3),error:null});await assert.rejects(cloud.save(document,2),/저장 응답/);
});
test('editor does not write game, account, scenario, deck or generic card storage keys',async()=>{
  const source=await readFile(new URL('../expedition-content.js',import.meta.url),'utf8');
  assert.equal((source.match(/localStorage\.setItem\(/g)||[]).length,1);
  assert.match(source,/localStorage\.setItem\(DRAFT_KEY157/);
  assert.doesNotMatch(source,/poc_save_ai_deck|poc_save_story|poc_save_card_setting|localhost|127\.0\.0\.1/);
});
