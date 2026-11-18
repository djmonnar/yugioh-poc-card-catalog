import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthoringStore039} from '../authoring039-store.js';
import {describeDbHistoryRow171,renderDbHistory171} from '../authoring170-history.js';
import {Document041,button041} from './authoring041-test-dom.js';

const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
const studioRow={revision:876,created_at:'2026-11-18T14:53:45Z',actor:'editor@example.invalid',kind:'studio',bytes:100,items:[
  {entity_type:'deck',entity_id:'deck-a',operation:'patch',fields:['main','name']},
  {entity_type:'deck',entity_id:'deck-b',operation:'patch',fields:['main']},
  {entity_type:'relic',entity_id:'restoring_ankh',operation:'patch',fields:['description','params']}]};

test('a studio save lists who changed which items and fields', () => {
  const info=describeDbHistoryRow171(studioRow);
  assert.equal(info.revision,876);
  assert.equal(info.title,'개정 876');
  assert.equal(info.who,'editor@example.invalid');
  assert.deepEqual(info.lines,['덱 수정 2개 · deck-a, deck-b · main, name','유물 수정 1개 · restoring_ankh · description, params']);
  const management=describeDbHistoryRow171({revision:877,actor:null,kind:'management-additive-websync161',items:[]});
  assert.equal(management.who,'작성자 기록 없음');
  assert.deepEqual(management.lines,['관리 반영 · management-additive-websync161']);
  const many=describeDbHistoryRow171({revision:5,kind:'studio',items:Array.from({length:8},(_,i)=>({entity_type:'card_display',entity_id:String(i),operation:'patch',fields:['name']}))});
  assert.deepEqual(many.lines,['카드 표시 수정 8개 · 0, 1, 2, 3, 4, 5 외 2개 · name']);
});

test('the store reads the editor-only history functions and refuses without an editor login', async () => {
  const calls=[];
  const fake=editor=>({canEdit083:()=>editor,client:{rpc:async(name,args)=>{calls.push([name,args]);return name==='poc_load_history039'?{data:{rows:[studioRow]}}:{data:{revision:876,changes:[{fields:{name:'x'}}]}};}}});
  assert.deepEqual(await AuthoringStore039.prototype.loadHistory039.call(fake(true),{before:900}),[studioRow]);
  assert.deepEqual(calls[0],['poc_load_history039',{p_before:900,p_limit:50}]);
  assert.equal((await AuthoringStore039.prototype.loadHistoryRevision039.call(fake(true),876)).revision,876);
  assert.deepEqual(calls[1],['poc_load_history_revision039',{p_revision:876}]);
  await assert.rejects(()=>AuthoringStore039.prototype.loadHistory039.call(fake(false),{}),/편집자로 로그인/);
  await assert.rejects(()=>AuthoringStore039.prototype.loadHistoryRevision039.call(fake(true),0),/편집자로 로그인/);
  const broken={canEdit083:()=>true,client:{rpc:async()=>({error:{message:'poc_history_forbidden'}})}};
  await assert.rejects(()=>AuthoringStore039.prototype.loadHistory039.call(broken,{}),error=>error.message==='poc_history_forbidden');
});

test('the history panel shows DB rows, pages back and opens one save', async () => {
  const doc=new Document041(),host=doc.createElement('div');doc.body.append(host);
  const el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const button=(label,onClick)=>{const node=el('button',label);node.addEventListener('click',onClick);return node;};
  const asked=[];
  const db={list:async before=>{asked.push(before);return before===null?[studioRow,{...studioRow,revision:875}]:[{...studioRow,revision:874}];},detail:async revision=>({revision,changes:[{fields:{name:'저장된 이름'}}]})};
  renderDbHistory171({host,el,button,db,pageSize:2});
  await flush();
  assert.match(host.textContent,/제작소 저장 기록/);
  assert.match(host.textContent,/개정 876/);
  assert.match(host.textContent,/editor@example\.invalid/);
  assert.match(host.textContent,/저장 기록 2개/);
  const more=button041(host,'이전 기록 더 보기');
  assert.equal(more.hidden,false);
  more.click();await flush();
  assert.deepEqual(asked,[null,875]);
  assert.match(host.textContent,/개정 874/);
  assert.equal(button041(host,'이전 기록 더 보기').hidden,true);
  button041(host,'저장 내용 보기').click();await flush();
  assert.match(host.textContent,/저장된 이름/);
  const failing=doc.createElement('div');doc.body.append(failing);
  renderDbHistory171({host:failing,el,button,db:{list:async()=>{throw new Error('poc_history_forbidden');}}});
  await flush();
  assert.match(failing.textContent,/poc_history_forbidden 제작소 편집에는 영향이 없습니다/);
});
