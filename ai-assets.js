import {packetDeck} from './ai-sync-core.js?v=20261008-70';
import {cloudRows} from './supabase-cloud.js?v=20261008-70';

export const ASSET_SEED_SHA='12a33979cd45f2158648670699351c44de64e0f1572e45c80fe47ee0a6d658db';
export function isAssetTarget(target,ruleset){
  return !!target&&new RegExp(`^${ruleset==='classic'?'cpu':'DLR'}_1[0-9]{2}\\.ydc$`).test(target.filename)&&
    target.sha256===ASSET_SEED_SHA&&Array.isArray(target.difficulty_levels)&&target.difficulty_levels.length===1&&
    Number.isInteger(target.difficulty_levels[0])&&target.difficulty_levels[0]>=1&&target.difficulty_levels[0]<=7&&
    Object.keys(target).sort().join(',')==='difficulty_levels,filename,sha256';
}
// Build a fresh list only after every cloud row validates. Never partly replace
// the installed list or silently substitute a baseline for a damaged saved deck.
export async function mergeAIAssets(installed,rows,cards,meta){
  const result=structuredClone(installed),known=new Map(result.map(d=>[d.source_recipe.filename,d]));
  for(const row of cloudRows(rows)){
    const target=known.get(row.filename),p=row.packet;
    if(target?(target.source_recipe.sha256!==p.target.sha256||JSON.stringify(target.source_recipe.difficulty_levels)!==JSON.stringify(p.target.difficulty_levels)||Object.keys(p.target).sort().join(',')!=='difficulty_levels,filename,sha256'):
      !isAssetTarget(p.target,p.deck?.ruleset))throw new Error('온라인 AI 덱의 출처를 확인할 수 없어.');
    const saved=await packetDeck(p,cards,target?.deck_id||`asset-${row.filename.replace('.ydc','')}`,meta);
    if(target&&saved.ruleset!==target.ruleset)throw new Error('온라인 AI 덱의 모드가 달라.');
    if(target)result[result.indexOf(target)]=saved;else result.push(saved);
  }
  return result;
}
export function copyAIAsset(deck,id=crypto.randomUUID()){
  const copy=structuredClone(deck);copy.deck_id=id;copy.name=(copy.name+' 복제').slice(0,80);
  delete copy.source_recipe;return copy;
}
