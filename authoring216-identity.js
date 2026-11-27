import {GAME_IDENTITY212, gameIdentityAccepts212} from './authoring212-identity.js?v=20261126-sphinx-volcanic-monarch212';

export const CONTENT_PROFILE216 = Object.freeze({schema: 1, card_set: 'spirit-fire-fist216'});
export const GAME_IDENTITY216 = Object.freeze({...GAME_IDENTITY212,...{
  "catalog216_sha256": "e1df13ad4d8ac1f5c2b1287e1f115730a0004b856e52201a342674a8ad978b8e",
  "native_manifest216_sha256": "547c6b540099c903399785c7b7ea054820404b514289c712622733e63d5efc5e"
}});

export function gameIdentityAccepts216(identity) {
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.hasOwn(identity, 'catalog216_sha256') && !Object.hasOwn(identity, 'native_manifest216_sha256'))
    return gameIdentityAccepts212(identity);
  if (!Object.entries(GAME_IDENTITY216).every(([key,value]) => identity[key] === value)) return false;
  return Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY216,key)).every(key =>
    /^(catalog|native_manifest)\d{3}_sha256$/.test(key) &&
    typeof identity[key] === 'string' && /^[a-f0-9]{64}$/.test(identity[key]) && Number(key.match(/\d{3}/)[0]) > 216);
}
