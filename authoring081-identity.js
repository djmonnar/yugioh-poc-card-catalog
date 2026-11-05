import {GAME_IDENTITY067,gameIdentityMatches067} from './authoring067-identity.js?v=20261102-067';

// Keep every complete earlier publication readable. The new pair is admitted
// only together, with the exact published append-only081 catalog and Lua pins.
export const GAME_IDENTITY081=Object.freeze({
  ...GAME_IDENTITY067,
  catalog081_sha256:'ce7e14c2e03bd6a21b1d49017934551692212218dcaff30d8df5e37af46d89c2',
  native_manifest081_sha256:'e26075f96a5792d14e8f37831eae45fd38ab4cdd8bdeb2966d45dc2e89cce096'
});
export function gameIdentityMatches081(identity){
  if(gameIdentityMatches067(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===11&&Object.entries(GAME_IDENTITY081).every(([key,value])=>identity[key]===value);
}
