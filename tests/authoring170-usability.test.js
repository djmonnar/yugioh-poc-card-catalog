import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039} from '../authoring039-store.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {createAuthoringPanels039,changeDeckCard039,normalizeCatalog039,AUTHORING_SECTIONS039} from '../authoring039-panels.js';
import {pageNumber170,writeCatalogParams170,readCatalogParams170,thumbnailUrl170,createCardProblems170,cardFlagsMatch170,bulkCardPatches170,selectRange170} from '../authoring170-catalog.js';
import {parseCommits170,cardIdsFromFiles170,cardIdsFromSummary170,createHistorySource170} from '../authoring170-history.js';
import {createDraftBackup170,createUndoStack170,BACKUP_PREFIX170} from '../authoring170-drafts.js';
import {conflictRows170,formatConflictValue170} from '../authoring170-conflict.js';
import {deckExport170,deckImport170,gameStatus170,deckFileName170} from '../authoring170-decks.js';
import {localPreview170,createPreviewClient170,PREVIEW_USER170} from '../authoring170-preview.js';
import {previewSeed170} from '../scripts/preview170-seed.mjs';
import {Document041,fixture041,field041,button041,deckOptions170,activeDeck170,deckOption170} from './authoring041-test-dom.js';

const repo=fileURLToPath(new URL('../',import.meta.url));
const copy=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const tick=()=>new Promise(resolve=>setImmediate(resolve)),flush=async()=>{for(let n=0;n<4;n++)await tick();};
class Mem170{constructor(){this.map=new Map();}get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}getItem(k){return this.map.has(k)?this.map.get(k):null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
const inputs=(root,prefix)=>root.querySelectorAll('input').filter(node=>node.getAttribute('aria-label')?.startsWith(prefix));

// ---------- small synthetic project served by the local preview client ----------
const cards=Array.from({length:30},(_,i)=>({source_id:i+1,code:20000+i,identity_key:hash(`t170-${i}`),web_slot:i+1,native_type:17,alias:0,playable:true,token:false,name:`시험 카드 ${i+1}`,name_english:`Test ${i+1}`,description:'시험용 카드',rarity:'N',stock:true,draw_enabled:true,normal_limit:3,speed_limit:null,attack:1000,defense:1000,level:4,race:1,attribute:1,type_name:'일반 몬스터',image_url:i<3?'':`assets/native152/cards/${3006+i}.jpg`}));
const row=(entity_type,entity_id,content,version=1)=>({entity_type,entity_id,version,state:'saved',issues:[],content:copy(content)});
function seed170(){
  const refs=(from,n)=>cards.slice(from,from+n).map(card=>({source_id:card.source_id,identity_key:card.identity_key,count:1}));
  const deck=(id,main)=>row('deck',id,{name:`상대 ${id}`,deck_name:`덱 ${id}`,profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,main,extra:[],lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
  const rows=[deck('a',refs(0,20)),deck('b',refs(5,20)),deck('c',refs(0,12)),row('category','지원',{name:'지원',archived:false}),row('category','드래곤',{name:'드래곤',archived:false})];
  for(const card of cards){const id=String(card.source_id);rows.push(row('card_display',id,{name:card.name,name_english:card.name_english,description:card.description}),row('card_setting',id,{rarity:'N',stock:true,draw_enabled:true}),row('card_annotation',id,{tags:card.source_id%2?['지원']:[],links:[]}),row('card_limit',id,{normal_limit:null,speed_limit:null,frozen_normal_limit:3,frozen_speed_limit:null}));}
  rows.push(row('chapter_role','1:battle',{chapter:1,role:'battle',lp_bonus:0,entries:[{deck_id:'a',weight:1}]}),row('starter_list','main',{entries:[]}));
  const capabilities={entities:{card_display:{fields:{name:{type:'text',max:100},name_english:{type:'text',max:160},description:{type:'multiline',max:12000}}},card_setting:{fields:{rarity:{type:'enum',values:['N','R','SR','UR']},stock:{type:'boolean'},draw_enabled:{type:'boolean'}}},card_annotation:{fields:{tags:{type:'category_refs',max:12},links:{type:'card_links',max:20}}},card_limit:{fields:{normal_limit:{type:'nullable_integer',min:0,max:3},speed_limit:{type:'nullable_integer',min:-1,max:3}}},deck:{fields:{name:{type:'text',max:100},deck_name:{type:'text',max:100}}},category:{fields:{name:{type:'text',min:1,max:40}}}}};
  const characters=[{id:'character-yugi',profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',profile:{name:'시험 유희',skills:[],skill_profiles:[]}}];
  return {id:'t170',revision:1,capabilities,catalog:copy(cards),characters,rows,payload:{catalog:copy(cards),deck_rules035:{rows:[]},opponents:{opponents:[],chapters:[]},starters:{starters:[]},content022:{relics:[],events:[]},meta017:{},characters,shop_rules:{}}};
}
function windowMock(href){
  const listeners=new Map(),win={location:{href},replaced:[],downloads:[],history:{state:null,pushState(_s,_t,url){win.location.href=new URL(url,win.location.href).href;},replaceState(_s,_t,url){win.location.href=new URL(url,win.location.href).href;win.replaced.push(win.location.href);}},
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);},fire(name,event){for(const fn of listeners.get(name)??[])fn(event);},
    setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){},URL:{createObjectURL:blob=>{win.downloads.push(blob);return 'blob:t170';},revokeObjectURL(){}}};
  return win;
}
function fakeHistory({ids=[1,2],fail=false}={}){
  const calls=[];
  return {calls,links:{branch:'https://github.com/x/y/commits/web-db-history',compare:(a,b)=>`https://github.com/x/y/compare/${a}...${b}`},
    peekCommits:()=>null,peekChanged:()=>null,
    commits:async()=>{calls.push('commits');return fail?{ok:false,message:'오프라인'}:{ok:true,commits:[{sha:'a'.repeat(40),short:'aaaaaaa',title:'웹 DB 개정 9 (이전 기록 8)',sections:[{label:'카드',section:'game/catalog',parts:[{kind:'변경',count:2,names:''}]}],date:'2026-11-18T05:17:00Z',url:'https://github.com/x/y/commit/aaa',parent:'b'.repeat(40)}]};},
    changedCards:async sha=>{calls.push(`changed:${sha??'latest'}`);return fail?{ok:false,message:'GitHub 조회 한도에 걸렸습니다.'}:{ok:true,sha:sha??'a'.repeat(40),title:'웹 DB 개정 9',ids:new Set(ids),partial:false};}};
}
async function harness(t,{href='https://example.test/index.html?section=cards',session=new Mem170(),local=new Mem170(),history=fakeHistory(),seed=seed170()}={}){
  const client=createPreviewClient170({seed,crypto:webcrypto,storage:null}),writes=[],rpc=client.rpc;
  client.rpc=async(name,args)=>{if(name==='poc_apply_intent039')writes.push(copy(args.p_intent));return rpc(name,args);};
  const store=new AuthoringStore039({client,storage:new Mem170(),crypto:webcrypto,events:{},debounceMs:2,idleRefreshMs:100000,pollMs:0});await store.start();
  const document=new Document041(),root=document.createElement('main');document.body.append(root);
  const window=windowMock(href),backup=createDraftBackup170({session,local});
  let shell=mountAuthoringShell039({root,store,document,window,manualSave:true,draftStorage:backup.storage,draftBackup170:backup,history170:history});
  await flush();
  t.after(async()=>{shell?.destroy();store.stop();await flush();});
  return {client,store,document,root,window,backup,session,local,writes,history,get shell(){return shell;},remount(){shell.destroy();shell=mountAuthoringShell039({root,store,document,window,manualSave:true,draftStorage:backup.storage,draftBackup170:backup,history170:history});}};
}
function panelsHarness(t,{state=fixture041(),history=null,section='cards'}={}){
  const document=new Document041(),root=document.createElement('main'),writes=[],navigations=[],groups=[],downloads=[],errors=[];document.body.append(root);
  const url={state:null,read:()=>({}),write(value){url.state=copy(value);}};
  const panels=createAuthoringPanels039({document,history170:history,catalogUrl170:url,onChange:(...args)=>{writes.push(args);return {staged:true};},onNavigate:(...args)=>navigations.push(args),onError:error=>errors.push(error),onGroup170:run=>{groups.push(true);return run();},onDownload170:(name,text)=>downloads.push({name,text})});
  panels.render(section,root,state);t.after(()=>panels.destroy());
  return {document,root,panels,state,writes,navigations,groups,downloads,errors,url,render:(next=state,where=section)=>panels.render(where,root,next,{force:true})};
}
const pager=root=>root.querySelector('.au-pagination');
const pageText=root=>/(\d+) \/ (\d+)/.exec(pager(root).textContent).slice(1).map(Number);

// 1. Page jump
test('170 page numbers are clamped and validated before a jump',()=>{
  assert.equal(pageNumber170('3',10),3);assert.equal(pageNumber170('99',10),10);assert.equal(pageNumber170('0',10),1);
  assert.equal(pageNumber170('',10),null);assert.equal(pageNumber170('2.5',10),null);assert.equal(pageNumber170('-1',10),null);
});
test('170 the card pager jumps to a typed page and offers first/last',t=>{
  const m=panelsHarness(t),[,pages]=pageText(m.root);assert.ok(pages>5);
  const jump=inputs(m.root,'이동할 페이지')[0];jump.value='5';button041(pager(m.root),'이동').click();
  assert.deepEqual(pageText(m.root),[5,pages]);assert.equal(m.url.state.page,5);
  button041(pager(m.root),'마지막').click();assert.deepEqual(pageText(m.root),[pages,pages]);assert.equal(button041(pager(m.root),'다음').disabled,true);
  button041(pager(m.root),'처음').click();assert.deepEqual(pageText(m.root),[1,pages]);assert.equal(button041(pager(m.root),'이전').disabled,true);
  const again=inputs(m.root,'이동할 페이지')[0];again.value='abc';button041(pager(m.root),'이동').click();
  assert.deepEqual(pageText(m.root),[1,pages]);assert.equal(again.getAttribute('aria-invalid'),'true');assert.match(m.errors.at(-1).message,/페이지 번호/);
});

// 2. URL state
test('170 catalog state round-trips through URL parameters and ignores unsafe values',()=>{
  const url=new URL('https://example.test/index.html?section=cards&deck=keep');
  writeCatalogParams170(url,{query:'푸른 눈',tier:['UR','SR'],tags:['드래곤'],flags170:['uncategorized'],categoryMatch:'any',browse:'recent',sort:'name',page:3,addition:'latest',additionTheme:'all',recent170:null});
  assert.equal(url.searchParams.get('section'),'cards');assert.equal(url.searchParams.get('deck'),'keep');
  assert.deepEqual(readCatalogParams170(url.searchParams),{query:'푸른 눈',tier:['UR','SR'],tags:['드래곤'],flags170:['uncategorized'],categoryMatch:'any',browse:'recent',sort:'name',page:3});
  writeCatalogParams170(url,{query:'',page:1,tier:[]});assert.equal(url.search,'?section=cards&deck=keep');
  const odd=new URLSearchParams('page=-4&match=both&only=bogus&only=problem&rc=zz&q='+'x'.repeat(300));
  assert.deepEqual(readCatalogParams170(odd),{flags170:['problem']});
});
test('170 the shell restores search, conditions and page from the address and keeps it updated',async t=>{
  const m=await harness(t,{href:'https://example.test/index.html?section=cards&q=%EC%8B%9C%ED%97%98&only=uncategorized&page=1'});
  assert.equal(field041(m.root,'카드 검색').value,'시험');assert.equal(field041(m.root,'분류 없음').checked,true);
  const search=field041(m.root,'카드 검색');search.value='시험 카드 2';search.fire('input');
  const url=new URL(m.window.location.href);assert.equal(url.searchParams.get('q'),'시험 카드 2');assert.deepEqual(url.searchParams.getAll('only'),['uncategorized']);
  await m.shell.navigate('decks');const away=new URL(m.window.location.href);assert.equal(away.searchParams.get('section'),'decks');assert.equal(away.searchParams.get('q'),null);assert.equal(away.searchParams.get('only'),null);
  assert.equal(m.writes.length,0);
});

// 3. New list conditions
test('170 list conditions find uncategorized, imageless, problematic and recently changed cards',t=>{
  const state=fixture041(),cards=normalizeCatalog039(state),blue=cards.find(card=>card.source_id===0);
  const problems=createCardProblems170({cards,entities:[{entity_type:'card_setting',entity_id:'0',state:'saved_needs_review',issues:[],content:{}}],writeState:{rejected:true,entityType:'card_display',entityId:'5'}});
  assert.equal(problems.get(blue)[0].code,'needs_review');assert.equal(problems.get(cards.find(card=>card.source_id===5))[0].code,'rejected');
  assert.equal(problems.get({...blue,source_id:7,links:[{slot:999999,identity_key:'x'}]})[0].code,'missing_link');
  assert.equal(cardFlagsMatch170({...blue,tags:[]},['uncategorized']),true);assert.equal(cardFlagsMatch170({...blue,tags:['드래곤']},['uncategorized']),false);
  assert.equal(cardFlagsMatch170({...blue,image:''},['noImage']),true);assert.equal(cardFlagsMatch170(blue,['noImage'],{missingImages:new Set([0])}),true);assert.equal(cardFlagsMatch170(blue,['noImage']),false);
  assert.equal(cardFlagsMatch170(blue,['recent'],{recent:new Set([0])}),true);assert.equal(cardFlagsMatch170(blue,['recent'],{recent:new Set([1])}),false);
  assert.equal(cardFlagsMatch170(blue,['recent'],{recent:null}),true,'Unavailable history never hides cards.');
});
test('170 the 분류 없음 and 문제 있음 toggles filter the catalog grid',t=>{
  const state=fixture041();state.entities.push({entity_type:'card_annotation',entity_id:'0',version:1,state:'saved',issues:['db'],content:{tags:['드래곤'],links:[]}});
  const m=panelsHarness(t,{state}),total=()=>Number(/^([\d,]+)종/.exec(m.root.querySelector('.au-card-results-summary').textContent)[1].replace(/,/g,''));
  const all=total(),problem=field041(m.root,'문제 있음');problem.checked=true;problem.fire('change');
  assert.equal(total(),1);assert.match(m.root.querySelector('.au-card-results-summary').textContent,/문제 있음/);
  problem.checked=false;problem.fire('change');const none=field041(m.root,'분류 없음');none.checked=true;none.fire('change');assert.equal(total(),all-1);
});
test('170 최근 변경 loads the public history once and fails soft when GitHub is unavailable',async t=>{
  const history=fakeHistory({ids:[0,1,2]}),m=panelsHarness(t,{history});
  const recent=field041(m.root,'최근 변경');recent.checked=true;recent.fire('change');
  assert.match(m.root.querySelector('.au-card-results-summary').textContent,/불러오는 중/);await flush();
  assert.match(m.root.querySelector('.au-card-results-summary').textContent,/^3종 · 최근 변경 \(웹 DB 개정 9 기준\)/);assert.deepEqual(history.calls,['changed:latest']);
  const failing=fakeHistory({fail:true}),f=panelsHarness(t,{history:failing}),before=f.root.querySelector('.au-card-results-summary').textContent;
  const toggle=field041(f.root,'최근 변경');toggle.checked=true;toggle.fire('change');await flush();
  assert.match(f.root.textContent,/GitHub 조회 한도.*조건은 적용하지 않았습니다/);assert.equal(f.root.querySelector('.au-card-results-summary').textContent.split(' · ')[0],before.split(' · ')[0]);
});
test('170 history parsing reads commit titles, summary lines and changed catalog files',()=>{
  const [commit]=parseCommits170([{sha:'c'.repeat(40),html_url:'https://github.com/o/r/commit/ccc',parents:[{sha:'d'.repeat(40)}],commit:{message:'웹 DB 개정 875 (이전 기록 845)\n\n- 카드 (game/catalog) · 변경 2: 0 푸른 눈의 백룡, 11 아마조네스 / 추가 1: 3000 새 카드\n- 유물 (game/content022/relics) · 변경 1: a 앙크',committer:{date:'2026-11-18T05:17:00Z'}}},{sha:'not-a-sha'}]);
  assert.equal(commit.revision,875);assert.equal(commit.previous,845);assert.equal(commit.parent,'d'.repeat(40));assert.deepEqual(commit.sections.map(row=>row.label),['카드','유물']);assert.deepEqual(commit.sections[0].parts.map(part=>[part.kind,part.count]),[['변경',2],['추가',1]]);
  assert.deepEqual([...cardIdsFromFiles170([{filename:'game/catalog/12.json'},{filename:'game/catalog/_rest.json'},{filename:'LATEST.md'},{filename:'game/catalog/0.json'}])],[12,0]);
  const summary=cardIdsFromSummary170('# 최근 변경\n\n웹 DB 개정 875 (이전 기록 845)\n\n- 카드 (game/catalog) · 변경 1185: 0 푸른 눈의 백룡, 11 아마조네스의 성전사 …\n');
  assert.deepEqual([...summary.ids],[0,11]);assert.equal(summary.partial,true);assert.equal(summary.revision,875);
});
test('170 the history source pages commit files, caches results and falls back to LATEST.md',async()=>{
  const requests=[],sha='e'.repeat(40),storage=new Mem170();
  const files=page=>Array.from({length:page===1?300:5},(_,i)=>({filename:`game/catalog/${(page-1)*300+i}.json`}));
  const fetch=async url=>{requests.push(url);if(url.includes('/commits?'))return {ok:true,status:200,json:async()=>[{sha,commit:{message:'웹 DB 개정 9'},parents:[]}]};const page=Number(/[?&]page=(\d+)/.exec(url)[1]);return {ok:true,status:200,json:async()=>({files:files(page)})};};
  const source=createHistorySource170({fetch,storage,now:()=>1000}),result=await source.changedCards();
  assert.equal(result.ok,true);assert.equal(result.ids.size,305);assert.equal(result.partial,false);assert.equal(requests.length,3);
  assert.equal((await source.changedCards()).ids.size,305);assert.equal(requests.length,3,'Cached results do not re-query GitHub.');
  const warm=createHistorySource170({fetch:async()=>{throw Error('must not fetch');},storage,now:()=>2000});assert.equal(warm.peekCommits().ok,true);assert.equal(warm.peekChanged().ids.size,305);
  const limited=createHistorySource170({fetch:async url=>url.endsWith('LATEST.md')?{ok:true,status:200,text:async()=>'웹 DB 개정 7\n- 카드 (game/catalog) · 변경 3: 4 가, 5 나 …'}:{ok:false,status:403},now:()=>1});
  const fallback=await limited.changedCards();assert.equal(fallback.ok,true);assert.equal(fallback.source,'summary');assert.equal(fallback.partial,true);assert.deepEqual([...fallback.ids],[4,5]);
  const offline=createHistorySource170({fetch:async()=>{throw Error('network');}});assert.equal((await offline.commits()).ok,false);assert.equal((await offline.changedCards()).ok,false);
});

// 4. Draft persistence
test('170 draft backups mirror the tab copy and are offered only from closed or silent tabs',()=>{
  let time=1000;const local=new Mem170(),tabA=new Mem170(),tabB=new Mem170(),now=()=>time;
  const a=createDraftBackup170({session:tabA,local,now,random:()=>'tab-aaaaaaaa'}),b=createDraftBackup170({session:tabB,local,now,random:()=>'tab-bbbbbbbb'});
  const text=JSON.stringify({schema:1,owner:'editor',items:[{type:'deck',id:'a',operation:'patch',baseVersion:1,baseContent:{name:'x'},fields:{name:'y'},submitted:null}]});
  a.storage.setItem('poc-authoring060-drafts:editor',text);assert.equal(tabA.getItem('poc-authoring060-drafts:editor'),text);
  assert.ok([...local.map.keys()].some(key=>key.startsWith(BACKUP_PREFIX170)));
  assert.equal(b.pending('editor'),null,'A live tab keeps its drafts to itself.');
  a.markClosed();const offer=b.pending('editor');assert.equal(offer.count,1);assert.equal(offer.text,text);
  assert.equal(a.pending('editor'),null,'A tab is never offered its own copy.');
  time+=120000;const c=createDraftBackup170({session:new Mem170(),local,now,random:()=>'tab-cccccccc'});assert.equal(c.pending('editor').count,1);
  b.discard(offer.key);assert.equal(c.pending('editor'),null);
  a.storage.setItem('poc-authoring060-drafts:editor',text);a.storage.removeItem('poc-authoring060-drafts:editor');assert.equal([...local.map.keys()].filter(key=>key.startsWith(BACKUP_PREFIX170)).length,0);
});
test('170 a closed tab restores its drafts only after the editor chooses to, and nothing is sent',async t=>{
  const local=new Mem170(),first=await harness(t,{href:'https://example.test/index.html?section=decks&deck=a',local});
  const name=field041(first.root,'덱 이름');name.value='닫기 전 이름';name.fire('input');await flush();
  assert.equal(first.shell.drafts060.summary().dirtyCount,1);first.backup.markClosed();first.shell.destroy();
  const second=await harness(t,{href:'https://example.test/index.html?section=decks&deck=a',local});
  const prompt=second.root.querySelector('.au-restore170');assert.equal(prompt.hidden,false);assert.match(prompt.textContent,/저장하지 않은 변경이 이 기기에 남아 있습니다.*항목 1개/);
  assert.equal(second.shell.drafts060.summary().dirtyCount,0,'Nothing is restored before the choice.');
  button041(prompt,'초안 복원').click();await flush();
  assert.equal(second.shell.drafts060.summary().dirtyCount,1);assert.equal(field041(second.root,'덱 이름').value,'닫기 전 이름');assert.equal(second.root.querySelector('.au-restore170').hidden,true);
  assert.equal(first.writes.length+second.writes.length,0,'Restoring never creates a DB request.');
  const third=await harness(t,{href:'https://example.test/index.html?section=decks&deck=a',local});
  assert.equal(third.root.querySelector('.au-restore170').hidden,true,'The restored copy now belongs to the live tab.');
});
test('170 an unconfirmed request from a closed tab comes back as an editable draft',async t=>{
  const local=new Mem170(),session=new Mem170(),owner=PREVIEW_USER170.id;
  local.setItem(`${BACKUP_PREFIX170}${owner}:tab-closed1`,JSON.stringify({schema:1,tab:'tab-closed1',savedAt:1,aliveAt:1,closedAt:2,text:JSON.stringify({schema:1,owner,items:[{type:'deck',id:'b',operation:'patch',baseVersion:1,baseContent:{deck_name:'덱 b'},fields:{},submitted:{operation:'patch',fields:{deck_name:'보내던 이름'},baseVersion:1,baseContent:{deck_name:'덱 b'}}}]})}));
  const m=await harness(t,{href:'https://example.test/index.html?section=decks&deck=b',local,session});
  button041(m.root.querySelector('.au-restore170'),'초안 복원').click();await flush();
  const summary=m.shell.drafts060.summary();assert.equal(summary.dirtyCount,1);assert.equal(summary.submittedCount,0);assert.deepEqual(summary.items[0].fields,{deck_name:'보내던 이름'});assert.equal(m.writes.length,0);
  const other=await harness(t,{href:'https://example.test/index.html?section=decks',local:(()=>{const store=new Mem170();store.setItem(`${BACKUP_PREFIX170}${owner}:tab-closed2`,JSON.stringify({schema:1,tab:'tab-closed2',savedAt:1,closedAt:2,text:JSON.stringify({schema:1,owner,items:[{type:'deck',id:'a',operation:'patch',baseVersion:1,baseContent:{},fields:{deck_name:'x'},submitted:null}]})}));return store;})()});
  button041(other.root.querySelector('.au-restore170'),'버리기').click();await flush();assert.equal(other.root.querySelector('.au-restore170').hidden,true);assert.equal(other.shell.drafts060.summary().dirtyCount,0);
});

// 5. Undo
test('170 the undo stack groups steps and skips drafts that were saved or cancelled',()=>{
  const live=new Map([['deck:a',2],['deck:b',1]]),can=(type,id)=>(live.get(`${type}:${id}`)??0)>0,undo=(type,id)=>{live.set(`${type}:${id}`,live.get(`${type}:${id}`)-1);return true;};
  const stack=createUndoStack170();stack.record({type:'deck',id:'a'});stack.group(()=>{stack.record({type:'deck',id:'a'});stack.record({type:'deck',id:'b'});});
  assert.equal(stack.undo(can,undo),2);assert.deepEqual([...live.values()],[1,0]);
  live.set('deck:a',0);assert.equal(stack.available(can),false,'A saved draft is not rewound.');
});
test('170 되돌리기 and Ctrl+Z undo one unsaved step; 변경 취소 still discards everything',async t=>{
  const m=await harness(t,{href:'https://example.test/index.html?section=decks&deck=a'}),undoButton=()=>button041(m.root.querySelector('.au-manual-save060'),'되돌리기');
  assert.equal(undoButton().disabled,true);
  let name=field041(m.root,'덱 이름');name.value='첫 번째';name.fire('input');await flush();name=field041(m.root,'덱 이름');name.value='두 번째';name.fire('input');await flush();
  assert.equal(undoButton().disabled,false);undoButton().click();await flush();
  assert.equal(m.shell.drafts060.summary().items[0].fields.deck_name,'첫 번째');
  const typing=field041(m.root,'덱 이름'),inField={key:'z',ctrlKey:true,target:typing,preventDefault(){this.prevented=true;}};m.window.fire('keydown',inField);await flush();
  assert.equal(inField.prevented,undefined,'Text fields keep the browser\'s own undo.');assert.equal(m.shell.drafts060.summary().dirtyCount,1);
  const outside={key:'z',ctrlKey:true,target:m.document.body,preventDefault(){this.prevented=true;}};m.window.fire('keydown',outside);await flush();
  assert.equal(outside.prevented,true);assert.equal(m.shell.drafts060.summary().dirtyCount,0);assert.equal(undoButton().disabled,true);
  name=field041(m.root,'덱 이름');name.value='세 번째';name.fire('input');await flush();button041(m.root.querySelector('.au-manual-save060'),'변경 취소').click();await flush();
  assert.equal(m.shell.drafts060.summary().dirtyCount,0);assert.equal(m.writes.length,0);
});

// 6. Conflict comparison
test('170 conflict rows format card lists, booleans and text side by side',()=>{
  const index=new Map(cards.map(card=>[card.source_id,{...card,name_ko:card.name}]));
  const rows=conflictRows170({fields:['main','stock','deck_name'],labels:{main:'메인 덱',stock:'상점 판매',deck_name:'덱 이름'},cards:index,mine:{main:[{source_id:1,count:2},{source_id:2,count:1}],stock:true,deck_name:'내 이름'},db:{main:[{source_id:1,count:2},{source_id:3,count:1}],stock:false,deck_name:''}});
  assert.deepEqual(rows.map(row=>[row.label,row.mine,row.db]),[['메인 덱','시험 카드 1 ×2, 시험 카드 2','시험 카드 1 ×2, 시험 카드 3'],['상점 판매','예','아니요'],['덱 이름','내 이름','(비어 있음)']]);
  assert.deepEqual(rows[0].diff,{onlyMine:['시험 카드 2'],onlyDb:['시험 카드 3']});assert.equal(formatConflictValue170(null),'기본값');assert.equal(formatConflictValue170(undefined),'값 없음');
});
test('170 a draft conflict shows my value and the DB value before 내 수정 유지 / DB 내용 사용',async t=>{
  const m=await harness(t),search=field041(m.root,'카드 검색');search.value='시험 카드 4';search.fire('input');m.root.querySelectorAll('button').find(node=>node.getAttribute('aria-label')==='시험 카드 4 카드 정보').click();await flush();
  const dialog=m.document.querySelector('.au-card-dialog'),rarity=field041(dialog,'등급');rarity.value='R';rarity.fire('change');await flush();
  m.client.remoteEdit170('card_setting','4',{rarity:'SR'});await m.store.refresh(true);await flush();
  const conflict=m.root.querySelector('.au-manual-conflict060');assert.ok(conflict,'The draft bar lists the conflict.');
  const cells=conflict.querySelector('table').querySelectorAll('td').map(cell=>cell.textContent);assert.deepEqual(cells,['R','SR']);assert.match(conflict.textContent,/등급/);
  button041(conflict,'내 수정 유지').click();await flush();assert.equal(m.root.querySelector('.au-manual-conflict060'),null);assert.equal(m.shell.drafts060.summary().items[0].fields.rarity,'R');assert.equal(m.writes.length,0);
});

// 7. Saved vs. in game
test('170 deck badges separate DB saves from what the game serves',()=>{
  const base={entity_type:'deck',entity_id:'d',version:5,state:'saved',issues:[],content:{name:'상대',deck_name:'덱',main:Array.from({length:20},(_,i)=>({source_id:i,count:1}))}};
  const state={canEdit:true,bootstrap:{game:{authoring_revision:5}}};
  assert.equal(gameStatus170(base,{state,usages:[{}]}).kind,'live');
  assert.equal(gameStatus170({...base,version:6},{state,usages:[{}]}).kind,'waiting');
  assert.equal(gameStatus170(base,{state,usages:[]}).kind,'unused');
  const short=gameStatus170({...base,content:{...base.content,main:base.content.main.slice(0,12)}},{state,usages:[{}]});assert.equal(short.kind,'stale');assert.match(short.detail,/마지막 정상 버전.*메인 12\/20장/);
  assert.equal(gameStatus170({...base,content:{...base.content,deck_name:' '}},{state,usages:[{}]}).kind,'stale');
  assert.equal(gameStatus170({...base,localDraft060:true},{state}),null);assert.equal(gameStatus170(base,{state:{canEdit:false}}),null);
});
test('170 the deck editor shows 게임 미반영 for a saved deck the game cannot use yet',t=>{
  const state=fixture041(),short=state.entities.find(row=>row.entity_id==='fixture-deck-000');short.content.main=short.content.main.slice(0,12);
  const m=panelsHarness(t,{state,section:'decks'});m.panels.selectDeck('fixture-deck-000');m.render(state,'decks');
  const status=m.root.querySelector('.au-entity-status');assert.equal(status.dataset.gameStatus,'stale');assert.match(status.textContent,/DB에 저장됨.*게임 미반영/);
  m.panels.selectDeck('fixture-deck-129');m.render(state,'decks');assert.equal(m.root.querySelector('.au-entity-status').dataset.gameStatus,'unused');
  m.panels.selectDeck('fixture-deck-001');m.render(state,'decks');assert.equal(m.root.querySelector('.au-entity-status').dataset.gameStatus,'live');
});

// 8. Header and section list
test('170 the header uses a neutral studio label and the history section is listed',async t=>{
  const m=await harness(t);const brand=m.root.querySelector('.au-brand');assert.equal(brand.querySelector('small').textContent,'원정 제작소');assert.equal(brand.href,'index.html');
  assert.ok(AUTHORING_SECTIONS039.some(([key,label])=>key==='history'&&label==='변경 이력'));
});

// 9. Thumbnails
test('170 grids use generated thumbnails, the detail view the original, with a fallback',t=>{
  assert.equal(thumbnailUrl170('assets/native152/cards/3006.jpg'),'assets/native152/thumbs/3006.jpg');
  for(const path of ['assets/cards/0001.webp','https://x/assets/native152/cards/1.jpg','assets/native152/cards/../x.jpg','',null])assert.equal(thumbnailUrl170(path),null);
  const state=fixture041(),m=panelsHarness(t,{state}),search=field041(m.root,'카드 검색');search.value='2390';search.fire('input');
  const tile=m.root.querySelector('.au-card-tile'),img=tile.querySelector('img');assert.match(img.src,/^assets\/native035\/thumbs\/\d+\.jpg$/);
  const original=img.src.replace('/thumbs/','/cards/');img.onerror();assert.equal(img.src,original,'A missing thumbnail falls back to the original.');
  img.onerror();assert.equal(img.classList.contains('au-image-missing'),true);
  m.root.querySelectorAll('button').find(node=>node.classList.contains('au-card-art')).click();
  assert.match(m.document.querySelector('.au-card-dialog').querySelector('img').src,/^assets\/native035\/cards\/\d+\.jpg$/);
});
function jpegSize(buffer){for(let i=2;i<buffer.length;){if(buffer[i]!==0xff){i++;continue;}const marker=buffer[i+1],length=buffer.readUInt16BE(i+2);if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return {height:buffer.readUInt16BE(i+5),width:buffer.readUInt16BE(i+7)};i+=2+length;}return null;}
test('170 every generated thumbnail matches an original card image and is a 320px JPEG',()=>{
  const assets=path.join(repo,'assets');let count=0,original=0,thumbs=0;
  for(const pack of fs.readdirSync(assets).filter(name=>/^native\d{3}$/.test(name))){
    const dir=path.join(assets,pack,'thumbs');if(!fs.existsSync(dir))continue;
    for(const name of fs.readdirSync(dir)){
      assert.match(name,/^\d{1,6}\.jpg$/,`${pack}/thumbs/${name}`);const source=path.join(assets,pack,'cards',name);assert.ok(fs.existsSync(source),`${pack}/thumbs/${name} has an original`);
      const data=fs.readFileSync(path.join(dir,name)),size=jpegSize(data);assert.equal(size?.width,320,`${pack}/thumbs/${name} width`);
      count++;thumbs+=data.length;original+=fs.statSync(source).size;assert.ok(data.length<fs.statSync(source).size);
    }
  }
  assert.ok(count>=644,`thumbnails: ${count}`);assert.ok(thumbs<original*0.4,`thumbnail bytes ${thumbs} / original ${original}`);
});

// 10. Bulk edit
test('170 bulk patches follow the single editor rarity and category rules',()=>{
  const old={source_id:5,name_ko:'기본',rarity:'N',tags:['가']},added={source_id:2400,name_ko:'추가',rarity:'R',tags:Array.from({length:12},(_,i)=>`t${i}`)};
  const rare=bulkCardPatches170([old,added],{rarity:'L',allowedRarities:['L','N','R','SR','UR']});
  assert.deepEqual(rare.patches.map(row=>[row.type,row.id,row.fields]),[['card_setting','5',{rarity:'L',stock:false,draw_enabled:false}]]);assert.match(rare.skipped[0].reason,/L 등급/);
  const tags=bulkCardPatches170([old,added],{addTags:['나'],removeTags:['가']});
  assert.deepEqual(tags.patches.map(row=>[row.id,row.fields.tags]),[['5',['나']]]);assert.match(tags.skipped[0].reason,/12개/);
  assert.deepEqual(bulkCardPatches170([old],{rarity:'N'}).patches,[]);
  assert.deepEqual([...selectRange170(new Set([1]),[1,2,3,4,5],2,4,true)],[1,2,3,4]);assert.deepEqual([...selectRange170(new Set([1,2,3,4]),[1,2,3,4,5],4,2,false)],[1]);
});
test('170 bulk edit selects with checkboxes and shift-click, then patches each card in one group',t=>{
  const m=panelsHarness(t);button041(m.root,'여러 카드 편집').click();
  const checks=()=>m.root.querySelectorAll('input').filter(node=>node.classList.contains('au-bulk-check170'));assert.equal(checks().length,24);
  const [first,,,fourth]=checks();first.checked=true;first.fire('click');fourth.checked=true;fourth.fire('click',{shiftKey:true});
  assert.equal(checks().filter(node=>node.checked).length,4);assert.match(m.root.querySelector('.au-bulk-count170').textContent,/선택 4장/);
  const rarity=field041(m.root,'바꿀 등급');rarity.value='UR';rarity.fire('change');button041(m.root,'선택한 카드에 적용').click();
  const ids=checks().slice(0,4).map(node=>node.getAttribute('data-bulk-id')),cardsById=new Map(normalizeCatalog039(m.state).map(card=>[String(card.source_id),card])),expected=ids.filter(id=>cardsById.get(id).rarity!=='UR');
  assert.deepEqual(m.writes.map(args=>[args[0],args[1],args[2]]).sort((a,b)=>Number(a[1])-Number(b[1])),expected.sort((a,b)=>Number(a)-Number(b)).map(id=>['card_setting',id,{rarity:'UR'}]));assert.ok(expected.length>0);assert.equal(m.groups.length,1);
  assert.match(m.root.querySelector('.au-bulk-count170').textContent,/변경 \d+건을 준비했습니다/);
});
test('170 a bulk edit stages drafts through the shell and one 되돌리기 reverts the whole batch',async t=>{
  const m=await harness(t);button041(m.root,'여러 카드 편집').click();await flush();
  button041(m.root,'현재 페이지 선택').click();await flush();
  const rarity=field041(m.root,'바꿀 등급');rarity.value='SR';rarity.fire('change');button041(m.root,'선택한 카드에 적용').click();await flush();
  assert.equal(m.shell.drafts060.summary().dirtyCount,24);assert.equal(m.writes.length,0);
  button041(m.root.querySelector('.au-manual-save060'),'되돌리기').click();await flush();assert.equal(m.shell.drafts060.summary().dirtyCount,0);assert.equal(m.writes.length,0);
});

// 11. Deck list, export and import
test('170 the deck list searches every deck and shows how many match',t=>{
  const m=panelsHarness(t,{section:'decks'});assert.match(m.root.querySelector('.au-deck-count170').textContent,/^130개 중 130개 · 40개 표시$/);assert.equal(deckOptions170(m.root).length,40);
  button041(m.root,'덱 더 보기').click();assert.equal(deckOptions170(m.root).length,80);
  const search=field041(m.root,'편집할 덱 검색');search.value='fixture-deck-120';search.fire('input');assert.equal(deckOptions170(m.root).length,1);const option=deckOption170(m.root,'fixture-deck-120');assert.ok(option);option.click();assert.deepEqual(m.navigations.at(-1),['decks','fixture-deck-120']);
  m.render(m.state,'decks');assert.equal(activeDeck170(m.root),'fixture-deck-120');assert.match(m.root.querySelector('.au-deck-current170').textContent,/^편집 중 · /);
});
test('170 deck files export the composition and import through the editor deck rule',async t=>{
  const state=fixture041(),list=normalizeCatalog039(state),deck=state.entities.find(row=>row.entity_id==='fixture-deck-003');
  const file=deckExport170(deck,list,{exportedAt:'2026-11-19T00:00:00.000Z'});assert.equal(file.kind,'yugioh-expedition-deck');assert.equal(file.deck.main.length,20);assert.ok(file.deck.main[0].name);
  assert.equal(deckFileName170({content:{deck_name:'a/b:c'}}),'a_b_c.deck.json');
  const imported=deckImport170(JSON.stringify(file),{cards:list,characters:[{profile_id:'yugi',art_key:'yugi-art'}],changeDeckCard:changeDeckCard039,composition:true,sharedFields:true});
  assert.deepEqual(imported.fields.main,deck.content.main);assert.equal(imported.fields.name,imported.fields.deck_name);assert.equal(imported.fields.use_shared_skills,false);assert.deepEqual(imported.fields.skills,[]);
  const tooMany=copy(file);tooMany.deck.main[0].count=4;assert.throws(()=>deckImport170(JSON.stringify(tooMany),{cards:list,changeDeckCard:changeDeckCard039}),/매수/);
  const unknown=copy(file);unknown.deck.main[0].source_id=987654;assert.throws(()=>deckImport170(JSON.stringify(unknown),{cards:list,changeDeckCard:changeDeckCard039}),/카드 도감에 없는/);
  const changed=copy(file);changed.deck.main[0].identity_key='f'.repeat(64);assert.throws(()=>deckImport170(JSON.stringify(changed),{cards:list,changeDeckCard:changeDeckCard039}),/카드 정보가 달라/);
  const big=copy(file);big.deck.main=list.filter(card=>!card.special&&card.playable!==false&&!(card.native_type&(0x40|0x2000|0x800000|0x4000000))&&card.deck_limit>=3).slice(0,31).map(card=>({source_id:card.source_id,identity_key:card.identity_key,count:1}));
  assert.throws(()=>deckImport170(JSON.stringify(big),{cards:list,changeDeckCard:changeDeckCard039}),/30장/);
  assert.throws(()=>deckImport170('{"kind":"other"}',{cards:list,changeDeckCard:changeDeckCard039}),/내보낸 덱 파일이 아닙니다/);
  const m=panelsHarness(t,{state,section:'decks'});m.panels.selectDeck('fixture-deck-003');m.render(state,'decks');button041(m.root,'덱 파일 내보내기').click();
  assert.equal(m.downloads.length,1);assert.equal(JSON.parse(m.downloads[0].text).source_deck_id,'fixture-deck-003');
  const input=m.root.querySelectorAll('input').find(node=>node.getAttribute('aria-label')==='덱 파일 선택');input.files=[{size:1000,text:async()=>JSON.stringify(file)}];input.onchange();await flush();
  const created=m.writes.find(args=>args[0]==='deck'&&args[3]?.operation==='create');assert.ok(created,'Import stages a new deck through the normal create path.');assert.deepEqual(created[2].main,deck.content.main);assert.match(m.navigations.at(-1)[1],/^deck-/);
});

// 12. History panel
test('170 the 변경 이력 panel lists public history commits with links and fails soft',async t=>{
  const history=fakeHistory(),m=panelsHarness(t,{history,section:'history'});await flush();
  const item=m.root.querySelector('.au-history-item170');assert.match(item.textContent,/웹 DB 개정 9.*카드 · 변경 2/);
  const links=item.querySelectorAll('a');assert.deepEqual(links.map(a=>a.textContent),['커밋 보기','이전 기록과 비교']);assert.equal(links[1].href,`https://github.com/x/y/compare/${'b'.repeat(40)}...${'a'.repeat(40)}`);assert.ok(links.every(a=>a.rel.includes('noopener')));
  button041(item,'바뀐 카드 보기').click();assert.deepEqual(m.navigations.at(-1),['cards']);
  m.render(m.state,'cards');assert.equal(field041(m.root,'최근 변경').checked,true);await flush();assert.deepEqual(history.calls.at(-1),`changed:${'a'.repeat(40)}`);
  const offline=panelsHarness(t,{history:fakeHistory({fail:true}),section:'history'});await flush();assert.match(offline.root.textContent,/오프라인.*편집에는 영향이 없습니다/);
});

// Local preview stays local
test('170 the preview client is reachable only on localhost with the explicit flag',()=>{
  for(const href of ['https://djmonnar.github.io/yugioh-poc-card-catalog/index.html?preview=local','http://localhost:8170/index.html','http://127.0.0.1:8170/index.html?preview=1','file:///C:/repo/index.html?preview=local','http://localhost.evil.test/?preview=local','http://192.168.0.2:8170/?preview=local'])assert.equal(localPreview170(href),false,href);
  for(const href of ['http://localhost:8170/index.html?preview=local','http://127.0.0.1:8170/index.html?section=cards&preview=local','http://[::1]:8170/?preview=local'])assert.equal(localPreview170(href),true,href);
  const app=fs.readFileSync(path.join(repo,'app.js'),'utf8');assert.match(app,/const preview=localPreview170\(window\.location\.href\);/);assert.match(app,/if\(preview\)\{client=await previewClient170/);assert.doesNotMatch(app,/shouldCreateUser:true/);
});
test('170 the preview client serves a valid bootstrap, applies saves locally and detects conflicts',async()=>{
  const storage=new Mem170(),client=createPreviewClient170({seed:seed170(),crypto:webcrypto,storage});
  const store=new AuthoringStore039({client,storage:new Mem170(),crypto:webcrypto,events:{},debounceMs:1,idleRefreshMs:100000,pollMs:0});await store.start();
  assert.equal(store.snapshot().canEdit,true);assert.equal(store.snapshot().user.id,PREVIEW_USER170.id);
  const ack=await store.patch('card_setting','2',{rarity:'R'});assert.equal(ack.kind,'unified039-write-ack');
  const reopened=createPreviewClient170({seed:seed170(),crypto:webcrypto,storage}),boot=(await reopened.rpc('poc_bootstrap039',{})).data;
  assert.equal(boot.authoring.entities.find(row=>row.entity_type==='card_setting'&&row.entity_id==='2').content.rarity,'R');
  const stale=await reopened.rpc('poc_apply_intent039',{p_intent:{request_id:'00000000-0000-4000-8000-000000000001',expected_project_revision:1,changes:[{entity_type:'card_setting',entity_id:'2',expected_entity_version:1,operation:'patch',fields:{rarity:'N'}}]}});
  assert.equal(stale.error.message,'unified039_conflict');assert.match((await client.auth.signInWithOtp({email:'a@b.c'})).error.message,/로그인 메일을 보내지 않습니다/);
  store.stop();
});
test('170 the preview seed builds from public card files with every card editable',async()=>{
  const seed=await previewSeed170(repo);assert.equal(seed.catalog.length,new Set(seed.catalog.map(card=>card.source_id)).size);assert.ok(seed.catalog.length>=2000);
  for(const type of ['card_display','card_setting','card_annotation','card_limit'])assert.equal(seed.rows.filter(row=>row.entity_type===type).length,seed.catalog.length);
  assert.ok(seed.rows.filter(row=>row.entity_type==='deck').length>=150);assert.equal(seed.capabilities.deck_compositions044,true);
  const serve=fs.readFileSync(path.join(repo,'scripts/serve-local.mjs'),'utf8');assert.match(serve,/listen\(port,'127\.0\.0\.1'/);
});
test('170 a queued-request conflict notice compares the waiting value with the current DB value',t=>{
  const doc=new Document041(),root=doc.createElement('main');doc.body.append(root);const state=fixture041(),id='category-group-t170';
  state.user={id:'editor'};state.phase='conflict';state.pending=1;state.error='저장 기준과 현재 DB의 같은 항목이 달라졌습니다.';
  state.bootstrap.authoring={entities:[{entity_type:'category_group',entity_id:id,version:3,state:'saved',issues:[],content:{name:'DB 이름',archived:false,categories:[]}}]};
  state.entities.push({entity_type:'category_group',entity_id:id,version:2,state:'saved',issues:[],pending:true,content:{name:'내 이름',archived:false,categories:[]}});
  state.writeState={entityType:'category_group',entityId:id,operation:'patch',fields:['name'],phase:'conflict',rejected:false,conflict:{baselineVersion:2,currentVersion:3,currentMissing:false,fields:[{field:'name',changedSinceBase:true,alreadyDesired:false}]}};
  const store={snapshot:()=>copy(state),subscribe(fn){fn(copy(state));return()=>{};},resolveConflict(){},retry(){}};
  const win={location:{href:'https://example.test/index.html?section=cards'},history:{pushState(){}},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,scrollTo(){}};
  const shell=mountAuthoringShell039({root,store,document:doc,window:win});t.after(()=>shell.destroy());
  const table=root.querySelector('.au-notice').querySelector('table');assert.ok(table);assert.deepEqual(table.querySelectorAll('td').map(cell=>cell.textContent),['내 이름','DB 이름']);
  assert.ok(button041(root,'DB 내용 사용')&&button041(root,'내 수정 적용'),'The existing choices stay.');
});
