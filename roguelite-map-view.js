import {validateMap,nodeLabel} from './roguelite-map.js';

export const MAP_ASSETS=Object.freeze({
  background:'assets/roguelite/tower137/map-background-v2.webp',
  battle:'assets/roguelite/tower137/icon-battle-v1.webp',
  event:'assets/roguelite/tower137/icon-event-v1.webp',
  shop:'assets/roguelite/tower137/icon-shop-v1.webp',
  rest:'assets/roguelite/tower137/icon-rest-v1.webp',
  midboss:'assets/roguelite/tower137/icon-midboss-v1.webp',
  boss:'assets/roguelite/tower137/icon-boss-v1.webp'
});
const KINDS=['battle','event','shop','rest','midboss','boss'];
function checked(map){const check=validateMap(map);if(!check.valid)throw new TypeError(`원정 지도를 확인할 수 없어. ${check.errors.join(' ')}`);return map;}
function jitter(id){let n=2166136261;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)%21-10;}

// Coordinate space belongs to the view only. The saved graph and seed stay intact.
export function mapGeometry(map){
  checked(map);const width=600,height=1420;
  const nodes=map.nodes.map(n=>({id:n.id,floor:n.floor,lane:n.lane,kind:n.kind,next:[...n.next],
    x:[118,300,482][n.lane]+([1,4,5,9,10].includes(n.floor)?0:jitter(n.id)),y:180+(map.floors-n.floor)*118})).sort((a,b)=>a.floor-b.floor||a.lane-b.lane);
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const edges=nodes.flatMap(n=>n.next.map(id=>{
    const target=byId.get(id),bend=(n.y-target.y)*0.48;
    return {id:`${n.id}->${id}`,from:n.id,to:id,d:`M ${n.x} ${n.y} C ${n.x} ${n.y-bend}, ${target.x} ${target.y+bend}, ${target.x} ${target.y}`};
  })).sort((a,b)=>a.id.localeCompare(b.id,'en'));
  return {width,height,nodes,edges};
}

export function previewReachability(map,nodeId=null){
  checked(map);const byId=new Map(map.nodes.map(n=>[n.id,n]));
  if(nodeId===null)return {nodeIds:[...byId.keys()].sort(),edgeIds:map.nodes.flatMap(n=>n.next.map(id=>`${n.id}->${id}`)).sort(),immediateIds:[]};
  if(!byId.has(nodeId))throw new RangeError('선택한 칸이 저장된 지도에 없어.');
  const pending=[nodeId],nodes=new Set(),edges=new Set();
  while(pending.length){const id=pending.pop();if(nodes.has(id))continue;nodes.add(id);for(const target of byId.get(id).next){edges.add(`${id}->${target}`);pending.push(target);}}
  return {nodeIds:[...nodes].sort(),edgeIds:[...edges].sort(),immediateIds:[...byId.get(nodeId).next]};
}

export function renderMapLegend(container){
  const document=container.ownerDocument;container.replaceChildren();
  for(const kind of KINDS){const item=document.createElement('span'),art=document.createElement('img');item.className='map-legend-item';art.src=MAP_ASSETS[kind];art.alt='';art.width=24;art.height=24;item.append(art,document.createTextNode(nodeLabel(kind)));container.append(item);}
}

export function renderTowerMap(container,map,{selectedNodeId=null,onNode=()=>{}}={}){
  const geometry=mapGeometry(map),document=container.ownerDocument;
  const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!=null)e.textContent=text;return e;};
  const svgElement=tag=>document.createElementNS('http://www.w3.org/2000/svg',tag);
  const viewport=element('div','tower-map-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','탑 지도 · 아래에서 위로 올라가며 길을 확인해');
  const surface=element('div','tower-map-surface');surface.style.setProperty('--map-background',`url("${MAP_ASSETS.background}")`);
  surface.style.setProperty('--map-aspect',`${geometry.width} / ${geometry.height}`);
  const heading=element('div','map-art-heading','봉인된 듀얼의 탑');heading.setAttribute('aria-hidden','true');surface.append(heading);
  const svg=svgElement('svg');svg.classList.add('tower-route-lines');svg.setAttribute('viewBox',`0 0 ${geometry.width} ${geometry.height}`);svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const paths=new Map(),buttons=new Map();
  for(const edge of geometry.edges){const path=svgElement('path');path.setAttribute('d',edge.d);path.setAttribute('vector-effect','non-scaling-stroke');path.dataset.edgeId=edge.id;path.classList.add('tower-route');svg.append(path);paths.set(edge.id,path);}
  surface.append(svg);
  for(let floor=1;floor<=map.floors;floor++){const marker=element('span','tower-floor-label',`${floor}층`);marker.style.top=`${(180+(map.floors-floor)*118)/geometry.height*100}%`;surface.append(marker);}
  for(const point of geometry.nodes){
    const b=element('button',`tower-node map-node kind-${point.kind}`);b.type='button';b.dataset.nodeId=point.id;b.dataset.kind=point.kind;b.style.left=`${point.x/geometry.width*100}%`;b.style.top=`${point.y/geometry.height*100}%`;
    b.setAttribute('aria-label',`${point.floor}층 ${nodeLabel(point.kind)} · 연결 루트 미리보기`);b.setAttribute('aria-pressed','false');
    const disc=element('span','tower-node-disc'),art=element('img');art.src=MAP_ASSETS[point.kind];art.alt='';art.width=52;art.height=52;art.decoding='async';disc.append(art);
    b.append(disc,element('span','tower-node-label',nodeLabel(point.kind)));
    b.addEventListener('click',()=>{setSelection(point.id);onNode({...point,next:[...point.next]});});surface.append(b);buttons.set(point.id,b);
  }
  surface.append(element('div','map-art-foot','봉인된 문을 넘어 첫 듀얼로'));
  viewport.append(surface);container.replaceChildren(viewport);
  function setSelection(id){
    const preview=previewReachability(map,id),nodeIds=new Set(preview.nodeIds),edgeIds=new Set(preview.edgeIds),immediate=new Set(preview.immediateIds);
    surface.classList.toggle('has-route-selection',id!==null);
    for(const [key,b]of buttons){b.classList.toggle('selected',key===id);b.classList.toggle('reachable',nodeIds.has(key));b.classList.toggle('next-choice',immediate.has(key));b.setAttribute('aria-pressed',String(key===id));}
    for(const [key,path]of paths){path.classList.toggle('route-reachable',id!==null&&edgeIds.has(key));path.classList.toggle('route-muted',id!==null&&!edgeIds.has(key));}
    selectedNodeId=id;return preview;
  }
  function scrollToNode(id,{behavior='auto',focus=false}={}){const b=buttons.get(id);if(!b)return;const point=geometry.nodes.find(n=>n.id===id);const y=point.y/geometry.height*surface.clientHeight;viewport.scrollTo({top:Math.max(0,y-viewport.clientHeight*0.65),behavior});if(focus)b.focus({preventScroll:true});}
  function scrollToStart(options){scrollToNode(geometry.nodes.find(n=>n.floor===1).id,options);}
  setSelection(selectedNodeId);
  const frame=requestAnimationFrame(()=>scrollToStart());
  return {geometry,setSelection,scrollToStart,scrollToNode,viewport,destroy:()=>{cancelAnimationFrame(frame);container.replaceChildren();}};
}
