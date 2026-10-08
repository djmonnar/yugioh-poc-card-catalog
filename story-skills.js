// Presets live with the character in the online scenario. Battles reference a
// stable preset ID, so changing its label never changes progress or rewards.
export const NUMERIC_SKILLS={lp_bonus:[100,8000,1000,'LP'],heal_once:[100,8000,1000,'LP'],opening_draw:[1,3,1,'추가 장수'],draw_once:[1,3,1,'뽑을 장수']};
export function skillSets(actor){return [{profile_id:'',name:'기본 특성',skills:actor.skills},...(actor.skill_profiles||[])];}
export function battleSkills(actor,battle){const found=skillSets(actor).find(p=>p.profile_id===(battle.skill_profile||''));if(!found)throw new Error('전투의 특성 묶음을 다시 골라줘.');return found.skills;}
export function copyProfile(actor,name='새 특성',source=actor.skills,id=crypto.randomUUID()){
  if((actor.skill_profiles||[]).length>=10)throw new Error('캐릭터별 특성 묶음은 10개까지야.');
  const profile={profile_id:id,name,skills:structuredClone(source)};(actor.skill_profiles??=[]).push(profile);return profile;
}
export function removeProfile(doc,actor,id){
  if(doc.battles.some(b=>b.actor_id===actor.actor_id&&b.skill_profile===id))throw new Error('이 특성을 사용하는 전투부터 기본 특성이나 다른 묶음으로 바꿔줘.');
  actor.skill_profiles=actor.skill_profiles.filter(p=>p.profile_id!==id);
}
export function profilePacket(actor,profile){return {schema_version:1,kind:'poc-skill-preset',character:actor.name,name:profile.name,skills:structuredClone(profile.skills)};}
