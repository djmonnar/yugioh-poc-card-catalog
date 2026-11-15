import {GAME_IDENTITY125,gameIdentityMatches125} from './authoring125-identity.js?v=20261115-alien-reptiles';

export const CONTENT_PROFILE126 = Object.freeze({"schema":1,"card_set":"trap-monsters126"});
export const GAME_IDENTITY126 = Object.freeze({
  ...GAME_IDENTITY125,
  ...{
  "catalog126_sha256": "13c192eebcaf8a76270ace83348812ba10f086b7b83f60fcba0bafc4adc440ec",
  "native_manifest126_sha256": "de2dcb31ca70da6ab46cec1955e8ccc1e6d9a8a285ae6a9837235309a6757823"
}
});

export function gameIdentityMatches126(identity) {
  if (gameIdentityMatches125(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY126).length &&
    Object.entries(GAME_IDENTITY126).every(([key,value]) => identity[key] === value);
}
