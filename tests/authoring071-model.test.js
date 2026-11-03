import test from 'node:test';
import assert from 'node:assert/strict';
import {planEnemyRoutes071,applyCommonRoutes071,effectiveLp071} from '../authoring071-route-model.js';
const copy=structuredClone,encounter=lp=>({name:'같은 이름',deck_name:'공유 덱',profile_id:'yugi',art_key:'art-yugi',lp_bonus:lp,skills:[],use_shared_skills:false,unknown:{keep:true}});
const entry=(id,lp=0)=>({entry_id:id,deck_id:'deck',weight:3,encounter:encounter(lp),unknownEntry:42});
const role=(id,entries=[])=>({entity_type:'chapter_role',entity_id:id,content:{chapter:Number(id[0]),role:id.slice(2),lp_bonus:700,entries,unknownRole:73}});
const source=()=>[{entity_type:'deck',entity_id:'deck',content:{name:'공유 덱'}},role('1:battle',[entry('a',300),entry('b',1200)]),role('2:boss',[entry('c',2000)])];
test('existing target selection alone produces no change and preserves mixed values',()=>{
 const entities=source(),before=copy(entities),targets=[{roleId:'1:battle',entryId:'a',create:false,encounter:{}},{roleId:'2:boss',entryId:'c',create:false,encounter:{}}];
 assert.deepEqual(planEnemyRoutes071({entities,deckId:'deck',targets}).changes,[]);assert.deepEqual(entities,before);
});
test('explicit common application changes only named deltas and leaves the original plan immutable',()=>{
 const targets=[{roleId:'1:battle',entryId:'a',create:false,encounter:{opening_draw_bonus:2}},{roleId:'2:boss',entryId:'c',create:false,encounter:{}}],before=copy(targets),next=applyCommonRoutes071(targets,{lp_bonus:1700});
 assert.deepEqual(targets,before);assert.deepEqual(next[0].encounter,{opening_draw_bonus:2,lp_bonus:1700});const entities=source(),plan=planEnemyRoutes071({entities,deckId:'deck',targets:next});assert.equal(plan.changes.length,2);assert.equal(plan.changes[0].fields.entries[1].encounter.lp_bonus,1200);assert.equal(plan.changes[0].fields.entries[0].unknownEntry,42);assert.deepEqual(Object.keys(plan.changes[0].fields),['entries']);
});
test('a plan merges into latest unrelated members and never changes role LP or other routes',()=>{
 const entities=source();entities[1].content.entries.push({...entry('latest'),deck_id:'other'});const before=copy(entities),plan=planEnemyRoutes071({entities,deckId:'deck',targets:[{roleId:'1:battle',entryId:'a',create:false,encounter:{lp_bonus:1000}}]});
 assert.deepEqual(plan.keys,[{type:'chapter_role',id:'1:battle'}]);assert.deepEqual(plan.changes[0].fields.entries[2],entities[1].content.entries[2]);assert.deepEqual(entities,before);
});
test('a duplicate selected entry rejects instead of quietly taking the last override',()=>{
 const target={roleId:'1:battle',entryId:'a',create:false,encounter:{lp_bonus:1000}};assert.throws(()=>planEnemyRoutes071({entities:source(),deckId:'deck',targets:[target,{...target,encounter:{lp_bonus:2000}}]}),/두 번/);
});
test('new targets have independent IDs, repeat safely, and cannot reuse a ready-only historical ID',()=>{
 const entities=source(),target={roleId:'1:battle',entryId:'new',create:true,encounter:encounter(0)},plan=planEnemyRoutes071({entities,deckId:'deck',targets:[target]});entities[1].content.entries=plan.changes[0].fields.entries;
 assert.deepEqual(planEnemyRoutes071({entities,deckId:'deck',targets:[target]}).changes,[]);
 entities[2].ready_content={entries:[entry('history')]};assert.throws(()=>planEnemyRoutes071({entities,deckId:'deck',targets:[{...target,entryId:'history'}]}),/번호/);
});
test('a full later pool rejects the complete plan without altering an earlier destination',()=>{
 const entities=source();entities[2].content.entries=Array.from({length:100},(_,i)=>entry('full-'+i));const before=copy(entities);assert.throws(()=>planEnemyRoutes071({entities,deckId:'deck',targets:[{roleId:'1:battle',entryId:'first',create:true,encounter:encounter(1000)},{roleId:'2:boss',entryId:'later',create:true,encounter:encounter(1000)}]}),/100명/);assert.deepEqual(entities,before);
});
test('LP preview uses the chosen named profile rather than adding the character base',()=>{
 const characters=[{id:'char',profile:{skills:[{kind:'lp_bonus',value:500}],skill_profiles:[{profile_id:'named',skills:[{kind:'lp_bonus',value:1800}]}]}}],value={...encounter(0),use_shared_skills:true,shared_character_id:'char',shared_skill_profile_id:'named'};
 assert.equal(effectiveLp071(value,role('1:battle'),characters).total,6500);assert.equal(effectiveLp071({...value,lp_bonus:1000},role('1:battle'),characters).total,5700);assert.equal(effectiveLp071({...value,use_shared_skills:false},role('1:battle'),characters).total,4700);assert.equal(effectiveLp071({...value,shared_skill_profile_id:'missing'},role('1:battle'),characters).total,null);
});
