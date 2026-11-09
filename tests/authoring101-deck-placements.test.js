import test from 'node:test';
import assert from 'node:assert/strict';
import {deckPlacementSelection101,planDeckExclusions101} from '../authoring101-deck-placements.js';

const key=(roleId,entryId)=>JSON.stringify([roleId,entryId]);
const entry=(entry_id,deck_id='deck')=>({entry_id,deck_id,weight:3,encounter:{name:'상대',unknown:{keep:true}},unknownEntry:['유지']});
const role=(entity_id,chapter,kind,entries)=>({entity_type:'chapter_role',entity_id,version:7,content:{chapter,role:kind,lp_bonus:700,entries,unknownRole:{keep:true}},ready_content:{entries:[entry('ready-only')]}});
const source=()=>[
  role('2:boss',2,'boss',[entry('same'),entry('sibling')]),
  {entity_type:'deck',entity_id:'deck',content:{name:'공유 덱'}},
  role('1:boss',1,'boss',[entry('boss')]),
  role('1:elite',1,'elite',[entry('elite')]),
  role('1:battle',1,'battle',[entry('same'),entry('same','other'),entry('keep')]),
  {...role('deleted',3,'battle',[entry('gone')]),deleted:true}
];
function deepFreeze(value){
  if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}
  return value;
}

test('live selection uses compound keys, chapter/role order, actual references and duplicate normalization',()=>{
  const entities=source(),before=structuredClone(entities),keys=new Set([key('2:boss','same'),key('1:boss','boss'),key('1:elite','elite'),key('1:battle','same'),key('deleted','gone'),key('missing','same'),'malformed']);
  const rows=deckPlacementSelection101(entities,'deck',keys);
  assert.deepEqual(rows.map(row=>row.key),[key('1:battle','same'),key('1:elite','elite'),key('1:boss','boss'),key('2:boss','same')]);
  assert.equal(rows[0].role,entities[4]);assert.equal(rows[0].entry,entities[4].content.entries[0]);
  assert.equal(deckPlacementSelection101(entities,'deck',[key('1:battle','same'),key('1:battle','same')]).length,1);
  assert.deepEqual(entities,before);
});

test('selection prunes deleted, missing, other-deck and historical-only placements without guessing',()=>{
  const entities=source();entities[4].content.entries.push(entry('other-only','other'));
  assert.deepEqual(deckPlacementSelection101(entities,'deck',[key('deleted','gone'),key('1:battle','other-only'),key('1:battle','ready-only'),key('missing','same')]),[]);
  assert.deepEqual(deckPlacementSelection101(entities,'deck'),[]);
  assert.deepEqual(deckPlacementSelection101(entities,'deck',key('1:battle','same')),[]);
});

test('exclusion removes only selected role, entry ID and deck while preserving siblings and unknown data',()=>{
  const entities=deepFreeze(source()),before=structuredClone(entities),plan=planDeckExclusions101({entities,deckId:'deck',keys:[key('1:battle','same')]});
  assert.deepEqual(plan.keys,[{type:'chapter_role',id:'1:battle'}]);assert.equal(plan.entryCount,1);assert.deepEqual(plan.emptyRoles,[]);
  assert.deepEqual(plan.changes,[{type:'chapter_role',id:'1:battle',fields:{entries:entities[4].content.entries.slice(1)}}]);
  const applied=entities.map(row=>row.entity_id==='1:battle'?{...row,content:{...row.content,...plan.changes[0].fields}}:row);
  assert.deepEqual(applied[4].content.unknownRole,before[4].content.unknownRole);assert.equal(applied[4].content.lp_bonus,700);
  assert.deepEqual(applied[0],before[0],'Same entry ID in another role stays in place.');
  assert.deepEqual(applied[4].ready_content,before[4].ready_content,'Ready-only history is not an exclusion target.');
  assert.deepEqual(entities,before);
  plan.changes[0].fields.entries[0].unknownEntry.push('독립');
  assert.deepEqual(entities,before,'Mutating a plan cannot mutate live entries.');
});

test('multiple selections coalesce each role and count unique placements in stable order',()=>{
  const entities=source(),plan=planDeckExclusions101({entities,deckId:'deck',keys:[key('2:boss','same'),key('1:battle','same'),key('2:boss','sibling'),key('1:battle','same'),key('1:elite','elite')]});
  assert.deepEqual(plan.keys,[{type:'chapter_role',id:'1:battle'},{type:'chapter_role',id:'1:elite'},{type:'chapter_role',id:'2:boss'}]);
  assert.equal(plan.changes.length,3);assert.equal(plan.entryCount,4);assert.deepEqual(plan.emptyRoles,['1:elite','2:boss']);
  assert.deepEqual(plan.changes[0].fields.entries.map(row=>row.deck_id),['other','deck']);
  assert.deepEqual(plan.changes.slice(1).map(row=>row.fields.entries),[[],[]]);
});

test('a stale, missing, changed-deck, deleted or malformed key rejects the entire selection',()=>{
  for(const bad of [key('missing','same'),key('1:battle','missing'),key('deleted','gone'),key('1:battle','ready-only'),key('1:battle','other-only'),'malformed',null]){
    const entities=source();entities[4].content.entries.push(entry('other-only','other'));
    const before=structuredClone(entities);
    assert.throws(()=>planDeckExclusions101({entities,deckId:'deck',keys:[key('2:boss','same'),bad]}),/배치.*다시 선택/);
    assert.deepEqual(entities,before);
  }
});

test('a placement reassigned to another deck after selection cannot be excluded',()=>{
  const entities=source(),selected=deckPlacementSelection101(entities,'deck',[key('2:boss','same')]).map(row=>row.key);
  entities[0].content.entries[0].deck_id='changed';const before=structuredClone(entities);
  assert.deepEqual(deckPlacementSelection101(entities,'deck',selected),[]);
  assert.throws(()=>planDeckExclusions101({entities,deckId:'deck',keys:selected}),/변경/);assert.deepEqual(entities,before);
});

test('ambiguous live role or placement IDs reject before any change is produced',()=>{
  for(const ambiguous of ['role','entry']){
    const entities=source();
    if(ambiguous==='role')entities.push(role('2:boss',2,'boss',[entry('different')]));
    else entities[0].content.entries.push(entry('same'));
    const before=structuredClone(entities);
    assert.throws(()=>planDeckExclusions101({entities,deckId:'deck',keys:[key('1:battle','same'),key('2:boss','same')]}),/여러 항목/);
    assert.deepEqual(entities,before);
  }
});

test('no selection and malformed input fail with Korean guidance',()=>{
  for(const keys of [undefined,[],new Set(),key('1:battle','same')])assert.throws(()=>planDeckExclusions101({entities:source(),deckId:'deck',keys}),/제외할 배치를 먼저 선택/);
  assert.throws(()=>planDeckExclusions101({entities:null,deckId:'deck',keys:['some']}),/배치 자료/);
  assert.throws(()=>planDeckExclusions101({entities:source(),keys:['some']}),/배치 자료/);
  assert.throws(()=>planDeckExclusions101(),/제외할 배치를 먼저 선택/);
});
