import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotFiles, summarize, describe } from '../scripts/web-db-history.mjs';

function bootstrap(revision, cards, relicLp) {
  return {
    kind: 'unified039-bootstrap', view: 'game', project_id: 'p', project_revision: revision,
    game: {
      game_revision: revision, authoring_revision: revision, metadata_revision: 1, source_fingerprint: 'f', identity: { a: 1 },
      payload_json: JSON.stringify({
        catalog: cards,
        content022: { schema: 1, relics: Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, name: `유물${i}`, params: { lp: i === 0 ? relicLp : 1 } })) },
        shop_rules: { schema: 1, reroll_base: 50 },
      }),
    },
    map_rules052: { revision: 3, config_json: '{"elite_percent":30}' },
    practice_decks063: { sha256: 's', payload_json: JSON.stringify({ decks: [{ id: 'd1', name: '덱', main: [1] }] }) },
    content_profile152: { schema: 1 },
  };
}

test('공개 응답을 항목별 파일로 나누고 키를 정렬한다', () => {
  const files = snapshotFiles(bootstrap(10, [{ source_id: 2, name: '나', code: 5 }, { source_id: 1, name: '가', code: 4 }], 200));
  assert.ok(files.has('game/catalog/1.json'));
  assert.ok(files.has('game/catalog/2.json'));
  assert.ok(files.has('game/content022/relics/r0.json'));
  assert.ok(files.has('game/content022/_rest.json'));
  assert.ok(files.has('game/shop_rules.json'));
  assert.ok(files.has('practice-decks/d1.json'));
  assert.ok(files.has('map-rules.json'));
  assert.equal(files.get('game/catalog/1.json'), '{\n  "code": 4,\n  "name": "가",\n  "source_id": 1\n}\n');
  assert.equal(JSON.parse(files.get('revision.json')).project_revision, 10);
});

test('바뀐 항목만 요약하고 개정 번호를 적는다', () => {
  const before = snapshotFiles(bootstrap(10, [{ source_id: 1, name: '가' }, { source_id: 2, name: '나' }], 200));
  const after = snapshotFiles(bootstrap(11, [{ source_id: 1, name: '가!' }, { source_id: 3, name: '다' }], 500));
  const summary = summarize(before, after);
  const cards = summary.find(group => group.section === 'game/catalog');
  assert.deepEqual(cards.changed, ['1 가!']);
  assert.deepEqual(cards.added, ['3 다']);
  assert.deepEqual(cards.removed, ['2 나']);
  assert.deepEqual(summary.find(group => group.section === 'game/content022/relics').changed, ['r0 유물0']);
  const text = describe(summary, 11, 10);
  assert.match(text, /^웹 DB 개정 11 \(이전 기록 10\)/);
  assert.match(text, /카드 \(game\/catalog\) · 변경 1: 1 가! \/ 추가 1: 3 다 \/ 삭제 1: 2 나/);
});

test('같은 자료면 바뀐 것이 없다', () => {
  const files = snapshotFiles(bootstrap(10, [{ source_id: 1, name: '가' }], 200));
  assert.deepEqual(summarize(files, snapshotFiles(bootstrap(10, [{ source_id: 1, name: '가' }], 200))), []);
});

test('게임 공개 조회가 아닌 응답은 거절한다', () => {
  assert.throws(() => snapshotFiles({ kind: 'unified039-bootstrap', view: 'authoring' }));
});
