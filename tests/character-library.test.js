import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStory,parseStory} from '../story-core.js';
import {parseCharacters,attachCharacter,resolveCharacters,characterUpdates,linkLegacyCharacters,rebaseCharacters,synchronizeCharacterCopies} from '../character-library.js';
const row={id:'bakura',version:2,profile:{name:'어둠의 바쿠라',portrait:'assets/actors/shared-bakura.png'}};
test('a common profile update reaches independent scenarios while their skills and battles remain',()=>{
  const a=emptyStory(),b=emptyStory();a.actors=[attachCharacter(row,'a')];b.actors=[attachCharacter(row,'b')];
  a.actors[0].skills=[{kind:'opening_draw',value:2}];b.actors[0].skills=[{kind:'heal_once',value:1000}];
  const next={...row,profile:{...row.profile,name:'바쿠라',presentation:{enabled:true,portrait:true,events:{attack:{image:'',audio:'assets/voices/attack.wav'}}}}};
  const aa=resolveCharacters(a,[next]),bb=resolveCharacters(b,[next]);
  assert.equal(aa.actors[0].name,bb.actors[0].name);assert.deepEqual(aa.actors[0].skills,a.actors[0].skills);assert.deepEqual(bb.actors[0].skills,b.actors[0].skills);
  assert.equal(aa.actors[0].actor_id,'a');assert.equal(bb.actors[0].actor_id,'b');assert.deepEqual(aa.battles,a.battles);assert.equal(parseStory(aa).actors[0].character_id,row.id);
});

test('fresh global profiles refresh clean drafts while dirty drafts keep their original expected version',()=>{
  const d=emptyStory();d.actors=[attachCharacter(row,'a')];
  const latest={...row,version:3,profile:{...row.profile,name:'새 공용 이름'}};
  const clean=rebaseCharacters(d,[row],[latest]);assert.equal(clean.document.actors[0].name,'새 공용 이름');assert.deepEqual(characterUpdates(clean.document,clean.baselines),[]);
  d.actors[0].name='내 미저장 편집';const dirty=rebaseCharacters(d,[row],[latest]);
  assert.equal(dirty.document.actors[0].name,'내 미저장 편집');assert.equal(characterUpdates(dirty.document,dirty.baselines)[0].expected_version,2);
  const unknown=rebaseCharacters(d,[],[latest]);assert.equal(characterUpdates(unknown.document,unknown.baselines)[0].expected_version,0);
});

test('one edited profile propagates to duplicate references while their different skills remain',()=>{
  const d=emptyStory();d.actors=[attachCharacter(row,'a'),attachCharacter(row,'b')];
  d.actors[1].skills=[{kind:'opening_draw',value:2}];d.actors[0].name='편집된 공용 이름';
  synchronizeCharacterCopies(d,[row]);assert.equal(d.actors[1].name,d.actors[0].name);
  assert.deepEqual(d.actors[1].skills,[{kind:'opening_draw',value:2}]);assert.equal(characterUpdates(d,[row]).length,1);
});
test('legacy copies link by character identity; explicit references survive parsing and skills stay local',()=>{
  const d=emptyStory();d.actors=[{actor_id:'old',name:'페가수스 j 크로프트',portrait:'',skills:[{kind:'heal_once',value:500}]}];
  const linked=linkLegacyCharacters(d,[{id:'pegasus',version:1,profile:{name:'페가수스',portrait:'assets/actors/shared-pegasus.png'}}]);
  assert.equal(linked.actors[0].character_id,'pegasus');assert.deepEqual(linked.actors[0].skills,d.actors[0].skills);assert.equal(d.actors[0].name,'페가수스 j 크로프트');
});
test('updates carry expected versions; unknown references and unsafe profiles cannot silently pass',()=>{
  const d=emptyStory();d.actors=[attachCharacter(row,'a')];assert.deepEqual(characterUpdates(d,[row]),[]);
  d.actors[0].name='수정';assert.equal(characterUpdates(d,[row])[0].expected_version,2);
  assert.throws(()=>resolveCharacters(d,[]));assert.throws(()=>parseCharacters([row,row]));
  assert.throws(()=>parseCharacters([{...row,profile:{...row.profile,portrait:'https://foreign.invalid/a.png'}}]));
  d.actors.push({...d.actors[0],actor_id:'b',name:'서로 다른 편집'});assert.throws(()=>characterUpdates(d,[row]));
});
