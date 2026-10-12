import {SKILLS,cardRef,parseSkills,parsePreset,canonicalStory,emptyStory,newActor} from './story-core.js?v=20261012-shared127';
import {NUMERIC_SKILLS,skillSets,copyProfile,removeProfile,profilePacket} from './story-skills.js?v=20261009-73';
import {MEDIA_EVENTS,defaultPresentation,parsePresentation,safeMedia,validateAudioFile} from './story-media.js?v=20261009-media88';
import {createStatFilters} from './card-filters.js?v=20261007-44';
import {pickerCards} from './card-picker.js?v=20261010-picker106';
import {annotationFor} from './card-tags.js?v=20261007-47';
export function characterEditorUI({getDocument,getCards,getMeta,getClient,getEditor,getTags,status,persist,render,check,download}){
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let chooseCard,pickerPage=0,pickerSelection=null,filter=()=>true;
const selectedPickerTags=new Set(),openedMedia=new WeakSet(),openedMediaEvents=new WeakMap();
const pickerFields=['rarity','type','subtype','race','attribute','mechanic','group'];
const pickerStats=createStatFilters($('picker-stats'),()=>{pickerPage=0;renderPicker();});
let doc,cards,meta,client,editor,pickerTagsCloud;
function sync(){doc=getDocument();cards=getCards();meta=getMeta();client=getClient();editor=getEditor();pickerTagsCloud=getTags();}
function redraw(){sync();const y=window.scrollY;render();requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));persist();}
function button(text,action,cls){const b=node('button',text);b.type='button';if(cls)b.className=cls;b.addEventListener('click',action);return b;}
function input(label,value,changed,{type='text',max=6000}={}){const l=node('label',label),i=node(type==='textarea'?'textarea':'input');if(type!=='textarea')i.type=type;i.value=value;i.maxLength=max;i.addEventListener('input',()=>{changed(type==='number'?Number(i.value):i.value);persist();});l.append(i);return l;}
function select(label,value,rows,changed){const l=node('label',label),s=node('select');for(const [key,text] of rows){const o=node('option',text);o.value=key;s.append(o);}s.value=value;s.addEventListener('change',()=>{changed(s.value);redraw();});l.append(s);return l;}
function resetPicker(){
  $('card-search').value='';for(const field of pickerFields)$(`picker-${field}`).value='';
  selectedPickerTags.clear();renderPickerTags();$('picker-sort').value='rarity';pickerStats.reset();pickerPage=0;renderPicker();
}
function renderPickerTags(){
  const box=$('picker-tags');box.replaceChildren();
  for(const {name} of pickerTagsCloud?.state?.categories||[]){
    const label=node('label'),check=node('input');label.className='picker-tag-choice';check.type='checkbox';check.checked=selectedPickerTags.has(name);
    check.onchange=()=>{check.checked?selectedPickerTags.add(name):selectedPickerTags.delete(name);pickerPage=0;renderPicker();};
    label.append(check,node('span',name));box.append(label);
  }
  if(!box.children.length)box.append(node('p','도감에서 만든 태그가 여기에 표시돼.'));
}
async function refreshPickerTags(){
  $('refresh-picker-tags').disabled=true;
  try{
    if(!pickerTagsCloud)throw new Error('온라인 연결을 확인해줘.');
    await pickerTagsCloud.load();const names=new Set(pickerTagsCloud.state.categories.map(c=>c.name));
    for(const tag of selectedPickerTags)if(!names.has(tag))selectedPickerTags.delete(tag);
    renderPickerTags();pickerPage=0;renderPicker();$('picker-tag-status').textContent='여러 태그를 선택하면 모두 포함한 카드를 찾아. 검색창에도 태그 이름을 입력할 수 있어.';
  }catch{$('picker-tag-status').textContent='태그를 불러오지 못했어. 태그 새로 불러오기를 눌러줘.';}
  finally{$('refresh-picker-tags').disabled=false;}
}
function pickerOptions(){
  const eligible=cards.filter(filter),collator=new Intl.Collator('ko');
  for(const field of ['type','subtype','race','attribute']){
    const control=$(`picker-${field}`);control.replaceChildren(node('option','전체'));
    control.firstChild.value='';
    for(const value of [...new Set(eligible.map(c=>c[field]).filter(Boolean))].sort(collator.compare)){
      const option=node('option',value);option.value=value;control.append(option);
    }
  }
  for(const [field,rows] of [['mechanic',meta.card_system?.mechanics||[]],['group',meta.card_system?.groups||[]]]){
    const control=$(`picker-${field}`);control.replaceChildren(node('option','전체'));control.firstChild.value='';
    for(const row of rows){const option=node('option',row.name);option.value=row.id;control.append(option);}
  }
}
function picker(accept,purpose,done,selection=null){filter=accept;chooseCard=done;pickerSelection=selection;pickerOptions();resetPicker();$('picker-purpose').textContent=purpose;$('card-picker').showModal();$('card-search').focus();}
function renderPicker(){
  const criteria={query:$('card-search').value,sort:$('picker-sort').value,stats:pickerStats.values(),tags:[...selectedPickerTags]};
  for(const field of pickerFields)criteria[field]=$(`picker-${field}`).value;
  const found=pickerCards(cards,criteria,filter,pickerTagsCloud?.state),pages=Math.max(1,Math.ceil(found.length/12));pickerPage=Math.min(pickerPage,pages-1);
  const box=$('picker-results');box.replaceChildren();
  $('picker-empty').hidden=found.length!==0;
  for(const c of found.slice(pickerPage*12,(pickerPage+1)*12)){
    const selected=pickerSelection?.selected(c)===true,full=pickerSelection&&pickerSelection.count()>=(pickerSelection.limit||100);
    const b=button('',()=>{
      if(pickerSelection&&!pickerSelection.selected(c)&&pickerSelection.count()>=(pickerSelection.limit||100))return;
      const dialog=$('card-picker'),scroll=dialog.scrollTop;
      try{chooseCard(cardRef(c));}catch(e){$('picker-selection').textContent=e.message;return;}
      if(pickerSelection){redraw();renderPicker();dialog.scrollTop=scroll;const same=Array.from($('picker-results').children).find(el=>Number(el.dataset.cardSlot)===c.slot);(same||$('finish-picker')).focus({preventScroll:true});}
      else{dialog.close();redraw();}
    },'picker-card'),img=node('img'),label=node('span',c.name_ko);
    b.disabled=Boolean(full)&&!selected;b.classList.toggle('is-selected',selected);b.dataset.cardSlot=c.slot;if(pickerSelection)b.setAttribute('aria-pressed',String(selected));
    img.src=c.image;img.alt='';img.loading='lazy';label.append(node('small',[c.rarity,c.type,c.race||c.subtype,c.attribute,c.level==null?'':`LV ${c.level}`].filter(Boolean).join(' · ')));
    if(c.atk!=null)label.append(node('small',`ATK ${c.atk} / DEF ${c.def??'?'}`));
    const tags=annotationFor(pickerTagsCloud?.state,c)?.tags||[];if(tags.length)label.append(node('small',tags.map(tag=>'#'+tag).join(' · ')));
    if(selected){const badge=node('small','✓ 선택됨 · 다시 누르면 취소');badge.className='picker-selected';label.append(badge);}
    b.append(img,label);box.append(b);
  }
  $('picker-page').textContent=`${pickerPage+1} / ${pages} · ${found.length}장`;$('prev-cards').disabled=pickerPage===0;$('next-cards').disabled=pickerPage+1===pages;
  $('finish-picker').hidden=!pickerSelection;$('picker-selection').hidden=!pickerSelection;
  $('picker-selection').textContent=pickerSelection?`${pickerSelection.label||'후보'} ${pickerSelection.count()} / ${pickerSelection.limit||100}장 · 선택한 카드를 다시 누르면 취소돼.`:'';
}
function renderMedia(a,box){
  const panel=node('details');panel.className='media-settings';panel.open=openedMedia.has(a);panel.addEventListener('toggle',()=>{if(panel.isConnected){if(panel.open)openedMedia.add(a);else openedMedia.delete(a);}});panel.append(node('summary','캐릭터 컷신 · 음성'));
  const value=()=>a.presentation||defaultPresentation(a);
  const set=(change)=>{const v=structuredClone(value());change(v);a.presentation=parsePresentation(v);redraw();};
  const toggle=(label,key)=>{const l=node('label'),c=node('input');c.type='checkbox';c.checked=value()[key];c.onchange=()=>set(v=>v[key]=c.checked);l.append(c,node('span',label));return l;};
  panel.append(toggle('이 캐릭터의 외부 컷신·음성 사용','enabled'),toggle('상황별 이미지가 없으면 초상화 사용','portrait'),node('p','기본 캐릭터는 공용 컷신·음성을 사용해. 상황별 파일을 올리면 그 파일로 바꿀 수 있어. PNG·JPEG·WebP는 3MB, 음성은 12초 이하 PCM WAV로 올려줘.'));
  const rowFor=key=>value().events[key]||{image:'',audio:''};
  const change=(key,kind,url)=>{if(!safeMedia(url,kind))return status('프로젝트 에셋이나 이 도감의 이미지·음성 보관소 주소를 사용해줘.');set(v=>{v.events[key]={...rowFor(key),[kind]:url};});};
  const upload=(event,kind)=>{const file=node('input');file.type='file';file.accept=kind==='audio'?'.wav,audio/wav,audio/x-wav':'image/png,image/jpeg,image/webp';file.setAttribute('aria-label',`${MEDIA_EVENTS[event]} ${kind==='audio'?'음성':'이미지'} 업로드`);file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(!client||!editor)throw new Error('에셋 업로드는 이메일 로그인 후 사용해줘.');let ext,mime;if(kind==='audio'){await validateAudioFile(f);ext='wav';mime='audio/wav';}else{if(f.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(f.type))throw new Error('PNG·JPEG·WebP, 3MB 이하 이미지를 골라줘.');ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[f.type];mime=f.type;}const path=`media/${crypto.randomUUID()}.${ext}`,reply=await client.storage.from('poc-story-assets').upload(path,f,{contentType:mime,upsert:false});if(reply.error)throw reply.error;change(event,kind,client.storage.from('poc-story-assets').getPublicUrl(path).data.publicUrl);}catch(e){status(e.message);}finally{file.value='';}};return file;};
  for(const [key,label] of Object.entries(MEDIA_EVENTS)){
    const row=node('details');row.className='media-event';row.open=openedMediaEvents.get(a)?.has(key)||false;row.addEventListener('toggle',()=>{if(!row.isConnected)return;if(!openedMediaEvents.has(a))openedMediaEvents.set(a,new Set());const opened=openedMediaEvents.get(a);if(row.open)opened.add(key);else opened.delete(key);});row.append(node('summary',`${label}${rowFor(key).image?' · 이미지':''}${rowFor(key).audio?' · 음성':''}`));
    for(const [kind,title] of [['image','이미지'],['audio','음성']]){row.append(input(`${label} ${title} 주소`,rowFor(key)[kind],v=>change(key,kind,v),{max:1000}),upload(key,kind));}
    row.append(button(`${label} 미리보기`,()=>{const v=rowFor(key),dialog=node('dialog');dialog.className='media-preview';dialog.setAttribute('aria-label',`${a.name} ${label} 미리보기`);dialog.append(node('h2',`${a.name} · ${label}`));const image=v.image||(value().portrait?a.portrait:'');if(image){const im=node('img');im.src=image;im.alt=`${a.name} ${label} 컷인`;dialog.append(im);}else dialog.append(node('p','등록한 이미지가 없어.'));if(v.audio){const sound=node('audio');sound.src=v.audio;sound.controls=true;sound.preload='metadata';dialog.append(sound);}else dialog.append(node('p','등록한 음성이 없어.'));dialog.append(button('닫기',()=>dialog.close()));dialog.addEventListener('close',()=>{dialog.querySelector('audio')?.pause();dialog.remove();});document.body.append(dialog);dialog.showModal();}));panel.append(row);
  }
  panel.append(button('컷신·음성 JSON 내보내기',()=>download('character-media.json',JSON.stringify({schema_version:1,kind:'poc-character-media',name:a.name,presentation:value()},null,2))));
  const json=node('input');json.type='file';json.accept='.json,application/json';json.setAttribute('aria-label','컷신·음성 JSON 불러오기');json.onchange=async()=>{try{const f=json.files[0];if(!f)return;if(f.size>32000)throw new Error('에셋 설정 JSON은 32KB 이하로 골라줘.');const v=JSON.parse(await f.text());if(v.schema_version!==1||v.kind!=='poc-character-media')throw new Error('컷신·음성 JSON을 골라줘.');a.presentation=parsePresentation(v.presentation);redraw();}catch(e){status(e.message);}finally{json.value='';}};panel.append(json);box.append(panel);
}
function renderSkillSet(profile,box){
  for(const [kind,label] of Object.entries(SKILLS)){
    const row=node('div');row.className='skill-row';const l=node('label'),toggle=node('input');toggle.type='checkbox';toggle.checked=profile.skills.some(s=>s.kind===kind);l.append(toggle,node('span',label));row.append(l);
    const accept=c=>!c.special&&c.type!=='융합 몬스터'&&(kind!=='start_field'||['마법','함정'].includes(c.type))&&(kind!=='start_monster'||c.type.includes('몬스터'));
    const gravePicker=skill=>{let current=skill;picker(accept,'시작 묘지 카드 · 여러 장을 고른 뒤 선택 완료',card=>{if(!current){current={kind,entries:[]};profile.skills.push(current);}const index=current.entries.findIndex(e=>e.card.slot===card.slot);if(index>=0)current.entries.splice(index,1);else current.entries.push({card,count:1});if(!current.entries.length){profile.skills=profile.skills.filter(s=>s!==current);current=null;}},{selected:c=>current?.entries.some(e=>e.card.slot===c.slot)===true,count:()=>current?.entries.reduce((n,e)=>n+e.count,0)||0,limit:12,label:'묘지 합계'});};
    toggle.onchange=()=>{profile.skills=profile.skills.filter(s=>s.kind!==kind);if(toggle.checked){const bounds=NUMERIC_SKILLS[kind];if(kind==='start_grave')gravePicker();else if(kind==='parasite_deck'){profile.skills.push({kind});redraw();}else if(bounds){profile.skills.push({kind,value:bounds[2],...(kind==='draw_once'?{threshold:2000}:{})});redraw();}else picker(accept,label,card=>profile.skills.push({kind,card,...(kind==='start_monster'?{position:'attack'}:{})}));}else redraw();};
    const skill=profile.skills.find(s=>s.kind===kind);
    if(skill){if(kind==='start_grave'){
        const total=node('small'),updateTotal=()=>{total.textContent=`묘지 합계 ${skill.entries.reduce((n,e)=>n+e.count,0)} / 12장 · 덱 장수는 유지되고 특성으로 별도 추가돼.`;};
        for(const entry of skill.entries){const line=node('div');line.className='reward-row grave-entry';line.append(node('span',entry.card.name_ko));const count=input('묘지에 둘 장수',entry.count,v=>{entry.count=v;updateTotal();check();},{type:'number'});count.lastChild.min=1;count.lastChild.max=12;line.append(count,button('제거',()=>{skill.entries=skill.entries.filter(e=>e!==entry);if(!skill.entries.length)profile.skills=profile.skills.filter(s=>s!==skill);redraw();},'remove-button'));row.append(line);}
        updateTotal();row.append(button('+ 묘지 카드 추가',()=>gravePicker(skill)),total);
      }else if(kind==='parasite_deck')row.append(node('small','상대 덱의 무작위 위치에 앞면 기생충 1장을 넣어. 뽑으면 수비 표시로 특수 소환되고 1,000 데미지와 곤충족 변경 효과가 적용돼.'));
      else if(skill.card)row.append(button(skill.card.name_ko+' · 바꾸기',()=>picker(accept,label,card=>skill.card=card)));else{const bounds=NUMERIC_SKILLS[kind],field=input(bounds[3],skill.value,v=>skill.value=v,{type:'number'});field.lastChild.min=bounds[0];field.lastChild.max=bounds[1];row.append(field);}
      if(kind==='start_monster')row.append(select('시작 몬스터의 표시 형식',skill.position,[['attack','앞면 공격 표시'],['defense','앞면 수비 표시'],['set','뒷면 수비 표시']],v=>skill.position=v));
      if(kind==='draw_once'){const threshold=input('내 LP가 이 값 이하일 때',skill.threshold,v=>skill.threshold=v,{type:'number'});threshold.lastChild.min=100;threshold.lastChild.max=16000;row.append(threshold);}}
    const hints={opening_draw:'기본 시작 패에 덱 위에서 1~3장을 더 뽑아. 지정 카드 추가와 함께 쓸 수 있어.',draw_once:'상대의 메인 페이즈에 조건을 만족하면 한 번만 덱에서 뽑아.',heal_once:'회복량만큼 LP가 줄어든 뒤 상대 메인 페이즈에 한 번 회복해.',add_hand_once:'상대 메인 페이즈에 패가 3장 이하이면 지정 카드를 한 번 받아.',start_field:'필드·지속 마법은 앞면, 다른 마법·함정은 세트 상태로 시작해.'};if(hints[kind])row.append(node('small',hints[kind]));box.append(row);
  }
}
function renderProfiles(a,box){
  const selected=a._editingProfile||'',profiles=skillSets(a),profile=profiles.find(p=>p.profile_id===selected)||profiles[0];
  // The default profile is a view; assign its array back after editing.
  const target=profile.profile_id?profile:a;
  box.append(select('편집할 특성 묶음 · 난이도별로 이름을 붙여줘',profile.profile_id,profiles.map(p=>[p.profile_id,p.name]),v=>{Object.defineProperty(a,'_editingProfile',{value:v,writable:true,configurable:true,enumerable:false});}));
  const tools=node('div');tools.className='row-actions';
  tools.append(button('+ 특성 묶음 추가',()=>{try{const p=copyProfile(a,'새 난이도 특성',target.skills);Object.defineProperty(a,'_editingProfile',{value:p.profile_id,writable:true,configurable:true,enumerable:false});redraw();}catch(e){status(e.message);}}),button('특성 JSON 내보내기',()=>{try{parseSkills(target.skills);download('skill-preset.json',JSON.stringify(profilePacket(a,{name:profile.name,skills:target.skills}),null,2));}catch(e){status(e.message);}}));
  const file=node('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
  file.onchange=async()=>{try{const f=file.files[0];if(!f)return;if(f.size>100000)throw new Error('특성 JSON은 100KB 이하로 골라줘.');const p=parsePreset(JSON.parse(await f.text()));const clean=canonicalStory({...emptyStory(),actors:[{...newActor('preset-check'),skills:p.skills}]},meta,cards).actors[0].skills;const next=copyProfile(a,p.name,clean);Object.defineProperty(a,'_editingProfile',{value:next.profile_id,writable:true,configurable:true,enumerable:false});redraw();}catch(e){status(e.message);}finally{file.value='';}};
  tools.append(button('특성 JSON 불러오기',()=>file.click()),file);box.append(tools);
  const reuse=node('select');reuse.setAttribute('aria-label','가져올 캐릭터 특성');const sources=doc.actors.flatMap(actor=>skillSets(actor).map(p=>({actor,profile:p})));
  sources.forEach(({actor,profile},i)=>{const o=node('option',`${actor.name} · ${profile.name}`);o.value=i;reuse.append(o);});
  const reuseTools=node('div');reuseTools.className='row-actions';reuseTools.append(reuse,button('선택한 특성 가져오기',()=>{try{const source=sources[Number(reuse.value)];const next=copyProfile(a,source.profile.name,source.profile.skills);Object.defineProperty(a,'_editingProfile',{value:next.profile_id,writable:true,configurable:true,enumerable:false});redraw();}catch(e){status(e.message);}}));box.append(reuseTools);
  if(profile.profile_id)box.append(input('특성 이름 · 예: 초급 / 중급 / 보스',profile.name,v=>profile.name=v,{max:100}),button('이 특성 삭제',()=>{try{removeProfile(doc,a,profile.profile_id);a._editingProfile='';redraw();}catch(e){status(e.message);}},'remove-button'));
  box.append(node('p','이 캐릭터 온라인 저장으로 기본 특성과 묶음을 함께 저장해. 시나리오 전투에서는 저장된 묶음 중 하나를 선택해.'));renderSkillSet(target,box);
}

$('close-picker').onclick=()=>$('card-picker').close();$('finish-picker').onclick=()=>$('card-picker').close();
$('card-picker').addEventListener('close',()=>{pickerSelection=null;render();});$('card-search').oninput=()=>{pickerPage=0;renderPicker();};
$('prev-cards').onclick=()=>{pickerPage--;renderPicker();};$('next-cards').onclick=()=>{pickerPage++;renderPicker();};
for(const field of [...pickerFields,'sort'])$(`picker-${field}`).onchange=()=>{pickerPage=0;renderPicker();};
$('reset-picker').onclick=resetPicker;$('refresh-picker-tags').onclick=refreshPickerTags;
return {render(a,box){sync();renderMedia(a,box);renderProfiles(a,box);},refreshTags(){sync();return refreshPickerTags();},button,input,node};
}
