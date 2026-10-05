import test from 'node:test';
import assert from 'node:assert/strict';
import {STORAGE_KEY, exportPayload, makeReview, parseImport} from '../review-core.js';
import {RESET_BACKUP_KEY, resetStoredReviews} from '../review-storage.js';
const card={identity_key:'a'.repeat(64),slot:2,internal_id:614,name_ko:'펠그란트 드래곤',rarity:'R',deck_limit:3};
const meta={dataset_id:'b'.repeat(64),snapshot_date:'2026-10-06'};
const payload=exportPayload(meta,[makeReview(card,{note:'효과 실제랑 다름'})],[{identity_key:'c'.repeat(64),slot:1,internal_id:0,changes:{note:'이전 카드'}}]);
function storage(fail){const values=new Map([[STORAGE_KEY,JSON.stringify(payload)]]);return {values,setItem(k,v){if(k===fail)throw Error('quota');values.set(k,v);}};}
test('reset empties active and unmatched opinions while retaining a restorable backup',()=>{
 const s=storage(),backup=resetStoredReviews(s,payload);
 assert.deepEqual(JSON.parse(s.values.get(STORAGE_KEY)).reviews,[]);
 assert.deepEqual(JSON.parse(s.values.get(STORAGE_KEY)).unmatched_reviews,[]);
 assert.equal(s.values.get(RESET_BACKUP_KEY),backup);
 const restored=parseImport(JSON.parse(backup),[card]);assert.equal(restored.valid.length,1);assert.equal(restored.unmatched.length,1);
});
for(const key of [RESET_BACKUP_KEY,STORAGE_KEY])test(`storage failure at ${key} keeps active opinions`,()=>{
 const s=storage(key),original=s.values.get(STORAGE_KEY);assert.throws(()=>resetStoredReviews(s,payload));assert.equal(s.values.get(STORAGE_KEY),original);
});
