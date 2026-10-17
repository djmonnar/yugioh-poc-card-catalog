import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContent157,cleanContent157} from '../expedition-content157-core.js';
import {defaultContent158,cleanContent158,cleanLibrary158,migrateContent157To158,registeredEffects158,relicParams158,relicEffectText158,eventEffectText158,FIELD_OPTIONS158,LIBRARY_KIND158} from '../expedition-content158-core.js';
import {ContentSync158} from '../expedition-content158-sync.js';
const copy=structuredClone,card={identity_key:'a'.repeat(64),rarity:'R',reward_eligible:true,deck_limit:3,speed_limit:null};
const library=(document,version=2)=>({schema:1,kind:LIBRARY_KIND158,version,document:copy(document),updated_at:version?'2026-10-17T00:00:00Z':null});
const relic=(document,id)=>document.relics.find(row=>row.id===id),event=(document,id)=>document.events.find(row=>row.id===id);

test('157 custom prose, appearance flags, prices and all shop choices migrate without loss',()=>{
  const old=defaultContent157();old.relics[0].name='내 유물';old.relics[0].description='나만의 이야기';old.relics[0].enabled=false;old.relics[0].shop_enabled=false;old.relics[0].weight=9;old.relics[0].price=777;old.events[0].title='우리 샘';old.events[0].enabled=false;old.shop.card_pool_mode='selected';old.shop.card_pool=[card.identity_key];old.shop.card_count=3;old.shop.relic_count=0;old.shop.removal_increase=0;
  const normalized=cleanContent158(old,[card]);assert.equal(normalized.schema_version,2);assert.equal(normalized.relics.length,14);assert.equal(normalized.events.length,11);
  for(const row of old.relics)for(const [key,value] of Object.entries(row))assert.deepEqual(relic(normalized,row.id)[key],value);
  for(const row of old.events)for(const [key,value] of Object.entries(row))assert.deepEqual(event(normalized,row.id)[key],value);
  for(const [key,value] of Object.entries(old.shop))assert.deepEqual(normalized.shop[key],value);
  assert.ok(normalized.relics.slice(7).every(row=>row.enabled));assert.ok(normalized.events.slice(7).every(row=>row.enabled));assert.equal(normalized.shop.fusion_pair_count,1);assert.equal(normalized.shop.ritual_pair_count,1);
  assert.deepEqual(cleanContent157(old),old);assert.deepEqual(cleanContent158(migrateContent157To158(old)),cleanContent158(old));
});
test('158 default/library normalization is idempotent including157 version-zero input',()=>{
  const empty=library(null,0),normalized=cleanLibrary158(empty);assert.deepEqual(cleanLibrary158(normalized),normalized);assert.deepEqual(cleanLibrary158(library(defaultContent157(),0)),normalized);
  const changed=copy(normalized);relic(changed.document,'golden_scarab').params.gold=100;assert.throws(()=>cleanLibrary158(changed));
  assert.deepEqual(cleanContent158(cleanContent158(defaultContent158())),cleanContent158(defaultContent158()));
});
test('five configurable meta effects accept boundaries and their effect text uses actual values',()=>{
  const values={golden_scarab:['gold',2e9],restoring_ankh:['lp',60000],card_slate:['extra_choices',5],merchant_seal:['discount_percent',100],life_fragment:['max_lp',60000]};
  for(const [id,[key,max]] of Object.entries(values)){
    const document=defaultContent158(),row=relic(document,id);row.params[key]=max;assert.equal(relic(cleanContent158(document),id).params[key],max);assert.match(relicEffectText158(row),new RegExp(String(max.toLocaleString('ko'))));
    row.params[key]=0;assert.doesNotThrow(()=>cleanContent158(document));row.params[key]=max+1;assert.throws(()=>cleanContent158(document));
  }
});
test('all relics accept exactly N/R/SR/UR rarity; no new effect IDs or params can be injected',()=>{
  for(const rarity of ['N','R','SR','UR']){const document=defaultContent158();document.relics.forEach(row=>row.rarity=rarity);assert.ok(cleanContent158(document).relics.every(row=>row.rarity===rarity));}
  for(const mutate of [d=>d.relics[0].rarity='L',d=>d.relics[0].params.execute='draw',d=>d.relics[0].id='custom_effect',d=>d.events[0].params.recover=1000,d=>d.events[0].effect='new code']){const document=defaultContent158();mutate(document);assert.throws(()=>cleanContent158(document));}
});
test('starting field pool has six audited identities, is nonempty and does not contain a player selection',()=>{
  assert.equal(FIELD_OPTIONS158.length,6);assert.equal(new Set(FIELD_OPTIONS158.map(row=>row.internal_id)).size,6);
  assert.deepEqual(relicParams158('field_legacy',{fields:['umi','mountain']}),{fields:['mountain','umi']});
  for(const fields of [[],['umi','umi'],['unknown']])assert.throws(()=>relicParams158('field_legacy',{fields}));
  assert.throws(()=>relicParams158('field_legacy',{fields:['umi'],selected:'umi'}));
});
test('consumable budgets, heal amount and acquisition bundle parameters are bounded',()=>{
  for(const id of ['draw_scroll','draw_tome']){
    assert.deepEqual(relicParams158(id,{charges:10,draw:1}),{charges:10,draw:1});assert.throws(()=>relicParams158(id,{charges:0,draw:1}));assert.throws(()=>relicParams158(id,{charges:1,draw:2}));
  }
  assert.deepEqual(relicParams158('healing_potion',{charges:1,heal:1}),{charges:1,heal:1});assert.throws(()=>relicParams158('greater_healing_potion',{charges:1,heal:0}));
  assert.throws(()=>relicParams158('rare_cache',{count:2,rarity:'UR'}));assert.throws(()=>relicParams158('rare_cache',{count:11,rarity:'R'}));
  assert.deepEqual(relicParams158('fusion_cache',{material_copies:3}),{material_copies:3});assert.throws(()=>relicParams158('fusion_cache',{material_copies:4}));
});
test('new events preserve registered mechanics and challenge uses a known stable template only',()=>{
  const document=defaultContent158();event(document,'race_blessing').params.multiplier=100;assert.match(eventEffectText158(event(document,'race_blessing')),/×100/);
  const challenge=event(document,'challenge_duel');challenge.params.encounter_key='installed-story:first-battle';
  assert.equal(event(cleanContent158(document,undefined,[{template_id:challenge.params.encounter_key}]),'challenge_duel').params.encounter_key,challenge.params.encounter_key);
  assert.throws(()=>cleanContent158(document,undefined,[]));challenge.params.encounter_key=null;assert.doesNotThrow(()=>cleanContent158(document,undefined,[]));
  event(document,'twin_sacrifice').params.remove_count=1;assert.throws(()=>cleanContent158(document));
});
test('fixed and random merchandise stay independent, eligible and bounded; bundle slots stay one each',()=>{
  const document=defaultContent158();document.shop.card_pool_mode='all';document.shop.fixed_cards=[card.identity_key];document.shop.fixed_relics=['destiny_draw','golden_scarab'];
  const normalized=cleanContent158(document,[card]);assert.deepEqual(normalized.shop.card_pool,[]);assert.equal(normalized.shop.card_pool_mode,'all');assert.deepEqual(normalized.shop.fixed_relics,['golden_scarab','destiny_draw']);
  assert.throws(()=>cleanContent158(document,[{...card,draw_enabled:false}]));assert.throws(()=>cleanContent158(document,[]));
  document.shop.fixed_cards.push(card.identity_key);assert.throws(()=>cleanContent158(document));document.shop.fixed_cards=[];document.shop.fusion_pair_count=0;assert.throws(()=>cleanContent158(document));
});
test('legacy draft migration retains its CAS base; online refresh never promotes a stale base',async()=>{
  let draft=cleanContent158(defaultContent157()),stored=library(defaultContent158(),2),posts=0;
  const cloud={load:async()=>copy(stored),editor:async()=>true,save:async(document,expected)=>{posts++;if(expected!==stored.version)throw new Error('poc_conflict');stored=library(document,stored.version+1);return copy(stored);}};
  const sync=new ContentSync158({cloud,getDocument:()=>draft,replaceDocument:value=>draft=value,baseVersion:1,baseline:cleanLibrary158(library(defaultContent157(),1))});
  relic(draft,'golden_scarab').params.gold=90;await sync.refresh();assert.equal(sync.baseVersion,1);assert.equal(relic(draft,'golden_scarab').params.gold,90);
  await assert.rejects(sync.save(),/conflict/);await sync.save({compared:true});assert.equal(sync.baseVersion,3);assert.equal(relic(stored.document,'golden_scarab').params.gold,90);assert.equal(posts,2);
});
test('registered schema and prose use supported IDs only and do not mutate default templates',()=>{
  const definitions=registeredEffects158();assert.equal(definitions.relics.length,14);assert.equal(definitions.events.length,11);definitions.relics[0].params.gold=999;
  assert.equal(relic(defaultContent158(),'golden_scarab').params.gold,20);assert.equal(relic(defaultContent158(),'field_legacy').params.fields.length,6);
});
