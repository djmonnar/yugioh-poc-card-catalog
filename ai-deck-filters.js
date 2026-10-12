import {statConditionsMatch} from './card-filters.js';
import {subtypeMatches} from './card-subtypes.js';
import {categoryMatches} from './card-groups.js';
import {additionMatches, compareAdded} from './card-additions.js';
import {annotationFor, tagMatches} from './card-tags.js';

const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g, '');

export function builderSearchText(card) {
  return normalize([card.name_ko, card.name_en, card.description_ko, card.type, card.subtype,
    card.race, card.attribute, ...(card.mechanics || []).map(row => row.name),
    ...(card.card_groups || []).map(row => row.name), card.slot, card.internal_id].join(' '));
}

// These are browsing conditions. AI deck limits and placement still use ai-deck-core.
export function builderCardMatches(card, filters = {}, {tagsState = null, additions} = {}) {
  if (card.special) return false;
  if (!tagMatches(tagsState, card, filters.tags || [])) return false;
  if (!subtypeMatches(card, filters.subtype || '')) return false;
  if (!categoryMatches(card, filters.mechanic || '', filters.group || '')) return false;
  if (filters.release && (!additions || !additionMatches(card, filters.release, additions))) return false;
  for (const [filter, field] of [['type', 'type'], ['race', 'race'], ['attribute', 'attribute'], ['tier', 'rarity']]) {
    if (filters[filter] && card[field] !== filters[filter]) return false;
  }
  if (filters.limit != null && filters.limit !== '' && (card.deck_limit ?? 3) !== Number(filters.limit)) return false;
  if (filters.speedLimit != null && filters.speedLimit !== '') {
    if (filters.speedLimit === 'unrestricted' ? card.speed_limit != null : card.speed_limit !== Number(filters.speedLimit)) return false;
  }
  if (filters.minLevel !== '' && filters.minLevel != null && (card.level == null || card.level < Number(filters.minLevel))) return false;
  if (filters.maxLevel !== '' && filters.maxLevel != null && (card.level == null || card.level > Number(filters.maxLevel))) return false;
  if (!statConditionsMatch(card, filters.statConditions || [])) return false;
  if (filters.status === 'stock' && !card.stock) return false;
  if (filters.status === 'reward' && (!card.reward_eligible || card.rarity === 'L' || card.draw_enabled === false)) return false;
  if (filters.status === 'effect-difference' && card.review_kind !== 'effect') return false;
  if (filters.status === 'attention' && !card.review_note) return false;
  const query = normalize(filters.query);
  return !query || (card.searchText ?? builderSearchText(card)).includes(query) ||
    normalize((annotationFor(tagsState, card)?.tags || []).join(' ')).includes(query);
}

export function sortBuilderCards(rows, sort = 'name', additions) {
  const collator = new Intl.Collator('ko');
  return [...rows].sort((a, b) => {
    if (sort === 'added' && additions) return compareAdded(a, b, additions);
    if (sort === 'slot') return a.slot - b.slot;
    if (sort === 'attack') return (b.atk ?? -1) - (a.atk ?? -1) || collator.compare(a.name_ko, b.name_ko);
    if (sort === 'level') return (b.level ?? -1) - (a.level ?? -1) || (b.atk ?? -1) - (a.atk ?? -1) || collator.compare(a.name_ko, b.name_ko);
    return collator.compare(a.name_ko, b.name_ko) || a.slot - b.slot;
  });
}
