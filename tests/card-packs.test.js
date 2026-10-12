import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PACK_RULES,newCardPack,packCardRef,parseCardPack,canonicalCardPack,packCardEligible,resolvePackCard,cardPackPool,togglePackCard,cardPackRows,parsePackDrafts,acceptPackSave,CardPacksCloud} from '../card-packs-core.js';
import {builderCardMatches} from '../ai-deck-filters.js';
const catalog=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url))),meta=catalog.meta,cards=catalog.cards;
const samples=Object.keys(PACK_RULES.odds).map(t=>cards.find(c=>c.rarity===t&&packCardEligible(c)));
const ready=()=>({...newCardPack(meta.dataset_id),name:'클래식 컬렉션',enabled:true,cards:samples.map(packCardRef)});
const row=(document=ready(),version=100,id='pack-test')=>({id,document,version,archived:false});

test('all four effective rarity pools preserve exact advertised pack probabilities',()=>{
  const state=cardPackPool(ready(),cards);assert.equal(state.available,true);assert.deepEqual(state.pool_counts,{UR:1,SR:1,R:1,N:1});
  const withDuplicate={...ready(),cards:[...ready().cards,ready().cards[0]]};assert.throws(()=>parseCardPack(withDuplicate));
  assert.deepEqual(parseCardPack(ready()).odds,{UR:2,SR:6,R:42,N:50});assert.equal(ready().price,200);assert.equal(ready().cards_per_pack,5);
  for(const patch of [{price:100},{cards_per_pack:3},{odds:{UR:3,SR:5,R:42,N:50}},{cover:'https://example.com/pack.png'}])assert.throws(()=>parseCardPack({...ready(),...patch}));
});
test('missing tiers disable sale instead of redistributing odds or modifying selection',()=>{
  const value=ready();value.cards=value.cards.slice(1);const before=JSON.stringify(value),state=cardPackPool(value,cards);assert.equal(state.available,false);assert.deepEqual(state.missing,['UR']);assert.match(state.reason,/UR/);assert.equal(JSON.stringify(value),before);
});
test('current grade and global eligibility control draw pools without losing selected cards',()=>{
  const value=ready(),copy=structuredClone(cards),selected=copy.find(c=>c.identity_key===samples[0].identity_key);selected.rarity='R';
  let state=cardPackPool(value,copy);assert.equal(state.pool_counts.UR,0);assert.equal(state.pool_counts.R,2);assert.equal(value.cards.length,4);
  for(const flags of [{special:true},{rarity:'L'},{reward_eligible:false},{draw_enabled:false},{deck_limit:0}]){
    const c={...samples[0],...flags};assert.equal(packCardEligible(c),false);const current=cards.map(x=>x.identity_key===c.identity_key?c:x);state=cardPackPool(value,current);assert.equal(state.available,false);assert.equal(state.excluded.length,1);assert.equal(value.cards.length,4);
  }
  assert.equal(packCardEligible({...samples[0],stock:false,speed_limit:0}),true);
});
test('a reused slot or changed identity never inherits old pack membership',()=>{
  const value=ready(),original=value.cards[0],changed=cards.map(c=>c.slot===original.slot?{...c,identity_key:'0'.repeat(64),name_ko:'다른 카드'}:c);
  assert.equal(cardPackPool(value,changed).unresolved.length,1);assert.equal(cardPackPool(value,changed).available,false);assert.throws(()=>canonicalCardPack(value,meta,changed));
  const migrated=cards.map(c=>c.slot===original.slot?{...c,identity_key:'0'.repeat(64),previous_identity_keys:[original.identity_key]}:c);assert.equal(canonicalCardPack(value,meta,migrated).cards[0].identity_key,'0'.repeat(64));
  assert.throws(()=>canonicalCardPack(value,meta,migrated.map(c=>c.slot===original.slot?{...c,internal_id:c.internal_id+1}:c)));
});
test('slot hints move safely while ambiguous identities and alias duplicates stay unavailable',()=>{
  const value=ready(),ref=value.cards[0],moved={...samples[0],slot:2047,name_ko:'현재 카드 이름'};
  const current=samples.map(c=>c.identity_key===ref.identity_key?moved:c);assert.equal(resolvePackCard(ref,current),moved);assert.equal(cardPackPool(value,current).available,true);
  const saved=canonicalCardPack(value,meta,current);assert.equal(saved.cards[0].slot,2047);assert.equal(saved.cards[0].name_ko,'현재 카드 이름');
  const ambiguous=[...current,{...moved,slot:2046}];assert.equal(resolvePackCard(ref,ambiguous),undefined);assert.equal(cardPackPool(value,ambiguous).available,false);assert.throws(()=>canonicalCardPack(value,meta,ambiguous));
  const migrated={...moved,identity_key:'0'.repeat(64),previous_identity_keys:[ref.identity_key]},aliases=current.map(c=>c===moved?migrated:c);
  assert.equal(canonicalCardPack(value,meta,aliases).cards[0].identity_key,migrated.identity_key);
  assert.equal(resolvePackCard(ref,[...aliases.filter(c=>c!==migrated),{...migrated,internal_id:ref.internal_id+1}]),undefined);
  const duplicate={...value,cards:[...value.cards,{...packCardRef(migrated),slot:2046}]};assert.equal(cardPackPool(duplicate,aliases).available,false);assert.throws(()=>canonicalCardPack(duplicate,meta,aliases));
});
test('multi-selection survives card filtering and repeat selection cancels only one card',()=>{
  let value=newCardPack(meta.dataset_id);for(const card of samples)value=togglePackCard(value,card,cards);
  const snapshot=JSON.stringify(value);cards.filter(c=>builderCardMatches(c,{query:'아무 결과 없는 이름'}));assert.equal(JSON.stringify(value),snapshot);
  value=togglePackCard(value,samples[1],cards);assert.equal(value.cards.length,3);assert.equal(value.cards.some(c=>c.identity_key===samples[1].identity_key),false);
  assert.deepEqual(value.cards.map(c=>c.identity_key),[samples[0],samples[2],samples[3]].map(c=>c.identity_key));
  assert.throws(()=>togglePackCard(value,{...samples[1],draw_enabled:false},cards));
});
test('save acknowledgment preserves edits made during the request and unrelated packs',()=>{
  const captured=ready(),entry={id:'pack-test',expectedVersion:1,document:clone(captured),baseline:null};entry.document.description='저장 도중 쓴 설명';
  const accepted=acceptPackSave(entry,captured,row(captured,2));assert.equal(accepted.document.description,'저장 도중 쓴 설명');assert.equal(accepted.expectedVersion,2);assert.equal(accepted.baseline.document.description,'');
  const untouched={id:'pack-other',document:ready(),expectedVersion:3};assert.equal(untouched.expectedVersion,3);assert.throws(()=>acceptPackSave(untouched,captured,row(captured,2)));
  const clean=acceptPackSave({...entry,document:clone(captured)},captured,row({...captured,description:'서버 저장본'},4));assert.equal(clean.document.description,'서버 저장본');
});
const clone=structuredClone;
test('draft restoration rejects broken source without replacing it',()=>{
  const raw={schema_version:1,active:'pack-test',entries:[{id:'pack-test',expectedVersion:0,document:newCardPack(meta.dataset_id),baseline:null}]};assert.equal(parsePackDrafts(raw).entries.length,1);
  const bad=clone(raw);bad.entries[0].expectedVersion=-1;const before=JSON.stringify(bad);assert.throws(()=>parsePackDrafts(bad));assert.equal(JSON.stringify(bad),before);
  assert.throws(()=>parsePackDrafts({...raw,entries:[...raw.entries,...raw.entries]}));
});
test('cloud membership RPC changes one pack card and never submits other document fields',async()=>{
  const requests=[],client={rpc:async(name,args)=>{requests.push({name,args});return {data:row(),error:null};}},cloud=new CardPacksCloud(client);
  await cloud.member(meta,samples[0],'pack-test',true,7);assert.equal(requests[0].name,'poc_set_card_pack_member');assert.deepEqual(Object.keys(requests[0].args).sort(),['p_card','p_dataset','p_expected_version','p_included','p_pack_id']);assert.equal(requests[0].args.p_expected_version,7);
  assert.equal(requests.some(r=>/story|character|setting|deck/.test(r.name)),false);
});
test('failed online save keeps prior rows and optimistic version unchanged',async()=>{
  const cloud=new CardPacksCloud({rpc:async()=>({data:null,error:{message:'poc_pack_conflict'}})});cloud.rows=[row()];const before=JSON.stringify(cloud.rows);await assert.rejects(()=>cloud.save('pack-test',ready(),99));assert.equal(JSON.stringify(cloud.rows),before);
  assert.throws(()=>cardPackRows([row(),row()]));assert.throws(()=>cardPackRows([{...row(),version:0}]));
});
