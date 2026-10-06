import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedPage,pageWindow} from '../pagination.js';

test('page ranges keep first, last and the current neighborhood without duplicates',()=>{
  assert.deepEqual(pageWindow(1,31),[1,2,3,null,31]);
  assert.deepEqual(pageWindow(16,31),[1,null,14,15,16,17,18,null,31]);
  assert.deepEqual(pageWindow(31,31),[1,null,29,30,31]);
  assert.deepEqual(pageWindow(3,5),[1,2,3,4,5]);
});
test('empty results and a filter reducing page count stay navigable',()=>{
  assert.deepEqual(pageWindow(20,0),[1]);
  assert.equal(boundedPage(20,3),3);
  assert.equal(boundedPage(-5,10),1);
  assert.equal(boundedPage('invalid',10),1);
});
