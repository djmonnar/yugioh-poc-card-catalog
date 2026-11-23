import {GAME_IDENTITY196, gameIdentityMatches196} from './authoring196-identity.js?v=20261123-union-hero196';

export const CONTENT_PROFILE197 = Object.freeze({"schema":1,"card_set":"thunder-dragon-hand197"});
export const GAME_IDENTITY197 = Object.freeze({...GAME_IDENTITY196, ...{
  "catalog197_sha256": "d44a7ee2317ab76feec6edd049d0fa7b17bebc0c0e7f71c9741ea34aabb05afd",
  "native_manifest197_sha256": "91abffda3e93dfa06b6402edaf0788ec86be84e6a6ae2f936f2b0d06cb4aabac"
}});

export function gameIdentityMatches197(identity) {
  if (gameIdentityMatches196(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY197).length &&
    Object.entries(GAME_IDENTITY197).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 197까지의 정체성이 모두 같고, 더해진 키가 197보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 197 키가 있는데 값이 다르면(위조·다른 빌드) 받지 않는다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts197(identity) {
  if (gameIdentityMatches197(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY197).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY197, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 197);
}
