import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {emptyDeck,cardLine,GROUPS} from '../ai-deck-core.js';
import {makeSyncPacket,issueDraft,packetDeck,SYNC_MARKER} from '../ai-sync-core.js';

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
// Explicit fixture command is used for cross-language and live cloud tests.
if(process.env.POC_SYNC_FIXTURE_OUTPUT){
  const {target,deck}=fixture(),packet=await makeSyncPacket(meta,deck,target,cards),draft=await issueDraft(packet);
  fs.writeFileSync(process.env.POC_SYNC_FIXTURE_OUTPUT,JSON.stringify({packet,draft},null,2)+'\n');
}
