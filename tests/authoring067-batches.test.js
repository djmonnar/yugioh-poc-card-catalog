import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalogAdditions049,catalogAdditionMatches049} from '../authoring049-recent.js';
import {additionThemes067,additionThemeMatches067} from '../authoring067-themes.js';
import {ADDITION_BATCHES067} from '../authoring067-batch-data.js';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const clone=structuredClone,manifest=version=>JSON.parse(fs.readFileSync(new URL(`../data/native-expansion${version}.json`,import.meta.url),'utf8')).cards;
function fixture067(){
  const state=fixture041();state.user={id:'synthetic-batches-a'};
  for(const version of ['049','053'])state.bootstrap.catalog.cards.push(...manifest(version).map(card=>{const next={...card,source_id:card.sourceId,web_slot:card.slot,native_type:card.type,type_name:card.typeName,categories:[],stock:true,draw_enabled:true};delete next.category;return next;}));
  state.entities.push({entity_type:'category',entity_id:'my-review',version:1,state:'saved',issues:[],content:{name:'내 검토 분류'}},{entity_type:'card_annotation',entity_id:'2434',version:1,state:'saved',issues:[],content:{tags:['내 검토 분류'],links:[]}});return state;
}
function mounted(t,{section='cards',state=fixture067()}={}){
  const document=new Document041(),root=document.createElement('main'),writes=[],errors=[];document.body.append(root);const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(args),onError:error=>errors.push(error.message)});panels.render(section,root,state);t.after(()=>panels.destroy());return {document,root,panels,state,writes,errors,section};
}
const summary=m=>m.root.querySelector('.au-card-results-summary').textContent,tiles=m=>m.root.querySelector('.au-catalog-results').querySelectorAll('.au-card-tile');
const theme=(m,key)=>m.root.querySelector('.au-addition-themes067').querySelectorAll('button').find(button=>button.dataset.theme===key);
function batch(m,key){const select=field041(m.root,'추가 묶음');select.value=key;select.fire('change');return select;}
function futureCard(state){const original=state.bootstrap.catalog.cards.at(-1);return {...original,source_id:9000,sourceId:9000,internal_id:9000,web_slot:9999,slot:9999,identity_key:'f'.repeat(64),art_key:'Cards999/9000',artKey:'Cards999/9000',name:'미래 합성 추가 카드'};}

test('all three earlier batches retain meaningful stable names and identity-pinned themes',()=>{
  const cards=normalizeCatalog039(fixture067()),before=JSON.stringify(cards),metadata=JSON.stringify(ADDITION_BATCHES067),index=catalogAdditions049(cards);
  assert.deepEqual(index.groups.map(group=>[group.key,group.label,group.count]),[['Cards053','물·전사·의식·네프티스 추가',51],['Cards049','암흑계·젬나이트 추가',75],['Cards035','사이버·앤틱 기어 추가',30]]);
  assert.deepEqual(additionThemes067(cards,'Cards049',index).map(theme=>[theme.label,theme.count]),[['암흑계',29],['공용 지원',22],['젬나이트',24]]);
  assert.deepEqual(additionThemes067(cards,'Cards035',index).map(theme=>[theme.label,theme.count]),[['기계·공용 지원',12],['사이버 드래곤',8],['앤틱 기어',10]]);
  assert.equal(additionThemes067(cards,'Cards053',index).reduce((sum,theme)=>sum+theme.count,0),51);assert.equal(JSON.stringify(cards),before);assert.equal(JSON.stringify(ADDITION_BATCHES067),metadata);
});

test('theme membership does not follow renamed cards, editable tags or reused identities',()=>{
  const cards=normalizeCatalog039(fixture067()),target=cards.find(card=>card.source_id===2434),edited={...target,name_ko:'내가 고친 카드 이름',tags:['내 새 분류']};let index=catalogAdditions049([edited]);assert.equal(additionThemeMatches067(edited,'암흑계',index),true);
  const replacement={...edited,identity_key:'a'.repeat(64)};index=catalogAdditions049([replacement]);assert.equal(catalogAdditionMatches049(replacement,'Cards049',index),true);assert.equal(additionThemeMatches067(replacement,'암흑계',index),false);assert.deepEqual(additionThemes067([replacement],'Cards049',index),[{key:'unclassified',label:'분류 정보 없음',count:1}]);
  const base=cards.find(card=>card.source_id===0);assert.equal(additionThemeMatches067(base,'unclassified',index),false);
});

for(const section of ['cards','decks'])test(`${section}: named previous batches and their theme shortcuts stay directly available`,t=>{
  const m=mounted(t,{section});button041(m.root,'최근 추가').click();assert.equal(field041(m.root,'추가 묶음').value,'Cards053');assert.ok(field041(m.root,'추가 묶음').options.some(option=>option.value==='Cards049'&&option.textContent.includes('암흑계·젬나이트')));assert.ok(theme(m,'네프티스'));theme(m,'네프티스').click();assert.match(summary(m),/^14종.*네프티스/);assert.equal(tiles(m).length,14);
  batch(m,'Cards049');assert.equal(theme(m,'all').getAttribute('aria-pressed'),'true');theme(m,'암흑계').click();assert.match(summary(m),/^29종.*암흑계/);assert.equal(tiles(m).length,24);assert.equal(m.writes.length,0);
});

test('a new catalog batch cannot replace an unfinished selected batch, theme or Korean IME node',t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();batch(m,'Cards049');theme(m,'암흑계').click();const search=field041(m.root,'카드 검색');search.focus();search.fire('compositionstart');const next=clone(m.state);next.bootstrap.catalog.cards.push(futureCard(next));
  assert.equal(m.panels.render('cards',m.root,next),false);assert.equal(field041(m.root,'카드 검색'),search);assert.equal(m.document.activeElement,search);assert.equal(field041(m.root,'추가 묶음').value,'Cards049');assert.equal(theme(m,'암흑계').getAttribute('aria-pressed'),'true');assert.match(summary(m),/^29종 · 암흑계·젬나이트 추가/);assert.ok(field041(m.root,'추가 묶음').options.some(option=>option.value==='Cards999'));assert.equal(m.writes.length,0);
});

test('the explicit recent action resolves to one actual batch rather than a moving latest alias',t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();const next=clone(m.state);next.bootstrap.catalog.cards.push(futureCard(next));m.panels.render('cards',m.root,next,{force:true});assert.equal(field041(m.root,'추가 묶음').value,'Cards053');assert.match(summary(m),/^51종/);
  button041(m.root,'최근 추가').click();assert.equal(field041(m.root,'추가 묶음').value,'Cards999');assert.match(summary(m),/^1종 · 추가 묶음 999/);assert.ok(theme(m,'unclassified'));assert.equal(m.writes.length,0);
});

test('theme, text, card type and editable category filters intersect without changing any tag',t=>{
  const m=mounted(t),before=clone(m.state.entities.find(row=>row.entity_type==='card_annotation'&&row.entity_id==='2434'));button041(m.root,'최근 추가').click();batch(m,'Cards049');theme(m,'암흑계').click();const search=field041(m.root,'카드 검색');search.value='그라파';search.fire('input');assert.match(summary(m),/^2종/);
  const category=field041(m.root,'내 검토 분류');category.checked=true;category.fire('change');const type=field041(m.root,'종류');type.value='효과 몬스터';type.fire('change');assert.match(summary(m),/^1종/);assert.ok(tiles(m)[0].textContent.includes('암흑계의 용신 그라파'));assert.deepEqual(m.state.entities.find(row=>row.entity_type==='card_annotation'&&row.entity_id==='2434'),before);assert.equal(m.writes.length,0);
});

test('an owner or permission change reuses public batch membership while taking category text from the new state',t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();batch(m,'Cards049');theme(m,'암흑계').click();const next=clone(m.state);next.user={id:'synthetic-batches-b'};next.canEdit=false;next.entities=next.entities.filter(row=>row.entity_type!=='card_annotation');m.panels.render('cards',m.root,next);
  assert.equal(field041(m.root,'추가 묶음').value,'Cards049');assert.equal(theme(m,'암흑계').getAttribute('aria-pressed'),'true');assert.match(summary(m),/^29종/);assert.equal(m.root.textContent.includes('카테고리 관리'),false);assert.equal(m.writes.length,0);
});

test('a focused native batch selector keeps its exact options while a new batch refresh is deferred',async t=>{
  const m=mounted(t);button041(m.root,'최근 추가').click();const select=batch(m,'Cards049');await new Promise(resolve=>setTimeout(resolve,10));select.focus();const options=[...select.options],next=clone(m.state);next.bootstrap.catalog.cards.push(futureCard(next));assert.equal(m.panels.render('cards',m.root,next),false);assert.equal(field041(m.root,'추가 묶음'),select);assert.deepEqual(select.options,options);assert.equal(select.value,'Cards049');assert.equal(m.writes.length,0);
});
