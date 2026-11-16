import {GAME_IDENTITY135,gameIdentityMatches135} from './authoring135-identity.js?v=20261116-dinosaur-allure';

export const CONTENT_PROFILE136 = Object.freeze({"schema":1,"card_set":"predaplant-fusion-meteor136"});
export const GAME_IDENTITY136 = Object.freeze({...GAME_IDENTITY135,...{
  "catalog136_sha256": "3737d7a39b7febb9bafe96cf03e1eafa01203988634c7386ca3f7f0ffef77e58",
  "native_manifest136_sha256": "ca12c42a4603b2759cbab54c72023254ff9aaba71fd63079108dac29a9e00ef3"
}});

export function gameIdentityMatches136(identity) {
  if (gameIdentityMatches135(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY136).length &&
    Object.entries(GAME_IDENTITY136).every(([key,value]) => identity[key] === value);
}
