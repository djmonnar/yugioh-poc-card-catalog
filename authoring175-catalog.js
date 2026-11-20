import {cardMetadata174} from './authoring174-catalog.js?v=20261120-archfiend-hero-silent174';

const entries = {
  "3136": [
    "ba818c9e3d3b01eb0d403818f490efcc245c3111bc485e64df0d0a5d7cbd748b",
    [
      "악마의 현신",
      "Sinister Yorishiro"
    ],
    null,
    3
  ],
  "3137": [
    "3cf7258e475690af0252ce22bc9c8d7071a0bf25f55eac73c6a7a5aad9433ec9",
    [
      "헤이트 버스터",
      "Hate Buster"
    ],
    null,
    3
  ],
  "3138": [
    "13b868fa9e03e605e60ebd58745a6d60dd3d955ea0085eca6835b9a2fcbf091b",
    [
      "디스커버드 어택",
      "Checkmate"
    ],
    null,
    3
  ],
  "3139": [
    "da66e6a8e002d8cb39fda1b4501b56d2c0fc9707e35a5e1144ee8361e5e51f97",
    [
      "프리즌 퀸 데몬",
      "Imprisoned Queen Archfiend"
    ],
    null,
    3
  ],
  "3140": [
    "47ca734e6db3d0fe6a802202408fc497da9ece2bec9e5ce4fea2efad1b6d9ea2",
    [
      "제노사이드킹 데몬",
      "Terrorking Archfiend"
    ],
    null,
    3
  ],
  "3141": [
    "fc06de4d80c1095b9004d4a76fa73a5b4baff542e13a8bb1fe2316824af0f810",
    [
      "인페르노퀸 데몬",
      "Infernalqueen Archfiend"
    ],
    null,
    3
  ],
  "3142": [
    "f22cc96f13b46e2c832235b2d42aa4e9d2748498cab7884d44bb727cabaf96c9",
    [
      "섀도우 나이트 데몬",
      "Shadowknight Archfiend"
    ],
    null,
    3
  ],
  "3143": [
    "c5bb1753ce8b1e36501592347fdfc5dd1751085ceb53fd8a04710dc2d7cfd9ed",
    [
      "데스룩 데몬",
      "Desrook Archfiend"
    ],
    null,
    3
  ],
  "3144": [
    "637f1e1c79b3071c87dbc769b63bbe75ccd9625b47b3053fa26a4ac8e1603d10",
    [
      "다크 비숍 데몬",
      "Darkbishop Archfiend"
    ],
    null,
    3
  ],
  "3145": [
    "3d8bdb9a313a365c47cf5e94f4dbe5eaa0a323eafe23285b112dab066a65fd36",
    [
      "헬폰 데몬",
      "Vilepawn Archfiend"
    ],
    null,
    3
  ],
  "3146": [
    "2adb05af8ff0646e165317ffa4f2ea03f5bd8960b48accdfcbd9cf1f8bc10630",
    [
      "데몬팰리스－악마의 미궁－",
      "Archfiend Palabyrinth"
    ],
    null,
    3
  ],
  "3147": [
    "18ef712866a99afaf6a824488fe50779da81803f5c321c7b6964195c568878c5",
    [
      "데몬의 포효",
      "Archfiend's Roar"
    ],
    null,
    3
  ],
  "3148": [
    "f4091588b9331e1e8e3981f2f34e11383ee0e0d09d06ab5d4d8addb807582519",
    [
      "데몬의 찬탈",
      "Archfiend's Usurpation"
    ],
    null,
    3
  ],
  "3149": [
    "fe7d73471cdc0bb11fff02e46b605399a55437f82f2232ac6e2f371748a74404",
    [
      "전율의 흉황－제네시스 데몬",
      "Archfiend Emperor, the First Lord of Horror"
    ],
    null,
    3
  ]
};

export function cardMetadata175(sourceId, identityKey) {
  const entry = Object.hasOwn(entries, sourceId) ? entries[sourceId] : null;
  if (entry && entry[0] === identityKey)
    return {image: 'assets/native175/cards/' + sourceId + '.jpg', searchAliases: entry[1],
      ...(entry[2] != null ? {maximumSpeedLimit: entry[2]} : {}), ...(entry[3] < 3 ? {maximumNormalLimit: entry[3]} : {})};
  return cardMetadata174(sourceId, identityKey);
}
