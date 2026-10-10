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
test('rename applies one atomic server state with category version and intact related links',async()=>{
 const original={...structuredClone(state),categories:[{name:'공룡덱',version:11},{name:'검색',version:12}]};
 const renamed={categories:[{name:'공룡',version:13},{name:'검색',version:12}],annotations:[{...row,tags:['공룡','검색'],version:14}],deleted_categories:[]};
 let request;const cloud=new CardTagsCloud({rpc:async(name,args)=>{request={name,args};return {data:name==='poc_load_card_annotations'?original:renamed};}});
 await cloud.load();await cloud.rename('공룡덱',' 공룡 ');
 assert.deepEqual(request,{name:'poc_rename_card_category',args:{p_name:'공룡덱',p_new_name:'공룡',p_expected_version:11}});
 assert.equal(tagMatches(cloud.state,a,['공룡']),true);assert.equal(tagMatches(cloud.state,a,['공룡덱']),false);assert.deepEqual(annotationFor(cloud.state,a).links,row.links);assert.equal(cloud.version(a),14);
});
test('archive and restore use the current active or deleted version',async()=>{
 const initial={...structuredClone(state),categories:[{name:'공룡덱',version:11},{name:'검색',version:12}]};
 const removed={categories:[{name:'검색',version:12}],annotations:[{...row,tags:['검색'],version:14}],deleted_categories:[{name:'공룡덱',version:13}]};
 const restored={categories:[{name:'공룡덱',version:15},{name:'검색',version:12}],annotations:[{...row,version:16}],deleted_categories:[]};
 const calls=[],cloud=new CardTagsCloud({rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='poc_load_card_annotations'?initial:name==='poc_archive_card_category'?removed:restored};}});
 await cloud.load();await cloud.remove('공룡덱');assert.deepEqual(relatedAnnotations(cloud.state,a,[a,b]),[b]);assert.equal(tagMatches(cloud.state,a,['공룡덱']),false);
 await cloud.restore('공룡덱');assert.equal(calls[2][1].p_expected_version,13);assert.equal(tagMatches(cloud.state,a,['공룡덱']),true);
});
test('failed or malformed category operations preserve displayed annotations',async()=>{
 const original={...structuredClone(state),categories:[{name:'공룡덱',version:11},{name:'검색',version:12}]};
 for(const response of [{error:{message:'poc_conflict'}},{data:{...original,deleted_categories:[{name:'공룡덱',version:2}]}}]){
  const cloud=new CardTagsCloud({rpc:async name=>name==='poc_load_card_annotations'?{data:original}:response});await cloud.load();await assert.rejects(cloud.remove('공룡덱'));assert.deepEqual(cloud.state,original);
 }
});
test('annotations scale beyond the old 1115 cards and archived names cannot be assigned',()=>{
 const many={categories:[{name:'검색',version:1}],annotations:Array.from({length:1286},(_,i)=>({...a,slot:i+1,tags:['검색'],links:[],version:i+1}))};assert.equal(annotationState(many).annotations.length,1286);
 assert.throws(()=>annotationState({categories:[],annotations:[{...row,tags:['공룡덱']}],deleted_categories:[{name:'공룡덱',version:3}]}));
});
