import {GAME_IDENTITY174, gameIdentityMatches174} from './authoring174-identity.js?v=20261120-archfiend-hero-silent174';

export const CONTENT_PROFILE175 = Object.freeze({"schema":1,"card_set":"chess-archfiend175"});
export const GAME_IDENTITY175 = Object.freeze({...GAME_IDENTITY174, ...{
  "catalog175_sha256": "d61b9f379795ad3997966332d0d6589ba9044d7e6d4bfaf6175803f5108b34bc",
  "native_manifest175_sha256": "37981c7061fa6eba85438daa10dfc644cfe7e84328b37e6d4c4bf160caf2546c"
}});

export function gameIdentityMatches175(identity) {
  if (gameIdentityMatches174(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY175).length &&
    Object.entries(GAME_IDENTITY175).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 175까지의 정체성이 모두 같고, 더해진 키가 175보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 175 키가 있는데 값이 다르면(위조·다른 빌드) 받지 않는다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts175(identity) {
  if (gameIdentityMatches175(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY175).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY175, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 175);
}
