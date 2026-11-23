import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoringPanels039,normalizeCatalog039} from '../authoring039-panels.js';
import {CARD_RELATIONS198,CARD_RELATIONS_META198} from '../authoring198-card-relations-data.js';
import {RELATION_GROUPS198,cardRelations198,cardHref198} from '../authoring198-card-relations.js';
import {authoringFixtureData039} from './authoring-fixture039.js';
import {Document041,fixture041,button041} from './authoring041-test-dom.js';

const FORWARD=['f','rm','rs','n'],STORED=[...FORWARD,'b'];
const entries=Object.entries(CARD_RELATIONS198).map(([id,entry])=>[Number(id),entry]);

test('generated relations are source_id keyed lists of known cards with a passcode check',()=>{
  assert.equal(CARD_RELATIONS_META198.schema,1);
  assert.equal(CARD_RELATIONS_META198.cards,entries.length);
  assert.match(CARD_RELATIONS_META198.catalogSha256,/^[0-9a-f]{64}$/);
  assert.match(CARD_RELATIONS_META198.scriptsSha256,/^[0-9a-f]{64}$/);
  assert.ok(entries.length>600,'relations cover the catalog');
  for(const [id,entry] of entries){
    assert.ok(Number.isSafeInteger(id)&&id>=0,`${id}`);
    assert.ok(Number.isSafeInteger(entry.c)&&entry.c>0,`${id} passcode`);
    assert.deepEqual(Object.keys(entry).filter(key=>key!=='c'&&!STORED.includes(key)),[],`${id} keys`);
    const all=STORED.flatMap(key=>entry[key]??[]);
    assert.ok(all.length>0,`${id} has a relation`);
    for(const key of STORED)if(key in entry)assert.ok(Array.isArray(entry[key])&&entry[key].length>0,`${id}.${key}`);
    assert.equal(new Set(all).size,all.length,`${id} lists each card once`);
    assert.ok(!all.includes(id),`${id} does not name itself`);
    for(const target of all)assert.ok(CARD_RELATIONS198[target],`${id} -> ${target} has its own entry (and passcode)`);
  }
});

test('reverse lists and ritual pairs mirror the forward relations',()=>{
  for(const [id,entry] of entries){
    for(const user of entry.b??[])assert.ok(FORWARD.some(key=>CARD_RELATIONS198[user][key]?.includes(id)),`${user} names ${id}`);
    for(const key of FORWARD)for(const target of entry[key]??[]){
      const other=CARD_RELATIONS198[target];
      assert.ok(other.b?.includes(id)||STORED.some(group=>other[group]?.includes(id)),`${target} lists ${id} back`);
    }
    for(const monster of entry.rm??[])assert.ok(CARD_RELATIONS198[monster].rs?.includes(id),`${monster} ritual spell ${id}`);
    for(const spell of entry.rs??[])assert.ok(CARD_RELATIONS198[spell].rm?.includes(id),`${spell} ritual monster ${id}`);
  }
});

test('relations agree with the catalog passcodes and printed text of known cards',()=>{
  const catalog=authoringFixtureData039().catalog,bySource=new Map(catalog.map(card=>[card.source_id,card])),english=id=>bySource.get(id)?.name_english;
  for(const [id,entry] of entries){const card=bySource.get(id);if(card)assert.equal(card.code,entry.c,`${id} passcode`);}
  const named=(id,key)=>(CARD_RELATIONS198[id][key]??[]).map(english);
  assert.deepEqual(named(14,'f'),['Flame Manipulator','Masaki the Legendary Swordsman']);
  assert.deepEqual(named(363,'rs'),['Black Luster Ritual']);
  assert.deepEqual(named(669,'rm'),['Black Luster Soldier']);
  assert.deepEqual(named(625,'n'),["Queen's Knight","Jack's Knight"]);
  assert.deepEqual(named(759,'n'),['Dark Magician','Magician of Black Chaos']);
  for(const support of ['Dark Magician Girl','Thousand Knives','Dark Magic Curtain','Sage\'s Stone','Dark Paladin'])assert.ok(named(34,'b').includes(support),support);
  // Pack 197: Prominence Hand names the three Hands; Thunder Dragon Colossus uses "Thunder Dragon".
  assert.deepEqual(CARD_RELATIONS198[3246].n,[3244,3248,3247]);
  assert.deepEqual(CARD_RELATIONS198[3234].f,[424]);
  assert.deepEqual(CARD_RELATIONS198[3234].n,[1003]);
  assert.ok(CARD_RELATIONS198[3244].b.includes(3246));
});

const card=(source_id,code,extra={})=>({source_id,code,slot:source_id+100,identity_key:`k${source_id}`,name_ko:`카드 ${source_id}`,type:'효과 몬스터',links:[],...extra});

test('dialog relations keep group order, hide empty groups, skip changed passcodes and list each card once',()=>{
  const relations={1:{c:11,f:[2,3],n:[3,4,9],b:[5,6]},2:{c:12,b:[1]},3:{c:13,b:[1]},4:{c:999,b:[1]},5:{c:15,n:[1]},6:{c:16,f:[1]}};
  const cards=[card(1,11),card(2,12),card(3,13),card(4,14),card(5,15),card(6,16)];
  const groups=cardRelations198(cards[0],cards,relations);
  assert.deepEqual(groups.map(group=>group.key),['f','b']);
  assert.deepEqual(groups.map(group=>group.cards.map(row=>row.source_id)),[[2,3],[5,6]]);
  assert.equal(groups[0].label,'융합 소재');assert.equal(groups[1].label,'이 카드를 지칭하는 카드');assert.equal(groups[1].page,12);
  assert.deepEqual(cardRelations198({...cards[0],code:77},cards,relations),[],'a different card at the same source_id shows nothing');
  assert.deepEqual(cardRelations198(card(8,18),cards,relations),[]);
  assert.deepEqual(cardRelations198({source_id:null},cards,relations),[]);
  assert.deepEqual(RELATION_GROUPS198.map(group=>group.label),['융합 소재','의식 몬스터','의식 마법','텍스트가 지칭하는 카드','직접 연결한 카드','이 카드를 지칭하는 카드']);
});

test('manual studio links show in both directions after the text relations and ignore stale identities',()=>{
  const cards=[card(1,11),card(2,12),card(3,13),card(4,14)];
  cards[0].links=[{slot:102,identity_key:'k2'},{slot:103,identity_key:'old'}];
  cards[3].links=[{slot:101,identity_key:'k1'}];
  const relations={1:{c:11,n:[2]},2:{c:12,b:[1]}};
  const groups=cardRelations198(cards[0],cards,relations);
  assert.deepEqual(groups.map(group=>[group.key,group.cards.map(row=>row.source_id)]),[['n',[2]],['m',[4]]]);
  assert.deepEqual(cardRelations198(cards[3],cards,relations).map(group=>[group.key,group.cards.map(row=>row.source_id)]),[['m',[1]]]);
});

test('relation links keep the page and point the hash at the card slot',()=>{
  assert.equal(cardHref198('https://example.test/studio/index.html?section=decks&deck=d1#card-5',{slot:858}),'/studio/index.html?section=decks&deck=d1#card-858');
  assert.equal(cardHref198('https://example.test/index.html?q=x',{slot:'12'}),'/index.html?q=x#card-12');
  assert.equal(cardHref198('https://example.test/index.html#card-3',{slot:null}),'/index.html');
});

function mount(state){
  const doc=new Document041(),root=doc.createElement('main');doc.body.append(root);const errors=[],navigations=[];
  const panels=createAuthoringPanels039({document:doc,onChange:()=>Promise.resolve(),onError:e=>errors.push(e.message),onNavigate:(...args)=>navigations.push(args)});
  panels.render('cards',root,state);
  return {doc,root,panels,errors,navigations,dialog:()=>doc.querySelector('dialog')};
}
const open=(ui,cards,id)=>ui.panels.openCard(cards.find(row=>row.source_id===id));
const groupKeys=dialog=>dialog.querySelectorAll('.au-card-relation-group198').map(node=>node.dataset.relation);
const linkIds=(node,group)=>node.querySelectorAll('.au-card-relation-group198').find(row=>row.dataset.relation===group).querySelectorAll('.au-card-relation-link198').map(link=>Number(link.dataset.sourceId));

test('card dialog shows fusion materials and opens a related card in the same dialog, with a way back',()=>{
  const state=fixture041(),cards=normalizeCatalog039(state),ui=mount(state);
  open(ui,cards,14);
  const dialog=ui.dialog(),section=dialog.querySelector('.au-card-relations198');
  assert.ok(section.textContent.includes('관련 카드'));
  assert.deepEqual(groupKeys(dialog),['f']);
  assert.ok(section.textContent.includes('융합 소재 · 2장'));
  assert.deepEqual(linkIds(dialog,'f'),[141,292]);
  const link=dialog.querySelectorAll('.au-card-relation-link198')[0],target=cards.find(row=>row.source_id===141);
  assert.ok(link.textContent.includes(target.name_ko));
  assert.equal(link.href,`/index.html#card-${target.slot}`);
  link.fire('click',{button:0});
  assert.equal(dialog.open,true);assert.equal(dialog.dataset.source,'141');
  assert.deepEqual(groupKeys(dialog),['b']);assert.deepEqual(linkIds(dialog,'b'),[14]);
  const back=button041(dialog,`← ${cards.find(row=>row.source_id===14).name_ko}`);
  back.click();
  assert.equal(dialog.dataset.source,'14');
  assert.equal(dialog.querySelectorAll('.au-card-back198').length,0);
  assert.deepEqual(ui.navigations,[]);assert.deepEqual(ui.errors,[]);
});

test('ritual monsters and ritual spells link to each other',()=>{
  const state=fixture041(),cards=normalizeCatalog039(state),ui=mount(state);
  open(ui,cards,363);
  assert.deepEqual(groupKeys(ui.dialog()),['rs']);assert.deepEqual(linkIds(ui.dialog(),'rs'),[669]);
  assert.ok(ui.dialog().textContent.includes('의식 마법 · 1장'));
  open(ui,cards,669);
  assert.deepEqual(groupKeys(ui.dialog()),['rm']);assert.deepEqual(linkIds(ui.dialog(),'rm'),[363]);
  assert.equal(ui.dialog().querySelectorAll('.au-card-back198').length,0,'opening from the catalog starts a fresh trail');
});

test('modified clicks keep the browser default so the related card can open in a new tab',()=>{
  const state=fixture041(),cards=normalizeCatalog039(state),ui=mount(state);
  open(ui,cards,14);
  const link=ui.dialog().querySelector('.au-card-relation-link198');let prevented=false;
  link.fire('click',{button:0,ctrlKey:true,preventDefault(){prevented=true;}});
  link.fire('click',{button:1,preventDefault(){prevented=true;}});
  assert.equal(prevented,false);assert.equal(ui.dialog().dataset.source,'14');
});

test('long reverse lists page by twelve and cards without relations show no section',()=>{
  const state=fixture041(),cards=normalizeCatalog039(state),ui=mount(state),present=new Set(cards.map(row=>row.source_id));
  open(ui,cards,34);
  const dialog=ui.dialog(),expected=CARD_RELATIONS198[34].b.filter(id=>present.has(id));
  assert.ok(expected.length>12);
  assert.ok(dialog.textContent.includes(`이 카드를 지칭하는 카드 · ${expected.length}장`));
  assert.deepEqual(linkIds(dialog,'b'),expected.slice(0,12));
  button041(dialog,'더 보기').click();
  assert.deepEqual(linkIds(dialog,'b'),expected);
  assert.equal(button041(dialog,'더 보기').hidden,true);
  const plain=cards.find(row=>!CARD_RELATIONS198[row.source_id]&&!row.links.length&&!cards.some(other=>other.links.some(link=>link.slot===row.slot)));
  open(ui,cards,plain.source_id);
  assert.equal(ui.dialog().querySelector('.au-card-relations198'),null);
  assert.ok(ui.dialog().querySelector('.au-card-decks172'),'the deck list still shows');
});
