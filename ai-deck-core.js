export const DECK_STORAGE_KEY = 'poc-ai-decks-v1';
export const GROUPS = ['main', 'extra', 'side'];
export const GROUP_LABELS = {main:'메인', extra:'융합', side:'사이드'};
export const RULESETS = {
  classic:{label:'현재 게임 · 40~80장', min:40,max:80,playable:true},
  duel_links_plan:{label:'듀얼링크스 기획 · 20~30장', min:20,max:30,playable:false}
};
const text = (value,max=6000) => { if(typeof value!=='string'||value.length>max)throw new Error('덱의 글자 수나 형식이 올바르지 않아.');return value; };
const fail = message => {throw new Error(message);};
export function emptyDeck(id) {
  return {deck_id:id,name:'새 AI 덱',ruleset:'classic',banlist_enabled:true,difficulty:3,
    strategy:{goal:'',priorities:'',combos:'',avoid:''},groups:{main:[],extra:[],side:[]}};
}
export function cardLine(card,count=1) {
  return {identity_key:card.identity_key,slot:card.slot,internal_id:card.internal_id,
    name_ko:card.name_ko,name_en:card.name_en,count};
}
export function resolveCard(line,cards) {
  return cards.find(c=>c.slot===line.slot&&c.internal_id===line.internal_id&&
    (c.identity_key===line.identity_key || (c.previous_identity_keys?.includes(line.identity_key)&&c.name_ko===line.name_ko&&c.name_en===line.name_en)))||null;
}
export function copyCount(deck,key) {
  return GROUPS.reduce((sum,g)=>sum+deck.groups[g].filter(r=>r.identity_key===key).reduce((n,r)=>n+r.count,0),0);
}
export function groupCount(deck,group) {return deck.groups[group].reduce((n,r)=>n+r.count,0);}
export function cardLimit(deck,card) {return Math.min(3,(deck.banlist_enabled?card.deck_limit:card.deck_limit_without_banlist)??3);}
export function placementError(card,group) {
  if(card.special)return '토큰·특수 카드는 덱에 넣을 수 없어.';
  const fusion=card.type==='융합 몬스터';
  if(group==='extra'&&!fusion)return '융합 덱에는 융합 몬스터를 넣어줘.';
  if(group!=='extra'&&fusion)return '융합 몬스터는 융합 덱에 넣어줘.';
  return '';
}
export function adjustCard(deck,card,group,delta) {
  if(!GROUPS.includes(group)||![1,-1].includes(delta))fail('덱 편집 요청을 확인할 수 없어.');
  const rows=deck.groups[group], row=rows.find(r=>r.identity_key===card.identity_key);
  if(delta>0) {
    const problem=placementError(card,group);if(problem)fail(problem);
    if(copyCount(deck,card.identity_key)>=cardLimit(deck,card))fail(`${card.name_ko}: 모든 덱을 합쳐 ${cardLimit(deck,card)}장까지 넣을 수 있어.`);
    const max=group==='main'?RULESETS[deck.ruleset].max:15;
    if(groupCount(deck,group)>=max)fail(`${GROUP_LABELS[group]} 덱은 ${max}장까지야.`);
    if(row)row.count++;else rows.push(cardLine(card));
  } else if(row) {
    row.count--;if(!row.count)rows.splice(rows.indexOf(row),1);
  }
  return deck;
}
export function validateDeck(deck,cards) {
  const issues=[],rules=RULESETS[deck.ruleset];
  const n=groupCount(deck,'main');
  if(n<rules.min||n>rules.max)issues.push(`메인 덱 ${n}장 · ${rules.min}~${rules.max}장으로 맞춰줘.`);
  const totals=new Map();let unknown=0;
  for(const group of GROUPS) {
    if(group!=='main'&&groupCount(deck,group)>15)issues.push(`${GROUP_LABELS[group]} 덱은 15장 이내로 맞춰줘.`);
    for(const row of deck.groups[group]) {
      const card=resolveCard(row,cards);
      if(!card){unknown+=row.count;issues.push(`${row.name_ko}: 현재 도감과 카드가 일치하지 않아. 교체 여부를 확인해줘.`);continue;}
      const wrong=placementError(card,group);if(wrong)issues.push(`${card.name_ko}: ${wrong}`);
      totals.set(card.identity_key,{card,count:(totals.get(card.identity_key)?.count||0)+row.count});
    }
  }
  for(const {card,count} of totals.values())if(count>cardLimit(deck,card))issues.push(`${card.name_ko}: 총 ${count}장 · 제한 ${cardLimit(deck,card)}장을 초과했어.`);
  return {counts:Object.fromEntries(GROUPS.map(g=>[g,groupCount(deck,g)])),issues,unknown,
    ready_for_game:!issues.length&&rules.playable};
}
function parseLine(row) {
  if(!row||typeof row!=='object'||!/^[a-f0-9]{64}$/.test(row.identity_key)||!Number.isInteger(row.slot)||row.slot<1||!Number.isInteger(row.internal_id)||row.internal_id<0||row.internal_id>65535||!Number.isInteger(row.count)||row.count<1||row.count>3)fail('카드 식별값이나 매수를 확인할 수 없어.');
  return {identity_key:row.identity_key,slot:row.slot,internal_id:row.internal_id,name_ko:text(row.name_ko,200),name_en:text(row.name_en,200),count:row.count};
}
export function parseBundle(payload,cards) {
  if(!payload||payload.schema_version!==1||payload.kind!=='poc-ai-deck-bundle'||!Array.isArray(payload.decks)||payload.decks.length>100)fail('이 도감에서 내보낸 AI 덱 JSON을 골라줘.');
  const seen=new Set();
  return payload.decks.map(input=>{
    if(!input||typeof input!=='object')fail('덱 형식을 확인할 수 없어.');
    const id=text(input.deck_id,100);if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||seen.has(id))fail('덱 번호가 중복되거나 잘못되었어.');seen.add(id);
    if(!Object.hasOwn(RULESETS,input.ruleset)||typeof input.banlist_enabled!=='boolean'||!Number.isInteger(input.difficulty)||input.difficulty<1||input.difficulty>7)fail('덱 규칙과 난이도를 확인할 수 없어.');
    const deck=emptyDeck(id);deck.name=text(input.name,80);deck.ruleset=input.ruleset;deck.banlist_enabled=input.banlist_enabled;deck.difficulty=input.difficulty;
    for(const key of Object.keys(deck.strategy))deck.strategy[key]=text(input.strategy?.[key]??'');
    for(const group of GROUPS) {
      if(!Array.isArray(input.groups?.[group])||input.groups[group].length>100)fail('덱 카드 목록을 확인할 수 없어.');
      const keys=new Set();deck.groups[group]=input.groups[group].map(row=>{
        const parsed=parseLine(row);if(keys.has(parsed.identity_key))fail('같은 덱의 카드가 중복된 행으로 들어 있어.');keys.add(parsed.identity_key);
        const card=resolveCard(parsed,cards);return card?cardLine(card,parsed.count):parsed;
      });
    }
    return deck;
  });
}
export function exportBundle(meta,decks,cards) {
  // Structural checks keep invalid drafts exportable while refusing malformed input.
  const clean=parseBundle({schema_version:1,kind:'poc-ai-deck-bundle',decks},cards);
  return {schema_version:1,kind:'poc-ai-deck-bundle',catalog_dataset_id:meta.dataset_id,
    exported_at:new Date().toISOString(),decks:clean.map(d=>({...d,validation:validateDeck(d,cards)}))};
}
export function deckMarkdown(meta,decks,cards) {
  const lines=['# Power of Chaos AI 덱 설계',`도감 기준: ${meta.snapshot_date}`,''];
  for(const deck of decks) {
    const check=validateDeck(deck,cards);
    lines.push(`## ${deck.name}`,`규칙: ${RULESETS[deck.ruleset].label} · 난이도 ${deck.difficulty} · 금제 ${deck.banlist_enabled?'적용':'해제'}`,'');
    for(const group of GROUPS){lines.push(`### ${GROUP_LABELS[group]} ${check.counts[group]}장`);for(const row of deck.groups[group])lines.push(`- ${row.name_ko} ×${row.count} (#${row.slot}, ID ${row.internal_id})`);lines.push('');}
    for(const [key,label] of [['goal','승리 목표'],['priorities','우선 사용할 카드·효과'],['combos','원하는 콤보·순서'],['avoid','피해야 할 행동']])if(deck.strategy[key])lines.push(`### ${label}`,deck.strategy[key],'');
    if(check.issues.length)lines.push('### 확인할 항목',...check.issues.map(i=>'- '+i),'');
    if(!RULESETS[deck.ruleset].playable)lines.push('듀얼링크스 기획 덱: 게임 규칙 변경 후 별도 적용이 필요하다.','');
  }
  return lines.join('\n');
}
