import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {emptyDeck,cardLine,GROUPS} from '../ai-deck-core.js';
import {makeSyncPacket,issueDraft,packetDeck,loadOpponentDeck,SYNC_MARKER} from '../ai-sync-core.js';

const {cards,meta}=JSON.parse(fs.readFileSync(new URL('../data/cards.json',import.meta.url)));
const opponents=JSON.parse(fs.readFileSync(new URL('../data/ai-opponents.json',import.meta.url))).decks;
export function fixture(ruleset='classic'){
  const target=opponents.find(d=>d.ruleset===ruleset),d=emptyDeck('sync-test',ruleset);d.name='온라인 연동 검사 · 실제 적용용 아님';
  let count=ruleset==='classic'?40:20;
  for(const c of cards.filter(c=>!c.special&&c.type==='일반 몬스터'&&c.deck_limit===3)){
    const n=Math.min(3,count);d.groups.main.push(cardLine(c,n));count-=n;if(!count)break;
  }
  return {target,deck:d};
}
test('compressed issue draft round-trips with names, target and identity fingerprint',async()=>{
  const {target,deck}=fixture();deck.strategy.combos='한국어 메모 · 일반 소환 후 공격';
  const packet=await makeSyncPacket(meta,deck,target,cards),draft=await issueDraft(packet);
  assert.ok(draft.body.startsWith(SYNC_MARKER));assert.ok(draft.prefilled);
  const packed=draft.body.match(/```poc-ai-sync\n([^\n]+)\n```/)[1];
  assert.deepEqual(JSON.parse(zlib.gunzipSync(Buffer.from(packed,'base64url'))),packet);
  const restored=await packetDeck(packet,cards,'loaded');assert.equal(restored.name,deck.name);assert.deepEqual(restored.groups,deck.groups);
  assert.equal(new URL(draft.url).searchParams.get('body'),draft.body);
});
test('incomplete, restricted and wrong-mode decks cannot become online saves',async()=>{
  const {target,deck}=fixture();deck.groups.main=[];await assert.rejects(makeSyncPacket(meta,deck,target,cards),/덱 확인/);
  const speed=fixture('duel_links_plan');await assert.rejects(makeSyncPacket(meta,speed.deck,target,cards),/같은 듀얼/);
  const valid=fixture();valid.deck.groups.main[0].count=9;await assert.rejects(makeSyncPacket(meta,valid.deck,valid.target,cards));
});
test('replaced identities cannot be silently imported from online state',async()=>{
  const {target,deck}=fixture(),packet=await makeSyncPacket(meta,deck,target,cards);
  const changed=structuredClone(cards);changed.find(c=>c.slot===deck.groups.main[0].slot).identity_key='f'.repeat(64);
  await assert.rejects(packetDeck(packet,changed,'load'),/카드가 현재/);
});
test('speed saves preserve 20 cards and target DLR file',async()=>{
  const {target,deck}=fixture('duel_links_plan'),packet=await makeSyncPacket(meta,deck,target,cards);
  assert.ok(packet.target.filename.startsWith('DLR_'));assert.equal(packet.deck.groups.main.reduce((n,r)=>n+r[2],0),20);
});
test('current opponent loading prefers the saved recipe over the bundled installation',async()=>{
  const {target,deck}=fixture('duel_links_plan'),before=structuredClone(target);
  deck.name='용만 · 수정한 공룡 덱';deck.strategy.combos='쥐라기 월드를 먼저 가져오기';
  const packet=await makeSyncPacket(meta,deck,target,cards);
  assert.notDeepEqual(packet.deck.groups.main,target.groups.main.map(r=>[r.slot,r.internal_id,r.count]));
  const result=await loadOpponentDeck(meta,target,cards,'current-opponent',async()=>[{filename:packet.target.filename,version:87,packet}]);
  assert.equal(result.source,'online');assert.equal(result.version,87);
  assert.equal(result.deck.name,deck.name);assert.deepEqual(result.deck.groups,deck.groups);
  assert.deepEqual(result.deck.strategy,deck.strategy);assert.equal(result.deck.deck_id,'current-opponent');
  assert.deepEqual(target,before,'the installed baseline stays immutable for native sync validation');
  const resaved=await makeSyncPacket(meta,result.deck,target,cards);
  assert.deepEqual(resaved.target,packet.target);assert.deepEqual(resaved.deck.groups,packet.deck.groups);
});
test('each opponent click rereads cloud state including later saves from another device',async()=>{
  const {target,deck}=fixture(),packet=await makeSyncPacket(meta,deck,target,cards);
  let version=1,calls=0;
  const load=async()=>{calls++;return [{filename:packet.target.filename,version,packet}];};
  assert.equal((await loadOpponentDeck(meta,target,cards,'first',load)).version,1);
  version=2;packet.deck.name='다른 기기에서 바꾼 이름';
  const latest=await loadOpponentDeck(meta,target,cards,'second',load);
  assert.equal(calls,2);assert.equal(latest.version,2);assert.equal(latest.deck.name,packet.deck.name);
});
test('only a successful read with no saved recipe loads the installed baseline',async()=>{
  const {target}=fixture(),before=structuredClone(target);
  const result=await loadOpponentDeck(meta,target,cards,'baseline-copy',async()=>[]);
  assert.equal(result.source,'installed');assert.equal(result.version,null);
  assert.deepEqual(result.deck.groups,target.groups);assert.deepEqual(result.deck.source_recipe,target.source_recipe);
  result.deck.groups.main[0].count=1;assert.deepEqual(target,before);
  await assert.rejects(loadOpponentDeck(meta,target,cards,'network-failed',async()=>{throw new Error('network offline');}),/network offline/);
  assert.deepEqual(target,before);
});
test('another recipe does not replace the chosen normal or speed opponent',async()=>{
  const {target}=fixture('duel_links_plan'),normal=fixture();
  const packet=await makeSyncPacket(meta,normal.deck,normal.target,cards);
  const result=await loadOpponentDeck(meta,target,cards,'speed-copy',async()=>[{filename:packet.target.filename,version:1,packet}]);
  assert.equal(result.source,'installed');assert.equal(result.deck.ruleset,'duel_links_plan');
  assert.equal(result.deck.source_recipe.filename,target.source_recipe.filename);
});
test('invalid saved catalog, card identity, mode and target cannot silently restore old recipes',async()=>{
  const {target,deck}=fixture(),packet=await makeSyncPacket(meta,deck,target,cards);
  const row=p=>[{filename:packet.target.filename,version:1,packet:p}];
  const stale=structuredClone(packet);stale.catalog_dataset_id='outdated';
  await assert.rejects(loadOpponentDeck(meta,target,cards,'old',async()=>row(stale)),/도감 버전/);
  const changed=structuredClone(cards);changed.find(c=>c.slot===deck.groups.main[0].slot).identity_key='f'.repeat(64);
  await assert.rejects(loadOpponentDeck(meta,target,changed,'identity',async()=>row(packet)),/카드가 현재/);
  const wrong=structuredClone(packet);wrong.deck.ruleset='duel_links_plan';
  await assert.rejects(loadOpponentDeck(meta,target,cards,'mode',async()=>row(wrong)),/듀얼 모드/);
  const base=structuredClone(packet);base.target.sha256='0'.repeat(64);
  await assert.rejects(loadOpponentDeck(meta,target,cards,'target',async()=>row(base)),/적용 상대/);
  await assert.rejects(loadOpponentDeck(meta,target,cards,'duplicate',async()=>[...row(packet),...row(packet)]),/버전/);
});
// Explicit fixture command is used for cross-language and live cloud tests.
if(process.env.POC_SYNC_FIXTURE_OUTPUT){
  const {target,deck}=fixture(),packet=await makeSyncPacket(meta,deck,target,cards),draft=await issueDraft(packet);
  fs.writeFileSync(process.env.POC_SYNC_FIXTURE_OUTPUT,JSON.stringify({packet,draft},null,2)+'\n');
}
