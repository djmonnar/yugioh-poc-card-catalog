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

test('catalog tier/limit updates retain already-applied review requests until manual reset',()=>{
  const row=empty({proposed_rarity:'UR',proposed_limit:2});
  const updated={...card,rarity:'UR',deck_limit:2};
  const imported=parseImport(exportPayload(catalog.meta,[row]),[updated]);
  assert.equal(imported.valid.length,1);
  assert.deepEqual(imported.valid[0].changes,row.changes);
  assert.equal(imported.valid[0].original.rarity,card.rarity);
  assert.equal(imported.valid[0].original.deck_limit,card.deck_limit);
});

test('editing notes after a catalog update preserves the previous proposal baseline',()=>{
  const row=empty({proposed_rarity:'UR',proposed_limit:2,note:'기존 의견'});
  const updated={...card,rarity:'UR',deck_limit:2};
  const edited=makeReview(updated,{...row.changes,note:'새 메모'},row);
  assert.equal(edited.changes.proposed_rarity,'UR');assert.equal(edited.changes.proposed_limit,2);
  assert.equal(edited.changes.note,'새 메모');
  assert.equal(makeReview(updated,{proposed_rarity:'',proposed_limit:''},row),null);
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
test('published alias preserves opinions for a corrected card and retains the old baseline',()=>{
  const row=empty({note:'효과 복원',proposed_rarity:'UR'});
  const corrected={...card,identity_key:'b'.repeat(64),level:5,previous_identity_keys:[card.identity_key]};
  const migrated=parseImport(exportPayload(catalog.meta,[row]),[corrected]);
  assert.equal(migrated.valid.length,1);assert.equal(migrated.unmatched.length,0);
  assert.equal(migrated.valid[0].identity_key,corrected.identity_key);
  assert.deepEqual(migrated.valid[0].changes,row.changes);
  assert.deepEqual(migrated.valid[0].original,row.original);
  assert.deepEqual(parseImport(exportPayload(catalog.meta,migrated.valid),[corrected]).valid[0].changes,row.changes);
  const wrongName={...row,name_ko:'다른 카드'};
  assert.equal(parseImport(exportPayload(catalog.meta,[wrongName]),[corrected]).unmatched.length,1);
  assert.equal(parseImport(exportPayload(catalog.meta,[{...row,internal_id:row.internal_id+1}]),[corrected]).unmatched.length,1);
});
test('old and corrected identities cannot import duplicate opinions for the same card',()=>{
  const row=empty({note:'기존 의견'});
  const corrected={...card,identity_key:'b'.repeat(64),previous_identity_keys:[card.identity_key]};
  const newer=makeReview(corrected,{note:'다른 의견'});
  assert.throws(()=>parseImport(exportPayload(catalog.meta,[row,newer]),[corrected]));
  assert.throws(()=>parseImport(exportPayload(catalog.meta,[row]),[{...corrected,previous_identity_keys:[corrected.identity_key]}]));
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
  assert.equal(catalog.cards.length,1286);
  assert.equal(catalog.cards.filter(c=>!c.special).length,1281);
  assert.equal(catalog.cards.filter(c=>c.special).length,5);
  assert.equal(new Set(catalog.cards.map(c=>c.identity_key)).size,1286);
  assert.equal(catalog.cards.filter(c=>c.stock).length,catalog.meta.stock_count);
  assert.ok(catalog.meta.stock_count>=60);
  for(const [slot,limit] of [[278,2],[369,1],[554,0],[601,1],[741,1]]){
    const c=catalog.cards.find(c=>c.slot===slot);assert.equal(c.deck_limit,limit);assert.equal(c.deck_limit_without_banlist,limit);
  }
  assert.equal(catalog.cards.find(c=>c.slot===1115).name_en,'Megalosmasher X');
  for(let slot=1116;slot<=1286;slot++){
    const c=catalog.cards.find(c=>c.slot===slot);assert.ok(c&&!c.special&&c.official_cid);
    assert.equal(c.review_kind,'restored');
  }
  for(const [slot,id,name] of [[1137,1974,'Plaguespreader Zombie'],[1138,1975,'Gozuki'],[1139,1976,'Vampire Lord'],[1140,1977,'Book of Life'],[1141,1978,'Goblin Zombie'],[1142,1979,'Call of the Mummy'],[1143,1980,'Pumprincess the Princess of Ghosts']]){
    const c=catalog.cards.find(c=>c.slot===slot);assert.equal(c.internal_id,id);assert.equal(c.name_en,name);
    assert.match(c.review_note,/Claude320b/);
  }
  for(let slot=1144;slot<=1153;slot++){
    const c=catalog.cards.find(c=>c.slot===slot);
    assert.equal(c.internal_id,1961+slot-1144);
    assert.match(c.review_note,/Claude320b/);
  }
  assert.equal(catalog.cards.find(c=>c.slot===1151).type,'의식 몬스터');
  for(let slot=1154;slot<=1176;slot++){
    const c=catalog.cards.find(c=>c.slot===slot);
    assert.equal(c.internal_id,1938+slot-1154);
    assert.match(c.review_note,/Claude320b/);
  }
  for(const [i,id] of [1927,1929,1930,1931,1932,1933,1934,1935,1936,1937,1908,1909,1913,1914,1915,1916,1917,1918,1919,1924,1925,1926].entries()){
    const c=catalog.cards.find(c=>c.slot===1177+i);
    assert.equal(c.internal_id,id);assert.match(c.review_note,/Claude320b/);
  }
  for(const [i,id] of [...Array.from({length:28},(_,i)=>1872+i),1904,1905,1906,1907,1871].entries()){
    const c=catalog.cards.find(c=>c.slot===1199+i);
    assert.equal(c.internal_id,id);assert.match(c.review_note,/Claude320b/);
  }
  assert.equal(catalog.cards.find(c=>c.slot===1229).type,'융합 몬스터');
  assert.equal(catalog.cards.find(c=>c.slot===1230).type,'융합 몬스터');
  assert.equal(catalog.cards.find(c=>c.slot===1231).type,'일반 몬스터');
  for(const [i,id] of [...Array.from({length:14},(_,i)=>1857+i),1856].entries()){
    const c=catalog.cards.find(c=>c.slot===1232+i);
    assert.equal(c.internal_id,id);assert.match(c.review_note,/Claude320b/);
  }
  assert.match(catalog.cards.find(c=>c.slot===1220).review_note,/지속 효과/);
  assert.match(catalog.cards.find(c=>c.slot===1191).review_note,/어드밴스 소환 준비/);
  assert.match(catalog.cards.find(c=>c.slot===1168).review_note,/2장/);
  assert.match(catalog.cards.find(c=>c.slot===1190).review_note,/자동/);
  assert.match(catalog.cards.find(c=>c.slot===1192).review_note,/소재 대용/);
  assert.match(catalog.cards.find(c=>c.slot===1198).review_note,/메인 페이즈 시작/);
  assert.equal(catalog.cards.find(c=>c.slot===1153).type,'융합 몬스터');
  for(const c of catalog.cards){assert.ok(existsSync(new URL('../'+c.image,import.meta.url)));assert.ok(['UR','SR','R','N'].includes(c.rarity));}
  const publicText=JSON.stringify(catalog);
  assert.doesNotMatch(publicText,/C:[\\/]|image_path|mini_path|SAVE\.ydc|gold_ledger|[A-Za-z]:\\Users\\/);
  assert.match(catalog.cards.find(c=>c.slot===61).review_note,/プロト|프로토/);
});
