import {GAME_IDENTITY093,gameIdentityMatches093} from './authoring093-identity.js?v=20261106-093';

export const GAME_IDENTITY099=Object.freeze({
  ...GAME_IDENTITY093,
  catalog099_sha256:'609da6b03f9e6c06aaa70f7f4bc07a9d8440d8bb59fe7f2853783a5b39ecf7b2',
  native_manifest099_sha256:'6254f489441e81150fa082b38b0735d1d07f3b02b3968c8ec387596d62a40e4f'
});
export function gameIdentityMatches099(identity){
  if(gameIdentityMatches093(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===21&&Object.entries(GAME_IDENTITY099).every(([key,value])=>identity[key]===value);
}
