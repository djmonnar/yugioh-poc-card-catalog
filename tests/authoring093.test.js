import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY090,gameIdentityMatches090} from '../authoring090-identity.js';
import {GAME_IDENTITY093,gameIdentityMatches093} from '../authoring093-identity.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {normalizeCatalog039,createAuthoringPanels039,changeDeckCard039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {traitCardMatches089,sharedTraitRefMatches089} from '../authoring089-traits.js';
import {CARD_SORTS091,sortCards091,cardQueryMatches091,cardFiltersMatch091} from '../authoring091-search.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8')),manifest=read('../data/native-expansion093.json'),sha=b=>createHash('sha256').update(b).digest('hex');
function current093(){const state=fixture041();state.user={id:'synthetic093'};for(const v of ['049','053','067','081','084','088','090','093'])state.bootstrap.catalog.cards.push(...read(`../data/native-expansion${v}.json`).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:c.categories,stock:true,draw_enabled:true})));return state;}
test('093 complete19-field identity accepts historical clients but rejects partial, mixed and extra identities',()=>{
 assert.equal(Object.keys(GAME_IDENTITY093).length,19);assert.equal(gameIdentityMatches090(GAME_IDENTITY093),false);
 for(const n of [3,5,7,9,11,13,15,17,19])assert(gameIdentityMatches093(Object.fromEntries(Object.entries(GAME_IDENTITY093).slice(0,n))));
 for(const n of [0,1,2,4,6,8,10,12,14,16,18])assert.equal(gameIdentityMatches093(Object.fromEntries(Object.entries(GAME_IDENTITY093).slice(0,n))),false);
 for(const key of Object.keys(GAME_IDENTITY093))assert.equal(gameIdentityMatches093({...GAME_IDENTITY093,[key]:'0'.repeat(64)}),false);
 assert.equal(gameIdentityMatches093({...GAME_IDENTITY093,foreign:'x'}),false);
});
test('093 publication normalizes1733 cards and preserves earlier user edits and new annotations',async()=>{
 const state=current093(),text=JSON.stringify({catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:state.bootstrap.characters,shop_rules:{}});
 const entities=[{entity_type:'card_annotation',entity_id:'2659',version:506,content:{tags:['내 전사 덱'],links:[]},state:'saved',issues:[]},{entity_type:'card_annotation',entity_id:'2686',version:506,content:{tags:['회복 실험'],links:[]},state:'saved',issues:[]}];
 const raw={schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:506,unchanged:false,permissions:{can_edit:true},authoring:{entities},game:{schema:1,kind:'poc-unified-game039',game_revision:506,authoring_revision:506,metadata_revision:'506',identity:GAME_IDENTITY093,payload_json:text,source_fingerprint:sha(text)}};
 const before=JSON.stringify(raw),boot=await normalizeBootstrap039(raw,webcrypto),cards=normalizeCatalog039({bootstrap:boot});assert.equal(JSON.stringify(raw),before);assert.equal(cards.length,1733);assert.deepEqual(cards.find(c=>c.source_id===2659).tags,['내 전사 덱']);assert.deepEqual(cards.find(c=>c.source_id===2686).tags,['회복 실험']);
 const bad=structuredClone(raw);bad.game.identity={...GAME_IDENTITY093,native_manifest093_sha256:'0'.repeat(64)};await assert.rejects(normalizeBootstrap039(bad,webcrypto));
 const old=structuredClone(raw);old.game.identity=GAME_IDENTITY090;assert(await normalizeBootstrap039(old,webcrypto));
});
test('093 main-deck expansion has40 unique approved identities and original card images, with existing duplicates preserved',()=>{
 const bytes=fs.readFileSync(new URL('../data/native-expansion093.json',import.meta.url));assert.equal(sha(bytes),'4e7176a1700dc4f7295d30a5866df13f37b80fa2d0b10996b3fdaf459bd27eb1');assert.equal(manifest.parentCatalogSha256,GAME_IDENTITY090.catalog090_sha256);assert.equal(manifest.cards.length,40);
 for(const [i,c] of manifest.cards.entries()){assert.equal(c.sourceId,2662+i);assert.equal(c.slot,1694+i);assert.equal(c.identity_key,sha(`unity-native093\0${c.slot}\0${c.sourceId}\0${c.code}`));assert.equal(c.type&(0x40|0x2000|0x800000|0x4000000|0x4000),0);assert(fs.readFileSync(new URL(`../assets/native093/cards/${c.sourceId}.jpg`,import.meta.url)).length>2000);}
 const cards=normalizeCatalog039(current093());assert.equal(new Set(cards.map(c=>c.code)).size,cards.length);assert.equal(cards.filter(c=>c.code===57473560).length,1);assert.equal(cards.filter(c=>c.code===40465719).length,1);assert.equal(manifest.cards.find(c=>c.code===97803170).name,'데몬이 부르는 소리');assert.equal(manifest.cards.filter(c=>c.categories.includes('지원-아로마')).length,16);
});
test('093 recent40 include prior batches while metadata remains independent from user categories',t=>{
 const state=current093(),cards=normalizeCatalog039(state),index=catalogAdditions049(cards),before=JSON.stringify(state);assert.equal(index.latest.key,'Cards093');assert.equal(index.latest.count,40);assert.equal(index.groups.find(g=>g.key==='Cards090').count,8);assert.equal(additionThemes067(cards,'Cards093',index).reduce((n,r)=>n+r.count,0),40);
 const document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);const panel=createAuthoringPanels039({document,onChange:(...a)=>writes.push(a),onError:e=>{throw e;}});panel.render('cards',root,state);t.after(()=>panel.destroy());button041(root,'최근 추가').click();assert.equal(field041(root,'추가 묶음').value,'Cards093');assert.match(root.querySelector('.au-card-results-summary').textContent,/40종/);assert.equal(writes.length,0);assert.equal(JSON.stringify(state),before);
});
test('093 every new monster, spell and trap is reachable in trait hand and matching start-field selectors',()=>{
 const cards=normalizeCatalog039(current093()),added=cards.filter(c=>c.source_id>=2662);assert.equal(added.length,40);
 for(const c of added){assert(traitCardMatches089(c));assert(sharedTraitRefMatches089(c,{slot:c.web_slot,internal_id:c.source_id,identity_key:c.identity_key}));assert.equal(traitCardMatches089(c,'shared-start-spell-trap'),Boolean(c.native_type&6));assert.equal(traitCardMatches089(c,'shared-start-monster'),Boolean(c.native_type&1));const deck=changeDeckCard039({main:[],extra:[],banlist_enabled:true},c,1,cards);assert.equal(deck.main[0].source_id,c.source_id);assert.equal(deck.main[0].identity_key,c.identity_key);}
 assert(traitCardMatches089(cards.find(c=>c.source_id===2404),'shared-start-spell-trap'));
});
test('093 cards retain ten sorts, combined filters and Korean/English search without changing source data',()=>{
 const cards=normalizeCatalog039(current093()),before=JSON.stringify(cards),added=cards.filter(c=>c.source_id>=2662);for(const [sort]of CARD_SORTS091){const ordered=sortCards091(cards,sort);assert.equal(ordered.length,1733);assert.equal(ordered.filter(c=>c.source_id>=2662).length,40);assert.equal(new Set(ordered.map(c=>c.source_id)).size,1733);}
 for(const c of added){assert(cardQueryMatches091(c,c.name_ko));assert(cardQueryMatches091(c,c.name_en));}
 const filters={race:['식물족','천사족'],attribute:['바람','빛'],tier:['SR','UR']},expected=cards.filter(c=>!c.special&&(c.native_type&1)&&['식물족','천사족'].includes(c.race)&&['바람','빛'].includes(c.attribute)&&['SR','UR'].includes(c.rarity));assert.deepEqual(cards.filter(c=>cardFiltersMatch091(c,filters)),expected);assert(expected.some(c=>c.source_id>=2662));assert.equal(JSON.stringify(cards),before);
});
test('093 Muto has three separate original portrait/cutin/defeat assets without changing Yami Yugi',()=>{
 const hashes=new Set();for(const role of ['start','cutin','lose']){const image=fs.readFileSync(new URL(`../assets/actors/native093/yugi_muto/${role}.png`,import.meta.url));assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert(image.length>50000);hashes.add(sha(image));}assert.equal(hashes.size,3);
});
for(const section of ['cards','decks'])test(`093 ${section} exact wind-card names stay visible with attribute words in the actual picker`,t=>{
 const state=current093(),document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);const panel=createAuthoringPanels039({document,onChange:(...a)=>writes.push(a),onError:e=>{throw e;}});panel.render(section,root,state);t.after(()=>panel.destroy());
 for(const name of ['은혜의 바람','메마른 바람','촉촉한 바람']){const input=field041(root,'카드 검색');input.value=name;input.fire('input');const names=root.querySelector('.au-catalog-results').querySelectorAll('.au-card-tile').map(tile=>tile.querySelector('strong').textContent);assert(names.includes(name),name);}
 assert.equal(writes.length,0);
});
