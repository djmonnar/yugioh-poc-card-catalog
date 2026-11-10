import {GAME_IDENTITY099,gameIdentityMatches099} from './authoring099-identity.js?v=20261109-099';

export const GAME_IDENTITY103=Object.freeze({
  ...GAME_IDENTITY099,
  catalog103_sha256:'c053c5f5cad8103e0a2ce8dc39ee17ec79cbf0eefc8dee9bca4735df013fae31',
  native_manifest103_sha256:'a132ebb12a578bf6908b82b25cf0cad839a0df603d5b185d2cd83a9c0a2aab42'
});
export function gameIdentityMatches103(identity){
  if(gameIdentityMatches099(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===23&&Object.entries(GAME_IDENTITY103).every(([key,value])=>identity[key]===value);
}
