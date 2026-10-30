// One DB configuration. Unsubmitted form values live only in this page's memory.
export const MAP_FIELDS052=Object.freeze([
  {key:'battle_percent',label:'전투'},
  {key:'event_percent',label:'이벤트'},
  {key:'shop_percent',label:'상점'},
  {key:'rest_percent',label:'휴식'},
  {key:'elite_percent',label:'엘리트 전투'}
]);
const KEYS052=['schema',...MAP_FIELDS052.map(row=>row.key)],clone=structuredClone;
const signature=value=>JSON.stringify(value),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function need(value,message){if(!value)throw Error(message);}
export function parseMapRules052(value){
  need(object(value)&&Object.keys(value).length===KEYS052.length&&KEYS052.every(key=>Object.hasOwn(value,key))&&value.schema===1,'맵 분포 자료의 형식을 확인해 주세요.');
  const config={schema:1};for(const {key} of MAP_FIELDS052){need(Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<=100,'맵 분포는 0~100 사이의 정수로 설정해 주세요.');config[key]=value[key];}
  need(MAP_FIELDS052.slice(0,4).reduce((sum,{key})=>sum+config[key],0)===100,'전투·이벤트·상점·휴식의 합계는 100%여야 합니다.');
  return config;
}
export function parseMapPatch052(value){
  need(object(value)&&Object.keys(value).length===MAP_FIELDS052.length&&MAP_FIELDS052.every(({key})=>Object.hasOwn(value,key)),'맵 분포의 다섯 비율을 함께 저장해 주세요.');
  const {schema,...percentages}=parseMapRules052({schema:1,...value});return percentages;
}
export function validateMapDraft052(raw){
  const errors={},config={schema:1};
  for(const {key} of MAP_FIELDS052){const text=String(raw?.[key]??'').trim();if(!/^\d{1,3}$/.test(text)||Number(text)>100)errors[key]='0~100 사이의 정수를 입력해 주세요.';else config[key]=Number(text);}
  const total=MAP_FIELDS052.slice(0,4).every(({key})=>config[key]!==undefined)?MAP_FIELDS052.slice(0,4).reduce((sum,{key})=>sum+config[key],0):null;
  const message=Object.keys(errors).length?'각 비율에 0~100 사이의 정수를 입력해 주세요.':total!==100?`합계가 ${total}%입니다. 전투·이벤트·상점·휴식을 합쳐 100%로 맞춰 주세요.`:'';
  return {valid:!message,total,errors,message,config:message?null:config};
}
const rawFrom=config=>Object.fromEntries(MAP_FIELDS052.map(({key})=>[key,String(config[key])]));
export function createMapDraft052(){
  let owner=null,saved=null,base=null,raw=null,revision=0,submitted=null,saving=false,conflict=false,context={};
  const same=(a,b)=>a&&b&&signature(a)===signature(b);
  const dirty=()=>!!raw&&(!validateMapDraft052(raw).valid||!same(validateMapDraft052(raw).config,base));
  function reset(){if(!saved)return;raw=rawFrom(saved);base=clone(saved);conflict=false;}
  return {
    sync(next){
      context=next;if(owner!==next.owner){owner=next.owner;saved=base=raw=submitted=null;saving=conflict=false;}
      if(!next.config)return;
      const value=parseMapRules052(next.config),changed=saved&&!same(saved,value);saved=value;revision=next.revision??0;
      if(!raw){reset();}
      else if(submitted&&same(submitted,value)){base=clone(value);submitted=null;saving=false;conflict=false;}
      else if(changed){if(dirty())conflict=true;else reset();}
      if(next.pending&&['invalid','error'].includes(next.phase))saving=false;
      if(next.pending&&next.phase==='conflict'){saving=false;conflict=true;}
    },
    edit(key,value){need(MAP_FIELDS052.some(row=>row.key===key),'편집할 비율을 확인해 주세요.');need(raw,'저장된 맵 분포를 먼저 불러와 주세요.');raw[key]=String(value);},
    reset,
    begin(){const state=this.snapshot();need(state.canSave,'합계와 저장 상태를 확인한 뒤 다시 저장해 주세요.');submitted=clone(state.validation.config);saving=true;return clone(submitted);},
    settled(result){saving=false;if(result?.discarded){submitted=null;conflict=true;}},
    failed(){saving=false;submitted=null;},
    snapshot(){const validation=validateMapDraft052(raw),hasChanges=dirty(),blocked=context.pending&&!['invalid','error'].includes(context.phase);return {saved:clone(saved),raw:clone(raw),revision,validation,dirty:hasChanges,saving,conflict,pending:context.pending===true,
      canSave:!!saved&&context.canWrite===true&&validation.valid&&hasChanges&&!saving&&!conflict&&!blocked};}
  };
}

export function createMapPanel052({document:doc,getState,onSave,onError=()=>{},bindControl=()=>{}}){
  const draft=createMapDraft052();let view=null;
  function el(tag,text,cls){const node=doc.createElement(tag);if(text!=null)node.textContent=String(text);if(cls)node.className=cls;return node;}
  function latest(){const state=getState();draft.sync(state);return state;}
  function feedback(){
    if(!view?.root.isConnected)return;const state=draft.snapshot(),composing=view.composing.size>0;
    for(const {key} of MAP_FIELDS052){const invalid=state.validation.errors[key]??'';view.errors[key].textContent=composing?'':invalid;view.inputs[key].setAttribute('aria-invalid',String(!composing&&!!invalid));}
    for(const {key} of MAP_FIELDS052.slice(0,4))view.savedValues[key].textContent=`${state.saved[key]}%`;view.savedElite.textContent=`합계 100% · 전투 칸 중 엘리트 ${state.saved.elite_percent}%`;
    view.total.textContent=composing?'숫자를 입력하고 있습니다.':state.validation.total===null?'편집 중 합계 —':`편집 중 합계 ${state.validation.total}%`;
    const server=getState();let message=state.dirty?'편집 중인 값은 아직 저장되지 않았습니다.':'저장된 분포와 같습니다.';
    if(composing)message='';
    if(state.saving||state.pending&&!['invalid','error'].includes(server.phase))message='DB에 저장 중입니다. 아래 입력은 계속 편집할 수 있습니다.';
    if(server.pending&&['invalid','error'].includes(server.phase))message='아직 저장되지 않았습니다. 입력을 확인한 뒤 다시 저장해 주세요.';
    if(state.conflict)message=server.pending&&server.phase==='conflict'?'상단 저장 충돌 안내에서 사용할 값을 먼저 골라 주세요.':'다른 창에서 저장된 맵 분포가 바뀌었습니다. 저장값을 불러온 뒤 다시 편집해 주세요.';
    view.message.textContent=message;
    if(!composing&&state.validation.message&&!state.conflict)view.message.textContent=state.validation.message;
    view.save.textContent=state.saving?'분포 저장 중…':'분포 저장';view.save.disabled=!state.canSave||composing;view.reload.disabled=state.pending||state.saving||!state.dirty&&!state.conflict;
  }
  return {
    render(host){
      const state=latest(),snapshot=draft.snapshot();view=null;
      if(!snapshot.saved){host.append(el('p','맵 설정을 불러오는 중입니다. 잠시 후 화면을 새로고침해 주세요.','au-empty'));return;}
      const saved=el('section',null,'au-panel');saved.append(el('h2','현재 저장된 분포'));const summary=el('div',null,'au-form-grid'),savedValues={};
      for(const {key,label} of MAP_FIELDS052.slice(0,4)){const row=el('div',null,'au-field'),number=el('strong',`${snapshot.saved[key]}%`);row.append(el('span',label),number);summary.append(row);savedValues[key]=number;}
      const savedElite=el('p',`합계 100% · 전투 칸 중 엘리트 ${snapshot.saved.elite_percent}%`,'au-entity-status');saved.append(summary,savedElite);host.append(saved);
      if(!state.canWrite){host.append(el('p',state.canEdit?'맵 편집 자료를 불러오는 중입니다. 화면을 새로고침해 주세요.':'편집 계정으로 로그인하면 분포를 바꿀 수 있습니다.','au-hint'));return;}
      const root=el('section',null,'au-panel'),grid=el('div',null,'au-form-grid'),inputs={},errors={},composing=new Set();root.append(el('h2','분포 편집'),el('p','네 비율의 합계를 100%로 맞춘 뒤 저장해 주세요. 엘리트 비율은 이 합계에 포함하지 않습니다.','au-hint'));
      for(const {key,label} of MAP_FIELDS052){
        const wrap=el('label',null,'au-field'),input=el('input'),error=el('small',null,'au-field-error');input.type='text';input.inputMode='numeric';input.pattern='[0-9]*';input.maxLength=3;input.autocomplete='off';input.value=snapshot.raw[key];input.dataset.editKey=`map052.${key}`;input.setAttribute('aria-label',`${label} (%)`);
        const changed=()=>{if(!input.isConnected)return;draft.edit(key,input.value);feedback();};input.addEventListener('input',changed);input.addEventListener('compositionstart',()=>{composing.add(input);feedback();});input.addEventListener('compositionend',()=>{composing.delete(input);changed();});bindControl(input);
        wrap.append(el('span',`${label} (%)`),input,error);grid.append(wrap);inputs[key]=input;errors[key]=error;
      }
      const total=el('output',null,'au-entity-status'),message=el('p',null,'au-hint'),actions=el('div',null,'au-toolbar'),save=el('button','분포 저장','au-primary'),reload=el('button','저장값 불러오기');total.setAttribute('aria-live','polite');message.setAttribute('role','status');save.type=reload.type='button';
      save.onclick=()=>{try{latest();const {schema,...percentages}=draft.begin();feedback();Promise.resolve(onSave(percentages)).then(result=>{draft.settled(result);feedback();}).catch(error=>{draft.failed();feedback();onError(error);});}catch(error){feedback();onError(error);}};
      reload.onclick=()=>{latest();draft.reset();const fresh=draft.snapshot();for(const {key} of MAP_FIELDS052)inputs[key].value=fresh.raw[key];feedback();};
      actions.append(save,reload);root.append(grid,total,message,actions);host.append(root);view={root,inputs,errors,total,message,save,reload,composing,savedValues,savedElite};feedback();
    },
    destroy(){view=null;}
  };
}
