import {GAME_IDENTITY081,gameIdentityMatches081} from './authoring081-identity.js?v=20261105-082';

export const GAME_IDENTITY084=Object.freeze({
  ...GAME_IDENTITY081,
  catalog084_sha256:'4f4bd0782acc1719ccf901dd44e2b14d4873486640b1af0307e2427be8e9b9ea',
  native_manifest084_sha256:'f127b7190c0ae9974271e4f26402f5e3d5ba2cf8d187a84a5924a20804b9425f'
});
export function gameIdentityMatches084(identity){
  if(gameIdentityMatches081(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===13&&Object.entries(GAME_IDENTITY084).every(([key,value])=>identity[key]===value);
}
