const token=(id,profile=null)=>JSON.stringify([id,profile]);
export function characterChoice068(value,characters){
  return characters.find(c=>c.id===value.shared_character_id&&c.profile_id===value.profile_id)?.id??characters.find(c=>c.profile_id===value.profile_id)?.id??'';
}
export function changeCharacter068(id,characters){
  const c=characters.find(row=>row.id===id);if(!c)throw Error('선택한 캐릭터를 찾을 수 없습니다. 다시 선택해 주세요.');
  return {profile_id:c.profile_id,art_key:c.art_key,name:c.profile?.name??'새 상대',shared_character_id:c.id,shared_skill_profile_id:null,use_shared_skills:false};
}
export function traitChoices068(value,characters){
  const selected=characterChoice068(value,characters),character=characters.find(c=>c.id===selected),choices=[{value:'',label:'사용 안 함'}],current=value.use_shared_skills?token(value.shared_character_id,value.shared_skill_profile_id??null):'';
  if(character){
    const base=character.profile?.skills??[],profiles=character.profile?.skill_profiles??[],counts=new Map();
    for(const profile of profiles)counts.set(profile.name,(counts.get(profile.name)??0)+1);
    if(base.length||current===token(character.id))choices.push({value:token(character.id),label:`기본 특성 · ${base.length}개`});
    const seen=new Map();for(const p of profiles){const n=(seen.get(p.name)??0)+1;seen.set(p.name,n);choices.push({value:token(character.id,p.profile_id),label:`${p.name}${counts.get(p.name)>1?` (${n})`:''} · ${(p.skills??[]).length}개`});}
  }
  if(current&&!choices.some(c=>c.value===current)){const linked=characters.find(c=>c.id===value.shared_character_id),profile=linked?.profile?.skill_profiles?.find(p=>p.profile_id===value.shared_skill_profile_id);choices.push({value:current,label:`현재 연결 유지 · ${linked?.profile?.name??'기존 캐릭터'} · ${profile?.name??'기본 특성'}`});}
  return {choices,current,character};
}
export function changeTrait068(value,characterId=null){
  if(!value)return {shared_character_id:characterId||null,shared_skill_profile_id:null,use_shared_skills:false};
  const [shared_character_id,shared_skill_profile_id]=JSON.parse(value);return {shared_character_id,shared_skill_profile_id,use_shared_skills:true};
}
