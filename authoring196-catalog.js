import {cardMetadata188} from './authoring188-catalog.js?v=20261123-flame-swordsman188';

const entries = {
  "3208": [
    "ca23c55fd41e3d0144e41b86f86c6ab4ac34168a54cab0f423e94d9b87a9b7f7",
    [
      "포메이션 유니온",
      "Formation Union"
    ],
    null,
    3
  ],
  "3209": [
    "97fbe61c4693d836d5cad548d14fbcd6c8988707c3433548547771eaea2da750",
    [
      "겟 라이드!",
      "Roll Out!"
    ],
    null,
    3
  ],
  "3210": [
    "06d36f0333e0c5068b53775c801895bb2525acd94fabe9e030b7427883390144",
    [
      "전선기지",
      "Frontline Base"
    ],
    null,
    3
  ],
  "3211": [
    "6083b55461479ba70ed7564024f412d77a698716ad7ed055ebea917219169cc6",
    [
      "콤비네이션 어택",
      "Combination Attack"
    ],
    null,
    3
  ],
  "3212": [
    "a855256daf6f52cef511ef3070fb084f66147326040e2ba4dd0957a6a45bbd19",
    [
      "클리어 월드",
      "Clear World"
    ],
    null,
    3
  ],
  "3213": [
    "fd75f5a9d34fa67845bf0ac7183f9b53995fe8caa4a8dfa81f0f692b7564ec2a",
    [
      "DNA 이식 수술",
      "DNA Transplant"
    ],
    null,
    3
  ],
  "3214": [
    "ab3307dcad2df084cd26d34af325e45ad7694139280c357374996e8032614f1c",
    [
      "스파크 건",
      "Spark Blaster"
    ],
    null,
    3
  ],
  "3215": [
    "25573c31edb5e9e60c253134919a69e4029b5a1199ff35907a4ac3ae99ac1982",
    [
      "엘리멘틀 히어로 템피스터",
      "Elemental HERO Tempest"
    ],
    null,
    3
  ],
  "3216": [
    "df299032a43946381707fa839795bea0c236df92270c11157ebd0e1f40e9dc58",
    [
      "인스턴트 콘택트",
      "Instant Contact"
    ],
    null,
    3
  ],
  "3217": [
    "7cab753e77f72bb7344a6b9f432b51b37e370cf346323ba301f67de45ad96dee",
    [
      "엘리멘틀 히어로 플라즈마 바이스맨",
      "Elemental HERO Plasma Vice"
    ],
    null,
    3
  ],
  "3218": [
    "63888106d5507e4e53704f9d8cf0ee313ebfc57d226ca7e949944c56575f7c85",
    [
      "에지 해머",
      "Edge Hammer"
    ],
    null,
    3
  ],
  "3219": [
    "7da506fb121f8863ab09030747726088753ee92b2ea92ce81905cff361835054",
    [
      "엘리멘틀 히어로 와일드 쟤기맨",
      "Elemental HERO Wildedge"
    ],
    null,
    3
  ],
  "3220": [
    "1eb9ffb6a21ac3f1d5a3dc9694e919de0b6760d96aa184f1bad2d926995a735c",
    [
      "엘리멘틀 히어로 에지맨",
      "Elemental HERO Bladedge"
    ],
    null,
    3
  ],
  "3221": [
    "9e6a46f7b56013b0953bd64809aa275bc898d82ada81466f6b8bc804b3674313",
    [
      "엘리멘틀 히어로 더 히트",
      "Elemental HERO Heat"
    ],
    null,
    3
  ],
  "3222": [
    "22ad7b80ff6b617a740642551689ed45790cddfab771bcca6e3ea815638ac3e9",
    [
      "마천루－스카이스크레이퍼－",
      "Skyscraper"
    ],
    null,
    3
  ],
  "3223": [
    "89b9e2e75abee542a7bbb41b74ac5d933f927b1a36f29dbfddb279055ac2003b",
    [
      "엘리멘틀 히어로 캡틴 골드",
      "Elemental HERO Captain Gold"
    ],
    null,
    3
  ],
  "3224": [
    "ab2940f29153b8a710bae22ca5a87e8e201287456046763285c0101bbc2b6b61",
    [
      "Y－드래곤 헤드",
      "Y-Dragon Head"
    ],
    null,
    3
  ],
  "3225": [
    "074ed394ad0e40e0fcd312316805cc08dc555449198fabdb8acc37fd15c87120",
    [
      "Z－메탈 캐터필러",
      "Z-Metal Tank"
    ],
    null,
    3
  ],
  "3226": [
    "c68c52dc95264e7d09b3978ccb5360868a04daeb072f34d3f14f00262e4cdfd0",
    [
      "W－윙 캐터펄트",
      "W-Wing Catapult"
    ],
    null,
    3
  ]
};

export function cardMetadata196(sourceId, identityKey) {
  const entry = Object.hasOwn(entries, sourceId) ? entries[sourceId] : null;
  if (entry && entry[0] === identityKey)
    return {image: 'assets/native196/cards/' + sourceId + '.jpg', searchAliases: entry[1],
      ...(entry[2] != null ? {maximumSpeedLimit: entry[2]} : {}), ...(entry[3] < 3 ? {maximumNormalLimit: entry[3]} : {})};
  return cardMetadata188(sourceId, identityKey);
}
