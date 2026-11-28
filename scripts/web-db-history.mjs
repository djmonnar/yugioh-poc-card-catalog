// 공개 게임 자료를 항목별 JSON 파일로 나눠 기록한다 (web-db-history 브랜치).
// 앱과 같은 최신 공개 조회(poc_bootstrapNNN, view=game)와 공개 키만 쓴다. DB는 바꾸지 않는다.
// 카드팩 배포로 새 경로가 생기면 이전 경로는 옛 앱용으로 고정된다(161 적용 뒤 153 이하는 개정 876에 고정).
// 그래서 RPC_FLOOR 위쪽 번호부터 찾아, 있는 것 중 가장 높은 경로를 읽는다.
//
//   node scripts/web-db-history.mjs <기록 폴더> [--from <저장된 응답 JSON> [--route <경로 이름>]] [--message <커밋 메시지 파일>]
//
// 기록 폴더의 이전 파일과 비교해 바뀐 파일만 쓰고, 사라진 항목은 지운다.
// 바뀐 항목 요약을 LATEST.md와 커밋 메시지 파일에 남긴다.
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RPC_FLOOR = 161;
export const RPC_PROBE_AHEAD = 65;
// (200) 전송량 줄이기: 이전 기록(revision.json의 route)이 있으면 그 경로부터 위로 이만큼만 찾는다(없는 번호마다 작은 404 요청, 기록이 오래돼도 새 경로를 놓치지 않을 만큼 넉넉히).
export const RPC_PROBE_AHEAD_RECORDED = 30;
export const RPC = `poc_bootstrap${RPC_FLOOR}`;
const routeNumber = rpc => { const m = /^poc_bootstrap(\d{3})$/.exec(rpc ?? ''); return m ? Number(m[1]) : null; };
/** (200) 이전 기록에서 다음 조회의 시작 경로와 개정 번호를 읽는다. 없거나 깨졌으면 null(처음처럼 전체를 받는다). */
export function recordedState(revisionJson) {
  try {
    const value = JSON.parse(revisionJson);
    const number = routeNumber(value?.route);
    if (number === null || number < RPC_FLOOR || !Number.isSafeInteger(value?.project_revision) || value.project_revision < 1) return null;
    return { route: value.route, revision: value.project_revision };
  } catch { return null; }
}
export const routeCandidates = (floor = RPC_FLOOR, ahead = RPC_PROBE_AHEAD) =>
  Array.from({ length: ahead + 1 }, (_, i) => `poc_bootstrap${floor + ahead - i}`);
const ID_KEYS = ['source_id', 'sourceId', 'id', 'profile_id', 'code', 'slot'];
const KEEP = new Set(['README.md', 'LATEST.md', '.git']);
const LABELS = {
  'game/catalog': '카드',
  'game/characters': '캐릭터',
  'game/deck_rules035/rows': '덱 금제',
  'game/opponents/opponents': '상대 편성',
  'game/opponents/chapters': '챕터',
  'game/opponents/nativeDeckRules035/rows': '상대 덱 금제',
  'game/content022/relics': '유물',
  'game/content022/events': '이벤트',
  'game/starters/starters': '시작 덱',
  'practice-decks': '연습 덱',
};

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}
const pretty = value => JSON.stringify(sortKeys(value), null, 2) + '\n';
const parse = value => (typeof value === 'string' ? JSON.parse(value) : value ?? null);
const itemId = item => { for (const key of ID_KEYS) if (item[key] !== undefined && item[key] !== null && item[key] !== '') return String(item[key]); return null; };
const safe = id => id.replace(/[^A-Za-z0-9._-]/g, '_');
const isItem = value => value && typeof value === 'object' && !Array.isArray(value);

function splittable(list) {
  if (!Array.isArray(list) || list.length === 0 || !list.every(v => isItem(v) && itemId(v) !== null)) return false;
  return new Set(list.map(v => safe(itemId(v)))).size === list.length;
}

function splitInto(files, base, value) {
  if (splittable(value)) {
    for (const item of value) files.set(`${base}/${safe(itemId(item))}.json`, pretty(item));
    return;
  }
  if (isItem(value)) {
    const rest = {};
    let split = false;
    for (const [key, child] of Object.entries(value)) {
      if (splittable(child) && child.length >= 10) { splitInto(files, `${base}/${key}`, child); split = true; }
      else rest[key] = child;
    }
    files.set(split ? `${base}/_rest.json` : `${base}.json`, pretty(rest));
    return;
  }
  files.set(`${base}.json`, pretty(value));
}

/** 공개 응답 하나를 { 상대 경로 → 파일 내용 } 으로 바꾼다. */
export function snapshotFiles(bootstrap, route = null) {
  if (bootstrap?.kind !== 'unified039-bootstrap' || bootstrap.view !== 'game') throw new Error('공개 게임 조회 응답이 아닙니다.');
  const files = new Map();
  const game = bootstrap.game ?? {};
  const practice = bootstrap.practice_decks063 ?? null;
  files.set('revision.json', pretty({
    ...(route ? { route } : {}),
    project_id: bootstrap.project_id,
    project_revision: bootstrap.project_revision,
    game_revision: game.game_revision,
    authoring_revision: game.authoring_revision,
    metadata_revision: game.metadata_revision,
    source_fingerprint: game.source_fingerprint,
    map_rules_revision: bootstrap.map_rules052?.revision ?? null,
    practice_decks_sha256: practice?.sha256 ?? null,
    identity: game.identity ?? null,
  }));
  for (const [key, value] of Object.entries(parse(game.payload_json) ?? {})) splitInto(files, `game/${key}`, value);
  if (bootstrap.map_rules052) {
    const { config_json, ...rest } = bootstrap.map_rules052;
    files.set('map-rules.json', pretty({ ...rest, config: parse(config_json) }));
  }
  if (practice) {
    const { payload_json, ...rest } = practice;
    const decks = parse(payload_json)?.decks ?? [];
    splitInto(files, 'practice-decks', decks);
    files.set('practice-decks/_rest.json', pretty(rest));
  }
  files.set('content-profiles.json', pretty(Object.fromEntries(Object.entries(bootstrap).filter(([key]) => key.startsWith('content_')))));
  return files;
}

function section(file) {
  const dir = path.posix.dirname(file);
  return dir === '.' ? file.replace(/\.json$/, '') : dir;
}
function label(file, text) {
  if (!text) return path.posix.basename(file, '.json');
  try { const item = JSON.parse(text); const id = itemId(item); const name = item.name ?? item.deckName ?? item.title;
    return id && name ? `${id} ${name}` : id ?? path.posix.basename(file, '.json'); }
  catch { return path.posix.basename(file, '.json'); }
}

/** 이전·현재 파일을 비교해 영역별 추가·변경·삭제 목록을 만든다. */
export function summarize(before, after) {
  const groups = new Map();
  const add = (file, kind, text) => {
    const key = section(file);
    if (!groups.has(key)) groups.set(key, { added: [], changed: [], removed: [] });
    groups.get(key)[kind].push(label(file, text));
  };
  for (const [file, text] of after) {
    if (!before.has(file)) add(file, 'added', text);
    else if (before.get(file) !== text) add(file, 'changed', text);
  }
  for (const [file, text] of before) if (!after.has(file)) add(file, 'removed', text);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ section: key, label: LABELS[key] ?? key, ...value }));
}

export function describe(summary, revision, previous) {
  const head = previous == null ? `웹 DB 개정 ${revision} (첫 기록)` : `웹 DB 개정 ${revision} (이전 기록 ${previous})`;
  const lines = summary.filter(group => group.section !== 'revision').map(group => {
    const parts = [];
    for (const [kind, word] of [['changed', '변경'], ['added', '추가'], ['removed', '삭제']]) {
      if (!group[kind].length) continue;
      const shown = group[kind].slice(0, 8).join(', ');
      parts.push(`${word} ${group[kind].length}: ${shown}${group[kind].length > 8 ? ' …' : ''}`);
    }
    return `- ${group.label} (${group.section}) · ${parts.join(' / ')}`;
  });
  return [head, '', ...(lines.length ? lines : ['- 개정 번호만 바뀌었다.'])].join('\n') + '\n';
}

async function readTree(root, prefix = '') {
  const files = new Map();
  let entries = [];
  try { entries = await readdir(path.join(root, prefix), { withFileTypes: true }); } catch { return files; }
  for (const entry of entries) {
    if (!prefix && KEEP.has(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) for (const [k, v] of await readTree(root, rel)) files.set(k, v);
    else if (entry.name.endsWith('.json')) files.set(rel, await readFile(path.join(root, rel), 'utf8'));
  }
  return files;
}

// 경로가 없으면 PostgREST가 404와 PGRST202를 돌려준다. 그때만 다음(낮은) 번호로 넘어간다.
// 최신 경로는 요청마다 자료를 계산해(약 2초) 쉬고 난 뒤 첫 호출이 익명 조회 제한(3초)에 걸려 HTTP 500이
// 날 수 있다(2026-11-20, poc_bootstrap175). 앱(NativeOpponentOnline013.FetchBody)처럼 5xx와 연결 실패는
// 잠시 뒤 다시 묻는다(최대 3번). 404 등 다른 답은 그대로 끝난다.
// (200) known({route, revision})이 있으면 그 경로에는 p_known_revision을 보내, 바뀌지 않았을 때 DB가 짧은 "unchanged" 답(약 9KB)을 준다.
// 새 경로가 생겼거나 개정이 바뀌었으면 전과 같이 전체 응답을 받는다.
export async function fetchBootstrap(config, fetchImpl = fetch, { attempts = 3, delayMs = 2000, sleep = ms => new Promise(done => setTimeout(done, ms)), known = null } = {}) {
  const from = known ? routeNumber(known.route) : null;
  const candidates = from === null ? routeCandidates() : routeCandidates(from, RPC_PROBE_AHEAD_RECORDED);
  for (const rpc of candidates) {
    let response = null;
    for (let attempt = 1; ; attempt++) {
      try {
        response = await fetchImpl(`${config.url}/rest/v1/rpc/${rpc}`, {
          method: 'POST',
          headers: { apikey: config.publishable_key, Authorization: `Bearer ${config.publishable_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_view: 'game', p_known_revision: known && rpc === known.route ? known.revision : null }),
          signal: AbortSignal.timeout(60000),
        });
      } catch (error) {
        if (attempt >= attempts) throw error;
        await sleep(delayMs);
        continue;
      }
      if (response.status >= 500 && response.status <= 599 && attempt < attempts) { await sleep(delayMs); continue; }
      break;
    }
    if (response.status === 404) {
      let code = null;
      try { code = (await response.json())?.code ?? null; } catch {}
      if (code === 'PGRST202') continue;
    }
    if (!response.ok) throw new Error(`공개 조회 실패: ${rpc} HTTP ${response.status}`);
    return { route: rpc, bootstrap: await response.json() };
  }
  throw new Error('공개 조회 경로를 찾지 못했습니다.');
}

async function main(argv) {
  const out = argv[0];
  if (!out) throw new Error('usage: node scripts/web-db-history.mjs <기록 폴더> [--from <응답 JSON>] [--message <파일>]');
  const option = name => { const i = argv.indexOf(name); return i > 0 ? argv[i + 1] : null; };
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const config = JSON.parse(await readFile(path.join(repoRoot, 'data', 'cloud-config.json'), 'utf8'));
  const before = await readTree(out);
  const fetched = option('--from')
    ? { route: option('--route'), bootstrap: JSON.parse(await readFile(option('--from'), 'utf8')) }
    : await fetchBootstrap(config, fetch, { known: recordedState(before.get('revision.json')) });
  const bootstrap = fetched.bootstrap;
  // (200) 같은 경로·같은 개정: 받은 것은 짧은 "unchanged" 답뿐이다. 아무 파일도 쓰지 않는다.
  if (bootstrap?.unchanged === true) {
    if (bootstrap.kind !== 'unified039-bootstrap' || bootstrap.view !== 'game') throw new Error('공개 게임 조회 응답이 아닙니다.');
    process.stdout.write('변경 없음 (같은 경로·같은 개정)\n');
    return;
  }
  const after = snapshotFiles(bootstrap, fetched.route);
  let previous = null;
  try { previous = JSON.parse(before.get('revision.json')).project_revision; } catch {}
  const summary = summarize(before, after);
  const text = describe(summary, bootstrap.project_revision, previous);
  for (const file of before.keys()) if (!after.has(file)) await rm(path.join(out, file));
  for (const [file, content] of after) {
    if (before.get(file) === content) continue;
    await mkdir(path.dirname(path.join(out, file)), { recursive: true });
    await writeFile(path.join(out, file), content);
  }
  if (summary.length) await writeFile(path.join(out, 'LATEST.md'), `# 최근 변경\n\n${text}`);
  await writeFile(path.join(out, 'README.md'), readme(fetched.route ?? RPC));
  await writeFile(option('--message') ?? path.join(out, '..', 'history-message.txt'), text);
  process.stdout.write(summary.length ? text : '변경 없음\n');
}

const readme = route => `# 웹 DB 공개 변경 기록

이 브랜치는 제작소 DB의 공개 게임 자료를 항목별 파일로 나눠 보관한다.
GitHub Actions(\`Record web DB history\`)가 한 시간마다 앱과 같은 최신 공개 조회(지금은 \`${route}\`, view=game)를 읽고,
바뀐 것이 있을 때만 커밋한다. DB는 바꾸지 않고, 공개 키 외의 비밀은 쓰지 않는다.

- 최근 변경 요약: [LATEST.md](LATEST.md)
- 개정 사이 비교: 커밋 기록, 또는 \`compare/<이전 커밋>...<다음 커밋>\`
- 폴더: \`game/catalog\` 카드, \`game/characters\` 캐릭터, \`game/opponents\` 상대 편성·챕터,
  \`game/deck_rules035\` 덱 금제, \`game/content022\` 유물·이벤트, \`practice-decks\` 연습 덱, \`map-rules.json\` 지도 규칙

한계: 한 시간 안의 여러 수정은 한 커밋으로 합쳐진다. 누가 고쳤는지는 공개 자료에 없어서 기록하지 않는다.
`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1); });
}
