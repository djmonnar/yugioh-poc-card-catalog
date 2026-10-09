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
  assert.equal(latest.id, '20261010-mai-white-ritual');
  assert.equal(latest.cards.length, 24);
  assert.deepEqual(latest.cards.map(c => [c.slot, c.internal_id]),
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
