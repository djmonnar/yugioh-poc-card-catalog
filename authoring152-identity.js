import {GAME_IDENTITY144, gameIdentityMatches144} from './authoring144-identity.js?v=20261117-insects';

export const CONTENT_PROFILE152 = Object.freeze({"schema":1,"card_set":"ritual-dark-magician152"});
export const GAME_IDENTITY152 = Object.freeze({...GAME_IDENTITY144, ...{
  "catalog152_sha256": "8e60870824e82362f7c35e11ceb144d268e28e5ede936121826998fd7600b08b",
  "native_manifest152_sha256": "1deb79ff2ec9a1c340864c4fa1190d90f33527f7c2bd9f30336e1f83f525cc6b"
}});

export function gameIdentityMatches152(identity) {
  if (gameIdentityMatches144(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY152).length &&
    Object.entries(GAME_IDENTITY152).every(([key, value]) => identity[key] === value);
}
