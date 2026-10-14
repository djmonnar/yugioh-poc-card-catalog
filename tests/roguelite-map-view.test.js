import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap} from '../roguelite-map.js';
import {mapGeometry,previewReachability,encounterPreview,MAP_ASSETS} from '../roguelite-map-view.js';

const legacyMap=seed=>generateMap(seed,{floors:10});

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
    const map=legacyMap(`tower-view-${seed}`),view=mapGeometry(map);
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
  const map=legacyMap('tower-136'),view=mapGeometry(map);
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
  const map=legacyMap('tower-136');
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
  const map=legacyMap('boss-preview');
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

test('twenty-floor views retain every branch and reserve readable space for four opponent labels',()=>{
  for(let seed=0;seed<30;seed++){
    const map=generateMap(`four-lane-labels-${seed}`),view=mapGeometry(map);
    assert.equal(map.floors,20);
    assert.equal(view.width,640);
    assert.equal(view.height,3532);
    assert.deepEqual(view.edges.map(edge=>edge.id),edgeKeys(map));
    const minimumCanvas=420,scale=minimumCanvas/view.width;
    for(let floor=1;floor<=map.floors;floor++){
      const row=view.nodes.filter(node=>node.floor===floor).sort((a,b)=>a.x-b.x);
      for(let index=0;index<row.length;index++){
        const point=row[index];
        assert.ok(point.x*scale>=41&&point.x*scale<=minimumCanvas-41,'mobile opponent labels stay inside the canvas');
        if(index)assert.ok((point.x-row[index-1].x)*scale>=82,'adjacent 82px name labels must not overlap');
      }
    }
    assert.ok(view.rowSpacing*scale>=105,'portrait, battle type and two-line name fit between floors');
    const boss=view.nodes.find(node=>node.kind==='boss');
    assert.equal(boss.x,view.width/2);
    assert.equal(boss.floor,20);
    assert.deepEqual(previewReachability(map,boss.id).immediateIds,[]);
    assert.ok(view.nodes.every(node=>node.x>0&&node.x<view.width&&node.y>0&&node.y<view.height));
  }
});

test('opponent labels accept registered portraits and reject unsafe image locations without modifying assignments',()=>{
  const entry=freeze({opponent_name:' 메이 쿠자크 ',deck_name:'해피의 사냥터',portrait:'assets/story/mai/profile.png'});
  const assignments=freeze({'f01-l0':entry});
  assert.deepEqual(encounterPreview(assignments,'f01-l0'),{name:'메이 쿠자크',deck:'해피의 사냥터',portrait:entry.portrait});
  assert.deepEqual(encounterPreview(new Map(Object.entries(assignments)),'f01-l0'),encounterPreview(assignments,'f01-l0'));
  assert.equal(entry.opponent_name,' 메이 쿠자크 ');
  for(const portrait of ['javascript:alert(1)','data:image/svg+xml,<svg/>','assets/../private.png','https://example.com/unknown.png']){
    assert.equal(encounterPreview({node:{name:'상대',portrait}},'node').portrait,'');
  }
  assert.equal(encounterPreview(null,'missing'),null);
  assert.equal(encounterPreview({node:{deck_name:'덱만 있는 값'}},'node'),null);
  assert.equal(MAP_ASSETS.elite,MAP_ASSETS.midboss,'old midboss art remains available for saved maps');
});
