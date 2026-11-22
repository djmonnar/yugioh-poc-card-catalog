import {GAME_IDENTITY183, gameIdentityMatches183} from './authoring183-identity.js?v=20261121-manjoume183';

export const CONTENT_PROFILE188 = Object.freeze({"schema":1,"card_set":"flame-swordsman188"});
export const GAME_IDENTITY188 = Object.freeze({...GAME_IDENTITY183, ...{
  "catalog188_sha256": "28d46963916b1d507b750181f1480b56c5e42c788b98d742eaa38c79e33f3b11",
  "native_manifest188_sha256": "de3929b14df3af5ed6d1de974647a3df41a93f4d5cfce38c86c55121df2f0413"
}});

export function gameIdentityMatches188(identity) {
  if (gameIdentityMatches183(identity)) return true;
  return identity !== null && typeof identity === 'object' && !Array.isArray(identity) &&
    Object.keys(identity).length === Object.keys(GAME_IDENTITY188).length &&
    Object.entries(GAME_IDENTITY188).every(([key, value]) => identity[key] === value);
}

// 새 카드팩이 DB에 먼저 올라와도 제작소가 멈추지 않게 한다.
// 188까지의 정체성이 모두 같고, 더해진 키가 188보다 새 팩의 카탈로그·표시 지문(64자리 16진수)뿐이면 받아들인다.
// 188 키가 있는데 값이 다르면(위조·다른 빌드) 받지 않는다.
const NEWER_PACK_KEY = /^(catalog|native_manifest)\d{3}_sha256$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function gameIdentityAccepts188(identity) {
  if (gameIdentityMatches188(identity)) return true;
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (!Object.entries(GAME_IDENTITY188).every(([key, value]) => identity[key] === value)) return false;
  const extra = Object.keys(identity).filter(key => !Object.hasOwn(GAME_IDENTITY188, key));
  return extra.length > 0 && extra.every(key => NEWER_PACK_KEY.test(key) && typeof identity[key] === 'string' && SHA256.test(identity[key]) &&
    Number(key.match(/\d{3}/)[0]) > 188);
}
