// Read-only presentation policy matching the DB039 deck/starter projection.
// IDs and compositions remain distinct even when their display names match.
const count = rows => (rows??[]).reduce((n,row)=>n+(Number.isSafeInteger(row.count)?row.count:0),0);
const extra = card => Boolean((card.native_type??0)&(0x40|0x2000|0x800000|0x4000000));
const normalized = value => String(value??'').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
const family = card => card.alias||card.code||card.source_id;
const canonical = (value,key='') => Array.isArray(value)?(key==='main'||key==='extra'?[...value].sort((a,b)=>a.source_id-b.source_id):value).map(row=>canonical(row)):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(name=>[name,canonical(value[name],name)])):value;
export function groupExactDecks041(rows){const groups=new Map();for(const row of rows){const key=JSON.stringify(canonical((row.entity??row).content));if(!groups.has(key))groups.set(key,{key,representative:row,rows:[]});groups.get(key).rows.push(row);}return [...groups.values()];}
export function deckReadiness041(entity,cards,{requireLimits=true}={}) {
  const deck=entity?.content??entity??{},mainCount=count(deck.main),extraCount=count(deck.extra),issues=[];
  const issue=(code,message)=>{if(!issues.some(row=>row.code===code))issues.push({code,message});};
  if(mainCount<20||mainCount>30)issue('main_count',`메인 덱 ${mainCount}장 · 20~30장 필요`);
  if(extraCount>15)issue('extra_count',`EX 덱 ${extraCount}장 · 최대 15장`);
  if(!String(deck.deck_name??'').trim()||!String(deck.name??'').trim())issue('name_required','덱 이름과 상대 이름을 입력해 주세요.');
  if(requireLimits&&!deck.banlist_enabled)issue('limits_disabled','시작 덱은 카드 제한을 켜야 합니다.');
  const index=new Map(cards.map(card=>[card.source_id,card])),totals=new Map(),limits=new Map(),speeds=new Map();
  for(const card of cards)limits.set(family(card),Math.min(limits.get(family(card))??3,card.deck_limit??3));
  for(const zone of ['main','extra']){
    const seen=new Set();
    for(const row of deck[zone]??[]){
      const card=index.get(row.source_id);
      if(!card||card.special||card.playable===false||card.identity_key!==row.identity_key||seen.has(row.source_id)||extra(card)!==(zone==='extra')||!Number.isSafeInteger(row.count)||row.count<1||row.count>3){issue('invalid_card','카드 종류와 매수를 확인해 주세요.');continue;}
      seen.add(row.source_id);totals.set(family(card),(totals.get(family(card))??0)+row.count);
      if(deck.banlist_enabled&&card.speed_limit!=null&&card.speed_limit>=0)speeds.set(card.speed_limit,(speeds.get(card.speed_limit)??0)+row.count);
    }
  }
  for(const [key,total] of totals)if(total>(deck.banlist_enabled?limits.get(key):3))issue('copy_limit','같은 이름 카드의 제한 매수를 넘었습니다.');
  for(const [maximum,total] of speeds)if(maximum===0||total>maximum)issue('speed_limit',maximum===0?'금지 카드가 포함되어 있습니다.':`제한 ${maximum} 카드들의 합계를 확인해 주세요.`);
  const known=new Set(['main_20_required','name_required','copy_limit','speed_limit']);
  if((entity?.issues??[]).some(row=>!known.has(typeof row==='string'?row:row.code)))issue('db_review','DB에 저장된 덱 구성을 확인해 주세요.');
  return {ready:issues.length===0,mainCount,extraCount,limitsEnabled:Boolean(deck.banlist_enabled),issues,
    message:issues[0]?.message??'시작 덱으로 등록할 수 있습니다.'};
}

export function deckOptions041(decks,{query='',exclude=[],cards=[],characters=[]}={}) {
  const excluded=new Set(exclude),names=new Map(),q=normalized(query);
  for(const deck of decks){const title=deck.content.deck_name||deck.content.name||'이름 없는 덱';names.set(title,(names.get(title)??0)+1);}
  return decks.filter(deck=>!excluded.has(deck.entity_id)).map(deck=>{
    const value=deck.content,title=value.deck_name||value.name||'이름 없는 덱',profile=characters.find(row=>row.profile_id===value.profile_id),name=value.name||profile?.profile?.name||'상대 미지정';
    const counts=`메인 ${count(value.main)}장 · EX ${count(value.extra)}장`,sameName=names.get(title)>1;
    const prefix=/^ch([123])_(battle|elite|boss)_/.exec(deck.entity_id),idLabel=prefix?`${prefix[1]}장 ${{battle:'일반',elite:'엘리트',boss:'보스'}[prefix[2]]} · ${deck.entity_id.slice(-7)}`:`덱 ${deck.entity_id.slice(-7)}`;
    const detail=[name!==title?name:null,counts,sameName?idLabel:null].filter(Boolean).join(' · ');
    const readiness=deckReadiness041(deck,cards);
    return {entity:deck,id:deck.entity_id,title,detail,readiness,search:normalized([title,name,value.profile_id,deck.entity_id].join(' '))};
  }).filter(row=>!q||row.search.includes(q)).sort((a,b)=>a.title.localeCompare(b.title,'ko')||a.id.localeCompare(b.id));
}
