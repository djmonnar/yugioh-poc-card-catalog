// Registration order and expansion membership come from the same DB catalog
// already shown by the editor. No history file, date inference or second fetch.
import {additionMetadata067} from './authoring067-themes.js?v=20261102-067';
const identity=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const source=card=>card.source_id??card.sourceId??card.internal_id;
const slot=card=>card.web_slot??card.slot;
const validSlot=value=>Number.isSafeInteger(value)&&value>0;

export function catalogAdditions049(cards){
  const groups=new Map(),byIdentity=new Map(),themeByIdentity=new Map();
  for(const card of cards){
    const at=source(card),position=slot(card),match=/^Cards(\d{3,})\/(\d+)$/.exec(card.art_key??card.artKey??'');
    if(!match||!Number.isSafeInteger(at)||Number(match[2])!==at||!validSlot(position)||!identity(card.identity_key)||byIdentity.has(card.identity_key))continue;
    const key=`Cards${match[1]}`;
    if(!groups.has(key)){const metadata=additionMetadata067(key);groups.set(key,{key,label:metadata.label,themes:metadata.themes,count:0,firstSlot:position,lastSlot:position});}
    const group=groups.get(key);group.count++;group.firstSlot=Math.min(group.firstSlot,position);group.lastSlot=Math.max(group.lastSlot,position);byIdentity.set(card.identity_key,key);
    const theme=group.themes.find(theme=>theme.members.some(([expectedSource,expectedIdentity])=>at===expectedSource&&card.identity_key===expectedIdentity));
    if(theme)themeByIdentity.set(card.identity_key,{key:theme.key,label:theme.label});
  }
  const ordered=[...groups.values()].sort((a,b)=>b.lastSlot-a.lastSlot||b.firstSlot-a.firstSlot||a.key.localeCompare(b.key));
  return {groups:ordered,byIdentity,themeByIdentity,latest:ordered[0]??null,count:byIdentity.size};
}

export function catalogAdditionMatches049(card,scope,index){
  const group=index.byIdentity.get(card.identity_key);
  return scope==='all'?group!==undefined:group===(scope==='latest'?index.latest?.key:scope)&&group!==undefined;
}

export function sortCatalogRegistered049(cards){
  return [...cards].sort((a,b)=>{
    const left=slot(a),right=slot(b),leftValid=validSlot(left),rightValid=validSlot(right);
    if(leftValid!==rightValid)return leftValid?-1:1;
    if(leftValid&&left!==right)return right-left;
    return (source(b)??-1)-(source(a)??-1)||String(a.identity_key??'').localeCompare(String(b.identity_key??''));
  });
}
