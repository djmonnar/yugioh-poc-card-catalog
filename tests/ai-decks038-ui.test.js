import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {indexNative035,isExtra035,assertLegacyExport035,NATIVE035_CATALOG} from '../native035-core.js';
import {mergeCatalogNative035} from '../catalog-native035.js';
import {builderSearchText,builderCardMatches} from '../ai-deck-filters.js';
import {emptyDeck,exportBundle,GROUPS} from '../ai-deck-core.js';
import {fromBuilderNative038,toBuilderNative038} from '../ai-native038.js';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const source=read('ai-decks.js'),html=read('ai-decks.html'),base=JSON.parse(read('data/native-base035.json')),extra=JSON.parse(read('data/native-expansion035.json')),catalog=JSON.parse(read('data/cards.json'));
const index=indexNative035(base,extra,catalog.cards),views=mergeCatalogNative035(catalog,extra).cards;
function fn(name){const re=new RegExp(`^(?:async )?function ${name}\\(`,'m'),start=re.exec(source);assert.ok(start,`Missing real UI function ${name}`);const rest=source.slice(start.index),next=/\n(?:async )?function \w+\(/.exec(rest);return next?rest.slice(0,next.index):rest.slice(0,rest.indexOf("\n$('builder-search')"));}
function context(names,values={}){const c=vm.createContext({console,structuredClone,URLSearchParams,Set,Map,...values});for(const name of names)vm.runInContext(fn(name),c);return c;}
function typed(name='앤틱 기어 초급'){const eligible=index.cards.filter(c=>c.playable&&!c.token&&!isExtra035(c));return {deck_id:'deck-ui038',name,character_id:null,character_skill_profile_id:null,use_shared_skills:true,banlist_enabled:false,main:eligible.slice(0,20).map(c=>({source_id:c.sourceId,identity_key:c.identity_key,count:1})),extra:[]};}
function nodes(){const map=new Map();return id=>{if(!map.has(id))map.set(id,{textContent:'',disabled:false,children:[],append(...xs){this.children.push(...xs);},replaceChildren(...xs){this.children=xs;}});return map.get(id);};}
function redirect(file,path){const page=read(file),scripts=[...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)],href=new URL(path,'https://example.test/yugioh-poc-card-catalog/').href,calls=[];assert.equal(scripts.length,1,file);const c=vm.createContext({URL,location:{href,replace(value){calls.push(value);}}});vm.runInContext(scripts[0][1],c,{timeout:1000});assert.equal(calls.length,1,file);return new URL(calls[0],href);}

test('same builder keeps legacy route meanings and makes explicit Unity the highest priority',()=>{
  const c=context(['initialEngine038']);
  for(const [q,old,want] of [['',false,'unity'],['',true,'legacy'],['engine=unity',true,'unity'],['engine=legacy',false,'legacy'],['recipe=DLR_001.ydc',false,'legacy'],['new=1&mode=classic',false,'legacy'],['new=1&mode=duel_links_plan',false,'legacy'],['new=1',false,'legacy'],['engine=unity&recipe=DLR_001.ydc',true,'unity'],['engine=unity&new=1&mode=classic',true,'unity']])assert.equal(c.initialEngine038(new URLSearchParams(q),old),want,q);
});
test('Native search finds all 30 by English name and code plus both 앤틱 and 엔틱 spellings',()=>{
  const c=context(['nativeSearchText038'],{nativeIndex:index,builderSearchText});
  for(const card of views.filter(c=>c.nativeOnly)){const projected={...card,searchText:c.nativeSearchText038(card)};for(const query of [card.name_en,String(card.code),...(card.searchAliases||[])])assert.equal(builderCardMatches(projected,{query}),true,query);}
  const gear=views.find(c=>c.nativeOnly&&c.name_ko.includes('앤틱'));assert.ok(gear);const projected={...gear,searchText:c.nativeSearchText038(gear)};assert.equal(builderCardMatches(projected,{query:'앤틱'}),true);assert.equal(builderCardMatches(projected,{query:'엔틱'}),true);
});
test('legacy empty draft copies to Unity without deleting the name, strategy or original recipe',()=>{
  const old=emptyDeck('old-ui038','classic');old.name='앤틱 기어 초급';old.strategy.goal='기존 메모 보존';old.source_recipe={filename:'cpu_001.ydc',sha256:'a'.repeat(64),difficulty_levels:[1]};const before=JSON.stringify(old),messages=[];
  const c=context(['copyLegacyToUnity038'],{engine:'legacy',nativeReady:true,nativeIndex:index,unityCards:views,nativeState:{decks:[],active:null},current:()=>old,uid:()=> 'copy-ui038',fromBuilderNative038,toBuilderNative038,setEngine038(next){c.engine=next;},persist(){},switchView(){},toast:m=>messages.push(m)});c.copyLegacyToUnity038();
  assert.equal(JSON.stringify(old),before);assert.equal(c.engine,'unity');assert.equal(c.nativeState.decks.length,1);assert.equal(c.nativeState.decks[0].name,old.name);assert.equal(c.nativeState.decks[0].groups.main.length,0);assert.equal(c.nativeState.decks[0].source_recipe,undefined);assert.equal(c.nativeState.decks[0].deck_id,'deck-copy-ui038');assert.match(messages[0],/기존 덱/);
});
test('legacy side deck or 31-card conversion fails without changing either source or destination',()=>{
  for(const kind of ['side','overflow']){const old=toBuilderNative038(typed(),index,views);if(kind==='side')old.groups.side=[structuredClone(old.groups.main[0])];else{old.groups.main=old.groups.main.slice(0,11).map(r=>({...r,count:3}));}const before=JSON.stringify(old),messages=[];
    const c=context(['copyLegacyToUnity038'],{engine:'legacy',nativeReady:true,nativeIndex:index,unityCards:views,nativeState:{decks:[],active:null},current:()=>old,uid:()=>kind,fromBuilderNative038,toBuilderNative038,setEngine038(){throw Error('Should not switch');},persist(){throw Error('Should not persist');},switchView(){},toast:m=>messages.push(m)});c.copyLegacyToUnity038();assert.equal(JSON.stringify(old),before);assert.equal(c.nativeState.decks.length,0);assert.equal(c.engine,'legacy');assert.equal(messages.length,1);}
});
test('legacy packet and bundle guard blocks Native identities but keeps old incomplete drafts exportable',()=>{
  const old=emptyDeck('old-ui038'),c=context(['assertLegacyDecks038','bundle'],{engine:'legacy',GROUPS,legacyCards:catalog.cards,unityCards:views,assertLegacyExport035,exportBundle,meta:catalog.meta,decks:[old]});assert.equal(c.bundle().kind,'poc-ai-deck-bundle');const wrong=structuredClone(old);wrong.groups.main=[{identity_key:extra.cards[0].identity_key,slot:1427,internal_id:2390,name_ko:'타이푼',name_en:'Typhoon',count:1}];assert.throws(()=>c.bundle([wrong]),/Unity/);c.engine='unity';assert.throws(()=>c.assertLegacyDecks038([old]),/Unity/);
});
test('Native save handler submits the unchanged draft version and links the stable deck ID to chapter assignment',async()=>{
  const ui=toBuilderNative038(typed(),index,views),get=nodes(),calls=[];const session={loaded:true,version:7,async saveSelected(value,version){calls.push({value,version});this.version=8;}};
  const c=context(['onlineFlowMessage038','saveNativeOnline038'],{$:get,el:(tag,text)=>({tag,textContent:text,href:''}),canEdit:true,saveDeckId:ui.deck_id,active:ui.deck_id,engine:'unity',nativeBlocked:false,current:()=>ui,nativeIndex:index,nativeDraftVersion:7,nativeSession:session,fromBuilderNative038,syncNativeSession038(){},persist(){},toast(){},cloudError:e=>e.message});await c.saveNativeOnline038();assert.equal(calls.length,1);assert.equal(calls[0].version,7);assert.equal(calls[0].value.deck_id,ui.deck_id);assert.equal(c.nativeDraftVersion,8);assert.equal(get('online-dialog-status').children[1].href,`native035.html?deck=${ui.deck_id}#chapters`);assert.match(get('online-status').textContent,/온라인 편성을 불러온 뒤 새 원정/);
});
test('historical Native handlers keep backup and version guards while their old page redirects to the unified editor',()=>{
  assert.match(source,/if\(!nativeLoadBackedUp\|\|engine!=='unity'\)return/);assert.match(source,/replaceNativeFromOnline038\(true\)/);assert.match(source,/saveSelected\(typed,nativeDraftVersion\)/);assert.doesNotMatch(fn('saveNativeOnline038'),/nativeSession\.load\(/);
  const target=redirect('ai-decks.html','ai-decks.html?engine=unity&deck=deck-preserved');assert.equal(target.pathname,'/yugioh-poc-card-catalog/index.html');assert.equal(target.searchParams.get('section'),'decks');assert.equal(target.searchParams.get('deck'),'deck-preserved');assert.doesNotMatch(html,/<script\b[^>]*src=["'][^"']*ai-decks\.js|<iframe/);
});
test('legacy builder and assignment links preserve deck IDs, section aliases and card-zero hashes through real redirect scripts',()=>{
  for(const file of ['ai-decks.html','native035.html'])for(const [suffix,section,deck,hash] of [
    ['', 'decks',null,''],['?deck=deck-123#chapters','chapters','deck-123',''],['?deck=한글 덱#starters','starters','한글 덱',''],['#settings','cards',null,''],['?tab=events#chapters','events',null,''],['?tab=shop','shop',null,''],['?deck=deck-zero#card-0','decks','deck-zero','#card-0'],['#not-a-section','decks',null,'']
  ]){const target=redirect(file,file+suffix);assert.equal(target.pathname,'/yugioh-poc-card-catalog/index.html',file+suffix);assert.equal(target.searchParams.get('section'),section,file+suffix);assert.equal(target.searchParams.get('deck'),deck,file+suffix);assert.equal(target.hash,hash,file+suffix);}
  const index=read('index.html');assert.match(index,/id="authoring-root"/);assert.match(index,/role="status"/);assert.match(index,/<script\b[^>]*type="module"[^>]*src="app\.js\?/);assert.doesNotMatch(index,/builder-workspace|builder-engine-toolbar|<iframe/);
});
test('header assignment links follow the current Native deck and restore legacy destinations on mode change',()=>{
  const get=nodes();let selected='deck-first038';const c=context(['updateAssignmentLinks038'],{$:get,engine:'unity',current:()=>({deck_id:selected})});c.updateAssignmentLinks038();assert.equal(get('builder-starters-link').href,'native035.html?deck=deck-first038#starters');assert.equal(get('builder-chapters-link').href,'native035.html?deck=deck-first038#chapters');selected='deck-second038';c.updateAssignmentLinks038();assert.equal(get('builder-chapters-link').href,'native035.html?deck=deck-second038#chapters');c.engine='legacy';c.updateAssignmentLinks038();assert.equal(get('builder-starters-link').href,'starters026.html');assert.equal(get('builder-chapters-link').href,'campaign164.html');
});
test('Native backup import round-trips an empty name and zero-card draft while validating actual character references',()=>{
  const d=typed('');d.main=[];const c=context(['bundle','parseNativeBuilderImport038'],{engine:'unity',decks:[toBuilderNative038(d,index,views)],nativeIndex:index,unityCards:views,nativeCharacters:[],NATIVE035_CATALOG,fromBuilderNative038,toBuilderNative038});const payload=JSON.parse(JSON.stringify(c.bundle())),restored=c.parseNativeBuilderImport038(payload);assert.equal(restored[0].name,'');assert.equal(restored[0].groups.main.length,0);assert.equal(restored[0].deck_id,d.deck_id);payload.decks[0].character_id='unknown038';assert.throws(()=>c.parseNativeBuilderImport038(payload),/캐릭터/);payload.decks[0].character_id=null;payload.decks.push(structuredClone(payload.decks[0]));assert.throws(()=>c.parseNativeBuilderImport038(payload),/중복/);
});
for(const engine of ['unity','legacy'])test(`historical ${engine} loading handler hides mode controls and restores final counts without depending on retired page markup`,()=>{
  const get=nodes(),body={dataset:{}},attrs={};get('builder-workspace').setAttribute=(key,value)=>attrs[key]=value;const c=context(['builderLoading038','onlineFlowMessage038'],{$:get,document:{body}});c.builderLoading038(true);assert.equal(attrs['aria-busy'],'true');assert.equal(body.dataset.builderLoading,'true');for(const id of ['builder-workspace','builder-engine-toolbar','active-deck-mode','builder-mobile-tabs'])assert.equal(get(id).hidden,true);assert.match(get('load-status').textContent,/불러오는 중/);const final=engine==='unity'?'Unity 원정 1,450종 · 추가 카드 30종':'기존 도감 1,420종';get('load-status').textContent=final;c.builderLoading038(false);assert.equal(get('load-status').textContent,final);assert.equal(attrs['aria-busy'],'false');assert.equal(get('builder-workspace').hidden,false);assert.equal(body.dataset.builderLoading,'false');assert.equal(c.onlineFlowMessage038(engine).includes('온라인 편성을 불러온 뒤 새 원정'),engine==='unity');
});
