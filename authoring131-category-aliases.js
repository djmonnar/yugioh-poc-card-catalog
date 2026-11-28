// Former category names that transfer to a single current tag.
export const legacyCategoryAliases131 = new Map([
  ["발동-필드를 벗어났을 때", ["발동-필드에서 벗어났을 때"]],
  ["발동-필드를 벗어났을 경우", ["발동-필드에서 벗어났을 경우"]],
  [
    "지원-가이아",
    [
      "덱-가이아"
    ]
  ],
  [
    "지원-그레퍼",
    [
      "덱-그레퍼"
    ]
  ],
  [
    "지원-네프티스",
    [
      "덱-네프티스"
    ]
  ],
  [
    "지원-다크 루시어스",
    [
      "덱-다크 루시어스"
    ]
  ],
  [
    "지원-데몬",
    [
      "덱-데몬"
    ]
  ],
  [
    "지원-묘지기",
    [
      "덱-묘지기"
    ]
  ],
  [
    "지원-바다",
    [
      "덱-바다"
    ]
  ],
  [
    "지원-볼캐닉",
    [
      "덱-볼캐닉"
    ]
  ],
  [
    "지원-붉은눈",
    [
      "덱-붉은눈"
    ]
  ],
  [
    "지원-블랙매지션",
    [
      "덱-블랙매지션"
    ]
  ],
  [
    "지원-사이버 엔젤",
    [
      "덱-사이버 엔젤"
    ]
  ],
  [
    "지원-아마조네스",
    [
      "덱-아마조네스"
    ]
  ],
  [
    "지원-아틀란티스",
    [
      "덱-아틀란티스"
    ]
  ],
  [
    "지원-암흑계",
    [
      "덱-암흑계"
    ]
  ],
  [
    "지원-엔디미온",
    [
      "덱-엔디미온"
    ]
  ],
  [
    "지원-제왕",
    [
      "덱-제왕"
    ]
  ],
  [
    "지원-젬나이트",
    [
      "덱-젬나이트"
    ]
  ],
  [
    "지원-천공",
    [
      "덱-천공"
    ]
  ],
  [
    "지원-툰",
    [
      "덱-툰"
    ]
  ],
  [
    "지원-펭귄",
    [
      "덱-펭귄"
    ]
  ],
  [
    "지원-푸른눈",
    [
      "덱-푸른눈"
    ]
  ],
  [
    "지원-해피",
    [
      "덱-해피"
    ]
  ],
  [
    "지원-호루스",
    [
      "덱-호루스"
    ]
  ],
  [
    "발동-LP 지불",
    [
      "발동-lp지불"
    ]
  ],
  [
    "발동-피해 발생 시",
    [
      "발동-피해",
      "발동-데미지"
    ]
  ],
  [
    "발동-LP 회복 시",
    [
      "발동-회복"
    ]
  ],
  [
    "발동-뒷면 표시가 됐을 때",
    [
      "발동-뒷면표시"
    ]
  ],
  [
    "효과-뒷면 제외",
    [
      "뒷면제외"
    ]
  ],
  [
    "발동-패에서",
    [
      "효과-패트랩"
    ]
  ],
  ["효과-표시 형식 변경", ["효과-표시형식 변경", "효과-표시 변경"]],
  ["발동-표시 형식 변경 시", ["발동-표시 변경 시", "발동-표시형식 변경 시"]],
  ["지원-표시 형식 변경", ["지원-표시 변경"]]
]);

const positionCategories212 = new Map([
  '효과-표시 형식 변경', '발동-표시 형식 변경 시', '지원-표시 형식 변경', '효과-사이클 리버스'
].map(name => [positionSearchKey212(name), name]));

export function positionSearchKey212(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, '').replaceAll('표시형식변경', '표시변경');
}

export function canonicalPositionCategory212(value) {
  return positionCategories212.get(positionSearchKey212(value)) ?? value;
}

export function canonicalPositionCategories212(values) {
  return [...new Set(values.map(canonicalPositionCategory212))];
}
