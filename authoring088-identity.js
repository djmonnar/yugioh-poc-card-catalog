import {GAME_IDENTITY084,gameIdentityMatches084} from './authoring084-identity.js?v=20261105-084';

export const GAME_IDENTITY088=Object.freeze({
  ...GAME_IDENTITY084,
  catalog088_sha256:'7ace93ecf2dc3133ebb7e16f4ff647242086b21c010e98004d8ad886caf1e1af',
  native_manifest088_sha256:'a5a3a1d409628f30c71a26c9574a1442cb2d1cd0c1999a9006c0ebb81fafd585'
});
export function gameIdentityMatches088(identity){
  if(gameIdentityMatches084(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===15&&Object.entries(GAME_IDENTITY088).every(([key,value])=>identity[key]===value);
}
