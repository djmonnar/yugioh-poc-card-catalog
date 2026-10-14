// Preview-only map/content generation. This module never changes run progress.
export const MAP_ALGORITHM_VERSION = 'tower-map-v2';
const LEGACY_ALGORITHM_VERSION = 'tower-map-v1';
const FIRST_AREA_FLOORS = 20;
const BRANCH_FLOORS = Object.freeze([2, 3, 6, 7, 8]);
const FIXED_KINDS = Object.freeze({1:'battle',4:'rest',5:'midboss',9:'rest',10:'boss'});
const LEGACY_KINDS = Object.freeze(['battle','event','shop','rest','midboss','boss']);
const KINDS = Object.freeze(['battle','event','shop','rest','elite','boss']);

const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const NODE_DESCRIPTIONS = freeze({
  battle:{label:'일반 전투',summary:'지도에서 상대와 덱을 미리 확인하고 도전할 전투를 골라. 승리 보상을 모아 원정 덱을 강화해.'},
  event:{label:'이벤트',summary:'탑의 비밀과 선택지를 만나는 칸. 지금은 이야기와 선택 결과를 미리 보는 단계야.'},
  shop:{label:'상점',summary:'원정 금화로 카드와 유물을 고르는 칸. 상품과 구매 처리는 아직 연결하지 않았어.'},
  rest:{label:'휴식',summary:'최대 LP +500, 현재 LP 완전 회복, 랜덤 유물 획득 중 하나를 선택하는 칸이야.'},
  elite:{label:'엘리트 전투',summary:'더 강한 상대와 싸우는 대신 더 좋은 보상을 얻는 전투. 다른 길로 피하거나 여러 번 도전할 수 있어.'},
  midboss:{label:'엘리트 전투',summary:'이전 원정 지도의 강한 상대. 새 원정에서는 엘리트 전투를 우회하거나 여러 번 만날 수 있어.'},
  boss:{label:'최종보스',summary:'탑의 마지막 층을 지키는 관문. 이 전투를 넘어야 봉인된 탑의 원정을 완주할 수 있어.'}
});

export const TOWER_THEME = freeze({
  id:'sealed-duel-tower',
  content_version:2,
  title:'봉인된 듀얼의 탑',
  subtitle:'첫 구역 · 잊힌 카드의 회랑',
  introduction:'도미노 시티의 밤하늘에, 지도에도 없는 탑이 모습을 드러냈다. 문을 넘는 순간 카드들은 빛을 잃고, 네 손에는 낡은 덱 한 벌만 남는다. 벽에 새겨진 문장이 빛난다. “승자의 카드는 다음 문을 연다.” 위층에서 들리는 셔플 소리를 따라, 너는 첫 듀얼을 준비한다.',
  rest_text:'문틈으로 푸른 빛이 새어 나온다. 빈 듀얼 테이블 위에 세 갈래 빛이 내려앉는다. 더 큰 생명의 그릇, 온전한 회복, 알 수 없는 유물. 다음 관문을 향하기 전, 하나의 도움을 고른다.',
  elite_text:'금빛 문장 앞에서 셔플 소리가 멎는다. 강한 듀얼리스트가 덱과 귀한 보상을 내려놓고 기다린다. “이 길을 택할 자신이 있나?” 옆 회랑으로 향하는 문은 아직 열려 있다.',
  midboss_text:'금빛 문장 앞에서 셔플 소리가 멎는다. 강한 듀얼리스트가 덱과 귀한 보상을 내려놓고 기다린다. “여기까지 가져온 카드로, 앞으로 나아갈 자격을 보여라.”',
  boss_text:'마지막 계단을 오르자 밤하늘이 닫히고 거대한 듀얼 무대가 나타난다. 봉인의 중심에서 한 장의 카드가 빛난다. 탑이 건네는 마지막 질문에, 너는 자신의 덱으로 답한다.'
});

// These are authored previews, not executable effect scripts or awarded items.
export const TOWER_EVENTS = freeze([
  {
    id:'cracked-card-altar',title:'금이 간 카드 제단',
    text:'금이 간 제단 위에 빈 카드 한 장이 놓여 있다. 다가가자 작은 글씨가 떠오른다. “다음 힘을 얻으려면, 지금의 무언가를 내려놓아라.”',
    choices:[
      {id:'offer-card',label:'카드 한 장을 바친다',preview:'카드함의 복사본 한 장을 반납하고 원정 금화를 받는 선택.'},
      {id:'offer-life',label:'자신의 힘을 바친다',preview:'현재 LP를 지불하고 높은 등급의 카드 후보를 고르는 선택.'},
      {id:'leave',label:'제단을 떠난다',preview:'카드와 LP를 유지하고 다음 길로 향한다.'}
    ]
  },
  {
    id:'hall-of-mirrors',title:'거울의 회랑',
    text:'거울 속의 너는 다른 덱을 들고 있다. 손끝이 닿자 카드 그림이 물결처럼 흔들린다. “한 장의 가능성을 바꾸어 볼까?”',
    choices:[
      {id:'exchange-card',label:'카드 한 장을 거울에 비춘다',preview:'선택한 복사본을 등록한 교환 풀의 카드로 바꾸는 선택.'},
      {id:'keep-deck',label:'지금의 덱을 믿는다',preview:'교환하지 않고 회랑을 통과한다.'}
    ]
  },
  {
    id:'forgotten-duelist',title:'길을 잃은 듀얼리스트',
    text:'계단 아래에 앉은 듀얼리스트가 낡은 주머니를 내민다. “나는 여기서 돌아가려고 해. 내 행운까지 위층으로 가져가 주겠어?”',
    choices:[
      {id:'take-charm',label:'작은 부적을 받는다',preview:'이 이벤트에 등록한 유물 후보를 확인하는 선택.'},
      {id:'share-supplies',label:'여행 물자를 나눈다',preview:'원정 금화를 사용하고 다른 도움을 받는 선택.'},
      {id:'say-goodbye',label:'무사한 귀환을 빈다',preview:'인사를 나누고 아무것도 받지 않은 채 길을 계속한다.'}
    ]
  },
  {
    id:'library-of-echoes',title:'메아리의 서고',
    text:'책장 사이에서 오래된 듀얼의 목소리가 들린다. 펼친 책에는 글 대신 카드의 궤적이 새겨져 있다. 한 문장을 읽을 때마다 심장이 힘차게 뛴다.',
    choices:[
      {id:'read-life',label:'생명의 문장을 읽는다',preview:'최대 LP와 현재 LP를 함께 늘리는 선택.'},
      {id:'read-cards',label:'카드의 문장을 읽는다',preview:'등록한 카드 후보 중 한 장을 선택하는 선택.'},
      {id:'close-book',label:'책을 덮는다',preview:'서고의 힘을 사용하지 않고 나간다.'}
    ]
  },
  {
    id:'sleeping-guardian',title:'잠든 수호자의 정원',
    text:'돌로 된 수호자가 작은 정원을 지키고 있다. 그 앞의 샘에는 아직 꺼지지 않은 별빛이 담겨 있다. 손을 뻗자 수호자의 눈이 잠깐 빛난다.',
    choices:[
      {id:'drink-spring',label:'샘물을 마신다',preview:'현재 LP를 회복하고 다시 길을 나서는 선택.'},
      {id:'trade-memory',label:'카드에 담긴 기억을 전한다',preview:'카드 한 장을 반납하고 정원의 선물을 고르는 선택.'},
      {id:'leave-garden',label:'수호자를 깨우지 않고 떠난다',preview:'카드와 LP를 유지한다.'}
    ]
  }
]);

export function nodeLabel(kind) {
  return NODE_DESCRIPTIONS[kind]?.label ?? '알 수 없는 칸';
}

export function nodeSummary(kind) {
  return NODE_DESCRIPTIONS[kind]?.summary ?? '지원하지 않는 노드 종류야.';
}

function normalizeSeed(seed) {
  if (typeof seed === 'number') {
    if (!Number.isSafeInteger(seed)) throw new TypeError('맵 시드는 안전한 정수 또는 문자열이어야 해.');
    seed = String(seed);
  }
  if (typeof seed !== 'string') throw new TypeError('맵 시드는 문자열 또는 정수여야 해.');
  const result = seed.trim().normalize('NFC');
  if (!result || result.length > 128) throw new RangeError('맵 시드는 1~128자로 입력해 줘.');
  return result;
}

// Versioned FNV-1a + xorshift32: all state is scoped to one generation call.
function seededRandom(seed,version=MAP_ALGORITHM_VERSION) {
  let state = 0x811c9dc5;
  for (const code of `${version}\0${seed}`) {
    state ^= code.codePointAt(0);
    state = Math.imul(state,0x01000193) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function shuffled(values,random) {
  const copy = [...values];
  for (let index=copy.length-1;index>0;index--) {
    const other = Math.floor(random()*(index+1));
    [copy[index],copy[other]] = [copy[other],copy[index]];
  }
  return copy;
}

function nodeId(floor,lane) {
  return `f${String(floor).padStart(2,'0')}-l${lane}`;
}

function connectFloors(from,to,random) {
  if (from.length === 1 || to.length === 1) {
    for (const node of from) node.next = to.map(target=>target.id);
    return;
  }
  for (const node of from) {
    const nearestDistance = Math.min(...to.map(target=>Math.abs(target.lane-node.lane)));
    const nearest = to.filter(target=>Math.abs(target.lane-node.lane)===nearestDistance);
    const primary = nearest[Math.floor(random()*nearest.length)];
    node.next.push(primary.id);
    const alternatives = to.filter(target=>target.id!==primary.id&&Math.abs(target.lane-node.lane)<=1);
    if (alternatives.length && random()<0.65) {
      node.next.push(alternatives[Math.floor(random()*alternatives.length)].id);
    }
  }
  // Every route offered on the next floor must have a reachable predecessor.
  for (const target of to) {
    if (from.some(node=>node.next.includes(target.id))) continue;
    const distance = Math.min(...from.map(node=>Math.abs(node.lane-target.lane)));
    const nearest = from.filter(node=>Math.abs(node.lane-target.lane)===distance);
    nearest[Math.floor(random()*nearest.length)].next.push(target.id);
  }
  for (const node of from) node.next.sort((left,right)=>left<right ? -1 : left>right ? 1 : 0);
}

function generateLegacyMap(seed) {
  const floors = 10;
  const normalizedSeed = normalizeSeed(seed);
  const random = seededRandom(normalizedSeed,LEGACY_ALGORITHM_VERSION);
  const layers = [];
  // Ensure this area offers both an event and a shop without forcing either route.
  const [eventFloor,shopFloor] = shuffled(BRANCH_FLOORS,random);
  for (let floor=1;floor<=floors;floor++) {
    if (FIXED_KINDS[floor]) {
      layers.push([{id:nodeId(floor,1),floor,lane:1,kind:FIXED_KINDS[floor],next:[]}]);
      continue;
    }
    const width = random()<0.5 ? 2 : 3;
    const lanes = width===2 ? [0,2] : [0,1,2];
    const kinds = ['battle'];
    if (width===3) kinds.push('event','shop');
    else kinds.push(floor===eventFloor ? 'event' : floor===shopFloor ? 'shop' : random()<0.65 ? 'event' : 'shop');
    const choices = shuffled(kinds,random);
    layers.push(lanes.map((lane,index)=>({id:nodeId(floor,lane),floor,lane,kind:choices[index],next:[]})));
  }
  for (let index=0;index<layers.length-1;index++) connectFloors(layers[index],layers[index+1],random);
  return {schema_version:1,algorithm_version:LEGACY_ALGORITHM_VERSION,seed:normalizedSeed,floors,nodes:layers.flat()};
}

function sortLinks(layers) {
  for (const layer of layers) for (const node of layer) node.next.sort();
}

function addLink(node,target) {
  if (!node.next.includes(target.id)) node.next.push(target.id);
}

function connectWideFloors(from,to,random) {
  if (to.length===1) {
    for (const node of from) node.next=[to[0].id];
    return;
  }
  for (const node of from) {
    // Two exits keep every elite optional. A third exit occasionally joins routes.
    const choices = shuffled(to,random).sort((left,right)=>Math.abs(left.lane-node.lane)-Math.abs(right.lane-node.lane));
    for (const target of choices.slice(0,2)) addLink(node,target);
    if (choices[2] && Math.abs(choices[2].lane-node.lane)<=1 && random()<0.4) addLink(node,choices[2]);
  }
  for (const target of to) {
    if (from.some(node=>node.next.includes(target.id))) continue;
    const candidates = shuffled(from,random).sort((left,right)=>Math.abs(left.lane-target.lane)-Math.abs(right.lane-target.lane));
    addLink(candidates[0],target);
  }
}

function routeExists(layers,start,target) {
  let reachable = new Set([start.id]);
  for (let floor=start.floor;floor<target.floor;floor++) {
    reachable = new Set(layers[floor-1].filter(node=>reachable.has(node.id)).flatMap(node=>node.next));
  }
  return reachable.has(target.id);
}

function connectEliteRoute(layers,start,target) {
  if (routeExists(layers,start,target)) return;
  let current = start;
  for (let floor=start.floor+1;floor<=target.floor;floor++) {
    const next = floor===target.floor ? target : [...layers[floor-1]].sort((left,right)=>{
      const leftScore = Math.abs(left.lane-target.lane)+Math.abs(left.lane-current.lane)*0.5;
      const rightScore = Math.abs(right.lane-target.lane)+Math.abs(right.lane-current.lane)*0.5;
      return leftScore-rightScore || left.lane-right.lane;
    })[0];
    addLink(current,next);
    current = next;
  }
}

export function generateMap(seed,{floors=FIRST_AREA_FLOORS}={}) {
  if (floors===10) return generateLegacyMap(seed);
  if (floors!==FIRST_AREA_FLOORS) throw new RangeError('새 원정은 20층, 이전 원정은 10층으로 생성해.');
  const normalizedSeed = normalizeSeed(seed);
  const random = seededRandom(normalizedSeed);
  const layers = [];
  // Spread three elite opportunities across the climb; no floor forces one.
  const eliteFloors = [4,9,14].map(start=>start+Math.floor(random()*3));
  const restFloors = new Set([5+Math.floor(random()*3),11+Math.floor(random()*3),19]);
  const shopFloors = new Set([3+Math.floor(random()*3),10+Math.floor(random()*3),17]);
  const elites = [];
  for (let floor=1;floor<=floors;floor++) {
    if (floor===floors) {
      layers.push([{id:nodeId(floor,1),floor,lane:1,kind:'boss',next:[]}]);
      continue;
    }
    const width = random()<0.6 ? 4 : 3;
    const lanes = width===4 ? [0,1,2,3] : shuffled([0,1,2,3],random).slice(0,3).sort((a,b)=>a-b);
    let kinds;
    if (floor===1) kinds = lanes.map(()=>'battle');
    else {
      kinds = ['battle'];
      if (eliteFloors.includes(floor)) kinds.push('elite');
      if (restFloors.has(floor)) kinds.push('rest');
      if (shopFloors.has(floor) && kinds.length<width) kinds.push('shop');
      while (kinds.length<width) {
        const roll = random();
        kinds.push(roll<0.48 ? 'battle' : roll<0.8 ? 'event' : roll<0.93 ? 'shop' : 'rest');
      }
      kinds = shuffled(kinds,random);
    }
    const layer = lanes.map((lane,index)=>({id:nodeId(floor,lane),floor,lane,kind:kinds[index],next:[]}));
    layers.push(layer);
    elites.push(...layer.filter(node=>node.kind==='elite'));
  }
  // Make an event available even in an exceptionally battle-heavy seed.
  if (!layers.flat().some(node=>node.kind==='event')) layers[1][1].kind='event';
  for (let index=0;index<layers.length-1;index++) connectWideFloors(layers[index],layers[index+1],random);
  for (let index=0;index<elites.length-1;index++) connectEliteRoute(layers,elites[index],elites[index+1]);
  sortLinks(layers);
  return {schema_version:2,algorithm_version:MAP_ALGORITHM_VERSION,seed:normalizedSeed,floors,nodes:layers.flat()};
}

export function validateMap(map) {
  const errors = [];
  const fail = message=>errors.push(message);
  if (!map || typeof map !== 'object' || Array.isArray(map)) return {valid:false,errors:['맵 객체가 필요해.']};
  const legacy = map.schema_version===1;
  if (!legacy && map.schema_version!==2) fail('지원하지 않는 맵 저장 형식이야.');
  const expectedVersion = legacy ? LEGACY_ALGORITHM_VERSION : MAP_ALGORITHM_VERSION;
  const floors = legacy ? 10 : FIRST_AREA_FLOORS;
  const maxLane = legacy ? 2 : 3;
  const kinds = legacy ? LEGACY_KINDS : KINDS;
  if (map.algorithm_version!==expectedVersion) fail('지원하지 않는 맵 생성 버전이야.');
  if (map.floors!==floors) fail(`이 버전의 원정 맵은 ${floors}층이어야 해.`);
  try { if (normalizeSeed(map.seed)!==map.seed) fail('정규화되지 않은 맵 시드야.'); }
  catch { fail('유효한 맵 시드가 필요해.'); }
  if (!Array.isArray(map.nodes)) return {valid:false,errors:[...errors,'맵 노드 목록이 필요해.']};
  if (map.nodes.length>floors*(maxLane+1)) return {valid:false,errors:[...errors,'맵 노드 수가 허용 범위를 넘었어.']};
  const byId = new Map();
  const layers = new Map();
  for (const node of map.nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) { fail('유효하지 않은 맵 노드야.'); continue; }
    const positionValid = Number.isInteger(node.floor)&&node.floor>=1&&node.floor<=floors&&Number.isInteger(node.lane)&&node.lane>=0&&node.lane<=maxLane;
    if (!positionValid) fail('노드의 층이나 위치가 범위를 벗어났어.');
    if (typeof node.id !== 'string' || !positionValid || node.id !== nodeId(node.floor,node.lane)) fail('노드 ID가 층·위치와 일치하지 않아.');
    if (byId.has(node.id)) fail(`노드 ID가 중복돼: ${node.id}`);
    else byId.set(node.id,node);
    if (!kinds.includes(node.kind)) fail(`지원하지 않는 노드 종류야: ${String(node.kind)}`);
    if (!Array.isArray(node.next) || node.next.some(id=>typeof id!=='string')) fail(`다음 노드 목록이 잘못됐어: ${String(node.id)}`);
    else if (new Set(node.next).size !== node.next.length) fail(`다음 노드가 중복돼: ${node.id}`);
    if (!layers.has(node.floor)) layers.set(node.floor,[]);
    layers.get(node.floor).push(node);
  }
  for (let floor=1;floor<=floors;floor++) {
    const nodes = layers.get(floor) ?? [];
    if (!legacy) {
      if (floor===floors) {
        if (nodes.length!==1 || nodes[0].lane!==1 || nodes[0].kind!=='boss') fail('마지막 층에는 최종보스 한 칸이 필요해.');
      } else {
        if (nodes.length<3 || nodes.length>4) fail(`${floor}층은 3~4개 경로가 필요해.`);
        if (nodes.some(node=>node.kind==='boss')) fail('최종보스는 마지막 층에만 배치할 수 있어.');
        if (floor===1 && nodes.some(node=>node.kind!=='battle')) fail('첫 층은 일반 전투로 시작해야 해.');
        if (nodes.filter(node=>node.kind==='elite').length>1) fail('한 층에는 엘리트 전투를 하나만 배치할 수 있어.');
      }
    } else if (FIXED_KINDS[floor]) {
      if (nodes.length!==1 || nodes[0].lane!==1 || nodes[0].kind!==FIXED_KINDS[floor]) fail(`${floor}층의 고정 관문 배치가 잘못됐어.`);
    } else {
      if (nodes.length<2 || nodes.length>3) fail(`${floor}층은 2~3개 경로가 필요해.`);
      if (nodes.some(node=>!['battle','event','shop'].includes(node.kind))) fail(`${floor}층에는 전투·이벤트·상점만 배치할 수 있어.`);
    }
  }
  for (const node of byId.values()) {
    if (!Array.isArray(node.next)) continue;
    if (node.floor===floors && node.next.length) fail('최종보스 뒤에 다음 노드를 둘 수 없어.');
    if (node.floor<floors && !node.next.length) fail(`막다른 경로가 있어: ${node.id}`);
    for (const id of node.next) {
      const target = byId.get(id);
      if (!target) fail(`존재하지 않는 다음 노드를 참조해: ${id}`);
      else if (target.floor!==node.floor+1) fail(`연결은 바로 다음 층으로만 이동해야 해: ${node.id} → ${id}`);
    }
    if (!legacy && node.floor<floors && !node.next.some(id=>byId.has(id)&&byId.get(id).kind!=='elite')) fail(`엘리트 전투를 피할 경로가 없어: ${node.id}`);
  }
  const visited = new Set();
  const pending = (layers.get(1) ?? []).map(node=>node.id);
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node && Array.isArray(node.next)) pending.push(...node.next.filter(next=>byId.has(next)));
  }
  for (const id of byId.keys()) if (!visited.has(id)) fail(`시작점에서 도달할 수 없는 노드가 있어: ${String(id)}`);
  if (!legacy) {
    for (const kind of ['event','shop','rest']) if (![...byId.values()].some(node=>node.kind===kind)) fail(`${nodeLabel(kind)} 칸이 최소 하나 필요해.`);
    // Evaluate longest elite route over the acyclic floor graph, not node count.
    const mostElites = new Map((layers.get(1) ?? []).map(node=>[node.id,0]));
    for (let floor=1;floor<floors;floor++) {
      for (const node of layers.get(floor) ?? []) {
        if (!mostElites.has(node.id) || !Array.isArray(node.next)) continue;
        for (const id of node.next) {
          const target = byId.get(id);
          if (!target || target.floor!==floor+1) continue;
          const count = mostElites.get(node.id)+(target.kind==='elite' ? 1 : 0);
          mostElites.set(id,Math.max(mostElites.get(id)??-1,count));
        }
      }
    }
    if (!((layers.get(floors) ?? []).some(node=>(mostElites.get(node.id)??0)>=2))) fail('엘리트 전투를 2회 이상 선택할 수 있는 경로가 필요해.');
  }
  return {valid:errors.length===0,errors};
}

export function availableNodes(map,currentNodeId=null) {
  const result = validateMap(map);
  if (!result.valid) throw new TypeError(`유효하지 않은 원정 맵: ${result.errors.join(' ')}`);
  if (currentNodeId===null) return map.nodes.filter(node=>node.floor===1);
  const current = map.nodes.find(node=>node.id===currentNodeId);
  if (!current) throw new RangeError('현재 노드가 맵에 없어.');
  const byId = new Map(map.nodes.map(node=>[node.id,node]));
  return current.next.map(id=>byId.get(id));
}
