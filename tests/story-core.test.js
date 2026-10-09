import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {emptyStory,newActor,newBattle,parseStory,canonicalStory,validateStory,cardRef,reviewFiles,safePortrait} from '../story-core.js';
const catalog=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url))),decks=JSON.parse(readFileSync(new URL('../data/ai-opponents.json',import.meta.url))).decks;
function fixture(){const doc=emptyStory(),actor=newActor('yongman'),battle=newBattle('battle-1');actor.name='다이노소어 용만';battle.actor_id=actor.actor_id;battle.recipe='DLR_000.ydc';doc.actors=[actor];doc.battles=[battle];return doc;}
test('optional prerequisite survives export and defaults to legacy ordered battles',()=>{
 const doc=fixture();assert.equal(Object.hasOwn(parseStory(doc).battles[0],'requires_previous'),false);
 for(const required of [false,true]){doc.battles[0].requires_previous=required;assert.equal(canonicalStory(doc,catalog.meta,catalog.cards).battles[0].requires_previous,required);}
 for(const value of [0,1,'false',null,[]]){doc.battles[0].requires_previous=value;assert.throws(()=>parseStory(doc));}
});
test('story preserves character skills and separate first/repeat reward identities',()=>{const doc=fixture(),card=catalog.cards.find(c=>c.type==='마법'&&c.reward_eligible);doc.actors[0].skills=[{kind:'lp_bonus',value:1000},{kind:'start_field',card:cardRef(card)}];doc.battles[0].rewards.first=[{kind:'gold',amount:100},{kind:'card',card:cardRef(card),count:1}];doc.battles[0].rewards.repeat=[{kind:'random',rarity:'SR',count:1}];assert.deepEqual(parseStory(doc).battles,doc.battles);assert.equal(validateStory(doc,catalog.cards,decks).issues.length,0);assert.equal(validateStory(doc,catalog.cards,decks).engine_applied,false);});
test('replaced cards and mismatched rules are flagged without deleting authoring draft',()=>{const doc=fixture(),c=catalog.cards.find(c=>c.reward_eligible);doc.battles[0].rewards.first=[{kind:'card',card:{...cardRef(c),identity_key:'a'.repeat(64)},count:1}];doc.battles[0].ruleset='classic';assert.ok(validateStory(parseStory(doc),catalog.cards,decks).issues.length>=2);assert.equal(parseStory(doc).battles[0].rewards.first.length,1);});
test('printed-stat aliases preserve existing story rewards but a renamed replacement does not',()=>{
  const doc=fixture(),c=catalog.cards.find(c=>c.reward_eligible),updated=structuredClone(catalog.cards);
  doc.battles[0].rewards.first=[{kind:'card',card:cardRef(c),count:1}];
  const next=updated.find(r=>r.slot===c.slot);next.identity_key='f'.repeat(64);next.previous_identity_keys=[c.identity_key];
  assert.equal(validateStory(doc,updated,decks).issues.length,0);
  next.name_ko='Another card';assert.ok(validateStory(doc,updated,decks).issues.length>0);
});
test('online save rebases declared property corrections without changing draft or battle IDs',()=>{
  const doc=fixture(),c=catalog.cards.find(c=>c.reward_eligible),updated=structuredClone(catalog.cards);
  doc.actors[0].skills=[{kind:'start_hand',card:cardRef(c)}];
  doc.battles[0].rewards.first=[{kind:'card',card:cardRef(c),count:2}];
  const next=updated.find(r=>r.slot===c.slot);next.identity_key='f'.repeat(64);next.previous_identity_keys=[c.identity_key];
  const clean=canonicalStory(doc,catalog.meta,updated);
  assert.equal(clean.catalog_dataset_id,catalog.meta.dataset_id);
  assert.equal(clean.actors[0].skills[0].card.identity_key,next.identity_key);
  assert.equal(clean.battles[0].rewards.first[0].card.identity_key,next.identity_key);
  assert.equal(clean.battles[0].battle_id,'battle-1');assert.equal(clean.battles[0].rewards.first[0].count,2);
  assert.equal(doc.battles[0].rewards.first[0].card.identity_key,c.identity_key);
  next.name_ko='Another card';assert.throws(()=>canonicalStory(doc,catalog.meta,updated));
});
test('unsafe portrait and duplicate/invalid skill input is refused',()=>{assert.equal(safePortrait('javascript:alert(1)'),false);assert.equal(safePortrait('assets/../../secret.png'),false);const doc=fixture();doc.actors[0].portrait='https://example.com/p.png';assert.throws(()=>parseStory(doc));doc.actors[0].portrait='';doc.actors[0].skills=[{kind:'lp_bonus',value:1000},{kind:'lp_bonus',value:1000}];assert.throws(()=>parseStory(doc));});
test('invalid transient LP and reward amounts never appear ready for export',()=>{const doc=fixture();doc.actors[0].skills=[{kind:'lp_bonus',value:0}];assert.equal(validateStory(doc,catalog.cards,decks).authoring_ready,false);doc.actors[0].skills=[];doc.battles[0].rewards.first=[{kind:'gold',amount:100001}];assert.equal(validateStory(doc,catalog.cards,decks).authoring_ready,false);});
test('review export builds reachable ordered battle graph and hashes source; never applies',async()=>{const doc=fixture();doc.battles.push({...newBattle('battle-2'),actor_id:'yongman',recipe:'DLR_001.ydc'});const {source,pack}=await reviewFiles(doc,catalog.meta,catalog.cards,decks);assert.equal(JSON.parse(source).battles.length,2);assert.equal(pack.status,'draft');assert.equal(pack.story[0].nodes.find(n=>n.id==='win-0').next,'intro-1');assert.match(pack.implementations[0].sha256,/^[a-f0-9]{64}$/);assert.deepEqual(pack.actors[0].decks,['deck-0','deck-1']);});
test('weighted designated pools preserve weights, upgrade aliases and allow designated legends',()=>{
 const doc=fixture(),eligible=catalog.cards.filter(c=>c.reward_eligible&&!c.special).slice(0,2),pool={kind:'card_pool',count:3,entries:eligible.map((c,i)=>({card:cardRef(c),weight:i?1:3}))};
 doc.battles[0].rewards.first=[pool];assert.deepEqual(parseStory(doc).battles[0].rewards.first,[pool]);assert.equal(validateStory(doc,catalog.cards,decks).issues.length,0);
 const cards=structuredClone(catalog.cards),c=cards.find(c=>c.slot===eligible[0].slot);c.previous_identity_keys=[c.identity_key];c.identity_key='f'.repeat(64);c.rarity='L';c.reward_eligible=false;c.draw_enabled=false;
 const clean=canonicalStory(doc,catalog.meta,cards);assert.equal(clean.battles[0].rewards.first[0].entries[0].card.identity_key,c.identity_key);assert.equal(validateStory(clean,cards,decks).issues.length,0);assert.equal(pool.entries[0].card.identity_key,eligible[0].identity_key);
});
test('weighted pools reject malformed weights, duplicates, emptiness and stale unpicked cards',()=>{
 const doc=fixture(),c=catalog.cards.find(c=>c.reward_eligible&&!c.special),pool={kind:'card_pool',count:1,entries:[{card:cardRef(c),weight:1}]};doc.battles[0].rewards.first=[pool];
 for(const weight of [0,-1,1.5,10001,true,'3']){pool.entries[0].weight=weight;assert.throws(()=>parseStory(doc));}pool.entries[0].weight=1;
 pool.entries.push(structuredClone(pool.entries[0]));assert.throws(()=>parseStory(doc));pool.entries=[];assert.throws(()=>parseStory(doc));
 pool.entries=[{card:{...cardRef(c),identity_key:'a'.repeat(64)},weight:1}];assert.ok(validateStory(doc,catalog.cards,decks).issues.length);assert.throws(()=>canonicalStory(doc,catalog.meta,catalog.cards));
});
