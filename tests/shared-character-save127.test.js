import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStory,newBattle,parseStory,canonicalStory,cardRef} from '../story-core.js';
import {parseCharacters,attachCharacter,resolveCharacters,rebaseCharacters} from '../character-library.js';
import {saveScenarioSnapshot,storySyncSummary,sameScenarioContent,initialOnlineScenario} from '../story-online-save.js';
import {editableCharacterProfile,canonicalCharacterProfile,mergeCharacterProfile,saveCharacterSnapshot} from '../character-editor-core.js';

const card={slot:20,internal_id:200,name_ko:'해피의 사냥터',identity_key:'b'.repeat(64),previous_identity_keys:['a'.repeat(64)],type:'마법',special:false};
const profile={name:'메이',portrait:'assets/actors/shared-mai.png',skills:[{kind:'start_hand',card:cardRef(card)}],skill_profiles:[{profile_id:'hard',name:'상급',skills:[{kind:'opening_draw',value:2}]}]};
const row={id:'mai',version:2,profile};
function story(count=2,id='mai'){const d=emptyStory();d.title=id;d.actors=[attachCharacter(row,'actor')];d.battles=Array.from({length:count},(_,i)=>({...newBattle(`battle-${i}`),actor_id:'actor',recipe:'DLR_000.ydc'}));return d;}
const conflict={message:'poc_conflict',code:'P0001'};
function clientMock(handler){const calls=[];return {calls,async rpc(name,args){calls.push({name,args:structuredClone(args)});return handler(name,args,calls.length);}};}

test('modern character references share all traits while legacy Hunting Ground drafts keep their overrides',()=>{
  const modern=story(),legacy=story();delete legacy.actors[0].use_shared_skills;legacy.actors[0].skills=[{kind:'start_hand',card:cardRef(card)}];
  const updated={...row,version:3,profile:{...profile,skills:[{kind:'opening_draw',value:3}]}};
  assert.deepEqual(resolveCharacters(modern,[updated]).actors[0].skills,updated.profile.skills);
  assert.deepEqual(resolveCharacters(legacy,[updated]).actors[0].skills,legacy.actors[0].skills);
  assert.equal(parseStory(modern).actors[0].use_shared_skills,true);
  assert.throws(()=>parseStory({...modern,actors:[{...modern.actors[0],use_shared_skills:'yes'}]}));
  assert.deepEqual(rebaseCharacters(legacy,[row],[updated]).document.actors[0].skills,legacy.actors[0].skills);
});
test('old shared rows retain absence of traits; new attachment explicitly selects shared empty defaults',()=>{
  const old={id:'old',version:1,profile:{name:'캐릭터',portrait:''}};
  assert.equal(Object.hasOwn(parseCharacters([old])[0].profile,'skills'),false);
  const attached=attachCharacter(old,'actor');assert.equal(attached.use_shared_skills,true);assert.deepEqual(attached.skills,[]);assert.deepEqual(attached.skill_profiles,[]);
  assert.throws(()=>parseCharacters([{...old,profile:{...old.profile,skills:[]}}]));
});
test('scenario saves four and seven battles without making any character save request',async()=>{
  for(const count of [4,7]){const value=story(count),client=clientMock((name,args)=>({data:{id:'mai',version:3,document:args.p_document}}));
    const result=await saveScenarioSnapshot(client,{id:'mai',document:value,expectedVersion:2});
    assert.equal(result.row.document.battles.length,count);assert.deepEqual(client.calls.map(c=>c.name),['poc_save_scenario']);assert.equal(value.battles.length,count);
  }
});
test('character metadata-only version conflicts retry captured local battles using historical proof',async()=>{
  const base={id:'mai',version:2,document:story(2)},latest=structuredClone(base);latest.version=3;latest.document.actors[0].name='새 공용 메이';latest.document.actors[0].skills=[];
  const draft=story(4),client=clientMock((name,args,n)=>{
    if(name==='poc_save_scenario')return n===1?{error:conflict}:{data:{id:'mai',version:4,document:args.p_document}};
    if(name==='poc_load_scenarios')return {data:[latest]};
    if(name==='poc_load_scenario_revision')return {data:base};throw new Error(name);
  });
  const result=await saveScenarioSnapshot(client,{id:'mai',document:draft,expectedVersion:2});
  assert.equal(result.rebased,true);assert.equal(result.row.document.battles.length,4);assert.equal(client.calls.at(-1).args.p_expected_version,3);assert.deepEqual(draft,story(4));
});
test('actual remote battle changes and unknown history do not overwrite online or local drafts',async()=>{
  for(const missing of [false,true]){const base={id:'mai',version:2,document:story(2)},latest=structuredClone(base);latest.version=3;latest.document.battles[0].intro='다른 사람이 편집한 전투';
    const draft=story(4),copy=structuredClone(draft),client=clientMock(name=>name==='poc_save_scenario'?{error:conflict}:name==='poc_load_scenarios'?{data:[latest]}:{data:missing?null:base});
    await assert.rejects(saveScenarioSnapshot(client,{id:'mai',document:draft,expectedVersion:2}),/poc_conflict/);
    assert.equal(client.calls.filter(c=>c.name==='poc_save_scenario').length,1);assert.deepEqual(draft,copy);
  }
});
test('legacy actor trait changes remain owned scenario changes and cannot be hidden as shared metadata',()=>{
  const a=story(),b=story();delete a.actors[0].use_shared_skills;delete b.actors[0].use_shared_skills;b.actors[0].skills=[];
  assert.equal(sameScenarioContent(a,b),false);
});
test('known historic card identities normalize for conflict comparison before any retry',async()=>{
  const base={id:'mai',version:2,document:story()},latest=structuredClone(base);latest.version=3;
  delete base.document.actors[0].use_shared_skills;delete latest.document.actors[0].use_shared_skills;base.document.actors[0].skills[0].card.identity_key='a'.repeat(64);
  const client=clientMock((name,args,n)=>name==='poc_save_scenario'?n===1?{error:conflict}:{data:{id:'mai',version:4,document:args.p_document}}:name==='poc_load_scenarios'?{data:[latest]}:{data:base});
  const result=await saveScenarioSnapshot(client,{id:'mai',document:story(4),expectedVersion:2,normalizeDocument:d=>canonicalStory(d,{dataset_id:'current'},[card])});assert.equal(result.rebased,true);
});
test('persistent sync summary distinguishes the current four-battle draft from online two-battle data',()=>{
  const s=storySyncSummary(story(4),{id:'mai',version:2,document:story(2)});assert.equal(s.state,'dirty');assert.match(s.text,/4전투.*2전투.*미반영/);
});
test('first visit loads an online story only over an untouched temporary seed; stored or edited drafts survive',()=>{
  const initial=story(1),remote={id:'mai',version:3,document:story(3)},seed={id:'mai',document:structuredClone(initial)};
  assert.equal(initialOnlineScenario('mai',initial,seed,remote).document.battles.length,3);
  assert.equal(initialOnlineScenario('mai',story(4),seed,remote),null);
  assert.equal(initialOnlineScenario('mai',initial,null,remote),null);
  assert.equal(initialOnlineScenario('regular',initial,seed,remote),null);
});
test('character editor preserves card skill and both fields and validates actual card references',()=>{
  assert.deepEqual(editableCharacterProfile(profile).skills,profile.skills);
  assert.deepEqual(canonicalCharacterProfile(profile,{dataset_id:'current'},[card]).skills,profile.skills);
  assert.throws(()=>canonicalCharacterProfile(profile,{dataset_id:'current'},[]),/카드가 변경/);
});
test('three-way character save merges independent portrait and traits, rejects simultaneous trait edits',async()=>{
  const base={...row,profile:{...profile,skills:[]}},draft={...base.profile,skills:profile.skills},latest={...base,version:3,profile:{...base.profile,portrait:'assets/actors/new-mai.png'}};
  assert.equal(mergeCharacterProfile(base.profile,draft,latest.profile).portrait,latest.profile.portrait);
  const client=clientMock((name,args,n)=>name==='poc_save_characters'?n===1?{error:conflict}:{data:[{id:'mai',version:4,profile:args.p_characters[0].profile}]}:{data:[latest]});
  const result=await saveCharacterSnapshot(client,{id:'mai',profile:draft,expectedVersion:2,baseline:base});assert.equal(result.rebased,true);assert.deepEqual(result.row.profile.skills,profile.skills);assert.equal(result.row.profile.portrait,latest.profile.portrait);assert.ok(client.calls.every(c=>!c.name.includes('scenario')));
  assert.throws(()=>mergeCharacterProfile(base.profile,draft,{...latest.profile,skills:[{kind:'opening_draw',value:3}]}),/poc_conflict: skills/);
});
