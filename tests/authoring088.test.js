import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY084,gameIdentityMatches084} from '../authoring084-identity.js';
import {GAME_IDENTITY088,gameIdentityMatches088} from '../authoring088-identity.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {ADDITION_BATCHES088} from '../authoring088-batch-data.js';
import {createAuthoringPanels039,normalizeCatalog039,changeDeckCard039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const manifest=read('../data/native-expansion088.json'),sha=b=>createHash('sha256').update(b).digest('hex');
function fixture088(){
 const state=fixture041();state.user={id:'synthetic-088'};
 for(const version of ['049','053','067','081','084','088'])state.bootstrap.catalog.cards.push(...read(`../data/native-expansion${version}.json`).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:[c.category],stock:true,draw_enabled:true})));
 return state;
}
test('088 accepts all complete prior identities and rejects partial, mixed or foreign layers',()=>{
 assert.equal(Object.keys(GAME_IDENTITY088).length,15);assert.equal(gameIdentityMatches084(GAME_IDENTITY088),false);
 for(const count of [3,5,7,9,11,13,15])assert(gameIdentityMatches088(Object.fromEntries(Object.entries(GAME_IDENTITY088).slice(0,count))));
 for(const count of [0,1,2,4,6,8,10,12,14])assert.equal(gameIdentityMatches088(Object.fromEntries(Object.entries(GAME_IDENTITY088).slice(0,count))),false);
 for(const key of Object.keys(GAME_IDENTITY088))assert.equal(gameIdentityMatches088({...GAME_IDENTITY088,[key]:'0'.repeat(64)}),false);
 assert.equal(gameIdentityMatches088({...GAME_IDENTITY088,foreign:'x'}),false);assert.equal(gameIdentityMatches088(null),false);
});
test('088 bootstrapping preserves author edits on existing Church and new Shard without input mutation',async()=>{
 const state=fixture088(),custom=[{entity_type:'card_display',entity_id:'2528',version:385,content:{name:'내 교회 이름',description:'기존 설명 보존'},state:'saved',issues:[]},{entity_type:'card_display',entity_id:'2623',version:387,content:{name:'내 욕망의 조각',description:'새 카드 편집 설명'},state:'saved',issues:[]}];
 const payload={catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:state.bootstrap.characters,shop_rules:{}},text=JSON.stringify(payload);
 const raw={schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:387,unchanged:false,permissions:{can_edit:true},authoring:{entities:custom},game:{schema:1,kind:'poc-unified-game039',game_revision:386,authoring_revision:387,metadata_revision:'386',identity:GAME_IDENTITY088,payload_json:text,source_fingerprint:sha(text)}};
 const before=JSON.stringify(raw),boot=await normalizeBootstrap039(raw,webcrypto),cards=normalizeCatalog039({bootstrap:boot});assert.equal(JSON.stringify(raw),before);assert.equal(cards.length,1685);
 assert.equal(cards.find(c=>c.source_id===2528).name_ko,'내 교회 이름');assert.equal(cards.find(c=>c.source_id===2623).name_ko,'내 욕망의 조각');assert.equal(boot.authoring.entities[0].version,385);
 const bad=structuredClone(raw);bad.game.identity={...GAME_IDENTITY088,catalog088_sha256:'0'.repeat(64)};await assert.rejects(normalizeBootstrap039(bad,webcrypto));
 const old=structuredClone(raw);old.game.identity=GAME_IDENTITY084;assert.ok(await normalizeBootstrap039(old,webcrypto));
});
test('088 append contains31 unique cards and keeps existing Ritual Church2528 as one row',()=>{
 assert.equal(manifest.parentCatalogSha256,GAME_IDENTITY084.catalog084_sha256);assert.equal(manifest.parentExpansionSha256,GAME_IDENTITY084.native_manifest084_sha256);assert.equal(manifest.cards.length,31);
 assert.equal(new Set(manifest.cards.map(c=>c.code)).size,31);assert.equal(new Set(manifest.cards.map(c=>c.identity_key)).size,31);
 for(const [i,c] of manifest.cards.entries()){
  assert.equal(c.sourceId,2623+i);assert.equal(c.slot,1655+i);assert.equal(c.identity_key,sha(`unity-native088\0${c.slot}\0${c.sourceId}\0${c.code}`));assert.equal(c.artKey,`Cards088/${c.sourceId}`);
  assert.equal(c.type&(0x2000|0x800000|0x4000000|0x1000000),0);assert(fs.readFileSync(new URL(`../assets/native088/cards/${c.sourceId}.jpg`,import.meta.url)).length>2000);
 }
 const cards=normalizeCatalog039(fixture088());assert.equal(cards.filter(c=>c.source_id===2528).length,1);assert.equal(cards.filter(c=>c.code===95658967).length,1);assert(!manifest.cards.some(c=>c.code===95658967));
});
test('recent088 opens31 pinned cards while user categories and previous batches remain intact',t=>{
 const state=fixture088();state.entities.push({entity_type:'card_annotation',entity_id:'2623',version:9,content:{tags:['내 분류'],links:[]}});
 const cards=normalizeCatalog039(state),before=JSON.stringify(state),index=catalogAdditions049(cards);assert.equal(index.latest.key,'Cards088');assert.equal(index.latest.count,31);assert.equal(index.groups.find(g=>g.key==='Cards084').count,20);assert.equal(index.groups.find(g=>g.key==='Cards081').count,15);
 assert.equal(additionThemes067(cards,'Cards088',index).reduce((n,row)=>n+row.count,0),31);assert.deepEqual(cards.find(c=>c.source_id===2623).tags,['내 분류']);assert.equal(JSON.stringify(state),before);assert.equal(ADDITION_BATCHES088[0].themes.flatMap(t=>t.members).length,31);
 const document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(args),onError:e=>{throw e;}});panels.render('cards',root,state);t.after(()=>panels.destroy());
 button041(root,'최근 추가').click();assert.equal(field041(root,'추가 묶음').value,'Cards088');assert.match(root.querySelector('.au-card-results-summary').textContent,/31종/);assert.equal(writes.length,0);
 const card=cards.find(c=>c.source_id===2653),deck=changeDeckCard039({main:[],extra:[],banlist_enabled:true},card,1,cards);assert.equal(deck.main[0].source_id,2653);assert.equal(deck.main[0].identity_key,card.identity_key);
});
