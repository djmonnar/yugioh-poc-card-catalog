import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {catalogAdditions049,catalogAdditionMatches049,sortCatalogRegistered049} from '../authoring049-recent.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const expansion=JSON.parse(fs.readFileSync(new URL('../data/native-expansion049.json',import.meta.url),'utf8')).cards;
function state049(){
  const state=fixture041();
  // Immutable new-card metadata is test input only. Runtime browsing continues
  // to consume the one catalog in the DB bootstrap already held by the store.
  state.bootstrap.catalog.cards.push(...expansion.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,categories:['테스트 추가'],stock:true,draw_enabled:true})));
  state.entities.push({entity_type:'category',entity_id:'test-addition',version:1,content:{name:'테스트 추가'},state:'saved',issues:[]});
  return state;
}
function mounted(t,{section='cards',state=state049()}={}){
  const document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);
  const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(args),onError:error=>{throw error;}});panels.render(section,root,state);t.after(()=>panels.destroy());
  return {document,root,state,panels,writes,section,search:field041(root,'카드 검색')};
}
const tiles=m=>m.root.querySelector('.au-catalog-results').querySelectorAll('.au-card-tile');
const firstName=m=>tiles(m)[0]?.querySelector('strong').textContent;
const summary=m=>m.root.querySelector('.au-card-results-summary').textContent;
const expectedNewest=m=>sortCatalogRegistered049(normalizeCatalog039(m.state))[0].name_ko;

test('the authoritative current catalog yields75 latest and30 previous additions without dates',()=>{
  const state=state049(),cards=normalizeCatalog039(state),before=JSON.stringify(cards),index=catalogAdditions049(cards);
  assert.equal(cards.length,1531);assert.equal(index.latest.key,'Cards049');assert.deepEqual(index.groups.map(g=>g.count),[75,30]);assert.equal(index.count,105);
  assert.equal(cards.filter(c=>catalogAdditionMatches049(c,'latest',index)).length,75);
  assert.equal(cards.filter(c=>catalogAdditionMatches049(c,'Cards035',index)).length,30);
  assert.equal(cards.filter(c=>catalogAdditionMatches049(c,'all',index)).length,105);assert.equal(JSON.stringify(cards),before);
});

test('a future catalog expansion becomes latest automatically and original card art edits do not create a batch',()=>{
  const cards=normalizeCatalog039(state049()),base=cards.find(c=>c.source_id===0),future={...cards.at(-1),source_id:2500,internal_id:2500,web_slot:1532,slot:1532,identity_key:'f'.repeat(64),art_key:'Cards050/2500'};
  const input=[...cards,{...base,image_url:'assets/native999/cards/0.jpg'},future],index=catalogAdditions049(input);
  assert.equal(index.latest.key,'Cards050');assert.deepEqual(index.groups.map(g=>g.count),[1,75,30]);assert.equal(index.byIdentity.has(base.identity_key),false);
  for(const malformed of [{...future,identity_key:''},{...future,art_key:'Cards050/2499'},{...future,web_slot:0,slot:0}])assert.equal(catalogAdditions049([malformed]).groups.length,0);
});

test('registration sorting uses catalog append order and never card-name or edit order',()=>{
  const cards=normalizeCatalog039(state049()),before=JSON.stringify(cards),sorted=sortCatalogRegistered049(cards);
  assert.equal(sorted[0].source_id,2494);assert.equal(sorted[0].slot,1531);
  assert.ok(sorted.every((c,i)=>i===0||sorted[i-1].slot>=c.slot));
  const renamed=cards.map(c=>({...c,name_ko:'이름 수정 '+(9999-c.source_id)}));assert.deepEqual(sortCatalogRegistered049(renamed).map(c=>c.source_id),sorted.map(c=>c.source_id));
  assert.equal(JSON.stringify(cards),before);
});

for(const section of ['cards','decks'])test(`${section}: latest additions are one action away, selected, counted and newest first`,t=>{
  const m=mounted(t,{section}),all=button041(m.root,'전체 카드'),recent=button041(m.root,'최근 추가');
  assert.equal(all.getAttribute('aria-pressed'),'true');assert.equal(recent.getAttribute('aria-pressed'),'false');assert.equal(field041(m.root,'카드 정렬').value,'name');
  recent.click();assert.equal(all.getAttribute('aria-pressed'),'false');assert.equal(recent.getAttribute('aria-pressed'),'true');assert.equal(field041(m.root,'카드 정렬').value,'registered');
  assert.equal(firstName(m),expectedNewest(m));assert.match(summary(m),/^75종 · 최근 추가 · 최근 등록순/);assert.equal(tiles(m).length,24);
  assert.equal(field041(m.root,'추가 묶음').selectedOptions[0].textContent,'최근 추가 · 75종');assert.equal(m.writes.length,0);
});

test('latest, previous and all addition batches share the same current catalog',t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();const batch=field041(m.root,'추가 묶음');
  batch.value='Cards035';batch.fire('change');assert.match(summary(m),/^30종 · 이전 추가/);assert.equal(firstName(m),normalizeCatalog039(m.state).find(c=>c.source_id===2419).name_ko);
  batch.value='all';batch.fire('change');assert.match(summary(m),/^105종 · 추가 카드 전체/);assert.equal(firstName(m),expectedNewest(m));
  button041(m.root,'전체 카드').click();assert.match(summary(m),/^1,531종/);assert.equal(batch.parentElement.hidden,true);assert.equal(field041(m.root,'카드 정렬').value,'registered');assert.equal(m.writes.length,0);
});

test('search, category and type intersect the addition scope without replacing the Korean input',t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();const category=field041(m.root,'카테고리 필터'),type=field041(m.root,'종류');
  category.value='테스트 추가';category.fire('change');type.value='일반 마법';type.fire('change');
  m.search.focus();m.search.fire('compositionstart');m.search.value='융합';m.search.fire('input',{isComposing:true});
  assert.equal(field041(m.root,'카드 검색'),m.search);assert.equal(m.document.activeElement,m.search);assert.ok(tiles(m).length>0);assert.ok(tiles(m).every(tile=>tile.querySelector('.au-card-kind').textContent==='일반 마법'));
  assert.match(summary(m),/최근 추가/);assert.ok(m.root.querySelector('.au-filter-chips').textContent.includes('테스트 추가'));assert.equal(m.writes.length,0);
});

test('search clear preserves addition selection, and empty-result reset restores the normal whole-catalog view',t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();m.search.focus();m.search.value='푸른 눈의 백룡';m.search.fire('input');
  assert.equal(tiles(m).length,0);assert.match(m.root.querySelector('.au-empty').textContent,/추가된 카드 중/);assert.match(summary(m),/^0종/);
  button041(m.root,'검색 지우기').click();assert.equal(field041(m.root,'카드 검색'),m.search);assert.equal(m.document.activeElement,m.search);assert.match(summary(m),/^75종/);assert.equal(button041(m.root,'최근 추가').getAttribute('aria-pressed'),'true');
  m.search.value='없는카드제목ZZZ';m.search.fire('input');m.root.querySelector('.au-empty').querySelector('button').click();
  assert.equal(m.search.value,'');assert.equal(button041(m.root,'전체 카드').getAttribute('aria-pressed'),'true');assert.equal(field041(m.root,'카드 정렬').value,'name');assert.match(summary(m),/^1,531종/);
});

test('sorting and addition changes reset pagination while card dialogs still use the same identity',t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();button041(m.root,'다음').click();assert.match(m.root.querySelector('.au-pagination').textContent,/2 \/ 4/);
  const order=field041(m.root,'카드 정렬');order.value='name';order.fire('change');assert.match(m.root.querySelector('.au-pagination').textContent,/1 \/ 4/);
  const art=tiles(m)[0].querySelector('.au-card-art'),name=tiles(m)[0].querySelector('strong').textContent;art.click();const dialog=m.document.body.querySelector('dialog');assert.equal(dialog.open,true);assert.ok(dialog.textContent.includes(name));assert.equal(m.writes.length,0);
});

test('deferred DB refresh discovers a future latest batch without resetting a live search field',t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();m.search.focus();m.search.fire('compositionstart');
  const next=structuredClone(m.state),template=next.bootstrap.catalog.cards.at(-1);next.bootstrap.catalog.cards.push({...template,source_id:2500,sourceId:2500,internal_id:2500,web_slot:1532,slot:1532,art_key:'Cards050/2500',artKey:'Cards050/2500',identity_key:'d'.repeat(64),name:'다음 추가 카드'});
  assert.equal(m.panels.render('cards',m.root,next),false);assert.equal(field041(m.root,'카드 검색'),m.search);assert.equal(m.document.activeElement,m.search);assert.match(summary(m),/^1종 · 최근 추가/);assert.equal(firstName(m),'다음 추가 카드');assert.equal(m.writes.length,0);
});

test('read-only viewers can combine recent additions with categories from that same public catalog',t=>{
  const state=state049();state.canEdit=false;state.entities=state.entities.filter(e=>e.entity_type!=='category');const m=mounted(t,{state});button041(m.root,'최근 추가').click();
  const category=field041(m.root,'카테고리 필터');assert.ok(category.options.some(o=>o.value==='테스트 추가'));category.value='테스트 추가';category.fire('change');assert.match(summary(m),/^75종/);assert.equal(m.writes.length,0);
});

test('a catalog with no expansion cards keeps normal browsing and honestly disables recent additions',t=>{
  const state=state049();state.bootstrap.catalog.cards=state.bootstrap.catalog.cards.filter(c=>!(c.art_key??c.artKey??'').match(/^Cards\d+\//));const m=mounted(t,{state});
  assert.equal(button041(m.root,'최근 추가').disabled,true);assert.equal(button041(m.root,'전체 카드').getAttribute('aria-pressed'),'true');assert.match(summary(m),/^1,426종/);assert.equal(tiles(m).length,24);
});

function categoryState049({tags=['category-owned','내 카드군','긴 카테고리 이름도 모두 표시합니다'],readOnly=false}={}){
  const state=state049();state.canEdit=!readOnly;state.entities.push({entity_type:'category',entity_id:'category-owned',version:1,content:{name:'내 카드군'},state:'saved',issues:[]},{entity_type:'card_annotation',entity_id:'2494',version:1,content:{tags,links:[]},state:'saved',issues:[]});return state;
}
const categoryNames049=node=>node.querySelectorAll('li').map(n=>n.textContent);

test('card tiles place current user categories immediately below the image and resolve both name and entity ID',t=>{
  const m=mounted(t,{state:categoryState049()});button041(m.root,'최근 추가').click();const tile=tiles(m)[0],labels=tile.querySelector('.au-card-categories');
  assert.equal(tile.children[0].className,'au-card-art');assert.equal(tile.children[1],labels);assert.equal(labels.getAttribute('aria-label'),'카테고리');assert.deepEqual(categoryNames049(labels),['내 카드군','긴 카테고리 이름도 모두 표시합니다']);assert.equal(labels.querySelectorAll('button').length,0);assert.equal(m.writes.length,0);
});

test('card details show the same categories below the art/header before restrictions and description',t=>{
  const m=mounted(t,{state:categoryState049()});button041(m.root,'최근 추가').click();tiles(m)[0].querySelector('.au-card-art').click();const body=m.document.body.querySelector('.au-card-detail'),labels=body.querySelector('.au-card-categories');
  assert.equal(body.children[0].textContent,'닫기');assert.equal(body.children[1].className,'au-card-heading');assert.equal(body.children[2],labels);assert.deepEqual(categoryNames049(labels),['내 카드군','긴 카테고리 이름도 모두 표시합니다']);assert.ok(body.children.indexOf(labels)<body.children.indexOf(body.querySelector('.au-card-description')));assert.ok(body.querySelectorAll('legend').some(n=>n.textContent==='카테고리'),'Existing category editing fieldset remains present.');assert.equal(m.writes.length,0);
});

test('category-free cards do not acquire an invented default label in tiles or details',t=>{
  const m=mounted(t,{state:categoryState049({tags:[]})});button041(m.root,'최근 추가').click();const tile=tiles(m)[0];assert.equal(tile.querySelector('.au-card-categories'),null);tile.querySelector('.au-card-art').click();assert.equal(m.document.body.querySelector('.au-card-detail').querySelector('.au-card-categories'),null);assert.equal(m.writes.length,0);
});

test('read-only catalog viewers get the same plain category labels without an editing popup',t=>{
  const m=mounted(t,{state:categoryState049({readOnly:true})});button041(m.root,'최근 추가').click();const tile=tiles(m)[0];assert.deepEqual(categoryNames049(tile.querySelector('.au-card-categories')),['내 카드군','긴 카테고리 이름도 모두 표시합니다']);tile.querySelector('.au-card-art').click();const body=m.document.body.querySelector('.au-card-detail');assert.deepEqual(categoryNames049(body.querySelector('.au-card-categories')),['내 카드군','긴 카테고리 이름도 모두 표시합니다']);assert.equal(body.querySelectorAll('legend').some(n=>n.textContent==='카테고리'),false);assert.equal(m.writes.length,0);
});

test('updated category names are resolved from the new DB state in both an open detail and its tile',t=>{
  const m=mounted(t,{state:categoryState049({tags:['category-owned']})});button041(m.root,'최근 추가').click();tiles(m)[0].querySelector('.au-card-art').click();const next=structuredClone(m.state);next.entities.find(e=>e.entity_type==='category'&&e.entity_id==='category-owned').content.name='바뀐 카드군 이름';m.panels.render('cards',m.root,next,{force:true});
  assert.deepEqual(categoryNames049(tiles(m)[0].querySelector('.au-card-categories')),['바뀐 카드군 이름']);assert.deepEqual(categoryNames049(m.document.body.querySelector('.au-card-detail').querySelector('.au-card-categories')),['바뀐 카드군 이름']);assert.equal(m.writes.length,0);
});

test('custom category text remains text and cannot create markup below the card art',t=>{
  const tag='<img src=x onerror=alert(1)>',m=mounted(t,{state:categoryState049({tags:[tag]})});button041(m.root,'최근 추가').click();const labels=tiles(m)[0].querySelector('.au-card-categories');assert.deepEqual(categoryNames049(labels),[tag]);assert.equal(labels.querySelectorAll('img').length,0);assert.equal(m.writes.length,0);
});
