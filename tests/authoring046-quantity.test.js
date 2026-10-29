import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {AuthoringStore039,PROJECT039,IDENTITY039} from '../authoring039-store.js';
import {mountAuthoringShell039} from '../authoring039-shell.js';
import {Document041,fixture041,field041} from './authoring041-test-dom.js';

const BLUE='푸른 눈의 백룡',RED='붉은 눈의 흑룡',EFFECT='사이버 드래곤',FUSION='궁극의 푸른 눈의 백룡',SPELL='융합',TRAP='함정 속으로';
const clone=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const extra=card=>Boolean(card.native_type&(0x40|0x2000|0x800000|0x4000000));
const ref=(card,count=1)=>({source_id:card.source_id,identity_key:card.identity_key,count});
function fill(cards,zone,total,initial=[]){
  const rows=clone(initial),used=new Set(rows.map(row=>cards.find(card=>card.source_id===row.source_id).code));
  let remaining=total-rows.reduce((n,row)=>n+row.count,0);
  for(const card of cards){
    if(!remaining)break;if(!card.playable||card.token||extra(card)!==(zone==='extra')||used.has(card.code))continue;
    const count=Math.min(3,remaining);rows.push(ref(card,count));used.add(card.code);remaining-=count;
  }
  assert.equal(remaining,0);return rows;
}
async function mounted(t,{main=[[BLUE,1]],ex=[],banlist=false,editable=true,configure=()=>{},small=false}={}){
  const fixture=fixture041(),cards=fixture.bootstrap.catalog.cards,byName=name=>cards.find(card=>card.name===name);
  for(const card of cards){card.normal_limit=3;card.speed_limit=null;card.alias=0;}
  configure({cards,byName});
  const deck=fixture.entities.find(row=>row.entity_type==='deck');
  deck.content={...deck.content,name:'수량 테스트 덱',deck_name:'수량 테스트 덱',banlist_enabled:banlist,
    main:typeof main==='function'?main(cards,byName):main.map(([name,count])=>ref(byName(name),count)),
    extra:typeof ex==='function'?ex(cards,byName):ex.map(([name,count])=>ref(byName(name),count))};
  fixture.entities=fixture.entities.filter(row=>row.entity_type!=='deck'||row===deck);
  fixture.bootstrap.capabilities.deck_compositions044=true;
  if(small)fixture.bootstrap.catalog.cards=cards.filter(card=>[BLUE,RED,EFFECT,FUSION,SPELL,TRAP].includes(card.name));
  const remote={revision:1,rows:clone(fixture.entities),calls:[],hold:null};
  const payload={...fixture.bootstrap.game,catalog:fixture.bootstrap.catalog.cards,characters:fixture.bootstrap.characters,shop_rules:fixture.bootstrap.game.shop_rules??{}};
  const payloadText=JSON.stringify(payload);
  const envelope=()=>({schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:remote.revision,unchanged:false,
    permissions:{can_edit:editable},authoring:{entities:clone(remote.rows)},catalog:clone(fixture.bootstrap.catalog),characters:clone(fixture.bootstrap.characters),capabilities:clone(fixture.bootstrap.capabilities),
    game:{schema:1,kind:'poc-unified-game039',authoring_revision:remote.revision,game_revision:remote.revision,metadata_revision:String(remote.revision),identity:IDENTITY039,source_fingerprint:hash(payloadText),payload_json:payloadText}});
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'quantity-test-editor',email:'quantity@example.test'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{
    remote.calls.push(clone({name,args}));if(name==='poc_bootstrap039')return {data:envelope()};
    if(remote.hold){const wait=remote.hold;remote.hold=null;await wait();}
    const intent=args.p_intent,change=intent.changes[0],index=remote.rows.findIndex(row=>row.entity_type===change.entity_type&&row.entity_id===change.entity_id),old=remote.rows[index];
    assert.equal(intent.expected_project_revision,remote.revision);assert.equal(change.expected_entity_version,old?.version??0);
    const next={...old,version:(old?.version??0)+1,state:'saved',issues:[],content:{...(old?.content??{}),...clone(change.fields)}};
    remote.rows[index]=next;remote.revision++;
    return {data:{schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:remote.revision,observed_project_revision:remote.revision,
      entities:[clone(next)],game_source_fingerprint:hash(payloadText),game_revision:remote.revision}};
  }};
  const store=new AuthoringStore039({client,crypto:webcrypto,storage:{getItem:()=>null,setItem(){}},events:{},pollMs:0,debounceMs:100000,idleRefreshMs:100000});await store.start();
  const document=new Document041(),root=document.createElement('div');document.body.append(root);
  const window={location:{href:`https://example.test/index.html?section=decks&deck=${deck.entity_id}`},history:{pushState(_a,_b,url){window.location.href=new URL(url,window.location.href).href;}},scrollTo(){},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}};
  const shell=mountAuthoringShell039({root,store,document,window});t.after(()=>{shell.destroy();store.stop();});
  return {root,document,store,remote,deck,search:field041(root,'카드 검색'),cards,byName};
}
function scope(m,surface){return m.root.querySelector(surface==='owned'?'.au-deck-owned':'.au-catalog-results');}
function control(m,name,action,surface='owned'){
  const button=scope(m,surface).querySelectorAll('button').find(node=>node.getAttribute('aria-label')===`${name} ${action==='plus'?'추가':'빼기'}`);
  assert.ok(button,`${surface}: ${name} ${action} control is present`);return button;
}
function quantity(m,name,surface='owned'){return Number(control(m,name,'minus',surface).closest('.au-quantity').querySelector('span').textContent);}
function expectBoth(m,name,count){for(const surface of ['owned','search'])assert.equal(quantity(m,name,surface),count,surface);}
function focusSearch(m,name=BLUE){m.search.focus();m.search.value=String(m.byName(name).code);m.search.fire('input');}
function liveDeck(m){return m.store.snapshot().entities.find(row=>row.entity_id===m.deck.entity_id);}
function ownRow(m,name){return scope(m,'owned').querySelectorAll('.au-deck-row').find(row=>row.querySelector('strong').textContent===name);}
function expectCounts(m,monster,spell,trap){
  const counts=m.root.querySelector('.au-deck-counts');assert.ok(counts);assert.equal(counts.getAttribute('role'),'status');assert.equal(counts.getAttribute('aria-label'),'메인 덱 카드 구성');
  assert.deepEqual(counts.querySelectorAll('span').map(node=>node.textContent),[`몬스터 ${monster}장`,`마법 ${spell}장`,`함정 ${trap}장`]);
}
function expectTotal(m,total){assert.equal(m.root.querySelector('.au-deck-tabs').querySelectorAll('button').find(node=>node.dataset.mode==='deck').textContent,`내 덱 · ${total}장`);}

test('owned main and extra rows expose labelled minus, quantity and plus controls',async t=>{
  const m=await mounted(t,{ex:[[FUSION,1]],small:true});
  for(const name of [BLUE,FUSION]){
    const minus=control(m,name,'minus'),plus=control(m,name,'plus');assert.equal(minus.textContent,'−');assert.equal(plus.textContent,'＋');
    assert.equal(minus.disabled,false);assert.equal(plus.disabled,false);assert.equal(quantity(m,name),1);assert.ok(plus.closest('.au-deck-quantity'));
  }
});

test('normal forbidden, limited and semilimited cards cannot increase but remain removable',async t=>{
  for(const limit of [0,1,2]){
    const m=await mounted(t,{main:[[BLUE,Math.max(1,limit)]],banlist:true,configure:({byName})=>{byName(BLUE).normal_limit=limit;}});focusSearch(m);
    for(const surface of ['owned','search']){assert.equal(control(m,BLUE,'plus',surface).disabled,true,`normal ${limit}: ${surface}`);assert.equal(control(m,BLUE,'minus',surface).disabled,false);}
    assert.equal(m.store.snapshot().pending,0,'Availability checks must not enqueue edits.');
  }
});

test('speed restriction buckets and speed forbidden cards disable additions on both surfaces',async t=>{
  const m=await mounted(t,{main:[[BLUE,1],[RED,1]],banlist:true,configure:({byName})=>{byName(BLUE).speed_limit=2;byName(RED).speed_limit=2;},small:true});focusSearch(m);
  for(const surface of ['owned','search'])assert.equal(control(m,BLUE,'plus',surface).disabled,true);
  control(m,RED,'minus').fire('click');expectBoth(m,BLUE,1);
  for(const surface of ['owned','search'])assert.equal(control(m,BLUE,'plus',surface).disabled,false,'Removing a bucket peer frees capacity.');
  const forbidden=await mounted(t,{banlist:true,configure:({byName})=>{byName(BLUE).speed_limit=0;}});focusSearch(forbidden);
  for(const surface of ['owned','search']){assert.equal(control(forbidden,BLUE,'plus',surface).disabled,true);assert.equal(control(forbidden,BLUE,'minus',surface).disabled,false);}
});

test('three copies include alias families even with card restrictions disabled',async t=>{
  const m=await mounted(t,{main:[[BLUE,2],[RED,1]],configure:({byName})=>{byName(RED).alias=byName(BLUE).code;},small:true});focusSearch(m);
  for(const surface of ['owned','search'])assert.equal(control(m,BLUE,'plus',surface).disabled,true);
  assert.equal(control(m,RED,'plus').disabled,true);control(m,RED,'minus').fire('click');
  for(const surface of ['owned','search'])assert.equal(control(m,BLUE,'plus',surface).disabled,false);
  control(m,BLUE,'plus').fire('click');expectBoth(m,BLUE,3);
  for(const surface of ['owned','search'])assert.equal(control(m,BLUE,'plus',surface).disabled,true);
});

test('main thirty and extra fifteen capacities disable plus before the individual three-copy cap',async t=>{
  const m=await mounted(t,{main:(cards,get)=>fill(cards,'main',30,[ref(get(BLUE),2)]),ex:(cards,get)=>fill(cards,'extra',15,[ref(get(FUSION),2)])});
  for(const name of [BLUE,FUSION]){
    focusSearch(m,name);assert.equal(quantity(m,name),2);
    for(const surface of ['owned','search'])assert.equal(control(m,name,'plus',surface).disabled,true,`${name}: ${surface}`);
    control(m,name,'minus').fire('click');expectBoth(m,name,1);
    for(const surface of ['owned','search'])assert.equal(control(m,name,'plus',surface).disabled,false);
    control(m,name,'plus').fire('click');expectBoth(m,name,2);
  }
});

test('read-only viewers see quantities with both editing buttons disabled',async t=>{
  const m=await mounted(t,{editable:false,small:true});focusSearch(m);expectBoth(m,BLUE,1);
  for(const surface of ['owned','search'])for(const action of ['minus','plus'])assert.equal(control(m,BLUE,action,surface).disabled,true);
  assert.equal(m.store.snapshot().pending,0);
});

test('repeated owned clicks use pending snapshots and survive an older in-flight ACK without losing synchronization',async t=>{
  const m=await mounted(t,{small:true});focusSearch(m);control(m,BLUE,'plus').fire('click');
  expectBoth(m,BLUE,2);assert.equal(m.store.snapshot().pending,1);assert.equal(liveDeck(m).pending,true);expectTotal(m,2);
  let release;m.remote.hold=()=>new Promise(resolve=>release=resolve);const flight=m.store.drain();await new Promise(resolve=>setImmediate(resolve));
  control(m,BLUE,'plus').fire('click');expectBoth(m,BLUE,3);assert.equal(liveDeck(m).content.main[0].count,3);
  assert.equal(field041(m.root,'카드 검색'),m.search);assert.equal(m.document.activeElement,m.search);
  release();await flight;expectBoth(m,BLUE,3);assert.equal(m.store.snapshot().pending,1);
  await m.store.drain();expectBoth(m,BLUE,3);assert.equal(m.store.snapshot().pending,0);assert.equal(m.remote.rows.find(row=>row.entity_id===m.deck.entity_id).content.main[0].count,3);
  control(m,BLUE,'minus','search').fire('click');expectBoth(m,BLUE,2);control(m,BLUE,'minus').fire('click');expectBoth(m,BLUE,1);expectTotal(m,1);
  assert.equal(m.root.querySelector('.au-toast').textContent,'');assert.equal(m.root.querySelector('.au-toast').hidden,true);
});

test('main composition counters count copies by native card kind and exclude extra-deck monsters',async t=>{
  const m=await mounted(t,{main:[[BLUE,2],[EFFECT,1],[SPELL,3],[TRAP,1]],ex:[[FUSION,2]],small:true});
  expectCounts(m,3,3,1);expectTotal(m,7);assert.ok(m.root.querySelectorAll('.au-deck-zone').find(zone=>zone.querySelector('h2').textContent==='EX · 2 / 15장'));
});

test('composition counters, rows and both quantities update immediately through removal and readdition',async t=>{
  const m=await mounted(t,{main:[[BLUE,1],[SPELL,1],[TRAP,1]],ex:[[FUSION,1]],small:true});m.search.focus();
  expectCounts(m,1,1,1);control(m,BLUE,'minus','search').fire('click');assert.equal(ownRow(m,BLUE),undefined);
  assert.equal(quantity(m,BLUE,'search'),0);expectCounts(m,0,1,1);expectTotal(m,2);
  control(m,BLUE,'plus','search').fire('click');expectBoth(m,BLUE,1);expectCounts(m,1,1,1);expectTotal(m,3);
  control(m,FUSION,'plus').fire('click');expectBoth(m,FUSION,2);expectCounts(m,1,1,1);expectTotal(m,3);
  control(m,SPELL,'minus').fire('click');assert.equal(ownRow(m,SPELL),undefined);expectCounts(m,1,0,1);expectTotal(m,2);
  control(m,TRAP,'plus','search').fire('click');expectBoth(m,TRAP,2);expectCounts(m,1,0,2);expectTotal(m,3);
  assert.equal(field041(m.root,'카드 검색'),m.search);assert.equal(m.document.activeElement,m.search);assert.equal(m.root.querySelector('.au-toast').textContent,'');assert.equal(m.root.querySelector('.au-toast').hidden,true);
});
