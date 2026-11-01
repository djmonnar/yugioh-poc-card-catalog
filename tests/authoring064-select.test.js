import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

// The existing DOM boundary models ordinary browser events and node identity.
// These tests do not claim to open an Android OS picker or emulate its events.
const copy=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await pause(10);};
class DraftStorage064{
  values=new Map();
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}
async function mounted(t){
  const fixture=fixture041(),remote={revision:1,rows:copy(fixture.entities),writes:[]};
  const payload=JSON.stringify({...fixture.bootstrap.game,catalog:fixture.bootstrap.catalog.cards,characters:fixture.bootstrap.characters,shop_rules:fixture.bootstrap.game.shop_rules??{}});
  const envelope=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,
    permissions:{can_edit:true},authoring:{entities:copy(remote.rows)},catalog:copy(fixture.bootstrap.catalog),characters:copy(fixture.bootstrap.characters),capabilities:copy(fixture.bootstrap.capabilities),
    game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:remote.revision,metadata_revision:String(remote.revision),identity:IDENTITY039,source_fingerprint:hash(payload),payload_json:payload}});
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-select-editor'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
    if(name==='poc_bootstrap039')return {data:envelope()};
    assert.equal(name,'poc_apply_intent039');remote.writes.push(copy(args));
    throw Error('Selection and background-read tests must not write remotely.');
  }};
  const store=new AuthoringStore039({client,crypto:webcrypto,storage:null,events:{},pollMs:0,debounceMs:100000,idleRefreshMs:100000});
  await store.start();
  const document=new Document041(),root=document.createElement('main');document.body.append(root);
  const deck=store.snapshot().entities.find(row=>row.entity_type==='deck');
  const window={location:{href:`https://example.test/index.html?section=decks&deck=${deck.entity_id}`},history:{pushState(_a,_b,path){window.location.href=new URL(path,window.location.href).href;}},scrollTo(){},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}};
  const shell=mountAuthoringShell039({root,store,document,window,manualSave:true,draftStorage:new DraftStorage064()});
  const refresh=async fields=>{
    const row=remote.rows.find(row=>row.entity_type==='deck'&&row.entity_id===deck.entity_id);
    Object.assign(row.content,fields);row.version++;remote.revision++;
    await store.refresh(true);await settle();
  };
  t.after(()=>{shell.destroy();store.stop();assert.equal(remote.writes.length,0,'Interaction guards must not create DB writes.');});
  return {document,root,store,shell,remote,deck,refresh};
}
function control(m,label){const node=field041(m.root,label);assert.ok(node,`Missing control: ${label}`);return node;}
function preserve(m,node,label,options){
  assert.ok(control(m,label)===node,`${label} keeps its live DOM node`);
  assert.equal(node.isConnected,true);assert.ok(m.document.activeElement===node,`${label} keeps focus`);
  if(options)assert.ok(node.options.length===options.length&&node.options.every((option,index)=>option===options[index]),`${label} keeps its option nodes`);
}

test('a focused select keeps its node and options across a real background publication refresh',async t=>{
  const m=await mounted(t),select=control(m,'종류'),options=[...select.options];select.focus();
  await m.refresh({deck_name:'갱신된 원격 덱 이름'});
  preserve(m,select,'종류',options);
  assert.equal(control(m,'덱 이름').value,m.deck.content.deck_name,'The active picker defers the body refresh.');
});

test('pointerup and click timers cannot replace a still-focused select before its change event',async t=>{
  const m=await mounted(t),select=control(m,'등급'),options=[...select.options];
  select.fire('pointerdown');select.focus();await m.refresh({deck_name:'터치 중 원격 갱신'});
  select.fire('pointerup');select.fire('click');await pause(160);
  preserve(m,select,'등급',options);
  await m.refresh({deck_name:'목록을 고르는 중 추가 갱신'});preserve(m,select,'등급',options);
});

test('the recent-addition picker retains its option subtree during deferred catalog refreshes',async t=>{
  const m=await mounted(t),recent=button041(m.root,'최근 추가');assert.ok(recent);assert.equal(recent.disabled,false);recent.click();
  const select=control(m,'추가 묶음'),options=[...select.options];assert.ok(options.length);assert.equal(select.parentElement.hidden,false);select.focus();
  await m.refresh({deck_name:'추가 묶음 선택 중 갱신'});
  preserve(m,select,'추가 묶음',options);
});

test('a pending refresh from input A does not remove select B when focus moves between them',async t=>{
  const m=await mounted(t),input=control(m,'덱 이름');input.focus();
  await m.refresh({lp_bonus:100});const select=control(m,'종족'),options=[...select.options];select.focus();await settle();
  preserve(m,select,'종족',options);
});

test('a pending refresh from select A does not remove text input B after focus changes',async t=>{
  const m=await mounted(t),select=control(m,'속성');select.focus();await m.refresh({lp_bonus:100});
  const input=control(m,'덱 이름');input.focus();input.value='계속 입력하는 덱 이름';input.setSelectionRange(3,3);input.fire('input');await settle();
  preserve(m,input,'덱 이름');assert.equal(input.value,'계속 입력하는 덱 이름');assert.equal(input.selectionStart,3);
});

test('a selected enum commits its dependent fields while focus remains on that select',async t=>{
  const m=await mounted(t),select=control(m,'연출 캐릭터');select.focus();select.value='kaiba';select.fire('change');
  // Manual drafts publish their render in a microtask, after the change handler.
  await settle();
  assert.equal(control(m,'연출 캐릭터').value,'kaiba');assert.equal(control(m,'상대 이름').value,'테스트 카이바');
  const draft=m.shell.drafts060.summary().items.find(item=>item.id===m.deck.entity_id);
  assert.ok(draft?.dirty);assert.equal(draft.fields.profile_id,'kaiba');
});

test('changing a local filter applies it and releases the latest deferred body refresh',async t=>{
  const m=await mounted(t),select=control(m,'등급');select.focus();await m.refresh({deck_name:'선택 완료 뒤 표시할 최신 덱'});
  select.value='UR';select.fire('change');await settle();
  assert.equal(control(m,'등급').value,'UR');assert.equal(control(m,'덱 이름').value,'선택 완료 뒤 표시할 최신 덱');
  const cards=m.root.querySelector('.au-catalog-results').querySelectorAll('.au-rarity');assert.ok(cards.length);assert.ok(cards.every(card=>card.textContent==='UR'));
});

test('cancelling by blur applies only the newest pending refresh once without changing the selection',async t=>{
  const m=await mounted(t),select=control(m,'종류'),value=select.value;select.focus();
  const content=m.root.querySelector('.au-content'),replace=content.replaceChildren.bind(content);let bodyRenders=0;
  content.replaceChildren=(...nodes)=>{bodyRenders++;return replace(...nodes);};
  await m.refresh({deck_name:'이전 대기 갱신'});await m.refresh({deck_name:'최종 대기 갱신'});
  assert.equal(bodyRenders,0);select.blur();await settle();
  assert.equal(bodyRenders,1);assert.equal(control(m,'덱 이름').value,'최종 대기 갱신');assert.equal(control(m,'종류').value,value);
  assert.equal(m.shell.drafts060.summary().dirtyCount,0);
});

test('explicit deck navigation renders the chosen deck immediately instead of waiting for blur',async t=>{
  const m=await mounted(t),select=control(m,'편집할 덱'),next=select.options.find(option=>option.value!==select.value);assert.ok(next);
  const wanted=m.store.snapshot().entities.find(row=>row.entity_type==='deck'&&row.entity_id===next.value);
  select.focus();await m.refresh({lp_bonus:100});select.value=next.value;select.fire('change');
  assert.equal(control(m,'편집할 덱').value,next.value);assert.equal(control(m,'덱 이름').value,wanted.content.deck_name);
  assert.equal(select.isConnected,false);assert.equal(m.shell.drafts060.summary().dirtyCount,0);
});

test('explicit section navigation remains immediate while a focused picker has a deferred refresh',async t=>{
  const m=await mounted(t),select=control(m,'종류');select.focus();await m.refresh({lp_bonus:100});
  m.shell.navigate('cards');assert.equal(select.isConnected,false);assert.equal(field041(m.root,'편집할 덱'),undefined);
  assert.equal(m.root.querySelector('h1').textContent,'카드 도감');
});

test('Korean composition keeps its live input and caret while unrelated publication data arrives',async t=>{
  const m=await mounted(t),input=control(m,'덱 이름');input.focus();input.fire('compositionstart');input.value='푸르';input.setSelectionRange(2,2);input.fire('input',{isComposing:true});
  await m.refresh({lp_bonus:100});preserve(m,input,'덱 이름');assert.equal(input.value,'푸르');assert.equal(input.selectionStart,2);assert.equal(m.shell.drafts060.summary().dirtyCount,0);
  input.value='푸른 눈';input.fire('compositionend');input.fire('input',{isComposing:false});await settle();
  preserve(m,input,'덱 이름');assert.equal(m.shell.drafts060.summary().dirtyCount,1);
});

test('a checkbox gesture survives a pending refresh and commits exactly its chosen local value',async t=>{
  const m=await mounted(t),checkbox=control(m,'카드 제한 적용'),next=!checkbox.checked;
  checkbox.fire('pointerdown');checkbox.focus();await m.refresh({lp_bonus:100});assert.equal(checkbox.isConnected,true);
  checkbox.fire('pointerup');checkbox.checked=next;checkbox.fire('change');checkbox.fire('click');await settle();
  assert.equal(control(m,'카드 제한 적용').checked,next);assert.equal(m.shell.drafts060.summary().dirtyCount,1);
});
