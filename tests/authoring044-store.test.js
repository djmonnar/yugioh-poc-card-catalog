import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {normalizeBootstrap039,AuthoringStore039,IDENTITY039,PROJECT039} from '../authoring039-store.js';

const entity=(entity_type,entity_id,content)=>({entity_type,entity_id,version:1,state:'saved',issues:[],content});
function wire044(){
  const payload={catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}};
  const payload_json=JSON.stringify(payload),deck=entity('deck','shared',{deck_name:'공유 덱',main:[],extra:[]});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:1,unchanged:false,permissions:{can_edit:true},authoring:{entities:[deck]},
    authoring044:{schema:1,decks:[deck],chapter_roles:[entity('chapter_role','1:battle',{chapter:1,role:'battle',entries:[{entry_id:'enc-a',deck_id:'shared',weight:1,encounter:{name:'카이바',lp_bonus:500,skills:[]}}]})],starter_list:entity('starter_list','main',{entries:[{starter_id:'old-lineage',name:'시작 덱',deck_id:'shared'}]})},
    game:{schema:1,kind:'poc-unified-game039',authoring_revision:1,game_revision:1,metadata_revision:'1',identity:IDENTITY039,payload_json,source_fingerprint:createHash('sha256').update(payload_json).digest('hex')}};
}

test('public authoring graph stays outside the exact eight-section game payload',async()=>{
  const value=await normalizeBootstrap039(wire044(),webcrypto);
  assert.equal(Object.keys(value.gamePayload).length,8);
  assert.equal(value.gamePayload.authoring044,undefined);
  assert.equal(value.authoring044.chapter_roles[0].content.entries[0].deck_id,'shared');
});
test('authoring graph rejects dangling, duplicate and unsafe references before rendering',async()=>{
  for(const mutate of [
    x=>x.authoring044.chapter_roles[0].content.entries[0].deck_id='missing',
    x=>x.authoring044.decks.push(structuredClone(x.authoring044.decks[0])),
    x=>x.authoring044.chapter_roles[0].content.entries.push(structuredClone(x.authoring044.chapter_roles[0].content.entries[0])),
    x=>x.authoring044.starter_list.content.entries[0].deck_id='deleted',
    x=>x.authoring044.decks[0].content=JSON.parse('{"constructor":{}}')
  ]){const value=wire044();mutate(value);await assert.rejects(normalizeBootstrap039(value,webcrypto));}
});
test('old bootstrap remains readable while mixed clients update',async()=>{
  const value=wire044();delete value.authoring044;
  assert.equal((await normalizeBootstrap039(value,webcrypto)).gamePayload.catalog.length,0);
});
test('server duplicate rejection pauses the outbox and explains how to recover',async t=>{
  const original=wire044(),client={auth:{getSession:async()=>({data:{session:{user:{id:'fixture-editor'}}}}),onAuthStateChange:()=>({})},rpc:async name=>name==='poc_bootstrap039'?{data:original}:{error:{message:'unified039_validation',details:'{"reason":"unified039_duplicate_deck:shared"}'}}};
  const store=new AuthoringStore039({client,storage:null,crypto:webcrypto,pollMs:0,debounceMs:100000,events:{}});t.after(()=>store.stop());await store.start();
  store.patch('deck','shared',{main:[{source_id:0,identity_key:'a'.repeat(64),count:1}]});await store.drain();
  assert.equal(store.phase,'invalid');assert.equal(store.queue.length,1);assert.equal(store.queue[0].body,undefined);
  assert.match(store.error,/같은 카드 구성.*기존 덱/);
});
