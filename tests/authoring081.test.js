import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {GAME_IDENTITY067,gameIdentityMatches067} from '../authoring067-identity.js';
import {GAME_IDENTITY081,gameIdentityMatches081} from '../authoring081-identity.js';
import {normalizeBootstrap039,PROJECT039} from '../authoring039-store.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {ADDITION_BATCHES081} from '../authoring081-batch-data.js';
import {portraitUrl081} from '../authoring081-assets.js';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const bytes=fs.readFileSync(new URL('../data/native-expansion081.json',import.meta.url)),manifest=JSON.parse(bytes),sha=value=>createHash('sha256').update(value).digest('hex');
function fixture081(){
  const state=fixture041();state.user={id:'synthetic-081'};
  for(const version of ['049','053','067','081'])state.bootstrap.catalog.cards.push(...read(`../data/native-expansion${version}.json`).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:[],stock:true,draw_enabled:true})));
  const prior=state.bootstrap.characters;for(let i=prior.length;i<19;i++)prior.push({id:`synthetic-character-${i}`,version:1,profile_id:`synthetic_${i}`,art_key:'',profile:{name:`기존 합성 캐릭터 ${i}`,portrait:'',skills:[],skill_profiles:[]}});
  prior.push({id:'character-esper-roba-081',version:1,profile_id:'esper_roba',art_key:'Character081/images/esper_roba/start',profile:{name:'에스퍼 로바',portrait:'assets/actors/esper-roba081/start.png',skills:[],skill_profiles:[]}});
  return state;
}
test('081 accepts the exact eleven pins and every complete older layer, rejects foreign/partial keys',()=>{
  assert.equal(Object.keys(GAME_IDENTITY081).length,11);
  for(const count of [3,5,7,9,11])assert.equal(gameIdentityMatches081(Object.fromEntries(Object.entries(GAME_IDENTITY081).slice(0,count))),true);
  for(const count of [0,1,2,4,6,8,10])assert.equal(gameIdentityMatches081(Object.fromEntries(Object.entries(GAME_IDENTITY081).slice(0,count))),false);
  assert.equal(gameIdentityMatches067(GAME_IDENTITY081),false);
  for(const key of Object.keys(GAME_IDENTITY081))assert.equal(gameIdentityMatches081({...GAME_IDENTITY081,[key]:'0'.repeat(64)}),false);
  assert.equal(gameIdentityMatches081({...GAME_IDENTITY081,extra:'foreign'}),false);
  assert.equal(gameIdentityMatches081(null),false);assert.equal(gameIdentityMatches081([]),false);
});
test('same authoring bootstrap shape admits081 catalog and20 characters without rewriting entity versions or custom edits',async()=>{
  const state=fixture081(),custom={entity_type:'card_display',entity_id:'2588',version:27,deleted:false,content:{name:'내가 고친 증폭기 이름',description:'내 설명'},state:'saved',issues:[]};
  const payload={catalog:state.bootstrap.catalog.cards,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:state.bootstrap.characters,shop_rules:{}};
  const text=JSON.stringify(payload),raw={schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:332,unchanged:false,permissions:{can_edit:true},authoring:{entities:[custom]},game:{schema:1,kind:'poc-unified-game039',game_revision:332,authoring_revision:332,metadata_revision:'319',identity:GAME_IDENTITY081,payload_json:text,source_fingerprint:sha(text)}};
  const before=JSON.stringify(raw),boot=await normalizeBootstrap039(raw,webcrypto);assert.equal(JSON.stringify(raw),before);
  assert.equal(boot.gamePayload.catalog.length,1634);assert.equal(boot.gamePayload.characters.length,20);assert.equal(boot.authoring.entities[0].version,27);
  const cards=normalizeCatalog039({bootstrap:boot});assert.equal(cards.find(c=>c.source_id===2588).name_ko,'내가 고친 증폭기 이름');
  const bad=structuredClone(raw);bad.game.identity={...GAME_IDENTITY081,catalog081_sha256:'0'.repeat(64)};await assert.rejects(normalizeBootstrap039(bad,webcrypto));
  const old=structuredClone(raw);old.game.identity=GAME_IDENTITY067;assert.ok(await normalizeBootstrap039(old,webcrypto));
});
test('published081 registry has the exact fifteen non-Xyz identities and immutable067 lineage',()=>{
  assert.equal(sha(bytes),'7226daa59d8aee6ac6d2f4f860fdb39b30ca578b00a5300d6e8fb0f3c2bbe019');
  assert.equal(manifest.parentCatalogSha256,GAME_IDENTITY067.catalog067_sha256);assert.equal(manifest.parentExpansionSha256,GAME_IDENTITY067.native_manifest067_sha256);
  assert.equal(manifest.cards.length,15);assert.equal(new Set(manifest.cards.map(c=>c.identity_key)).size,15);
  for(const [i,c] of manifest.cards.entries()){assert.equal(c.sourceId,2588+i);assert.equal(c.slot,1620+i);assert.equal(c.identity_key,sha(`unity-native081\0${c.slot}\0${c.sourceId}\0${c.code}`));assert.equal(c.type&0x800000,0);assert.notEqual(c.code,99666430);assert.equal(c.artKey,`Cards081/${c.sourceId}`);assert.match(c.imageUrl,new RegExp(`/assets/native081/cards/${c.sourceId}\\.jpg$`));}
  assert.deepEqual(manifest.cards.slice(-2).map(c=>[c.sourceId,c.code]),[[2601,30492798],[2602,33145233]]);
});
test('recent081 selection exposes15 cards and13/2 themes while preserving user names/categories and existing batches',t=>{
  const state=fixture081();state.entities.push({entity_type:'card_annotation',entity_id:'2588',version:9,content:{tags:['내 분류'],links:[]}});
  const cards=normalizeCatalog039(state),before=JSON.stringify(state),index=catalogAdditions049(cards);
  assert.equal(cards.length,1634);assert.equal(index.latest.key,'Cards081');assert.equal(index.latest.count,15);
  assert.deepEqual(additionThemes067(cards,'Cards081',index).map(t=>[t.label,t.count]),[['인조인간',13],['의식마인',2]]);
  assert.equal(index.groups.find(g=>g.key==='Cards067').count,37);assert.deepEqual(cards.find(c=>c.source_id===2588).tags,['내 분류']);
  assert.equal(JSON.stringify(state),before);assert.equal(ADDITION_BATCHES081[0].themes.flatMap(t=>t.members).length,15);
  const document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(args),onError:error=>{throw error;}});panels.render('cards',root,state);t.after(()=>panels.destroy());
  button041(root,'최근 추가').click();assert.equal(field041(root,'추가 묶음').value,'Cards081');assert.match(root.querySelector('.au-card-results-summary').textContent,/15종.*인조인간·의식마인/);
  const theme=root.querySelector('.au-addition-themes067').querySelectorAll('button').find(b=>b.dataset.theme==='의식마인');theme.click();assert.match(root.querySelector('.au-card-results-summary').textContent,/2종.*의식마인/);assert.equal(writes.length,0);
});
test('Esper original images remain exact and local aliases never overwrite custom or empty portraits',()=>{
  const pins={start:'983991e4c9fc687898944ca6eaf6fe0cbf1e236ca78611ad83a9781f3e5a18b3',cutin:'7ada675eb1e2d177df9d94d385356e43c00476d3665dcd788e711aeb2a90bb43',lose:'8b4c5f5b36078b1804f462a0367d78c49083259ba801f8774f6b218828e1a5fd'};
  for(const [stage,hash] of Object.entries(pins)){const path=`assets/actors/esper-roba081/${stage}.png`;assert.equal(portraitUrl081(`Character081/images/esper_roba/${stage}`),path);assert.equal(sha(fs.readFileSync(new URL('../'+path,import.meta.url))),hash);}
  for(const value of ['',null,'https://custom.example/portrait.png','assets/my-custom.png','CharacterPresentation012/images/yugi/start'])assert.equal(portraitUrl081(value),value);
});
