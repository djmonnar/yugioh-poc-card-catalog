import test from 'node:test';
import assert from 'node:assert/strict';
import {pickerCards} from '../card-picker.js';
const monster=(slot,rarity,race='공룡족')=>({slot,internal_id:100+slot,name_ko:`공룡 ${slot}`,name_en:`Dino ${slot}`,description_ko:'소환했을 때 발동한다.',type:'효과 몬스터',subtype:'효과',race,attribute:'땅',level:4,atk:1800,def:1000,rarity,reward_eligible:true});

test('combined picker filters use current rarity while preserving source and reward eligibility',()=>{
  const cards=[monster(1,'SR'),monster(2,'SR','드래곤족'),monster(3,'UR'),{...monster(4,'SR'),special:true}];
  const copy=structuredClone(cards),accept=c=>!c.special;
  assert.deepEqual(pickerCards(cards,{rarity:'SR',type:'효과 몬스터',race:'공룡족',attribute:'땅'},accept).map(c=>c.slot),[1]);
  cards[0].rarity='UR';assert.equal(pickerCards(cards,{rarity:'SR',race:'공룡족'},accept).length,0);
  assert.deepEqual(cards.slice(1),copy.slice(1));
});
test('search normalizes Korean spacing and also finds English names and exact card numbers',()=>{
  const cards=[{...monster(1,'R'),name_ko:'푸른 눈의 백룡',name_en:'Blue-Eyes White Dragon'}];
  for(const query of ['푸른눈의백룡','blue-eyes white dragon','101'])assert.equal(pickerCards(cards,{query}).length,1);
  assert.equal(pickerCards(cards,{query:'없는 카드'}).length,0);
});
test('numeric and group filters reject spells with missing stats and include zero attack',()=>{
  const cards=[{...monster(1,'N'),atk:0,mechanics:[{id:'flip'}],card_groups:[{id:'dino'}]},
    {...monster(2,'N'),level:5},{slot:3,type:'마법',name_ko:'마법',rarity:'N',atk:null,level:null}];
  assert.deepEqual(pickerCards(cards,{mechanic:'flip',group:'dino',stats:[{field:'atk',max:100},{field:'level',levels:[4]}]}).map(c=>c.slot),[1]);
  assert.equal(pickerCards(cards,{stats:[{field:'atk',min:2000,max:1000}]}).length,0);
});
test('rarity and numeric sorting are deterministic without changing candidate order',()=>{
  const cards=[monster(1,'N'),monster(2,'SR'),monster(3,'L'),{...monster(4,'UR'),atk:2500,level:7}];
  assert.deepEqual(pickerCards(cards).map(c=>c.rarity),['L','UR','SR','N']);
  assert.equal(pickerCards(cards,{sort:'attack'})[0].slot,4);
  assert.equal(pickerCards(cards,{sort:'level'})[0].slot,4);
  assert.deepEqual(cards.map(c=>c.slot),[1,2,3,4]);
});

test('saved custom tags work in text search and combine with filters without following replaced card identities',()=>{
  const cards=[{...monster(1,'SR'),identity_key:'a'.repeat(64)},{...monster(2,'R'),identity_key:'b'.repeat(64)}];
  const annotations={categories:[{name:'내 툰 덱'},{name:'서포트'}],annotations:[
    {...cards[0],tags:['내 툰 덱','서포트'],links:[],version:1},
    {...cards[1],tags:['내 툰 덱'],links:[],version:1}
  ]};
  for(const query of ['내툰덱','#내 툰 덱'])assert.deepEqual(pickerCards(cards,{query},()=>true,annotations).map(c=>c.slot),[1,2]);
  assert.deepEqual(pickerCards(cards,{tags:['내 툰 덱','서포트'],rarity:'SR',race:'공룡족'},()=>true,annotations).map(c=>c.slot),[1]);
  cards[0].identity_key='c'.repeat(64);
  assert.deepEqual(pickerCards(cards,{query:'#서포트'},()=>true,annotations),[]);
  assert.deepEqual(pickerCards(cards,{tags:['내 툰 덱']},()=>true,annotations).map(c=>c.slot),[2]);
  assert.equal(pickerCards(cards,{tags:[]},()=>true,null).length,2);
});
