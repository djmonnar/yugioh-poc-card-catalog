export const TIERS = ['UR', 'SR', 'R', 'N'];
export const EXPORT_KIND = 'poc-card-catalog-review';
export const STORAGE_KEY = 'poc-card-catalog-reviews-v1';

export function changesFor(card, fields = {}) {
  const rarity = fields.proposed_rarity || null;
  if (rarity && !TIERS.includes(rarity)) throw new Error('지원하지 않는 레어 등급이야.');
  const limit = fields.proposed_limit === '' || fields.proposed_limit == null ? null : Number(fields.proposed_limit);
  if (limit !== null && ![0, 1, 2, 3].includes(limit)) throw new Error('제한 매수는 0~3장이어야 해.');
  if (card.special && limit !== null) throw new Error('토큰·특수 카드는 덱 제한을 제안할 수 없어.');
  if (fields.replacement_candidate != null && typeof fields.replacement_candidate !== 'boolean') throw new Error('교체 후보 값이 잘못됐어.');
  for (const k of ['replacement_name', 'note']) if (fields[k] != null && typeof fields[k] !== 'string') throw new Error('메모는 문자열이어야 해.');
  return {
    proposed_rarity: rarity === card.rarity ? null : rarity,
    proposed_limit: limit === card.deck_limit ? null : limit,
    replacement_candidate: Boolean(fields.replacement_candidate),
    replacement_name: (fields.replacement_name || '').trim().slice(0, 240),
    note: (fields.note || '').trim().slice(0, 8000),
  };
}

export function hasChanges(change) {
  return Boolean(change && (change.proposed_rarity || change.proposed_limit !== null || change.replacement_candidate || change.replacement_name || change.note));
}

export function makeReview(card, fields, previous = null) {
  // An applied tier/limit does not erase the user's prior request. Preserve
  // its original baseline until the user clears it or chooses current values.
  const baseline=previous?.original ? {...card,rarity:previous.original.rarity,deck_limit:previous.original.deck_limit} : card;
  const changes = changesFor(baseline, fields);
  if (!hasChanges(changes)) return null;
  return {
    identity_key: card.identity_key, slot: card.slot, internal_id: card.internal_id,
    name_ko: card.name_ko, name_en: card.name_en,
    original: previous?.original || {rarity: card.rarity, deck_limit: card.deck_limit, type: card.type, level: card.level, atk: card.atk, def: card.def, description_ko: card.description_ko},
    changes, updated_at: new Date().toISOString(),
  };
}

export function exportPayload(meta, reviews, unmatched = []) {
  return {
    schema_version: 1, kind: EXPORT_KIND, exported_at: new Date().toISOString(),
    catalog: {dataset_id: meta.dataset_id, snapshot_date: meta.snapshot_date, source_exe_sha256: meta.source_exe_sha256},
    reviews: [...reviews].sort((a, b) => a.slot - b.slot), unmatched_reviews: unmatched,
  };
}

export function parseImport(payload, cards) {
  if (!payload || payload.schema_version !== 1 || payload.kind !== EXPORT_KIND || !Array.isArray(payload.reviews)) throw new Error('이 도감에서 내보낸 검토 JSON을 골라줘.');
  if (!payload.catalog || !/^[a-f0-9]{64}$/.test(payload.catalog.dataset_id || '')) throw new Error('도감 버전 정보가 없거나 잘못됐어.');
  if (payload.reviews.length > 10000 || (payload.unmatched_reviews || []).length > 10000) throw new Error('검토 항목이 너무 많아.');
  if (payload.unmatched_reviews && !Array.isArray(payload.unmatched_reviews)) throw new Error('미일치 검토 목록이 잘못됐어.');
  const index = new Map(cards.map(c => [c.identity_key, c]));
  const seen = new Set(), valid = [], unmatched = [];
  for (const row of [...payload.reviews, ...(payload.unmatched_reviews || [])]) {
    if (!row || !/^[a-f0-9]{64}$/.test(row.identity_key || '') || !Number.isInteger(row.slot) || !Number.isInteger(row.internal_id) || !row.changes) throw new Error('검토 항목의 카드 식별 정보가 잘못됐어.');
    if (seen.has(row.identity_key)) throw new Error('같은 카드의 검토 항목이 중복되어 있어.');
    seen.add(row.identity_key);
    const card = index.get(row.identity_key);
    if (!card || card.slot !== row.slot || card.internal_id !== row.internal_id) {
      // Preserve the full user opinion as an unmatched item; never apply it to
      // a replacement that happens to reuse the same native slot or ID.
      unmatched.push(row);
      continue;
    }
    let original=null;
    if (row.original && TIERS.includes(row.original.rarity) && (row.original.deck_limit == null || [0, 1, 2, 3].includes(row.original.deck_limit))) {
      original={rarity: row.original.rarity, deck_limit: row.original.deck_limit ?? null, type: String(row.original.type || '').slice(0, 100), level: row.original.level ?? null, atk: row.original.atk ?? null, def: row.original.def ?? null, description_ko: String(row.original.description_ko || '').slice(0, 20000)};
    }
    const accepted = makeReview(card, row.changes, original ? {original} : null);
    if (accepted) {
      // Retain the baseline as it appeared when the opinion was first written.
      // Reconstruct a strict allowlist; imported objects never enter the DOM.
      if (original) accepted.original=original;
      valid.push(accepted);
    }
  }
  return {valid, unmatched};
}

export function reviewCounts(rows) {
  return {total: rows.length, rarity: rows.filter(r => r.changes.proposed_rarity).length, replace: rows.filter(r => r.changes.replacement_candidate || r.changes.replacement_name).length, limit: rows.filter(r => r.changes.proposed_limit !== null).length};
}

export function reviewMarkdown(payload) {
  const lines = ['# Power of Chaos 카드 검토 의견', '', `도감 기준: ${payload.catalog.snapshot_date} · ${payload.catalog.dataset_id.slice(0, 12)}`, `검토 카드: ${payload.reviews.length}장`, ''];
  for (const r of payload.reviews) {
    lines.push(`## ${r.name_ko} (#${r.slot} / ID ${r.internal_id})`, '');
    const c = r.changes;
    if (c.proposed_rarity) lines.push(`- 레어도: ${r.original.rarity} → ${c.proposed_rarity}`);
    if (c.proposed_limit !== null) lines.push(`- 제한: ${r.original.deck_limit}장 → ${c.proposed_limit}장`);
    if (c.replacement_candidate || c.replacement_name) lines.push(`- 교체 후보${c.replacement_name ? ': ' + c.replacement_name : ': 대체 카드 미정'}`);
    if (c.note) lines.push('- 메모: ' + c.note.replaceAll('\n', '\n  '));
    lines.push('');
  }
  if (payload.unmatched_reviews?.length) {
    lines.push('## 현재 카드풀과 일치하지 않는 이전 의견', '', '이 의견은 다른 카드에 자동 적용하지 않았다.', '');
    for (const r of payload.unmatched_reviews) lines.push(`- ${r.name_ko || '이름 미상'} (#${r.slot} / ID ${r.internal_id}): ${JSON.stringify(r.changes)}`);
    lines.push('');
  }
  return lines.join('\n');
}
