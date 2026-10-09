import test from 'node:test';
import assert from 'node:assert/strict';
import {newBattle,newActor,emptyStory} from '../story-core.js';
import {copyBattle,createScenario,readLibrary,scenarioKey,namedRecipeRows,parseRemoteScenarios,actorTemplates,importActor} from '../story-library.js';
test('later characters can be copied back into earlier scenarios with independent IDs and profiles',()=>{
 const current=emptyStory(),later=emptyStory(),actor=newActor('joey');actor.name='조이';actor.skill_profiles=[{profile_id:'hard',name:'상급',skills:[{kind:'lp_bonus',value:1000}]}];later.actors=[actor];
 const templates=actorTemplates([{id:'later',document:later}],current);assert.equal(templates.length,1);
 const imported=importActor(templates[0],'new-joey');assert.equal(imported.actor_id,'new-joey');assert.equal(imported.name,'조이');
 imported.skill_profiles[0].skills[0].value=2000;assert.equal(actor.skill_profiles[0].skills[0].value,1000);
 current.actors=[importActor(templates[0],'copy')];assert.equal(actorTemplates([{id:'later',document:later}],current).length,0);
 const b=newBattle('old');b.requires_previous=false;assert.equal(copyBattle(b,'new').requires_previous,false);
});
test('battle copy has independent dialogue/reward data and a fresh progress identity',()=>{
  const b=newBattle('original');b.rewards.first=[{kind:'card',card:{slot:1},count:1}];
  const c=copyBattle(b,'copy');assert.equal(c.battle_id,'copy');assert.equal(c.name,'새 전투 복사');
  c.rewards.first[0].card.slot=2;assert.equal(b.rewards.first[0].card.slot,1);
  assert.throws(()=>copyBattle(b,'original'));
});
test('separate scenarios retain main storage and do not copy battle clear identities',()=>{
  const d=emptyStory();d.actors=[{actor_id:'yugi',skills:[]}];d.battles=[newBattle('first')];
  const s=createScenario(d,'yugi-story');assert.equal(s.document.battles.length,0);
  s.document.actors[0].skills.push({kind:'heal_once',value:1000});assert.equal(d.actors[0].skills.length,0);
  assert.equal(scenarioKey('main'),'poc-story-authoring-v1');assert.notEqual(scenarioKey('yugi-story'),scenarioKey('main'));
  assert.equal(readLibrary(null).active,'main');assert.throws(()=>readLibrary({schema:1,entries:[{id:'../bad',title:'bad',version:0}]}));
});
test('saved names apply only to the same recipe and ruleset',()=>{
  const decks=[{name:'기본',ruleset:'classic',source_recipe:{filename:'cpu_000.ydc'}}];
  namedRecipeRows(decks,[{filename:'cpu_000.ydc',packet:{deck:{name:'유희 마법사',ruleset:'classic'}}}]);assert.equal(decks[0].name,'유희 마법사');
  namedRecipeRows(decks,[{filename:'cpu_000.ydc',packet:{deck:{name:'다른 모드',ruleset:'duel_links_plan'}}}]);assert.equal(decks[0].name,'유희 마법사');
});
test('remote library rejects duplicate IDs and invalid versions',()=>{
  const row={id:'main',version:1,document:emptyStory()};assert.equal(parseRemoteScenarios([row]).length,1);
  assert.throws(()=>parseRemoteScenarios([row,row]));assert.throws(()=>parseRemoteScenarios([{...row,version:-1}]));
});
