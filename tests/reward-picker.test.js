import test from 'node:test';
import assert from 'node:assert/strict';
import {poolCardSelected,togglePoolCard} from '../reward-picker.js';
import {emptyStory,newActor,newBattle,parseStory} from '../story-core.js';
const card=slot=>({slot,internal_id:100+slot,identity_key:slot.toString(16).padStart(64,'0'),name_ko:`카드 ${slot}`});

test('toggle keeps weights and reward quantities while cancelling and reselecting candidates',()=>{
  const pool={kind:'card_pool',count:3,entries:[{card:card(1),weight:7},{card:card(2),weight:2}]};
  const rewards=[{kind:'gold',amount:100},pool];
  assert.equal(poolCardSelected(pool,card(1)),true);
  assert.equal(togglePoolCard(rewards,pool,card(2)),pool);
  assert.equal(poolCardSelected(pool,card(2)),false);
  togglePoolCard(rewards,pool,card(3));
  assert.deepEqual(pool.entries.map(e=>e.weight),[7,1]);
  assert.equal(pool.count,3);assert.equal(rewards[0].amount,100);
});

test('cancelling the last candidate removes only its pool and leaves a valid story draft',()=>{
  const doc=emptyStory(),actor=newActor('actor'),battle=newBattle('battle');
  actor.name='캐릭터';battle.actor_id=actor.actor_id;doc.actors=[actor];doc.battles=[battle];
  const rewards=battle.rewards.first;rewards.push({kind:'gold',amount:100});
  let pool=togglePoolCard(rewards,null,card(1));
  pool=togglePoolCard(rewards,pool,card(1));
  assert.equal(pool,null);assert.deepEqual(parseStory(doc).battles[0].rewards.first,[{kind:'gold',amount:100}]);
  pool=togglePoolCard(rewards,pool,card(2));
  assert.equal(pool.entries.length,1);assert.equal(parseStory(doc).battles[0].rewards.first.length,2);
});

test('full pools allow cancellation, reject extra candidates atomically and distinguish changed identities',()=>{
  const pool={kind:'card_pool',count:1,entries:Array.from({length:100},(_,i)=>({card:card(i+1),weight:1}))},rewards=[pool];
  const before=structuredClone(rewards);assert.throws(()=>togglePoolCard(rewards,pool,card(101)));assert.deepEqual(rewards,before);
  assert.equal(poolCardSelected(pool,{...card(1),identity_key:'f'.repeat(64)}),false);
  togglePoolCard(rewards,pool,card(1));assert.equal(pool.entries.length,99);
  togglePoolCard(rewards,pool,card(101));assert.equal(pool.entries.length,100);
  const full=Array.from({length:19},()=>({kind:'gold',amount:1}));full.push(pool);
  assert.throws(()=>togglePoolCard(full,null,card(1)));
  togglePoolCard(full,pool,card(101));assert.equal(full.length,20);
});
