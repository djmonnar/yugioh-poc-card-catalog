// 172: 카드 정보 창의 "들어 있는 덱". 지워지지 않은 덱 중 메인·EX에 이 카드가 있는 덱과 매수를 센다.
// 덱 행은 source_id와 identity_key로 카드를 가리킨다. identity_key가 다른 행(정보가 바뀐 옛 카드)은 이 카드로 세지 않는다.
export function cardDeckUsages172(decks,card){
  const id=card?.source_id,key=card?.identity_key,rows=[];
  if(!Number.isSafeInteger(id))return rows;
  for(const deck of decks??[]){
    if(deck?.entity_type!=='deck'||deck.deleted)continue;
    const count={main:0,extra:0};
    for(const zone of ['main','extra']){
      const list=deck.content?.[zone];
      for(const row of Array.isArray(list)?list:[]){
        if(row?.source_id!==id||(row.identity_key!=null&&key!=null&&row.identity_key!==key))continue;
        count[zone]+=Number.isSafeInteger(row.count)&&row.count>0?row.count:1;
      }
    }
    if(count.main+count.extra)rows.push({id:deck.entity_id,main:count.main,extra:count.extra,total:count.main+count.extra});
  }
  return rows;
}

export function cardDeckCountText172({main=0,extra=0}={}){
  return [main?`메인 ${main}장`:null,extra?`EX ${extra}장`:null].filter(Boolean).join(' · ');
}

// 덱 편집 화면 주소. 카드 도감 검색 조건은 덱 화면과 상관없으므로 빼고, 미리보기 같은 다른 조건은 그대로 둔다.
export function deckHref172(href,deckId,catalogParams=[]){
  const url=new URL(href);
  for(const key of catalogParams)url.searchParams.delete(key);
  url.searchParams.set('section','decks');
  url.searchParams.set('deck',deckId);
  url.hash='';
  return url.pathname+url.search;
}
