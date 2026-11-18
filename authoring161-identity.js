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
