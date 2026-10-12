import {parseStory} from './story-core.js?v=20261012-shared127';
import {parseRemoteScenarios} from './story-library.js?v=20261010-characters103';

const plain=value=>JSON.stringify(value);
const conflict=()=>Object.assign(new Error('poc_conflict'),{code:'P0001'});
const isConflict=e=>e?.message?.includes('poc_conflict');

// Ignore only resolved shared metadata. Battle IDs, order, prerequisites,
// rewards, recipes, profile selection and all legacy actor traits stay owned.
export function scenarioOwnedDocument(value){
  const doc=parseStory(value);delete doc.catalog_dataset_id;
  for(const actor of doc.actors){
    if(!actor.character_id)continue;
    delete actor.name;delete actor.portrait;delete actor.presentation;
    if(actor.use_shared_skills===true){delete actor.skills;delete actor.skill_profiles;}
  }
  return doc;
}
export const sameScenarioContent=(a,b)=>plain(scenarioOwnedDocument(a))===plain(scenarioOwnedDocument(b));
export function initialOnlineScenario(id,document,seed,online){
  if(!seed||seed.id!==id||online?.id!==id||!sameScenarioContent(document,seed.document))return null;
  return checkedRow(online,id);
}

function checkedRow(row,id){
  const [clean]=parseRemoteScenarios([row]);
  if(clean.id!==id)throw new Error('저장 결과의 시나리오가 달라. 편집본은 유지돼.');
  return clean;
}

export async function saveScenarioSnapshot(client,{id,document,expectedVersion,baseline=null,legacyAPI=false,normalizeDocument=parseStory}){
  const snapshot=parseStory(structuredClone(document));
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('온라인 시나리오 버전을 확인해줘.');
  const submit=async(version)=>{
    const args={p_document:snapshot,p_expected_version:version};
    if(!legacyAPI)args.p_scenario_id=id;
    const reply=await client.rpc(legacyAPI?'poc_save_story':'poc_save_scenario',args);
    if(reply.error)throw reply.error;
    return checkedRow(legacyAPI?{...reply.data,id}:reply.data,id);
  };
  try{return {row:await submit(expectedVersion),rebased:false};}
  catch(error){
    if(!isConflict(error)||legacyAPI||expectedVersion===0)throw error;
    const reply=await client.rpc('poc_load_scenarios');if(reply.error)throw reply.error;
    const latest=parseRemoteScenarios(reply.data).find(row=>row.id===id);if(!latest)throw conflict();
    let base=baseline?.id===id&&baseline.version===expectedVersion?baseline:null;
    if(!base){
      const old=await client.rpc('poc_load_scenario_revision',{p_scenario_id:id,p_version:expectedVersion});
      if(old.error||!old.data)throw conflict();
      base=checkedRow(old.data,id);if(base.version!==expectedVersion)throw conflict();
    }
    // A changed online battle or legacy trait requires explicit comparison.
    // Never replace the local document with latest or blindly overwrite version.
    let unchanged=false;
    try{unchanged=sameScenarioContent(normalizeDocument(base.document),normalizeDocument(latest.document));}catch{throw conflict();}
    if(!unchanged)throw conflict();
    return {row:await submit(latest.version),rebased:true};
  }
}

export function storySyncSummary(document,online){
  const localCount=document.battles.length;
  if(!online)return {state:'local',text:`브라우저 편집본 ${localCount}전투 · 아직 온라인 저장 전`};
  const current=sameScenarioContent(document,online.document);
  return {state:current?'saved':'dirty',text:`브라우저 편집본 ${localCount}전투 · 온라인 저장본 ${online.document.battles.length}전투 · ${current?'전투 설정 반영됨':'온라인 미반영 변경 있음'}`};
}
