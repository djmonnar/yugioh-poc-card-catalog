import test from 'node:test';
import assert from 'node:assert/strict';
import {Document041,field041,button041} from './authoring041-test-dom.js';
import {appendDeckPlacement068,defaultDeckEncounter068,deckPlacements068,patchDeckPlacement068,renderDeckSetup068} from '../authoring068-deck-setup.js';

const copy=structuredClone,flush=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
const profiles=[{id:'character-yugi',profile_id:'yugi',art_key:'art-yugi',profile:{name:'유희'}},{id:'character-kaiba',profile_id:'kaiba',art_key:'art-kaiba',profile:{name:'카이바'}}];
const deck={entity_type:'deck',entity_id:'deck-a',content:{name:'공유 덱',deck_name:'공유 덱',main:[],extra:[],unchanged:'deck-neutral'}};
const encounter=(name='첫 상대')=>({...defaultDeckEncounter068(deck,profiles),name,unknownEncounter:{keep:true}});
const entry=(id='entry-a',deckId='deck-a')=>({entry_id:id,deck_id:deckId,weight:2,encounter:encounter(id),unknownEntry:{keep:true}});
const role=(chapter=1,kind='battle',entries=[entry()])=>({entity_type:'chapter_role',entity_id:`${chapter}:${kind}`,content:{chapter,role:kind,lp_bonus:700,entries,unknownRole:{keep:true}}});
function harness(t,{placements=[role()],canEdit=true}={}){
  const document=new Document041(),host=document.createElement('main');document.body.append(host);const state={user:{id:'owner-a'},canEdit,entities:[copy(deck),...copy(placements)],manualSave060:true,manualDrafts060:{items:[]},canonicalEntities068:[copy(deck),...copy(placements)]},filters=new Map(),writes=[],saves=[],errors=[],renders=[],registrations=[];
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
  const button=(text,fn,cls)=>{const node=el('button',text,cls);node.onclick=()=>{try{Promise.resolve(fn()).catch(error=>errors.push(error.message));}catch(error){errors.push(error.message);}};return node;};
  const field=(label,value,spec,change,key)=>{const wrap=el('label',null,'au-field'),control=el(spec.enum?'select':'input');control.setAttribute('aria-label',label);control.dataset.editKey=key;control.disabled=!state.canEdit;if(spec.enum)for(const [i,value] of spec.enum.entries()){const option=el('option',spec.enumNames?.[i]??value);option.value=value;control.append(option);}control.value=value??'';const commit=()=>{try{const next=spec.enum?spec.enum.find(value=>String(value)===control.value):spec.type==='integer'?Number(control.value):control.value;Promise.resolve(change(next)).catch(error=>errors.push(error.message));}catch(error){errors.push(error.message);}};control[spec.enum?'onchange':'oninput']=commit;wrap.append(el('span',label),control);return wrap;};
  const renderEncounter=(host,current,liveDeck,change,key,getEntry)=>{
    host.append(field('상대 이름',current.encounter.name,{type:'string'},name=>change({name}),`${key}.name`),field('캐릭터',current.encounter.profile_id,{type:'string',enum:['yugi','kaiba']},id=>change({profile_id:id,art_key:`art-${id}`}),`${key}.profile`),field('추가 LP',current.encounter.lp_bonus,{type:'integer'},lp_bonus=>change({lp_bonus}),`${key}.lp`));
    const direct=button('특성 하나 추가',()=>change({skills:[...(getEntry()?.encounter?.skills??[]),{kind:'opening_draw',amount:1}]}));direct.disabled=!state.canEdit;host.append(direct);
  };
  const patch=(entity,fields)=>{writes.push(copy({type:entity.entity_type,id:entity.entity_id,fields}));const row=state.entities.find(row=>row.entity_type===entity.entity_type&&row.entity_id===entity.entity_id);row.content={...row.content,...copy(fields)};row.localDraft060=true;return {staged:true};};
  const draw=options=>{renders.push(options);host.replaceChildren();renderDeckSetup068({host,getState:()=>state,entities:state=>state.entities,getCharacters:()=>profiles,deckId:'deck-a',el,button,field,patch,renderEncounter,onNavigate(){},onSaveDrafts:scope=>{saves.push(copy(scope));return {success:true};},manualSaveControl:(scope,save,{message})=>{save.disabled=!state.canEdit||!(scope.localDirty068||state.entities.some(row=>row.localDraft060));message.textContent='초안 저장';},registerSave068:registration=>registrations.push(registration),filters,rerender:draw});};draw();return {state,document,host,filters,writes,saves,errors,renders,registrations,draw,role:id=>state.entities.find(row=>row.entity_id===id)};
}
const click=(m,label)=>{const node=button041(m.host,label);assert.ok(node,`Missing button ${label}`);node.click();return node;};
const input=(m,label,value,event='input')=>{const control=field041(m.host,label);assert.ok(control,`Missing field ${label}`);control.value=String(value);control.fire(event);return control;};
const openFirst=m=>{click(m,'배치 설정');m.host.querySelector('.au-setup-placement068')?.click();};

test('default creation uses current deck name and neutral current Yugi snapshot without editing the deck',()=>{
  const original=copy(deck),value=defaultDeckEncounter068(deck,[profiles[1],profiles[0]]);assert.equal(value.name,'공유 덱');assert.equal(value.deck_name,'공유 덱');assert.equal(value.profile_id,'yugi');assert.equal(value.art_key,'art-yugi');assert.equal(value.shared_character_id,null);assert.equal(value.use_shared_skills,false);assert.deepEqual(value.skills,[]);assert.deepEqual(deck,original);
});
test('placement identity is per-entry even for multiple uses of one deck and another role',()=>{
  const rows=[role(1,'battle',[entry(),entry('entry-b'),entry('other','deck-b')]),role(2,'elite',[entry('entry-c')])],before=copy(rows);assert.equal(deckPlacements068(rows,'deck-a').length,3);assert.equal(new Set(deckPlacements068(rows,'deck-a').map(row=>row.key)).size,3);assert.deepEqual(rows,before);
});
test('append is idempotent per add-session ID and preserves entries and all role metadata',()=>{
  const current=role(),before=copy(current),next=appendDeckPlacement068(current,'deck-a','entry-new',encounter());assert.equal(next.length,2);assert.deepEqual(next[0],current.content.entries[0]);assert.deepEqual(appendDeckPlacement068({...current,content:{...current.content,entries:next}},'deck-a','entry-new',encounter()),next);assert.deepEqual(current,before);
  assert.throws(()=>appendDeckPlacement068({...current,content:{...current.content,entries:next}},'deck-b','entry-new',encounter()),/배치 번호/);
});
test('role maximum blocks the 101st entry while valid same-session retries remain idempotent',()=>{
  const current=role(1,'battle',Array.from({length:100},(_,i)=>entry(`e-${i}`)));assert.throws(()=>appendDeckPlacement068(current,'deck-a','overflow',encounter()),/100명/);assert.equal(appendDeckPlacement068(current,'deck-a','e-1',encounter()).length,100);
});
test('opponent patch merges into fresh encounter and preserves siblings, unknown fields and LP',()=>{
  const current=role(1,'battle',[entry(),entry('entry-b')]);current.content.entries[0].encounter.opening_draw_bonus=2;const before=copy(current),next=patchDeckPlacement068(current,'deck-a','entry-a',{lp_bonus:1700});assert.equal(next[0].encounter.opening_draw_bonus,2);assert.equal(next[0].encounter.lp_bonus,1700);assert.deepEqual(next[0].unknownEntry,{keep:true});assert.deepEqual(next[0].encounter.unknownEncounter,{keep:true});assert.deepEqual(next[1],current.content.entries[1]);assert.deepEqual(current,before);assert.throws(()=>patchDeckPlacement068(current,'deck-b','entry-a',{name:'wrong'}),/배치가 변경/);
});
test('read-only rendering has no entity or filter mutation and starts compact with one save',t=>{
  const m=harness(t),before=copy(m.state);assert.equal(m.writes.length,0);assert.equal(m.filters.size,0);assert.equal(m.host.querySelectorAll('.au-setup-editor068').length,0);assert.equal(m.host.querySelectorAll('button').filter(node=>node.textContent==='덱과 배치 저장').length,1);assert.deepEqual(m.state,before);
});
test('one selected placement edits fresh data while preserving another use of the same deck',async t=>{
  const m=harness(t,{placements:[role(1,'battle',[entry(),entry('entry-b')])]});openFirst(m);const control=field041(m.host,'추가 LP');m.role('1:battle').content.entries[0].encounter.opening_draw_bonus=2;m.role('1:battle').content.entries[1].encounter.name='새로운 형제';control.value='1800';control.fire('input');await flush();const rows=m.writes.at(-1).fields.entries;assert.equal(rows[0].encounter.lp_bonus,1800);assert.equal(rows[0].encounter.opening_draw_bonus,2);assert.equal(rows[1].encounter.name,'새로운 형제');assert.equal(m.role('1:battle').content.lp_bonus,700);assert.equal(m.writes[0].type,'chapter_role');
});
test('new placement config is local until Add, chooses chapter/role, and double click adds once',async t=>{
  const m=harness(t,{placements:[role(),role(2,'boss',[]),role(2,'battle',[])]});click(m,'배치 설정');click(m,'배치 추가');const id=m.host.querySelector('.au-setup-editor068').dataset.entryId;input(m,'배치할 장',2,'change');input(m,'전투 종류','boss','change');input(m,'캐릭터','kaiba','change');input(m,'추가 LP',1000);assert.equal(m.writes.length,0);const add=click(m,'이 배치 추가');add.click();await flush();assert.equal(m.errors.length,0);assert.equal(m.writes.length,1);assert.equal(m.writes[0].id,'2:boss');const added=m.role('2:boss').content.entries[0];assert.equal(added.entry_id,id);assert.equal(added.encounter.profile_id,'kaiba');assert.equal(added.encounter.lp_bonus,1000);assert.equal(m.role('2:boss').content.lp_bonus,700);assert.equal(m.host.querySelectorAll('.au-setup-editor068').length,1);
});
test('add merges the latest region rows even when they change after the click but before staging',async t=>{
  const m=harness(t);click(m,'배치 설정');click(m,'배치 추가');click(m,'이 배치 추가');m.role('1:battle').content.entries.push(entry('background-entry','deck-other'));await flush();assert.equal(m.role('1:battle').content.entries.length,3);assert.ok(m.role('1:battle').content.entries.some(entry=>entry.entry_id==='background-entry'));
});
test('save with a configured local addition stages it then invokes the single atomic scope once',async t=>{
  const m=harness(t);click(m,'배치 설정');click(m,'배치 추가');input(m,'캐릭터','kaiba','change');const save=click(m,'덱과 배치 저장');save.click();await flush();assert.equal(m.writes.length,1);assert.deepEqual(m.saves,[{deckSetup068:'deck-a'}]);assert.equal(m.role('1:battle').content.entries.at(-1).encounter.profile_id,'kaiba');
});
test('unstaged local setup enables scoped Save and registration prepares it before a global scope snapshot',async t=>{
  const m=harness(t);assert.equal(button041(m.host,'덱과 배치 저장').disabled,true);click(m,'배치 설정');click(m,'배치 추가');const registered=m.registrations.at(-1);assert.equal(registered.hasLocal,true);assert.equal(registered.deckId,'deck-a');assert.equal(button041(m.host,'덱과 배치 저장').disabled,false);assert.equal(m.writes.length,0);await registered.prepare();assert.equal(m.writes.length,1);assert.equal(m.role('1:battle').content.entries.length,2);assert.equal(m.registrations.at(-1).hasLocal,false);
});
test('global prepare waits for a clicked Add already in flight, without a duplicate patch',async t=>{
  const m=harness(t);click(m,'배치 설정');click(m,'배치 추가');const registered=m.registrations.at(-1);click(m,'이 배치 추가');await registered.prepare();assert.equal(m.writes.length,1);assert.equal(m.role('1:battle').content.entries.length,2);
});
test('local setup cancel hook discards the unsubmitted configuration without entity writes',t=>{
  const m=harness(t);click(m,'배치 설정');click(m,'배치 추가');input(m,'상대 이름','취소할 이름');m.registrations.at(-1).cancel();assert.equal(m.registrations.at(-1).hasLocal,false);assert.equal(m.host.querySelector('.au-setup-editor068'),null);assert.equal(m.writes.length,0);assert.equal(button041(m.host,'덱과 배치 저장').disabled,true);
});
test('cancel racing a clicked Add cannot discard its session and leave a phantom staged placement',async t=>{
  const m=harness(t);click(m,'배치 설정');click(m,'배치 추가');const registration=m.registrations.at(-1);click(m,'이 배치 추가');assert.throws(()=>registration.cancel(),/끝난 뒤 취소/);await registration.prepare();assert.equal(m.writes.length,1);assert.equal(m.role('1:battle').content.entries.length,2);assert.equal(m.registrations.at(-1).hasLocal,false);
});
test('copying one setup creates a fresh independent entry and preserves its unknown entry/encounter data',async t=>{
  const m=harness(t);openFirst(m);click(m,'이 설정으로 배치 추가');input(m,'추가 LP',1600);click(m,'이 배치 추가');await flush();const rows=m.role('1:battle').content.entries;assert.equal(rows.length,2);assert.notEqual(rows[0].entry_id,rows[1].entry_id);assert.equal(rows[0].encounter.lp_bonus,0);assert.equal(rows[1].encounter.lp_bonus,1600);assert.deepEqual(rows[1].unknownEntry,{keep:true});assert.deepEqual(rows[1].encounter.unknownEncounter,{keep:true});assert.equal(m.role('1:battle').content.lp_bonus,700);
});
test('last opponent removal warns about the last valid game snapshot and requires a second explicit click',async t=>{
  const m=harness(t);openFirst(m);click(m,'이 배치 제외');assert.equal(m.writes.length,0);assert.ok(m.host.textContent.includes('게임은 마지막 유효 편성을 계속 사용'));click(m,'마지막 상대 제외');await flush();assert.equal(m.role('1:battle').content.entries.length,0);assert.equal(m.role('1:battle').content.lp_bonus,700);assert.equal(m.state.entities.filter(row=>row.entity_type==='deck').length,1);
});
test('changing account isolates unfinished local creation and rejects callbacks held by old account',async t=>{
  const m=harness(t);click(m,'배치 설정');click(m,'배치 추가');input(m,'상대 이름','A 로컬 이름');const stale=button041(m.host,'이 배치 추가');m.state.user={id:'owner-b'};m.draw();assert.equal(m.host.querySelector('.au-setup-editor068'),null);stale.onclick();await flush();assert.equal(m.writes.length,0);assert.ok(m.errors.some(message=>message.includes('계정이 바뀌')));m.state.user={id:'owner-a'};m.draw();assert.equal(field041(m.host,'상대 이름').value,'A 로컬 이름');
});
test('viewers can inspect one placement and empty-deck save remains present but cannot mutate',async t=>{
  const m=harness(t,{canEdit:false});openFirst(m);assert.equal(button041(m.host,'이 배치 제외').disabled,true);assert.equal(button041(m.host,'배치 추가').disabled,true);assert.equal(button041(m.host,'덱과 배치 저장').disabled,true);assert.equal(field041(m.host,'추가 LP').disabled,true);assert.equal(m.writes.length,0);const empty=harness(t,{placements:[]});assert.ok(button041(empty.host,'덱과 배치 저장'));
});
