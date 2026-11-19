import {GAME_IDENTITY162, gameIdentityMatches162} from './authoring162-identity.js?v=20261119-monarch-shark162';

export const CONTENT_PROFILE165 = Object.freeze({"schema":1,"card_set":"dark-magician-horus165"});
export const GAME_IDENTITY165 = Object.freeze({...GAME_IDENTITY162, ...{
  "catalog165_sha256": "96f1406f2eb20c2980b7e6f6b7511ab3b6b2498e5a992185fdcbb1c5ebaed8ac",
  "native_manifest165_sha256": "491ca79dcfa4d2bc5c48626e4d8676cbbfb38ce7256f5a3a76e463a089658b7e"
}});

export function gameIdentityMatches165(identity) {
  if (gameIdentityMatches162(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY165).length &&
    Object.entries(GAME_IDENTITY165).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 165까지의 정체성이 모두 같고, 더해진 키가 165보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 165 키가 있는데 값이 다르면(위조·다른 빌드) 받지 않는다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts165(identity) {
  if (gameIdentityMatches165(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY165).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY165, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 165);
}
