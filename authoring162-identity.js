import {GAME_IDENTITY161, gameIdentityMatches161} from './authoring161-identity.js?v=20261119-dark-scorpion161';

export const CONTENT_PROFILE162 = Object.freeze({"schema":1,"card_set":"monarch-shark162"});
export const GAME_IDENTITY162 = Object.freeze({...GAME_IDENTITY161, ...{
  "catalog162_sha256": "b84eeef9642310763f8f38c93e0fd06ec0c6b682be15aa89b9c8bf44a76e1f75",
  "native_manifest162_sha256": "28796d7919b94988fc615d08c3af6cabe076bad3e7d1dbec403d994878dada90"
}});

export function gameIdentityMatches162(identity) {
  if (gameIdentityMatches161(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY162).length &&
    Object.entries(GAME_IDENTITY162).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 162까지의 정체성이 모두 같고, 더해진 키가 162보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 162 키가 있는데 값이 다르면(위조·다른 빌드) 받지 않는다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts162(identity) {
  if (gameIdentityMatches162(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY162).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY162, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 162);
}
