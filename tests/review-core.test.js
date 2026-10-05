import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {changesFor, makeReview, parseImport, exportPayload, reviewCounts, reviewMarkdown} from '../review-core.js';

const catalog = JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8'));
const card = catalog.cards.find(c => c.slot === 679);
const empty = fields => makeReview(card, fields);

test('unchanged selections do not create a phantom review', () => {
  assert.equal(empty({proposed_rarity: card.rarity, proposed_limit: String(card.deck_limit)}), null);
  assert.equal(empty({note: '  '}), null);
});
test('rarity, replacement, semi-limit, multiline Korean note round-trip', () => {
  const row = empty({proposed_rarity: 'UR', proposed_limit: '2', replacement_candidate: true, replacement_name: '공식 효과 복원', note: '덱에서 소재를 보내기\n이름 변경 지원'});
  const payload = exportPayload(catalog.meta, [row]);
  const imported = parseImport(JSON.parse(JSON.stringify(payload)), catalog.cards);
  assert.equal(imported.valid.length, 1);
  assert.deepEqual(imported.valid[0].changes, row.changes);
  assert.equal(imported.unmatched.length, 0);
  assert.deepEqual(reviewCounts(imported.valid), {total:1,rarity:1,replace:1,limit:1});
  assert.match(reviewMarkdown(payload), /레어도: R → UR/);
  assert.match(reviewMarkdown(payload), /제한: 3장 → 2장/);
  assert.match(reviewMarkdown(payload), /이름 변경 지원/);
});
test('forbidden zero survives export and import', () => {
  const row = empty({proposed_limit: 0});
  assert.equal(parseImport(exportPayload(catalog.meta,[row]),catalog.cards).valid[0].changes.proposed_limit,0);
});
test('old card identity cannot modify a replacement in the same slot and ID', () => {
  const row = empty({note:'이전 카드 교체 요청'});
  row.identity_key = 'a'.repeat(64);
  const imported = parseImport(exportPayload(catalog.meta,[row]),catalog.cards);
  assert.equal(imported.valid.length,0);
  assert.deepEqual(imported.unmatched,[row]);
  // The preserved opinion also survives a subsequent export and re-import.
  assert.equal(parseImport(exportPayload(catalog.meta,[],imported.unmatched),catalog.cards).unmatched.length,1);
});
test('a mismatched native slot or ID is not accepted despite a matching key', () => {
  const row = empty({note:'x'}); row.internal_id += 1;
  assert.equal(parseImport(exportPayload(catalog.meta,[row]),catalog.cards).valid.length,0);
});
test('invalid choices, duplicate imports and unsupported schemas fail before merge', () => {
  assert.throws(()=>changesFor(card,{proposed_rarity:'SSR'}));
  assert.throws(()=>changesFor(card,{proposed_limit:4}));
  assert.throws(()=>changesFor(card,{replacement_candidate:'false'}));
  const row=empty({note:'x'});
  assert.throws(()=>parseImport(exportPayload(catalog.meta,[row,row]),catalog.cards));
  assert.throws(()=>parseImport({schema_version:2,reviews:[]},catalog.cards));
});
test('tokens have no deck limit proposals', () => {
  const token=catalog.cards.find(c=>c.type==='토큰');
  assert.throws(()=>changesFor(token,{proposed_limit:1}));
});
test('public catalog is complete, each preview exists and personal paths are absent', () => {
  assert.equal(catalog.cards.length,1115);
  assert.equal(catalog.cards.filter(c=>!c.special).length,1110);
  assert.equal(catalog.cards.filter(c=>c.special).length,5);
  assert.equal(new Set(catalog.cards.map(c=>c.identity_key)).size,1115);
  assert.equal(catalog.cards.filter(c=>c.stock).length,catalog.meta.stock_count);
  assert.ok(catalog.meta.stock_count>=60);
  assert.equal(catalog.cards.filter(c=>c.deck_limit===2).length,3);
  assert.equal(catalog.cards.find(c=>c.slot===1115).name_en,'Megalosmasher X');
  for(const c of catalog.cards){assert.ok(existsSync(new URL('../'+c.image,import.meta.url)));assert.ok(['UR','SR','R','N'].includes(c.rarity));}
  const publicText=JSON.stringify(catalog);
  assert.doesNotMatch(publicText,/C:[\\/]|image_path|mini_path|SAVE\.ydc|gold_ledger|[A-Za-z]:\\Users\\/);
  assert.match(catalog.cards.find(c=>c.slot===61).review_note,/プロト|프로토/);
});
