import {GAME_IDENTITY152, gameIdentityMatches152} from './authoring152-identity.js?v=20261117-ritual-dark-magician';

export const CONTENT_PROFILE161 = Object.freeze({"schema":1,"card_set":"dark-scorpion161"});
export const GAME_IDENTITY161 = Object.freeze({...GAME_IDENTITY152, ...{
  "catalog161_sha256": "d2eca56bf700650f781a7398d9529d43b488adff73430bbb880c07679ce7955e",
  "native_manifest161_sha256": "94677542c1ea3eebfaef2b62121b0a82dad2180e9a89b85a20e3267d3ffebd3f"
}});

export function gameIdentityMatches161(identity) {
  if (gameIdentityMatches152(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY161).length &&
    Object.entries(GAME_IDENTITY161).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 161까지의 정체성이 모두 같고, 더해진 키가 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 이 번들이 모르는 카드는 공개 응답의 값(그림 경로, 검색 별칭, 토큰 여부)을 그대로 쓴다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts161(identity) {
  if (gameIdentityMatches161(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY161).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY161, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 161);
}
