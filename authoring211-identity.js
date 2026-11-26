import {GAME_IDENTITY210, gameIdentityAccepts210} from './authoring210-identity.js?v=20261126-spirit-shinobird210';

export const CONTENT_PROFILE211 = Object.freeze({schema: 1, card_set: 'destruction-dinosaur-dark-magician211'});
export const GAME_IDENTITY211 = Object.freeze({...GAME_IDENTITY210, ...{
  "catalog211_sha256": "91534cafe087027bbf092b4b2cbc5166f9f583259a52a486841e2996a0d627df",
  "native_manifest211_sha256": "db8a4541a8db2d3b867b8f49f56b4b75187f25b29aa72f4acd9c71f3af69adfe"
}});

export function gameIdentityAccepts211(identity) {
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.hasOwn(identity, 'catalog211_sha256') && !Object.hasOwn(identity, 'native_manifest211_sha256'))
    return gameIdentityAccepts210(identity);
  if (!Object.entries(GAME_IDENTITY211).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY211, key));
  return extra.every(key => /^(catalog|native_manifest)\d{3}_sha256$/.test(key) &&
    typeof identity[key] === 'string' && /^[a-f0-9]{64}$/.test(identity[key]) && Number(key.match(/\d{3}/)[0]) > 211);
}
