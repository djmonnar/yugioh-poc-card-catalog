import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY088,gameIdentityMatches088} from '../authoring088-identity.js';
import {GAME_IDENTITY090,gameIdentityMatches090} from '../authoring090-identity.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {normalizeCatalog039,createAuthoringPanels039,changeDeckCard039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {traitCardMatches089} from '../authoring089-traits.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8')),manifest=read('../data/native-expansion090.json'),sha=b=>createHash('sha256').update(b).digest('hex');
function fixture090(){const state=fixture041();state.user={id:'synthetic090'};for(const version of ['049','053','067','081','084','088','090'])state.bootstrap.catalog.cards.push(...read(`../data/native-expansion${version}.json`).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:c.categories,stock:true,draw_enabled:true})));return state;}
test('090 accepts complete current and historical identities; partial/mixed layers fail',()=>{
 assert.equal(Object.keys(GAME_IDENTITY090).length,17);assert.equal(gameIdentityMatches088(GAME_IDENTITY090),false);
 for(const n of [3,5,7,9,11,13,15,17])assert(gameIdentityMatches090(Object.fromEntries(Object.entries(GAME_IDENTITY090).slice(0,n))));
 for(const n of [0,1,2,4,6,8,10,12,14,16])assert.equal(gameIdentityMatches090(Object.fromEntries(Object.entries(GAME_IDENTITY090).slice(0,n))),false);
 for(const key of Object.keys(GAME_IDENTITY090))assert.equal(gameIdentityMatches090({...GAME_IDENTITY090,[key]:'0'.repeat(64)}),false);
 assert.equal(gameIdentityMatches090({...GAME_IDENTITY090,foreign:'x'}),false);
});
test('090 publication keeps old mutable edits and the new-card annotation without mutating input',async()=>{
 const state=fixture090(),text=JSON.stringify({catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:state.bootstrap.characters,shop_rules:{}});
 const raw={schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:454,unchanged:false,permissions:{can_edit:true},authoring:{entities:[{entity_type:'card_annotation',entity_id:'2659',version:454,content:{tags:['내 전사 덱'],links:[]},state:'saved',issues:[]}]},game:{schema:1,kind:'poc-unified-game039',game_revision:454,authoring_revision:454,metadata_revision:'454',identity:GAME_IDENTITY090,payload_json:text,source_fingerprint:sha(text)}};
 const before=JSON.stringify(raw),boot=await normalizeBootstrap039(raw,webcrypto),cards=normalizeCatalog039({bootstrap:boot});assert.equal(JSON.stringify(raw),before);assert.equal(cards.length,1693);assert.deepEqual(cards.find(c=>c.source_id===2659).tags,['내 전사 덱']);
 const bad=structuredClone(raw);bad.game.identity={...GAME_IDENTITY090,native_manifest090_sha256:'0'.repeat(64)};await assert.rejects(normalizeBootstrap039(bad,webcrypto));
 const old=structuredClone(raw);old.game.identity=GAME_IDENTITY088;assert(await normalizeBootstrap039(old,webcrypto));
});
test('090 requested eight identities keep artwork, native main-deck type and source/slot separation',()=>{
 assert.equal(manifest.parentCatalogSha256,GAME_IDENTITY088.catalog088_sha256);assert.equal(manifest.cards.length,8);
 assert.deepEqual(manifest.cards.map(c=>c.code),[16556849,49681811,70676581,89529919,70832512,403847,25833572,66526672]);
 assert.equal(new Set(manifest.cards.map(c=>c.identity_key)).size,8);
 for(const [i,c]of manifest.cards.entries()){assert.equal(c.sourceId,2654+i);assert.equal(c.slot,1686+i);assert.equal(c.identity_key,sha(`unity-native090\0${c.slot}\0${c.sourceId}\0${c.code}`));assert.equal(c.type&(0x2000|0x800000|0x4000000|0x1000000),0);assert(fs.readFileSync(new URL(`../assets/native090/cards/${c.sourceId}.jpg`,import.meta.url)).length>2000);}
});
test('090 latest batch selects all eight while prior31 and user tags stay independent',t=>{
 const state=fixture090(),cards=normalizeCatalog039(state),index=catalogAdditions049(cards),before=JSON.stringify(state);assert.equal(index.latest.key,'Cards090');assert.equal(index.latest.count,8);assert.equal(index.groups.find(g=>g.key==='Cards088').count,31);assert.equal(additionThemes067(cards,'Cards090',index).reduce((n,r)=>n+r.count,0),8);
 const document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);const panel=createAuthoringPanels039({document,onChange:(...a)=>writes.push(a),onError:e=>{throw e;}});panel.render('cards',root,state);t.after(()=>panel.destroy());button041(root,'최근 추가').click();assert.equal(field041(root,'추가 묶음').value,'Cards090');assert.match(root.querySelector('.au-card-results-summary').textContent,/8종/);assert.equal(writes.length,0);assert.equal(JSON.stringify(state),before);
 const card=cards.find(c=>c.source_id===2660),deck=changeDeckCard039({main:[],extra:[],banlist_enabled:true},card,1,cards);assert.equal(deck.main[0].source_id,2660);assert.equal(deck.main[0].identity_key,card.identity_key);
});
test('090 new spell and trap join the full character trait pickers',()=>{
 const cards=normalizeCatalog039(fixture090()),newCards=cards.filter(c=>c.source_id>=2654);assert.equal(newCards.length,8);assert(newCards.every(c=>traitCardMatches089(c)));assert.deepEqual(newCards.filter(c=>traitCardMatches089(c,'shared-start-spell-trap')).map(c=>c.source_id),[2659,2661]);
 const geartown=cards.find(c=>c.source_id===2404);assert(traitCardMatches089(geartown,'shared-start-spell-trap'));
});
