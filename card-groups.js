// Public browsing relationships, never a substitute for in-duel name rules.
export function categoryMatches(card, mechanic = '', group = '') {
  return (!mechanic || (card.mechanics || []).some(m => m.id === mechanic)) &&
    (!group || (card.card_groups || []).some(g => g.id === group));
}
export function groupCards(cards, id, role = '') {
  return cards.filter(card => (card.card_groups || []).some(g => g.id === id && (!role || g.role === role)));
}
export function cardLink(slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 2047) throw new Error('Invalid card slot');
  return `#card-${slot}`;
}
export function groupHash(id) {
  if (!/^[a-z][a-z_0-9]*$/.test(id)) throw new Error('Invalid group ID');
  return `#group-${id}`;
}
export function parseCatalogHash(hash) {
  const card = /^#card-(\d+)$/.exec(hash);
  if (card && Number(card[1]) >= 1 && Number(card[1]) <= 2047) return {card: Number(card[1])};
  if (hash === '#new-cards') return {newCards: true};
  const release = /^#release-([a-z0-9][a-z0-9_-]*)$/.exec(hash);
  if (release) return {release: release[1]};
  const group = /^#group-([a-z][a-z_0-9]*)$/.exec(hash);
  return group ? {group: group[1]} : null;
}
