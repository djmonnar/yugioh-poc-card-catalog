import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {traitCardMatches089,sharedTraitRefMatches089} from '../authoring089-traits.js';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const CHAR='traits089-character',PROFILE='saved-profile',read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const ref=card=>({slot:card.slot,internal_id:card.source_id,identity_key:card.identity_key,name_ko:card.name_ko});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture089(){
  const state=fixture041();state.user={id:'synthetic-089'};
  for(const version of ['049','053','067','081','084','088'])state.bootstrap.catalog.cards.push(...read(`../data/native-expansion${version}.json`).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:[c.category],stock:true,draw_enabled:true})));
  assert.equal(state.bootstrap.catalog.cards.length,1685);return state;
}
function character(state,skills=[],skill_profiles=[]){
  const row={entity_type:'character',entity_id:CHAR,version:17,state:'saved',issues:[],content:{name:'사용자가 저장한 캐릭터 이름',portrait:'',skills,skill_profiles}};
  state.entities.push(row);return row;
}
function mounted(t,state,section='characters',id=CHAR){
  const document=new Document041(),root=document.createElement('main'),writes=[],errors=[];document.body.append(root);
  const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(structuredClone(args)),onError:error=>errors.push(error)});
  panels.selectEntity065(section,id);if(section==='decks')panels.selectDeck(id);panels.render(section,root,state);t.after(()=>panels.destroy());
  return {root,writes,errors};
}
function picker(root,key){const input=root.querySelectorAll('input').find(node=>node.dataset.editKey===key);assert(input,`missing picker ${key}`);return input.parentElement;}
function searchCard(box,query){const input=field041(box,'대상 카드 검색');input.value=query;input.fire('input');return box.querySelectorAll('.au-card-pick');}
function pick(box,card,query=card.name_ko){const found=searchCard(box,query).find(node=>node.textContent.replace(/ ✓$/,'')===card.name_ko);assert(found,`missing selectable ${card.name_ko}`);assert.equal(found.disabled,false);found.click();}
function unchanged(state,before,ui){assert.equal(JSON.stringify(state),before);assert.deepEqual(ui.errors,[]);}
function validate(state,skills,profiles=[]){return validateAuthoringChange066(state,'character',CHAR,{skills,skill_profiles:profiles});}
function profile(skills){return {profile_id:PROFILE,name:'사용자가 저장한 묶음',skills};}
const eligible=card=>card.playable!==false&&!card.special&&!card.token&&Number.isSafeInteger(card.native_type)&&Boolean(card.native_type&7)&&!(card.native_type&(0x40|0x2000|0x800000|0x4000000|0x4000));

test('089 trait type gates use numeric metadata, including source zero, independent of display labels',()=>{
  const state=fixture089(),cards=normalizeCatalog039(state),blue=cards.find(c=>c.source_id===0),town=cards.find(c=>c.source_id===2404),shard=cards.find(c=>c.source_id===2623);
  assert(traitCardMatches089(blue,'playable-main-monster'));assert(traitCardMatches089(town,'playable-main-spell-trap'));assert(traitCardMatches089(shard,'playable-main-spell-trap'));
  assert.equal(traitCardMatches089(blue,'playable-main-spell-trap'),false);assert.equal(traitCardMatches089(town,'playable-main-monster'),false);
  assert(traitCardMatches089({...town,type:'사용자가 바꾼 표시 이름'},'playable-main-spell-trap'));
  for(const native of [{nativeType035:town.native_type},{native:{type:town.native_type}},{type:town.native_type}])assert(traitCardMatches089({source_id:2404,...native},'playable-main-spell-trap'));
  assert.equal(traitCardMatches089({source_id:2404,type:'마법'}),false);
  for(const source_id of [-1,0.5,'2404',null])assert.equal(traitCardMatches089({source_id,native_type:2}),false);
});

test('089 shared references require the exact slot, source and identity while display aliases remain editable',()=>{
  const cards=normalizeCatalog039(fixture089());
  for(const id of [0,2404,2623]){
    const card=cards.find(c=>c.source_id===id),value=ref(card),before=JSON.stringify({card,value});
    assert(sharedTraitRefMatches089(card,value));assert(sharedTraitRefMatches089(card,{...value,name_ko:'사용자의 별칭'}));
    for(const bad of [{...value,slot:value.slot+1},{...value,internal_id:value.internal_id+1},{...value,identity_key:'0'.repeat(64)},{...value,slot:String(value.slot)},{...value,internal_id:String(value.internal_id)}])assert.equal(sharedTraitRefMatches089(card,bad),false);
    assert.equal(JSON.stringify({card,value}),before);
  }
});

test('089 all 241 added main-deck cards validate in shared hand, profile and grave traits; all 116 spells/traps validate on field',()=>{
  const state=fixture089();character(state);const before=JSON.stringify(state),added=normalizeCatalog039(state).filter(c=>c.source_id>=2390&&eligible(c));
  assert.equal(added.length,241);assert.equal(added.filter(c=>c.native_type&6).length,116);
  for(const card of added){
    const hand={kind:'start_hand',card:ref(card)},grave={kind:'start_grave',entries:[{card:ref(card),count:1}]};
    assert.doesNotThrow(()=>validate(state,[hand,grave]),`default ${card.source_id}`);
    assert.doesNotThrow(()=>validate(state,[],[profile([hand,grave])]),`profile ${card.source_id}`);
    if(card.native_type&6)assert.doesNotThrow(()=>validate(state,[{kind:'start_field',card:ref(card)}]),`field ${card.source_id}`);
  }
  assert.equal(JSON.stringify(state),before);
});

test('089 preflight preserves trait type fences, shared reference identity and grave limits',()=>{
  const state=fixture089();character(state);const cards=normalizeCatalog039(state),blue=cards.find(c=>c.source_id===0),town=cards.find(c=>c.source_id===2404);
  assert.throws(()=>validate(state,[{kind:'start_field',card:ref(blue)}]));assert.throws(()=>validate(state,[{kind:'start_monster',card:ref(town),position:'attack'}]));
  for(const bad of [{...ref(town),slot:1},{...ref(town),internal_id:0},{...ref(town),identity_key:'0'.repeat(64)}]){
    assert.throws(()=>validate(state,[{kind:'start_hand',card:bad}]));
    assert.throws(()=>validate(state,[],[profile([{kind:'start_grave',entries:[{card:bad,count:1}]}])]));
  }
  const raw=state.bootstrap.catalog.cards.find(c=>c.source_id===2404),original=structuredClone(raw);
  for(const changes of [{token:true},{special:true},{playable:false},...[0,0x41,0x2001,0x800001,0x4000001,0x4001].map(native_type=>({native_type}))]){
    Object.keys(raw).forEach(k=>delete raw[k]);Object.assign(raw,original,changes);
    assert.equal(traitCardMatches089(raw),false);assert.equal(sharedTraitRefMatches089(raw,ref(town)),false);
    assert.throws(()=>validate(state,[{kind:'start_hand',card:ref(town)}]));assert.throws(()=>validate(state,[{kind:'start_grave',entries:[{card:ref(town),count:1}]}]));
  }
  Object.keys(raw).forEach(k=>delete raw[k]);Object.assign(raw,original);
  assert.throws(()=>validate(state,[{kind:'start_grave',entries:[{card:ref(town),count:13}]}]));
  assert.throws(()=>validate(state,[{kind:'start_grave',entries:[{card:ref(town),count:1},{card:ref(town),count:1}]}]));
});

for(const id of [2404,2623])for(const inProfile of [false,true])test(`089 actual ${inProfile?'profile':'default'} field picker selects native spell ${id} and preserves saved fields`,async t=>{
  const state=fixture089(),cards=normalizeCatalog039(state),target=cards.find(c=>c.source_id===id),initial=cards.find(c=>c.source_id===2404),row={kind:'start_field',card:ref(initial)},healing={kind:'heal_once',value:900};
  character(state,inProfile?[healing]:[row,healing],inProfile?[profile([row,healing])]:[profile([{kind:'lp_bonus',value:700}])]);
  const before=JSON.stringify(state),ui=mounted(t,state),key=inProfile?`character:${CHAR}.profile.${PROFILE}.0.card`:`character:${CHAR}.skills.0.card`;
  pick(picker(ui.root,key),target,id===2404?'기 어 타 운':target.name_ko);await tick();assert.equal(ui.writes.length,1);
  const [type,entityId,fields]=ui.writes[0];assert.equal(type,'character');assert.equal(entityId,CHAR);assert.deepEqual(Object.keys(fields),[inProfile?'skill_profiles':'skills']);
  const skills=inProfile?fields.skill_profiles[0].skills:fields.skills;assert.deepEqual(skills,[{kind:'start_field',card:ref(target)},healing]);
  assert.equal(Object.hasOwn(skills[0],'sourceId'),false);assert.doesNotThrow(()=>validateAuthoringChange066(state,type,entityId,fields));unchanged(state,before,ui);
});

test('089 adding a shared field trait can initialize from a catalog containing only native additions',async t=>{
  const state=fixture089();state.bootstrap.catalog.cards=state.bootstrap.catalog.cards.filter(c=>[2404,2623].includes(c.source_id));character(state);
  const first=normalizeCatalog039(state)[0],before=JSON.stringify(state),ui=mounted(t,state);field041(ui.root,'추가할 특성').value='start_field';button041(ui.root,'특성 추가').click();await tick();
  assert.equal(ui.writes.length,1);assert.deepEqual(ui.writes[0][2],{skills:[{kind:'start_field',card:ref(first)}]});assert.doesNotThrow(()=>validateAuthoringChange066(state,...ui.writes[0]));unchanged(state,before,ui);
});

test('089 actual shared grave picker appends a new card without changing existing quantities or profiles',async t=>{
  const state=fixture089(),cards=normalizeCatalog039(state),blue=cards.find(c=>c.source_id===0),shard=cards.find(c=>c.source_id===2623);
  character(state,[{kind:'start_grave',entries:[{card:ref(blue),count:3}]}],[profile([{kind:'heal_once',value:800}])]);const before=JSON.stringify(state),ui=mounted(t,state);
  pick(picker(ui.root,`character:${CHAR}.skills.0.grave.add`),shard);await tick();assert.equal(ui.writes.length,1);
  assert.deepEqual(ui.writes[0][2],{skills:[{kind:'start_grave',entries:[{card:ref(blue),count:3},{card:ref(shard),count:1}]}]});assert.doesNotThrow(()=>validateAuthoringChange066(state,...ui.writes[0]));unchanged(state,before,ui);
});

for(const kind of ['start_field','start_hand','start_grave'])test(`089 actual direct deck ${kind} picker emits compiled source IDs for a new spell`,async t=>{
  const state=fixture089(),cards=normalizeCatalog039(state),shard=cards.find(c=>c.source_id===2623),town=cards.find(c=>c.source_id===2404),deck=state.entities.find(e=>e.entity_type==='deck'),defaults=state.bootstrap.capabilities.trait_form.compiled.defaults;
  const initial={...structuredClone(defaults),kind,...(kind==='start_grave'?{entries:[{sourceId:town.source_id,count:2}]}:{sourceId:town.source_id})},healing={...structuredClone(defaults),kind:'heal_once',value:600};deck.content.skills=[initial,healing];
  const before=JSON.stringify(state),ui=mounted(t,state,'decks',deck.entity_id),key=`${deck.entity_id}.skills.0.${kind==='start_grave'?'grave.add':'card'}`;pick(picker(ui.root,key),shard);await tick();assert.equal(ui.writes.length,1);
  const [type,id,fields]=ui.writes[0],expected={...initial,...(kind==='start_grave'?{entries:[...initial.entries,{sourceId:shard.source_id,count:1}]}:{sourceId:shard.source_id})};
  assert.equal(type,'deck');assert.equal(id,deck.entity_id);assert.deepEqual(fields,{skills:[expected,healing]});assert.equal(Object.hasOwn(fields.skills[0],'card'),false);assert.doesNotThrow(()=>validateAuthoringChange066(state,type,id,fields));unchanged(state,before,ui);
});

test('089 unfiltered picker exposes every eligible card through more, reports counts and resets paging on normalized searches',t=>{
  const state=fixture089(),cards=normalizeCatalog039(state),all=cards.filter(eligible),town=cards.find(c=>c.source_id===2404);character(state,[{kind:'start_hand',card:ref(cards.find(c=>c.source_id===0))}]);
  const before=JSON.stringify(state),ui=mounted(t,state),box=picker(ui.root,`character:${CHAR}.skills.0.card`),status=box.querySelector('[role="status"]'),more=button041(box,'카드 더 보기');assert(status);assert(more);
  assert.equal(box.querySelectorAll('.au-card-pick').length,30);assert.match(status.textContent,new RegExp(all.length.toLocaleString('ko-KR')));
  let steps=0,previous=30;while(!more.hidden){assert(++steps<100);more.click();const count=box.querySelectorAll('.au-card-pick').length;assert(count>previous&&count<=previous+30);previous=count;}
  const labels=new Set(box.querySelectorAll('.au-card-pick').map(node=>node.textContent.replace(/ ✓$/,'')));assert.equal(previous,all.length);for(const c of all.filter(c=>c.source_id>=2390))assert(labels.has(c.name_ko),`${c.source_id} omitted`);
  assert.deepEqual(searchCard(box,'기 어 타 운').map(n=>n.textContent),[town.name_ko]);assert.equal(more.hidden,true);
  assert.deepEqual(searchCard(box,'Geartown').map(n=>n.textContent),[town.name_ko]);assert.equal(searchCard(box,'').length,30);assert.equal(more.hidden,false);assert.equal(ui.writes.length,0);unchanged(state,before,ui);
});

test('089 read-only trait pickers retain searchable new cards without allowing a write',t=>{
  const state=fixture089(),cards=normalizeCatalog039(state),shard=cards.find(c=>c.source_id===2623);character(state,[{kind:'start_field',card:ref(cards.find(c=>c.source_id===2404))}]);state.canEdit=false;
  const before=JSON.stringify(state),ui=mounted(t,state),box=picker(ui.root,`character:${CHAR}.skills.0.card`),found=searchCard(box,shard.name_ko);assert.equal(found.length,1);assert.equal(found[0].disabled,true);found[0].click();assert.equal(ui.writes.length,0);unchanged(state,before,ui);
});
