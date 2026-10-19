// The public URL is an authoring doorway. Only the legacy game's explicit
// in_game=1 URL loads its existing bridge and save handling.
export function legacyEmbedRequested014(search = '') {
  return new URLSearchParams(search).get('in_game') === '1';
}

export async function mountExpeditionEntry014({
  document,
  search = '',
  loadGame = () => import('./roguelite166.js?v=20261018-166'),
} = {}) {
  const embedded = legacyEmbedRequested014(search);
  document.getElementById('web-editor014').hidden = embedded;
  document.body.classList.toggle('web-entry014', !embedded);
  if (embedded) await loadGame();
  return embedded ? 'legacy-embedded' : 'web-editor';
}

if (typeof document !== 'undefined') {
  await mountExpeditionEntry014({document, search: globalThis.location?.search || ''});
}
