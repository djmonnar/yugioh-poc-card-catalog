import {GAME_IDENTITY207, gameIdentityAccepts207} from './authoring207-identity.js?v=20261126-dragunity-stance-dinosaur207';

export const CONTENT_PROFILE210 = Object.freeze({schema: 1, card_set: 'spirit-shinobird210'});
export const GAME_IDENTITY210 = Object.freeze({...GAME_IDENTITY207, ...{
  "catalog210_sha256": "49f1270f7c893ceb10707ea5723d40b85e3ca3a986a8b9152c5866b505b6214c",
  "native_manifest210_sha256": "c5b55a7d85908e53700fe65d4c27e08f584bbf4e9269a490355efac889bd3253"
}});

export function gameIdentityAccepts210(identity) {
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.hasOwn(identity, 'catalog210_sha256') && !Object.hasOwn(identity, 'native_manifest210_sha256'))
    return gameIdentityAccepts207(identity);
  if (!Object.entries(GAME_IDENTITY210).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY210, key));
  return extra.every(key => /^(catalog|native_manifest)\d{3}_sha256$/.test(key) &&
    typeof identity[key] === 'string' && /^[a-f0-9]{64}$/.test(identity[key]) && Number(key.match(/\d{3}/)[0]) > 210);
}
