import {GAME_IDENTITY188, gameIdentityMatches188} from './authoring188-identity.js?v=20261123-flame-swordsman188';

export const CONTENT_PROFILE196 = Object.freeze({"schema":1,"card_set":"union-hero196"});
export const GAME_IDENTITY196 = Object.freeze({...GAME_IDENTITY188, ...{
  "catalog196_sha256": "7bde2b27ed6300a41cff79faed082d53ab20420fd84e37b0c81c4f0dbbf1b6e8",
  "native_manifest196_sha256": "e7e80e1d7027de2fdfcbcaa6c071e3dc31f985af434f994175d2fa28ceb87b55"
}});

export function gameIdentityMatches196(identity) {
  if (gameIdentityMatches188(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY196).length &&
    Object.entries(GAME_IDENTITY196).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 196까지의 정체성이 모두 같고, 더해진 키가 196보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 196 키가 있는데 값이 다르면(위조·다른 빌드) 받지 않는다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts196(identity) {
  if (gameIdentityMatches196(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY196).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY196, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 196);
}
