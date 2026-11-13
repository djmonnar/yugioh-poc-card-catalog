import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CARD_SORTS091,sortCards091,cardFiltersMatch091,cardQueryMatches091,cardQueryTokens091} from '../authoring091-search.js';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {Document041,fixture041,field041,button041} from './authoring041-test-dom.js';

function current(){const state=fixture041();for(const v of ['049','053','067','081','084','088','090'])state.bootstrap.catalog.cards.push(...JSON.parse(fs.readFileSync(new URL('../data/native-expansion'+v+'.json',import.meta.url),'utf8')).cards.map(c=>({...c,source_id:c.sourceId,web_slot:c.slot,native_type:c.type,type_name:c.typeName,stock:true,draw_enabled:true})));return state;}
const rows=normalizeCatalog039(current());
function mounted(t,section){const state=current(),before=JSON.stringify(state),document=new Document041(),root=document.createElement('main'),writes=[];document.body.append(root);const panel=createAuthoringPanels039({document,onChange:(...a)=>writes.push(a),onError:e=>{throw e;}});panel.render(section,root,state);t.after(()=>panel.destroy());return{state,before,document,root,writes};}
function choose(m,label,value){const control=field041(m.root,label);assert(control,label);control.value=value;control.fire('change');return control;}
const names=m=>m.root.querySelector('.au-catalog-results').querySelectorAll('.au-card-tile').map(tile=>tile.querySelector('strong').textContent);
const monster=c=>Boolean(c.native_type&1);
test('091 actual1693 cards: all10 sorts preserve identity and put missing stats last in both directions',()=>{
 assert.equal(rows.length,1693);const before=JSON.stringify(rows);
 for(const [sort] of CARD_SORTS091){const sorted=sortCards091(rows,sort);assert.equal(sorted.length,rows.length);assert.equal(new Set(sorted.map(c=>c.source_id)).size,rows.length);const field=sort.startsWith('attack-')?'atk':sort.startsWith('defense-')?'def':sort.startsWith('level-')?'level':null;if(!field)continue;
  let missing=false,previous=null;for(const c of sorted){const value=c[field],known=monster(c)&&Number.isFinite(value)&&value>=0&&(field!=='level'||value>0);if(!known){missing=true;continue;}assert.equal(missing,false,sort+' missing values must stay last');if(previous!==null)assert(sort.endsWith('-asc')?previous<=value:previous>=value);previous=value;}
 }assert.equal(JSON.stringify(rows),before);
 const edge=[{name_ko:'미상',type:'효과 몬스터',atk:-2},{name_ko:'0',type:'효과 몬스터',atk:0},{name_ko:'마법',type:'마법',atk:0},{name_ko:'100',type:'효과 몬스터',atk:100}];
 assert.deepEqual(sortCards091(edge,'attack-asc').slice(0,2).map(c=>c.atk),[0,100]);assert.deepEqual(sortCards091(edge,'attack-desc').slice(0,2).map(c=>c.atk),[100,0]);
});
test('091 query AND uses actual race/attribute rather than effect text; whitespace and token order agree',()=>{
 const expected=rows.filter(c=>monster(c)&&c.race==='전사족'&&c.attribute==='빛');
 assert(expected.length>0);for(const query of ['전사족 빛속성','빛속성 전사족','  전사족   빛 속성  ','전사 족 빛속성'])assert.deepEqual(rows.filter(c=>cardQueryMatches091(c,query)).map(c=>c.source_id),expected.map(c=>c.source_id),query);
 assert.deepEqual(cardQueryTokens091('전사족  빛 속성'),['전사족','빛속성']);
 assert.equal(cardQueryMatches091({type:'마법',race:'',attribute:'',description_ko:'빛속성 전사족을 덱에서 고른다'},'전사족 빛속성'),false);
 assert.equal(cardQueryMatches091({type:'효과 몬스터',race:'마법사족',attribute:'빛',description_ko:'전사족 지원'},'전사족 빛속성'),false);
 const a=rows.filter(c=>cardQueryMatches091(c,'푸른 눈')),b=rows.filter(c=>cardQueryMatches091(c,'눈 푸른'));assert(a.length>0);assert.deepEqual(a,b);
});
test('091 facets OR within a field, AND across fields, and metadata subtypes work with detailed spell kinds',()=>{
 const filters={race:['전사족','마법사족'],attribute:['빛','어둠'],tier:['SR','UR']};
 const expected=rows.filter(c=>!c.special&&monster(c)&&['전사족','마법사족'].includes(c.race)&&['빛','어둠'].includes(c.attribute)&&['SR','UR'].includes(c.rarity));
 assert(expected.length>0);assert.deepEqual(rows.filter(c=>cardFiltersMatch091(c,filters)),expected);
 assert.equal(cardFiltersMatch091({type:'필드 마법',subtype:'필드',native_type:0x80002},{type:['마법'],subtype:['마법:필드']}),true);
 assert.equal(cardFiltersMatch091({type:'몬스터',race:'전사족',attribute:'빛'},{race:['전사족'],attribute:['물']}),false);
});
test('race query includes spell and trap effect text; the race filter stays exact',()=>{
 const spell=rows.find(c=>c.name_ko==='야성 해방'),trap=rows.find(c=>c.name_ko==='환상수의 뿔');
 assert(spell);assert(trap);
 for(const query of ['야수족','야수 족']){
  assert(cardQueryMatches091(spell,query));assert(cardQueryMatches091(trap,query));
 }
 assert(cardQueryMatches091(spell,'마법 야수족'));
 assert(cardQueryMatches091(trap,'야수족 함정'));
 assert.equal(cardFiltersMatch091(trap,{race:['야수족'],query:'야수족'}),false);
 assert.equal(cardQueryMatches091({type:'마법',description_ko:'비행야수족 또는 환신 야수족 몬스터를 고른다.'},'야수족'),false);
 assert(cardQueryMatches091({type:'몬스터',race:'야수족'},'야수족 몬스터'));
});
for(const section of ['cards','decks'])test(section+':091 real UI sorts all results before pagination; multi selections survive ordering/search and never edit decks',t=>{
 const m=mounted(t,section),select=field041(m.root,'카드 정렬'),eligible=rows.filter(c=>section==='cards'||!c.special&&c.playable!==false);
 assert.deepEqual(select.options.map(o=>o.value),CARD_SORTS091.map(([v])=>v));
 for(const [sort] of CARD_SORTS091){choose(m,'카드 정렬',sort);const sorted=sortCards091(eligible,sort);assert.deepEqual(names(m),sorted.slice(0,24).map(c=>c.name_ko));button041(m.root,'다음').click();assert.deepEqual(names(m),sorted.slice(24,48).map(c=>c.name_ko));}
 choose(m,'종족','전사족');choose(m,'종족','마법사족');choose(m,'속성','빛');choose(m,'속성','어둠');choose(m,'등급','SR');choose(m,'등급','UR');
 assert(button041(m.root,'전사족 해제'));assert(button041(m.root,'마법사족 해제'));
 const filtered=eligible.filter(c=>monster(c)&&['전사족','마법사족'].includes(c.race)&&['빛','어둠'].includes(c.attribute)&&['SR','UR'].includes(c.rarity));assert(filtered.length>0);
 choose(m,'카드 정렬','defense-asc');assert.deepEqual(names(m),sortCards091(filtered,'defense-asc').slice(0,24).map(c=>c.name_ko));
 const input=field041(m.root,'카드 검색');input.focus();input.fire('compositionstart');input.value='전사족 빛속성';input.fire('input',{isComposing:true});
 assert.equal(m.document.activeElement,input);assert.deepEqual(names(m),sortCards091(filtered.filter(c=>c.race==='전사족'&&c.attribute==='빛'),'defense-asc').slice(0,24).map(c=>c.name_ko));assert(button041(m.root,'마법사족 해제'));
 button041(m.root,'검색 지우기').click();button041(m.root,'마법사족 해제').click();assert.equal(m.document.activeElement,field041(m.root,'종족'));assert(!button041(m.root,'마법사족 해제'));assert(button041(m.root,'전사족 해제'));
 button041(m.root,'종족 선택 해제').click();assert(!button041(m.root,'전사족 해제'));assert(button041(m.root,'빛 해제'));
 button041(m.root,'필터 초기화').click();assert.equal(field041(m.root,'카드 정렬').value,'name');assert.deepEqual(names(m),sortCards091(eligible).slice(0,24).map(c=>c.name_ko));assert.equal(m.writes.length,0);assert.equal(JSON.stringify(m.state),m.before);
});
