import {GAME_IDENTITY216, gameIdentityAccepts216} from './authoring216-identity.js?v=20261127-spirit-fire-fist216';

export const CONTENT_PROFILE226 = Object.freeze({schema: 1, card_set: 'lightray-ra226'});
export const GAME_IDENTITY226 = Object.freeze({...GAME_IDENTITY216,...{
  "catalog226_sha256": "3d1aca3e2d230d02032d9df2d8f08b1b3911a50e79431c80bd6c392fa8a1a675",
  "native_manifest226_sha256": "3dd6e6a1f58587d2e962575e4eb391af6e888383740a95026d5b6699883f0c7a"
}});

export function gameIdentityAccepts226(identity) {
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.hasOwn(identity, 'catalog226_sha256') && !Object.hasOwn(identity, 'native_manifest226_sha256'))
    return gameIdentityAccepts216(identity);
  if (!Object.entries(GAME_IDENTITY226).every(([key,value]) => identity[key] === value)) return false;
  return Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY226,key)).every(key =>
    /^(catalog|native_manifest)\d{3}_sha256$/.test(key) &&
    typeof identity[key] === 'string' && /^[a-f0-9]{64}$/.test(identity[key]) && Number(key.match(/\d{3}/)[0]) > 226);
}
