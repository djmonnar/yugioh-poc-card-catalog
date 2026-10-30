import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {MAP_FIELDS052,parseMapRules052,parseMapPatch052,validateMapDraft052,createMapDraft052} from '../authoring052-map.js';
import {createAuthoringPanels039,publicEntities039,AUTHORING_SECTIONS039} from '../authoring039-panels.js';
import {AuthoringStore039,normalizeBootstrap039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const config=()=>({schema:1,battle_percent:55,event_percent:20,shop_percent:15,rest_percent:10,elite_percent:24});
const balanced=()=>({schema:1,battle_percent:40,event_percent:25,shop_percent:20,rest_percent:15,elite_percent:30});
const patch=value=>Object.fromEntries(MAP_FIELDS052.map(({key})=>[key,value[key]]));
const clone=structuredClone,pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const metadata=value=>{const config_json=JSON.stringify(value);return {schema:1,revision:1,config_json,sha256:createHash('sha256').update(config_json).digest('hex')};};
const entity=(value=config(),version=1)=>({entity_type:'map_rules',entity_id:'main',version,state:'saved',issues:[],content:clone(value)});
function state052({canEdit=true}={}){
  const state=fixture041();state.canEdit=canEdit;state.user=canEdit?{id:'map-editor'}:null;
  state.entities.push(entity());state.bootstrap.authoring={entities:clone(state.entities)};
  state.bootstrap.capabilities.entities.map_rules={operations:['patch'],fields:Object.fromEntries(MAP_FIELDS052.map(({key})=>[key,{type:'integer',min:0,max:100}]))};
  return state;
}
function mounted(t,state=state052(),onChange){
  const doc=new Document041(),root=doc.createElement('main');doc.body.append(root);const changes=[],errors=[];
  const panels=createAuthoringPanels039({document:doc,onChange:(...args)=>{changes.push(clone(args));return onChange?.(...args)??Promise.resolve();},onError:error=>errors.push(error.message)});
  t.after(()=>panels.destroy());panels.render('map',root,state);return {doc,root,panels,changes,errors,state};
}
function edit(ui,label,value){const input=field041(ui.root,`${label} (%)`);input.value=String(value);input.fire('input');return input;}
function setBalanced(ui){for(const [label,value] of [['전투',40],['이벤트',25],['상점',20],['휴식',15],['엘리트 전투',30]])edit(ui,label,value);}
function replaceSaved(state,value,version=2){const row=entity(value,version);state.entities=state.entities.filter(row=>row.entity_type!=='map_rules').concat(clone(row));state.bootstrap.authoring.entities=state.bootstrap.authoring.entities.filter(row=>row.entity_type!=='map_rules').concat(clone(row));}
function wire052(value=config()){
  const payload={catalog:[],deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}};
  const payload_json=JSON.stringify(payload);
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:false,permissions:{can_edit:true},authoring:{entities:[entity(value)]},map_rules052:metadata(value),
    capabilities:{entities:{map_rules:{operations:['patch']}}},game:{schema:1,kind:'poc-unified-game039',authoring_revision:1,game_revision:1,metadata_revision:'1',identity:IDENTITY039,payload_json,source_fingerprint:createHash('sha256').update(payload_json).digest('hex')}};
}

test('map052 reads six strict saved fields and writes only the complete five editable percentages',()=>{
  assert.deepEqual(parseMapRules052(config()),config());assert.deepEqual(parseMapPatch052(patch(config())),patch(config()));
  for(const bad of [null,{}, {...config(),schema:2},{...config(),extra:1},{...config(),battle_percent:'55'},{...config(),battle_percent:55.1},{...config(),battle_percent:-1},{...config(),elite_percent:101},{...config(),rest_percent:9}])assert.throws(()=>parseMapRules052(bad));
  for(const bad of [{battle_percent:55},config(),{...patch(config()),elite_percent:NaN}])assert.throws(()=>parseMapPatch052(bad));
  for(const elite_percent of [0,100])assert.equal(parseMapRules052({...config(),elite_percent}).elite_percent,elite_percent);
});
test('map052 invalid input and non100 totals never turn into a saveable partial configuration',()=>{
  const raw=Object.fromEntries(MAP_FIELDS052.map(({key})=>[key,String(config()[key])]));
  for(const value of ['', '-', '1.5', 'Infinity', 'abc', '１０', '101'])assert.equal(validateMapDraft052({...raw,battle_percent:value}).valid,false,value);
  const low=validateMapDraft052({...raw,battle_percent:'54'});assert.equal(low.total,99);assert.match(low.message,/99%.*100%/);assert.equal(low.config,null);
  const valid=validateMapDraft052({...raw,elite_percent:'100'});assert.equal(valid.total,100);assert.equal(valid.valid,true);
});
test('map052 page reports saved values and sends one atomic five-field patch only on explicit save',async t=>{
  const ui=mounted(t);assert.ok(AUTHORING_SECTIONS039.some(([id,label])=>id==='map'&&label==='맵 분포'));assert.match(ui.root.textContent,/현재 저장된 분포.*55%/);assert.match(ui.root.textContent,/1층 전투.*마지막 보스.*고정/);assert.match(ui.root.textContent,/이미 진행 중인 원정의 맵은 바뀌지/);
  edit(ui,'전투',40);assert.match(ui.root.textContent,/합계 85%/);assert.equal(button041(ui.root,'분포 저장').disabled,true);assert.equal(ui.changes.length,0);
  setBalanced(ui);assert.equal(ui.changes.length,0);assert.equal(button041(ui.root,'분포 저장').disabled,false);button041(ui.root,'분포 저장').click();await pause();
  assert.equal(ui.changes.length,1);assert.deepEqual(ui.changes[0].slice(0,3),['map_rules','main',patch(balanced())]);assert.equal(Object.hasOwn(ui.changes[0][2],'schema'),false);
  assert.match(ui.root.textContent,/현재 저장된 분포.*55%/,'Unacknowledged draft must not relabel the saved preview');
});
test('map052 public metadata is read only and missing data never becomes silently saved defaults',t=>{
  const empty={canEdit:false,bootstrap:{},entities:[]},ui=mounted(t,empty);assert.match(ui.root.textContent,/맵 설정을 불러오는 중/);assert.equal(button041(ui.root,'분포 저장'),undefined);assert.equal(ui.changes.length,0);
  const state={canEdit:false,bootstrap:{mapRules052:{revision:1,config:config()}},entities:[]};ui.panels.render('map',ui.root,state);assert.match(ui.root.textContent,/55%/);assert.match(ui.root.textContent,/로그인/);assert.equal(field041(ui.root,'전투 (%)'),undefined);assert.equal(publicEntities039(state).find(row=>row.entity_type==='map_rules').content.battle_percent,55);
});
test('map052 unsubmitted drafts survive section navigation and unrelated acknowledgements',t=>{
  const ui=mounted(t);edit(ui,'전투',40);ui.panels.render('decks',ui.root,ui.state);ui.panels.render('map',ui.root,ui.state);assert.equal(field041(ui.root,'전투 (%)').value,'40');
  const update=clone(ui.state);update.pending=0;update.status='DB에 저장됨';ui.panels.render('map',ui.root,update);assert.equal(field041(ui.root,'전투 (%)').value,'40');assert.equal(ui.changes.length,0);
});
test('map052 mobile composition owns its input through ACK and draft validation never writes to the DB',async t=>{
  const ui=mounted(t),input=field041(ui.root,'전투 (%)');input.focus();input.fire('compositionstart');input.value='４';input.fire('input',{isComposing:true});
  ui.panels.render('map',ui.root,clone(ui.state));assert.equal(field041(ui.root,'전투 (%)'),input);assert.equal(ui.doc.activeElement,input);assert.equal(input.value,'４');assert.equal(ui.changes.length,0);assert.equal(button041(ui.root,'분포 저장').disabled,true);
  input.value='40';input.fire('compositionend');input.fire('input');input.blur();await pause();assert.equal(field041(ui.root,'전투 (%)').value,'40');assert.equal(ui.changes.length,0);
});
test('map052 a remote saved change retains local input and requires an explicit reload before overwriting',t=>{
  const ui=mounted(t);setBalanced(ui);const remote={...config(),battle_percent:50,event_percent:25};replaceSaved(ui.state,remote);ui.panels.render('map',ui.root,ui.state);
  assert.equal(field041(ui.root,'전투 (%)').value,'40');assert.match(ui.root.textContent,/다른 창/);assert.equal(button041(ui.root,'분포 저장').disabled,true);
  button041(ui.root,'저장값 불러오기').click();assert.equal(field041(ui.root,'전투 (%)').value,'50');assert.equal(field041(ui.root,'이벤트 (%)').value,'25');assert.equal(ui.changes.length,0);
});
test('map052 pending optimistic content is not called saved and own ACK keeps newer input',async t=>{
  let resolve;const ui=mounted(t,state052(),()=>new Promise(done=>resolve=done));setBalanced(ui);button041(ui.root,'분포 저장').click();
  const live=ui.state.entities.find(row=>row.entity_type==='map_rules');live.content=balanced();live.pending=true;ui.state.phase='pending';ui.panels.render('map',ui.root,ui.state);assert.match(ui.root.textContent,/현재 저장된 분포.*55%/);
  edit(ui,'전투',35);replaceSaved(ui.state,balanced());ui.state.phase='ready';ui.panels.render('map',ui.root,ui.state);resolve({schema:1});await pause();
  assert.equal(field041(ui.root,'전투 (%)').value,'35');assert.match(ui.root.textContent,/현재 저장된 분포.*40%/);assert.equal(ui.changes.length,1);
});
test('map052 does not change the legacy eight-section game payload and validates optional top metadata',async()=>{
  const value=wire052(),next=await normalizeBootstrap039(value,webcrypto);assert.equal(Object.keys(next.gamePayload).length,8);assert.equal(next.gamePayload.map_rules,undefined);assert.deepEqual(next.mapRules052.config,config());
  for(const mutate of [v=>v.map_rules052.sha256='0'.repeat(64),v=>v.map_rules052.revision=-1,v=>v.map_rules052.extra=true,v=>v.map_rules052=metadata({...config(),rest_percent:9})]){const bad=wire052();mutate(bad);await assert.rejects(normalizeBootstrap039(bad,webcrypto));}
  const old=wire052();delete old.map_rules052;assert.equal((await normalizeBootstrap039(old,webcrypto)).mapRules052,null);
});
test('map052 uses the existing idempotent queue and an acknowledged reload reads DB values',async t=>{
  let remote=wire052(),writes=0;const calls=[],storage={getItem:()=>null,setItem:()=>writes++},client={auth:{getSession:async()=>({data:{session:{user:{id:'fixture-editor'}}}}),onAuthStateChange:()=>({})},rpc:async(name,args)=>{
    if(name==='poc_bootstrap039')return {data:clone(remote)};calls.push(clone(args.p_intent));const change=args.p_intent.changes[0];assert.equal(change.entity_type,'map_rules');assert.equal(Object.keys(change.fields).length,5);remote.project_revision++;const row=entity({...config(),...change.fields},2);remote.authoring.entities=[row];remote.map_rules052={...metadata(row.content),revision:2};return {data:{schema:1,kind:'unified039-write-ack',request_id:args.p_intent.request_id,applied_revision:remote.project_revision,observed_project_revision:remote.project_revision,entities:[row]}};
  }};
  const make=()=>new AuthoringStore039({client,storage,crypto:webcrypto,pollMs:0,debounceMs:100000,events:{}}),store=make();t.after(()=>store.stop());await store.start();assert.throws(()=>store.patch('map_rules','main',{event_percent:25}));assert.throws(()=>store.patch('map_rules','main',config()));assert.equal(store.queue.length,0);assert.equal(writes,0);
  const promise=store.patch('map_rules','main',patch(balanced()));await store.drain();await promise;assert.equal(calls.length,1);assert.deepEqual(calls[0].changes[0].fields,patch(balanced()));
  const reload=make();t.after(()=>reload.stop());await reload.start();assert.deepEqual(reload.getRow('map_rules','main').content,balanced());assert.deepEqual(reload.bootstrap.mapRules052.config,balanced());
});
