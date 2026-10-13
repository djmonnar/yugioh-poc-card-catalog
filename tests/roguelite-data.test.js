import test from 'node:test';
import assert from 'node:assert/strict';
import {browserDecks,importedDecks,loadCatalog,onlineDecks} from '../roguelite-data.js';
import {DECK_STORAGE_KEY,cardLine,emptyDeck,validateDeck} from '../ai-deck-core.js';
import {makeSyncPacket} from '../ai-sync-core.js';

// Isolated adapter fixtures: no browser storage, real client, network or save files.
const cards=Array.from({length:8},(_,i)=>({
  slot:i+1,internal_id:i+101,identity_key:(i+1).toString(16).padStart(64,'0'),
  name_ko:`원정 자료 카드 ${i+1}`,name_en:`Run data card ${i+1}`,type:'일반 몬스터',
  rarity:'N',deck_limit:3,speed_limit:null,special:false,stock:true,draw_enabled:true
}));
const meta={dataset_id:'a'.repeat(64)};
const config={schema_version:1,provider:'supabase',url:`https://${'a'.repeat(20)}.supabase.co`,publishable_key:'sb_publishable_test'};
const bundle=decks=>({schema_version:1,kind:'poc-ai-deck-bundle',decks});
function deck(id='speed-source',filename='DLR_001.ydc'){
  const value=emptyDeck(id,'duel_links_plan');value.name='등록된 스피드 덱';
  value.groups.main=cards.slice(0,7).map((card,i)=>cardLine(card,i===6?2:3));
  value.source_recipe={filename,sha256:'b'.repeat(64),difficulty_levels:[3]};
  return value;
}
async function row(target=deck(),version=4){
  const edited=structuredClone(target);edited.name='현재 온라인 저장 덱';edited.strategy.goal='필드를 유지한다.';
  return {filename:target.source_recipe.filename,version,packet:await makeSyncPacket(meta,edited,target,cards)};
}
const limit=(card,normal=1)=>({slot:card.slot,internal_id:card.internal_id,identity_key:card.identity_key,
  version:1,normal_limit:normal,speed_limit:null});
const setting=(card,rarity='SR')=>({slot:card.slot,internal_id:card.internal_id,identity_key:card.identity_key,
  version:1,rarity,stock:true,draw_enabled:true});

function onlineFixture({rows=[],limits=[],settings=[],annotations={categories:[],annotations:[]},
  installed=bundle([deck(),deck('second-installed','DLR_002.ydc')]),cloudConfig=config,failedRpc=null,failedFetch=null}={}){
  const calls=[],requests=[],clients=[];
  const rpcData={poc_load_ai_decks:rows,poc_load_card_limits:limits,poc_load_card_settings:settings,poc_load_card_annotations:annotations};
  const client={async rpc(name,args){
    calls.push(name);assert.equal(args,undefined);assert.ok(Object.hasOwn(rpcData,name),`unexpected RPC ${name}`);
    return failedRpc===name?{data:null,error:{message:`offline ${name}`}}:{data:structuredClone(rpcData[name]),error:null};
  }};
  const fetcher=async (url,options)=>{
    requests.push({url,options});
    assert.ok(['./data/cloud-config.json','./data/ai-opponents.json'].includes(url),`unexpected fetch ${url}`);
    return {ok:failedFetch!==url,json:async()=>structuredClone(url.includes('cloud-config')?cloudConfig:installed)};
  };
  const createClient=(...args)=>{clients.push(args);return client;};
  return {options:{fetcher,createClient},calls,requests,clients};
}

test('catalog load reads fresh data and returns copies that cannot mutate the response',async()=>{
  const payload={cards:structuredClone(cards),meta:structuredClone(meta)},requests=[];
  const loaded=await loadCatalog(async (url,options)=>{requests.push({url,options});return {ok:true,json:async()=>payload};});
  assert.match(requests[0].url,/^\.\/data\/cards\.json\?/);assert.equal(requests[0].options.cache,'no-store');
  assert.deepEqual(loaded,payload);loaded.cards[0].name_ko='편집';loaded.meta.dataset_id='changed';
  assert.equal(payload.cards[0].name_ko,cards[0].name_ko);assert.equal(payload.meta.dataset_id,meta.dataset_id);
});

test('catalog HTTP, parsing and missing metadata failures reject instead of using a fallback',async()=>{
  await assert.rejects(loadCatalog(async()=>({ok:false,json:async()=>{assert.fail('read failed response');}})),/카드 자료/);
  for(const payload of [{cards:null,meta},{cards,meta:{}},{}]){
    await assert.rejects(loadCatalog(async()=>({ok:true,json:async()=>payload})),/도감 자료/);
  }
  await assert.rejects(loadCatalog(async()=>({ok:true,json:async()=>{throw new SyntaxError('bad JSON');}})),/bad JSON/);
});

test('browser deck source only reads the existing key and preserves damaged stored data',()=>{
  let raw=JSON.stringify(bundle([deck()]));const reads=[];
  const storage={getItem(key){reads.push(key);return raw;},setItem(){assert.fail('existing deck storage write');},removeItem(){assert.fail('existing deck storage removal');}};
  const before=raw,loaded=browserDecks(storage,cards);assert.equal(loaded.length,1);loaded[0].groups.main[0].count=1;
  assert.equal(raw,before);assert.deepEqual(reads,[DECK_STORAGE_KEY]);
  raw=null;assert.deepEqual(browserDecks(storage,cards),[]);
  for(const value of ['{broken',JSON.stringify({...bundle([deck()]),schema_version:2})]){
    raw=value;assert.throws(()=>browserDecks(storage,cards));assert.equal(raw,value);
  }
});

test('JSON deck import rejects malformed structure without changing the source and retains unresolved drafts',()=>{
  const payload=bundle([deck()]),before=structuredClone(payload),loaded=importedDecks(payload,cards);
  assert.equal(validateDeck(loaded[0],cards).ready_for_game,true);loaded[0].strategy.goal='독립 편집';assert.deepEqual(payload,before);
  for(const change of [
    value=>value.decks.push(structuredClone(value.decks[0])),
    value=>value.decks[0].groups.main[0].count=4,
    value=>value.decks[0].groups.main=null,
    value=>value.decks[0].ruleset='unsupported',
    value=>value.decks[0].duel_mode='normal'
  ]){const bad=structuredClone(payload);change(bad);const original=structuredClone(bad);assert.throws(()=>importedDecks(bad,cards));assert.deepEqual(bad,original);}
  const unresolved=structuredClone(payload);unresolved.decks[0].groups.main[0].identity_key='f'.repeat(64);
  const draft=importedDecks(unresolved,cards)[0];assert.equal(draft.groups.main[0].identity_key,'f'.repeat(64));
  assert.equal(validateDeck(draft,cards).unknown,3);assert.equal(validateDeck(draft,cards).ready_for_game,false);
});

test('online load publishes only explicitly saved recipes with versions and applies settings to cloned cards',async()=>{
  const saved=await row(),source=structuredClone(cards),before=structuredClone(source);
  const annotations={categories:[{name:'원정용',version:1}],annotations:[{
    slot:cards[0].slot,internal_id:cards[0].internal_id,identity_key:cards[0].identity_key,version:1,tags:['원정용'],links:[]
  }]};
  const fixture=onlineFixture({rows:[saved],limits:[limit(cards[0])],settings:[setting(cards[0])],annotations});
  const result=await onlineDecks(source,meta,fixture.options);
  assert.equal(result.decks.length,1);assert.equal(result.decks[0].name,'현재 온라인 저장 덱');
  assert.equal(result.decks[0].source_recipe.filename,'DLR_001.ydc');assert.deepEqual([...result.versions],[['DLR_001.ydc',4]]);
  assert.equal(result.cards[0].rarity,'SR');assert.equal(result.cards[0].deck_limit,1);assert.deepEqual(result.cards[0].tags,['원정용']);
  assert.deepEqual(source,before);assert.equal(result.tagsMessage,'');
  assert.deepEqual(fixture.calls.sort(),['poc_load_ai_decks','poc_load_card_annotations','poc_load_card_limits','poc_load_card_settings'].sort());
  assert.deepEqual(fixture.clients[0][2].auth,{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  assert.ok(fixture.requests.every(request=>request.options.cache==='no-store'));
  result.decks[0].groups.main[0].count=1;assert.equal(saved.packet.deck.groups.main[0][2],3);
});

test('online recipes never fall back to bundled decks after an empty result or a required RPC failure',async()=>{
  const empty=onlineFixture(),result=await onlineDecks(cards,meta,empty.options);
  assert.deepEqual(result.decks,[]);assert.equal(result.versions.size,0);
  for(const failedRpc of ['poc_load_ai_decks','poc_load_card_limits','poc_load_card_settings']){
    const source=structuredClone(cards),before=structuredClone(source);
    const fixture=onlineFixture({rows:[await row()],limits:[limit(cards[0])],settings:[setting(cards[0])],failedRpc});
    await assert.rejects(onlineDecks(source,meta,fixture.options),error=>error.message===`offline ${failedRpc}`);
    assert.deepEqual(source,before);assert.equal(fixture.requests.some(request=>request.url.includes('ai-opponents')),false);
  }
});

test('bad cloud configuration, recipe provenance and dataset identities reject without partial card changes',async()=>{
  await assert.rejects(onlineDecks(cards,meta,{fetcher:async()=>{assert.fail('no client');}}),/연결/);
  const invalidConfig=onlineFixture({cloudConfig:{...config,publishable_key:'service_role_forbidden'}});
  await assert.rejects(onlineDecks(cards,meta,invalidConfig.options),/연결 설정/);assert.equal(invalidConfig.clients.length,0);
  for(const change of [
    saved=>saved.packet.catalog_dataset_id='f'.repeat(64),
    saved=>saved.packet.identity_sha256='0'.repeat(64),
    saved=>saved.packet.target.sha256='e'.repeat(64),
    saved=>saved.packet.target.difficulty_levels=[2],
    saved=>saved.version=0
  ]){
    const saved=await row();change(saved);const source=structuredClone(cards),before=structuredClone(source);
    const fixture=onlineFixture({rows:[saved],limits:[limit(cards[0])],settings:[setting(cards[0])]});
    await assert.rejects(onlineDecks(source,meta,fixture.options));assert.deepEqual(source,before);
  }
  const valid=await row(),bad=await row(deck('second-installed','DLR_002.ydc'));bad.packet.identity_sha256='0'.repeat(64);
  const source=structuredClone(cards),before=structuredClone(source);
  await assert.rejects(onlineDecks(source,meta,onlineFixture({rows:[valid,bad],limits:[limit(cards[0])]}).options));
  assert.deepEqual(source,before);
});

test('missing installed references fails the online load while optional tag failures keep valid recipes',async()=>{
  const missing=onlineFixture({rows:[await row()],failedFetch:'./data/ai-opponents.json'});
  await assert.rejects(onlineDecks(cards,meta,missing.options),/카드 참조/);
  const tags=onlineFixture({rows:[await row()],failedRpc:'poc_load_card_annotations'});
  const result=await onlineDecks(cards,meta,tags.options);
  assert.equal(result.decks.length,1);assert.equal(result.decks[0].name,'현재 온라인 저장 덱');assert.match(result.tagsMessage,/온라인 태그/);
  assert.deepEqual(cards[0].tags,undefined);
});
