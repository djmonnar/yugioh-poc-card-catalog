import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotFiles, summarize, describe, routeCandidates, fetchBootstrap, RPC_FLOOR } from '../scripts/web-db-history.mjs';

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

test('최신 공개 경로부터 찾는다 (고정된 옛 경로를 읽지 않는다)', async () => {
  const list = routeCandidates();
  assert.equal(list[list.length - 1], `poc_bootstrap${RPC_FLOOR}`);
  assert.ok(RPC_FLOOR >= 161, '161 적용 뒤 153 이하는 개정 876에 고정되어 있다');
  for (let i = 1; i < list.length; i++) assert.ok(Number(list[i - 1].slice(13)) > Number(list[i].slice(13)));
  const asked = [];
  const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const fake = async url => {
    const rpc = url.split('/').pop();
    asked.push(rpc);
    if (rpc === `poc_bootstrap${RPC_FLOOR + 3}`) return reply(200, { kind: 'unified039-bootstrap', view: 'game', project_revision: 900 });
    return reply(404, { code: 'PGRST202', message: `Could not find the function public.${rpc}` });
  };
  const found = await fetchBootstrap({ url: 'https://example.invalid', publishable_key: 'k' }, fake);
  assert.equal(found.route, `poc_bootstrap${RPC_FLOOR + 3}`);
  assert.equal(found.bootstrap.project_revision, 900);
  assert.equal(asked[0], list[0]);
  const floorOnly = await fetchBootstrap({ url: 'https://example.invalid', publishable_key: 'k' },
    async url => url.endsWith(`poc_bootstrap${RPC_FLOOR}`) ? reply(200, { project_revision: 1 }) : reply(404, { code: 'PGRST202' }));
  assert.equal(floorOnly.route, `poc_bootstrap${RPC_FLOOR}`);
  const noWait = { sleep: async () => {} };
  let calls = 0;
  await assert.rejects(() => fetchBootstrap({ url: 'https://example.invalid', publishable_key: 'k' }, async () => { calls++; return reply(500, {}); }, noWait), /HTTP 500/);
  assert.equal(calls, 3, '5xx는 최대 3번 묻는다');
  let cold = 0;
  const warmed = await fetchBootstrap({ url: 'https://example.invalid', publishable_key: 'k' },
    async url => url.endsWith(`poc_bootstrap${RPC_FLOOR}`) ? (++cold === 1 ? reply(500, {}) : reply(200, { project_revision: 7 })) : reply(404, { code: 'PGRST202' }), noWait);
  assert.equal(warmed.bootstrap.project_revision, 7, '쉬고 난 뒤 첫 500은 다시 물어 받는다');
  let offline = 0;
  await assert.rejects(() => fetchBootstrap({ url: 'https://example.invalid', publishable_key: 'k' }, async () => { offline++; throw new TypeError('fetch failed'); }, noWait), /fetch failed/);
  assert.equal(offline, 3, '연결 실패도 최대 3번');
  await assert.rejects(() => fetchBootstrap({ url: 'https://example.invalid', publishable_key: 'k' }, async () => reply(404, { code: 'PGRST116' })), /HTTP 404/);
});

test('기록에 읽은 경로를 남긴다', () => {
  const files = snapshotFiles(bootstrap(10, [{ source_id: 1, name: '가', code: 4 }], 200), 'poc_bootstrap161');
  assert.equal(JSON.parse(files.get('revision.json')).route, 'poc_bootstrap161');
  assert.equal(JSON.parse(snapshotFiles(bootstrap(10, [], 200)).get('revision.json')).route, undefined);
});
