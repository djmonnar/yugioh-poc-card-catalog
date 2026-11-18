// Deck picker rows, deck file export/import and the "saved vs. in game" badge.
// Import never writes: it returns fields for the normal deck create path, after
// rebuilding the composition card by card with the editor's own deck rule.

export const DECK_FILE_KIND170='yugioh-expedition-deck';
const MAX_FILE170=200000;
const text=(value,max=100)=>typeof value==='string'?value.trim().slice(0,max):'';
const count=rows=>(rows??[]).reduce((n,row)=>n+(Number.isSafeInteger(row?.count)?row.count:0),0);

export function deckMatches170(rows,query){
  const q=String(query??'').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
  return q?rows.filter(row=>row.search.includes(q)):rows;
}

export function deckExport170(entity,cards,{exportedAt=new Date().toISOString()}={}){
  const value=entity?.content??{},index=new Map(cards.map(card=>[card.source_id,card]));
  const rows=zone=>(value[zone]??[]).map(row=>({source_id:row.source_id,identity_key:row.identity_key,count:row.count,name:index.get(row.source_id)?.name_ko??null}));
  return {kind:DECK_FILE_KIND170,schema:1,exported_at:exportedAt,source_deck_id:entity?.entity_id??null,
    deck:{deck_name:value.deck_name??'',name:value.name??'',management_title:value.management_title??'',profile_id:value.profile_id??null,banlist_enabled:Boolean(value.banlist_enabled),lp_bonus:value.lp_bonus??0,opening_draw_bonus:value.opening_draw_bonus??0,main:rows('main'),extra:rows('extra'),skills_count:(value.skills??[]).length}};
}
export function deckFileName170(entity){
  const base=String(entity?.content?.management_title||entity?.content?.deck_name||entity?.content?.name||'덱').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,60)||'덱';
  return `${base}.deck.json`;
}

// changeDeckCard is changeDeckCard039 from the panels (passed in to avoid a cycle).
export function deckImport170(raw,{cards,characters=[],changeDeckCard,composition=false,sharedFields=false}={}){
  if(typeof changeDeckCard!=='function')throw Error('덱 검사 규칙을 불러오지 못했습니다.');
  if(typeof raw!=='string'||!raw.trim())throw Error('덱 파일 내용이 비어 있습니다.');
  if(raw.length>MAX_FILE170)throw Error('덱 파일이 너무 큽니다.');
  let file;try{file=JSON.parse(raw);}catch{throw Error('덱 파일(JSON)을 읽지 못했습니다.');}
  if(file?.kind!==DECK_FILE_KIND170||file.schema!==1||!file.deck||typeof file.deck!=='object')throw Error('원정 제작소에서 내보낸 덱 파일이 아닙니다.');
  const deck=file.deck,warnings=[],index=new Map(cards.map(card=>[card.source_id,card]));
  let next={banlist_enabled:deck.banlist_enabled===true,main:[],extra:[]};
  for(const zone of ['main','extra']){
    if(deck[zone]!=null&&!Array.isArray(deck[zone]))throw Error('덱 파일의 카드 목록을 확인해 주세요.');
    if((deck[zone]??[]).length>45)throw Error('덱 파일의 카드 종류가 너무 많습니다.');
    for(const row of deck[zone]??[]){
      const card=index.get(row?.source_id),label=typeof row?.name==='string'&&row.name?row.name:`${row?.source_id}번`;
      if(!card)throw Error(`카드 도감에 없는 카드가 있습니다: ${label}`);
      if(row.identity_key&&row.identity_key!==card.identity_key)throw Error(`카드 정보가 달라 가져올 수 없습니다: ${card.name_ko}`);
      if(!Number.isSafeInteger(row.count)||row.count<1||row.count>3)throw Error(`카드 매수를 확인해 주세요: ${card.name_ko}`);
      // Same rule as the editor's ＋ button: zone, copies, limits and deck size.
      for(let n=0;n<row.count;n++)next=changeDeckCard(next,card,1,cards);
    }
  }
  const profile=characters.find(row=>row.profile_id===deck.profile_id)??characters.find(row=>row.profile_id==='yugi')??characters[0];
  if(deck.profile_id&&profile?.profile_id!==deck.profile_id)warnings.push('연출 캐릭터를 찾지 못해 기본 캐릭터로 설정했습니다.');
  const lp=Number.isSafeInteger(deck.lp_bonus)&&(deck.lp_bonus===0||deck.lp_bonus>=100&&deck.lp_bonus<=8000)?deck.lp_bonus:0;if(lp!==(deck.lp_bonus??0))warnings.push('추가 LP 값을 확인할 수 없어 0으로 설정했습니다.');
  const opening=Number.isSafeInteger(deck.opening_draw_bonus)&&deck.opening_draw_bonus>=0&&deck.opening_draw_bonus<=3?deck.opening_draw_bonus:0;if(opening!==(deck.opening_draw_bonus??0))warnings.push('시작 패 추가 장수를 확인할 수 없어 0으로 설정했습니다.');
  if(Number(deck.skills_count)>0)warnings.push('전투 특성과 출현 위치는 가져오지 않습니다. 필요하면 다시 설정해 주세요.');
  const deckName=text(deck.deck_name)||text(deck.name)||'가져온 덱';
  const fields={name:composition?deckName:text(deck.name)||deckName,deck_name:deckName,profile_id:profile?.profile_id??'yugi',art_key:profile?.art_key??'CharacterPresentation012/images/yugi/start',banlist_enabled:next.banlist_enabled,main:next.main,extra:next.extra,lp_bonus:lp,opening_draw_bonus:opening,skills:[]};
  const title=text(deck.management_title);if(title)fields.management_title=title;
  if(sharedFields)Object.assign(fields,{shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false});
  return {fields,warnings,mainCount:count(next.main),extraCount:count(next.extra)};
}

// Capability note for decks: "blank names / main0..19 save; game continues
// last-valid". Placement decides whether the game uses the deck at all.
export function gameStatus170(entity,{state,usages=[]}={}){
  if(!entity||entity.localDraft060||entity.pending||state?.canEdit!==true)return null;
  const reasons=[];
  if(entity.entity_type==='deck'){
    const value=entity.content??{},main=count(value.main);
    if(main<20)reasons.push(`메인 ${main}/20장`);
    if(!String(value.deck_name??'').trim()||!String(value.name??'').trim())reasons.push('덱 이름 또는 상대 이름 없음');
  }
  if((entity.issues??[]).length||entity.state==='saved_needs_review')reasons.push('DB 확인 필요');
  if(reasons.length)return {kind:'stale',label:'게임 미반영',detail:`DB에는 저장됐지만 게임은 마지막 정상 버전을 계속 사용합니다 · ${reasons.join(' · ')}`};
  if(entity.entity_type==='deck'&&!usages.length)return {kind:'unused',label:'게임에서 사용 안 함',detail:'장별 적 편성이나 시작 덱에 넣으면 게임에 나옵니다.'};
  const built=state?.bootstrap?.game?.authoring_revision;
  if(Number.isSafeInteger(built)&&Number.isSafeInteger(entity.version)&&entity.version>built)return {kind:'waiting',label:'게임 반영 확인 중',detail:'저장 내용이 게임 자료에 반영되는지 확인하고 있습니다.'};
  return {kind:'live',label:'게임 반영됨',detail:'게임이 이 저장 내용을 사용합니다.'};
}
