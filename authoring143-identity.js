import {GAME_IDENTITY136, gameIdentityMatches136} from './authoring136-identity.js?v=20261116-predaplant-meteor';

export const CONTENT_PROFILE143 = Object.freeze({"schema":1,"card_set":"atlantean-fusion-spells143"});
export const GAME_IDENTITY143 = Object.freeze({...GAME_IDENTITY136, ...{
  "catalog143_sha256": "ea4e67b55e9a11888fa5d8d44b3008a9b9b6feb3dad96f74d71a744f07698b02",
  "native_manifest143_sha256": "cb7da8f34820858e9469113509458421ffd1c8182a20720ef1b270053da5fa30"
}});

export function gameIdentityMatches143(identity) {
  if (gameIdentityMatches136(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY143).length &&
    Object.entries(GAME_IDENTITY143).every(([key, value]) => identity[key] === value);
}
