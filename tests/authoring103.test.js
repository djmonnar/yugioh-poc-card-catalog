import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY099} from '../authoring099-identity.js';
import {GAME_IDENTITY103,gameIdentityMatches103} from '../authoring103-identity.js';
import {normalizeBootstrap039,PROJECT039,AuthoringStore039} from '../authoring039-store.js';
import {normalizeCatalog039,createAuthoringPanels039,changeDeckCard039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {traitCardMatches089,sharedTraitRefMatches089} from '../authoring089-traits.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {CARD_SORTS091,sortCards091,cardQueryMatches091,cardFiltersMatch091} from '../authoring091-search.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const manifest=read('../data/native-expansion103.json'),sha=b=>createHash('sha256').update(b).digest('hex'),CHAR='traits103-character';
const ref=c=>({slot:c.slot,internal_id:c.source_id,identity_key:c.identity_key,name_ko:c.name_ko});
function current103(with103=true){const state=fixture041();state.user={id:'synthetic103'};for(const v of ['049','053','067','081','084','088','090','093','099',...(with103?['103']:[])])state.bootstrap.catalog.cards.push(...read(`../data/native-expansion${v}.json`).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:c.categories??[c.category],stock:c.playable!==false,draw_enabled:c.playable!==false})));return state;}
function wire(identity,revision,state=current103(identity===GAME_IDENTITY103)){
 const payload=JSON.stringify({catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:state.bootstrap.characters,shop_rules:{}});
 return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:revision,unchanged:false,permissions:{can_edit:true},authoring:{entities:[{entity_type:'deck',entity_id:'draft103',version:615,content:{name:'기존 덱',main:[]},state:'draft',issues:[]}]},game:{schema:1,kind:'poc-unified-game039',game_revision:revision,authoring_revision:revision,metadata_revision:String(revision),identity,payload_json:payload,source_fingerprint:sha(payload)}};
}
function mount(t,state,section='characters',id=CHAR){const document=new Document041(),root=document.createElement('main'),writes=[],errors=[];document.body.append(root);const panels=createAuthoringPanels039({document,onChange:(...a)=>writes.push(structuredClone(a)),onError:e=>errors.push(e)});panels.selectEntity065(section,id);if(section==='decks')panels.selectDeck(id);panels.render(section,root,state);t.after(()=>panels.destroy());return {root,panels,writes,errors};}
function pick(root,key,target){const input=root.querySelectorAll('input').find(n=>n.dataset.editKey===key);assert(input,`picker ${key}`);const box=input.parentElement,search=field041(box,'대상 카드 검색');search.value=target.name_ko;search.fire('input');const button=box.querySelectorAll('.au-card-pick').find(n=>n.textContent.replace(/ ✓$/,'')===target.name_ko);assert(button,`select ${target.source_id}`);assert.equal(button.disabled,false);button.click();}
function character(state,skills,profiles=[]){state.entities.push({entity_type:'character',entity_id:CHAR,version:1,state:'saved',issues:[],content:{name:'기존 사용자 캐릭터',portrait:'',skills,skill_profiles:profiles}});}

test('103 complete23-field identity accepts every exact earlier layer, rejects partial and mixed identities',()=>{
 assert.equal(Object.keys(GAME_IDENTITY103).length,23);assert.deepEqual(Object.fromEntries(Object.entries(GAME_IDENTITY103).slice(0,21)),GAME_IDENTITY099);
 for(const n of [3,5,7,9,11,13,15,17,19,21,23])assert(gameIdentityMatches103(Object.fromEntries(Object.entries(GAME_IDENTITY103).slice(0,n))));
 for(const n of [0,1,2,4,6,8,10,12,14,16,18,20,22])assert.equal(gameIdentityMatches103(Object.fromEntries(Object.entries(GAME_IDENTITY103).slice(0,n))),false);
 for(const key of Object.keys(GAME_IDENTITY103))assert.equal(gameIdentityMatches103({...GAME_IDENTITY103,[key]:'0'.repeat(64)}),false);
 assert.equal(gameIdentityMatches103({...GAME_IDENTITY103,foreign:'x'}),false);
});

test('103 registration has15 playable main cards, exact identities, existing support taxonomy and approved artwork',()=>{
 assert.equal(sha(fs.readFileSync(new URL('../data/native-expansion103.json',import.meta.url))),'fbc1f60d9c8f80e1b45de7402859e68a82c60e32585cc984084a5399246675a5');assert.equal(manifest.parentCatalogSha256,GAME_IDENTITY099.catalog099_sha256);assert.equal(manifest.parentExpansionSha256,GAME_IDENTITY099.native_manifest099_sha256);
 assert.equal(manifest.cards.length,15);for(const[i,c]of manifest.cards.entries()){assert.equal(c.sourceId,2729+i);assert.equal(c.slot,1761+i);assert.equal(c.identity_key,sha(`unity-native103\0${c.slot}\0${c.sourceId}\0${c.code}`));assert(c.playable&&!c.token);assert.equal(c.type&(0x40|0x2000|0x800000|0x4000000|0x4000),0);assert((c.categories??[c.category]).every(t=>['지원-의식','지원-융합','지원-장착'].includes(t)));const art=fs.readFileSync(new URL(`../assets/native103/cards/${c.sourceId}.jpg`,import.meta.url));assert(art.length>1000&&art[0]===0xff&&art[1]===0xd8);}
});

test('103 updated editor accepts both0991760 and1031775 publications without losing user annotations or stock settings',async()=>{
 for(const[identity,count,revision]of [[GAME_IDENTITY099,1760,616],[GAME_IDENTITY103,1775,617]]){const raw=wire(identity,revision);raw.authoring.entities.push({entity_type:'card_annotation',entity_id:'2702',version:615,state:'saved',issues:[],content:{tags:['사용자 기존 분류'],links:[]}},{entity_type:'card_setting',entity_id:'2659',version:615,state:'saved',issues:[],content:{stock:false,draw_enabled:false,rarity:'R'}});const before=JSON.stringify(raw),boot=await normalizeBootstrap039(raw,webcrypto),cards=normalizeCatalog039({bootstrap:boot});assert.equal(cards.length,count);assert.equal(new Set(cards.map(c=>c.source_id)).size,count);assert.deepEqual(cards.find(c=>c.source_id===2702).tags,['사용자 기존 분류']);assert.equal(cards.find(c=>c.source_id===2659).stock,false);assert.equal(cards.find(c=>c.source_id===2659).draw_enabled,false);assert.equal(JSON.stringify(raw),before);}
});

test('103 every new card is legal in decks, hand/grave traits, profiles and its matching monster or spell/trap field trait',()=>{
 const state=current103();character(state,[]);const before=JSON.stringify(state),cards=normalizeCatalog039(state),added=cards.filter(c=>c.source_id>=2729);assert.equal(added.length,15);assert.equal(cards.length,1775);
 for(const c of added){assert(traitCardMatches089(c));assert(sharedTraitRefMatches089(c,ref(c)));assert.equal(traitCardMatches089(c,'shared-start-spell-trap'),Boolean(c.native_type&6));assert.equal(traitCardMatches089(c,'shared-start-monster'),Boolean(c.native_type&1));for(const banlist_enabled of [false,true]){const deck=changeDeckCard039({main:[],extra:[],banlist_enabled},c,1,cards);assert.deepEqual(deck.main,[{source_id:c.source_id,identity_key:c.identity_key,count:1}]);}
  const skills=[{kind:'start_hand',card:ref(c)},{kind:'start_grave',entries:[{card:ref(c),count:1}]},...(c.native_type&1?[{kind:'start_monster',card:ref(c),position:'attack'}]:[{kind:'start_field',card:ref(c)}])];assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',CHAR,{skills}));assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',CHAR,{skill_profiles:[{profile_id:'profile103',name:'저장된 특성 묶음',skills}]}));assert.throws(()=>validateAuthoringChange066(state,'character',CHAR,{skills:[{kind:'start_hand',card:{...ref(c),identity_key:'0'.repeat(64)}}]}));
 }
 assert.equal(cards.filter(c=>c.token).length,7);for(const c of cards.filter(c=>c.token)){assert.equal(traitCardMatches089(c),false);assert.throws(()=>changeDeckCard039({main:[],extra:[],banlist_enabled:false},c,1,cards));}assert.equal(JSON.stringify(state),before);
});

test('103 actual shared character hand and spell/trap pickers select every new eligible card and keep other saved traits',async t=>{
 const catalog=normalizeCatalog039(current103()),added=catalog.filter(c=>c.source_id>=2729),initial=catalog.find(c=>c.source_id===2404);
 for(const target of added)for(const kind of ['start_hand',...(target.native_type&6?['start_field']:[])]){const state=current103(),heal={kind:'heal_once',value:900};character(state,[{kind,card:ref(initial)},heal]);const before=JSON.stringify(state),ui=mount(t,state);pick(ui.root,`character:${CHAR}.skills.0.card`,target);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(ui.errors,[]);assert.equal(ui.writes.length,1);assert.deepEqual(ui.writes[0],['character',CHAR,{skills:[{kind,card:ref(target)},heal]},{operation:'patch'}]);assert.doesNotThrow(()=>validateAuthoringChange066(state,...ui.writes[0]));assert.equal(JSON.stringify(state),before);}
});

test('103 recent view adds15 with named support groups while keeping099 and an unfinished older selection',t=>{
 const state=current103(),cards=normalizeCatalog039(state),index=catalogAdditions049(cards);assert.equal(index.latest.key,'Cards103');assert.equal(index.latest.count,15);assert.equal(index.groups.find(g=>g.key==='Cards099').count,27);assert.equal(additionThemes067(cards,'Cards103',index).reduce((n,r)=>n+r.count,0),15);const before=JSON.stringify(state),ui=mount(t,state,'cards');button041(ui.root,'최근 추가').click();assert.equal(field041(ui.root,'추가 묶음').value,'Cards103');assert.match(ui.root.querySelector('.au-card-results-summary').textContent,/15종/);const select=field041(ui.root,'추가 묶음');select.value='Cards099';select.fire('change');assert.match(ui.root.querySelector('.au-card-results-summary').textContent,/27종/);ui.panels.render('cards',ui.root,structuredClone(state),{force:true});assert.equal(field041(ui.root,'추가 묶음').value,'Cards099');assert.deepEqual(ui.errors,[]);assert.equal(ui.writes.length,0);assert.equal(JSON.stringify(state),before);
});

test('103 all sorts and intersecting metadata searches include new ritual/fusion support without changing tags',()=>{
 const cards=normalizeCatalog039(current103()),before=JSON.stringify(cards),added=cards.filter(c=>c.source_id>=2729);for(const[sort]of CARD_SORTS091){const list=sortCards091(cards,sort);assert.equal(list.length,1775);assert.equal(list.filter(c=>c.source_id>=2729).length,15);assert.equal(new Set(list.map(c=>c.source_id)).size,1775);}for(const c of added){assert(cardQueryMatches091(c,c.name_ko));assert(cardQueryMatches091(c,c.name_en));}const expected=cards.filter(c=>!c.special&&(c.native_type&1)&&c.attribute==='어둠'&&c.rarity==='SR');assert.deepEqual(cards.filter(c=>cardFiltersMatch091(c,{attribute:['어둠'],tier:['SR']})),expected);for(const c of cards.filter(c=>cardQueryMatches091(c,'악마족 어둠속성'))){assert.equal(c.race,'악마족');assert.equal(c.attribute,'어둠');}assert.equal(JSON.stringify(cards),before);
});

test('103 an open099 editor refreshes to103 with its unfinished draft intact and rejects a later mixed identity safely',async t=>{
 let response=wire(GAME_IDENTITY099,616);const values=new Map(),calls=[],storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))},client={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-draft103'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{calls.push({name,args});assert.equal(name,'poc_bootstrap039');assert.equal(args.p_view,'authoring');return {data:structuredClone(response)};}};
 const store=new AuthoringStore039({client,storage,crypto:webcrypto,events:{},pollMs:0,debounceMs:100000});t.after(()=>store.stop());await store.start();store.patch('deck','draft103',{name:'아직 저장하지 않은 기존 덱'});const queue=JSON.stringify(store.queue),saved=JSON.stringify([...values]);response=wire(GAME_IDENTITY103,617);await store.refresh(true);assert.equal(store.fetchedRevision,617);assert.equal(store.snapshot().entities[0].content.name,'아직 저장하지 않은 기존 덱');assert.equal(store.snapshot().pending,1);assert.equal(JSON.stringify(store.queue),queue);assert.equal(JSON.stringify([...values]),saved);assert.equal(normalizeCatalog039({bootstrap:store.bootstrap}).length,1775);const bootstrap=JSON.stringify(store.bootstrap);response=wire({...GAME_IDENTITY103,native_manifest103_sha256:'0'.repeat(64)},618,current103());await assert.rejects(store.refresh(true),/게임 버전이 일치하지 않아/);assert.equal(JSON.stringify(store.bootstrap),bootstrap);assert.equal(JSON.stringify(store.queue),queue);assert.equal(JSON.stringify([...values]),saved);assert.equal(store.fetchedRevision,617);assert.equal(calls.length,3);
});

test('103 committing an already rendered search preserves its result button until the first deck-add click',async t=>{
 const state=current103(),target=normalizeCatalog039(state).find(c=>c.source_id===2729),deck=state.entities.find(e=>e.entity_type==='deck'),ui=mount(t,state,'decks',deck.entity_id),search=field041(ui.root,'카드 검색');search.value=target.name_ko;search.fire('input');const findPlus=()=>ui.root.querySelectorAll('button').find(b=>b.getAttribute('aria-label')===target.name_ko+' 추가'),plus=findPlus();assert(plus);assert.equal(plus.disabled,false);
 for(const event of ['compositionend','change','search']){search.fire(event);assert.equal(findPlus(),plus,`${event} must not replace the result being clicked`);}
 plus.click();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(ui.errors,[]);assert.equal(ui.writes.length,1);assert.equal(ui.writes[0][0],'deck');assert(ui.writes[0][2].main.some(c=>c.source_id===target.source_id));
});
