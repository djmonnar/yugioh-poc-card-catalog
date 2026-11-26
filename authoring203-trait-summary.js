// (203) 대표님 2026-11-25: "특성이 '공용 특성'으로만 보여서 실제로 무엇인지 모르겠다. 실제 특성 이름과 값을 보여 달라."
// One plain-text line per trait (name and values) for the starter list, the folded trait rows of every trait editor
// and the placement rows that used to say only "공용 특성 사용". Read-only: it never changes a stored trait.
// Both stored shapes are read: decks and encounters keep the typed shape ({kind,value,threshold,sourceId,position,entries}
// with sourceId -1 / position 0 defaults); character shared traits and starter traits keep the shared shape
// ({kind,card:{internal_id,name_ko},position:'attack',entries:[{card,count}]}).
import {auraSummary199} from './authoring199-traits.js';
import {TRAIT_LABELS203} from './authoring203-traits.js';
import {DUEL_READY209} from './authoring209-traits.js';

const number=value=>Number(value).toLocaleString('ko-KR');
const SHARED_POSITIONS203=['attack','defense','set'];
const POSITION_LABELS203=['공격 표시','수비 표시','뒷면 수비'];
// Fallback labels when the database list has no definition for a stored kind (older rows, a kind the list dropped).
const KIND_LABELS203={start_hand:'시작 패에 카드 추가',start_field:'시작 마법·함정 배치',start_monster:'시작 몬스터 배치',start_grave:'시작 묘지',
  heal_once:'LP 회복 1회',draw_once:'위기 드로우 1회',add_hand_once:'카드 추가 1회',parasite_deck:'기생충 덱 삽입',lp_bonus:'추가 LP',opening_draw:'시작 드로우 추가',
  effect_damage_null:'효과 데미지 무효',reflect_damage_null:'반사 데미지 무효',first_damage_null:'첫 데미지 무효',ouija_board:'위저보드 (다크 네크로피어)',
  union_power:'유니온의 힘',fusion_recover:'융합회수',ritual_recover:'의식회수',start_deck:'시작 덱에 카드 추가',stat_aura:'공격력·수비력 조정 (조건)',
  destiny_draw:'데스티니 드로우',opening_reload:'리로드',...TRAIT_LABELS203,[DUEL_READY209.kind]:DUEL_READY209.label};

export function traitLabel203(row,definitions=[]){
  const kind=typeof row?.kind==='string'?row.kind:'';
  return definitions.find(item=>item?.kind===kind)?.label??KIND_LABELS203[kind]??(kind||'알 수 없는 특성');
}

// cardName(id) returns the current catalog name; the stored name_ko of a shared card reference is the fallback.
function cardText(cardName,id,ref){
  const known=Number.isSafeInteger(id)&&id>=0;
  return (known?cardName(id):null)??ref?.name_ko??(known?`카드 ${id}`:'카드 미선택');
}

// Without a definition, show whatever values the row carries (never the typed shape's empty defaults).
function storedFields(row){
  const fields={};
  for(const key of ['value','threshold'])if(Number.isFinite(row[key])&&row[key]!==0)fields[key]={type:'integer'};
  if(row.card||Number.isSafeInteger(row.sourceId)&&row.sourceId>=0)fields.card={type:'source-card'};
  if(Array.isArray(row.entries)&&row.entries.length)fields.entries={type:'counted-source-cards'};
  if(row.aura&&typeof row.aura==='object')fields.aura={type:'stat-aura'};
  return fields;
}

// The values of one trait in the order of its definition's fields ([] for kinds without values).
export function traitValues203(row,{definitions=[],cardName=()=>null}={}){
  if(!row||typeof row!=='object')return [];
  const definition=definitions.find(item=>item?.kind===row.kind),values=[];
  for(const [key,spec] of Object.entries(definition?.fields??storedFields(row))){
    if(spec?.type==='integer'){
      const value=row[key];if(!Number.isFinite(value))continue;
      if(key==='threshold')values.push(`LP ${number(value)} 이하`);
      else if(row.kind==='heal_once'||row.kind==='lp_bonus')values.push(`${number(value)} LP`);
      else if(row.kind==='union_power')values.push(`공격력·수비력 +${number(value)}`);
      else if(row.kind==='opening_draw')values.push(`+${number(value)}장`);
      else if(row.kind==='draw_once')values.push(`${number(value)}장`);
      else values.push(number(value));
    }else if(spec?.type==='source-card'){
      values.push(cardText(cardName,row.card?.internal_id??row.sourceId,row.card));
    }else if(spec?.type==='enum'){
      const index=typeof row.position==='string'?SHARED_POSITIONS203.indexOf(row.position):(spec.values??[1,4,8]).indexOf(row.position),label=(spec.labels??POSITION_LABELS203)[index];
      if(label)values.push(label);
    }else if(spec?.type==='stat-aura'){
      values.push(auraSummary199(row.aura,Array.isArray(spec.types)?spec:undefined));
    }else if(spec?.type==='counted-source-cards'){
      const entries=Array.isArray(row.entries)?row.entries:[],total=entries.reduce((n,entry)=>n+(Number.isSafeInteger(entry?.count)?entry.count:0),0);
      const names=entries.map(entry=>`${cardText(cardName,entry?.card?.internal_id??entry?.sourceId,entry?.card)} ${number(entry?.count??0)}장`);
      if(!names.length)values.push('카드 미선택');
      else if(names.length>3)values.push(`${names.slice(0,3).join(', ')} 외 ${names.length-3}종 · 합계 ${number(total)}장`);
      else values.push(names.length>1?`${names.join(', ')} · 합계 ${number(total)}장`:names[0]);
    }
  }
  return values;
}

// "LP 회복 1회 (1,000 LP)" — the name with its values in parentheses.
export function traitLine203(row,options={}){
  const label=traitLabel203(row,options.definitions),values=traitValues203(row,options);
  return values.length?`${label} (${values.join(' · ')})`:label;
}
export function traitLines203(rows,options={}){return (Array.isArray(rows)?rows:[]).map(row=>traitLine203(row,options));}

// The character shared traits a deck or an encounter uses (null when it uses none).
export function sharedTraitSource203(value,characters=[]){
  if(!value?.use_shared_skills)return null;
  const character=characters.find(row=>row.id===value.shared_character_id)??null;
  if(!character)return {character:null,profileName:null,rows:[],missing:'연결한 캐릭터를 찾을 수 없음'};
  const profiles=character.profile?.skill_profiles??[],profile=value.shared_skill_profile_id?profiles.find(row=>row.profile_id===value.shared_skill_profile_id)??null:null;
  if(value.shared_skill_profile_id&&!profile)return {character,profileName:null,rows:[],missing:'연결한 특성 묶음을 찾을 수 없음'};
  return {character,profileName:profile?.name??'기본 특성',rows:profile?.skills??character.profile?.skills??[]};
}

// One line for a deck or an encounter: its shared traits (named by character and set) and its own traits.
// "공용 카이바 · 기본 특성: LP 회복 1회 (1,000 LP), 융합회수 · 직접: LP 회복 1회 (500 LP)"
export function encounterTraitText203(value,{characters=[],...options}={}){
  const parts=[],shared=sharedTraitSource203(value,characters),own=traitLines203(value?.skills,options);
  if(shared){
    if(shared.missing)parts.push(`공용 특성 (${shared.missing})`);
    else{const lines=traitLines203(shared.rows,options);parts.push(`공용 ${shared.character.profile?.name??'캐릭터'} · ${shared.profileName}: ${lines.length?lines.join(', '):'특성 없음'}`);}
  }
  if(own.length)parts.push(`${shared?'직접':'특성'}: ${own.join(', ')}`);
  return parts.length?parts.join(' · '):'특성 없음';
}
