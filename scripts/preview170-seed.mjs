// Synthetic data for the local editor preview (scripts/serve-local.mjs).
// Reads only public card files and test contracts from this repository; never a DB.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {TRAIT_KINDS184} from '../authoring184-traits.js';

const json=async file=>JSON.parse(await readFile(file,'utf8'));
const copy=structuredClone;
const row=(entity_type,entity_id,content,version=1,extra={})=>({entity_type,entity_id,version,state:'saved',issues:[],...extra,content:copy(content)});
const EXTRA=0x40|0x2000|0x800000|0x4000000;

export async function previewSeed170(root){
  const data=path.join(root,'data'),files=(await readdir(data)).filter(name=>/^native-(base|expansion)\d+\.json$/.test(name)).sort();
  const web=new Map((await json(path.join(data,'cards.json'))).cards.map(card=>[card.internal_id,card]));
  const capabilities=await json(path.join(root,'tests/fixtures/authoring-capabilities066.json'));capabilities.deck_compositions044=true;
  // (184) The production database offers the four opponent traits 184 after the WebSync184 migration; preview them too.
  for(const kind of TRAIT_KINDS184)if(!capabilities.trait_form.kinds.some(row=>row.kind===kind.kind))capabilities.trait_form.kinds.push(copy(kind));
  const schema=await json(path.join(root,'tests/fixtures/authoring-schema039.json'));
  // Pack art lives in assets/native<NNN>/cards/<id>.jpg; the DB catalog carries the same path.
  const art=new Map(),assets=path.join(root,'assets');
  for(const pack of (await readdir(assets)).filter(name=>/^native\d{3}$/.test(name)).sort())for(const name of await readdir(path.join(assets,pack,'cards')).catch(()=>[]))if(/^\d+\.jpg$/.test(name))art.set(Number(name.slice(0,-4)),`assets/${pack}/cards/${name}`);
  const seen=new Set(),catalog=[];
  for(const name of files)for(const card of (await json(path.join(data,name))).cards){
    if(seen.has(card.sourceId))continue;seen.add(card.sourceId);const meta=web.get(card.sourceId);
    catalog.push({source_id:card.sourceId,code:card.code,identity_key:card.identity_key,web_slot:card.slot,native_type:card.type,alias:card.alias,playable:card.playable,token:card.token,name:card.name,name_english:card.nameEnglish,description:card.description??'',rarity:card.rarity,stock:meta?.stock??true,draw_enabled:true,art_key:card.artKey,categories:[],links:[],normal_limit:card.deck_limit??card.normalLimit??card.maxCopies??3,speed_limit:card.speed_limit??card.speedLimit??null,attack:card.attack,defense:card.defense,level:card.level,race:card.race,attribute:card.attribute,type_name:card.typeName,image_url:art.get(card.sourceId)??meta?.image??''});
  }
  catalog.sort((a,b)=>a.source_id-b.source_id);
  const characters=[['yugi','미리보기 유희'],['kaiba','미리보기 카이바'],['mai','미리보기 메이']].map(([profile_id,name])=>({id:`preview-character-${profile_id}`,version:1,profile_id,art_key:`CharacterPresentation012/images/${profile_id}/start`,profile:{name,portrait:'',skills:[],skill_profiles:[]}}));
  const categories=['드래곤','전사','마법사','기계','지원-공용','함정 견제','융합 소재','의식'];
  const rows=categories.map(name=>row('category',name,{name,archived:false}));
  const byRace={8192:'드래곤',1:'전사',2:'마법사',32:'기계'};
  for(const card of catalog){
    const id=String(card.source_id),tag=byRace[card.race];
    rows.push(row('card_display',id,{name:card.name,name_english:card.name_english??'',description:card.description}));
    rows.push(row('card_setting',id,{rarity:card.rarity,stock:card.stock,draw_enabled:true}));
    rows.push(row('card_annotation',id,{tags:tag&&card.source_id%3!==0?[tag]:[],links:[]}));
    rows.push(row('card_limit',id,{normal_limit:null,speed_limit:null,frozen_normal_limit:card.normal_limit,frozen_speed_limit:card.speed_limit===-1?null:card.speed_limit}));
  }
  // A few visible problems for the 문제 있음 filter.
  const flagged=rows.find(item=>item.entity_type==='card_setting'&&item.entity_id==='10');if(flagged){flagged.state='saved_needs_review';flagged.issues=['preview_review'];}
  const broken=rows.find(item=>item.entity_type==='card_annotation'&&item.entity_id==='12');if(broken)broken.content.links=[{slot:999999,identity_key:'0'.repeat(64)}];
  const playable=catalog.filter(card=>card.playable&&!card.token&&card.source_id!==0&&!(card.native_type&EXTRA)&&card.normal_limit>=3&&card.speed_limit==null);
  const families=new Set(),pool=playable.filter(card=>{const family=card.alias||card.code;if(families.has(family))return false;families.add(family);return true;});
  const encounter=(name,profile_id='yugi')=>({name,deck_name:name,profile_id,art_key:`CharacterPresentation012/images/${profile_id}/start`,banlist_enabled:false,lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
  const decks=[];
  for(let index=0;index<180;index++){
    const size=index%9===4?12:20,start=(index*7)%Math.max(1,pool.length-size),main=pool.slice(start,start+size).map(card=>({source_id:card.source_id,identity_key:card.identity_key,count:1}));
    const name=`미리보기 덱 ${String(index+1).padStart(3,'0')}`;
    decks.push(row('deck',`preview-deck-${String(index).padStart(3,'0')}`,{name,deck_name:name,management_title:index%5===0?`${name} · 관리용`:'',profile_id:['yugi','kaiba','mai'][index%3],art_key:`CharacterPresentation012/images/${['yugi','kaiba','mai'][index%3]}/start`,banlist_enabled:index<10,main,extra:[],lp_bonus:0,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false}));
  }
  rows.push(...decks);
  let entry=0;
  for(let chapter=1;chapter<=3;chapter++)for(const role of ['battle','elite','boss']){
    const picks=decks.filter((_,index)=>index%9!==4).slice((chapter-1)*12+(role==='elite'?4:role==='boss'?8:0)).slice(0,role==='battle'?6:2);
    rows.push(row('chapter_role',`${chapter}:${role}`,{chapter,role,lp_bonus:0,entries:picks.map(deck=>({entry_id:`preview-entry-${++entry}`,deck_id:deck.entity_id,weight:1,encounter:encounter(deck.content.deck_name,deck.content.profile_id)}))}));
  }
  rows.push(row('starter_list','main',{entries:decks.slice(0,3).map((deck,index)=>({starter_id:`preview-starter-${index}`,name:`미리보기 시작 덱 ${index+1}`,deck_id:deck.entity_id}))}));
  for(const [type,key] of [['relic','relics'],['event','events']])for(const item of schema.form[key])rows.push(row(type,item.id,{id:item.id,kind:`preview-${item.id}`,name:item.name??`미리보기 ${item.id}`,title:item.name??`미리보기 ${item.id}`,description:'미리보기 설명',effect:'미리보기 결과',enabled:true,weight:1,rarity:'R',price:100,shopEnabled:true,params:Object.fromEntries(Object.entries(item.bounds).map(([name,bound])=>[name,bound.min]))}));
  rows.push(row('shop_rules','main',schema.shopRules));
  for(const character of characters)rows.push(row('character',character.id,{...character.profile}));
  const payload={catalog,deck_rules035:{rows:[]},opponents:{opponents:[],chapters:[]},starters:{starters:[]},content022:{relics:rows.filter(item=>item.entity_type==='relic').map(item=>item.content),events:rows.filter(item=>item.entity_type==='event').map(item=>item.content)},characters,meta017:{config:{},packs:[]},shop_rules:schema.shopRules};
  return {id:`preview170-${catalog.length}-${rows.length}`,revision:1,capabilities,catalog,characters,rows,payload};
}
