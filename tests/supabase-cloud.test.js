import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateCloudConfig,cloudRows,DeckCloud,cloudError} from '../supabase-cloud.js';
const config=JSON.parse(fs.readFileSync(new URL('../data/cloud-config.json',import.meta.url)));
const packet={kind:'poc-ai-deck-sync',target:{filename:'cpu_000.ydc'}};
const row={filename:'cpu_000.ydc',version:4,packet};
test('only HTTPS project URLs and publishable keys are accepted',()=>{
  assert.equal(validateCloudConfig(config),config);
  for(const changes of [{url:'http://localhost'},{url:config.url+'/wrong'},{publishable_key:'sb_secret_private'},{publishable_key:'eyJ-service-role'},{provider:'other'}])assert.throws(()=>validateCloudConfig({...config,...changes}));
});
test('duplicate and mismatched remote targets cannot be imported',()=>{
  assert.deepEqual(cloudRows([row]),[row]);
  for(const rows of [[row,row],[{...row,version:0}],[{...row,version:2.5}],[{...row,filename:'DLR_000.ydc'}],{}])assert.throws(()=>cloudRows(rows));
});
test('save keeps the originally displayed version and reports concurrent edits',async()=>{
  const calls=[],cloud=new DeckCloud({rpc:async(name,args)=>{calls.push([name,args]);if(name==='poc_load_ai_decks')return {data:[row]};return {error:{message:'poc_conflict'}};}});
  assert.throws(()=>cloud.version(row.filename));await cloud.load();const displayed=cloud.version(row.filename);
  await assert.rejects(cloud.save(packet,displayed),e=>e.message==='poc_conflict');
  assert.equal(calls[1][1].p_expected_version,4);assert.equal(cloud.version(row.filename),4);assert.match(cloudError({message:'poc_conflict'}),/다른 기기/);
});
test('failed reads do not initialize a version of zero for an unknown existing deck',async()=>{
  const cloud=new DeckCloud({rpc:async()=>({error:new Error('network')})});
  await assert.rejects(cloud.load());assert.throws(()=>cloud.version('cpu_000.ydc'));
});
test('successful save returns the server revision; public loading needs no editor credential',async()=>{
  const cloud=new DeckCloud({rpc:async(name,args)=>name==='poc_load_ai_decks'?{data:[]}:{data:{...row,version:9,packet:args.p_packet}}});
  await cloud.load();assert.equal(cloud.version(row.filename),0);assert.equal((await cloud.save(packet,0)).version,9);assert.equal(cloud.version(row.filename),9);
});
