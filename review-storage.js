import {STORAGE_KEY} from './review-core.js';
export const RESET_BACKUP_KEY = STORAGE_KEY + '-before-reset';

export function resetStoredReviews(storage, payload) {
  const saved = JSON.stringify(payload, null, 2) + '\n';
  // If either write fails, the caller keeps its current in-memory opinions.
  // Write the recovery copy before replacing the active document.
  storage.setItem(RESET_BACKUP_KEY, saved);
  storage.setItem(STORAGE_KEY, JSON.stringify({...payload, reviews: [], unmatched_reviews: []}));
  return saved;
}
