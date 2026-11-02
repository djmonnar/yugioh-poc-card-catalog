import test from 'node:test';
import assert from 'node:assert/strict';
import {draftScope068} from '../authoring068-scope.js';
import {characterChoice068,changeCharacter068,traitChoices068,changeTrait068} from '../authoring068-character.js';

const character=(id,profile_id,name,skills=[],skill_profiles=[])=>({id,profile_id,art_key:`art/${id}`,profile:{name,skills,skill_profiles}});
const characters=[character('yugi-a','yugi','유희'),character('yugi-b','yugi','다른 유희'),character('leon','leon','레온',[],[{profile_id:'one',name:'황야',skills:[{kind:'lp_bonus',amount:100}]},{profile_id:'two',name:'황야',skills:[{kind:'opening_draw',amount:1}]}])];

test('character selection preserves distinct character identities sharing one presentation',()=>{
 const value={profile_id:'yugi',shared_character_id:'yugi-b',use_shared_skills:true,shared_skill_profile_id:null};
 assert.equal(characterChoice068(value,characters),'yugi-b');
 const changed=changeCharacter068('leon',characters);
 assert.equal(changed.profile_id,'leon');assert.equal(changed.name,'레온');assert.equal(changed.use_shared_skills,false);assert.equal(changed.shared_skill_profile_id,null);
 assert.equal(Object.hasOwn(changed,'skills'),false,'Existing direct traits remain untouched.');
 const duplicate={...changeCharacter068('yugi-b',characters),...changeTrait068('','yugi-b')};
 assert.equal(duplicate.use_shared_skills,false);assert.equal(characterChoice068(duplicate,characters),'yugi-b','Disabling traits must preserve the selected character identity.');
});

test('optional traits expose actual profiles and disambiguate duplicate display names',()=>{
 const value={profile_id:'leon',use_shared_skills:false};const result=traitChoices068(value,characters);
 assert.deepEqual(result.choices.map(row=>row.label),['사용 안 함','황야 (1) · 1개','황야 (2) · 1개']);
 assert.deepEqual(changeTrait068(result.choices[2].value),{shared_character_id:'leon',shared_skill_profile_id:'two',use_shared_skills:true});
 assert.deepEqual(changeTrait068(''),{shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
 assert.equal(traitChoices068({profile_id:'yugi',use_shared_skills:false},characters).choices.length,1);
});

test('viewing an intentional cross-character trait link preserves its exact reference',()=>{
 const value={profile_id:'yugi',shared_character_id:'leon',shared_skill_profile_id:'two',use_shared_skills:true},before=structuredClone(value),result=traitChoices068(value,characters);
 assert.equal(result.choices.at(-1).label,'현재 연결 유지 · 레온 · 황야');
 assert.deepEqual(changeTrait068(result.current),{shared_character_id:'leon',shared_skill_profile_id:'two',use_shared_skills:true});assert.deepEqual(value,before);
});

const item=(type,id,content={})=>({type,id,content}),entity=(entity_type,entity_id,content)=>({entity_type,entity_id,content});
test('deck save includes removals, every dirty destination and new deck dependencies while leaving unrelated drafts',()=>{
 const items=[item('deck','selected'),item('chapter_role','1:battle',{entries:[]}),item('chapter_role','2:boss',{entries:[{deck_id:'selected'},{deck_id:'new-deck'},{deck_id:'other'}]}),{...item('deck','new-deck'),operation:'create'},item('deck','other'),item('character','leon')];
 const canonical={entities:[entity('chapter_role','1:battle',{entries:[{deck_id:'selected'}]})]};
 assert.deepEqual(draftScope068({scope:{deckSetup068:'selected'},items,canonical}),items.slice(0,4).map(({type,id})=>({type,id})));
});

test('chapter Save automatically includes its unsaved referenced deck without changing other scopes',()=>{
 const items=[item('chapter_role','1:battle',{entries:[{deck_id:'new'}]}),{...item('deck','new'),operation:'create'},item('card_display','new')];
 assert.deepEqual(draftScope068({scope:{id:'1:battle',types:['chapter_role']},items}),items.slice(0,2).map(({type,id})=>({type,id})));
 assert.deepEqual(draftScope068({scope:{id:'new',types:['card_display']},items}),[{type:'card_display',id:'new'}]);
 assert.deepEqual(draftScope068({items}),items.map(({type,id})=>({type,id})));
});
