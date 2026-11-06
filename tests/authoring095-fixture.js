import {fixture041} from './authoring041-test-dom.js';
export const copy095=structuredClone,tick095=()=>new Promise(resolve=>setImmediate(resolve)),flush095=async()=>{await tick095();await tick095();};
export function chapterFixture095(){
  const state=fixture041();state.user={id:'synthetic-chapter095'};state.bootstrap.capabilities.deck_compositions044=true;
  const decks=state.entities.filter(row=>row.entity_type==='deck').slice(0,3);decks.forEach((d,i)=>{d.content.name=d.content.deck_name=`검수 공유 덱 ${i+1}`;});
  state.entities=state.entities.filter(row=>!['deck','chapter_role'].includes(row.entity_type));state.entities.push(...decks);
  for(const chapter of [1,2,3])for(const role of ['battle','elite','boss'])state.entities.push({entity_type:'chapter_role',entity_id:`${chapter}:${role}`,version:1,state:'saved',issues:[],content:{chapter,role,lp_bonus:700,unknownRole:{keep:true},entries:Array.from({length:8},(_,i)=>({entry_id:`enc-${chapter}-${role}-${i}`,deck_id:decks[i%2].entity_id,weight:i+1,unknownEntry:{keep:i},encounter:{name:`검수 상대 ${i+1}`,deck_name:`검수 덱 ${i+1}`,profile_id:'yugi',art_key:'CharacterPresentation012/images/yugi/start',banlist_enabled:false,lp_bonus:i*100,opening_draw_bonus:0,skills:[],shared_character_id:null,shared_skill_profile_id:null,use_shared_skills:false}}))}});
  state.bootstrap.authoring={entities:copy095(state.entities)};return state;
}
