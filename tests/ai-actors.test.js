import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {parseActors,actorForDeck} from '../ai-actors.js';
const data=JSON.parse(readFileSync(new URL('../data/ai-actors.json',import.meta.url),'utf8'));
test('authored portrait binds only the matching recipe and mode, including copied/online decks',()=>{
  const actors=parseActors(data),deck={ruleset:'duel_links_plan',source_recipe:{filename:'DLR_000.ydc'},name:'사용자가 수정한 덱 이름'};
  assert.equal(actorForDeck(actors,deck).name,'다이노소어 용만');
  assert.equal(actorForDeck(actors,{...deck,ruleset:'classic'}),null);
  assert.equal(actorForDeck(actors,{...deck,source_recipe:{filename:'DLR_001.ydc'}}),null);
  assert.equal(actorForDeck(actors,{...deck,source_recipe:undefined}),null);
  assert.ok(existsSync(new URL('../'+actors[0].portrait,import.meta.url)));
});
test('duplicate slots, traversal, external portrait URLs and wrong rule modes reject',()=>{
  for(const mutate of [d=>d.actors.push(structuredClone(d.actors[0])),d=>d.actors[0].portrait='https://example.test/p.png',d=>d.actors[0].portrait='content-packs/x/assets/../p.jpg',d=>d.actors[0].bindings[0].ruleset='classic']){
    const d=structuredClone(data);mutate(d);assert.throws(()=>parseActors(d));
  }
});
