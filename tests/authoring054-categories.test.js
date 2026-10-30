import test from 'node:test';
import assert from 'node:assert/strict';
import {groupCategories054,createCategoryPicker054,categoryMatcher054} from '../authoring054-categories.js';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

const categoryNames=['효과-공격력 상승','덱-백룡','면역-파괴','발동-리버스','소환-묘지','지원-드래곤','파괴-전투','내 분류'];
function mountPicker(options={}){const document=new Document041(),writes=[],errors=[],picker=createCategoryPicker054({document,categories:categoryNames,onChange:next=>writes.push(next),onError:error=>errors.push(error),...options});document.body.append(picker.root);return {document,writes,errors,...picker};}
const checkbox=(root,name)=>field041(root,name);
function choose(root,name,checked=true){const input=checkbox(root,name);assert.ok(input,name);input.checked=checked;input.fire('change');return input;}

test('existing prefixes become stable groups without renaming tags, duplicating categories or mutating source data',()=>{
 const input=[...categoryNames,'덱-백룡','덱-블루-아이즈'],before=JSON.stringify(input),groups=groupCategories054(input);
 assert.deepEqual(groups.map(row=>row.label),['덱','면역','발동','소환','지원','파괴','효과','기타']);
 assert.deepEqual(groups[0].items.map(row=>row.name),['덱-백룡','덱-블루-아이즈']);assert.equal(groups[0].items[1].label,'블루-아이즈');assert.equal(JSON.stringify(input),before);
});

test('families start collapsed, open independently, and changes across groups retain earlier selections and legacy aliases',()=>{
 const m=mountPicker({categories:[{name:'덱-백룡',aliases:['category-blue']},'면역-파괴','효과-공격력 상승'],selected:['category-blue','보관한 분류']});
 const groups=m.root.querySelectorAll('details');assert.equal(groups.every(group=>!group.open),true);groups[0].open=true;groups[0].fire('toggle');groups[1].open=true;groups[1].fire('toggle');assert.equal(groups[0].open&&groups[1].open,true);assert.equal(m.writes.length,0);
 assert.equal(checkbox(m.root,'덱-백룡').checked,true);choose(m.root,'효과-공격력 상승');choose(m.root,'면역-파괴');
 assert.deepEqual(m.writes.at(-1),['category-blue','보관한 분류','효과-공격력 상승','면역-파괴']);
 choose(m.root,'덱-백룡',false);assert.equal(m.writes.at(-1).includes('category-blue'),false);assert.equal(m.writes.at(-1).includes('보관한 분류'),true);
 assert.match(m.root.querySelector('.au-category-selected-heading054').textContent,/3개/);
});

test('Korean composition search preserves its own input and checked state, then restores the previous expanded groups',()=>{
 const memory={},m=mountPicker({selected:['덱-백룡'],memory}),group=m.root.querySelector('details');group.open=true;group.fire('toggle');
 const input=field041(m.root,'카테고리 검색');input.focus();input.setSelectionRange(1,1);input.fire('compositionstart');input.value='공격';input.fire('input',{isComposing:true});
 assert.equal(field041(m.root,'카테고리 검색'),input);assert.equal(m.document.activeElement,input);assert.equal(m.root.querySelectorAll('input').filter(node=>node.type==='checkbox').length,1);assert.equal(m.writes.length,0);
 input.fire('compositionend');input.value='';input.fire('input');assert.equal(m.root.querySelector('details').open,true);assert.equal(checkbox(m.root,'덱-백룡').checked,true);assert.deepEqual(m.selected(),['덱-백룡']);
});

test('a rejected category write restores the checkbox and selected summary without discarding existing tags',async()=>{
 const m=mountPicker({selected:['덱-백룡'],onChange:()=>Promise.reject(Error('연결 실패'))});choose(m.root,'면역-파괴');await Promise.resolve();await Promise.resolve();
 assert.deepEqual(m.selected(),['덱-백룡']);assert.equal(checkbox(m.root,'면역-파괴').checked,false);assert.equal(checkbox(m.root,'덱-백룡').checked,true);assert.equal(m.errors.length,1);
});

test('category names render as plain text and aliases never become a second checkbox',()=>{
 const name='<img src=x onerror=alert(1)>',m=mountPicker({categories:[{name:'덱-백룡',aliases:['owned']}],selected:['owned',name]});
 assert.equal(m.root.querySelectorAll('img').length,0);assert.equal(m.root.querySelectorAll('input').filter(node=>node.type==='checkbox').length,2);assert.match(m.root.textContent,/<img src=/);
});

test('name and legacy ID filters share one category while AND still requires every selected group',()=>{
 const matches=categoryMatcher054([{name:'덱-백룡',aliases:['category-blue','old-blue']},{name:'면역-파괴',aliases:['protected']}]);
 assert.equal(matches(['category-blue','protected'],['덱-백룡','면역-파괴']),true);assert.equal(matches(['덱-백룡','면역-파괴'],['old-blue','protected']),true);assert.equal(matches(['category-blue'],['덱-백룡','면역-파괴']),false);assert.equal(matches(['category-blue'],['전혀 다른 분류']),false);
});

test('removing a selected chip restores focus after a synchronous owner render replaces the picker',()=>{
 const document=new Document041(),memory={};let current;
 const render=selected=>{const next=createCategoryPicker054({document,categories:['덱-백룡'],selected,memory,onChange:render});document.body.replaceChildren(next.root);current=next;};
 render(['덱-백룡']);button041(current.root,'덱-백룡 ×').click();assert.equal(document.activeElement,field041(current.root,'카테고리 검색'));assert.deepEqual(current.selected(),[]);
});

function mountPanels(t,{canEdit=true}={}){
 const state=fixture041(),document=new Document041(),root=document.createElement('main'),writes=[];state.canEdit=canEdit;document.body.append(root);
 for(const name of ['덱-백룡','효과-공격력 상승','면역-파괴'])state.entities.push({entity_type:'category',entity_id:name,version:1,content:{name},state:'saved',issues:[]});
 const blue=state.bootstrap.catalog.cards.find(card=>card.source_id===0);blue.categories=['덱-백룡','면역-파괴'];
 const panels=createAuthoringPanels039({document,onChange:(...args)=>writes.push(args),onError:error=>{throw error;}});panels.render('cards',root,state);t.after(()=>panels.destroy());return {state,document,root,writes,panels};
}

test('card detail edits emit the existing typed annotation patch and retain independently selected groups after a DB refresh',t=>{
 const m=mountPanels(t),blue=normalizeCatalog039(m.state).find(card=>card.source_id===0);m.panels.openCard(blue);const detail=m.document.body.querySelector('.au-card-detail'),picker=detail.querySelector('.au-category-picker054'),group=picker.querySelector('details');group.open=true;group.fire('toggle');
 choose(picker,'효과-공격력 상승');choose(picker,'면역-파괴',false);
 assert.deepEqual(m.writes.at(-1),['card_annotation','0',{tags:['덱-백룡','효과-공격력 상승'],links:[]},{operation:'patch'}]);
 m.state.entities.push({entity_type:'card_annotation',entity_id:'0',version:2,content:{tags:m.writes.at(-1)[2].tags,links:[]},state:'saved',issues:[]});m.panels.render('cards',m.root,m.state,{force:true});
 const next=m.document.body.querySelector('.au-card-detail').querySelector('.au-category-picker054');assert.equal(next.querySelector('details').open,true);assert.equal(checkbox(next,'효과-공격력 상승').checked,true);assert.equal(checkbox(next,'면역-파괴').checked,false);
});

test('public category filters combine groups with AND semantics, remove selected chips and reset without a DB write',t=>{
 const m=mountPanels(t,{canEdit:false});choose(m.root,'덱-백룡');choose(m.root,'면역-파괴');assert.match(m.root.querySelector('.au-card-results-summary').textContent,/^1종/);assert.equal(m.writes.length,0);
 button041(m.root,'덱-백룡 ×').click();assert.equal(checkbox(m.root,'덱-백룡').checked,false);assert.equal(checkbox(m.root,'면역-파괴').checked,true);
 button041(m.root,'필터 초기화').click();assert.equal(checkbox(m.root,'면역-파괴').checked,false);assert.equal(m.writes.length,0);
});

test('the actual catalog finds legacy category-ID annotations under the named checkbox without rewriting stored tags',t=>{
 const m=mountPanels(t,{canEdit:false}),category=m.state.entities.find(row=>row.entity_type==='category'&&row.entity_id==='덱-백룡');category.entity_id='category-blue';
 const blue=m.state.bootstrap.catalog.cards.find(card=>card.source_id===0);blue.categories=['category-blue','면역-파괴'];m.panels.render('cards',m.root,m.state,{force:true});
 choose(m.root,'덱-백룡');choose(m.root,'면역-파괴');assert.match(m.root.querySelector('.au-card-results-summary').textContent,/^1종/);assert.deepEqual(blue.categories,['category-blue','면역-파괴']);assert.equal(m.writes.length,0);
});
