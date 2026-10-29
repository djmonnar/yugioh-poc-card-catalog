import test from 'node:test';
import assert from 'node:assert/strict';
import {cardLimitBadges044} from '../authoring044-limits.js';

const card=(patch={})=>({source_id:0,code:89631139,alias:0,deck_limit:3,speed_limit:null,...patch});
const labels=rows=>rows.map(row=>row.label);

test('general alias-family limits include an absent lower-limit sibling without changing either card',()=>{
  const original=card({source_id:100,code:99999}),alternate=card({source_id:101,code:55555,alias:99999,deck_limit:1}),cards=[original,alternate],before=JSON.stringify(cards);
  const badges=cardLimitBadges044(original,{cards});
  assert.deepEqual(labels(badges),['제한']);
  assert.match(badges[0].title,/같은 이름.*메인·엑스트라 덱 합계 1장/);
  assert.equal(cardLimitBadges044(alternate,{cards})[0].limit,1);
  assert.equal(JSON.stringify(cards),before);
});

test('a speed-only ban never becomes a general ban through legacy effective_copy_limit zero',()=>{
  const input=card({effective_copy_limit:0,speed_limit:0});
  const badges=cardLimitBadges044(input,{includeUnrestricted:true});
  assert.deepEqual(labels(badges),['일반 제한 없음','스피드 금지']);
  assert.equal(badges.find(row=>row.rule==='normal').limit,3);
  assert.equal(badges.find(row=>row.rule==='speed').limit,0);
});

test('an actual alias-family ban remains visible alongside a speed ban',()=>{
  const one=card({source_id:1,code:500,speed_limit:0,effective_copy_limit:0}),two=card({source_id:2,code:600,alias:500,deck_limit:0});
  assert.deepEqual(labels(cardLimitBadges044(one,{cards:[one,two]})),['금지','스피드 금지']);
  assert.deepEqual(labels(cardLimitBadges044(card({speed_limit:0,effective_normal_limit:1,effective_copy_limit:0}))),['제한','스피드 금지']);
});

test('speed groups 1, 2 and 3 describe a shared budget, not a per-name allowance',()=>{
  for(const maximum of [1,2,3]){
    const badges=cardLimitBadges044(card({speed_limit:maximum}));
    assert.deepEqual(labels(badges),[`스피드 제한 ${maximum}`]);
    assert.match(badges[0].title,/속한 모든 카드의 매수/);
    assert.match(badges[0].title,new RegExp(`합산해 ${maximum}장`));
  }
});

test('general and speed limits both appear because either rule can be tighter',()=>{
  const badges=cardLimitBadges044(card({deck_limit:2,speed_limit:1}));
  assert.deepEqual(labels(badges),['준제한','스피드 제한 1']);
  assert.deepEqual(badges.map(row=>[row.rule,row.limit]),[['normal',2],['speed',1]]);
});

test('null and explicit unrestricted speed settings omit only the speed-group badge',()=>{
  for(const speed of [null,-1]){
    assert.deepEqual(labels(cardLimitBadges044(card({deck_limit:1,speed_limit:speed}))),['제한']);
    const detail=cardLimitBadges044(card({speed_limit:speed}),{includeUnrestricted:true});
    assert.deepEqual(labels(detail),['일반 제한 없음','스피드 제한 없음']);
    assert.match(detail[1].title,/일반 카드 제한은 별도로/);
  }
});

test('a nullable raw override inherits its frozen rule instead of looking unrestricted',()=>{
  const input={source_id:0,normal_limit:null,frozen_normal_limit:1,speed_limit:null};
  assert.deepEqual(labels(cardLimitBadges044(input)),['제한']);
  assert.deepEqual(labels(cardLimitBadges044({...input,deck_limit:2})),['준제한']);
});

test('missing or invalid rule data is explicit and never labelled unrestricted',()=>{
  for(const input of [null,{},card({deck_limit:8,speed_limit:9}),card({deck_limit:null,speed_limit:undefined})]){
    const badges=cardLimitBadges044(input,{includeUnrestricted:true});
    assert.ok(badges.length>0);
    assert.ok(badges.every(row=>row.kind==='unknown'));
    assert.ok(badges.every(row=>row.label.includes('확인 필요')));
  }
});

test('resolved normal family values take precedence over a stale per-card rule',()=>{
  assert.deepEqual(labels(cardLimitBadges044(card({deck_limit:3,effective_normal_limit:0}))),['금지']);
  assert.deepEqual(labels(cardLimitBadges044(card({deck_limit:3,effective_normal_limit:2,speed_limit:3}))),['준제한','스피드 제한 3']);
});

test('legacy resolved family rules and source zero remain usable without the full catalog',()=>{
  assert.deepEqual(labels(cardLimitBadges044(card({deck_limit:3,effective_copy_limit:1}))),['제한']);
  assert.deepEqual(labels(cardLimitBadges044(card({deck_limit:3,effective_copy_limit:0}))),['금지']);
  const zero={source_id:0,deck_limit:3,speed_limit:null},other={source_id:1,code:0,deck_limit:1,speed_limit:null};
  assert.deepEqual(cardLimitBadges044(zero,{cards:[zero,other]}),[]);
});
