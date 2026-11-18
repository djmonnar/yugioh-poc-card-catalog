import {cardMetadata152} from './authoring152-catalog.js?v=20261117-ritual-dark-magician';

const entries = {
  "3039": [
    "3943653b79485c8980beda62e7f0f819e761941ac5609653c6d65f058d5c1d9e",
    [
      "DDR",
      "D·D·R",
      "D.D.R. - Different Dimension Reincarnation"
    ],
    null,
    3
  ],
  "3040": [
    "abfe20f3f16d2ae16639e6c52f64e7c1922320eee638492a1b4f5a07bcdeaa42",
    [
      "매크로코스모스",
      "매크로 코스모스",
      "Macro Cosmos"
    ],
    null,
    3
  ],
  "3041": [
    "5e1cad5f7f50e912e1027cc6916241b80b0527d3cc429774cf462a67401a12cf",
    [
      "원시태양 헬리오스",
      "Helios - The Primordial Sun"
    ],
    null,
    3
  ],
  "3042": [
    "679c0491f59fd33ed906a7f44e5eab2a6533e69fb51cb4dd6b479dfa468257c5",
    [
      "차원의틈",
      "차원의 틈",
      "Dimensional Fissure"
    ],
    null,
    3
  ],
  "3043": [
    "13d42144090a62b7dace59c4e086ed4282b4582c93bbbd9d2760cdae8c62004b",
    [
      "사 제왕 가이우스",
      "Caius the Shadow Monarch"
    ],
    null,
    3
  ],
  "3044": [
    "9abf0302f3e0802869d1a01fef0480e38279990f5a233193d609f8a147e6bd1b",
    [
      "배틀페이더",
      "배틀 페이더",
      "Battle Fader"
    ],
    null,
    3
  ],
  "3045": [
    "21e61f074467db6cef2ab853eb76a2da7bde4671b0561cebf98770b28e2d8065",
    [
      "어둠의환영",
      "어둠의 환영",
      "Dark Illusion"
    ],
    null,
    3
  ],
  "3046": [
    "2118635a17a2116fb53e4cc7a5b7976fd0adda2243683fdfd26c8a23abc6e068",
    [
      "필드배리어",
      "필드 베리어",
      "Field Barrier"
    ],
    null,
    3
  ],
  "3047": [
    "aa0a735fde404a8c6f46f7eefb16cff614e5df7b8f5b92e0cf1e434f0843e5f1",
    [
      "다크존",
      "다크 존",
      "Mystic Plasma Zone"
    ],
    null,
    3
  ],
  "3048": [
    "8ede66cf91810f4536c30e7a1172faf73481494dbf57f6f41988dabc09d7f3d3",
    [
      "견습마녀",
      "견습 마녀",
      "Witch's Apprentice"
    ],
    null,
    3
  ],
  "3049": [
    "5362ef3bd85c7a82c41abe8c48ed945087cf8bd682665d2c9e875c50baf55c4d",
    [
      "다크 크루세이더",
      "Dark Crusader"
    ],
    null,
    3
  ],
  "3050": [
    "baf4a15a1f6f258476546dcb1eb70f948fa36f1956906ee6eb300eec23627d61",
    [
      "저승사자 고즈",
      "Gorz the Emissary of Darkness"
    ],
    null,
    3
  ],
  "3051": [
    "ee30f34d7e2dcda7cdc06eeba63bee251b7993e46f82f536fda83342a6fe344e",
    [
      "전갈-가시의미네",
      "전갈－가시의 미네",
      "Dark Scorpion - Meanae the Thorn"
    ],
    null,
    3
  ],
  "3052": [
    "694fc6322d0242093c619cba762a8cd05dbe85c91a04c465dd553800b86d5919",
    [
      "전갈-도주하는치크",
      "전갈－도주하는 치크",
      "Dark Scorpion - Chick the Yellow"
    ],
    null,
    3
  ],
  "3053": [
    "1f8dfab629edc362b45d6313704e08c2d2b56de1e65eb283877fc459d4e2643c",
    [
      "전갈-함정해제의클리프",
      "전갈－함정 해제의 클리프",
      "Dark Scorpion - Cliff the Trap Remover"
    ],
    null,
    3
  ],
  "3054": [
    "8534797f9ed8446de22d756479611fe03f7cc3ebdc5f94c28d9030e5cffb1746",
    [
      "전갈－강력한 고그",
      "Dark Scorpion - Gorg the Strong"
    ],
    null,
    3
  ],
  "3055": [
    "b1d3d36bac7ee08ed7e173490b12186a74b797cebddc2c55ffba6e77f720c2a5",
    [
      "전갈 도굴단",
      "Dark Scorpion Burglars"
    ],
    null,
    3
  ],
  "3056": [
    "227b3fe2da761ff363993304d93403c50e185bb9c312d97546ce2ae08e328709",
    [
      "전갈단소집",
      "전갈단 소집",
      "Mustering of the Dark Scorpions"
    ],
    null,
    3
  ],
  "3057": [
    "146aaaf2744fc0516cd3cd09631e0ff296d50f129ae43d505ed4882eeb3da2d3",
    [
      "불사무사",
      "The Immortal Bushi"
    ],
    null,
    3
  ],
  "3058": [
    "6bf6ef48406d7ea1c87947c73e4c1c98ce30f2aa6b1d3136a7cf73d5be866189",
    [
      "저승사자 카이엔 토큰",
      "Emissary of Darkness Token"
    ],
    null,
    0
  ]
};

export function cardMetadata161(sourceId, identityKey) {
  const entry = Object.hasOwn(entries, sourceId) ? entries[sourceId] : null;
  if (entry && entry[0] === identityKey)
    return {image: 'assets/native161/cards/' + sourceId + '.jpg', searchAliases: entry[1],
      ...(entry[2] != null ? {maximumSpeedLimit: entry[2]} : {}), ...(entry[3] < 3 ? {maximumNormalLimit: entry[3]} : {})};
  return cardMetadata152(sourceId, identityKey);
}
