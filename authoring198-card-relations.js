// 198: 카드 정보 창의 "관련 카드". 공식 카드 스크립트에서 미리 뽑은 관계(authoring198-card-relations-data.js)와
// 제작소에서 직접 연결한 관련 카드(card_annotation.links)를 지금 카드 목록의 행으로 바꾼다.
// 같은 source_id에 다른 passcode의 카드가 있으면(자료가 바뀐 카드) 그 관계는 쓰지 않는다.
import {CARD_RELATIONS198} from './authoring198-card-relations-data.js';

export const RELATION_GROUPS198=Object.freeze([
  Object.freeze({key:'f',label:'융합 소재'}),
  Object.freeze({key:'rm',label:'의식 몬스터'}),
  Object.freeze({key:'rs',label:'의식 마법'}),
  Object.freeze({key:'n',label:'텍스트가 지칭하는 카드'}),
  Object.freeze({key:'m',label:'직접 연결한 카드'}),
  Object.freeze({key:'b',label:'이 카드를 지칭하는 카드',page:12})
]);

const sameCode=(row,code)=>code==null||row?.code==null||Number(row.code)===code;

export function cardRelations198(card,cards,relations=CARD_RELATIONS198){
  const id=card?.source_id;
  if(!Number.isSafeInteger(id))return [];
  const list=Array.isArray(cards)?cards:[],index=new Map(list.map(row=>[row.source_id,row])),entry=relations?.[id];
  const known=entry&&sameCode(card,entry.c)?entry:{};
  const target=sourceId=>{const row=index.get(sourceId);return row&&sameCode(row,relations?.[sourceId]?.c)?row:null;};
  const linkKey=link=>`${link?.slot}:${link?.identity_key}`,own=linkKey(card),bySlot=new Map(list.map(row=>[linkKey(row),row]));
  const manual=[...(Array.isArray(card.links)?card.links:[]).map(link=>bySlot.get(linkKey(link))),...list.filter(row=>Array.isArray(row.links)&&row.links.some(link=>linkKey(link)===own))];
  const seen=new Set([id]),groups=[];
  for(const group of RELATION_GROUPS198){
    const rows=group.key==='m'?manual:(Array.isArray(known[group.key])?known[group.key]:[]).map(target);
    const shown=rows.filter(row=>row&&!seen.has(row.source_id)&&seen.add(row.source_id));
    if(shown.length)groups.push({...group,cards:shown});
  }
  return groups;
}

// 새 탭에서 열 때도 같은 카드가 열리도록 지금 주소에 #card-<slot>을 붙인다(제작소 라우터가 slot으로 카드를 찾는다).
export function cardHref198(href,card){
  const url=new URL(href),slot=String(card?.slot??card?.legacy_slot??'');
  url.hash=/^\d+$/.test(slot)?`card-${slot}`:'';
  return url.pathname+url.search+url.hash;
}
