import {ADDITION_BATCHES067} from './authoring067-batch-data.js?v=20261102-067';
import {ADDITION_BATCHES081} from './authoring081-batch-data.js?v=20261105-082';
import {ADDITION_BATCHES084} from './authoring084-batch-data.js?v=20261105-084';
import {ADDITION_BATCHES088} from './authoring088-batch-data.js?v=20261105-088';
import {ADDITION_BATCHES090} from './authoring090-batch-data.js?v=20261106-090';
import {ADDITION_BATCHES093} from './authoring093-batch-data.js?v=20261106-093';
import {ADDITION_BATCHES099} from './authoring099-batch-data.js?v=20261109-099';
import {ADDITION_BATCHES103} from './authoring103-batch-data.js?v=20261111-103';
import {ADDITION_BATCHES109} from './authoring109-batch-data.js?v=20261114-109';
import {ADDITION_BATCHES120} from './authoring120-batch-data.js?v=20261115-120';

import {ADDITION_BATCHES122} from './authoring122-batch-data.js?v=20261115-flip-cards';

import {ADDITION_BATCHES125} from './authoring125-batch-data.js?v=20261115-alien-reptiles';
import {ADDITION_BATCHES126} from './authoring126-batch-data.js?v=20261115-exodia-trap-monsters';
import {ADDITION_BATCHES130} from './authoring130-batch-data.js?v=20261115-roid-vehicles';
import {ADDITION_BATCHES135} from './authoring135-batch-data.js?v=20261116-dinosaur-allure';
import {ADDITION_BATCHES136} from './authoring136-batch-data.js?v=20261116-predaplant-meteor';
import {ADDITION_BATCHES143} from './authoring143-batch-data.js?v=20261116-atlantean-fusion-spells';
import {ADDITION_BATCHES144} from './authoring144-batch-data.js?v=20261117-insects';
import {ADDITION_BATCHES152} from './authoring152-batch-data.js?v=20261117-ritual-dark-magician';
import {ADDITION_BATCHES161} from './authoring161-batch-data.js?v=20261119-dark-scorpion161';
import {ADDITION_BATCHES162} from './authoring162-batch-data.js?v=20261119-monarch-shark162';
import {ADDITION_BATCHES165} from './authoring165-batch-data.js?v=20261119-dark-magician-horus165';
import {ADDITION_BATCHES174} from './authoring174-batch-data.js?v=20261120-archfiend-hero-silent174';
import {ADDITION_BATCHES175} from './authoring175-batch-data.js?v=20261120-chess-archfiend175';
import {ADDITION_BATCHES183} from './authoring183-batch-data.js?v=20261121-manjoume183';
import {ADDITION_BATCHES188} from './authoring188-batch-data.js?v=20261123-flame-swordsman188';

export function additionMetadata067(key,registry=[...ADDITION_BATCHES067,...ADDITION_BATCHES081,...ADDITION_BATCHES084,...ADDITION_BATCHES088,...ADDITION_BATCHES090,...ADDITION_BATCHES093,...ADDITION_BATCHES099,...ADDITION_BATCHES103,...ADDITION_BATCHES109,...ADDITION_BATCHES120,...ADDITION_BATCHES122,...ADDITION_BATCHES125,...ADDITION_BATCHES126,...ADDITION_BATCHES130,...ADDITION_BATCHES135,...ADDITION_BATCHES136,...ADDITION_BATCHES143,...ADDITION_BATCHES144,...ADDITION_BATCHES152,...ADDITION_BATCHES161,...ADDITION_BATCHES162,...ADDITION_BATCHES165,...ADDITION_BATCHES174,...ADDITION_BATCHES175,...ADDITION_BATCHES183,...ADDITION_BATCHES188]){return registry.find(batch=>batch.key===key)??{key,label:`추가 묶음 ${key.replace(/^Cards/,'')}`,themes:[]};}

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
