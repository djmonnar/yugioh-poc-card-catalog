import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeAIAssets,copyAIAsset,ASSET_SEED_SHA} from '../ai-assets.js';
import {emptyDeck,cardLine} from '../ai-deck-core.js';
import {makeSyncPacket} from '../ai-sync-core.js';
import {validateStory,newBattle,newActor,emptyStory} from '../story-core.js';
const {cards,meta}=JSON.parse(fs.readFileSync(new URL('../data/cards.json',import.meta.url)));
const installed=JSON.parse(fs.readFileSync(new URL('../data/ai-opponents.json',import.meta.url))).decks;
async function custom(){
  const target=installed.find(d=>d.ruleset==='duel_links_plan'),deck=emptyDeck('asset','duel_links_plan');deck.name='해골수스 · 언데드 초급';
  let left=20;for(const c of cards.filter(c=>!c.special&&c.type==='일반 몬스터')){const n=Math.min(3,left);deck.groups.main.push(cardLine(c,n));left-=n;if(!left)break;}
  const packet=await makeSyncPacket(meta,deck,target,cards);packet.target={filename:'DLR_100.ydc',sha256:ASSET_SEED_SHA,difficulty_levels:[3]};
  return {filename:'DLR_100.ydc',version:2,packet};
}
test('a separately saved deck is selectable in story without replacing any installed deck',async()=>{
  const row=await custom(),before=structuredClone(installed),all=await mergeAIAssets(installed,[row],cards,meta);
  assert.equal(all.length,43);assert.deepEqual(installed,before);assert.deepEqual(all.slice(0,42),installed);
  const asset=all.at(-1);assert.equal(asset.name,row.packet.deck.name);
  const story=emptyStory();story.actors=[newActor('actor')];const b=newBattle('battle');b.actor_id='actor';b.recipe=row.filename;story.battles=[b];
  assert.equal(validateStory(story,cards,all).issues.length,0);
});
test('copy strips the original destination and preserves independent card/strategy data',async()=>{
  const row=await custom(),all=await mergeAIAssets(installed,[row],cards,meta),original=all.at(-1),copy=copyAIAsset(original,'new-asset');
  assert.equal(copy.source_recipe,undefined);copy.groups.main[0].count=1;copy.strategy.goal='다른 전략';
  assert.notDeepEqual(copy.groups,original.groups);assert.notEqual(copy.strategy.goal,original.strategy.goal);
});
test('renaming a stored deck refreshes its display name while retaining the story recipe identity',async()=>{
  const row=await custom();row.packet.deck.name='해골수스 · 중급';const all=await mergeAIAssets(installed,[row],cards,meta);
  assert.equal(all.at(-1).name,'해골수스 · 중급');assert.equal(all.at(-1).source_recipe.filename,'DLR_100.ydc');
});
test('unreserved paths, wrong seed, mode and changed identities reject without partial changes',async()=>{
  const row=await custom(),before=structuredClone(installed);
  for(const edit of [p=>p.target.filename='DLR_999.ydc',p=>p.target.sha256='f'.repeat(64),p=>p.deck.ruleset='classic',p=>p.identity_sha256='0'.repeat(64)]){
    const bad=structuredClone(row);edit(bad.packet);bad.filename=bad.packet.target.filename;await assert.rejects(mergeAIAssets(installed,[bad],cards,meta));assert.deepEqual(installed,before);
  }
});
