const own=(value,key)=>Object.prototype.hasOwnProperty.call(value??{},key);

// Legacy characters omit both arrays. The server accepts the pair together.
export function completeCharacterTraits065(content,fields){
  if(!own(fields,'skills')&&!own(fields,'skill_profiles'))return fields;
  const next={...fields};
  for(const key of ['skills','skill_profiles'])if(!own(fields,key)&&!own(content,key))next[key]=[];
  return next;
}

export function rejectionReason065(error){
  let detail;try{detail=typeof error?.details==='string'?JSON.parse(error.details):error?.details;}catch{}
  const reason=detail?.reason??error?.message;
  return typeof reason==='string'&&!['unified039_validation','unified039_invalid'].includes(reason)&&/^[a-z][a-z0-9_]{0,120}(?::[a-zA-Z0-9_-]{1,100})?$/.test(reason)?reason.split(':')[0]:null;
}

const reasons={
  poc_invalid_character_skills:{fields:['skills','skill_profiles'],message:'기존 캐릭터의 특성과 특성 묶음을 함께 준비하지 못해 저장이 거절됐습니다. 초안으로 돌리면 빠진 항목을 보완합니다.'},
  poc_invalid_character:{fields:['name','portrait'],message:'캐릭터 이름이나 이미지 경로를 확인해 주세요.'},
  poc_invalid_story_skill:{fields:['skills','skill_profiles'],message:'특성의 중복, 수치와 대상 카드를 확인해 주세요. 시작 묘지는 합계 12장까지입니다.'},
  poc_invalid_skill_profiles:{fields:['skill_profiles'],message:'특성 묶음은 10개까지입니다. 묶음의 이름과 중복 항목을 확인해 주세요.'},
  unified039_invalid_shared_card:{fields:['skills','skill_profiles'],message:'공용 특성에 사용할 수 없는 카드가 있습니다. 해당 특성에서 카드를 다시 골라 주세요.'},
  unified039_invalid_shared_profile:{fields:['shared_character_id','shared_skill_profile_id'],message:'연결한 캐릭터의 특성 묶음을 다시 선택해 주세요.'},
  unified039_editor_required:{fields:[],message:'편집 권한을 확인하지 못했습니다. 편집 계정으로 다시 로그인해 주세요.'},
  unified039_forbidden:{fields:[],message:'이 항목을 저장할 권한이 없습니다. 편집 계정을 확인해 주세요.'},
  unified039_unauthorized:{fields:[],message:'로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.'},
  unified039_duplicate_deck:{fields:['main','extra'],message:'같은 카드 구성의 덱이 이미 있습니다. 기존 덱을 선택해 주세요.'},
  unified039_encounter_settings_belong_to_chapter:{fields:[],message:'상대 LP와 특성은 장별 적 편성에서 수정해 주세요.'}
};
export function validationInfo065(reason,fields=[]){
  const known=reasons[reason],related=known?.fields?.filter(field=>fields.includes(field));
  return {reason:reason??null,fields:reason==='poc_invalid_character_skills'?['skills','skill_profiles']:related?.length?related:[...fields],message:known?.message??'서버가 이 변경의 저장을 거절했습니다. 정확한 입력칸은 알려주지 않아 표시된 변경 항목을 확인해야 합니다. 수정 내용은 보관되어 있습니다.'};
}
