import {GAME_IDENTITY197, gameIdentityMatches197} from './authoring197-identity.js?v=20261123-thunder-hand197';

export const CONTENT_PROFILE199 = Object.freeze({"schema":1,"card_set":"vampire-snowman-hero199"});
export const GAME_IDENTITY199 = Object.freeze({...GAME_IDENTITY197, ...{
  "catalog199_sha256": "196c01f381104bcc7291cc717aadf38b7e7ab1eaece5f71a19aa533dea88c350",
  "native_manifest199_sha256": "f1e8eb3acdddb2703f4cb9460ecd89b247040da07baae6337e478a6dac42e52b"
}});

export function gameIdentityMatches199(identity) {
  if (gameIdentityMatches197(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY199).length &&
    Object.entries(GAME_IDENTITY199).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 199까지의 정체성이 모두 같고, 더해진 키가 199보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts199(identity) {
  if (gameIdentityMatches199(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY199).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY199, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 199);
}
