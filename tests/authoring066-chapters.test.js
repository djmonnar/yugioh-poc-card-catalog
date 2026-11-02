import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoringPanels039} from '../authoring039-panels.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const copy=structuredClone,tick=()=>new Promise(resolve=>setImmediate(resolve)),flush=async()=>{await tick();await tick();};
function chapterFixture(){
  const state=fixture041();state.bootstrap.capabilities.deck_compositions044=true;state.user={id:'synthetic-chapter066'};
  const decks=state.entities.filter(row=>row.entity_type==='deck').slice(0,9);decks.forEach((deck,index)=>{deck.content.name=deck.content.deck_name=`공유 덱 ${index+1}`;});
  const encounter=(name,lp_bonus=0)=>({name,deck_name:name,profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
  state.entities=state.entities.filter(row=>!['deck','chapter_role'].includes(row.entity_type));state.entities.push(...decks);
  for(const chapter of [1,2,3])for(const role of ['battle','elite','boss'])state.entities.push({entity_type:'chapter_role',entity_id:`${chapter}:${role}`,version:1,state:'saved',issues:[],content:{chapter,role,lp_bonus:0,entries:Array.from({length:chapter===1&&role==='battle'?8:2},(_,i)=>({entry_id:`enc-${chapter}-${role}-${i}`,deck_id:decks[i%2].entity_id,weight:i+1,encounter:encounter(`${chapter}장 ${role} 상대 ${i+1}`,i*100)}))}});
  state.bootstrap.authoring={entities:copy(state.entities)};return state;
}
function panelHarness(t,{canEdit=true}={}){
  const state=chapterFixture();state.canEdit=canEdit;const document=new Document041(),root=document.createElement('main');document.body.append(root);const writes=[],errors=[],navigations=[];
  const panels=createAuthoringPanels039({document,onError:error=>errors.push(error.message),onNavigate:(...args)=>navigations.push(args),onChange:(type,id,fields)=>{writes.push(copy({type,id,fields}));const row=state.entities.find(row=>row.entity_type===type&&row.entity_id===id);row.content={...row.content,...copy(fields)};row.localDraft060=true;panels.render('chapters',root,state);return {staged:true};}});
  panels.render('chapters',root,state);t.after(()=>panels.destroy());return {state,document,root,panels,writes,errors,navigations,role:()=>state.entities.find(row=>row.entity_id==='1:battle')};
}
const editor=m=>m.root.querySelector('.au-encounter-editor066'),workspace=m=>m.root.querySelector('.au-chapter-workspace066');
function open(m,index=0){m.root.querySelectorAll('.au-entry-pick066')[index].click();return editor(m);}
async function input(control,value,{blur=true}={}){control.focus();control.value=String(value);control.fire('input');if(blur)control.blur();await flush();}

test('chapter roster starts compact and creates only one selected opponent form',t=>{
  const m=panelHarness(t);assert.equal(m.root.querySelectorAll('.au-entry066').length,6);assert.equal(field041(m.root,'상대 추가 LP'),undefined);assert.equal(workspace(m).dataset.mode,'list');
  open(m,1);assert.equal(workspace(m).dataset.mode,'editor');assert.equal(editor(m).dataset.entryId,'enc-1-battle-1');assert.equal(m.root.querySelectorAll('input').filter(node=>node.getAttribute('aria-label')==='상대 추가 LP').length,1);
  assert.ok(editor(m).textContent.includes('1장 battle 상대 2 설정'));assert.ok(editor(m).textContent.includes('1장 · 일반 전투'));assert.equal(m.root.querySelectorAll('.au-entry-pick066').filter(node=>node.getAttribute('aria-pressed')==='true').length,1);
  button041(editor(m),'편성 목록으로').click();assert.equal(workspace(m).dataset.mode,'list');assert.equal(m.writes.length,0);
});

test('search and paging locate opponents without creating every hidden form',async t=>{
  const m=panelHarness(t);button041(m.root.querySelector('.au-assigned066'),'다음').click();assert.equal(m.root.querySelectorAll('.au-entry066').length,2);
  await input(field041(m.root,'편성된 덱 검색'),'상대 8');assert.equal(m.root.querySelectorAll('.au-entry066').length,1);open(m);assert.equal(editor(m).dataset.entryId,'enc-1-battle-7');assert.equal(m.writes.length,0);
});

test('selected encounter is isolated by region while its local edits survive navigation',async t=>{
  const m=panelHarness(t);open(m,1);await input(field041(editor(m),'상대 추가 LP'),1700);assert.equal(m.role().content.entries[1].encounter.lp_bonus,1700);
  button041(m.root,'2장').click();assert.ok(m.root.querySelector('.au-chapter-context066').textContent.includes('2장 · 일반 전투'));assert.equal(workspace(m).dataset.mode,'list');assert.equal(field041(m.root,'상대 추가 LP'),undefined);
  open(m);assert.equal(editor(m).dataset.entryId,'enc-2-battle-0');assert.equal(field041(editor(m),'상대 추가 LP').value,'0');
  button041(m.root,'1장').click();assert.equal(editor(m).dataset.entryId,'enc-1-battle-1');assert.equal(field041(editor(m),'상대 추가 LP').value,'1700');assert.equal(m.writes.length,1);
});

test('weight and opponent settings merge into latest encounter data during deferred background renders',async t=>{
  const m=panelHarness(t);open(m);const lp=field041(editor(m),'상대 추가 LP');lp.focus();
  m.role().content.entries[0].encounter.opening_draw_bonus=2;m.role().content.entries[1].encounter.name='배경 갱신된 다른 상대';m.panels.render('chapters',m.root,m.state);
  assert.equal(field041(editor(m),'상대 추가 LP'),lp);await input(lp,1200,{blur:false});
  const changed=m.writes.at(-1).fields.entries;assert.equal(changed[0].encounter.lp_bonus,1200);assert.equal(changed[0].encounter.opening_draw_bonus,2);assert.equal(changed[1].encounter.name,'배경 갱신된 다른 상대');lp.blur();
});

test('adding a searched shared deck creates one new encounter and opens it without copying the deck',async t=>{
  const m=panelHarness(t);button041(m.root.querySelector('.au-chapter-modes066'),'상대 추가').click();assert.equal(workspace(m).dataset.mode,'add');await input(field041(m.root,'후보 덱 검색'),'공유 덱 9');
  const row=m.root.querySelector('.au-add066').querySelector('.au-assignment-row'),deckId=row.dataset.deckId;button041(row,'상대 추가').click();await flush();
  assert.equal(m.writes.length,1);assert.equal(m.writes[0].type,'chapter_role');const entry=m.role().content.entries.at(-1);assert.equal(entry.deck_id,deckId);assert.match(entry.entry_id,/^enc-/);assert.equal(workspace(m).dataset.mode,'editor');assert.equal(editor(m).dataset.entryId,entry.entry_id);assert.equal(m.state.entities.filter(row=>row.entity_type==='deck').length,9);
});

test('same shared deck remains independently configurable and removing one encounter preserves its siblings',async t=>{
  const m=panelHarness(t);open(m);button041(editor(m),'같은 덱으로 상대 추가').click();await flush();const entry=m.role().content.entries.at(-1),first=m.role().content.entries[0];assert.equal(entry.deck_id,first.deck_id);assert.notEqual(entry.entry_id,first.entry_id);
  await input(field041(editor(m),'상대 추가 LP'),2100);assert.equal(m.role().content.entries[0].encounter.lp_bonus,0);button041(editor(m),'편성에서 제외').click();await flush();assert.equal(workspace(m).dataset.mode,'list');assert.ok(m.role().content.entries.some(row=>row.entry_id===first.entry_id));assert.ok(!m.role().content.entries.some(row=>row.entry_id===entry.entry_id));
});

test('viewers can inspect an opponent but cannot change fields or add, duplicate or remove encounters',t=>{
  const m=panelHarness(t,{canEdit:false});open(m);for(const node of editor(m).querySelectorAll('input,select,textarea').filter(node=>node.getAttribute('aria-label')!=='추가할 특성'))assert.equal(node.disabled,true,node.getAttribute('aria-label'));assert.equal(button041(editor(m),'특성 추가').disabled,true);assert.equal(button041(editor(m),'편성에서 제외').disabled,true);assert.equal(button041(editor(m),'같은 덱으로 상대 추가').disabled,true);
  button041(m.root.querySelector('.au-chapter-modes066'),'상대 추가').click();for(const row of m.root.querySelector('.au-add066').querySelectorAll('.au-assignment-row'))assert.equal(button041(row,'상대 추가').disabled,true);assert.equal(m.writes.length,0);
});

test('region LP remains discoverable and is separate from the selected opponent LP',async t=>{
  const m=panelHarness(t);button041(m.root,'구역 LP 설정').click();assert.equal(m.root.querySelector('.au-region-settings066').open,true);await input(field041(m.root,'구역 추가 LP'),800);assert.equal(m.role().content.lp_bonus,800);assert.equal(m.role().content.entries[0].encounter.lp_bonus,0);open(m);assert.equal(field041(editor(m),'상대 추가 LP').value,'0');
});

test('real manual draft layer keeps edits across opponent and region navigation until scoped Save',async t=>{
  const state=chapterFixture(),document=new Document041(),root=document.createElement('main'),listeners=new Set(),writes=[];document.body.append(root);
  const store={snapshot:()=>copy(state),subscribe(fn){listeners.add(fn);fn(copy(state));return()=>listeners.delete(fn);},patchTogether068(changes){const candidates=changes.map(({type,id,fields})=>{const row=state.entities.find(row=>row.entity_type===type&&row.entity_id===id);assert.ok(row);return {type,id,fields,row};});const result=[];for(const {type,id,fields,row} of candidates){writes.push(copy({type,id,fields}));row.content={...row.content,...copy(fields)};row.version++;result.push(copy(row));}state.bootstrap.authoring.entities=copy(state.entities);for(const listener of listeners)listener(copy(state));return Promise.resolve({kind:'unified039-write-ack',entities:result});},patch(type,id,fields){writes.push(copy({type,id,fields}));const row=state.entities.find(row=>row.entity_type===type&&row.entity_id===id);row.content={...row.content,...copy(fields)};row.version++;state.bootstrap.authoring.entities=copy(state.entities);for(const listener of listeners)listener(copy(state));return Promise.resolve({kind:'unified039-write-ack',entities:[copy(row)]});}};
  const window={location:{href:'https://example.test/index.html?section=chapters'},history:{pushState(_state,_title,url){window.location.href=new URL(url,window.location.href).href;}},addEventListener(){},removeEventListener(){},setTimeout(fn,ms){const timer=setTimeout(fn,ms);timer.unref?.();return timer;},clearTimeout,scrollTo(){}};
  const shell=mountAuthoringShell039({root,store,manualSave:true,document,window});t.after(()=>shell.destroy());const m={root};open(m);await input(field041(editor(m),'상대 이름'),'저장 전 상대');assert.equal(writes.length,0);
  button041(editor(m),'편성 목록으로').click();open(m,1);await input(field041(editor(m),'상대 추가 LP'),1500);button041(root,'2장').click();open(m);await input(field041(editor(m),'상대 추가 LP'),2200);assert.equal(writes.length,0);
  button041(root,'1장').click();assert.equal(field041(editor(m),'상대 추가 LP').value,'1500');button041(editor(m),'이 구역 저장').click();await flush();
  assert.equal(writes.length,1);assert.equal(writes[0].id,'1:battle');assert.equal(writes[0].fields.entries[0].encounter.name,'저장 전 상대');assert.equal(writes[0].fields.entries[1].encounter.lp_bonus,1500);assert.equal(shell.drafts060.summary().dirtyCount,1);assert.equal(shell.drafts060.summary().items[0].id,'2:battle');
});
