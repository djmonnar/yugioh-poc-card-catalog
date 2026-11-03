// Only explicit target deltas enter the existing chapter-role draft graph.
import {characterChoice068} from './authoring068-character.js?v=20261102-068';
const copy=structuredClone,need=(ok,message)=>{if(!ok)throw Error(message);};
export const routeKey071=(roleId,entryId)=>JSON.stringify([roleId,entryId]);
export const routeLabel071=role=>role?`${role.content.chapter}장 · ${{battle:'일반 전투',elite:'엘리트',boss:'보스'}[role.content.role]??role.content.role}`:'연결된 구역 확인 필요';
export function applyCommonRoutes071(targets,fields){
  need(fields&&typeof fields==='object'&&!Array.isArray(fields),'공통으로 적용할 설정을 확인해 주세요.');
  return targets.map(target=>({...copy(target),encounter:{...copy(target.encounter??{}),...copy(fields)}}));
}
export function commonDeltaForRoute071(fields,encounter,characters=[]){
  const result=copy(fields);
  // Turning traits off does not select a different character, including two
  // characters that share the same animation/presentation profile.
  if(result.use_shared_skills===false&&!Object.prototype.hasOwnProperty.call(result,'profile_id'))result.shared_character_id=characterChoice068(encounter,characters)||null;
  return result;
}
export function effectiveLp071(encounter,role,characters=[]){
  const character=characters.find(row=>row.id===encounter.shared_character_id),profile=encounter.shared_skill_profile_id?
    character?.profile?.skill_profiles?.find(row=>row.profile_id===encounter.shared_skill_profile_id):character?.profile;
  if(encounter.use_shared_skills&&!profile&&encounter.lp_bonus===0)return {base:4000,additional:null,region:role?.content.lp_bonus??0,total:null,inherited:true};
  const inherited=encounter.use_shared_skills?(profile?.skills??[]).find(row=>row.kind==='lp_bonus')?.value??0:0;
  const additional=encounter.lp_bonus||inherited,region=role?.content.lp_bonus??0;
  return {base:4000,additional,region,total:4000+additional+region,inherited:encounter.lp_bonus===0&&encounter.use_shared_skills===true};
}
export function planEnemyRoutes071({entities,deckId,targets}){
  const deck=entities.find(row=>row.entity_type==='deck'&&row.entity_id===deckId&&!row.deleted);
  need(deck,'배치할 공유 덱을 다시 선택해 주세요.');need(Array.isArray(targets)&&targets.length>0,'배치할 구역이나 기존 상대를 선택해 주세요.');
  const roles=entities.filter(row=>row.entity_type==='chapter_role'&&!row.deleted),seen=new Set(),plans=new Map(),global=new Map();
  for(const role of roles)for(const entry of [...(role.content.entries??[]),...(role.ready_content?.entries??[])]){
    const owners=global.get(entry.entry_id)??new Set();owners.add(role.entity_id);global.set(entry.entry_id,owners);
  }
  for(const target of targets){
    const key=routeKey071(target.roleId,target.entryId);need(!seen.has(key),'같은 배치를 두 번 선택할 수 없습니다.');seen.add(key);
    need(typeof target.entryId==='string'&&target.entryId.length>0,'새 배치 번호를 확인해 주세요.');
    const role=roles.find(row=>row.entity_id===target.roleId);need(role,'선택한 구역이 변경됐습니다. 구역 목록에서 다시 선택해 주세요.');
    const entries=plans.get(role.entity_id)?.entries??copy(role.content.entries??[]),index=entries.findIndex(row=>row.entry_id===target.entryId),existing=index<0?null:entries[index];
    let next;
    if(target.create){
      if(existing){need(existing.deck_id===deckId,'같은 배치 번호가 이미 사용 중입니다.');continue;}
      need(!global.has(target.entryId),'다른 배치가 사용한 번호입니다. 새 배치를 다시 선택해 주세요.');
      need(entries.length<100,`${routeLabel071(role)}은 상대 100명이 모두 찼습니다.`);
      next={entry_id:target.entryId,deck_id:deckId,weight:target.weight??1,encounter:copy(target.encounter??{})};
      global.set(target.entryId,new Set([role.entity_id]));
    }else{
      need(existing?.deck_id===deckId,'선택한 상대가 변경되거나 제외됐습니다. 배치 목록에서 다시 선택해 주세요.');
      next={...existing,...(target.weight===undefined?{}:{weight:target.weight}),encounter:{...existing.encounter,...copy(target.encounter??{})}};
    }
    const value=next.encounter,lp=value.lp_bonus??0;
    need(Number.isInteger(lp)&&(lp===0||lp>=100&&lp<=8000),`${routeLabel071(role)}의 상대 추가 LP는 0 또는 100~8,000으로 입력해 주세요.`);
    need(Number.isInteger(next.weight)&&next.weight>=1&&next.weight<=10000,'등장 가중치는 1~10,000으로 입력해 주세요.');
    need(typeof value.name==='string'&&value.name.trim()&&typeof value.deck_name==='string'&&value.deck_name.trim()&&value.profile_id&&value.art_key,'상대 이름과 캐릭터를 확인해 주세요.');
    need(Array.isArray(value.skills)&&value.skills.length<=8,'직접 특성은 8개까지 설정할 수 있습니다.');
    if(existing&&JSON.stringify(existing)===JSON.stringify(next))continue;
    if(existing)entries[index]=next;else entries.push(next);
    plans.set(role.entity_id,{role,entries});
  }
  const changes=[...plans.values()].map(({role,entries})=>({type:'chapter_role',id:role.entity_id,fields:{entries}}));
  return {changes,keys:changes.map(({type,id})=>({type,id})),targetCount:targets.length,roleCount:changes.length,deckId};
}
