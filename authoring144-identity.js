import {GAME_IDENTITY143, gameIdentityMatches143} from './authoring143-identity.js?v=20261116-atlantean-fusion-spells';

export const CONTENT_PROFILE144 = Object.freeze({"schema":1,"card_set":"insects144"});
export const GAME_IDENTITY144 = Object.freeze({...GAME_IDENTITY143, ...{
  "catalog144_sha256": "933e59c4ba60106d9b5967939f5bc938e22ea9fd6e98503c0a0a8eca3c414783",
  "native_manifest144_sha256": "e79d20d9e52abd4d4af7c6d95ece23487c066657cb08085e52c4ae120cae27dc"
}});

export function gameIdentityMatches144(identity) {
  if (gameIdentityMatches143(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY144).length &&
    Object.entries(GAME_IDENTITY144).every(([key, value]) => identity[key] === value);
}
