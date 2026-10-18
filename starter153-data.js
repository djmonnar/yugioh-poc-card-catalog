import {emptySave,parseSave} from './roguelite150-core.js?v=20261015-150';

const HASH=/^[a-f0-9]{64}$/;
// The private host validates gameplay/limits/rarity against installed overlays.
// Bundled browser metadata can predate those overlays; recheck identity here.
const fields=['slot','internal_id','name_ko','name_en'];
const fail=message=>{throw new Error(message);};
export function parseToolStarters153(value,cards){
  if(!value||value.schema!==1||value.kind!=='poc-roguelite-starter-library'||!Number.isSafeInteger(value.version)||value.version<0)fail('온라인 시작 덱의 저장 버전을 확인할 수 없어.');
  const doc=value.document;
  if(!doc||doc.schema_version!==1||doc.kind!=='poc-roguelite-starters'||!Array.isArray(doc.starters)||doc.starters.length>20||!(doc.catalog_dataset_id===null||typeof doc.catalog_dataset_id==='string'&&HASH.test(doc.catalog_dataset_id)))fail('툴에서 지정한 시작 덱 목록을 확인할 수 없어.');
  if(value.version===0&&(doc.starters.length||doc.catalog_dataset_id!==null))fail('아직 저장되지 않은 시작 덱 목록이야.');
  if(value.version>0&&!HASH.test(doc.catalog_dataset_id))fail('시작 덱의 도감 버전을 확인할 수 없어.');
  const starters=parseSave({...emptySave(),starters:doc.starters}).starters;
  const catalog=new Map(cards.map(card=>[card.identity_key,card]));
  for(const starter of starters)for(const entry of starter.collection){
    const card=catalog.get(entry.card.identity_key);
    if(!card||fields.some(field=>(entry.card[field]??null)!==(card[field]??null)))fail(`${starter.name}: 설치된 카드 자료와 시작 덱이 달라. 툴에서 다시 등록하고 온라인 저장해줘.`);
  }
  const unavailable=value.unavailable??[];
  if(!Array.isArray(unavailable)||unavailable.length>20||unavailable.some(row=>!row||typeof row.starter_id!=='string'||typeof row.name!=='string'||typeof row.error!=='string'))fail('시작 덱 검사 결과를 확인할 수 없어.');
  return {starters,version:value.version,dataset_id:doc.catalog_dataset_id,updated_at:value.updated_at??null,unavailable};
}
export async function loadToolStarters153({config,cards,fetcher=fetch}={}){
  if(!config||typeof config.token!=='string'||!Array.isArray(cards))fail('게임과 시작 덱 연결을 준비하고 있어.');
  const response=await fetcher('./api/roguelite153/starters',{cache:'no-store',headers:{'X-Rogue-Token':config.token},signal:AbortSignal.timeout(20000)});
  let data;try{data=await response.json();}catch{fail('온라인 시작 덱 응답을 읽지 못했어. 다시 불러와줘.');}
  if(!response.ok)fail(typeof data.error==='string'?data.error:'툴의 시작 덱을 불러오지 못했어. 기존 원정 기록은 유지돼.');
  return parseToolStarters153(data,cards);
}
