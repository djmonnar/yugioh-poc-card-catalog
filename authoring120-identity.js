import {GAME_IDENTITY109,gameIdentityMatches109} from './authoring109-identity.js?v=20261114-109';

export const GAME_IDENTITY120 = Object.freeze({
  ...GAME_IDENTITY109,
  catalog120_sha256:'c19e75045e44b9a6951a87aaef99b622097a32c0b5b9de8c2c9ad3c82af1f70d',
  native_manifest120_sha256:'138d24b74625d25b69c563be5a7837fb1ee0d09be0822cbb19268203cb0f75f5'
});

export function gameIdentityMatches120(identity){
  if(gameIdentityMatches109(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===Object.keys(GAME_IDENTITY120).length&&
    Object.entries(GAME_IDENTITY120).every(([key,value])=>identity[key]===value);
}
