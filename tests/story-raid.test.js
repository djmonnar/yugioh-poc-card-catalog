import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyStory,newActor,newBattle,parseStory,canonicalStory,validateStory,cardRef} from '../story-core.js';
const catalog=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url)));
const decks=JSON.parse(readFileSync(new URL('../data/ai-opponents.json',import.meta.url))).decks;
function fixture(){const doc=emptyStory(),a=newActor('bakura'),b=newBattle('raid-bakura');
 a.name='어둠의 바쿠라';b.actor_id=a.actor_id;b.recipe=decks.find(d=>d.ruleset==='duel_links_plan').source_recipe.filename;
 b.raid={max_hp:20000,milestones:[{milestone_id:'half',hp:10000,rewards:{first:[],repeat:[]}}]};
 doc.actors=[a];doc.battles=[b];return doc;}
test('raid authoring keeps HP, independent access and distinct cycle rewards',()=>{
 const d=fixture(),b=d.battles[0];b.rewards.first=[{kind:'gold',amount:100}];b.rewards.repeat=[{kind:'gold',amount:10}];
 const p=parseStory(d).battles[0];assert.equal(p.raid.max_hp,20000);assert.equal(p.requires_previous,false);
 assert.equal(p.rewards.first[0].amount,100);assert.equal(p.rewards.repeat[0].amount,10);
});
test('raid refuses out of range HP, duplicate thresholds, malformed rewards and overflowing receipt',()=>{
 for(const hp of [0,60001,1.5,true,'20000']){const d=fixture();d.battles[0].raid.max_hp=hp;assert.throws(()=>parseStory(d));}
 for(const hp of [0,20000,20001]){const d=fixture();d.battles[0].raid.milestones[0].hp=hp;assert.throws(()=>parseStory(d));}
 const d=fixture();d.battles[0].raid.milestones.push({...structuredClone(d.battles[0].raid.milestones[0]),milestone_id:'another'});assert.throws(()=>parseStory(d));
 d.battles[0].raid.milestones.pop();d.battles[0].raid.milestones[0].rewards.first=[{kind:'gold',amount:0}];assert.throws(()=>parseStory(d));
});
test('milestone card identities are validated and rebased just like defeat cards',()=>{
 const d=fixture(),c=catalog.cards.find(c=>c.reward_eligible&&!c.special);d.battles[0].raid.milestones[0].rewards.first=[{kind:'card',card:cardRef(c),count:2}];
 assert.equal(validateStory(d,catalog.cards,decks).issues.length,0);
 const cards=structuredClone(catalog.cards),n=cards.find(n=>n.slot===c.slot);n.previous_identity_keys=[n.identity_key];n.identity_key='f'.repeat(64);
 const clean=canonicalStory(d,catalog.meta,cards);assert.equal(clean.battles[0].raid.milestones[0].rewards.first[0].card.identity_key,n.identity_key);
 assert.equal(d.battles[0].raid.milestones[0].rewards.first[0].card.identity_key,c.identity_key);
 n.name_ko='Other card';assert.throws(()=>canonicalStory(d,catalog.meta,cards));
});
