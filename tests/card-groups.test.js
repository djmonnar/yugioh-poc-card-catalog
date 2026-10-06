import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categoryMatches, groupCards, cardLink, groupHash, parseCatalogHash} from '../card-groups.js';
import {makeReview, exportPayload, parseImport} from '../review-core.js';
const data=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url),'utf8'));
const card=slot=>data.cards.find(c=>c.slot===slot);

test('mechanics distinguish Gemini Lancer from Gemini Elf',()=>{
  assert.equal(categoryMatches(card(512),'gemini'),true);
  assert.equal(categoryMatches(card(550),'gemini'),false);
  assert.equal(categoryMatches(card(448),'union'),true);
});
test('members and support are separately browsable, all match group filter',()=>{
  const members=groupCards(data.cards,'armed_dragon_lv','member');
  const support=groupCards(data.cards,'armed_dragon_lv','support');
  assert.equal(members.length,4);assert.equal(support.length,2);
  assert.ok(!members.some(c=>c.slot===959));assert.ok(support.some(c=>c.slot===959));
  assert.equal(categoryMatches(card(959),'','armed_dragon_lv'),true);
});
test('similar or fan names do not become rule membership',()=>{
  assert.equal(categoryMatches(card(711),'','gravekeeper'),false);
  assert.equal(categoryMatches(card(817),'','blue_eyes'),false);
  assert.equal(categoryMatches(card(964),'','horus_lv'),false);
});
test('every direct link has matching live identity and reverse edge',()=>{
  for(const c of data.cards)for(const r of c.related_cards||[]){
    assert.equal(card(r.slot).identity_key,r.identity_key);
    assert.ok(card(r.slot).related_cards.some(other=>other.slot===c.slot));
  }
});
test('shared URLs validate slots and group IDs',()=>{
  assert.equal(cardLink(625),'#card-625');assert.equal(groupHash('lightsworn'),'#group-lightsworn');
  assert.deepEqual(parseCatalogHash('#group-lightsworn'),{group:'lightsworn'});
  assert.deepEqual(parseCatalogHash('#card-625'),{card:625});
  assert.equal(parseCatalogHash('#card-90000'),null);
  assert.throws(()=>groupHash('<script>'));assert.throws(()=>cardLink(-1));
});
test('new relation metadata preserves existing review round-trip',()=>{
  const c=card(625),review=makeReview(c,{note:'같은 카드군 효과 확인',proposed_limit:1});
  assert.deepEqual(parseImport(exportPayload(data.meta,[review]),data.cards).valid[0].changes,review.changes);
});
