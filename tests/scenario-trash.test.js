import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStory,newBattle} from '../story-core.js';
import {readLibrary} from '../story-library.js';
import {attachCharacter} from '../character-library.js';
import {archiveLocal,restoreLocal,parseTrash} from '../scenario-trash.js';
const character={id:'bakura',version:23,profile:{name:'바쿠라',portrait:'assets/actors/shared-bakura.png'}};
const document=emptyStory();document.title='복원할 레이드';document.actors=[attachCharacter(character,'local-bakura')];
document.actors[0].skills=[{kind:'opening_draw',value:2}];document.battles=[newBattle('stable-battle')];
document.battles[0].actor_id='local-bakura';document.battles[0].rewards.first=[{kind:'gold',amount:100}];
const library=readLibrary({schema:1,active:'raid',entries:[{id:'main',title:'기본',version:1},{id:'raid',title:document.title,version:24}]});
test('delete then restore keeps battle/reward/skill identities and pending shared profile versions',()=>{
 const archived=archiveLocal(library,document,24,[character],[]);
 assert.equal(archived.library.active,'main');assert.equal(archived.library.entries.some(e=>e.id==='raid'),false);
 const restored=restoreLocal(archived.library,parseTrash(JSON.parse(JSON.stringify(archived.trash)))[0]);
 assert.equal(restored.library.active,'raid');assert.equal(restored.version,24);assert.deepEqual(restored.document,document);assert.deepEqual(restored.baselines,[character]);
 restored.document.actors[0].name='다른 편집';assert.equal(archived.row.document.actors[0].name,'바쿠라');assert.equal(library.active,'raid');
});
test('default scenario, duplicate restores, malformed archives and full active libraries refuse',()=>{
 assert.throws(()=>archiveLocal({...library,active:'main'},document,1,[],[]));
 const row=archiveLocal(library,document,24,[character],[]).row;assert.throws(()=>restoreLocal(library,row));
 assert.throws(()=>parseTrash([row,row]));assert.throws(()=>parseTrash([{...row,id:'../raid'}]));
 const full=readLibrary({schema:1,active:'main',entries:Array.from({length:20},(_,i)=>({id:i?'s'+i:'main',title:'s',version:1}))});
 assert.throws(()=>restoreLocal(full,row));
});
