import {GROUPS,RULESETS,parseBundle,validateDeck,cardLine} from './ai-deck-core.js?v=20261007-49';

export const SYNC_REPO='djmonnar/yugioh-poc-card-catalog';
export const SYNC_URL=`https://api.github.com/repos/${SYNC_REPO}/contents/sync.json?ref=ai-sync-data`;
export const SYNC_MARKER='<!-- POC-AI-SYNC:v1 -->';
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
function identityRows(groups,cards){return GROUPS.flatMap(g=>groups[g].map(([slot,id,count])=>{const c=cards.find(c=>c.slot===slot&&c.internal_id===id);if(!c)throw new Error('현재 도감과 카드 번호가 달라.');return [g,slot,id,count,c.identity_key];}));}

export async function makeSyncPacket(meta,deck,target,cards){
  const clean=parseBundle({schema_version:1,kind:'poc-ai-deck-bundle',decks:[deck]},cards)[0];
  const check=validateDeck(clean,cards);if(check.issues.length)throw new Error('덱 확인 항목을 먼저 해결해줘. '+check.issues[0]);
  if(!target?.source_recipe||target.ruleset!==clean.ruleset)throw new Error('같은 듀얼 모드의 적용 상대를 골라줘.');
  const groups=Object.fromEntries(GROUPS.map(g=>[g,clean.groups[g].map(r=>[r.slot,r.internal_id,r.count])]));
  return {schema_version:1,kind:'poc-ai-deck-sync',catalog_dataset_id:meta.dataset_id,
    target:{...target.source_recipe},deck:{name:clean.name,ruleset:clean.ruleset,banlist_enabled:clean.banlist_enabled,difficulty:clean.difficulty,strategy:clean.strategy,groups},
    identity_sha256:await digest(JSON.stringify(identityRows(groups,cards)))};
}

export async function issueDraft(packet){
  const bytes=new TextEncoder().encode(JSON.stringify(packet));
  if(bytes.length>48000)throw new Error('온라인 저장 메모가 너무 길어. JSON 내보내기를 사용해줘.');
  const compressed=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const encoded=btoa(Array.from(compressed,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const body=`${SYNC_MARKER}\n${packet.deck.name} · ${packet.target.filename}\n\n\`\`\`poc-ai-sync\n${encoded}\n\`\`\`\n`;
  const url=new URL(`https://github.com/${SYNC_REPO}/issues/new`);url.searchParams.set('title',`[AI 덱 저장] ${packet.deck.name}`);url.searchParams.set('body',body);
  return {body,url:url.toString(),prefilled:url.toString().length<=7000};
}

export async function packetDeck(packet,cards,id){
  if(packet?.kind!=='poc-ai-deck-sync'||packet.schema_version!==1)throw new Error('온라인 덱 형식을 확인할 수 없어.');
  if(await digest(JSON.stringify(identityRows(packet.deck.groups,cards)))!==packet.identity_sha256)throw new Error('온라인 덱의 카드가 현재 도감과 달라.');
  const groups=Object.fromEntries(GROUPS.map(g=>[g,packet.deck.groups[g].map(([slot,n,count])=>cardLine(cards.find(c=>c.slot===slot&&c.internal_id===n),count))]));
  return parseBundle({schema_version:1,kind:'poc-ai-deck-bundle',decks:[{...packet.deck,deck_id:id,groups,source_recipe:packet.target}]},cards)[0];
}
