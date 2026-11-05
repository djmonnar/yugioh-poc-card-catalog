import {ADDITION_BATCHES067} from './authoring067-batch-data.js?v=20261102-067';
import {ADDITION_BATCHES081} from './authoring081-batch-data.js?v=20261105-082';
import {ADDITION_BATCHES084} from './authoring084-batch-data.js?v=20261105-084';
import {ADDITION_BATCHES088} from './authoring088-batch-data.js?v=20261105-088';

export function additionMetadata067(key,registry=[...ADDITION_BATCHES067,...ADDITION_BATCHES081,...ADDITION_BATCHES084,...ADDITION_BATCHES088]){return registry.find(batch=>batch.key===key)??{key,label:`추가 묶음 ${key.replace(/^Cards/,'')}`,themes:[]};}

// A theme is registration metadata. User-edited category tags stay independent.
export function additionThemes067(cards,scope,index){
  const groups=scope==='all'?index.groups:index.groups.filter(group=>group.key===(scope==='latest'?index.latest?.key:scope));
  const counts=new Map(),allowed=new Set(groups.map(group=>group.key));let unclassified=0;
  for(const card of cards){
    if(!allowed.has(index.byIdentity.get(card.identity_key)))continue;
    const theme=index.themeByIdentity.get(card.identity_key);
    if(!theme){unclassified++;continue;}
    const row=counts.get(theme.key)??{key:theme.key,label:theme.label,count:0};row.count++;counts.set(theme.key,row);
  }
  const ordered=[];
  for(const group of groups)for(const theme of group.themes??[])if(counts.has(theme.key)&&!ordered.some(row=>row.key===theme.key))ordered.push(counts.get(theme.key));
  if(unclassified)ordered.push({key:'unclassified',label:'분류 정보 없음',count:unclassified});
  return ordered;
}

export function additionThemeMatches067(card,theme,index){
  if(!index.byIdentity.has(card.identity_key))return false;
  if(!theme||theme==='all')return true;
  const found=index.themeByIdentity.get(card.identity_key);
  return theme==='unclassified'?!found:found?.key===theme;
}
