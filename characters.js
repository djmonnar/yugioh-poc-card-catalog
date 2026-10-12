import {emptyStory,parseStory,safePortrait,canonicalStory,validateStory} from './story-core.js?v=20261012-shared127';
import {CHARACTER_KEY,parseCharacters} from './character-library.js?v=20261012-shared127';
import {CHARACTER_DRAFT_KEY,CHARACTER_TRANSFER_KEY,editableCharacterProfile,canonicalCharacterProfile,saveCharacterSnapshot} from './character-editor-core.js?v=20261012-shared127';
import {characterEditorUI} from './character-editor-ui.js?v=20261012-shared127';
import {CardSettingsCloud,applySettings} from './card-settings.js?v=20261007-49';
import {CardLimitsCloud,applyLimits} from './card-limits.js?v=20261008-61';
import {CardTagsCloud} from './card-tags.js?v=20261007-47';
import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig,cloudError} from './supabase-cloud.js?v=20261008-70';

const $=id=>document.getElementById(id),clone=structuredClone;
let cards=[],meta,characters=[],client,editor=false,tags=null,doc=emptyStory(),active='',drafts=new Map(),saving=false,storageBlocked=false,transfer=null;
const actor=()=>doc.actors[0],current=()=>drafts.get(active);
const message=e=>e?.message?.includes('poc_conflict')?'이 캐릭터의 같은 설정을 다른 곳에서도 변경했어. 현재 편집본은 보존돼. JSON으로 내보내고 온라인 저장본과 비교해줘.':e?.message?.includes('poc_invalid_story')?'사용 중인 시나리오의 특성 묶음이나 카드 설정을 확인해줘. 전투에서 사용하는 묶음은 먼저 전투 설정을 바꾼 뒤 삭제해줘.':e?.message?.includes('poc_')?cloudError(e):e?.message||'저장 결과를 확인할 수 없어.';
function status(text){$('status').textContent=text;renderSync();}
function download(name,value){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function renderSync(){
  if(!actor())return;const online=characters.find(c=>c.id===active),p=()=>editableCharacterProfile(actor());let equal=false;
  try{equal=online&&JSON.stringify(p())===JSON.stringify(editableCharacterProfile(online.profile));}catch{}
  $('character-sync').textContent=storageBlocked?'기존 브라우저 캐릭터 자료를 보존 중 · JSON 내보내기를 사용해줘.':`브라우저 편집본 · ${online?equal?'온라인 반영됨':'온라인 미반영 변경 있음':'새 캐릭터 · 온라인 저장 전'}`;
  $('save-character').disabled=saving||storageBlocked;
}
function check(){
  if(!actor())return;const box=$('validation');box.replaceChildren();
  try{canonicalCharacterProfile(actor(),meta,cards);box.className='story-ok';box.append(ui.node('p','캐릭터 설정 준비 완료 · 이 캐릭터 온라인 저장으로 모든 연결된 시나리오에 반영돼.'));}
  catch(e){box.className='story-warning';box.append(ui.node('p',e.message));}
}
function persist(){
  if(!actor())return;
  if(storageBlocked){status('기존 브라우저 자료를 보존 중이야. 캐릭터 JSON으로 내보내줘.');check();return;}
  try{
    const profile=editableCharacterProfile(actor()),entry=current();entry.profile=profile;
    localStorage.setItem(CHARACTER_DRAFT_KEY,JSON.stringify({schema:1,active,entries:[...drafts.values()]}));
    renderSync();check();
  }catch(e){status(`${e.message} 이전 브라우저 저장본은 유지돼.`);check();}
}
function loadDrafts(){
  const raw=localStorage.getItem(CHARACTER_DRAFT_KEY);if(!raw)return;
  try{const value=JSON.parse(raw);if(value.schema!==1||!Array.isArray(value.entries)||value.entries.length>100)throw new Error();
    const seen=new Set();for(const item of value.entries){if(!/^[A-Za-z0-9_-]{1,100}$/.test(item.id)||seen.has(item.id)||!Number.isSafeInteger(item.expectedVersion)||item.expectedVersion<0)throw new Error();seen.add(item.id);const entry={...item,profile:editableCharacterProfile(item.profile)};if(item.baseline)entry.baseline=parseCharacters([item.baseline])[0];drafts.set(item.id,entry);}active=value.active;
  }catch{storageBlocked=true;drafts.clear();active='';}
}
function use(id){
  if(actor())persist();let entry=drafts.get(id);
  if(!entry){const row=characters.find(c=>c.id===id);if(!row)return;entry={id,profile:editableCharacterProfile(row.profile),expectedVersion:row.version,baseline:clone(row)};drafts.set(id,entry);}
  active=id;doc={...emptyStory(),actors:[{actor_id:'editor',...clone(entry.profile)}]};render();persist();renderTransfer();
}
function create(id='character-'+crypto.randomUUID(),profile={name:'새 캐릭터',portrait:'',skills:[],skill_profiles:[]}){
  if(drafts.size>=100)return status('캐릭터 편집본은 100개까지 보관할 수 있어.');
  if(actor())persist();drafts.set(id,{id,profile:editableCharacterProfile(profile),expectedVersion:0,baseline:null});active='';use(id);
}
function renderList(){
  const rows=new Map(characters.map(c=>[c.id,c.profile.name]));for(const d of drafts.values())rows.set(d.id,d.profile.name);
  $('character-select').replaceChildren(...[...rows].map(([id,name])=>{const o=ui.node('option',name);o.value=id;return o;}));$('character-select').value=active;
}
function render(){
  renderList();const a=actor(),box=$('character-editor');box.replaceChildren();if(!a)return;
  box.append(ui.input('캐릭터 이름',a.name,v=>{a.name=v;renderList();},{max:100}));
  if(a.portrait){const img=ui.node('img');img.src=a.portrait;img.alt=`${a.name} 초상화`;img.style.cssText='max-height:240px;max-width:100%;object-fit:contain';box.append(img);}
  box.append(ui.input('초상화 주소',a.portrait,v=>{if(safePortrait(v))a.portrait=v;else status('프로젝트 이미지나 공용 에셋 보관소 주소를 사용해줘.');},{max:1000}));
  const file=ui.node('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.setAttribute('aria-label','캐릭터 초상화 업로드');
  file.onchange=async()=>{
    const target=a,id=active;
    try{const image=file.files[0];if(!image)return;if(!client||!editor)throw new Error('초상화 업로드는 도감에서 이메일로 로그인한 뒤 사용해줘.');
      if(image.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(image.type))throw new Error('PNG·JPEG·WebP, 3MB 이하 이미지를 골라줘.');
      const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image.type],path=`portraits/${crypto.randomUUID()}.${ext}`,reply=await client.storage.from('poc-story-assets').upload(path,image,{contentType:image.type,upsert:false});if(reply.error)throw reply.error;
      target.portrait=client.storage.from('poc-story-assets').getPublicUrl(path).data.publicUrl;
      if(active===id&&actor()===target){render();persist();}else{const d=drafts.get(id);if(d)d.profile.portrait=target.portrait;localStorage.setItem(CHARACTER_DRAFT_KEY,JSON.stringify({schema:1,active,entries:[...drafts.values()]}));}
    }catch(e){status(message(e));}finally{file.value='';}
  };box.append(file);ui.render(a,box);check();renderSync();
}
function renderTransfer(){
  const valid=transfer&&transfer.character_id===active;$('character-transfer').hidden=!valid;
  if(valid)$('transfer-note').textContent=`「${transfer.source?.scenario_title||'이전 시나리오'}」의 ${transfer.profile.name} 특성을 가져올 수 있어. 가져온 뒤 캐릭터를 저장하고 시나리오에서 ‘저장된 공용 특성 사용하기’를 눌러줘. 원래 시나리오 편집본은 유지돼.`;
}
async function loadCharacters(){const result=await client.rpc('poc_load_characters');if(result.error)throw result.error;characters=parseCharacters(result.data);localStorage.setItem(CHARACTER_KEY,JSON.stringify(characters));renderList();renderSync();}
async function connect(){
  const config=validateCloudConfig(await fetch('data/cloud-config.json',{cache:'no-store'}).then(r=>r.json()));
  client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});tags=new CardTagsCloud(client);
  const access=await client.rpc('poc_editor_status');editor=!access.error&&access.data===true;
  await Promise.all([loadCharacters(),new CardSettingsCloud(client).load().then(rows=>applySettings(cards,rows)),new CardLimitsCloud(client).load().then(rows=>applyLimits(cards,rows))]);
  await ui.refreshTags();status(editor?'이메일 로그인 확인됨 · 캐릭터 설정은 별도로 온라인 저장해줘.':'브라우저 편집 가능 · 온라인 저장은 카드 도감에서 이메일 로그인 후 사용해줘.');
}
const ui=characterEditorUI({getDocument:()=>doc,getCards:()=>cards,getMeta:()=>meta,getClient:()=>client,getEditor:()=>editor,getTags:()=>tags,status,persist,render,check,download});
$('character-select').onchange=()=>use($('character-select').value);
$('new-character').onclick=()=>create();
$('refresh-characters').onclick=async()=>{try{if(!client)await connect();else await loadCharacters();status('공용 목록을 갱신했어. 현재 브라우저 편집본은 유지돼.');}catch(e){status(message(e));}};
$('save-character').onclick=async()=>{
  if(saving||storageBlocked||!actor())return;saving=true;renderSync();
  try{
    if(!client)await connect();if(!editor)throw new Error('카드 도감에서 이메일로 로그인한 뒤 이 페이지를 다시 열어줘.');
    const id=active,entry=clone(current()),captured=editableCharacterProfile(actor()),profile=canonicalCharacterProfile(captured,meta,cards);
    status(`「${profile.name}」 캐릭터 온라인 저장 중…`);
    const result=await saveCharacterSnapshot(client,{id,profile,expectedVersion:entry.expectedVersion,baseline:entry.baseline});characters=result.rows;
    localStorage.setItem(CHARACTER_KEY,JSON.stringify(characters));
    const target=drafts.get(id);if(target){target.expectedVersion=result.row.version;target.baseline=clone(result.row);
      if(active===id){if(JSON.stringify(editableCharacterProfile(actor()))===JSON.stringify(captured)){target.profile=editableCharacterProfile(result.row.profile);doc.actors[0]={actor_id:'editor',...clone(target.profile)};render();}persist();}
      else{if(JSON.stringify(target.profile)===JSON.stringify(entry.profile))target.profile=editableCharacterProfile(result.row.profile);localStorage.setItem(CHARACTER_DRAFT_KEY,JSON.stringify({schema:1,active,entries:[...drafts.values()]}));}
    }
    renderList();status(`「${result.row.profile.name}」 프로필·컷신·음성·특성 온라인 저장 완료${result.rebased?' · 서로 다른 설정의 변경을 함께 반영했어':''}. 시나리오 저장과 게임의 다음 실행부터 불러올 수 있어.`);
  }catch(e){status(message(e)+' 현재 브라우저 편집본은 유지돼.');}
  finally{saving=false;renderSync();}
};
$('load-character').onclick=async()=>{
  try{if(!client)await connect();const id=active;await loadCharacters();const row=characters.find(c=>c.id===id);if(!row)return status('아직 온라인에 저장하지 않은 캐릭터야.');
    if(id!==active)return;if(!confirm('온라인 캐릭터 저장본을 불러올까? 현재 편집본은 JSON으로 백업할게.'))return;
    download('character-before-online-load.json',{schema_version:1,kind:'poc-shared-character',id,profile:actor()});drafts.set(id,{id,profile:editableCharacterProfile(row.profile),expectedVersion:row.version,baseline:clone(row)});storageBlocked=false;active='';use(id);
  }catch(e){status(message(e));}
};
$('export-character').onclick=()=>download('character-source.json',{schema_version:1,kind:'poc-shared-character',id:active,profile:actor()});
$('import-character').onclick=()=>$('character-file').click();
$('character-file').onchange=async()=>{try{const f=$('character-file').files[0];if(!f)return;if(f.size>1024*1024)throw new Error('캐릭터 JSON은 1MB 이하로 골라줘.');const v=JSON.parse(await f.text());if(v.schema_version!==1||v.kind!=='poc-shared-character')throw new Error('공용 캐릭터 JSON을 골라줘.');const p=canonicalCharacterProfile(v.profile,meta,cards);doc.actors[0]={actor_id:'editor',...p};render();persist();}catch(e){status(message(e));}finally{$('character-file').value='';}};
$('import-transfer').onclick=()=>{try{
  if(!transfer||transfer.character_id!==active)return;const imported=editableCharacterProfile(transfer.profile),a=actor();
  if((a.skills.length||(a.skill_profiles||[]).length)&&!confirm('가져온 특성으로 현재 캐릭터 편집본의 기본 특성과 묶음을 바꿀까? 현재 편집본은 JSON으로 백업할게.'))return;
  download('character-before-traits-import.json',{schema_version:1,kind:'poc-shared-character',id:active,profile:a});a.skills=imported.skills;a.skill_profiles=imported.skill_profiles;render();persist();status('시나리오 특성을 가져왔어. 이 캐릭터 온라인 저장 후 시나리오에서 공용 특성 사용으로 바꿔줘.');
}catch(e){status(message(e));}};
async function start(){
  try{const catalog=await fetch('data/cards.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('카드 자료를 불러올 수 없어.');return r.json();});cards=catalog.cards;meta=catalog.meta;loadDrafts();
    try{characters=parseCharacters(JSON.parse(localStorage.getItem(CHARACTER_KEY)||'[]'));}catch{}
    try{transfer=JSON.parse(localStorage.getItem(CHARACTER_TRANSFER_KEY)||'null');if(transfer)editableCharacterProfile(transfer.profile);}catch{transfer=null;}
    try{await connect();}catch(e){status(message(e)+' 브라우저 편집본은 사용할 수 있어.');}
    const args=new URLSearchParams(location.search),id=args.get('character');
    if(args.has('new'))create();else if(id&&(drafts.has(id)||characters.some(c=>c.id===id)))use(id);else if(id&&transfer?.character_id===id)create(id,transfer.profile);else if(active&&drafts.has(active))use(active);else if(characters.length)use(characters[0].id);else create();
    if(storageBlocked)status('기존 브라우저 자료를 읽을 수 없어 보존 중이야. 캐릭터 JSON으로 내려받아줘.');renderTransfer();
  }catch(e){status(message(e));}
}
start();
