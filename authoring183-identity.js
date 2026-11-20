import {GAME_IDENTITY175, gameIdentityMatches175} from './authoring175-identity.js?v=20261120-chess-archfiend175';

export const CONTENT_PROFILE183 = Object.freeze({"schema":1,"card_set":"manjoume183"});
export const GAME_IDENTITY183 = Object.freeze({...GAME_IDENTITY175, ...{
  "catalog183_sha256": "8a5f24a40dec9a76b2f436c210c1185371530dae4b782231500156f43f5f0a2b",
  "native_manifest183_sha256": "d997d549eda213d18818e1b9a7e3f4905d722c8e075e3897cedfd5d79888a8e7"
}});

export function gameIdentityMatches183(identity) {
  if (gameIdentityMatches175(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY183).length &&
    Object.entries(GAME_IDENTITY183).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 183까지의 정체성이 모두 같고, 더해진 키가 183보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 183 키가 있는데 값이 다르면(위조·다른 빌드) 받지 않는다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts183(identity) {
  if (gameIdentityMatches183(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY183).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY183, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 183);
}
