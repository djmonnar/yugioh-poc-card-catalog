import {traitCardMatches089,sharedTraitRefMatches089} from './authoring089-traits.js?v=20261106-089';
// Local preflight explains known server contracts. The server remains authoritative.
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value??{},key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const labels={name:'이름',title:'제목',portrait:'캐릭터 이미지',description:'설명',effect:'선택 결과 설명',tags:'카테고리',links:'관련 카드',skills:'특성',skill_profiles:'특성 묶음',params:'효과 수치',fixed_source_ids:'항상 진열할 카드',regular_card_count:'일반 카드 진열 수',sourceIds:'수록 카드',urWeight:'UR 확률',srWeight:'SR 확률',rWeight:'R 확률',nWeight:'N 확률'};
export const authoringFieldNames066=Object.freeze(labels);
export function completeEventText066(content,fields){return content?.effect==null&&!own(fields,'effect')?{...fields,effect:''}:fields;}
export function validateAuthoringChange066(snapshot,type,id,fields,{operation='patch'}={}){
  const capabilities=snapshot.bootstrap?.capabilities,definition=capabilities?.entities?.[type];
  if(!definition)return;
  const fail=(keys,message)=>{const error=new Error(message);error.authoringIssue066={entityType:type,entityId:id,fields:keys,message};throw error;};
  const check=(valid,keys,message)=>{if(!valid)fail(keys,message);};
  if(definition.operations)check(definition.operations.includes(operation),[],'이 항목에서 지원하는 저장 작업을 확인해 주세요.');
  if(operation==='delete')return;
  const entities=snapshot.entities??snapshot.bootstrap?.authoring?.entities??[],row=entities.find(row=>row.entity_type===type&&row.entity_id===id),content={...(row?.content??{}),...fields};
  const defs=definition.fields??{},length=value=>Array.from(value).length;
  for(const [key,spec] of Object.entries(defs)){
    if(!own(content,key))continue;
    const value=content[key],label=labels[key]??spec.label??key;
    if(['text','multiline'].includes(spec.type)){
      check(typeof value==='string',[key],`${label}을 글자로 입력해 주세요.`);
      const minimum=(type==='deck'||type==='meta_pack')&&['name','deck_name'].includes(key)?0:spec.min??0,maximum=type==='character'&&key==='portrait'?Math.min(spec.max??1000,1000):spec.max;
      check(length(value)>=minimum,[key],`${label}을 입력해 주세요.`);
      if(maximum!=null)check(length(value)<=maximum,[key],`${label}은 ${maximum}자 이내로 입력해 주세요.`);
    }
    if(spec.type==='integer'||spec.type==='nullable_integer'&&value!==null)check(Number.isSafeInteger(value)&&(spec.min==null||value>=spec.min)&&(spec.max==null||value<=spec.max),[key],`${label}의 허용 범위 ${spec.min??'최솟값'}~${spec.max??'최댓값'}을 확인해 주세요.`);
    if(spec.type==='boolean')check(typeof value==='boolean',[key],`${label}을 다시 선택해 주세요.`);
    if(spec.type==='enum')check(spec.values?.includes(value),[key],`${label}을 목록에서 다시 선택해 주세요.`);
    if(spec.type==='bounded_parameters'){
      const forms=capabilities.form?.[type==='relic'?'relics':'events']??[],bounds=forms.find(form=>form.id===id)?.bounds;
      if(bounds)for(const [parameter,bound] of Object.entries(bounds))check(Number.isSafeInteger(value?.[parameter])&&value[parameter]>=bound.min&&value[parameter]<=bound.max,[key],`${label}의 입력 범위는 ${bound.min}~${bound.max}입니다. 각 수치를 확인해 주세요.`);
    }
  }
  if(type==='card_display')check(typeof content.name==='string'&&content.name.trim().length>0,['name'],'카드 이름을 입력해 주세요.');
  if(type==='event')check(typeof content.name==='string'&&content.name.length>0,['name'],'이벤트 이름을 입력해 주세요.');
  if(type==='relic'&&id==='blood_contract')check(content.params?.threshold>=content.params?.lp,['params'],'피의 계약서의 발동 기준은 LP 비용 이상이어야 합니다.');
  if(type==='meta_score'){
    const keys=['urWeight','srWeight','rWeight','nWeight'],total=keys.reduce((sum,key)=>sum+content[key],0);
    check(total===100,keys,`카드팩 등급 확률의 합계는 100이어야 합니다. 현재 합계: ${total}`);
  }
  const raw=snapshot.bootstrap?.catalog?.cards??snapshot.bootstrap?.catalog??snapshot.gamePayload?.catalog?.cards??snapshot.gamePayload?.catalog??snapshot.bootstrap?.game?.catalog?.cards??snapshot.bootstrap?.game?.catalog??[];
  const cards=Array.isArray(raw)?raw:[],source=card=>card.source_id??card.sourceId??card.internal_id,slot=card=>card.web_slot??card.slot,extra=card=>Boolean((card.native_type??card.type??0)&(0x40|0x2000|0x800000|0x4000000)),playable=card=>card&&card.playable!==false&&!card.token&&!card.special;
  const bySource=new Map(cards.map(card=>[source(card),card])),bySlot=new Map(cards.map(card=>[slot(card),card]));
  if(type==='card_annotation'){
    check(Array.isArray(content.tags)&&content.tags.length<=(defs.tags?.max??12),['tags'],`카테고리는 ${defs.tags?.max??12}개까지 선택할 수 있습니다.`);
    check(Array.isArray(content.links)&&content.links.length<=(defs.links?.max??20),['links'],`관련 카드는 ${defs.links?.max??20}개까지 연결할 수 있습니다.`);
    if(cards.length)for(const link of content.links){const card=bySlot.get(link.slot);check(card&&card.identity_key===link.identity_key,['links'],'정보가 바뀐 관련 카드 연결이 있습니다. 카드 정보에서 해당 연결을 제거하거나 카드를 다시 선택해 주세요.');}
  }
  if(type==='shop_rules'){
    check(Array.isArray(content.fixed_source_ids)&&new Set(content.fixed_source_ids).size===content.fixed_source_ids.length,['fixed_source_ids'],'항상 진열할 카드에 같은 카드를 중복해서 넣을 수 없습니다.');
    check(content.fixed_source_ids.length<=content.regular_card_count,['regular_card_count','fixed_source_ids'],'항상 진열할 카드 수가 일반 카드 진열 수보다 많습니다. 카드를 줄이거나 진열 수를 늘려 주세요.');
    const limitRows=new Map(entities.filter(row=>row.entity_type==='card_limit').map(row=>[row.entity_id,row.content])),family=card=>card.alias||card.code||source(card),normalLimit=card=>{const limits=limitRows.get(String(source(card)));return limits?.normal_limit??limits?.frozen_normal_limit??card?.normal_limit??card?.deck_limit??3;},familyLimits=new Map();
    for(const card of cards)if(card.playable!==false)familyLimits.set(family(card),Math.min(familyLimits.get(family(card))??3,normalLimit(card)));
    if(cards.length)for(const id of content.fixed_source_ids){
      const card=bySource.get(id),setting=entities.find(row=>row.entity_type==='card_setting'&&row.entity_id===String(id))?.content,limits=entities.find(row=>row.entity_type==='card_limit'&&row.entity_id===String(id))?.content;
      const normal=card?familyLimits.get(family(card)):0,speed=limits?.speed_limit??limits?.frozen_speed_limit??card?.speed_limit;
      check(playable(card)&&!extra(card)&&(setting?.stock??card.stock)===true&&normal>0&&speed!==0,['fixed_source_ids'],'항상 진열할 카드에 현재 판매할 수 없는 카드가 있습니다. 판매 설정과 카드 제한을 확인해 주세요.');
    }
  }
  const validateSkills=(rows,shared,keys)=>{
    const maximum=shared?10:8,kinds=(capabilities.trait_form?.kinds??[]).filter(kind=>shared||kind.compiled);
    check(Array.isArray(rows)&&rows.length<=maximum,keys,`특성은 ${maximum}개까지 설정할 수 있습니다.`);
    check(new Set(rows.map(row=>row.kind)).size===rows.length,keys,'같은 종류의 특성은 한 번만 설정할 수 있습니다.');
    for(const row of rows){
      const kind=kinds.find(kind=>kind.kind===row.kind);if(!kinds.length)continue;
      check(Boolean(kind),keys,'현재 지원하지 않는 특성이 있습니다. 해당 특성을 제거한 뒤 다시 선택해 주세요.');
      for(const [key,spec] of Object.entries(kind.fields??{})){
        if(spec.type==='integer')check(Number.isSafeInteger(row[key])&&row[key]>=spec.min&&row[key]<=spec.max,keys,`${kind.label}의 수치는 ${spec.min}~${spec.max} 범위여야 합니다.`);
        if(spec.type==='enum')check((shared?['attack','defense','set']:spec.values).includes(row.position),keys,`${kind.label}의 표시 형식을 다시 선택해 주세요.`);
        if(spec.type==='source-card'&&cards.length){
          const ref=shared?row.card:null,card=bySource.get(shared?ref?.internal_id:row.sourceId);
          check(traitCardMatches089(card)&&(!shared||sharedTraitRefMatches089(card,ref)),keys,`${kind.label}의 대상 카드를 다시 선택해 주세요.`);
          if(spec.filter?.endsWith('-monster'))check(traitCardMatches089(card,spec.filter),keys,`${kind.label}에는 몬스터 카드를 선택해 주세요.`);
          if(spec.filter?.endsWith('-spell-trap'))check(traitCardMatches089(card,spec.filter),keys,`${kind.label}에는 마법·함정 카드를 선택해 주세요.`);
        }
        if(spec.type==='counted-source-cards'){
          const entries=row.entries??[],ids=entries.map(entry=>shared?entry.card?.internal_id:entry.sourceId);
          check(entries.length>0&&entries.length<=12&&new Set(ids).size===ids.length&&entries.every(entry=>Number.isSafeInteger(entry.count)&&entry.count>=1&&entry.count<=12)&&entries.reduce((sum,entry)=>sum+entry.count,0)<=12,keys,'시작 묘지는 중복 카드 없이 합계 1~12장으로 설정해 주세요.');
          if(cards.length)for(const entry of entries){const ref=shared?entry.card:null,card=bySource.get(shared?ref?.internal_id:entry.sourceId);check(traitCardMatches089(card)&&(!shared||sharedTraitRefMatches089(card,ref)),keys,'시작 묘지의 대상 카드를 다시 선택해 주세요.');}
        }
      }
    }
  };
  if(type==='character'){
    check(typeof content.name==='string'&&content.name.trim().length>0,['name'],'캐릭터 이름을 입력해 주세요.');
    check(typeof content.portrait==='string'&&content.portrait.length<=1000&&!content.portrait.includes('..')&&(content.portrait===''||/^((assets|content-packs)\/|https:\/\/[a-z]{20}\.supabase\.co\/storage\/v1\/object\/public\/poc-story-assets\/)[A-Za-z0-9_./-]+\.(png|jpe?g|webp)$/i.test(content.portrait)),['portrait'],'캐릭터 이미지는 업로드한 이미지나 프로젝트의 PNG·JPEG·WebP 경로를 사용해 주세요.');
    check(own(content,'skills')===own(content,'skill_profiles'),['skills','skill_profiles'],'캐릭터의 특성과 특성 묶음을 함께 준비해야 합니다. 초안으로 돌려 수정해 주세요.');
    if(own(content,'skills'))validateSkills(content.skills,true,['skills']);
    if(own(content,'skill_profiles')){
      const profiles=content.skill_profiles;check(Array.isArray(profiles)&&profiles.length<=10,['skill_profiles'],'특성 묶음은 10개까지 설정할 수 있습니다.');
      check(new Set(profiles.map(profile=>profile.profile_id)).size===profiles.length,['skill_profiles'],'중복된 특성 묶음이 있습니다.');
      for(const profile of profiles){check(typeof profile.profile_id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(profile.profile_id),['skill_profiles'],'특성 묶음의 식별자를 확인해 주세요.');check(typeof profile.name==='string'&&profile.name.trim().length>0&&length(profile.name.trim())<=100,['skill_profiles'],'특성 묶음 이름은 1~100자로 입력해 주세요.');validateSkills(profile.skills,true,['skill_profiles']);}
    }
  }
  if(type==='deck'&&own(content,'skills'))validateSkills(content.skills,false,['skills']);
  if(type==='chapter_role')for(const entry of content.entries??[])if(entry.encounter){
    try{validateSkills(entry.encounter.skills??[],false,['entries']);}
    catch(error){if(error.authoringIssue066){error.message=`${entry.encounter.name||'편성된 상대'} · ${error.message}`;error.authoringIssue066={...error.authoringIssue066,entryId:entry.entry_id,message:error.message};}throw error;}
  }
}
