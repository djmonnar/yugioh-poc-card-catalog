import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyDeck,cardLine,adjustCard,validateDeck,parseBundle,exportBundle,deckMarkdown,copyCount,groupTypeCounts,groupCount} from '../ai-deck-core.js';

const catalog=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url),'utf8'));
const normal={identity_key:'a'.repeat(64),slot:1,internal_id:200,name_ko:'시험 몬스터',name_en:'Test monster',type:'일반 몬스터',special:false,deck_limit:3,deck_limit_without_banlist:3};
const limited={...normal,identity_key:'b'.repeat(64),slot:2,internal_id:201,name_ko:'제한 카드',deck_limit:1,deck_limit_without_banlist:1};
const fusion={...normal,identity_key:'c'.repeat(64),slot:3,internal_id:202,type:'융합 몬스터'};
const token={...normal,identity_key:'d'.repeat(64),slot:4,internal_id:203,special:true};
const pool=[normal,limited,fusion,token];
const payload=decks=>({schema_version:1,kind:'poc-ai-deck-bundle',decks});
test('main composition counts copies, separates ritual and unresolved cards, excludes supplemental groups',()=>{
  const types=['일반 몬스터','효과 몬스터','마법','함정','의식 몬스터'];
  const cards=types.map((type,i)=>({...normal,slot:i+10,internal_id:i+500,identity_key:String(i+1).repeat(64),type}));
  const d=emptyDeck('composition');d.groups.main=cards.map((c,i)=>cardLine(c,[3,2,3,1,2][i]));
  d.groups.main.push(cardLine(limited));d.groups.side=[cardLine(cards[0],3)];d.groups.extra=[cardLine(fusion,3)];
  assert.deepEqual(groupTypeCounts(d,cards),{normal:3,effect:2,spell:3,trap:1,ritual:2,other:0,unknown:1});
  adjustCard(d,cards[1],'main',-1);assert.equal(groupTypeCounts(d,cards).effect,1);
  assert.equal(groupTypeCounts(d,cards,'side').normal,3);
});
test('composition totals match every installed normal and speed opponent main deck',()=>{
  const data=JSON.parse(readFileSync(new URL('../data/ai-opponents.json',import.meta.url),'utf8'));
  for(const deck of parseBundle(data,catalog.cards)){
    const counts=groupTypeCounts(deck,catalog.cards);
    assert.equal(Object.values(counts).reduce((sum,n)=>sum+n,0),groupCount(deck,'main'),deck.name);
    assert.equal(counts.unknown,0,deck.name);assert.equal(counts.other,0,deck.name);
  }
});
test('all 42 installed opponents preserve mode, native origin and difficulty routing',()=>{
  const data=JSON.parse(readFileSync(new URL('../data/ai-opponents.json',import.meta.url),'utf8'));
  const decks=parseBundle(data,catalog.cards);assert.equal(decks.length,42);
  assert.equal(decks.filter(d=>d.ruleset==='classic').length,21);
  assert.equal(decks.filter(d=>d.ruleset==='duel_links_plan').length,21);
  assert.deepEqual(exportBundle(catalog.meta,decks,catalog.cards).decks.map(d=>d.source_recipe),decks.map(d=>d.source_recipe));
  for(const d of decks){assert.equal(validateDeck(d,catalog.cards).unknown,0);assert.ok(d.source_recipe.difficulty_levels.includes(d.difficulty));assert.match(d.name,/난이도/);}
  assert.equal(decks.find(d=>d.source_recipe.filename==='cpu_003.ydc').source_recipe.difficulty_levels.join(','),'1,2');
  assert.doesNotMatch(JSON.stringify(data),/C:\\|system\.dat|ledger\.json|USERPROFILE/i);
});
test('source metadata rejects wrong mode and cannot become a filesystem path',()=>{
  const d=emptyDeck('origin');d.source_recipe={filename:'cpu_000.ydc',sha256:'a'.repeat(64),difficulty_levels:[1]};
  const imported=parseBundle(payload([d]),pool)[0];imported.name='내가 정한 상대 이름';
  assert.equal(exportBundle({dataset_id:'test'},[imported],pool).decks[0].name,imported.name);
  d.source_recipe.filename='../cpu_000.ydc';assert.throws(()=>parseBundle(payload([d]),pool));
  d.source_recipe.filename='DLR_000.ydc';assert.throws(()=>parseBundle(payload([d]),pool));
});
test('main and side copies share the same limit; removing frees one copy',()=>{
  const d=emptyDeck('test');adjustCard(d,normal,'main',1);adjustCard(d,normal,'main',1);adjustCard(d,normal,'side',1);
  assert.equal(copyCount(d,normal.identity_key),3);assert.throws(()=>adjustCard(d,normal,'side',1));
  adjustCard(d,normal,'main',-1);adjustCard(d,normal,'side',1);assert.equal(copyCount(d,normal.identity_key),3);
});
test('forced restriction remains enforced when banlist is disabled',()=>{
  const d=emptyDeck('test');d.banlist_enabled=false;adjustCard(d,limited,'main',1);assert.throws(()=>adjustCard(d,limited,'side',1));
  const banned={...limited,deck_limit:0,deck_limit_without_banlist:0};assert.throws(()=>adjustCard(emptyDeck('test'),banned,'main',1));
});
test('fusion and tokens cannot enter wrong groups',()=>{
  const d=emptyDeck('test');assert.throws(()=>adjustCard(d,fusion,'main',1));assert.throws(()=>adjustCard(d,fusion,'side',1));assert.throws(()=>adjustCard(d,normal,'extra',1));assert.throws(()=>adjustCard(d,token,'main',1));
  adjustCard(d,fusion,'extra',1);assert.equal(d.groups.extra[0].internal_id,202);
});
test('export and import preserve strategy, counts, Unicode and multiple decks',()=>{
  const d=emptyDeck('deck_1');d.name='언데드 덱';d.strategy.combos='묘지 준비\n소생';adjustCard(d,normal,'main',1);
  const second=emptyDeck('deck_2');const restored=parseBundle(JSON.parse(JSON.stringify(exportBundle(catalog.meta,[d,second],pool))),pool);
  assert.deepEqual(restored,[d,second]);assert.match(deckMarkdown(catalog.meta,restored,pool),/묘지 준비\n소생/);
});
test('incomplete decks remain exportable and cannot be marked ready',()=>{
  const exported=exportBundle(catalog.meta,[emptyDeck('draft')],pool);assert.equal(exported.decks[0].validation.ready_for_game,false);assert.match(exported.decks[0].validation.issues[0],/40~80/);
});
test('a replaced card in the same slot and ID is preserved as unresolved',()=>{
  const d=emptyDeck('test');adjustCard(d,normal,'main',1);const replaced={...normal,identity_key:'e'.repeat(64),name_ko:'새 카드'};
  const restored=parseBundle(payload([d]),[replaced])[0];assert.equal(restored.groups.main[0].name_ko,normal.name_ko);assert.equal(validateDeck(restored,[replaced]).unknown,1);
  assert.equal(exportBundle(catalog.meta,[restored],[replaced]).decks[0].groups.main.length,1);
});
test('a published exact identity correction migrates but different ID or name does not',()=>{
  const d=emptyDeck('test');adjustCard(d,normal,'main',1);const updated={...normal,identity_key:'e'.repeat(64),previous_identity_keys:[normal.identity_key]};
  assert.equal(parseBundle(payload([d]),[updated])[0].groups.main[0].identity_key,updated.identity_key);
  assert.equal(validateDeck(parseBundle(payload([d]),[{...updated,internal_id:800}])[0],[{...updated,internal_id:800}]).unknown,1);
  assert.equal(validateDeck(parseBundle(payload([d]),[{...updated,name_ko:'다른 이름'}])[0],[{...updated,name_ko:'다른 이름'}]).unknown,1);
});
test('all groups are included when validating manually imported limits',()=>{
  const d=emptyDeck('test');d.groups.main=[cardLine(limited)];d.groups.side=[cardLine(limited)];assert.ok(validateDeck(d,pool).issues.some(s=>s.includes('제한 1장')));
});
test('invalid structures fail before any caller merges drafts',()=>{
  const d=emptyDeck('test');d.groups.main=[cardLine(normal),cardLine(normal)];assert.throws(()=>parseBundle(payload([d]),pool));
  assert.throws(()=>parseBundle(payload([emptyDeck('test'),emptyDeck('test')]),pool));
  for(const field of [0,4,1.5,-1,'2']){const bad=emptyDeck('test');bad.groups.main=[cardLine(normal,field)];assert.throws(()=>parseBundle(payload([bad]),pool));}
  for(const rules of ['__proto__','unknown'])assert.throws(()=>parseBundle(payload([{...emptyDeck('test'),ruleset:rules}]),pool));
  assert.throws(()=>parseBundle({...payload([]),schema_version:2},pool));assert.throws(()=>parseBundle(payload([{...emptyDeck('test'),difficulty:8}]),pool));
});
test('current-game and future-mode counts have different readiness',()=>{
  const regular=catalog.cards.filter(c=>!c.special&&c.type!=='융합 몬스터'&&c.deck_limit>=1).slice(0,40);
  const d=emptyDeck('test');d.groups.main=regular.map(c=>cardLine(c));assert.equal(validateDeck(d,catalog.cards).ready_for_game,true);
  d.ruleset='duel_links_plan';d.groups.main=d.groups.main.slice(0,20);const v=validateDeck(d,catalog.cards);assert.equal(v.issues.length,0);assert.equal(v.ready_for_game,false);
  d.groups.main=d.groups.main.slice(0,19);assert.ok(validateDeck(d,catalog.cards).issues.length);
});
test('card add respects mode maximum and supplemental capacity',()=>{
  const d=emptyDeck('test');d.ruleset='duel_links_plan';const many=Array.from({length:31},(_,i)=>({...normal,slot:i+20,internal_id:i+300,identity_key:i.toString(16).padStart(64,'0')}));
  for(const c of many.slice(0,30))adjustCard(d,c,'main',1);assert.throws(()=>adjustCard(d,many[30],'main',1));
  const fusions=many.map(c=>({...c,type:'융합 몬스터'}));for(const c of fusions.slice(0,15))adjustCard(d,c,'extra',1);assert.throws(()=>adjustCard(d,fusions[15],'extra',1));
});
test('built-in examples reference known current cards and contain no private paths',()=>{
  const raw=readFileSync(new URL('../data/ai-deck-examples.json',import.meta.url),'utf8'),examples=parseBundle(JSON.parse(raw),catalog.cards);assert.equal(examples.length,5);
  assert.deepEqual(examples.map(d=>validateDeck(d,catalog.cards).counts.main),[42,42,48,42,42]);
  for(const d of examples)assert.equal(validateDeck(d,catalog.cards).unknown,0);
  assert.doesNotMatch(raw,/C:\\|system\.dat|wallet|USERPROFILE/i);
});

test('new normal and speed decks keep their mode through export and legacy import',()=>{
  const normalDeck=emptyDeck('normal','classic'),speedDeck=emptyDeck('speed','duel_links_plan');
  const exported=exportBundle(catalog.meta,[normalDeck,speedDeck],pool);
  assert.deepEqual(exported.decks.map(d=>d.duel_mode),['normal','speed']);
  assert.deepEqual(parseBundle(exported,pool),[normalDeck,speedDeck]);
  assert.deepEqual(parseBundle(payload([speedDeck]),pool),[speedDeck]);
  assert.match(deckMarkdown(catalog.meta,[speedDeck],pool),/スピード|스피드 듀얼용 · 20~30장/);
  assert.throws(()=>parseBundle(payload([{...normalDeck,duel_mode:'speed'}]),pool));
  assert.throws(()=>emptyDeck('bad','unknown'));
});

test('switching a populated normal deck to speed reports excess without deleting cards',()=>{
  const regular=catalog.cards.filter(c=>!c.special&&c.type!=='융합 몬스터'&&c.deck_limit>=1).slice(0,40);
  const deck=emptyDeck('switch');deck.groups.main=regular.map(c=>cardLine(c));
  const before=structuredClone(deck.groups);deck.ruleset='duel_links_plan';
  assert.ok(validateDeck(deck,catalog.cards).issues.some(s=>s.includes('20~30')));
  assert.deepEqual(deck.groups,before);
});
