import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeCatalogNative035,nativeRelease035,applyNativeCatalogSettings035} from '../catalog-native035.js';
import {additionIndex,additionMatches} from '../card-additions.js';
import {cardLink,parseCatalogHash} from '../card-groups.js';
import {subtypeMatches} from '../card-subtypes.js';
import {statConditionsMatch} from '../card-filters.js';
import {assertLegacyExport035,NATIVE035_CATALOG,NATIVE035_ENGINE} from '../native035-core.js';

const base=JSON.parse(fs.readFileSync(new URL('../data/cards.json',import.meta.url),'utf8'));
const extension=JSON.parse(fs.readFileSync(new URL('../data/native-expansion035.json',import.meta.url),'utf8'));
const copy=v=>structuredClone(v),snapshot=v=>JSON.stringify(v);
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function merged(){return mergeCatalogNative035(base,extension);}
function setting(card,values={}){return {source_id:card.sourceId,identity_key:card.identity_key,rarity:'UR',stock:false,draw_enabled:false,...values};}
function payload(settings=[],enabled=true){return {schema:1,kind:'unity-native035-library',engine:NATIVE035_ENGINE,catalog_id:NATIVE035_CATALOG,version:1,updated_at:'2026-10-26T00:00:00Z',references:{card_limits:[],characters:[]},document:{schema:1,engine:NATIVE035_ENGINE,catalog_id:NATIVE035_CATALOG,applySections:{starters:false,chapters:false,settings:enabled},decks:[],starters:[],chapters:[1,2,3].map(chapter=>({chapter,battle:{enabled:false,lp_bonus:0,entries:[]},elite:{enabled:false,lp_bonus:0,entries:[]},boss:{enabled:false,lp_bonus:0,entries:[]}})),settings}};}

test('display merge appends 30 identities and never mutates the frozen legacy dataset or manifest',()=>{
  const old=freeze(copy(base)),extra=freeze(copy(extension)),before=snapshot(old),beforeExtra=snapshot(extra);
  const result=mergeCatalogNative035(old,extra);
  assert.equal(result.cards.length,1456);assert.equal(old.meta.total,1426);assert.equal(snapshot(old),before);assert.equal(snapshot(extra),beforeExtra);
  assert.equal(result.cards[0],old.cards[0]);assert.equal(result.cards[1425],old.cards[1425]);assert.equal(new Set(result.cards.map(c=>c.slot)).size,1456);assert.equal(new Set(result.cards.map(c=>c.identity_key)).size,1456);
});
test('all new rows retain their Native identity and normalize Korean details/art without becoming special tokens',()=>{
  const cards=merged().cards.filter(c=>c.nativeOnly);
  for(let i=0;i<30;i++){
    const card=cards[i],raw=extension.cards[i];assert.equal(card.slot,1427+i);assert.equal(card.sourceId,2390+i);assert.equal(card.internal_id,card.sourceId);assert.equal(card.identity_key,raw.identity_key);assert.equal(card.code,raw.code);
    assert.equal(card.engine,NATIVE035_ENGINE);assert.equal(card.legacyExportAllowed,false);assert.equal(card.legacySlot,null);assert.equal(card.special,false);assert.equal(card.name_ko,raw.name);assert.equal(card.name_en,raw.nameEnglish);assert.equal(card.description_ko,raw.description);
    assert.equal(card.image,`assets/native035/cards/${2390+i}.jpg`);assert.equal(card.official_url,raw.officialCardUrl);assert.equal(card.nativeType035,raw.type);assert.equal(card.deck_limit,raw.maxCopies);assert.equal(card.maxCopies,raw.maxCopies);assert.equal(card.speed_limit,null);
    assert.equal(card.stock,true);assert.equal(card.reward_eligible,true);assert.equal(card.draw_enabled,true);assert.equal(card.buy_price,null);assert.equal(card.sell_price,null);
  }
});
test('native bitmasks become existing catalog type/subtype/race/attribute/stat filter values',()=>{
  const by=new Map(merged().cards.filter(c=>c.nativeOnly).map(c=>[c.sourceId,c]));
  assert.equal(by.get(2390).type,'함정');assert.equal(by.get(2390).subtype,'일반');assert.equal(by.get(2390).level,null);assert.equal(by.get(2390).atk,null);
  assert.equal(by.get(2391).type,'마법');assert.equal(subtypeMatches(by.get(2391),'마법:속공'),true);assert.equal(subtypeMatches(by.get(2404),'마법:필드'),true);assert.equal(subtypeMatches(by.get(2411),'마법:장착'),true);assert.equal(subtypeMatches(by.get(2412),'함정:지속'),true);
  const monster=by.get(2403);assert.equal(monster.type,'효과 몬스터');assert.equal(monster.race,'기계족');assert.equal(monster.attribute,'빛');assert.equal(monster.level,5);assert.equal(statConditionsMatch(monster,[{field:'level',levels:[5]}]),true);
  for(const raw of extension.cards.filter(c=>c.type&1)){const card=by.get(raw.sourceId);assert.equal(card.atk,raw.attack);assert.equal(card.def,raw.defense);}
});
test('NEW release and detail hashes use the approved view slots without changing old history',()=>{
  const {cards,release}=merged();const history={schema_version:1,releases:[]},before=snapshot(history);const index=additionIndex(cards,{...history,releases:[release]});
  assert.equal(release.id,'unity035');assert.equal(release.name,'사이버·앤틱 기어 추가 카드');assert.equal(release.added_at,'2026-10-26T00:00:00+09:00');assert.equal(index.latest.count,30);assert.equal(additionMatches(cards[1426],'latest',index),true);assert.equal(additionMatches(cards[0],'latest',index),false);assert.equal(snapshot(history),before);
  assert.deepEqual(parseCatalogHash(cardLink(1427)),{card:1427});assert.deepEqual(nativeRelease035(cards),release);
});
test('shuffled approved rows still display/release in stable slot order',()=>{
  const shuffled=copy(extension);shuffled.cards.reverse();assert.deepEqual(mergeCatalogNative035(base,shuffled).release,merged().release);
});
test('bad base totals, duplicate legacy identities and wrong base datasets reject before append',()=>{
  for(const change of [d=>d.meta.total=1425,d=>d.meta.dataset_id='0'.repeat(64),d=>d.cards[1].identity_key=d.cards[0].identity_key,d=>d.cards.pop(),d=>d.cards[0].nativeOnly=true]){const data=copy(base);change(data);assert.throws(()=>mergeCatalogNative035(data,extension));}
});
test('extension envelope, source-to-slot pairing and legacy boundary are strict',()=>{
  for(const change of [e=>e.cards.pop(),e=>e.engine='legacy',e=>e.rootApprovalSha256='0'.repeat(64),e=>e.unknown=true,e=>e.cards[0].sourceId=2389,e=>e.cards[0].slot=1426,e=>e.cards[0].internal_id=0,e=>e.cards[0].legacyExportAllowed=true,e=>e.cards[0].legacySlot=1427,e=>e.cards[0].token=true,e=>e.cards[0].unknown=true]){const data=copy(extension);change(data);assert.throws(()=>mergeCatalogNative035(base,data));}
});
test('code/identity/source collisions and zero codes never enter the display array',()=>{
  for(const change of [e=>e.cards[1].code=e.cards[0].code,e=>e.cards[0].code=0,e=>e.cards[0].identity_key=base.cards[0].identity_key,e=>e.cards[1].sourceId=e.cards[0].sourceId,e=>e.cards[1].identity_key=e.cards[0].identity_key]){const data=copy(extension);change(data);assert.throws(()=>mergeCatalogNative035(base,data));}
});
test('malformed stats/race and unsafe official URLs reject; artwork always uses our source-id asset',()=>{
  for(const change of [e=>e.cards[7].race=0,e=>e.cards[7].attribute=0,e=>e.cards[7].attack=-1,e=>e.cards[0].officialCardUrl='javascript:alert(1)',e=>e.cards[0].type=3]){const data=copy(extension);change(data);assert.throws(()=>mergeCatalogNative035(base,data));}
  const data=copy(extension);data.cards[0].imageUrl='https://example.invalid/card.jpg';assert.equal(mergeCatalogNative035(base,data).cards[1426].image,'assets/native035/cards/2390.jpg');
});
test('native cards are explicitly rejected by the existing legacy-export boundary',()=>{
  const {cards}=merged();assert.equal(assertLegacyExport035(base.cards),true);assert.throws(()=>assertLegacyExport035([cards[1426]]),/Unity/);
});
test('valid Native035 settings overlay only exact new identities; old rows and input document remain unchanged',()=>{
  const {cards}=merged(),card=cards[1426],oldBefore=snapshot(cards.slice(0,1426));const wire=freeze(payload([setting(card)])),wireBefore=snapshot(wire);
  assert.equal(applyNativeCatalogSettings035(cards,wire),1);assert.equal(card.rarity,'UR');assert.equal(card.stock,false);assert.equal(card.draw_enabled,false);assert.equal(snapshot(cards.slice(0,1426)),oldBefore);assert.equal(snapshot(wire),wireBefore);assert.equal(extension.cards[0].rarity,'R');
});
test('settings disabled, removed or version zero restores manifest defaults',()=>{
  const {cards}=merged(),card=cards[1426];
  for(const reset of [payload([],true),payload([],false),{...payload([],false),version:0,updated_at:null}]){
    applyNativeCatalogSettings035(cards,payload([setting(card)]));assert.equal(card.rarity,'UR');assert.equal(applyNativeCatalogSettings035(cards,reset),0);assert.equal(card.rarity,'R');assert.equal(card.stock,true);assert.equal(card.draw_enabled,true);
  }
});
test('settings cannot refer to a legacy card, unknown source, wrong identity or duplicate row',()=>{
  for(const make of [c=>[{...setting(c),source_id:0,identity_key:base.cards.find(c=>c.internal_id===0).identity_key}],c=>[{...setting(c),source_id:2420}],c=>[{...setting(c),identity_key:'0'.repeat(64)}],c=>[setting(c),setting(c)]]){const {cards}=merged(),card=cards[1426],before=snapshot(cards);assert.throws(()=>applyNativeCatalogSettings035(cards,payload(make(card))));assert.equal(snapshot(cards),before);}
});
test('a later malformed setting cannot partially commit an earlier valid setting',()=>{
  const {cards}=merged(),before=snapshot(cards);const first=setting(cards[1426]),bad=setting(cards[1427],{draw_enabled:'false'});assert.throws(()=>applyNativeCatalogSettings035(cards,payload([first,bad])));assert.equal(snapshot(cards),before);
});
test('malformed envelope/unknown fields and disabled malformed settings preserve an existing overlay',()=>{
  const mutations=[p=>p.kind='poc-card-settings',p=>p.engine='legacy-compatible',p=>p.catalog_id='0'.repeat(64),p=>p.version=-1,p=>p.updated_at=null,p=>p.updated_at='1',p=>p.extra=true,p=>p.references.extra=[],p=>p.document.unknown=true,p=>p.document.applySections.settings=1,p=>p.document.settings[0].unknown=true,p=>{p.document.applySections.settings=false;p.document.settings[0].rarity='L';}];
  for(const mutate of mutations){const {cards}=merged(),card=cards[1426];applyNativeCatalogSettings035(cards,payload([setting(card)]));const before=snapshot(cards),wire=payload([setting(card)]);mutate(wire);assert.throws(()=>applyNativeCatalogSettings035(cards,wire));assert.equal(snapshot(cards),before);}
});
test('unwritable target fails before any preceding row changes',()=>{
  const {cards}=merged(),before=snapshot(cards);Object.freeze(cards[1455]);assert.throws(()=>applyNativeCatalogSettings035(cards,payload([setting(cards[1426])])));assert.equal(snapshot(cards),before);
});
