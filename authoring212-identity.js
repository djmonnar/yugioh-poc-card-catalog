import {GAME_IDENTITY211, gameIdentityAccepts211} from './authoring211-identity.js?v=20261126-destruction-dinosaur-dark-magician211';

export const CONTENT_PROFILE212 = Object.freeze({schema: 1, card_set: 'sphinx-volcanic-monarch212'});
export const GAME_IDENTITY212 = Object.freeze({...GAME_IDENTITY211, ...{
  "catalog212_sha256": "e722bc8cfa60a4d6b0606c92667dd9503109b3b1d300a63e66afff03b0063ef0",
  "native_manifest212_sha256": "338fc180cafada45e81f40bb56eab146304ccaeda0d21867a0dd6d7f3c3ad06d"
}});

export function gameIdentityAccepts212(identity) {
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.hasOwn(identity, 'catalog212_sha256') && !Object.hasOwn(identity, 'native_manifest212_sha256'))
    return gameIdentityAccepts211(identity);
  if (!Object.entries(GAME_IDENTITY212).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY212, key));
  return extra.every(key => /^(catalog|native_manifest)\d{3}_sha256$/.test(key) &&
    typeof identity[key] === 'string' && /^[a-f0-9]{64}$/.test(identity[key]) && Number(key.match(/\d{3}/)[0]) > 212);
}
