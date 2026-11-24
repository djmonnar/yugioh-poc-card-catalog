import {GAME_IDENTITY199, gameIdentityMatches199} from './authoring199-identity.js?v=20261124-vampire-snowman-hero199';

export const CONTENT_PROFILE202 = Object.freeze({"schema":1,"card_set":"six-samurai-gate-guardian202"});
export const GAME_IDENTITY202 = Object.freeze({...GAME_IDENTITY199, ...{
  "catalog202_sha256": "9a5cffd954f1c0ed166810d0a60d498b6d8f59a53316617798211e0745e94e39",
  "native_manifest202_sha256": "f9bbbeebd623b2ee551d87413676d758b890451ba0b407d3571942a952a49b2e"
}});

export function gameIdentityMatches202(identity) {
  if (gameIdentityMatches199(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY202).length &&
    Object.entries(GAME_IDENTITY202).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 202까지의 정체성이 모두 같고, 더해진 키가 202보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts202(identity) {
  if (gameIdentityMatches202(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY202).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY202, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 202);
}
