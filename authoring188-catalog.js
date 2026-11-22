import {cardMetadata183} from './authoring183-catalog.js?v=20261121-manjoume183';

const entries = {
  "3190": [
    "37f9df2854c4d6078750c67645f66e1ac605a604bf6cb7d51c5393aa44b12864",
    [
      "극화염의 검사",
      "Ultimate Flame Swordsman"
    ],
    null,
    3
  ],
  "3191": [
    "16fa97a11ac6b1c916469ddcd3bbea2c82e0d481b847ab2dbcfcc715a4fe8509",
    [
      "투의염참룡",
      "Fighting Flame Dragon"
    ],
    null,
    3
  ],
  "3192": [
    "216e0e42f12a4393212ca3e55a5c948d852278881855570ca643620b7094a652",
    [
      "환화염의 검사-미라지 스워드맨-",
      "환화염의 검사－미라지 스워드맨－",
      "Mirage Swordsman"
    ],
    null,
    3
  ],
  "3193": [
    "a9414a0bdff1e8322afac4cb50afec388dc79f971f9b33a80f34a02cdbb2f618",
    [
      "흑화염의 검사－블랙 플레어 스워드맨－",
      "Dark Flare Swordsman"
    ],
    null,
    3
  ],
  "3194": [
    "ac6ba7bac046e814ed03d245fbeb69a2e7d1bb1e83708be9128a5528b53baad1",
    [
      "비룡염 사라만도라",
      "Salamandra, the Flying Flame Dragon"
    ],
    null,
    3
  ],
  "3195": [
    "03d27a32a00dfb3bf02f92ea57b4426cf836dcd4bdd9094a9a7a24111df312b8",
    [
      "화염의 검무",
      "Flame Swordsdance"
    ],
    null,
    3
  ],
  "3196": [
    "3f4d58d2c9fb4989c04cc1bead307c96915f44809de8af62dcd797fd015769ba",
    [
      "투의염참검",
      "Fighting Flame Sword"
    ],
    null,
    3
  ],
  "3197": [
    "129f21f5c12fb4af680f92bdb2d08f5f2e5816a13b17500187f8fff6d45ea3c4",
    [
      "화염의 검역",
      "Flame Swordsrealm"
    ],
    null,
    3
  ],
  "3198": [
    "95553e6ac8772d948c8276eb431e280232cb22bd4dd6747f7822383ab539a336",
    [
      "사라만도라 퓨전",
      "Salamandra Fusion"
    ],
    null,
    3
  ],
  "3199": [
    "1e16b2b8eedd82a13fc06320a8f9522ef5b09083321a39a03c4cce73d3c48ffd",
    [
      "쇠사슬 사라만도라",
      "Salamandra with Chain"
    ],
    null,
    3
  ],
  "3200": [
    "269d5de7dc0ec9df47706d3949c07cfad81250f5a997b418c54af51fddfe4b51",
    [
      "암흑 마계의 전사장 다크 스워드",
      "Dark Blade the Captain of the Evil World"
    ],
    null,
    3
  ],
  "3201": [
    "a86b0f5dcd6310db7909168bba1add995ed9b6341d77f12ce8961d01dfe38545",
    [
      "암흑 마계의 용기사 다크 스워드",
      "Dark Blade the Dragon Knight"
    ],
    null,
    3
  ],
  "3202": [
    "680f4651594d0873ed7e0a12deb63eaeebc520f4b36ec1b232271e145d73cb7a",
    [
      "레어골드 아머",
      "Raregold Armor"
    ],
    null,
    3
  ],
  "3203": [
    "1b5fc80ef4a196cd73b247e4a712be5ada58888e6bc8f159519b80afb4309f2f",
    [
      "메탈실버 아머",
      "Metalsilver Armor"
    ],
    null,
    3
  ],
  "3204": [
    "446bf7416bd2978511fffddb324ac080cd3c6e223b0f1975671f69a19f2087e2",
    [
      "기사용",
      "Kiryu"
    ],
    null,
    3
  ],
  "3205": [
    "cd670760aa0f89457d78d03086616cdfffce5045ee97b916c37257475421f5d1",
    [
      "칠흑의 전투용",
      "Pitch-Dark Dragon"
    ],
    null,
    3
  ],
  "3206": [
    "c1e7ed38015f0ecb5e2a79a3069d39f320f4928e71cf8b2c7dea62d6e6ab0232",
    [
      "투화염의 검사",
      "Fighting Flame Swordsman"
    ],
    null,
    3
  ],
  "3207": [
    "b74aebc8964374a16e5f6083e1937584cc303aab4085137a7f5124f8d7ac8d7a",
    [
      "벌키리 나이트",
      "Valkyrian Knight"
    ],
    null,
    3
  ]
};

export function cardMetadata188(sourceId, identityKey) {
  const entry = Object.hasOwn(entries, sourceId) ? entries[sourceId] : null;
  if (entry && entry[0] === identityKey)
    return {image: 'assets/native188/cards/' + sourceId + '.jpg', searchAliases: entry[1],
      ...(entry[2] != null ? {maximumSpeedLimit: entry[2]} : {}), ...(entry[3] < 3 ? {maximumNormalLimit: entry[3]} : {})};
  return cardMetadata183(sourceId, identityKey);
}
