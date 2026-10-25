import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {NATIVE035_CATALOG,NATIVE035_BASE_BINDINGS,emptyNative035,indexNative035,parseNative035,parseLibrary035,applyReferences035,effectiveSections035,assertLegacyExport035,isExtra035,cardRef035,filterCards035} from '../native035-core.js';
import {NativeCloud035} from '../native035-cloud.js';
import {parseBundle} from '../ai-deck-core.js';
const bytes=name=>fs.readFileSync(new URL(`../data/${name}`,import.meta.url));
const read=name=>JSON.parse(bytes(name));
const base=read('native-base035.json'),expansion=read('native-expansion035.json'),legacy=read('cards.json');
const index=indexNative035(base,expansion,legacy.cards),clone=structuredClone;
const character={id:'ryo',version:1,profile:{name:'마루후지 료',portrait:'assets/native035/characters/zane.png',skills:[],skill_profiles:[{profile_id:'power',name:'파워 본드',skills:[{kind:'lp_bonus',value:1000}]}]}};
const options={characterIds:new Set(['ryo']),characterRows:[character]};
function deck(){const cards=index.cards.filter(c=>c.playable&&!c.token&&!isExtra035(c)&&c.deckLimit>=1&&c.speedLimit===null);const names=new Set(),rows=[];for(const c of [index.bySource.get(0),...cards]){const key=c.alias||c.code;if(names.has(key))continue;names.add(key);rows.push({...cardRef035(c),count:1});if(rows.length===20)break;}return {deck_id:'d1',name:'테스트 덱',character_id:'ryo',character_skill_profile_id:null,use_shared_skills:true,banlist_enabled:true,main:rows,extra:[]};}
function document(){const d=emptyNative035();d.decks=[deck()];return d;}
function library(d=document(),version=1){return {schema:1,kind:'unity-native035-library',engine:'unity-native-035',catalog_id:NATIVE035_CATALOG,version,document:d,updated_at:version?'2026-10-26T00:00:00Z':null,references:{card_limits:[],characters:[clone(character)]}};}
test('isolated files are pinned; frozen legacy dataset and registry count are untouched',()=>{
 assert.equal(createHash('sha256').update(bytes('native-expansion035.json')).digest('hex'),NATIVE035_CATALOG);
 assert.equal(createHash('sha256').update(bytes('native-base035.json')).digest('hex'),NATIVE035_BASE_BINDINGS);
 const body=Buffer.from(bytes('cards.json').toString('utf8').replaceAll('\r\n','\n'));
 assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`),body])).digest('hex'),'070a5eb0ffb842424301e9496c946ef2771170d7');
 assert.equal(legacy.cards.length,1426);assert.equal(index.cards.length,1456);assert.equal(index.cards.filter(c=>c.playable).length,1450);
 assert.deepEqual(expansion.cards.map(c=>c.sourceId),Array.from({length:30},(_,i)=>2390+i));
 assert.deepEqual(expansion.cards.map(c=>c.slot),Array.from({length:30},(_,i)=>1427+i));
 for(const c of expansion.cards){assert.equal(c.legacyExportAllowed,false);assert.equal(c.legacySlot,null);assert.match(c.nativeLuaSha256,/^[0-9a-f]{64}$/);assert.match(c.description,/[가-힣]/);assert.match(c.imageUrl,new RegExp(`/native035/cards/${c.sourceId}\\.jpg$`));}
});
test('source 0 Blue-Eyes is legal, missing ID is not zero, code-zero collection card cannot enter a deck',()=>{
 const d=document();assert.equal(index.bySource.get(0).code,89631139);assert.equal(parseNative035(d,index,options).decks[0].main[0].source_id,0);
 for(const bad of [null,undefined,'0',-1,NaN]){const changed=clone(d);changed.decks[0].main[0].source_id=bad;assert.throws(()=>parseNative035(changed,index,options));}
 const changed=clone(d),c=index.bySource.get(1910);assert.equal(c.code,0);assert.equal(c.playable,false);changed.decks[0].main[0]={...cardRef035(c),count:1};assert.throws(()=>parseNative035(changed,index,options));
});
test('base signatures and extension engine markers are checked before use',()=>{
 for(const mutate of [b=>b.cards[0].sourceId=undefined,b=>b.cards[0].identity_key='a'.repeat(64),b=>b.cards[0].code=0]){const b=clone(base);mutate(b);assert.throws(()=>indexNative035(b,expansion,legacy.cards));}
 for(const mutate of [e=>e.cards[0].legacyExportAllowed=true,e=>e.cards[0].legacySlot=1427,e=>e.cards[0].sourceId=0,e=>e.cards[0].code=0]){const e=clone(expansion);mutate(e);assert.throws(()=>indexNative035(base,e));}
});
test('typed Native document never passes an old legacy deck importer/export boundary',()=>{
 assert.throws(()=>parseBundle({schema:1,kind:'unity-native035-draft',document:document()},legacy.cards));
 assert.throws(()=>assertLegacyExport035([index.bySource.get(2390)]));assert.equal(assertLegacyExport035([index.bySource.get(0)]),true);
 const d=document();d.engine='poc-ai-deck-sync';assert.throws(()=>parseNative035(d,index,options));
});
test('source identity, exact zone, copies and complete deck sizes are enforced',()=>{
 const d=document();parseNative035(d,index,options);
 const cases=[x=>x.decks[0].main[0].identity_key='0'.repeat(64),x=>x.decks[0].main[0].count=4,x=>x.decks[0].main.push(clone(x.decks[0].main[0])),x=>x.decks[0].extra.push(x.decks[0].main.shift()),x=>x.decks[0].main.pop(),x=>x.decks[0].main[0].code=89631139];
 for(const change of cases){const bad=clone(d);change(bad);assert.throws(()=>parseNative035(bad,index,options));}
 const draft=clone(d);draft.decks[0].main=[];assert.throws(()=>parseNative035(draft,index,options));assert.equal(parseNative035(draft,index,{...options,allowIncomplete:true}).decks[0].main.length,0);
});
test('alias copies and simultaneous limited-group totals are checked across main and extra',()=>{
 const d=document(),own=clone(index);const cards=index.cards.map(c=>({...c})),first=cards.find(c=>c.sourceId===d.decks[0].main[0].source_id),second=cards.find(c=>c.sourceId===d.decks[0].main[1].source_id);second.alias=first.code;first.deckLimit=3;second.deckLimit=3;d.decks[0].main[0].count=2;d.decks[0].main[1].count=2;own.cards=cards;own.bySource=new Map(cards.map(c=>[c.sourceId,c]));assert.throws(()=>parseNative035(d,own,options),/제한/);
 first.deckLimit=1;second.deckLimit=3;d.decks[0].main[0].count=1;d.decks[0].main[1].count=1;assert.throws(()=>parseNative035(d,own,options),/제한/);first.deckLimit=3;
 second.alias=0;first.speedLimit=1;second.speedLimit=1;d.decks[0].main[0].count=1;d.decks[0].main[1].count=1;assert.throws(()=>parseNative035(d,own,options),/제한/);
 d.decks[0].banlist_enabled=false;assert.doesNotThrow(()=>parseNative035(d,own,options));d.starters=['d1'];assert.throws(()=>parseNative035(d,own,options),/시작 덱/);
});
test('shared character profiles must belong to that exact character',()=>{
 const d=document();d.decks[0].character_skill_profile_id='power';assert.equal(parseNative035(d,index,options).decks[0].character_skill_profile_id,'power');
 d.decks[0].character_skill_profile_id='unknown';assert.throws(()=>parseNative035(d,index,options));d.decks[0].character_skill_profile_id='power';d.decks[0].character_id=null;assert.throws(()=>parseNative035(d,index,options));
});
test('version zero, lab-only and disabled chapter categories preserve the old026 configuration',()=>{
 const old={starters:['old-start'],chapters:[1,2,3].map(chapter=>({chapter,battle:{tag:`old-${chapter}-battle`},elite:{tag:`old-${chapter}-elite`},boss:{tag:`old-${chapter}-boss`}})),nativeSettings:['old']};
 const d=document(),l=library(d);assert.deepEqual(effectiveSections035(l,old),old);d.applySections.starters=true;d.starters=['d1'];assert.deepEqual(effectiveSections035(library(d,0),old),old);
 const next=effectiveSections035(library(d),old);assert.equal(next.starters[0].deck_id,'d1');assert.deepEqual(next.chapters,old.chapters);
 d.applySections.chapters=true;d.chapters[1].elite={enabled:true,lp_bonus:1200,entries:[{deck_id:'d1',weight:3}]};parseNative035(d,index,options);
 const out=effectiveSections035(library(d),old);assert.deepEqual(out.chapters[1].elite,d.chapters[1].elite);assert.deepEqual(out.chapters[1].boss,old.chapters[1].boss);assert.deepEqual(out.chapters[0],old.chapters[0]);assert.deepEqual(out.chapters[2],old.chapters[2]);
 out.chapters[1].elite.entries[0].weight=99;assert.equal(d.chapters[1].elite.entries[0].weight,3);assert.equal(old.chapters[1].elite.tag,'old-2-elite');
});
test('starters and chapter pools reject duplicate, missing, empty-enabled and malformed references',()=>{
 for(const change of [d=>{d.applySections.starters=true;},d=>{d.starters=['d1','d1'];},d=>{d.starters=['missing'];},d=>{d.chapters[0].boss.enabled=true;},d=>{d.chapters[0].boss.entries=[{deck_id:'d1',weight:0}];},d=>{d.chapters[1].chapter=1;},d=>{d.chapters[0].boss.lp_bonus=50001;}]){const d=document();change(d);assert.throws(()=>parseNative035(d,index,options));}
});
test('only explicit extension settings can be overlaid; base settings stay in the existing RPC',()=>{
 const d=document(),c=index.bySource.get(2390);d.applySections.settings=true;d.settings=[{...cardRef035(c),rarity:'UR',stock:false,draw_enabled:false}];assert.deepEqual(parseNative035(d,index,options).settings,d.settings);
 const out=effectiveSections035(library(d),{baseSettings:['keep']});assert.deepEqual(out.baseSettings,['keep']);assert.equal(out.nativeSettings[0].rarity,'UR');
 for(const mutate of [v=>v.settings[0].source_id=0,v=>v.settings[0].rarity='L',v=>v.settings.push(clone(v.settings[0]))]){const bad=clone(d);mutate(bad);assert.throws(()=>parseNative035(bad,index,options));}
});
test('reference snapshots apply current exact-identity limits without mutating shared catalog state',()=>{
 const c=index.bySource.get(0),before=c.deckLimit,refs={card_limits:[{slot:c.slot,internal_id:0,identity_key:c.identity_key,normal_limit:1,speed_limit:2,version:1}],characters:[character]};
 const result=applyReferences035(refs,index);assert.equal(result.index.bySource.get(0).deckLimit,1);assert.equal(result.index.bySource.get(0).speedLimit,2);assert.equal(c.deckLimit,before);
 result.characters[0].profile.name='changed';assert.equal(character.profile.name,'마루후지 료');const bad=clone(refs);bad.card_limits[0].identity_key='a'.repeat(64);assert.throws(()=>applyReferences035(bad,index));
 const lib=library();lib.references=refs;assert.doesNotThrow(()=>parseLibrary035(lib,index));lib.document.decks[0].main[0].count=2;assert.throws(()=>parseLibrary035(lib,index));
});
test('online save uses exact CAS and Native RPC names; failed reads cannot replace valid state',async()=>{
 const calls=[];let remote=library(document(),3);const fake={rpc:async(name,args)=>{calls.push({name,args});if(name==='poc_load_native035_library')return {data:clone(remote)};if(args.p_expected_version!==remote.version)return {error:{message:'poc_conflict'}};remote=library(clone(args.p_document),remote.version+1);return {data:clone(remote)};}};
 const cloud=new NativeCloud035(fake,index);const loaded=await cloud.load();assert.equal(loaded.version,3);const d=clone(loaded.document);d.decks[0].name='바꾼 덱';const saved=await cloud.save(d,3);assert.equal(saved.version,4);assert.equal(remote.document.decks[0].name,'바꾼 덱');await assert.rejects(()=>cloud.save(d,3));assert.ok(calls.every(c=>c.name.startsWith('poc_')&&c.name.includes('native035')));const old=cloud.index;remote.references.card_limits=[{}];await assert.rejects(()=>cloud.load());assert.equal(cloud.index,old);
});
test('catalog engine filters and Korean/English aliases find all thirty new cards without merging legacy data',()=>{
 assert.equal(filterCards035(index,{engine:'native'}).length,30);assert.equal(filterCards035(index,{engine:'legacy'}).length,1420);assert.equal(filterCards035(index,{engine:'all'}).length,1450);
 assert.equal(filterCards035(index,{engine:'native',query:'cyber dragon core'})[0].sourceId,2397);assert.equal(filterCards035(index,{engine:'native',query:'엔틱기어와이반'})[0].sourceId,2406);assert.equal(filterCards035(index,{engine:'native',kind:'trap'}).length,8);
});
