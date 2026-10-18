// The saved map keeps every chapter, so old rewards and node receipts remain
// verifiable. Rendering uses a 15-floor view of this immutable 45-floor map.
import {generateMap as legacyGenerateMap,validateMap as legacyValidateMap} from './roguelite-map.js?v=20261014-138';
export {nodeLabel,nodeSummary,TOWER_THEME,TOWER_EVENTS,NODE_DESCRIPTIONS} from './roguelite-map.js?v=20261014-138';
export const MAP_ALGORITHM_VERSION='tower-campaign164-v1';
export const CHAPTER_MAP_VERSION164='tower-chapter164-v1';
const clone=structuredClone;
const nodeId=(c,f,l)=>`c${c}-f${String(f).padStart(2,'0')}-l${l}`;
function seedText(seed){const s=String(seed).normalize('NFC');if(!s.length||s.length>128||/[\u0000-\u001f\u007f]/.test(s))throw Error('맵 시드를 확인해줘.');return s;}
function chapterSeed(seed,chapter){let h=2166136261;for(const c of `${MAP_ALGORITHM_VERSION}\0${seed}\0${chapter}`){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return `chapter164_${chapter}_${(h>>>0).toString(16).padStart(8,'0')}`;}
export function generateChapterMap164(seed,chapter=1){
 const s=seedText(seed);if(![1,2,3].includes(chapter))throw Error('1~3장 중에서 지도를 골라줘.');
 const source=legacyGenerateMap(chapterSeed(s,chapter)),boss=source.nodes.find(n=>n.kind==='boss'),lastId=nodeId(chapter,15,1);
 const nodes=source.nodes.filter(n=>n.floor<=14).map(n=>({...clone(n),id:nodeId(chapter,n.floor,n.lane),chapter,local_floor:n.floor,next:n.floor===14?[lastId]:n.next.map(id=>{const t=source.nodes.find(p=>p.id===id);return nodeId(chapter,t.floor,t.lane);})}));
 nodes.push({...clone(boss),id:lastId,chapter,floor:15,local_floor:15,next:[]});
 const map={schema_version:3,algorithm_version:CHAPTER_MAP_VERSION164,seed:s,floors:15,chapter,nodes};
 const check=validateMap(map);if(!check.valid)throw Error(check.errors.join(' '));return map;
}
export function generateCampaignMap164(seed){
 const s=seedText(seed),parts=[1,2,3].map(c=>generateChapterMap164(s,c)),nodes=parts.flatMap((m,i)=>m.nodes.map(n=>({...clone(n),floor:n.floor+15*i,next:n.kind==='boss'&&i<2?parts[i+1].nodes.filter(p=>p.floor===1).map(p=>p.id):clone(n.next)})));
 return {schema_version:3,algorithm_version:MAP_ALGORITHM_VERSION,seed:s,floors:45,chapters:3,chapter_floors:15,nodes};
}
export function chapterViewMap164(map,chapter=1){
 if(map?.schema_version!==3)return map;
 if(![1,2,3].includes(chapter))throw Error('표시할 원정 구역을 확인해줘.');
 const nodes=map.nodes.filter(n=>n.chapter===chapter).map(n=>({...clone(n),floor:n.local_floor,next:n.next.filter(id=>id.startsWith(`c${chapter}-`))}));
 return {schema_version:3,algorithm_version:CHAPTER_MAP_VERSION164,seed:map.seed,floors:15,chapter,nodes};
}
function validateChapter(map){
 const errors=[],bad=m=>errors.push(m),kinds=['battle','elite','boss','shop','event','rest'];
 if(map.algorithm_version!==CHAPTER_MAP_VERSION164||map.floors!==15||![1,2,3].includes(map.chapter)||!Array.isArray(map.nodes)||map.nodes.length>57)return {valid:false,errors:['15층 구역 지도 형식을 확인해줘.']};
 const by=new Map(),layers=Array.from({length:15},()=>[]);
 for(const n of map.nodes){
  if(!n||!Number.isInteger(n.floor)||n.floor<1||n.floor>15||!Number.isInteger(n.lane)||n.lane<0||n.lane>3||n.chapter!==map.chapter||n.local_floor!==n.floor||n.id!==nodeId(map.chapter,n.floor,n.lane)||by.has(n.id)||!kinds.includes(n.kind)||!Array.isArray(n.next)||new Set(n.next).size!==n.next.length){bad('구역 노드의 번호·층·종류를 확인해줘.');continue;}
  by.set(n.id,n);layers[n.floor-1].push(n);
 }
 for(let f=1;f<=15;f++){
  const rows=layers[f-1];if(f===15){if(rows.length!==1||rows[0].kind!=='boss'||rows[0].lane!==1)bad('15층에는 보스 한 명이 필요해.');}
  else if(rows.length<3||rows.length>4||rows.some(n=>n.kind==='boss')||f===1&&rows.some(n=>n.kind!=='battle')||rows.filter(n=>n.kind==='elite').length>1)bad(`${f}층의 분기 구성을 확인해줘.`);
 }
 for(const n of by.values()){
  if(n.floor===15&&n.next.length||n.floor<15&&!n.next.length)bad('구역 안에 막힌 길이 있어.');
  for(const id of n.next)if(!by.has(id)||by.get(id).floor!==n.floor+1)bad('지도는 바로 다음 층으로 이어져야 해.');
  if(n.floor<15&&!n.next.some(id=>by.has(id)&&by.get(id).kind!=='elite'))bad('엘리트를 우회할 길이 필요해.');
 }
 const seen=new Set(),pending=layers[0].map(n=>n.id),elite=new Map(layers[0].map(n=>[n.id,0]));
 while(pending.length){const id=pending.pop();if(seen.has(id))continue;seen.add(id);pending.push(...(by.get(id)?.next||[]).filter(id=>by.has(id)));}
 if(seen.size!==by.size)bad('첫 층에서 닿을 수 없는 길이 있어.');
 for(const rows of layers)for(const n of rows)for(const id of n.next)if(by.has(id)&&elite.has(n.id))elite.set(id,Math.max(elite.get(id)??-1,elite.get(n.id)+(by.get(id).kind==='elite'?1:0)));
 if(!(layers[14]||[]).some(n=>(elite.get(n.id)??0)>=2))bad('엘리트를 두 번 이상 만날 수 있는 길이 필요해.');
 for(const kind of ['event','shop','rest'])if(!map.nodes.some(n=>n.kind===kind))bad('각 구역에 이벤트·상점·휴식이 필요해.');
 return {valid:!errors.length,errors:[...new Set(errors)]};
}
export function validateMap(map){
 if(map?.schema_version!==3)return legacyValidateMap(map);
 try{seedText(map.seed);}catch(e){return {valid:false,errors:[e.message]};}
 if(map.algorithm_version===CHAPTER_MAP_VERSION164)return validateChapter(map);
 if(map.algorithm_version!==MAP_ALGORITHM_VERSION||map.floors!==45||map.chapters!==3||map.chapter_floors!==15||!Array.isArray(map.nodes)||map.nodes.length>171)return {valid:false,errors:['세 장으로 된 원정 지도를 확인해줘.']};
 const errors=[],ids=new Set();for(const n of map.nodes){if(!n||typeof n!=='object'||ids.has(n.id)||!Number.isInteger(n.chapter)||n.chapter<1||n.chapter>3||n.floor!==(n.chapter-1)*15+n.local_floor||!Array.isArray(n.next)){errors.push('전역 층과 구역 번호가 일치하지 않아.');continue;}ids.add(n.id);}
 if(errors.length)return {valid:false,errors:[...new Set(errors)]};
 for(let c=1;c<=3;c++){
  errors.push(...validateChapter(chapterViewMap164(map,c)).errors);
  const boss=map.nodes.find(n=>n.chapter===c&&n.kind==='boss'),expected=c===3?[]:map.nodes.filter(n=>n.chapter===c+1&&n.local_floor===1).map(n=>n.id);
  if(!boss||JSON.stringify(boss.next)!==JSON.stringify(expected))errors.push('보스 뒤에는 다음 장의 출발점만 이어져야 해.');
  for(const n of map.nodes.filter(n=>n.chapter===c&&n.kind!=='boss'))if(n.next.some(id=>!id.startsWith(`c${c}-`)))errors.push('다른 장으로 가는 길은 보스 뒤에만 둘 수 있어.');
 }
 return {valid:!errors.length,errors:[...new Set(errors)]};
}
export const generateMap=generateCampaignMap164;
export function availableNodes(map,currentNodeId=null){const result=validateMap(map);if(!result.valid)throw Error(result.errors.join(' '));return currentNodeId===null?map.nodes.filter(n=>n.floor===1):(map.nodes.find(n=>n.id===currentNodeId)?.next||[]).map(id=>map.nodes.find(n=>n.id===id));}
