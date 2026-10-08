// Addition history is separate from the gameplay dataset and online settings.
// Match identities, not just reused slots, so replacements do not inherit NEW.
export function additionIndex(cards, history) {
  if (history?.schema_version !== 1 || !Array.isArray(history.releases)) throw new Error('추가 이력 형식을 확인해줘.');
  const live = new Map(cards.map(card => [card.slot, card]));
  const byIdentity = new Map(), ids = new Set();
  const releases = history.releases.map(release => {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(release.id) || ids.has(release.id) ||
        typeof release.name !== 'string' || !release.name.trim() ||
        !/^\d{4}-\d{2}-\d{2}T/.test(release.added_at) || !Number.isFinite(Date.parse(release.added_at)) ||
        !Array.isArray(release.cards)) throw new Error('추가 이력을 확인해줘.');
    ids.add(release.id);
    const result = {id: release.id, name: release.name, added_at: release.added_at,
      date: release.added_at.slice(0, 10), count: 0};
    const slots = new Set();
    for (const row of release.cards) {
      if (!Number.isSafeInteger(row.slot) || row.slot < 1 || !Number.isSafeInteger(row.internal_id) ||
          typeof row.identity_key !== 'string' || !/^[a-f0-9]{64}$/.test(row.identity_key) || slots.has(row.slot))
        throw new Error('추가 카드의 식별값을 확인해줘.');
      slots.add(row.slot);
      const card = live.get(row.slot);
      if (!card || card.internal_id !== row.internal_id ||
          !(card.identity_key === row.identity_key || card.previous_identity_keys?.includes(row.identity_key))) continue;
      if (byIdentity.has(card.identity_key)) throw new Error('카드 추가 이력이 중복됐어.');
      byIdentity.set(card.identity_key, result); result.count++;
    }
    return result;
  }).sort((a, b) => Date.parse(b.added_at) - Date.parse(a.added_at));
  return {byIdentity, releases, latest: releases.find(release => release.count > 0) ?? null};
}

export function additionMatches(card, filter, index) {
  if (!filter) return true;
  const release = index.byIdentity.get(card.identity_key);
  return Boolean(release && release.id === (filter === 'latest' ? index.latest?.id : filter));
}

export function compareAdded(a, b, index) {
  const timestamp = card => Date.parse(index.byIdentity.get(card.identity_key)?.added_at ?? '') || 0;
  return timestamp(b) - timestamp(a) || a.slot - b.slot;
}
