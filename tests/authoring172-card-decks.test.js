import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {cardDeckUsages172,cardDeckCountText172,deckHref172} from '../authoring172-card-decks.js';
import {CATALOG_PARAMS170} from '../authoring170-catalog.js';
import {Document041,fixture041,button041} from './authoring041-test-dom.js';

const clone=structuredClone;
const deck=(id,main=[],extra=[],extraFields={})=>({entity_type:'deck',entity_id:id,version:1,state:'saved',issues:[],content:{name:id,deck_name:id,main,extra},...extraFields});

test('usages count main and EX copies per deck and skip deleted decks, other entities and changed identities',()=>{
  const card={source_id:10,identity_key:'k10'};
  const rows=cardDeckUsages172([
    deck('a',[{source_id:10,identity_key:'k10',count:2},{source_id:11,identity_key:'k11',count:3}]),
    deck('b',[],[{source_id:10,identity_key:'k10',count:1}]),
    deck('c',[{source_id:10,identity_key:'old',count:3}]),
    deck('d',[{source_id:10,identity_key:'k10',count:1}],[],{deleted:true}),
    {...deck('e',[{source_id:10,identity_key:'k10',count:1}]),entity_type:'chapter_role'},
    deck('f',[{source_id:10,identity_key:'k10'}]),
    deck('g',[{source_id:12,identity_key:'k12',count:1}])
  ],card);
  assert.deepEqual(rows,[{id:'a',main:2,extra:0,total:2},{id:'b',main:0,extra:1,total:1},{id:'f',main:1,extra:0,total:1}]);
  assert.deepEqual(cardDeckUsages172(null,card),[]);
  assert.deepEqual(cardDeckUsages172([deck('a',[{source_id:10,count:1}])],{source_id:null}),[]);
});

test('count text names only the zones that hold the card',()=>{
  assert.equal(cardDeckCountText172({main:2,extra:0}),'메인 2장');
  assert.equal(cardDeckCountText172({main:0,extra:1}),'EX 1장');
  assert.equal(cardDeckCountText172({main:1,extra:2}),'메인 1장 · EX 2장');
});

test('deck link drops catalog search conditions and the hash but keeps other parameters',()=>{
  const href=deckHref172('https://example.test/studio/index.html?section=cards&q=%EC%A0%9C%EC%99%95&page=3&preview=local#top','deck-1',CATALOG_PARAMS170);
  const url=new URL(href,'https://example.test');
  assert.equal(url.pathname,'/studio/index.html');
  assert.equal(url.searchParams.get('section'),'decks');
  assert.equal(url.searchParams.get('deck'),'deck-1');
  assert.equal(url.searchParams.get('preview'),'local');
  for(const key of CATALOG_PARAMS170)assert.equal(url.searchParams.has(key),false,key);
  assert.equal(url.hash,'');
});

function mount(state){
  const doc=new Document041(),root=doc.createElement('main');doc.body.append(root);const errors=[],navigations=[];
  const panels=createAuthoringPanels039({document:doc,onChange:()=>Promise.resolve(),onError:e=>errors.push(e.message),onNavigate:(...args)=>navigations.push(args)});
  return {doc,root,panels,errors,navigations};
}

test('card dialog lists every deck holding the card with deck-list names and opens the chosen deck',()=>{
  const state=fixture041(),decks=state.entities.filter(row=>row.entity_type==='deck'&&!row.deleted);
  const counts=new Map();for(const row of decks)for(const line of [...(row.content.main??[]),...(row.content.extra??[])])counts.set(line.source_id,(counts.get(line.source_id)??0)+1);
  const [source]=[...counts].sort((a,b)=>b[1]-a[1])[0];
  const card=normalizeCatalog039(state).find(row=>row.source_id===source),expected=cardDeckUsages172(decks,card);
  assert.ok(expected.length>0);
  const ui=mount(state);ui.panels.render('cards',ui.root,state);ui.panels.openCard(card);
  const dialog=ui.doc.querySelector('dialog'),section=dialog.querySelector('.au-card-decks172'),links=dialog.querySelectorAll('.au-card-deck-link172');
  assert.ok(section.textContent.includes(`들어 있는 덱 · ${expected.length}개`));
  assert.equal(links.length,Math.min(12,expected.length));
  const expectedIds=new Set(expected.map(row=>row.id));for(const link of links)assert.ok(expectedIds.has(link.dataset.deckId),link.dataset.deckId);
  assert.equal(new Set(links.map(link=>link.dataset.deckId)).size,links.length);
  const first=links[0],usage=expected.find(row=>row.id===first.dataset.deckId);
  assert.ok(first.textContent.includes(cardDeckCountText172(usage)));
  assert.match(first.href,/section=decks/);assert.match(first.href,new RegExp(`deck=${encodeURIComponent(first.dataset.deckId)}`));
  first.fire('click',{button:0});
  assert.equal(dialog.open,false);
  assert.deepEqual(ui.navigations,[['decks',first.dataset.deckId]]);
  assert.deepEqual(ui.errors,[]);
});

test('modified clicks keep the browser default so the deck can open in a new tab',()=>{
  const state=fixture041(),decks=state.entities.filter(row=>row.entity_type==='deck'&&!row.deleted),line=decks[0].content.main[0];
  const card=normalizeCatalog039(state).find(row=>row.source_id===line.source_id);
  const ui=mount(state);ui.panels.render('cards',ui.root,state);ui.panels.openCard(card);
  const dialog=ui.doc.querySelector('dialog');dialog.open=true;const link=dialog.querySelector('.au-card-deck-link172');
  let prevented=false;link.fire('click',{button:0,ctrlKey:true,preventDefault(){prevented=true;}});
  assert.equal(prevented,false);assert.equal(dialog.open,true);assert.deepEqual(ui.navigations,[]);
});

test('a card in no deck says so and shows no links',()=>{
  const state=fixture041(),used=new Set(state.entities.filter(row=>row.entity_type==='deck').flatMap(row=>[...(row.content.main??[]),...(row.content.extra??[])].map(line=>line.source_id)));
  const card=normalizeCatalog039(state).find(row=>!used.has(row.source_id));
  const ui=mount(state);ui.panels.render('cards',ui.root,state);ui.panels.openCard(card);
  const dialog=ui.doc.querySelector('dialog');
  assert.ok(dialog.querySelector('.au-card-decks172').textContent.includes('이 카드를 넣은 덱이 없습니다.'));
  assert.equal(dialog.querySelectorAll('.au-card-deck-link172').length,0);
});

test('more than twelve decks page with the 덱 더 보기 button',()=>{
  const state=fixture041(),template=state.entities.find(row=>row.entity_type==='deck'&&!row.deleted),line=template.content.main[0];
  state.entities=state.entities.filter(row=>row.entity_type!=='deck');
  for(let i=0;i<15;i++){const copy=clone(template);copy.entity_id=`deck-${String(i).padStart(2,'0')}`;copy.content.deck_name=copy.content.name=`덱 ${i}`;copy.content.management_title=`덱 ${String(i).padStart(2,'0')}`;state.entities.push(copy);}
  const card=normalizeCatalog039(state).find(row=>row.source_id===line.source_id);
  const ui=mount(state);ui.panels.render('cards',ui.root,state);ui.panels.openCard(card);
  const dialog=ui.doc.querySelector('dialog');
  assert.equal(dialog.querySelectorAll('.au-card-deck-link172').length,12);
  button041(dialog,'덱 더 보기').click();
  assert.equal(dialog.querySelectorAll('.au-card-deck-link172').length,15);
  assert.equal(button041(dialog,'덱 더 보기').hidden,true);
});
