import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {additionIndex, additionMatches, compareAdded} from '../card-additions.js';
import {cardLink, parseCatalogHash} from '../card-groups.js';
const data = JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8'));
const history = JSON.parse(readFileSync(new URL('../data/card-additions.json', import.meta.url), 'utf8'));
const identity = 'a'.repeat(64), newerIdentity = 'b'.repeat(64);
const card = {slot:1116, internal_id:1991, identity_key:identity};
const release = (id, added_at, cards = [card]) => ({id, added_at, name:'신규 카드', cards});
const makeHistory = (...releases) => ({schema_version:1, releases});

test('published latest addition batch matches actual cards without changing gameplay data', () => {
  const before = JSON.stringify(data), index = additionIndex(data.cards, history);
  const latest = history.releases.find(r => r.id === index.latest.id);
  assert.equal(latest.id, '20261015-volcanic-mist-procedures');
  assert.deepEqual(latest.cards.map(c => [c.slot,c.internal_id]),
    Array.from({length:5},(_,i)=>[1422+i,2124+i]));
  const fireMist=history.releases.find(r=>r.id==='20261015-volcanic-fire-mist');
  assert.deepEqual(fireMist.cards.map(c=>[c.slot,c.internal_id]),
    Array.from({length:19},(_,i)=>[1403+i,2105+i]));
  assert.equal(data.cards.filter(c=>additionMatches(c,fireMist.id,index)).length,19);
  assert.ok(Date.parse(latest.added_at)>Date.parse(fireMist.added_at));
  const gemini = history.releases.find(r => r.id === '20261015-gemini-support');
  assert.deepEqual(gemini.cards.map(c => [c.slot,c.internal_id]),
    Array.from({length:10},(_,i)=>[1393+i,2095+i]));
  assert.equal(data.cards.filter(c=>additionMatches(c,gemini.id,index)).length,10);
  assert.ok(Date.parse(latest.added_at)>Date.parse(gemini.added_at));
  const rocks = history.releases.find(r => r.id === '20261015-honest-rock-support');
  assert.deepEqual(rocks.cards.map(c => [c.slot,c.internal_id]),
    Array.from({length:10},(_,i)=>[1383+i,2085+i]));
  assert.ok(Date.parse(latest.added_at)>Date.parse(rocks.added_at));
  const beasts = history.releases.find(r => r.id === '20261013-beast-support');
  assert.deepEqual(beasts.cards.map(c => [c.slot,c.internal_id]),
    [2059,2060,2061,2062,2064,2065,2066,2067,2069,2070,2071,2072,2073,2074,2075,2076,2077,2078,2079,2080,2081,2082,2083,2084].map((id,i)=>[1359+i,id]));
  const plants = history.releases.find(r => r.id === '20261013-plant-support');
  assert.deepEqual(plants.cards.map(c => [c.slot,c.internal_id]),
    [[1340,2039], ...Array.from({length:18}, (_,i) => [1341+i,2041+i])]);
  const fairy = history.releases.find(r => r.id === '20261013-fairy-support');
  assert.deepEqual(fairy.cards.map(c => [c.slot,c.internal_id]),
    [[5,123],[158,405],[199,275],[312,484],
     [1333,2030],[1334,2031],[1335,2032],[1336,2033],[1337,2035],[1338,2036],[1339,2038]]);
  const keith = history.releases.find(r => r.id === '20261012-bandit-keith');
  assert.deepEqual(keith.cards.map(c => [c.slot,c.internal_id]),
    Array.from({length:6},(_,i)=>[1327+i,2024+i]));
  const lowLevel = history.releases.find(r => r.id === '20261011-low-level-support');
  assert.equal(lowLevel.cards.length, 25);
  assert.deepEqual(lowLevel.cards.map(c => c.slot),
    [76,174,269,305,631,1067,...Array.from({length:19},(_,i)=>1308+i)]);
  const previousSupport = history.releases.find(r => r.id === '20261011-review-support');
  assert.deepEqual(previousSupport.cards.map(c => c.slot),
    [...Array.from({length:20},(_,i)=>1287+i),193,367,386,439,456,817,868]);
  assert.ok(!latest.cards.some(c=>c.slot===1307),'Duel-only tokens are not collectible additions');
  const sphere=data.cards.find(c=>c.slot===335);
  assert.equal(sphere.name_en,'Mystical Shine Ball');
  assert.equal(sphere.official_cid,5949);
  assert.equal(sphere.previous_identity_keys,undefined);
  const spirit=history.releases.find(r=>r.id==='20261010-spirit-toon-gravekeeper');
  assert.deepEqual(spirit.cards.map(c=>[c.slot,c.internal_id]),Array.from({length:8},(_,i)=>[1279+i,1814+i]));
  assert.equal(data.cards.filter(c=>additionMatches(c,spirit.id,index)).length,8);
  const marik = history.releases.find(r=>r.id==='20261010-marik-ishizu');
  assert.equal(marik.cards.length,8);
  assert.equal(data.cards.filter(c=>additionMatches(c,marik.id,index)).length,8);
  assert.deepEqual(marik.cards.map(c=>[c.slot,c.internal_id]),
    Array.from({length:8},(_,i)=>[1271+i,1822+i]));
  const mai = history.releases.find(r=>r.id==='20261010-mai-white-ritual');
  assert.equal(mai.cards.length,24);
  assert.equal(data.cards.filter(c=>additionMatches(c,mai.id,index)).length,24);
  assert.deepEqual(mai.cards.map(c => [c.slot, c.internal_id]),
    [1832,1833,1834,1835,1836,1837,1838,1839,1841,1842,1843,1844,1845,1846,1847,1848,1849,1851,1852,1853,1854,1855,1830,1831].map((id,i) => [1247+i,id]));
  const insects = history.releases.find(r=>r.id==='20261009-insect-battle-support');
  assert.equal(insects.cards.length,15);
  assert.equal(data.cards.filter(c=>additionMatches(c,insects.id,index)).length,15);
  assert.deepEqual(insects.cards.map(c => [c.slot, c.internal_id]),
    [...Array.from({length:14},(_,i)=>1857+i),1856].map((id,i) => [1232+i,id]));
  const atlantis = history.releases.find(r=>r.id==='20261009-atlantis-chaos-fusion');
  assert.equal(atlantis.cards.length,33);
  assert.equal(data.cards.filter(c=>additionMatches(c,atlantis.id,index)).length,33);
  const previous = history.releases.find(r=>r.id==='20261009-white-dark-kit');
  assert.equal(previous.cards.length,22);
  assert.equal(data.cards.filter(c=>additionMatches(c,previous.id,index)).length,22);
  assert.equal(index.latest.count, latest.cards.length);
  assert.ok(index.latest.count > 0);
  assert.equal(data.cards.filter(c => additionMatches(c, 'latest', index)).length, latest.cards.length);
  assert.equal(additionMatches(data.cards.find(c => c.slot === 625), 'latest', index), false);
  assert.equal(JSON.stringify(data), before);
});
test('slot reuse does not inherit NEW, but audited same-card identity corrections retain history', () => {
  const h = makeHistory(release('first', '2026-10-08T09:00:00+09:00'));
  assert.equal(additionIndex([{...card, identity_key:newerIdentity}], h).byIdentity.size, 0);
  assert.equal(additionIndex([{...card, internal_id:2000, previous_identity_keys:[identity]}], h).byIdentity.size, 0);
  assert.equal(additionIndex([{...card, identity_key:newerIdentity, previous_identity_keys:[identity]}], h).latest.count, 1);
});
test('latest uses application time, older batches remain selectable and undated cards sort last', () => {
  const next = {...card, slot:1117, identity_key:newerIdentity};
  const h = makeHistory(release('first', '2026-10-08T09:00:00+09:00'), release('next', '2026-10-08T10:00:00+09:00', [next]));
  const ordinary = {slot:1, identity_key:'c'.repeat(64)};
  const index = additionIndex([card, next, ordinary], h);
  assert.equal(index.latest.id, 'next');
  assert.equal(additionMatches(card, 'latest', index), false);
  assert.equal(additionMatches(card, 'first', index), true);
  assert.equal(additionMatches(ordinary, '', index), true);
  assert.deepEqual([ordinary, card, next].sort((a,b) => compareAdded(a,b,index)), [next,card,ordinary]);
});
test('malformed or ambiguous release records fail instead of silently marking cards', () => {
  const r = release('first', '2026-10-08T09:00:00+09:00');
  for (const h of [makeHistory(r,r), makeHistory({...r, cards:[card,card]}), makeHistory({...r, added_at:'unknown'}), makeHistory({...r, id:'<script>'}), makeHistory(r,{...r,id:'duplicate-card'})])
    assert.throws(() => additionIndex([card],h));
});
test('all expanded card links can be reopened, and addition views have shareable routes', () => {
  for (const c of data.cards.filter(c => c.slot > 1115)) assert.deepEqual(parseCatalogHash(cardLink(c.slot)), {card:c.slot});
  assert.deepEqual(parseCatalogHash('#new-cards'), {newCards:true});
  assert.deepEqual(parseCatalogHash('#release-20261008-expansion'), {release:'20261008-expansion'});
  assert.equal(parseCatalogHash('#release-<script>'), null);
  assert.equal(parseCatalogHash('#card-2048'), null);
});
