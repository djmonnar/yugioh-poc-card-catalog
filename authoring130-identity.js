import {GAME_IDENTITY126,gameIdentityMatches126} from './authoring126-identity.js?v=20261115-exodia-trap-monsters';

export const CONTENT_PROFILE130 = Object.freeze({"schema":1,"card_set":"roid-vehicles130"});
export const GAME_IDENTITY130 = Object.freeze({...GAME_IDENTITY126,...{
  "catalog130_sha256": "300b0599edb7b93a13282a971815ae532d75d21c9907b99e6ccea7632df54ce5",
  "native_manifest130_sha256": "6da4025425c19a32419130f33eb4baeb6d6b82aeb2d5c41c21c066843f94db6d"
}});

export function gameIdentityMatches130(identity) {
  if (gameIdentityMatches126(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY130).length &&
    Object.entries(GAME_IDENTITY130).every(([key,value]) => identity[key] === value);
}
