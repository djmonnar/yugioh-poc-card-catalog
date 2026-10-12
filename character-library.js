import {emptyStory,parseStory,safePortrait} from './story-core.js?v=20261012-shared127';
import {parsePresentation} from './story-media.js?v=20261009-media88';

export const CHARACTER_KEY='poc-character-library-v1';
export function characterName(name){
  const key=name.normalize('NFKC').toLowerCase().replace(/[\s.]/g,'');
  if(['안수진','수진','마자키안즈','anzumazaki','teagardner','téagardner'].includes(key))return '안수진';
  return ['페가수스j크로프트','페가수스j크로포드'].includes(key)?'페가수스':key;
}
export function linkLegacyCharacters(document,characters){
  const doc=parseStory(document),byName=new Map();
  for(const row of characters){const key=characterName(row.profile.name);byName.set(key,byName.has(key)?null:row);}
  for(const actor of doc.actors){
    if(actor.character_id)continue;
    const row=byName.get(characterName(actor.name));if(!row)continue;
    actor.character_id=row.id;delete actor.presentation;Object.assign(actor,characterProfile(row.profile));
  }
  return doc;
}
const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export function characterProfile(actor){
  if(typeof actor?.name!=='string'||!actor.name.trim()||actor.name.length>100||!safePortrait(actor.portrait))throw new Error('공용 캐릭터 이름·초상화를 확인해줘.');
  const out={name:actor.name,portrait:actor.portrait};
  if(actor.presentation!==undefined)out.presentation=parsePresentation(actor.presentation);
  return out;
}
export function sharedCharacterProfile(actor){
  const out=characterProfile(actor);
  // Older shared rows have no traits. Keep their absence distinguishable from
  // an intentionally saved empty shared trait set.
  if(actor.skills!==undefined||actor.skill_profiles!==undefined){
    if(actor.skills===undefined||actor.skill_profiles===undefined)throw new Error('공용 캐릭터 기본 특성과 특성 묶음을 함께 확인해줘.');
    const clean=parseStory({...emptyStory(),actors:[{actor_id:'shared-check',...out,skills:actor.skills,skill_profiles:actor.skill_profiles}]}).actors[0];
    out.skills=clean.skills;out.skill_profiles=clean.skill_profiles;
  }
  return out;
}
function assignShared(actor,profile){
  delete actor.presentation;Object.assign(actor,characterProfile(profile));
  if(actor.use_shared_skills===true){actor.skills=structuredClone(profile.skills||[]);actor.skill_profiles=structuredClone(profile.skill_profiles||[]);}
}
export function parseCharacters(rows){
  if(!Array.isArray(rows)||rows.length>100)throw new Error('공용 캐릭터 목록을 확인해줘.');
  const ids=new Set();return rows.map(r=>{
    if(!validId(r.id)||ids.has(r.id)||!Number.isSafeInteger(r.version)||r.version<0)throw new Error('공용 캐릭터 정보를 확인해줘.');
    ids.add(r.id);return {id:r.id,version:r.version,profile:sharedCharacterProfile(r.profile)};
  });
}
export function attachCharacter(row,actor_id=crypto.randomUUID()){
  if(!validId(row.id)||!validId(actor_id))throw new Error('캐릭터 ID를 확인해줘.');
  const actor={actor_id,character_id:row.id,use_shared_skills:true,skills:[],skill_profiles:[]};assignShared(actor,row.profile);return actor;
}
export function resolveCharacters(document,characters){
  const doc=parseStory(document),byId=new Map(characters.map(r=>[r.id,r]));
  for(const actor of doc.actors){
    if(!actor.character_id)continue;
    const row=byId.get(actor.character_id);if(!row)throw new Error(`${actor.name}의 공용 캐릭터를 불러올 수 없어.`);
    assignShared(actor,row.profile);
  }
  return doc;
}
export function rebaseCharacters(document,baselines,characters){
  const doc=parseStory(document),before=new Map(baselines.map(r=>[r.id,r])),now=new Map(characters.map(r=>[r.id,r])),next=new Map();
  for(const actor of doc.actors){
    if(!actor.character_id)continue;
    const latest=now.get(actor.character_id),old=before.get(actor.character_id);
    if(!latest){if(old)next.set(old.id,old);continue;}
    const current=characterProfile(actor);
    if(actor.use_shared_skills===true||old&&JSON.stringify(current)===JSON.stringify(characterProfile(old.profile))||!old&&JSON.stringify(current)===JSON.stringify(characterProfile(latest.profile))){
      assignShared(actor,latest.profile);next.set(latest.id,latest);
    }else if(old)next.set(old.id,old);
    // A dirty draft lacking a known version must not silently overwrite a
    // shared profile fetched later. expected_version 0 causes a server conflict.
  }
  return {document:doc,baselines:[...next.values()]};
}
export function synchronizeCharacterCopies(document,baselines){
  const saved=new Map(baselines.map(r=>[r.id,r])),groups=new Map();
  for(const a of document.actors){if(a.character_id){if(!groups.has(a.character_id))groups.set(a.character_id,[]);groups.get(a.character_id).push(a);}}
  for(const [id,actors] of groups){
    const old=saved.get(id),dirty=actors.map(characterProfile).filter(p=>!old||JSON.stringify(p)!==JSON.stringify(characterProfile(old.profile)));
    if(!dirty.length)continue;
    if(dirty.some(p=>JSON.stringify(p)!==JSON.stringify(dirty[0])))throw new Error('같은 공용 캐릭터의 편집 내용이 달라. 프로필을 하나로 맞춰줘.');
    for(const a of actors){delete a.presentation;Object.assign(a,structuredClone(dirty[0]));}
  }
  return document;
}
export function characterUpdates(document,characters){
  const saved=new Map(characters.map(r=>[r.id,r])),updates=new Map();
  for(const a of document.actors){
    if(!a.character_id)continue;
    const profile=characterProfile(a),old=saved.get(a.character_id);
    const prior=updates.get(a.character_id);
    if(prior&&JSON.stringify(prior.profile)!==JSON.stringify(profile))throw new Error('같은 공용 캐릭터의 편집 내용이 달라. 프로필을 하나로 맞춰줘.');
    if(!old||JSON.stringify(profile)!==JSON.stringify(characterProfile(old.profile)))updates.set(a.character_id,{id:a.character_id,profile,expected_version:old?.version??0});
  }
  return [...updates.values()];
}
