import {GAME_IDENTITY203, gameIdentityMatches203} from './authoring203-identity.js?v=20261125-amazoness-harpie-misawa203';

export const CONTENT_PROFILE207 = Object.freeze({"schema":1,"card_set":"dragunity-stance-dinosaur207"});
export const GAME_IDENTITY207 = Object.freeze({...GAME_IDENTITY203, ...{
  "catalog207_sha256": "081ed698000a6d95e46857c26e6bdce7d049d747a41f2669d270be33f08abf57",
  "native_manifest207_sha256": "53a925dd0b1169882b8474921632013a84560319786ce3473f59f35e7e579c3d"
}});

export function gameIdentityMatches207(identity) {
  if (gameIdentityMatches203(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY207).length &&
    Object.entries(GAME_IDENTITY207).every(([key, value]) => identity[key] === value);
}

const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts207(identity) {
  if (gameIdentityMatches207(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity) ||
      !Object.entries(GAME_IDENTITY207).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY207, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 207);
}
