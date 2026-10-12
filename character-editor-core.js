import {emptyStory,parseStory,canonicalStory,validateStory} from './story-core.js?v=20261012-shared127';
import {characterProfile,parseCharacters} from './character-library.js?v=20261012-shared127';

export const CHARACTER_DRAFT_KEY='poc-character-editor-v1';
export const CHARACTER_TRANSFER_KEY='poc-character-transfer-v1';
export function editableCharacterProfile(value){
  const visual=characterProfile(value);
  const actor={actor_id:'editor',...visual,skills:value.skills??[],skill_profiles:value.skill_profiles??[]};
  const clean=parseStory({...emptyStory(),actors:[actor]}).actors[0];
  return {...visual,skills:clean.skills,skill_profiles:clean.skill_profiles};
}
export function canonicalCharacterProfile(profile,meta,cards){
  const actor={actor_id:'editor',...editableCharacterProfile(profile)};
  const doc=canonicalStory({...emptyStory(),actors:[actor]},meta,cards);
  const issues=validateStory(doc,cards,[]).issues.filter(m=>m!=='전투를 한 개 이상 추가해줘.');
  if(issues.length)throw new Error(issues.join(' '));
  return editableCharacterProfile(doc.actors[0]);
}

// Three-way compare at each independent shared field. Traits and presentation
// are atomic groups, so simultaneous edits to one group cannot be lost.
export function mergeCharacterProfile(base,draft,latest){
  const b=editableCharacterProfile(base),d=editableCharacterProfile(draft),l=editableCharacterProfile(latest),out={};
  for(const key of ['name','portrait','presentation','skills','skill_profiles']){
    const bv=JSON.stringify(b[key]),dv=JSON.stringify(d[key]),lv=JSON.stringify(l[key]);
    if(dv===bv)out[key]=structuredClone(l[key]);
    else if(lv===bv||dv===lv)out[key]=structuredClone(d[key]);
    else throw Object.assign(new Error(`poc_conflict: ${key}`),{code:'P0001',field:key});
    if(out[key]===undefined)delete out[key];
  }
  return editableCharacterProfile(out);
}

export async function saveCharacterSnapshot(client,{id,profile,expectedVersion,baseline=null}){
  let value=editableCharacterProfile(profile),expected=expectedVersion;
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!Number.isSafeInteger(expected)||expected<0)throw new Error('공용 캐릭터 ID·버전을 확인해줘.');
  const submit=async()=>{
    const reply=await client.rpc('poc_save_characters',{p_characters:[{id,profile:value,expected_version:expected}]});
    if(reply.error)throw reply.error;
    const rows=parseCharacters(reply.data),row=rows.find(r=>r.id===id);
    if(!row)throw new Error('저장 결과에서 공용 캐릭터를 확인할 수 없어.');
    return {row,rows};
  };
  try{return {...await submit(),rebased:false};}
  catch(e){
    if(!e?.message?.includes('poc_conflict')||!baseline||baseline.id!==id||baseline.version!==expected||expected===0)throw e;
    const reply=await client.rpc('poc_load_characters');if(reply.error)throw reply.error;
    const latest=parseCharacters(reply.data).find(r=>r.id===id);if(!latest)throw e;
    value=mergeCharacterProfile(baseline.profile,value,latest.profile);expected=latest.version;
    return {...await submit(),rebased:true};
  }
}
