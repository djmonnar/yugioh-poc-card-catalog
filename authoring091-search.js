import {builderCardMatches} from './ai-deck-filters.js';
import {sortCatalogRegistered049} from './authoring049-recent.js';

export const CARD_SORTS091=Object.freeze([
  ['name','이름순'],['name-desc','이름 역순'],['registered','최근 등록순'],['registered-asc','오래된 등록순'],
  ['attack-desc','공격력 높은 순'],['attack-asc','공격력 낮은 순'],
  ['defense-desc','수비력 높은 순'],['defense-asc','수비력 낮은 순'],
  ['level-desc','레벨(별) 높은 순'],['level-asc','레벨(별) 낮은 순']
]);
const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
const races=['전사족','마법사족','천사족','악마족','언데드족','기계족','물족','화염족','암석족','비행야수족','식물족','곤충족','번개족','드래곤족','야수족','야수전사족','공룡족','어류족','해룡족','파충류족','사이킥족','환신야수족','창조신족','환룡족','사이버스족','환상마족'];
const attributes={땅:1,물:2,화염:4,바람:8,빛:16,어둠:32,신:64};
const fields=['type','tier','race','attribute','subtype','limit','speedLimit','status'];
const spacedRace=new RegExp('('+races.map(r=>r.slice(0,-1)).join('|')+')\\s+족','g');
export function filterValues091(value){return [...new Set((Array.isArray(value)?value:value==null||value===''?[]:[value]).map(String).filter(Boolean))];}
function nativeType(card){const value=card.native_type??card.nativeType035??card.native?.type;return Number.isSafeInteger(value)?value:null;}
function monster(card){const type=nativeType(card);return type===null?String(card.type??'').includes('몬스터'):Boolean(type&1);}
function typeMatches(card,value){const type=nativeType(card);if(value==='몬스터')return monster(card);if(value==='마법')return type===null?String(card.type??'').includes('마법'):Boolean(type&2);if(value==='함정')return type===null?String(card.type??'').includes('함정'):Boolean(type&4);return card.type===value;}
function raceMatches(card,value){const index=races.indexOf(value);return index>=0&&monster(card)&&(typeof card.race==='number'?Boolean(card.race&2**index):normalize(card.race)===value);}
function attributeMatches(card,value){const key=normalize(value).replace(/속성$/,'');return Object.hasOwn(attributes,key)&&monster(card)&&(typeof card.attribute==='number'?Boolean(card.attribute&attributes[key]):normalize(card.attribute).replace(/속성$/,'')===key);}
function subtypeMatches(card,value){const[kind,subtype]=value.split(':');return ['마법','함정'].includes(kind)&&typeMatches(card,kind)&&card.subtype===subtype;}
export function cardQueryTokens091(query){
  return String(query??'').normalize('NFKC').toLocaleLowerCase('ko')
    .replace(/(땅|물|화염|바람|빛|어둠|신)\s+속성/g,'$1속성')
    .replace(spacedRace,'$1족')
    .trim().split(/\s+/u).filter(Boolean);
}
export function cardQueryMatches091(card,query,tokens=cardQueryTokens091(query)){
  // A card name can contain an attribute word, such as ‘은혜의 바람’.
  // An exact name remains searchable before interpreting metadata keywords.
  const wanted=normalize(query);
  if(wanted&&[card.name_ko,card.name_en,card.name,card.nameEnglish].some(name=>normalize(name)===wanted))return true;
  const searchable=normalize(card.searchText??[card.name_ko,card.name_en,card.name,card.nameEnglish,card.description_ko,card.description,card.type,card.subtype,card.race,card.attribute,...(card.tags??[]),...(card.search_aliases??[]),card.slot,card.source_id,card.code].join(' '));
  return tokens.every(token=>{
    if(races.includes(token))return raceMatches(card,token);
    if(Object.hasOwn(attributes,token.replace(/속성$/,'')))return attributeMatches(card,token);
    if(['몬스터','마법','함정'].includes(token))return typeMatches(card,token);
    return searchable.includes(normalize(token));
  });
}
export function cardFiltersMatch091(card,filters={},tokens=cardQueryTokens091(filters.query)){
  const legacy={...filters,query:''};for(const key of fields)legacy[key]='';
  if(!builderCardMatches(card,legacy))return false;
  if(!fields.every(field=>{const values=filterValues091(filters[field]);return !values.length||values.some(value=>{
    if(field==='type')return typeMatches(card,value);
    if(field==='tier')return card.rarity===value;
    if(field==='race')return raceMatches(card,value);
    if(field==='attribute')return attributeMatches(card,value);
    if(field==='subtype')return subtypeMatches(card,value);
    if(field==='limit')return (card.deck_limit??3)===Number(value);
    if(field==='speedLimit')return value==='unrestricted'?card.speed_limit==null:card.speed_limit===Number(value);
    if(field==='status')return value==='stock'?Boolean(card.stock):value==='reward'&&Boolean(card.reward_eligible)&&card.rarity!=='L'&&card.draw_enabled!==false;
    return false;
  });}))return false;
  return cardQueryMatches091(card,filters.query,tokens);
}
function stat(card,field){if(!monster(card))return null;const value=field==='atk'?card.atk??card.attack:field==='def'?card.def??card.defense:card.level;return Number.isFinite(value)&&value>=0&&(field!=='level'||value>0)?value:null;}
const collator=new Intl.Collator('ko');
function tie(a,b){return collator.compare(a.name_ko??a.name??'',b.name_ko??b.name??'')||(a.source_id??a.internal_id??a.slot??0)-(b.source_id??b.internal_id??b.slot??0)||(a.slot??0)-(b.slot??0);}
export function sortCards091(cards,sort='name'){
  if(sort==='registered')return sortCatalogRegistered049(cards);
  if(sort==='registered-asc')return [...cards].sort((a,b)=>{const av=a.web_slot??a.slot,bv=b.web_slot??b.slot,ak=Number.isSafeInteger(av)&&av>0,bk=Number.isSafeInteger(bv)&&bv>0;return ak!==bk?ak?-1:1:ak&&av!==bv?av-bv:tie(a,b);});
  const field=sort.startsWith('attack-')?'atk':sort.startsWith('defense-')?'def':sort.startsWith('level-')?'level':null,ascending=sort.endsWith('-asc');
  return [...cards].sort((a,b)=>{
    if(!field)return (sort==='name-desc'?-1:1)*collator.compare(a.name_ko??a.name??'',b.name_ko??b.name??'')||tie(a,b);
    const av=stat(a,field),bv=stat(b,field);if(av===null||bv===null)return av===bv?tie(a,b):av===null?1:-1;
    return (ascending?av-bv:bv-av)||tie(a,b);
  });
}
