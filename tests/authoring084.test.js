import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY081,gameIdentityMatches081} from '../authoring081-identity.js';
import {GAME_IDENTITY084,gameIdentityMatches084} from '../authoring084-identity.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {ADDITION_BATCHES084} from '../authoring084-batch-data.js';
import {createAuthoringPanels039,normalizeCatalog039,changeDeckCard039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const bytes=fs.readFileSync(new URL('../data/native-expansion084.json',import.meta.url)),manifest=JSON.parse(bytes),sha=b=>createHash('sha256').update(b).digest('hex');
function fixture084(){
 const state=fixture041();state.user={id:'synthetic-084'};
 for(const version of ['049','053','067','081','084'])state.bootstrap.catalog.cards.push(...read(`../data/native-expansion${version}.json`).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:[c.category],stock:true,draw_enabled:true})));
 return state;
}
test('084 admits each complete published identity while old081 rejects the new layer',()=>{
 assert.equal(Object.keys(GAME_IDENTITY084).length,13);assert.equal(gameIdentityMatches081(GAME_IDENTITY084),false);
 for(const count of [3,5,7,9,11,13])assert.equal(gameIdentityMatches084(Object.fromEntries(Object.entries(GAME_IDENTITY084).slice(0,count))),true);
 for(const count of [0,1,2,4,6,8,10,12])assert.equal(gameIdentityMatches084(Object.fromEntries(Object.entries(GAME_IDENTITY084).slice(0,count))),false);
 for(const key of Object.keys(GAME_IDENTITY084))assert.equal(gameIdentityMatches084({...GAME_IDENTITY084,[key]:'0'.repeat(64)}),false);
 assert.equal(gameIdentityMatches084({...GAME_IDENTITY084,foreign:'x'}),false);assert.equal(gameIdentityMatches084(null),false);
});
test('authoring084 preserves old and new custom edits and accepts older081 without mutating either input',async()=>{
 const state=fixture084(),custom=[{entity_type:'card_display',entity_id:'2038',version:333,content:{name:'내 코트 이름',description:'보존할 설명'},state:'saved',issues:[]},{entity_type:'card_display',entity_id:'2603',version:337,content:{name:'내 신규 카드 이름',description:'편집 설명'},state:'saved',issues:[]}];
 const payload={catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:state.bootstrap.characters,shop_rules:{}},text=JSON.stringify(payload);
 const raw={schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:337,unchanged:false,permissions:{can_edit:true},authoring:{entities:custom},game:{schema:1,kind:'poc-unified-game039',game_revision:336,authoring_revision:337,metadata_revision:'336',identity:GAME_IDENTITY084,payload_json:text,source_fingerprint:sha(text)}};
 const before=JSON.stringify(raw),boot=await normalizeBootstrap039(raw,webcrypto),cards=normalizeCatalog039({bootstrap:boot});assert.equal(JSON.stringify(raw),before);assert.equal(cards.length,1654);
 assert.equal(cards.find(c=>c.source_id===2038).name_ko,'내 코트 이름');assert.equal(cards.find(c=>c.source_id===2603).name_ko,'내 신규 카드 이름');assert.equal(boot.authoring.entities[0].version,333);
 const bad=structuredClone(raw);bad.game.identity={...GAME_IDENTITY084,catalog084_sha256:'0'.repeat(64)};await assert.rejects(normalizeBootstrap039(bad,webcrypto));
 const old=structuredClone(raw);old.game.identity=GAME_IDENTITY081;assert.ok(await normalizeBootstrap039(old,webcrypto));
});
test('new registration contains20 unique identities and preserves081 parent lineage and Court source2038',()=>{
 assert.equal(manifest.parentCatalogSha256,GAME_IDENTITY081.catalog081_sha256);assert.equal(manifest.parentExpansionSha256,GAME_IDENTITY081.native_manifest081_sha256);assert.equal(manifest.cards.length,20);
 assert.equal(new Set(manifest.cards.map(c=>c.code)).size,20);assert.equal(new Set(manifest.cards.map(c=>c.identity_key)).size,20);
 for(const [i,c] of manifest.cards.entries()){assert.equal(c.sourceId,2603+i);assert.equal(c.slot,1635+i);assert.equal(c.identity_key,sha(`unity-native084\0${c.slot}\0${c.sourceId}\0${c.code}`));assert.equal(c.artKey,`Cards084/${c.sourceId}`);assert.equal(c.type&(0x2000|0x800000|0x4000000|0x1000000),0);assert.ok(fs.readFileSync(new URL(`../assets/native084/cards/${c.sourceId}.jpg`,import.meta.url)).length>1000);}
 const cards=normalizeCatalog039(fixture084());assert.equal(cards.filter(c=>c.source_id===2038).length,1);assert.equal(cards.filter(c=>c.name_en==='Court of Justice').length,1);assert.ok(!manifest.cards.some(c=>c.nameEnglish==='Court of Justice'));
});
test('recent084 shows20 cards with exact source/identity membership and retains earlier batches and custom categories',t=>{
 const state=fixture084();state.entities.push({entity_type:'card_annotation',entity_id:'2603',version:9,content:{tags:['내 분류'],links:[]}});
 const cards=normalizeCatalog039(state),before=JSON.stringify(state),index=catalogAdditions049(cards);assert.equal(index.latest.key,'Cards084');assert.equal(index.latest.count,20);assert.equal(index.groups.find(g=>g.key==='Cards081').count,15);assert.equal(index.groups.find(g=>g.key==='Cards067').count,37);
 assert.equal(additionThemes067(cards,'Cards084',index).reduce((n,row)=>n+row.count,0),20);assert.deepEqual(cards.find(c=>c.source_id===2603).tags,['내 분류']);assert.equal(JSON.stringify(state),before);assert.equal(ADDITION_BATCHES084[0].themes.flatMap(t=>t.members).length,20);
 const document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(args),onError:e=>{throw e;}});panels.render('cards',root,state);t.after(()=>panels.destroy());
 button041(root,'최근 추가').click();assert.equal(field041(root,'추가 묶음').value,'Cards084');assert.match(root.querySelector('.au-card-results-summary').textContent,/20종/);assert.equal(writes.length,0);
 const card=cards.find(c=>c.source_id===2603),deck=changeDeckCard039({main:[],extra:[],banlist_enabled:true},card,1,cards);assert.equal(deck.main[0].source_id,2603);assert.equal(deck.main[0].identity_key,card.identity_key);
});
