import {GAME_IDENTITY130,gameIdentityMatches130} from './authoring130-identity.js?v=20261115-roid-vehicles';

export const CONTENT_PROFILE135 = Object.freeze({"schema":1,"card_set":"dinosaur-paleozoic-allure135"});
export const GAME_IDENTITY135 = Object.freeze({...GAME_IDENTITY130,...{
  "catalog135_sha256": "f80948838d5bd3ec00da5301797f7cc6885413b1190308904bf63449b64d9765",
  "native_manifest135_sha256": "e1cda2ba86500d355fd5a21818fa39765f2f7ede337e8106fe1d4c6b735fa6ab"
}});

export function gameIdentityMatches135(identity) {
  if (gameIdentityMatches130(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY135).length &&
    Object.entries(GAME_IDENTITY135).every(([key,value]) => identity[key] === value);
}
