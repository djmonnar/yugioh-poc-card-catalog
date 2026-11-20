import {GAME_IDENTITY165, gameIdentityMatches165} from './authoring165-identity.js?v=20261119-dark-magician-horus165';

export const CONTENT_PROFILE174 = Object.freeze({"schema":1,"card_set":"archfiend-hero-silent174"});
export const GAME_IDENTITY174 = Object.freeze({...GAME_IDENTITY165, ...{
  "catalog174_sha256": "af59f00b9918575359cb23a65de31a591a509ff41e9ba03c1ac3510fdb1d15c5",
  "native_manifest174_sha256": "ec592b3e28d3995877066e1ec4b4ecabe8d7c0acd2b191bbbb7d277847e96b4e"
}});

export function gameIdentityMatches174(identity) {
  if (gameIdentityMatches165(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY174).length &&
    Object.entries(GAME_IDENTITY174).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 174까지의 정체성이 모두 같고, 더해진 키가 174보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 174 키가 있는데 값이 다르면(위조·다른 빌드) 받지 않는다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts174(identity) {
  if (gameIdentityMatches174(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY174).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY174, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 174);
}
