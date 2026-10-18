import {cleanNodes150,emptyNodes150} from './roguelite150-nodes.js?v=20261015-150';
import {cardLine, resolveCard, placementError, sharesHarpieName, sharesUmiName} from './ai-deck-core.js';
import {validateMap} from './roguelite-map.js?v=20261014-138';
import {cleanEncounters} from './roguelite-encounters.js?v=20261014-138';
import {cleanRestClaims,restOutcome} from './roguelite150-rules.js?v=20261015-150';
import {snapshotCard} from './roguelite-card.js?v=20261014-139';
import {cleanRewardTrack,emptyRewardTrack} from './roguelite-rewards.js?v=20261014-139';
import {cleanBridgeState} from './roguelite147-state.js?v=20261015-147';
export {snapshotCard} from './roguelite-card.js?v=20261014-139';

export const SLOT_COUNT = 3;
export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'yugioh-classic-roguelite-v1';
export const SAVE_KIND = 'yugioh-classic-roguelite-save';
export const RUN_STATES = ['between_nodes', 'at_node', 'in_battle', 'reward_pending', 'completed', 'defeated'];
const GROUPS = ['main', 'extra'];
const MAX_SAVE_BYTES = 8_000_000;
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new Error(message); };
const record = value => !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} 값이 올바르지 않아.`);
  return value;
};
const text = (value, max, label, empty = false) => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length)) fail(`${label} 형식이 올바르지 않아.`);
  return value;
};
const identifier = (value, label = '식별값') => {
  text(value, 100, label);
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) fail(`${label} 형식이 올바르지 않아.`);
  return value;
};
const timestamp = value => {
  if (!(value instanceof Date) && typeof value !== 'string') fail('저장 시각이 올바르지 않아.');
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail('저장 시각이 올바르지 않아.');
  return date.toISOString();
};
const identity = value => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('카드 식별값이 올바르지 않아.');
  return value;
};

function parseRows(rows, cards, group) {
  if (!Array.isArray(rows) || rows.length > 100) fail('덱 카드 목록을 확인할 수 없어.');
  const seen = new Set();
  return rows.map(row => {
    if (!record(row)) fail('덱 카드 형식을 확인할 수 없어.');
    identity(row.identity_key);
    integer(row.slot, 1, 2047, '카드 번호');
    integer(row.internal_id, 0, 65535, '카드 내부 번호');
    integer(row.count, 1, 3, '덱 카드 매수');
    if (seen.has(row.identity_key)) fail('같은 덱에 카드가 중복된 행으로 들어 있어.');
    seen.add(row.identity_key);
    const card = resolveCard(row, cards);
    if (!card || row.name_ko !== card.name_ko || row.name_en !== card.name_en) fail('덱 카드와 원정의 카드 정보가 일치하지 않아.');
    const problem = placementError(card, group);
    if (problem) fail(problem);
    return cardLine(card, row.count);
  });
}

function parseGroups(groups, cards, {allowSide = false} = {}) {
  if (!record(groups)) fail('메인·엑스트라 덱을 확인할 수 없어.');
  const side = groups.side ?? [];
  if (!Array.isArray(side) || (!allowSide && side.length)) fail('원정의 활성 덱은 사이드 덱을 사용하지 않아.');
  return {main: parseRows(groups.main, cards, 'main'), extra: parseRows(groups.extra, cards, 'extra'),
    side: allowSide ? parseRows(side, cards, 'side') : []};
}

function playerIssues(groups, cards, allowIncomplete = false) {
  const issues = [], counts = {main: 0, extra: 0, side: 0}, totals = new Map();
  const buckets = [null, {used: 0, maximum: 1}, {used: 0, maximum: 2}, {used: 0, maximum: 3}];
  let harpies = 0, oceans = 0;
  for (const group of ['main', 'extra', 'side']) {
    for (const row of groups[group]) {
      const card = resolveCard(row, cards);
      counts[group] += row.count;
      totals.set(card.identity_key, (totals.get(card.identity_key) ?? 0) + row.count);
      if (sharesHarpieName(card)) harpies += row.count;
      if (sharesUmiName(card)) oceans += row.count;
      if (card.speed_limit === 0) issues.push(`${card.name_ko}: 스피드 듀얼에서 금지된 카드야.`);
      if (card.speed_limit > 0) buckets[card.speed_limit].used += row.count;
    }
  }
  if (counts.main > 30 || (!allowIncomplete && counts.main < 20)) issues.push(`메인 덱 ${counts.main}장 · 20~30장으로 맞춰줘.`);
  for (const group of ['extra', 'side']) if (counts[group] > 15) issues.push(`${group === 'extra' ? '엑스트라' : '예비'} 덱은 15장까지야.`);
  for (const [key, count] of totals) if (count > 3) issues.push(`${cards.find(card => card.identity_key === key).name_ko}: 같은 카드 합계는 3장까지야.`);
  if (harpies > 3) issues.push('해피 레이디 계열은 같은 이름 취급 합계 3장까지야.');
  if (oceans > 3) issues.push('바다·전설의 도시 아틀란티스는 같은 이름 취급 합계 3장까지야.');
  for (const [limit, bucket] of buckets.entries()) if (bucket && bucket.used > limit) issues.push(`제한 ${limit} 그룹은 서로 다른 카드도 합계 ${limit}장까지야.`);
  return {issues: [...new Set(issues)], counts, buckets: buckets.slice(1), valid: issues.length === 0, ready_for_game: issues.length === 0};
}

export function validatePlayerDeck(deck, cards, {allowIncomplete = false, allowSide = false} = {}) {
  try {
    if (!record(deck) || deck.ruleset !== 'duel_links_plan') fail('원정은 스피드 듀얼용 시작 덱을 사용해.');
    const snapshots = [];
    for (const group of ['main', 'extra', 'side']) for (const row of deck.groups?.[group] ?? []) {
      const card = resolveCard(row, cards);
      if (!card) fail(`${row.name_ko ?? '카드'}: 도감과 카드가 일치하지 않아.`);
      if (!snapshots.some(item => item.identity_key === card.identity_key)) snapshots.push(snapshotCard(card));
    }
    return playerIssues(parseGroups(deck.groups, snapshots, {allowSide}), snapshots, allowIncomplete);
  } catch (error) {
    return {issues: [error.message], counts: {main: 0, extra: 0, side: 0}, buckets: [], valid: false, ready_for_game: false};
  }
}

function cleanCollection(collection) {
  if (!Array.isArray(collection) || !collection.length || collection.length > 2047) fail('원정 카드함을 확인할 수 없어.');
  const seen = new Set(), slots = new Set();
  return collection.map(entry => {
    if (!record(entry)) fail('원정 카드함 형식을 확인할 수 없어.');
    const card = snapshotCard(entry.card);
    if (seen.has(card.identity_key) || slots.has(card.slot)) fail('원정 카드함의 카드 식별값이 중복돼 있어.');
    seen.add(card.identity_key); slots.add(card.slot);
    return {card, count: integer(entry.count, 1, 9999, '원정 보유 매수')};
  });
}

function ownedIssues(groups, collection) {
  const owned = new Map(collection.map(entry => [entry.card.identity_key, entry.count])), used = new Map();
  for (const group of GROUPS) for (const row of groups[group]) used.set(row.identity_key, (used.get(row.identity_key) ?? 0) + row.count);
  return [...used].filter(([key, count]) => count > (owned.get(key) ?? 0)).map(([key]) => `${collection.find(entry => entry.card.identity_key === key)?.card.name_ko ?? '카드'}: 원정에서 보유한 매수를 초과했어.`);
}

function activeDeck(id, name, groups) {
  return {deck_id: `run_${id}`, name, ruleset: 'duel_links_plan', banlist_enabled: true, difficulty: 3,
    strategy: {goal: '', priorities: '', combos: '', avoid: ''}, groups: clone(groups)};
}

export function makeStarter(deck, cards, meta = {}) {
  if (!record(deck) || deck.ruleset !== 'duel_links_plan') fail('스피드 듀얼용 덱만 시작 덱으로 등록할 수 있어.');
  const selected = new Map();
  for (const group of ['main', 'extra', 'side']) {
    if (!Array.isArray(deck.groups?.[group] ?? [])) fail('덱 카드 목록을 확인할 수 없어.');
    for (const row of deck.groups[group] ?? []) {
      if (!record(row)) fail('덱 카드 형식을 확인할 수 없어.');
      integer(row.count, 1, 3, '덱 카드 매수');
      const card = resolveCard(row, cards);
      if (!card) fail(`${row.name_ko ?? '카드'}: 현재 도감과 일치하지 않아. 시작 덱을 확인해줘.`);
      selected.set(card.identity_key, snapshotCard(card));
    }
  }
  const snapshots = [...selected.values()], canonical = {};
  for (const group of ['main', 'extra', 'side']) canonical[group] = (deck.groups[group] ?? []).map(row => cardLine(resolveCard(row, cards), row.count));
  const groups = parseGroups(canonical, snapshots, {allowSide: true});
  const result = playerIssues(groups, snapshots);
  if (!result.valid) fail(result.issues.join(' '));
  const totals = new Map();
  for (const group of ['main', 'extra', 'side']) for (const row of groups[group]) totals.set(row.identity_key, (totals.get(row.identity_key) ?? 0) + row.count);
  const starter = {
    starter_id: identifier(meta.id ?? deck.deck_id, '시작 덱 번호'),
    source_deck_id: identifier(deck.deck_id, '원본 덱 번호'),
    name: text(meta.name ?? deck.name, 80, '시작 덱 이름'),
    catalog_version: text(meta.catalogVersion ?? meta.dataset_id ?? 'unknown', 200, '도감 버전'),
    registered_at: timestamp(meta.now ?? new Date()),
    collection: snapshots.map(card => ({card, count: totals.get(card.identity_key)})),
    groups: {...groups, side: []}
  };
  return cleanStarter(starter);
}

function cleanStarter(starter) {
  if (!record(starter)) fail('시작 덱을 확인할 수 없어.');
  const collection = cleanCollection(starter.collection), cards = collection.map(entry => entry.card), groups = parseGroups(starter.groups, cards);
  const issues = [...playerIssues(groups, cards).issues, ...ownedIssues(groups, collection)];
  if (issues.length) fail(issues.join(' '));
  return {starter_id: identifier(starter.starter_id, '시작 덱 번호'), source_deck_id: identifier(starter.source_deck_id, '원본 덱 번호'),
    name: text(starter.name, 80, '시작 덱 이름'), catalog_version: text(starter.catalog_version, 200, '도감 버전'),
    registered_at: timestamp(starter.registered_at), collection, groups};
}

export function createRun({id, slotId, starter, cards, catalogVersion, seed, now = new Date()}) {
  const registered = cleanStarter(starter);
  identifier(id, '원정 번호');
  if (!slotIds().includes(slotId)) fail('저장 슬롯을 확인할 수 없어.');
  if (cards) for (const entry of registered.collection) {
    // A replaced slot must not silently become another card before a run starts.
    if (!resolveCard(cardLine(entry.card), cards)) fail(`${entry.card.name_ko}: 현재 도감과 일치하지 않아. 시작 덱을 다시 등록해줘.`);
  }
  const normalizedSeed = typeof seed === 'number' ? String(integer(seed, 0, 0xffffffff, '맵 시드')) : text(seed, 200, '맵 시드');
  const time = timestamp(now);
  return cleanRun({id, slot_id: slotId, revision: 0, starter_id: registered.starter_id, starter_name: registered.name,
    catalog_version: text(catalogVersion ?? registered.catalog_version, 200, '도감 버전'), content_version: 'prototype139',
    seed: normalizedSeed, created_at: time, updated_at: time, lp: 4000, max_lp: 4000, gold: 0, floor: 0, state: 'between_nodes',
    collection: clone(registered.collection), active_deck: activeDeck(id, registered.name, registered.groups),
    relics: [], reward_claims: [], reward_track: emptyRewardTrack(), history: [], map: null, current_node_id:null, encounters:{}, rest_claims:[]});
}

function jsonValue(value, depth = 0, budget = {nodes: 0}) {
  if (depth > 30 || ++budget.nodes > 50000) fail('원정 진행 자료가 너무 커.');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return text(value, 10000, '진행 자료', true);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => jsonValue(item, depth + 1, budget));
  if (record(value)) {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 200) fail('원정 진행 자료의 키를 확인할 수 없어.');
      output[key] = jsonValue(item, depth + 1, budget);
    }
    return output;
  }
  fail('원정 진행 자료를 JSON으로 저장할 수 없어.');
}

function cleanRun(run) {
  if (!record(run)) fail('원정 저장 자료를 확인할 수 없어.');
  const id = identifier(run.id, '원정 번호');
  if (!slotIds().includes(run.slot_id) || !RUN_STATES.includes(run.state)) fail('원정 슬롯이나 진행 상태를 확인할 수 없어.');
  const collection = cleanCollection(run.collection), cards = collection.map(entry => entry.card);
  if (!record(run.active_deck) || run.active_deck.ruleset !== 'duel_links_plan') fail('원정의 활성 덱을 확인할 수 없어.');
  const groups = parseGroups(run.active_deck.groups, cards), issues = [...playerIssues(groups, cards).issues, ...ownedIssues(groups, collection)];
  if (issues.length) fail(issues.join(' '));
  const maxLp = integer(run.max_lp, 1, 65535, '최대 LP'), lp = integer(run.lp, 0, maxLp, '현재 LP');
  if (!Array.isArray(run.relics) || run.relics.length > 100 || new Set(run.relics).size !== run.relics.length) fail('유물 목록을 확인할 수 없어.');
  const relics = run.relics.map(value => identifier(value, '유물 번호'));
  if (!Array.isArray(run.reward_claims) || run.reward_claims.length > 5000) fail('보상 기록을 확인할 수 없어.');
  const nodes150 = cleanNodes150(run.nodes150 ?? emptyNodes150(),run);
  const claims = new Set();
  const rewardClaims = run.reward_claims.map(claim => {
    if (!record(claim)) fail('보상 기록을 확인할 수 없어.');
    const rewardId = identifier(claim.id, '보상 번호');
    if (claims.has(rewardId)) fail('보상 번호가 중복돼 있어.');
    claims.add(rewardId);
    const key = identity(claim.identity_key);
    if (!collection.some(entry => entry.card.identity_key === key) && !nodes150.removals.some(loss=>loss.card.identity_key===key && loss.after_count===0)) fail('보상 기록과 원정 카드함·영구 제거 기록이 일치하지 않아.');
    return {id: rewardId, identity_key: key, count: integer(claim.count, 1, 99, '보상 매수')};
  });
  const acquired150=new Map();
  for(const claim of rewardClaims)acquired150.set(claim.identity_key,(acquired150.get(claim.identity_key)||0)+claim.count);
  for(const [key,count] of acquired150){
    const held=collection.find(e=>e.card.identity_key===key)?.count||0;
    const lost=nodes150.removals.filter(e=>e.card.identity_key===key).reduce((n,e)=>n+e.count,0);
    if(count>held+lost)fail('카드 지급 매수와 현재 보유·영구 제거 매수가 일치하지 않아.');
  }
  if (!Array.isArray(run.history) || run.history.length > 5000 || (run.map !== null && !record(run.map))) fail('원정 진행 기록을 확인할 수 없어.');
  if (run.map !== null) {
    const mapCheck = validateMap(run.map);
    if (!mapCheck.valid) fail(`원정 지도 자료를 확인할 수 없어. ${mapCheck.errors.join(' ')}`);
    if (run.map.seed !== run.seed || run.floor > run.map.floors) fail('원정 지도와 시드·진행 층이 일치하지 않아.');
  }
  const currentNode = run.current_node_id ?? null;
  if (currentNode !== null && !run.map?.nodes.some(node => node.id === currentNode && node.floor === run.floor)) fail('원정 위치와 진행 층이 일치하지 않아.');
  const encounters = cleanEncounters(run.encounters ?? {}, run.map);
  const restClaims = cleanRestClaims(run.rest_claims ?? [],run.map,relics);
  for (const claim of restClaims) {
    const visited = run.map.nodes.find(node => node.id === claim.node_id);
    if (visited.floor > run.floor || (visited.floor === run.floor && currentNode !== visited.id)) fail('휴식 기록과 원정 방문 위치가 일치하지 않아.');
  }
  return {id, slot_id: run.slot_id, revision: integer(run.revision, 0, Number.MAX_SAFE_INTEGER, '원정 버전'),
    starter_id: identifier(run.starter_id, '시작 덱 번호'), starter_name: text(run.starter_name, 80, '시작 덱 이름'),
    catalog_version: text(run.catalog_version, 200, '도감 버전'), content_version: text(run.content_version, 200, '콘텐츠 버전'),
    seed: text(run.seed, 200, '맵 시드'), created_at: timestamp(run.created_at), updated_at: timestamp(run.updated_at),
    lp, max_lp: maxLp, gold: integer(run.gold, 0, 2_000_000_000, '원정 금화'), floor: integer(run.floor, 0, 10000, '진행 층'),
    state: run.state, collection, active_deck: activeDeck(id, text(run.active_deck.name, 80, '원정 덱 이름'), groups),
    relics, reward_claims: rewardClaims, reward_track: cleanRewardTrack(run.reward_track ?? emptyRewardTrack()), history: jsonValue(run.history), map: jsonValue(run.map),
    current_node_id:currentNode, encounters, rest_claims:restClaims, nodes150,
    ...(run.area == null ? {} : {area:integer(run.area,1,10000,'구역')}),
    ...(run.bridge147 == null ? {} : {bridge147:cleanBridgeState(run.bridge147,run)})};
}

export const normalizeRun = cleanRun;

// Only an entered rest node can affect a saved run. Map preview never calls this.
export function resolveRestChoice(run,nodeId,choice,{now = new Date()} = {}) {
  const clean=cleanRun(run),previous=clean.rest_claims.find(claim=>claim.node_id===nodeId);
  if(previous){if(previous.choice!==choice)fail('이 휴식에서는 이미 다른 선택을 마쳤어.');return clean;}
  if(clean.state!=='at_node'||clean.current_node_id!==nodeId||!clean.map?.nodes.some(node=>node.id===nodeId&&node.kind==='rest')) fail('도착한 휴식 장소에서만 선택할 수 있어.');
  const outcome=restOutcome({lp:clean.lp,max_lp:clean.max_lp,relics:clean.relics,seed:clean.seed,nodeId},choice);
  return cleanRun({...clean,lp:outcome.lp,max_lp:outcome.max_lp,relics:outcome.relics,state:'between_nodes',
    rest_claims:[...clean.rest_claims,{node_id:nodeId,choice,relic_id:outcome.relic_id}],
    revision:clean.revision+1,updated_at:timestamp(now)});
}

export function validateRun(run) {
  try { cleanRun(run); return {valid: true, issues: []}; }
  catch (error) { return {valid: false, issues: [error.message]}; }
}

function editable(run) {
  const clean = cleanRun(run);
  if (!['between_nodes', 'at_node'].includes(clean.state)) fail('전투·보상 처리 중에는 덱을 바꿀 수 없어.');
  return clean;
}

export function beginDeckEdit(run) {
  const clean = editable(run);
  return {run_id: clean.id, base_revision: clean.revision, groups: clone(clean.active_deck.groups)};
}

function cleanDraft(run, draft) {
  if (!record(draft) || draft.run_id !== run.id || draft.base_revision !== run.revision) fail('다른 원정이거나 오래된 덱 편집본이야. 다시 열어줘.');
  return {run_id: run.id, base_revision: run.revision, groups: parseGroups(draft.groups, run.collection.map(entry => entry.card))};
}

export function adjustRunDeck(run, draft, key, group, delta) {
  const clean = editable(run), next = cleanDraft(clean, draft);
  if (!GROUPS.includes(group) || ![1, -1].includes(delta)) fail('원정 덱 편집 요청을 확인할 수 없어.');
  const entry = clean.collection.find(item => item.card.identity_key === key);
  if (!entry) fail('원정에서 획득하지 않은 카드야.');
  const row = next.groups[group].find(item => item.identity_key === key);
  if (delta < 0) {
    if (row) { row.count--; if (!row.count) next.groups[group].splice(next.groups[group].indexOf(row), 1); }
  } else {
    const problem = placementError(entry.card, group);
    if (problem) fail(problem);
    if (row) row.count++; else next.groups[group].push(cardLine(entry.card));
    const issues = [...playerIssues(next.groups, clean.collection.map(item => item.card), true).issues, ...ownedIssues(next.groups, clean.collection)];
    if (issues.length) fail(issues.join(' '));
  }
  return next;
}

export function commitRunDeck(run, draft, {now = new Date()} = {}) {
  const clean = editable(run), next = cleanDraft(clean, draft);
  const issues = [...playerIssues(next.groups, clean.collection.map(entry => entry.card)).issues, ...ownedIssues(next.groups, clean.collection)];
  if (issues.length) fail(issues.join(' '));
  return cleanRun({...clean, active_deck: activeDeck(clean.id, clean.active_deck.name, next.groups), revision: clean.revision + 1, updated_at: timestamp(now)});
}

export function grantCard(run, card, count = 1, {rewardId, now = new Date()} = {}) {
  const clean = cleanRun(run), snapshot = snapshotCard(card);
  if (['completed', 'defeated'].includes(clean.state)) fail('끝난 원정에는 카드를 추가할 수 없어.');
  integer(count, 1, 99, '보상 매수'); identifier(rewardId, '보상 번호');
  const previous = clean.reward_claims.find(claim => claim.id === rewardId);
  if (previous) {
    if (previous.identity_key !== snapshot.identity_key || previous.count !== count) fail('같은 보상 번호에 다른 카드가 지정됐어.');
    return clean;
  }
  const entry = clean.collection.find(item => item.card.identity_key === snapshot.identity_key);
  if (entry) {
    if (entry.card.slot !== snapshot.slot || entry.card.internal_id !== snapshot.internal_id) fail('보상 카드 식별값이 기존 카드와 일치하지 않아.');
    entry.count = integer(entry.count + count, 1, 9999, '원정 보유 매수');
  } else {
    if (clean.collection.some(item => item.card.slot === snapshot.slot)) fail('같은 번호의 카드가 교체됐어. 진행 중인 원정에 새 카드로 덮어쓸 수 없어.');
    clean.collection.push({card: snapshot, count});
  }
  clean.reward_claims.push({id: rewardId, identity_key: snapshot.identity_key, count});
  clean.revision++; clean.updated_at = timestamp(now);
  return cleanRun(clean);
}

function slotIds() { return Array.from({length: SLOT_COUNT}, (_, index) => `slot-${index + 1}`); }
export function emptySave() {
  return {kind: SAVE_KIND, schema_version: SCHEMA_VERSION, revision: 0, starters: [], slots: slotIds().map(slot_id => ({slot_id, run: null}))};
}

export function parseSave(input) {
  if (typeof input === 'string') {
    if (!input.length || input.length > MAX_SAVE_BYTES) fail('원정 저장 파일이 비었거나 너무 커.');
    try { input = JSON.parse(input); } catch { fail('원정 저장 자료가 손상됐어. 백업을 내보내고 확인해줘.'); }
  }
  if (!record(input) || input.kind !== SAVE_KIND || input.schema_version !== SCHEMA_VERSION) fail('지원하지 않는 원정 저장 버전이야. 원본을 보존하고 해당 버전으로 열어줘.');
  if (!Array.isArray(input.starters) || input.starters.length > 100 || !Array.isArray(input.slots) || input.slots.length !== SLOT_COUNT) fail('시작 덱이나 저장 슬롯 목록을 확인할 수 없어.');
  const starters = input.starters.map(cleanStarter), starterIds = new Set(starters.map(starter => starter.starter_id));
  if (starterIds.size !== starters.length) fail('시작 덱 번호가 중복돼 있어.');
  const runIds = new Set(), slots = input.slots.map((slot, index) => {
    if (!record(slot) || slot.slot_id !== slotIds()[index]) fail('저장 슬롯 순서나 번호를 확인할 수 없어.');
    if (slot.run === null) return {slot_id: slot.slot_id, run: null};
    const run = cleanRun(slot.run);
    if (run.slot_id !== slot.slot_id || runIds.has(run.id)) fail('원정과 저장 슬롯이 일치하지 않거나 중복돼 있어.');
    runIds.add(run.id);
    return {slot_id: slot.slot_id, run};
  });
  return {kind: SAVE_KIND, schema_version: SCHEMA_VERSION, revision: integer(input.revision, 0, Number.MAX_SAFE_INTEGER, '저장 버전'), starters, slots};
}

export function serializeSave(save) {
  const serialized = JSON.stringify(parseSave(save), null, 2);
  if (serialized.length > MAX_SAVE_BYTES) fail('원정 저장 자료가 너무 커.');
  return serialized;
}

export function readStore(storage) {
  if (!storage || typeof storage.getItem !== 'function') fail('브라우저 저장소를 사용할 수 없어.');
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? emptySave() : parseSave(raw);
}

// A single setItem never leaves half an envelope. For concurrent tabs, the UI
// coordinates this revision compare-and-write under the same Web Lock.
export function writeStore(storage, save, expectedRevision) {
  if (!storage || typeof storage.setItem !== 'function') fail('브라우저 저장소를 사용할 수 없어.');
  integer(expectedRevision, 0, Number.MAX_SAFE_INTEGER - 1, '저장 기대 버전');
  const clean = parseSave(save), current = readStore(storage);
  if (current.revision !== expectedRevision || clean.revision !== expectedRevision) fail('다른 창에서 원정 저장이 바뀌었어. 현재 저장본을 다시 불러와줘.');
  const next = {...clean, revision: expectedRevision + 1}, serialized = serializeSave(next);
  storage.setItem(STORAGE_KEY, serialized);
  return next;
}

