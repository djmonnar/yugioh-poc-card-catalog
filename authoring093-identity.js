import {GAME_IDENTITY090,gameIdentityMatches090} from './authoring090-identity.js?v=20261106-090';

export const GAME_IDENTITY093=Object.freeze({
  ...GAME_IDENTITY090,
  catalog093_sha256:'19927f9be93fad049ed906295171d2dabdf586a133c61005a2ca336737fa3728',
  native_manifest093_sha256:'949287ed1bbe9332d2d976bf1fafa3fce9bca2f5b4bf9aba4561cdab40ac88d3'
});
export function gameIdentityMatches093(identity){
  if(gameIdentityMatches090(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===19&&Object.entries(GAME_IDENTITY093).every(([key,value])=>identity[key]===value);
}
