import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,validateMap,availableNodes,nodeLabel,nodeSummary,MAP_ALGORITHM_VERSION,TOWER_THEME,TOWER_EVENTS,NODE_DESCRIPTIONS} from '../roguelite-map.js';

test('a seed determines identical maps without dependence on previous calls',()=>{
  const first = generateMap('봉인된 탑 136');
  generateMap('different seed');
  assert.deepEqual(generateMap('봉인된 탑 136'),first);
  assert.equal(first.algorithm_version,MAP_ALGORITHM_VERSION);
  assert.equal(first.schema_version,1);
  assert.equal(first.seed,'봉인된 탑 136');
  assert.notDeepEqual(generateMap('different seed'),first);
  assert.deepEqual(generateMap('  136  '),generateMap(136));
  assert.deepEqual(generateMap('탑'),generateMap('탑'));
});

test('the v1 seed contract preserves a recorded route across module revisions',()=>{
  const signature = generateMap('tower-136').nodes.map(node=>`${node.id}:${node.kind}:${node.next.join(',')}`).join('|');
  assert.equal(signature,'f01-l1:battle:f02-l0,f02-l2|f02-l0:battle:f03-l0|f02-l2:event:f03-l2|f03-l0:event:f04-l1|f03-l2:battle:f04-l1|f04-l1:rest:f05-l1|f05-l1:midboss:f06-l0,f06-l1,f06-l2|f06-l0:event:f07-l0|f06-l1:shop:f07-l0,f07-l2|f06-l2:battle:f07-l2|f07-l0:shop:f08-l0,f08-l1|f07-l2:battle:f08-l1,f08-l2|f08-l0:battle:f09-l1|f08-l1:shop:f09-l1|f08-l2:event:f09-l1|f09-l1:rest:f10-l1|f10-l1:boss:');
});

test('first-area layouts have valid reachable routes and mandatory resting gates',()=>{
  for (let seed=0;seed<150;seed++) {
    const map = generateMap(seed);
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
  assert.equal(start.id,'f01-l1');
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
  for (const patch of [{schema_version:2},{algorithm_version:'unrecognized'},{floors:9},{seed:undefined},{seed:[]},{seed:'  not normalized  '}]) assert.equal(validateMap({...make(),...patch}).valid,false);
  const wrongGate = make();wrongGate.nodes.find(node=>node.floor===9).kind='shop';
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
