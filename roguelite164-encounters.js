import {cleanEncounterPool,cleanEncounters as legacyCleanEncounters} from './roguelite-encounters.js?v=20261014-138';
import {cleanCampaign164,cleanCampaignLibrary164,effectiveTemplate164} from './campaign164-core.js?v=20261018-164';
import {validateMap} from './roguelite164-map.js?v=20261018-164';
export {cleanEncounterPool,browserEncounterPool,ENCOUNTER_KINDS} from './roguelite-encounters.js?v=20261014-138';
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function random(seed){let h=2166136261;for(const c of seed){h^=c.codePointAt(0);h=Math.imul(h,16777619);}let s=h>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
export function assignCampaignEncounters164(map,library,cards){
 const check=validateMap(map);if(!check.valid||map?.schema_version!==3)throw Error('원정의 구역 지도를 먼저 준비해줘.');
 const doc=library?.document?cleanCampaignLibrary164(library,cards).document:cleanCampaign164(library,cards),out={},counts=new Map(),actors=new Map();
 for(const node of [...map.nodes].sort((a,b)=>a.floor-b.floor||a.lane-b.lane)){
  if(!['battle','elite','boss'].includes(node.kind))continue;
  const category=doc.chapters[node.chapter-1][node.kind],pool=category.pool;
  if(!pool.length)throw Error(`${node.chapter}장 ${node.kind}: 상대를 한 명 이상 지정해줘.`);
  const prefix=`${node.chapter}:${node.kind}:`,level=`${node.chapter}:${node.local_floor}`,used=actors.get(level)||new Set(),lowest=Math.min(...pool.map(t=>counts.get(prefix+t.template_id)||0));
  let eligible=pool.filter(t=>(counts.get(prefix+t.template_id)||0)===lowest),different=eligible.filter(t=>!used.has(t.source.actor_id));if(different.length)eligible=different;
  const selected=eligible[Math.floor(random(`encounters164|${map.seed}|${node.id}`)()*eligible.length)],effective=effectiveTemplate164(selected,category);
  out[node.id]={...effective,kind:node.kind};counts.set(prefix+selected.template_id,(counts.get(prefix+selected.template_id)||0)+1);used.add(selected.source.actor_id);actors.set(level,used);
 }
 return out;
}
export const assignChapterEncounters164=assignCampaignEncounters164;
export function cleanEncounters164(value,map,library){
 if(map?.schema_version!==3)return legacyCleanEncounters(value,map);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('구역별 전투 상대 목록을 확인해줘.');
 const expected=assignCampaignEncounters164(map,library);
 if(canonical(value)!==canonical(expected))throw Error('구역 설정과 전투 상대·덱·특성이 일치하지 않아. 새 원정을 다시 준비해줘.');
 return expected;
}
export const cleanEncounters=cleanEncounters164;
export const assignEncounters=assignCampaignEncounters164;
