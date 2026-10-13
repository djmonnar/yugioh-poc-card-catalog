import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap} from '../roguelite-map.js';
import {mapGeometry,previewReachability} from '../roguelite-map-view.js';

const edgeKeys = map=>map.nodes.flatMap(node=>node.next.map(id=>`${node.id}->${id}`)).sort();
const sorted = values=>[...values].sort();
function freeze(value){
  if(value&&typeof value==='object'){
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('tower geometry preserves the complete saved graph with one path per stored edge',()=>{
  for(let seed=0;seed<40;seed++){
    const map=generateMap(`tower-view-${seed}`),view=mapGeometry(map);
    assert.equal(view.width,600);
    assert.equal(view.height,1420);
    assert.equal(view.nodes.length,map.nodes.length);
    assert.deepEqual(sorted(view.nodes.map(node=>node.id)),sorted(map.nodes.map(node=>node.id)));
    assert.deepEqual(view.edges.map(edge=>edge.id),edgeKeys(map));
    assert.equal(new Set(view.edges.map(edge=>edge.id)).size,view.edges.length);
    const savedById=new Map(map.nodes.map(node=>[node.id,node]));
    for(const node of view.nodes){
      const saved=savedById.get(node.id);
      assert.equal(node.floor,saved.floor);
      assert.equal(node.lane,saved.lane);
      assert.equal(node.kind,saved.kind);
      assert.deepEqual(node.next,saved.next);
      assert.notEqual(node.next,saved.next,'the view must not retain a mutable next-array alias');
    }
    for(const edge of view.edges){
      assert.equal(edge.id,`${edge.from}->${edge.to}`);
      assert.ok(savedById.get(edge.from).next.includes(edge.to));
      assert.equal(savedById.get(edge.to).floor,savedById.get(edge.from).floor+1);
      assert.match(edge.d,/^M\s*-?\d/);
      assert.doesNotMatch(edge.d,/NaN|Infinity|undefined/);
    }
  }
});

test('higher floors appear above lower floors in a fixed, viewport-independent coordinate system',()=>{
  const map=generateMap('tower-136'),view=mapGeometry(map);
  const nominalX=[118,300,482];
  for(const node of view.nodes){
    assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y));
    assert.ok(node.x>0&&node.x<view.width);
    assert.ok(node.y>0&&node.y<view.height);
    assert.equal(node.y,180+(map.floors-node.floor)*118);
    assert.ok(Math.abs(node.x-nominalX[node.lane])<=30,'decorative branch jitter must preserve its lane');
    if([1,4,5,9,10].includes(node.floor))assert.equal(node.x,300);
  }
  const byId=new Map(view.nodes.map(node=>[node.id,node]));
  for(const edge of view.edges)assert.ok(byId.get(edge.to).y<byId.get(edge.from).y);
  const positionOrder=view.nodes.map(node=>node.floor*3+node.lane);
  assert.deepEqual(positionOrder,[...positionOrder].sort((a,b)=>a-b));
});

test('geometry is deterministic after unrelated renders, saved-node reordering and JSON restoration',()=>{
  const map=generateMap('restored-route'),first=mapGeometry(map);
  mapGeometry(generateMap('another-route'));
  assert.deepEqual(mapGeometry(map),first);
  assert.deepEqual(mapGeometry(JSON.parse(JSON.stringify(map))),first);
  const reordered=structuredClone(map);
  reordered.nodes.reverse();
  assert.deepEqual(mapGeometry(reordered),first);
});

test('null preview displays every real route and does not advertise a selected next step',()=>{
  const map=generateMap('all-paths-preview'),preview=previewReachability(map);
  assert.deepEqual(sorted(preview.nodeIds),sorted(map.nodes.map(node=>node.id)));
  assert.deepEqual(sorted(preview.edgeIds),edgeKeys(map));
  assert.deepEqual(preview.immediateIds,[]);
});

test('node preview highlights only that node and the saved descendants reachable from it',()=>{
  const map=generateMap('tower-136');
  const selected=map.nodes.find(node=>node.floor===6&&node.lane===0);
  const pending=[selected.id],expectedNodes=new Set(),expectedEdges=new Set();
  const byId=new Map(map.nodes.map(node=>[node.id,node]));
  while(pending.length){
    const id=pending.pop();
    if(expectedNodes.has(id))continue;
    expectedNodes.add(id);
    for(const target of byId.get(id).next){
      expectedEdges.add(`${id}->${target}`);
      pending.push(target);
    }
  }
  const preview=previewReachability(map,selected.id);
  assert.deepEqual(sorted(preview.nodeIds),sorted(expectedNodes));
  assert.deepEqual(sorted(preview.edgeIds),sorted(expectedEdges));
  assert.deepEqual(preview.immediateIds,selected.next);
  assert.ok(preview.nodeIds.includes(selected.id));
  assert.ok(!preview.nodeIds.includes('f01-l1'));
  assert.ok(!preview.nodeIds.includes('f06-l2'),'an unconnected alternative on the same floor is not a descendant');
  assert.ok(!preview.edgeIds.some(id=>id.startsWith('f05-l1->')),'incoming edges are not available next paths');
});

test('final-boss preview has no outgoing paths or imaginary next floor',()=>{
  const map=generateMap('boss-preview');
  const preview=previewReachability(map,'f10-l1');
  assert.deepEqual(preview.nodeIds,['f10-l1']);
  assert.deepEqual(preview.edgeIds,[]);
  assert.deepEqual(preview.immediateIds,[]);
});

test('graph layout and route inspection accept deeply frozen inputs without changing exported save content',()=>{
  const map=freeze(generateMap('immutable-save'));
  const run=freeze({map,floor:0,state:'between_nodes',history:[],lp:4000});
  const envelope={kind:'fixture-save',slots:[{slot_id:'slot-1',run}]};
  const original=JSON.stringify(envelope);
  const view=mapGeometry(map);
  for(const node of map.nodes)previewReachability(map,node.id);
  previewReachability(map);
  assert.equal(JSON.stringify(envelope),original);
  view.nodes[0].next.push('only-the-view');
  assert.equal(JSON.stringify(envelope),original,'editing the render model must not change the saved map');
});

test('invalid saved maps and unknown preview node IDs are rejected instead of generating replacement routes',()=>{
  const broken=generateMap('missing-edge');
  broken.nodes[0].next=['missing-node'];
  const skipped=generateMap('skipped-floor');
  skipped.nodes[0].next=[skipped.nodes.find(node=>node.floor===3).id];
  for(const map of [null,{},broken,skipped,{...generateMap('wrong-version'),algorithm_version:'unsupported'}]){
    assert.throws(()=>mapGeometry(map));
    assert.throws(()=>previewReachability(map));
  }
  assert.throws(()=>previewReachability(generateMap('valid-map'),'not-a-saved-node'));
});
