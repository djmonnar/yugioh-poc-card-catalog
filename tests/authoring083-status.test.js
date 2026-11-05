import test from 'node:test';
import assert from 'node:assert/strict';
import {draftLabel083,syncDetail083} from '../authoring083-status.js';
import {saveLabel039} from '../authoring039-shell.js';

test('one card edited across four editors is described as one card and still remains unsaved',()=>{
 const summary={dirtyCount:4,items:['card_display','card_setting','card_limit','card_annotation'].map(type=>({type,id:'2588',dirty:true}))};
 assert.equal(draftLabel083(summary),'저장 전 변경 · 카드 1장');
 assert.equal(saveLabel039({bootstrap:{},phase:'ready',pending:0,canEdit:true,manualDrafts060:summary}),'저장 전 변경 · 카드 1장');
 assert.match(saveLabel039({bootstrap:{},phase:'saving',pending:1,manualDrafts060:summary}),/저장 중/);
});

test('read confirmation cannot invent a save timestamp and checking does not replace a prior confirmed save',()=>{
 assert.equal(syncDetail083({}),'');
 assert.doesNotMatch(syncDetail083({sync083:{checkedAt:Date.now()}}),/최근 저장/);
 assert.match(syncDetail083({sync083:{checking:true,checkedAt:Date.now(),savedAt:Date.now()}}),/^최신 내용 확인 중… · 최근 저장/);
 assert.equal(syncDetail083({sync083:{checkedAt:NaN,savedAt:Infinity}}),'');
});
