import {GAME_IDENTITY120,gameIdentityMatches120} from './authoring120-identity.js?v=20261115-120';

export const GAME_IDENTITY122 = Object.freeze({
  ...GAME_IDENTITY120,
  catalog122_sha256:'f66b986b47d2f531e1c32adc812cc9cb647d7493176c13fae51e6541996a8660',
  native_manifest122_sha256:'bd456c81f79aba3407a9a31f7b9cc14981106f965825715f8c9649289c224a45'
});

export function gameIdentityMatches122(identity) {
  if (gameIdentityMatches120(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY122).length &&
    Object.entries(GAME_IDENTITY122).every(([key,value]) => identity[key] === value);
}
