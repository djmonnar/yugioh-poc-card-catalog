import {GAME_IDENTITY122,gameIdentityMatches122} from './authoring122-identity.js?v=20261115-flip-cards';

export const CONTENT_PROFILE125 = Object.freeze({"schema":1,"card_set":"alien-counters125"});
export const GAME_IDENTITY125 = Object.freeze({
  ...GAME_IDENTITY122,
  catalog125_sha256:'aa177f0d0a307cf48fe803e940b66c75fbbccea55cda73964716228b21f15a43',
  native_manifest125_sha256:'0b3ac9971d246e7b9d592e44909c67d0229c6c4126c2a255a0ebe148551efab6'
});

export function gameIdentityMatches125(identity) {
  if (gameIdentityMatches122(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY125).length &&
    Object.entries(GAME_IDENTITY125).every(([key,value]) => identity[key] === value);
}
