import {cardMetadata165} from './authoring165-catalog.js?v=20261119-dark-magician-horus165';

const entries = {
  "3117": [
    "f09f2660f8c9249d3fcf4fd00745e18b64f617bbe97d286f85efeecc31e9d671",
    [
      "마주사이의 전사",
      "Fiendish Rhino Warrior"
    ],
    null,
    3
  ],
  "3118": [
    "52ea194f572f894c8e4f5b3c84e29e49a19f83bc0fac53fd400b0777ce531515",
    [
      "헬 퍼니셔",
      "Infernal Punisher"
    ],
    null,
    3
  ],
  "3119": [
    "ff875f64d76359b021fe7a04ea247b3c7d3a4c476de2c96a621699d3b5fce964",
    [
      "다크 비숍",
      "Dark Necromancer"
    ],
    null,
    3
  ],
  "3120": [
    "ccda2e4a0d4e7edd49d25ae042bae538c1d6bd1bd3f0874f3ff92e4df5da050a",
    [
      "하이네스 데몬",
      "Highness Archfiend"
    ],
    null,
    3
  ],
  "3121": [
    "03a93d419e3d54cc1534d2527ad811b07445121bee889b9e896170e38010167e",
    [
      "랜서 데몬",
      "Lancer Archfiend"
    ],
    null,
    3
  ],
  "3122": [
    "7199bdbf842873d0287644dd023bada74c4861cdddbdc0c8cda8c1de41e3994d",
    [
      "레서 데몬",
      "Lesser Fiend"
    ],
    null,
    3
  ],
  "3123": [
    "c80d7f31a75553390f878b26aa786f1e334177a149d9302e630f5316b3ee6de2",
    [
      "이차원의 야수",
      "D.D. Crazy Beast"
    ],
    null,
    3
  ],
  "3124": [
    "c4f9882a6093185428b6d6a1c9decd9afe0169ad1e5013a12a4f6a5dc1cff6ba",
    [
      "미스트 데몬",
      "Mist Archfiend"
    ],
    null,
    3
  ],
  "3125": [
    "50643bc79c1c9dd8b78e08e941ed9b6ed2156ecffbebbb6b23f13e11afa9b7d6",
    [
      "버서크 데몬",
      "Berserk Archfiend"
    ],
    null,
    3
  ],
  "3126": [
    "2682fbdb4c556be2db9e5ee21dd29f862c656da96a94803295e812991eba3a4d",
    [
      "데몬 현현",
      "Archfiend's Manifestation"
    ],
    null,
    3
  ],
  "3127": [
    "0665d1a09df7afe49587a25a9b1fe7de223b4f53af49323ff382b32c32600fa8",
    [
      "데몬 강림",
      "Archfiend's Awakening"
    ],
    null,
    3
  ],
  "3128": [
    "801276b1482887b76a5e500a3f63d122435be4f4108efebe0ef7d8f4a1ff4ecd",
    [
      "엘리멘틀 히어로 와일드맨",
      "Elemental HERO Wildheart"
    ],
    null,
    3
  ],
  "3129": [
    "22ac1a2795369658cbf038564b1e4bf2355f09f6812c04f97c33dcbbf026e8b1",
    [
      "엘리멘틀 히어로 버블맨",
      "Elemental HERO Bubbleman"
    ],
    null,
    3
  ],
  "3130": [
    "cb6a122fcbd745c58d7864b53cd9adbd52517ba78b4f116377db34343d69acf6",
    [
      "엘리멘틀 히어로 브레이즈맨",
      "Elemental HERO Blazeman"
    ],
    null,
    3
  ],
  "3131": [
    "b75e544eeeabdef169e0f8fd0111f2d397998e725994007acad6bf87d5498c88",
    [
      "엘리멘틀 히어로 에어맨",
      "Elemental HERO Stratos"
    ],
    null,
    3
  ],
  "3132": [
    "a4ae78cad592a1aea2c08a429a8d680b348beabefef9add45385ce8fea5f2d28",
    [
      "히어로 얼라이브",
      "A Hero Lives"
    ],
    null,
    3
  ],
  "3133": [
    "d5ce3f615099d029bfd01a4e1fc08eb4261e20c1f21090db2aa8b482530f4bbd",
    [
      "침묵의 마도검사－사일런트 파라딘",
      "Silent Paladin"
    ],
    null,
    3
  ],
  "3134": [
    "b6259fce7610ccf176cf8f33fa457bba294aa3ab9e3290e070db1f6299d1cbac",
    [
      "침묵의 검",
      "Silent Sword Slash"
    ],
    null,
    3
  ],
  "3135": [
    "3b205e1723d9e48188a056a246bf87c24567a8d3c92c0dfca5118ddb65bfb055",
    [
      "침묵의 검사-사일런트 스워드맨",
      "침묵의 검사－사일런트 스워드맨",
      "Silent Swordsman"
    ],
    null,
    3
  ]
};

export function cardMetadata174(sourceId, identityKey) {
  const entry = Object.hasOwn(entries, sourceId) ? entries[sourceId] : null;
  if (entry && entry[0] === identityKey)
    return {image: 'assets/native174/cards/' + sourceId + '.jpg', searchAliases: entry[1],
      ...(entry[2] != null ? {maximumSpeedLimit: entry[2]} : {}), ...(entry[3] < 3 ? {maximumNormalLimit: entry[3]} : {})};
  return cardMetadata165(sourceId, identityKey);
}
