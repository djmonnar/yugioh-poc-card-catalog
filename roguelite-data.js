import {DECK_STORAGE_KEY,parseBundle} from './ai-deck-core.js';
import {mergeAIAssets} from './ai-assets.js';
import {DeckCloud,validateCloudConfig} from './supabase-cloud.js';
import {applyLimits,CardLimitsCloud} from './card-limits.js';
import {applySettings,CardSettingsCloud} from './card-settings.js';
import {annotationFor,CardTagsCloud} from './card-tags.js';

export async function loadCatalog(fetcher=fetch){
  const response=await fetcher('./data/cards.json?v=20261014-rogue136',{cache:'no-store'});
  if(!response.ok)throw new Error('카드 자료를 불러오지 못했어. 새로고침해줘.');
  const data=await response.json();
  if(!Array.isArray(data.cards)||!data.meta?.dataset_id)throw new Error('카드 도감 자료를 확인할 수 없어.');
  return {cards:structuredClone(data.cards),meta:structuredClone(data.meta)};
}

export function browserDecks(storage,cards){
  const raw=storage.getItem(DECK_STORAGE_KEY);
  return raw===null?[]:parseBundle(JSON.parse(raw),cards);
}

// Reading online decks is explicit. Failure never substitutes older bundled decks.
// Build new arrays and publish them only after recipes and limits both validate.
export async function onlineDecks(cards,meta,{fetcher=fetch,createClient}={}){
  if(typeof createClient!=='function')throw new Error('온라인 덱 연결을 준비하지 못했어.');
  const response=await fetcher('./data/cloud-config.json',{cache:'no-store'});
  if(!response.ok)throw new Error('온라인 연결 설정을 불러오지 못했어.');
  const config=validateCloudConfig(await response.json());
  const client=createClient(config.url,config.publishable_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(url,options)=>fetcher(url,{...options,signal:options?.signal||AbortSignal.timeout(10000)})}});
  const candidate=structuredClone(cards);
  const [rows,limits,settings]=await Promise.all([new DeckCloud(client).load(),new CardLimitsCloud(client).load(),new CardSettingsCloud(client).load()]);
  applyLimits(candidate,limits);applySettings(candidate,settings);
  const base=await fetcher('./data/ai-opponents.json',{cache:'no-store'});
  if(!base.ok)throw new Error('AI 덱의 카드 참조를 불러오지 못했어.');
  const installed=parseBundle(await base.json(),candidate);
  const merged=await mergeAIAssets(installed,rows,candidate,meta);
  // Only explicitly saved online recipes appear in this source list.
  const versions=new Map(rows.map(row=>[row.filename,row.version]));
  const decks=merged.filter(deck=>versions.has(deck.source_recipe?.filename));
  let tagsMessage='';
  try{
    const annotations=await new CardTagsCloud(client).load();
    for(const card of candidate)card.tags=[...(annotationFor(annotations,card)?.tags||[])];
  }catch{tagsMessage='온라인 태그는 불러오지 못했어. 이름·효과·능력치로 찾을 수 있어.';}
  return {cards:candidate,decks,versions,tagsMessage};
}

export function importedDecks(payload,cards){return parseBundle(payload,cards);}
