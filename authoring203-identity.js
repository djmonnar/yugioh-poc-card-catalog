import {GAME_IDENTITY202, gameIdentityMatches202} from './authoring202-identity.js?v=20261125-six-samurai-gate-guardian202';

export const CONTENT_PROFILE203 = Object.freeze({"schema":1,"card_set":"amazoness-harpie-misawa203"});
export const GAME_IDENTITY203 = Object.freeze({...GAME_IDENTITY202, ...{
  "catalog203_sha256": "3c11e23e07c535f8746eca12af5ebcf25d27ed47aa5f6229add5789dcf5b3e80",
  "native_manifest203_sha256": "121f7e41964b5567ca141d03bbedc675043b8cdb9c141739e4d35ed98aaffbc8"
}});

export function gameIdentityMatches203(identity) {
  if (gameIdentityMatches202(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY203).length &&
    Object.entries(GAME_IDENTITY203).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 203까지의 정체성이 모두 같고, 더해진 키가 203보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts203(identity) {
  if (gameIdentityMatches203(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY203).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY203, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 203);
}
