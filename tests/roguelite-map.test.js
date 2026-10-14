import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,validateMap,availableNodes,nodeLabel,nodeSummary,MAP_ALGORITHM_VERSION,TOWER_THEME,TOWER_EVENTS,NODE_DESCRIPTIONS} from '../roguelite-map.js';

test('a seed determines identical maps without dependence on previous calls',()=>{
  const first = generateMap('봉인된 탑 136');
  generateMap('different seed');
  assert.deepEqual(generateMap('봉인된 탑 136'),first);
  assert.equal(first.algorithm_version,MAP_ALGORITHM_VERSION);
  assert.equal(first.schema_version,2);
  assert.equal(first.floors,20);
  assert.equal(first.seed,'봉인된 탑 136');
  assert.notDeepEqual(generateMap('different seed'),first);
  assert.deepEqual(generateMap('  136  '),generateMap(136));
  assert.deepEqual(generateMap('탑'),generateMap('탑'));
});

test('the v1 seed contract preserves a recorded route across module revisions',()=>{
  const signature = generateMap('tower-136',{floors:10}).nodes.map(node=>`${node.id}:${node.kind}:${node.next.join(',')}`).join('|');
  assert.equal(signature,'f01-l1:battle:f02-l0,f02-l2|f02-l0:battle:f03-l0|f02-l2:event:f03-l2|f03-l0:event:f04-l1|f03-l2:battle:f04-l1|f04-l1:rest:f05-l1|f05-l1:midboss:f06-l0,f06-l1,f06-l2|f06-l0:event:f07-l0|f06-l1:shop:f07-l0,f07-l2|f06-l2:battle:f07-l2|f07-l0:shop:f08-l0,f08-l1|f07-l2:battle:f08-l1,f08-l2|f08-l0:battle:f09-l1|f08-l1:shop:f09-l1|f08-l2:event:f09-l1|f09-l1:rest:f10-l1|f10-l1:boss:');
});

test('legacy 10-floor layouts retain reachable routes and saved resting gates',()=>{
  for (let seed=0;seed<150;seed++) {
    const map = generateMap(seed,{floors:10});
    assert.deepEqual(validateMap(map),{valid:true,errors:[]},`seed ${seed}`);
    for (const [floor,kind] of [[1,'battle'],[4,'rest'],[5,'midboss'],[9,'rest'],[10,'boss']]) {
      const rows = map.nodes.filter(node=>node.floor===floor);
      assert.equal(rows.length,1);
      assert.equal(rows[0].kind,kind);
      assert.equal(rows[0].lane,1);
    }
    assert.ok(map.nodes.some(node=>node.kind==='event'));
    assert.ok(map.nodes.some(node=>node.kind==='shop'));
    const seen = new Set(),pending = [...availableNodes(map)];
    while (pending.length) {
      const node = pending.pop();
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      const next = availableNodes(map,node.id);
      assert.ok(node.floor===10 ? next.length===0 : next.length>0);
      assert.ok(next.every(target=>target.floor===node.floor+1));
      pending.push(...next);
    }
    assert.equal(seen.size,map.nodes.length);
  }
});

test('map identity and traversal remain stable after JSON round trip',()=>{
  const map = generateMap('save-preview');
  const imported = JSON.parse(JSON.stringify(map));
  assert.deepEqual(validateMap(imported),{valid:true,errors:[]});
  const start = availableNodes(imported)[0];
  assert.equal(start.floor,1);
  assert.ok(availableNodes(imported).length>=3);
  assert.deepEqual(availableNodes(imported,start.id).map(node=>node.id),start.next);
  const boss = imported.nodes.find(node=>node.kind==='boss');
  assert.deepEqual(availableNodes(imported,boss.id),[]);
  assert.throws(()=>availableNodes(imported,'missing-node'),RangeError);
  assert.deepEqual(imported,map);
});

test('import validation rejects dangling links, skipped floors, duplicate IDs and unreachable nodes',()=>{
  const make = ()=>generateMap('broken-import');
  const dangling = make();dangling.nodes[0].next=['missing-node'];
  assert.equal(validateMap(dangling).valid,false);
  assert.ok(validateMap(dangling).errors.some(message=>message.includes('존재하지')));
  assert.throws(()=>availableNodes(dangling),TypeError);
  const skipped = make();skipped.nodes[0].next=[skipped.nodes.find(node=>node.floor===3).id];
  assert.equal(validateMap(skipped).valid,false);
  const duplicated = make();duplicated.nodes.push({...duplicated.nodes[1]});
  assert.equal(validateMap(duplicated).valid,false);
  const isolated = make(),target = isolated.nodes.find(node=>node.floor===3);
  for (const node of isolated.nodes.filter(node=>node.floor===2)) node.next=node.next.filter(id=>id!==target.id);
  assert.equal(validateMap(isolated).valid,false);
  const deadEnd = make();deadEnd.nodes[1].next=[];
  assert.equal(validateMap(deadEnd).valid,false);
  const cycle = make();cycle.nodes.at(-1).next=[cycle.nodes[0].id];
  assert.equal(validateMap(cycle).valid,false);
});

test('import validation rejects malformed shape, unsupported versions and altered mandatory floors',()=>{
  for (const input of [null,[],{}, {nodes:null}, {nodes:[null]}]) assert.equal(validateMap(input).valid,false);
  const make = ()=>generateMap('bad-shape');
  for (const patch of [{schema_version:3},{algorithm_version:'unrecognized'},{floors:9},{seed:undefined},{seed:[]},{seed:'  not normalized  '}]) assert.equal(validateMap({...make(),...patch}).valid,false);
  const wrongGate = make();wrongGate.nodes.find(node=>node.floor===20).kind='shop';
  assert.equal(validateMap(wrongGate).valid,false);
  const wrongLocation = make();wrongLocation.nodes[0].lane=99;
  assert.equal(validateMap(wrongLocation).valid,false);
  const duplicateEdge = make();duplicateEdge.nodes[0].next.push(duplicateEdge.nodes[0].next[0]);
  assert.equal(validateMap(duplicateEdge).valid,false);
  const missingFloor = make();missingFloor.nodes=missingFloor.nodes.filter(node=>node.floor!==6);
  assert.equal(validateMap(missingFloor).valid,false);
});

test('generation rejects unusable seeds and undefined alternative floor contracts',()=>{
  for (const seed of [null,undefined,{},[],NaN,Infinity,0.5,'','   ','x'.repeat(129)]) assert.throws(()=>generateMap(seed));
  for (const floors of [0,9,11,'10',NaN]) assert.throws(()=>generateMap('valid',{floors}),RangeError);
});

function routeEliteRange(map) {
  const byId = new Map(map.nodes.map(node=>[node.id,node]));
  const counts = new Map(map.nodes.filter(node=>node.floor===1).map(node=>[node.id,{min:0,max:0}]));
  for (let floor=1;floor<map.floors;floor++) {
    for (const node of map.nodes.filter(node=>node.floor===floor)) {
      if (!counts.has(node.id)) continue;
      for (const id of node.next) {
        const target = byId.get(id),add=target.kind==='elite' ? 1 : 0;
        const next={min:counts.get(node.id).min+add,max:counts.get(node.id).max+add};
        const previous=counts.get(id);
        counts.set(id,previous ? {min:Math.min(previous.min,next.min),max:Math.max(previous.max,next.max)} : next);
      }
    }
  }
  return counts.get(map.nodes.find(node=>node.kind==='boss').id);
}

test('20-floor maps offer broad reachable branches and optional repeatable elites for varied seeds',()=>{
  const layouts = new Set();
  for (let seed=0;seed<256;seed++) {
    const map=generateMap(`tower-138-${seed}`);
    assert.deepEqual(validateMap(map),{valid:true,errors:[]},`seed ${seed}`);
    assert.equal(map.schema_version,2);
    assert.equal(map.floors,20);
    assert.ok(map.nodes.length>=58 && map.nodes.length<=77);
    const byId=new Map(map.nodes.map(node=>[node.id,node]));
    const pending=[...availableNodes(map)],seen=new Set();
    while (pending.length) {
      const node=pending.pop();
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      const next=node.next.map(id=>byId.get(id));
      assert.ok(node.floor===20 ? next.length===0 : next.length>0);
      assert.ok(next.every(target=>target.floor===node.floor+1));
      if (node.floor<20) assert.ok(next.some(target=>target.kind!=='elite'),'every approach can avoid the next elite');
      pending.push(...next);
    }
    assert.equal(seen.size,map.nodes.length);
    for (let floor=1;floor<20;floor++) {
      const layer=map.nodes.filter(node=>node.floor===floor);
      assert.ok(layer.length>=3 && layer.length<=4);
      assert.ok(layer.every(node=>node.lane>=0 && node.lane<=3));
      assert.ok(layer.filter(node=>node.kind==='elite').length<=1);
      if (floor===1) assert.ok(layer.every(node=>node.kind==='battle'));
    }
    assert.ok(map.nodes.some(node=>node.kind==='event'));
    assert.ok(map.nodes.some(node=>node.kind==='shop'));
    assert.ok(map.nodes.filter(node=>node.kind==='rest').length>=3);
    assert.ok(!map.nodes.some(node=>node.kind==='midboss'));
    const range=routeEliteRange(map);
    assert.equal(range.min,0);
    assert.ok(range.max>=2);
    const boss=map.nodes.filter(node=>node.floor===20);
    assert.deepEqual(boss.map(node=>[node.lane,node.kind]),[[1,'boss']]);
    layouts.add(JSON.stringify(map.nodes));
  }
  assert.equal(layouts.size,256,'fresh seeds also change route topology/content');
});

test('new validation rejects forced elites or elite count without a repeatable route',()=>{
  const forced=generateMap('forced-elite');
  const elite=forced.nodes.find(node=>node.kind==='elite');
  const predecessor=forced.nodes.find(node=>node.next.includes(elite.id));
  predecessor.next=[elite.id];
  assert.ok(validateMap(forced).errors.some(message=>message.includes('피할 경로')));

  const oneElite=generateMap('one-elite');
  oneElite.nodes.filter(node=>node.kind==='elite').slice(1).forEach(node=>node.kind='battle');
  assert.ok(validateMap(oneElite).errors.some(message=>message.includes('2회 이상')));

  // Two optional elites in disconnected left/right climbs are not two encounters.
  const separate=generateMap('separate-elites');
  separate.nodes=[];
  const id=(floor,lane)=>`f${String(floor).padStart(2,'0')}-l${lane}`;
  for (let floor=1;floor<20;floor++) {
    for (let lane=0;lane<4;lane++) {
      const kind=floor===5&&lane===0 || floor===15&&lane===3 ? 'elite' : floor===2&&lane===0 ? 'event' : floor===3&&lane===1 ? 'shop' : floor===19&&lane===0 ? 'rest' : 'battle';
      const pairedLanes=lane<2 ? [0,1] : [2,3];
      separate.nodes.push({id:id(floor,lane),floor,lane,kind,next:floor===19 ? ['f20-l1'] : pairedLanes.map(nextLane=>id(floor+1,nextLane))});
    }
  }
  separate.nodes.push({id:'f20-l1',floor:20,lane:1,kind:'boss',next:[]});
  assert.deepEqual(routeEliteRange(separate),{min:0,max:1});
  assert.deepEqual(validateMap(separate).errors,['엘리트 전투를 2회 이상 선택할 수 있는 경로가 필요해.']);

  const mismatchedLegacy=generateMap('legacy',{floors:10});
  mismatchedLegacy.schema_version=2;
  assert.equal(validateMap(mismatchedLegacy).valid,false);
  const invalidKind=generateMap('new-kind');
  invalidKind.nodes.find(node=>node.kind==='elite').kind='midboss';
  assert.equal(validateMap(invalidKind).valid,false);
});

test('saved legacy and new maps can be mixed without regeneration or mutation',()=>{
  for (const floors of [10,20]) {
    const generated=generateMap('resume-stability',{floors});
    const saved=JSON.stringify(generated);
    generateMap('next-new-run');
    const loaded=JSON.parse(saved);
    assert.deepEqual(validateMap(loaded),{valid:true,errors:[]});
    availableNodes(loaded);
    assert.equal(JSON.stringify(loaded),saved);
    assert.deepEqual(loaded,generated);
  }
  assert.equal(nodeLabel('elite'),'엘리트 전투');
  assert.equal(nodeLabel('midboss'),'엘리트 전투');
  for (const text of ['500','완전 회복','랜덤 유물']) assert.ok(nodeSummary('rest').includes(text));
});

test('story samples are deeply immutable authored previews with distinct choices',()=>{
  assert.equal(TOWER_THEME.title,'봉인된 듀얼의 탑');
  assert.equal(TOWER_EVENTS.length,5);
  assert.equal(new Set(TOWER_EVENTS.map(event=>event.id)).size,5);
  assert.ok(Object.isFrozen(TOWER_THEME));
  for (const event of TOWER_EVENTS) {
    assert.ok(Object.isFrozen(event));
    assert.ok(Object.isFrozen(event.choices));
    assert.ok(event.text.length>20);
    assert.ok(event.choices.length>=2);
    assert.equal(new Set(event.choices.map(choice=>choice.id)).size,event.choices.length);
    assert.ok(event.choices.every(choice=>Object.isFrozen(choice)&&choice.label&&choice.preview));
  }
  assert.throws(()=>TOWER_EVENTS[0].choices[0].label='changed',TypeError);
  for (const kind of Object.keys(NODE_DESCRIPTIONS)) {
    assert.notEqual(nodeLabel(kind),'알 수 없는 칸');
    assert.ok(nodeSummary(kind).length>10);
  }
  assert.equal(nodeLabel('missing'),'알 수 없는 칸');
});
