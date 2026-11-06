import {GAME_IDENTITY088,gameIdentityMatches088} from './authoring088-identity.js?v=20261105-088';

export const GAME_IDENTITY090=Object.freeze({
  ...GAME_IDENTITY088,
  catalog090_sha256:'e0b4aaab3acf5e7fd119ef9ab484dea5b26d5a17bac8c8ca56db56d82fa86503',
  native_manifest090_sha256:'6f78ba0733c6bd2c60857f41411ce381629814674bb70807b271cf0692c0603e'
});
export function gameIdentityMatches090(identity){
  if(gameIdentityMatches088(identity))return true;
  return identity!==null&&typeof identity==='object'&&!Array.isArray(identity)&&
    Object.keys(identity).length===17&&Object.entries(GAME_IDENTITY090).every(([key,value])=>identity[key]===value);
}
