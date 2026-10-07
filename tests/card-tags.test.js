import test from 'node:test';import assert from 'node:assert/strict';
import {tagName,annotationState,annotationFor,tagMatches,relatedAnnotations,CardTagsCloud} from '../card-tags.js';
const a={slot:720,internal_id:197,identity_key:'a'.repeat(64)},b={slot:1115,internal_id:1001,identity_key:'b'.repeat(64)};
const row={...a,tags:['공룡덱','검색'],links:[{slot:b.slot,identity_key:b.identity_key}],version:9};
const state={categories:[{name:'공룡덱'},{name:'검색'}],annotations:[row]};
test('custom tags intersect, preserve identities and ignore donor replacements',()=>{
 assert.equal(tagName('  공룡덱  '),'공룡덱');assert.equal(tagMatches(state,a,['공룡덱','검색']),true);assert.equal(tagMatches(state,b,['공룡덱']),false);
 assert.equal(annotationFor(state,{...a,identity_key:'c'.repeat(64)}),null);assert.equal(annotationFor(state,{...a,internal_id:198}),null);assert.equal(tagMatches(null,a,[]),true);
});
test('manual links appear in both directions and never transfer to a replaced target',()=>{
 assert.deepEqual(relatedAnnotations(state,a,[a,b]),[b]);assert.deepEqual(relatedAnnotations(state,b,[a,b]),[a]);
 assert.deepEqual(relatedAnnotations(state,a,[a,{...b,identity_key:'c'.repeat(64)}]),[]);
});
test('invalid category, duplicate link and self link fail without partial merging',()=>{
 for(const name of ['', 'a'.repeat(41),'x\ny'])assert.throws(()=>tagName(name));
 for(const bad of [{...state,categories:[{name:'공룡덱'},{name:'공룡덱'}]},
  {...state,annotations:[{...row,tags:['없는 카테고리']}]},
  {...state,annotations:[{...row,links:[row.links[0],row.links[0]]}]},
  {...state,annotations:[{...row,links:[{slot:a.slot,identity_key:a.identity_key}]}]}])assert.throws(()=>annotationState(bad));
});
test('conflicting online saves retain the draft state and original displayed version',async()=>{
 const calls=[],cloud=new CardTagsCloud({rpc:async(name,args)=>{calls.push([name,args]);return name==='poc_load_card_annotations'?{data:structuredClone(state)}:{error:{message:'poc_conflict'}};}});
 assert.throws(()=>cloud.version(a));await cloud.load();await assert.rejects(cloud.save({dataset_id:'new'},a,['공룡덱'],[],cloud.version(a)),/다른 기기/);
 assert.equal(calls[1][1].p_expected_version,9);assert.deepEqual(cloud.state,state);
});
test('successful save updates annotations without modifying game properties or categories',async()=>{
 const saved={...row,tags:[],links:[],version:10};const cloud=new CardTagsCloud({rpc:async name=>({data:name==='poc_load_card_annotations'?structuredClone(state):saved})});
 await cloud.load();const before=structuredClone(a);await cloud.save({dataset_id:'new'},a,[],[],9);assert.deepEqual(a,before);assert.deepEqual(cloud.state.categories,state.categories);assert.equal(cloud.version(a),10);
});
