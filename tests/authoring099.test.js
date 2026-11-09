import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY093,gameIdentityMatches093} from '../authoring093-identity.js';
import {GAME_IDENTITY099,gameIdentityMatches099} from '../authoring099-identity.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {normalizeCatalog039,createAuthoringPanels039,changeDeckCard039} from '../authoring039-panels.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {traitCardMatches089,sharedTraitRefMatches089} from '../authoring089-traits.js';
import {CARD_SORTS091,sortCards091,cardQueryMatches091,cardFiltersMatch091} from '../authoring091-search.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const manifest=read('../data/native-expansion099.json'),sha=b=>createHash('sha256').update(b).digest('hex');
function current099(){const state=fixture041();state.user={id:'synthetic099'};for(const v of ['049','053','067','081','084','088','090','093','099'])state.bootstrap.catalog.cards.push(...read(`../data/native-expansion${v}.json`).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:c.categories,stock:c.playable!==false,draw_enabled:c.playable!==false})));return state;}

test('099 complete21-field identity accepts every exact historical layer and rejects mixed or partial keys',()=>{
 assert.equal(Object.keys(GAME_IDENTITY099).length,21);assert.equal(gameIdentityMatches093(GAME_IDENTITY099),false);
 for(const n of [3,5,7,9,11,13,15,17,19,21])assert(gameIdentityMatches099(Object.fromEntries(Object.entries(GAME_IDENTITY099).slice(0,n))));
 for(const n of [0,1,2,4,6,8,10,12,14,16,18,20])assert.equal(gameIdentityMatches099(Object.fromEntries(Object.entries(GAME_IDENTITY099).slice(0,n))),false);
 for(const key of Object.keys(GAME_IDENTITY099))assert.equal(gameIdentityMatches099({...GAME_IDENTITY099,[key]:'0'.repeat(64)}),false);
 assert.equal(gameIdentityMatches099({...GAME_IDENTITY099,foreign:'x'}),false);
});

test('099 publication normalizes1760 cards and preserves prior user annotations and stock edits',async()=>{
 const state=current099(),text=JSON.stringify({catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:state.bootstrap.characters,shop_rules:{}});
 const entities=[{entity_type:'card_annotation',entity_id:'2686',version:543,content:{tags:['내 회복 덱'],links:[]},state:'saved',issues:[]},{entity_type:'card_setting',entity_id:'2659',version:543,content:{stock:false,draw_enabled:false,rarity:'R'},state:'saved',issues:[]},{entity_type:'card_annotation',entity_id:'2702',version:544,content:{tags:['내 릴리스 덱'],links:[]},state:'saved',issues:[]}];
 const raw={schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:544,unchanged:false,permissions:{can_edit:true},authoring:{entities},game:{schema:1,kind:'poc-unified-game039',game_revision:544,authoring_revision:544,metadata_revision:'544',identity:GAME_IDENTITY099,payload_json:text,source_fingerprint:sha(text)}};
 const before=JSON.stringify(raw),boot=await normalizeBootstrap039(raw,webcrypto),cards=normalizeCatalog039({bootstrap:boot});assert.equal(JSON.stringify(raw),before);assert.equal(cards.length,1760);assert.deepEqual(cards.find(c=>c.source_id===2686).tags,['내 회복 덱']);assert.deepEqual(cards.find(c=>c.source_id===2702).tags,['내 릴리스 덱']);assert.equal(cards.find(c=>c.source_id===2659).stock,false);assert.equal(cards.find(c=>c.source_id===2659).draw_enabled,false);
 const bad=structuredClone(raw);bad.game.identity={...GAME_IDENTITY099,native_manifest099_sha256:'0'.repeat(64)};await assert.rejects(normalizeBootstrap039(bad,webcrypto));
 const old=structuredClone(raw);old.game.identity=GAME_IDENTITY093;assert(await normalizeBootstrap039(old,webcrypto));
});

test('099 immutable registration adds25 playable cards and2 visible deck-forbidden tokens with all27 approved images',()=>{
 assert.equal(sha(fs.readFileSync(new URL('../data/native-expansion099.json',import.meta.url))),'445e1fca34a32de0a1b2be12ab5bd5925338d39ffa98b5c492b0d92832a03ea4');
 assert.equal(manifest.parentCatalogSha256,GAME_IDENTITY093.catalog093_sha256);assert.equal(manifest.parentExpansionSha256,GAME_IDENTITY093.native_manifest093_sha256);assert.equal(manifest.cards.length,27);
 for(const [i,c]of manifest.cards.entries()){assert.equal(c.sourceId,2702+i);assert.equal(c.slot,1734+i);assert.equal(c.identity_key,sha(`unity-native099\0${c.slot}\0${c.sourceId}\0${c.code}`));const art=fs.readFileSync(new URL(`../assets/native099/cards/${c.sourceId}.jpg`,import.meta.url));assert(art.length>1000&&art[0]===0xff&&art[1]===0xd8);}
 const cards=normalizeCatalog039(current099()),added=cards.filter(c=>c.source_id>=2702);assert.equal(cards.length,1760);assert.equal(new Set(cards.map(c=>c.source_id)).size,1760);assert.equal(added.filter(c=>!c.special).length,25);assert.equal(added.filter(c=>c.token).length,2);assert.deepEqual(added.filter(c=>c.token).map(c=>c.code).sort((a,b)=>a-b),[46173680,46173681]);
 for(const c of added.filter(c=>c.token)){assert.equal(c.stock,false);assert.equal(c.draw_enabled,false);assert.equal(c.effective_normal_limit,0);for(const banlist_enabled of [false,true])assert.throws(()=>changeDeckCard039({main:[],extra:[],banlist_enabled},c,1,cards));assert.equal(traitCardMatches089(c),false);assert.equal(sharedTraitRefMatches089(c,{slot:c.web_slot,internal_id:c.source_id,identity_key:c.identity_key}),false);}
});

test('099 every playable addition is selectable in decks and matching character trait selectors',()=>{
 const cards=normalizeCatalog039(current099()),added=cards.filter(c=>c.source_id>=2702&&!c.special);assert.equal(added.length,25);
 for(const c of added){assert(traitCardMatches089(c));assert(sharedTraitRefMatches089(c,{slot:c.web_slot,internal_id:c.source_id,identity_key:c.identity_key}));assert.equal(traitCardMatches089(c,'shared-start-spell-trap'),Boolean(c.native_type&6));assert.equal(traitCardMatches089(c,'shared-start-monster'),Boolean(c.native_type&1));const deck=changeDeckCard039({main:[],extra:[],banlist_enabled:true},c,1,cards);assert.equal(deck.main[0].source_id,c.source_id);assert.equal(deck.main[0].identity_key,c.identity_key);}
 // The four Effigies are effect monsters supporting Normal Monster Tribute
 // Summons; their own printed type is not Normal Monster.
 for(const code of [54766667,81755371,53461122,99865167])assert.equal(added.find(c=>c.code===code).native_type,33);
});

test('099 recent registration view includes27 items without changing user categories or older batches',t=>{
 const state=current099(),cards=normalizeCatalog039(state),index=catalogAdditions049(cards),before=JSON.stringify(state);assert.equal(index.latest.key,'Cards099');assert.equal(index.latest.count,27);assert.equal(index.groups.find(g=>g.key==='Cards093').count,40);assert.equal(additionThemes067(cards,'Cards099',index).reduce((n,r)=>n+r.count,0),27);
 const document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);const panel=createAuthoringPanels039({document,onChange:(...a)=>writes.push(a),onError:e=>{throw e;}});panel.render('cards',root,state);t.after(()=>panel.destroy());button041(root,'최근 추가').click();assert.equal(field041(root,'추가 묶음').value,'Cards099');assert.match(root.querySelector('.au-card-results-summary').textContent,/27종/);assert.equal(writes.length,0);assert.equal(JSON.stringify(state),before);
});

test('099 cards retain every sort and combined Korean metadata filters with exact English/Korean searches',()=>{
 const cards=normalizeCatalog039(current099()),before=JSON.stringify(cards),added=cards.filter(c=>c.source_id>=2702);
 for(const [sort]of CARD_SORTS091){const list=sortCards091(cards,sort);assert.equal(list.length,1760);assert.equal(list.filter(c=>c.source_id>=2702).length,27);assert.equal(new Set(list.map(c=>c.source_id)).size,1760);}
 for(const c of added){assert(cardQueryMatches091(c,c.name_ko));assert(cardQueryMatches091(c,c.name_en));}
 const filters={race:['전사족','드래곤족'],attribute:['빛','어둠'],tier:['SR','UR']},expected=cards.filter(c=>!c.special&&(c.native_type&1)&&['전사족','드래곤족'].includes(c.race)&&['빛','어둠'].includes(c.attribute)&&['SR','UR'].includes(c.rarity));assert.deepEqual(cards.filter(c=>cardFiltersMatch091(c,filters)),expected);assert(expected.some(c=>c.source_id>=2702));
 for(const c of cards.filter(c=>cardQueryMatches091(c,'전사족 빛속성'))){assert.equal(c.race,'전사족');assert.equal(c.attribute,'빛');}assert(cards.some(c=>c.source_id>=2702&&cardQueryMatches091(c,'전사족 빛속성')));assert.equal(JSON.stringify(cards),before);
});

test('099 update leaves an existing093 web session and its unfinished draft intact on identity rejection',async t=>{
 // Reconstruct the exact previous shipped store from its two identity-hook
 // changes, then bind its original SHA before executing that actual code.
 const url=new URL('../authoring039-store.js',import.meta.url);
 let oldSource=fs.readFileSync(url,'utf8').replaceAll('\r\n','\n').replaceAll('gameIdentityMatches099','gameIdentityMatches093').replaceAll('./authoring099-identity.js?v=20261109-099','./authoring093-identity.js?v=20261106-093');
 assert.equal(sha(oldSource),'5bdd1c504a0b1ee965d6c226f34a964b5543db762525e439e8861652849b41de');
 oldSource=oldSource.replace(/from (['"])(\.\/[^'"]+)\1/g,(_all,quote,path)=>`from ${quote}${new URL(path,url).href}${quote}`);
 const {AuthoringStore039:OldStore093}=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
 const cards=current099().bootstrap.catalog.cards;
 const makeWire=(identity,count,revision)=>{const payload=JSON.stringify({catalog:cards.slice(0,count),deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:[{entity_type:'deck',entity_id:'draft099',version:543,content:{name:'기존 덱',main:[]},state:'draft',issues:[]}]},game:{schema:1,kind:'poc-unified-game039',game_revision:revision,authoring_revision:revision,metadata_revision:String(revision),identity,payload_json:payload,source_fingerprint:sha(payload)}};};
 let response=makeWire(GAME_IDENTITY093,1733,543);const calls=[],values=new Map();
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-draft099'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{calls.push({name,args});assert.equal(name,'poc_bootstrap039');assert.equal(args.p_view,'authoring');return {data:structuredClone(response)};}};
 const store=new OldStore093({client,storage,crypto:webcrypto,events:{},pollMs:0,debounceMs:100000});t.after(()=>store.stop());await store.start();
 store.patch('deck','draft099',{name:'아직 저장하지 않은 덱 이름'});
 const before={bootstrap:JSON.stringify(store.bootstrap),queue:JSON.stringify(store.queue),storage:JSON.stringify([...values]),revision:store.fetchedRevision};
 response=makeWire(GAME_IDENTITY099,1760,544);assert.equal(gameIdentityMatches093(response.game.identity),false);
 await assert.rejects(store.refresh(true),/게임 버전이 일치하지 않아/);
 assert.equal(JSON.stringify(store.bootstrap),before.bootstrap);assert.equal(JSON.stringify(store.queue),before.queue);assert.equal(JSON.stringify([...values]),before.storage);assert.equal(store.fetchedRevision,before.revision);assert.equal(store.snapshot().entities[0].content.name,'아직 저장하지 않은 덱 이름');assert.equal(store.snapshot().pending,1);assert.equal(calls.length,2);assert(calls.every(c=>c.name==='poc_bootstrap039'&&c.args.p_view==='authoring'));
});
