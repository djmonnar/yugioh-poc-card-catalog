import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptyStory,newBattle} from '../story-core.js';
import {loadScenarioSnapshot,saveConfirmedScenarioSnapshot} from '../story-online-save.js';

function story(n){const doc=emptyStory();doc.title='메이';doc.battles=Array.from({length:n},(_,i)=>newBattle('battle-'+i));return doc;}
const row={id:'mai',version:2,document:story(2)};

test('explicit conflict resolution captures the displayed revision, sends the local snapshot once, and never saves characters',async()=>{
  const calls=[],draft=story(4),before=structuredClone(draft),client={async rpc(name,args){calls.push({name,args});return {data:{id:'mai',version:3,document:args.p_document}};}};
  const result=await saveConfirmedScenarioSnapshot(client,{id:'mai',document:draft,online:row});
  assert.deepEqual(calls.map(c=>c.name),['poc_save_scenario']);assert.equal(calls[0].args.p_expected_version,2);assert.equal(result.row.document.battles.length,4);assert.deepEqual(draft,before);
});

test('a new conflict or malformed displayed scenario never silently rebases an explicit choice',async()=>{
  let calls=0;const client={async rpc(){calls++;return {error:{message:'poc_conflict'}};}};
  await assert.rejects(saveConfirmedScenarioSnapshot(client,{id:'mai',document:story(4),online:row}),e=>e.message==='poc_conflict');assert.equal(calls,1);
  await assert.rejects(saveConfirmedScenarioSnapshot(client,{id:'other',document:story(4),online:row}),/시나리오가 달라/);assert.equal(calls,1);
});

test('comparison lookup returns only the selected live scenario and rejects absent or malformed revisions',async()=>{
  assert.equal((await loadScenarioSnapshot({rpc:async()=>({data:[row]})},'mai')).version,2);
  await assert.rejects(loadScenarioSnapshot({rpc:async()=>({data:[row]})},'regular'),/저장본이 없어/);
  await assert.rejects(loadScenarioSnapshot({rpc:async()=>({data:[{...row,version:0}]})},'mai'),/목록을 확인/);
});

test('the mobile conflict comparison is present once and the entry point refreshes both UI and helper module versions',()=>{
  const html=fs.readFileSync(new URL('../story.html',import.meta.url),'utf8'),js=fs.readFileSync(new URL('../story.js',import.meta.url),'utf8');
  for(const id of ['scenario-conflict','conflict-local-title','conflict-online-title','conflict-local-battles','conflict-online-battles','save-conflict-draft','dismiss-scenario-conflict'])assert.equal(html.split(`id="${id}"`).length-1,1);
  assert.match(html,/story\.js\?v=20261013-conflict128/);assert.match(js,/story-online-save\.js\?v=20261013-conflict128/);assert.match(html,/현재 편집본으로 온라인 저장/);
  for(const file of ['story-library.js','scenario-trash.js'])assert.match(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),/story-core\.js\?v=20261012-shared127/);
  assert.match(js,/story-library\.js\?v=20261013-conflict128/);assert.match(js,/scenario-trash\.js\?v=20261013-conflict128/);
  assert.match(fs.readFileSync(new URL('../scenario-trash.js',import.meta.url),'utf8'),/character-library\.js\?v=20261012-shared127/);
});
