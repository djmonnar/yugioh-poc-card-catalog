import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyDeck,cardLine} from '../ai-deck-core.js';
import {generateMap} from '../roguelite-map.js';
import {assignEncounters} from '../roguelite-encounters.js';
import {REST_CHOICES,RELICS,restOutcome,rewardPolicy} from '../roguelite-rules.js';
import {makeStarter,createRun,emptySave,serializeSave,parseSave,resolveRestChoice,commitRunDeck,beginDeckEdit} from '../roguelite-core.js';
const cards=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url),'utf8')).cards;
const pool=JSON.parse(readFileSync(new URL('../data/roguelite-opponents.json',import.meta.url),'utf8')).pool;
const now='2026-10-14T06:00:00.000Z';
function fixture(){
  const deck=emptyDeck('rest-fixture','duel_links_plan');deck.groups.main=cards.filter(c=>!c.special&&c.type==='일반 몬스터'&&c.speed_limit==null).slice(0,20).map(c=>cardLine(c));
  const starter=makeStarter(deck,cards,{now}),run=createRun({id:'rest-run',slotId:'slot-1',starter,cards,seed:'rest-rules',now});
  run.map=generateMap(run.seed);run.encounters=assignEncounters(run.map,pool);const rest=run.map.nodes.find(n=>n.kind==='rest');
  run.current_node_id=rest.id;run.floor=rest.floor;run.state='at_node';run.lp=2400;
  return {run,rest,starter};
}
function roundTrip(run){const save=emptySave();save.slots[0].run=run;return parseSave(serializeSave(save)).slots[0].run;}

test('rest offers max LP only, full healing, or one unowned relic without mutating inputs',()=>{
  const {run,rest}=fixture(),original=structuredClone(run);assert.equal(REST_CHOICES.length,3);
  const growth=resolveRestChoice(run,rest.id,'max_lp',{now});assert.equal(growth.lp,2400);assert.equal(growth.max_lp,4500);
  const heal=resolveRestChoice(run,rest.id,'heal',{now});assert.equal(heal.lp,4000);assert.equal(heal.max_lp,4000);
  const relic=resolveRestChoice(run,rest.id,'relic',{now});assert.equal(relic.relics.length,1);assert(RELICS.some(r=>r.id===relic.relics[0]));
  assert.deepEqual(run,original);assert.equal(growth.state,'between_nodes');assert.equal(growth.revision,run.revision+1);
});
test('same rest cannot grant twice or change choice, including across JSON reload',()=>{
  const {run,rest}=fixture(),first=resolveRestChoice(run,rest.id,'max_lp',{now}),reloaded=roundTrip(first);
  assert.deepEqual(resolveRestChoice(reloaded,rest.id,'max_lp',{now}),reloaded);
  assert.throws(()=>resolveRestChoice(reloaded,rest.id,'relic',{now}),/이미/);
  assert.throws(()=>resolveRestChoice({...run,current_node_id:null},rest.id,'heal',{now}),/도착/);
  assert.throws(()=>resolveRestChoice({...run,state:'in_battle'},rest.id,'heal',{now}),/도착/);
  const battle=run.map.nodes.find(n=>n.kind==='battle');assert.throws(()=>resolveRestChoice({...run,current_node_id:battle.id,floor:battle.floor},battle.id,'heal',{now}),/도착/);
});
test('random relic is stable on retry/reload, excludes all owned, handles exhaustion and LP limits',()=>{
  const context={lp:2400,max_lp:4000,relics:[],seed:'rest-seed',nodeId:'f09-l0'};
  const first=restOutcome(context,'relic');assert.deepEqual(restOutcome(structuredClone(context),'relic'),first);
  for(const missing of RELICS){const out=restOutcome({...context,relics:RELICS.filter(r=>r!==missing).map(r=>r.id)},'relic');assert.equal(out.relic_id,missing.id);}
  assert.throws(()=>restOutcome({...context,relics:RELICS.map(r=>r.id)},'relic'),/모두/);
  assert.throws(()=>restOutcome({...context,max_lp:65036},'max_lp'),/한계/);
  assert.throws(()=>restOutcome({...context,lp:4000},'heal'),/가득/);
  assert.throws(()=>restOutcome({...context,lp:0},'heal'),/LP/);
});
test('legacy ten-floor saves remain ten-floor, and new assignments/rest claims survive deck save',()=>{
  const {run,rest}=fixture(),old=structuredClone(run);old.map=generateMap(old.seed,{floors:10});old.floor=0;old.state='between_nodes';
  delete old.encounters;delete old.current_node_id;delete old.rest_claims;old.content_version='prototype136';
  const loaded=roundTrip(old);assert.deepEqual(loaded.map,old.map);assert.deepEqual(loaded.encounters,{});assert.equal(loaded.map.floors,10);
  const changed=resolveRestChoice(run,rest.id,'relic',{now}),saved=roundTrip(commitRunDeck(changed,beginDeckEdit(changed),{now}));
  assert.deepEqual(saved.encounters,run.encounters);assert.deepEqual(saved.rest_claims,changed.rest_claims);assert.deepEqual(saved.relics,changed.relics);assert.equal(saved.map.floors,20);
  const duplicate=structuredClone(changed);duplicate.rest_claims.push(duplicate.rest_claims[0]);assert.throws(()=>roundTrip(duplicate),/중복/);
  const future=structuredClone(changed);future.floor=0;future.current_node_id=null;assert.throws(()=>roundTrip(future),/방문 위치/);
});
test('elite reward policy improves normal battle and applies run relic policy without changing decks',()=>{
  const normal=rewardPolicy('battle'),elite=rewardPolicy('elite');assert(elite.gold>normal.gold);assert.equal(elite.min_rarity,'SR');assert.equal(elite.relic,true);
  assert.deepEqual(rewardPolicy('midboss'),elite);const bonus=rewardPolicy('elite',['golden_scarab','restoring_ankh','card_slate']);
  assert.equal(bonus.gold,elite.gold+20);assert.equal(bonus.heal,200);assert.equal(bonus.card_choices,elite.card_choices+1);
});
