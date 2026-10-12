import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {copyAIAsset} from '../ai-assets.js';
import {emptyDeck,cardLine,copiedDeckName,groupCardCount,copyCount,adjustCard,exportBundle,parseBundle} from '../ai-deck-core.js';
import {builderCardMatches} from '../ai-deck-filters.js';

const catalog=JSON.parse(fs.readFileSync(new URL('../data/cards.json',import.meta.url)));
const normal=catalog.cards.find(card=>!card.special&&card.type==='일반 몬스터');
const fusion=catalog.cards.find(card=>!card.special&&card.type==='융합 몬스터');
const installed=JSON.parse(fs.readFileSync(new URL('../data/ai-opponents.json',import.meta.url))).decks;
function original(ruleset='classic') {
  const deck=emptyDeck('original',ruleset);deck.name='유희 테스트';deck.difficulty=6;
  deck.strategy={goal:'필드 유지',priorities:'먼저 소환',combos:'패를 보존',avoid:'불필요한 릴리스'};
  deck.groups={main:[cardLine(normal,2)],side:[cardLine(normal,1)],extra:[cardLine(fusion,1)]};
  deck.source_recipe={filename:ruleset==='classic'?'cpu_001.ydc':'DLR_001.ydc',sha256:'a'.repeat(64),difficulty_levels:[6]};
  return deck;
}

test('copy/edit preserves both modes, all groups and strategy while removing the original save destination',()=>{
  for(const ruleset of ['classic','duel_links_plan']){
    const source=original(ruleset),before=structuredClone(source),copy=copyAIAsset(source,'independent-copy');
    copy.name=copiedDeckName(source.name,[source.name]);
    assert.equal(copy.deck_id,'independent-copy');assert.equal(copy.source_recipe,undefined);
    assert.equal(copy.ruleset,source.ruleset);assert.equal(copy.difficulty,6);assert.equal(copy.banlist_enabled,source.banlist_enabled);
    assert.deepEqual(copy.groups,source.groups);assert.deepEqual(copy.strategy,source.strategy);
    adjustCard(copy,normal,'main',-1,catalog.cards);copy.strategy.goal='새 전략';copy.groups.extra[0].count=2;
    assert.deepEqual(source,before);assert.notDeepEqual(copy.groups,source.groups);
  }
});

test('repeated copy names stay distinct and retain the visible suffix within 80 characters',()=>{
  assert.equal(copiedDeckName('유희',['유희']),'유희 복사본');
  assert.equal(copiedDeckName('유희',['유희 복사본','유희 복사본 (2)']),'유희 복사본 (3)');
  const long='가'.repeat(80),first=copiedDeckName(long),second=copiedDeckName(long,[first]);
  assert.equal(first.length,80);assert.equal(second.length,80);assert.match(first,/ 복사본$/);assert.match(second,/ 복사본 \(2\)$/);
  assert.equal(copiedDeckName('  '),'AI 덱 복사본');
});

test('pool removal changes only the selected group and frees the total three-card cap on the copy',()=>{
  const source=original(),before=structuredClone(source),copy=copyAIAsset(source,'pool-copy');
  assert.equal(groupCardCount(copy,normal.identity_key,'main'),2);
  assert.equal(groupCardCount(copy,normal.identity_key,'side'),1);
  assert.equal(copyCount(copy,normal.identity_key),3);
  assert.throws(()=>adjustCard(copy,normal,'side',1,catalog.cards),/3장/);
  adjustCard(copy,normal,'main',-1,catalog.cards);adjustCard(copy,normal,'side',1,catalog.cards);
  assert.equal(groupCardCount(copy,normal.identity_key,'main'),1);
  assert.equal(groupCardCount(copy,normal.identity_key,'side'),2);
  assert.equal(copyCount(copy,normal.identity_key),3);assert.deepEqual(source,before);
});

test('zero selected-group count never removes a copy from another group',()=>{
  const copy=copyAIAsset(original(),'side-only');copy.groups.main=[];
  const before=structuredClone(copy.groups);
  assert.equal(groupCardCount(copy,normal.identity_key,'main'),0);
  adjustCard(copy,normal,'main',-1,catalog.cards);
  assert.deepEqual(copy.groups,before);
  assert.throws(()=>groupCardCount(copy,normal.identity_key,'missing'),/덱 위치/);
});

test('last-card removal and extra-deck edits remain independent from the source',()=>{
  const source=original(),copy=copyAIAsset(source,'remove-last');
  adjustCard(copy,fusion,'extra',-1,catalog.cards);assert.equal(copy.groups.extra.length,0);
  assert.equal(groupCardCount(source,fusion.identity_key,'extra'),1);
  assert.throws(()=>adjustCard(copy,fusion,'main',1,catalog.cards),/융합 덱/);
  adjustCard(copy,fusion,'extra',1,catalog.cards);assert.equal(groupCardCount(copy,fusion.identity_key,'extra'),1);
});

test('copied built-in decks survive browser/export reload without reacquiring the source recipe',()=>{
  for(const ruleset of ['classic','duel_links_plan']){
    const source=installed.find(deck=>deck.ruleset===ruleset),before=structuredClone(source),copy=copyAIAsset(source,'reload-'+ruleset);
    copy.name=copiedDeckName(source.name,[source.name]);
    const restored=parseBundle(JSON.parse(JSON.stringify(exportBundle(catalog.meta,[source,copy],catalog.cards))),catalog.cards);
    assert.equal(restored[1].deck_id,copy.deck_id);assert.equal(restored[1].source_recipe,undefined);
    assert.deepEqual(restored[1].groups,restored[0].groups);assert.deepEqual(restored[1].strategy,restored[0].strategy);
    assert.deepEqual(source,before);
  }
});

test('search/tag filter state remains unchanged when editing a copied deck',()=>{
  const copy=copyAIAsset(original(),'filter-copy'),filters={query:normal.name_ko,tags:['복사 테스트']};
  const tagsState={annotations:[{identity_key:normal.identity_key,slot:normal.slot,internal_id:normal.internal_id,tags:['복사 테스트'],links:[]}]};
  const before=structuredClone(filters),matches=builderCardMatches(normal,filters,{tagsState});
  adjustCard(copy,normal,'main',-1,catalog.cards);
  assert.equal(matches,true);assert.equal(builderCardMatches(normal,filters,{tagsState}),matches);assert.deepEqual(filters,before);
});
