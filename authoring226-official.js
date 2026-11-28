import {officialCardText216} from './authoring216-official.js?v=20261127-spirit-fire-fist216';

const officialIds = {
  "975299": 12976,
  "4722253": 10057,
  "4909946": 22085,
  "5121528": 22082,
  "5438492": 6457,
  "10000080": 11927,
  "12930501": 5638,
  "14148099": 6199,
  "15317640": 6591,
  "18859369": 15780,
  "22790789": 6419,
  "27770341": 5346,
  "29424328": 7146,
  "30126992": 10058,
  "38737148": 10056,
  "41044418": 15335,
  "41516133": 22083,
  "42166000": 15332,
  "44954628": 6498,
  "46508640": 7119,
  "50383626": 13683,
  "66947414": 6514,
  "67957315": 5335,
  "74875003": 11169,
  "75937826": 7678,
  "76052811": 5489,
  "77135531": 8190,
  "77432167": 15336,
  "78665705": 15333,
  "82579942": 10313,
  "82821760": 12946,
  "84257883": 14471,
  "89310929": 8121,
  "91349449": 10055
};

export function officialCardText226(code) {
  if (!Number.isSafeInteger(code) || !Object.hasOwn(officialIds,code)) return officialCardText216(code);
  return 'https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=' + officialIds[code] + '&ope=2&request_locale=ko';
}
