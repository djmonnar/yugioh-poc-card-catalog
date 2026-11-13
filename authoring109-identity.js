import {GAME_IDENTITY103,gameIdentityMatches103} from './authoring103-identity.js?v=20261111-103';

export const GAME_IDENTITY109 = Object.freeze({
  ...GAME_IDENTITY103,
  catalog108_sha256:'6b7f27242d1fa44afad6f813d1e2c522667aebc7b3fbd434743a3a626bfb851d',
  native_manifest108_sha256:'1d1897369e99d69176e88a9346e983c2891204541937efb0896a94291d7b14a6',
  catalog109_sha256:'6a78f0f22d75a5b3f320e27e02f5bddaf985523abf3caf612f4c35eff8d4db63',
  native_manifest109_sha256:'de62e5458e584be8287044497b44f5e9c85a5a5d1174f570381e7a25dfe64281'
});

export function gameIdentityMatches109(identity){
  if(gameIdentityMatches103(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===Object.keys(GAME_IDENTITY109).length&&
    Object.entries(GAME_IDENTITY109).every(([key,value])=>identity[key]===value);
}
