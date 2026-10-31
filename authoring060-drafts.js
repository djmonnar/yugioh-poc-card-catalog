// Uncommitted edits only. The existing store owns every RPC, CAS and outbox retry.
const clone=value=>structuredClone(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const forbidden=new Set(['__proto__','prototype','constructor']);
const validNumber=value=>Number.isSafeInteger(value)&&value>=0;
function same(a,b){
  if(a===b)return true;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>same(value,b[index]));
  if(object(a)&&object(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>own(b,key)&&same(a[key],b[key]));}
  return false;
}
const need=(ok,message)=>{if(!ok)throw new Error(message);};
const idValid=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f\u007f]/.test(value);
const kindValid=value=>typeof value==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(value);
const bytes=value=>new TextEncoder().encode(value).byteLength;
function safe(value,depth=0){
  need(depth<32,'초안의 항목이 너무 깊게 중첩되어 있습니다.');
  if(Array.isArray(value)){need(value.length<=20000,'초안의 항목 수를 확인해 주세요.');for(const item of value)safe(item,depth+1);return;}
  if(object(value)){need([Object.prototype,null].includes(Object.getPrototypeOf(value)),'초안의 데이터 형식을 확인해 주세요.');const keys=Object.keys(value);need(keys.length<=1000,'초안의 필드 수를 확인해 주세요.');for(const key of keys){need(!forbidden.has(key),'허용되지 않은 초안 필드입니다.');safe(value[key],depth+1);}return;}
  need(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value),'초안에는 JSON 값만 넣을 수 있습니다.');
}
function copyField(target,key,source){if(own(source,key))target[key]=clone(source[key]);else delete target[key];}
export const draftKey060=(type,id)=>JSON.stringify([type,id]);

export class AuthoringDrafts060 {
  constructor({onSave,onChange=()=>{},storage=null,allowedKinds=['deck'],storagePrefix='poc-authoring060-drafts',maxItems=500,maxBytes=2000000}={}){
    need(typeof onSave==='function','초안을 저장할 연결이 필요합니다.');need(typeof onChange==='function','초안 변경 연결을 확인해 주세요.');
    this.allowedKinds=new Set(allowedKinds);need(this.allowedKinds.size>0&&[...this.allowedKinds].every(kindValid),'초안 종류를 확인해 주세요.');
    need(typeof storagePrefix==='string'&&/^[A-Za-z0-9:_.-]{1,100}$/.test(storagePrefix),'초안 보관 키를 확인해 주세요.');
    need(Number.isSafeInteger(maxItems)&&maxItems>0&&maxItems<=1000&&Number.isSafeInteger(maxBytes)&&maxBytes>=1024&&maxBytes<=8000000,'초안 보관 한도를 확인해 주세요.');
    Object.assign(this,{onSave,onChange,storage,storagePrefix,maxItems,maxBytes});this.owner=null;this.state=null;this.banks=new Map();
  }
  key(type,id){return draftKey060(type,id);}
  storageKey(owner=this.owner){return owner?`${this.storagePrefix}:${encodeURIComponent(owner)}`:null;}
  _bank(owner=this.owner){return owner?this.banks.get(owner):null;}
  _emit(owner=this.owner){if(owner===this.owner)this.onChange(this.summary());}
  _check(type,id){need(this.allowedKinds.has(type)&&idValid(id),'편집할 초안 항목을 확인해 주세요.');}
  _fields(fields){need(object(fields),'초안 필드를 확인해 주세요.');safe(fields);return clone(fields);}
  _load(owner){
    const bank={records:new Map(),latest:new Map(),canonicalReady:false,task:null,error:null,storageError:null,storageBlocked:false};
    this.banks.set(owner,bank);let raw;
    try{
      raw=this.storage?.getItem(this.storageKey(owner));if(!raw)return bank;
      need(typeof raw==='string'&&bytes(raw)<=this.maxBytes,'초안 보관 한도');const data=JSON.parse(raw);safe(data);
      need(data.schema===1&&data.owner===owner&&Array.isArray(data.items)&&data.items.length<=this.maxItems,'초안 계정 또는 형식');
      const restored=new Map();
      for(const row of data.items){
        this._check(row.type,row.id);need(['patch','create'].includes(row.operation)&&validNumber(row.baseVersion)&&object(row.baseContent)&&object(row.fields),'초안 내용');
        const key=this.key(row.type,row.id);need(!restored.has(key),'중복 초안');
        let submitted=null;if(row.submitted){need(object(row.submitted)&&['patch','create'].includes(row.submitted.operation)&&object(row.submitted.fields)&&Object.keys(row.submitted.fields).length>0&&validNumber(row.submitted.baseVersion)&&object(row.submitted.baseContent),'저장 확인 중인 초안');submitted={operation:row.submitted.operation,fields:clone(row.submitted.fields),baseVersion:row.submitted.baseVersion,baseContent:clone(row.submitted.baseContent),uncertain:true};}
        restored.set(key,{type:row.type,id:row.id,operation:row.operation,baseVersion:row.baseVersion,baseContent:clone(row.baseContent),fields:clone(row.fields),submitted,history:[]});
      }
      bank.records=restored;
    }catch{bank.storageBlocked=true;bank.storageError='이전에 보관한 초안을 읽지 못했습니다. 원본은 유지되며 새 수정은 이 창에서 보관합니다.';}
    return bank;
  }
  _persist(owner=this.owner){
    const bank=this._bank(owner);if(!bank||!this.storage||bank.storageBlocked)return;
    try{
      const items=[...bank.records.values()].map(({type,id,operation,baseVersion,baseContent,fields,submitted})=>({type,id,operation,baseVersion,baseContent,fields,submitted:submitted?{operation:submitted.operation,fields:submitted.fields,baseVersion:submitted.baseVersion,baseContent:submitted.baseContent}:null}));
      const text=JSON.stringify({schema:1,owner,items});need(bytes(text)<=this.maxBytes,'보관 한도');
      if(items.length)this.storage.setItem(this.storageKey(owner),text);else this.storage.removeItem?.(this.storageKey(owner));bank.storageError=null;
    }catch{bank.storageError='이 기기에 초안을 보관하지 못했습니다. 저장이 끝날 때까지 이 창을 유지해 주세요.';}
  }
  _row(bank,record){return bank.latest.get(this.key(record.type,record.id))??null;}
  _desired(record,row){return {...clone(row?.content??record.baseContent),...clone(record.submitted?.fields??{}),...clone(record.fields)};}
  _conflicts(record,row){
    if(record.submitted)return [];
    if(record.operation==='create'||!row)return [];
    return Object.keys(record.fields).filter(field=>!same(row.content[field],record.baseContent[field])&&!same(row.content[field],record.fields[field]));
  }
  _structural(bank,record,row){
    if(!bank.canonicalReady)return 'DB의 최신 자료를 불러온 뒤 저장해 주세요.';
    if(record.operation==='create'&&row&&!record.submitted)return '같은 ID의 항목이 DB에 있습니다. 새 초안을 취소하고 기존 항목을 선택해 주세요.';
    if(record.operation==='patch'&&!row)return '이 항목이 DB에서 삭제되었습니다. 초안은 유지되며 자동으로 다시 만들지 않습니다.';
    return null;
  }
  _finish(owner,record,submitted,row=null){
    const bank=this._bank(owner),key=this.key(record.type,record.id);if(!bank||bank.records.get(key)!==record||record.submitted!==submitted)return;
    const oldBase=clone(record.baseContent);if(row&&validNumber(row.version)&&object(row.content)){const latest=bank.latest.get(key);if(!latest||row.version>=latest.version)bank.latest.set(key,clone(row));}
    const current=this._row(bank,record),basis=current?.content??row?.content??{...record.baseContent,...submitted.fields};record.baseContent=clone(basis);record.baseVersion=current?.version??row?.version??record.baseVersion;
    for(const field of Object.keys(record.fields)){
      if(!own(submitted.fields,field))copyField(record.baseContent,field,oldBase);
      else copyField(record.baseContent,field,row?.content??submitted.fields);
    }
    record.operation='patch';record.submitted=null;record.history=[];bank.error=null;
    this._clean(bank,record);this._persist(owner);
  }
  _clean(bank,record){
    const key=this.key(record.type,record.id),row=this._row(bank,record);if(record.submitted)return;
    if(record.operation==='patch'&&row){for(const field of Object.keys(record.fields))if(same(record.fields[field],row.content[field]))delete record.fields[field];if(!this._conflicts(record,row).length){record.baseVersion=row.version;record.baseContent=clone(row.content);}}
    if(record.operation==='patch'&&!Object.keys(record.fields).length)bank.records.delete(key);
  }
  observe(state){
    need(object(state),'제작 자료를 확인할 수 없습니다.');const nextOwner=state.user?.id??null;need(nextOwner===null||idValid(nextOwner),'편집 계정을 확인해 주세요.');
    if(nextOwner!==this.owner){const previous=this._bank();if(previous?.task)previous.task.leaveOwner();this._persist();this.owner=nextOwner;if(nextOwner&&!this.banks.has(nextOwner))this._load(nextOwner);}
    this.state=state;const bank=this._bank();if(!bank)return this.summary();
    const rows=state.bootstrap?.authoring?.entities;if(Array.isArray(rows)){bank.latest=new Map(rows.filter(row=>row&&!row.deleted&&kindValid(row.entity_type)&&idValid(row.entity_id)&&validNumber(row.version)&&object(row.content)).map(row=>[this.key(row.entity_type,row.entity_id),clone(row)]));bank.canonicalReady=true;}
    for(const record of [...bank.records.values()]){const row=this._row(bank,record),submitted=record.submitted;if(submitted&&row&&Object.keys(submitted.fields).every(field=>same(row.content[field],submitted.fields[field])))this._finish(this.owner,record,submitted,row);else this._clean(bank,record);}
    this._persist();return this.summary();
  }
  stage(type,id,fields,{operation='patch'}={}){
    this._check(type,id);need(this.owner&&this.state?.canEdit,'편집 계정으로 로그인해 주세요.');need(['patch','create'].includes(operation),'초안 작업을 확인해 주세요.');const next=this._fields(fields),bank=this._bank(),key=this.key(type,id),row=bank.latest.get(key);let record=bank.records.get(key);
    need(operation==='create'||record?.operation==='create'||row,'수정할 DB 항목이 없습니다.');need(record||bank.records.size<this.maxItems,'보관할 수 있는 초안 수를 초과했습니다.');
    if(!record){record={type,id,operation,baseVersion:row?.version??0,baseContent:clone(row?.content??{}),fields:{},submitted:null,history:[null]};bank.records.set(key,record);}else{need(operation!=='create'||record.operation==='create','기존 항목 위에 새 항목을 만들 수 없습니다.');record.history.push(clone(record.fields));if(record.history.length>30)record.history.shift();}
    for(const [field,value] of Object.entries(next)){
      if(!own(record.fields,field)&&record.operation==='patch'&&(!record.submitted||!own(record.submitted.fields,field)))copyField(record.baseContent,field,row.content);
      const anchor=record.submitted&&own(record.submitted.fields,field)?record.submitted.fields[field]:record.baseContent[field];
      if(record.operation==='patch'||record.submitted){if(same(value,anchor))delete record.fields[field];else record.fields[field]=clone(value);}else record.fields[field]=clone(value);
    }
    this._clean(bank,record);if(![...bank.records.values()].some(item=>item.submitted))bank.error=null;this._persist();this._emit();return {staged:true,entityType:type,entityId:id,key};
  }
  overlay(state=this.state){
    if(!state)return state;const bank=this._bank();if(!bank||state.user?.id!==this.owner||!state.canEdit)return {...state};const entities=(state.entities??state.bootstrap?.authoring?.entities??[]).map(row=>clone(row));
    for(const record of bank.records.values()){
      if(!this.allowedKinds.has(record.type))continue;const key=this.key(record.type,record.id),index=entities.findIndex(row=>this.key(row.entity_type,row.entity_id)===key),canonical=bank.latest.get(key),base=index>=0?entities[index]:canonical??{entity_type:record.type,entity_id:record.id,version:record.baseVersion,state:'draft',issues:[],content:clone(record.baseContent)};
      const row={...base,content:{...clone(base.content),...clone(record.submitted?.fields??{}),...clone(record.fields)},localDraft060:true,manualPending060:Boolean(record.submitted)};if(index>=0)entities[index]=row;else entities.push(row);
    }
    return {...state,entities};
  }
  _keys(keys,bank){if(keys==null)return [...bank.records.keys()];need(Array.isArray(keys)||keys instanceof Set,'저장할 초안 범위를 확인해 주세요.');const selected=new Set();for(const value of keys){let key;if(typeof value==='string')key=value;else{need(object(value),'초안 항목을 확인해 주세요.');this._check(value.type??value.kind,value.id);key=this.key(value.type??value.kind,value.id);}if(bank.records.has(key))selected.add(key);}return [...bank.records.keys()].filter(key=>selected.has(key));}
  _blocked(bank=this._bank()){
    if(!this.owner||!this.state?.canEdit)return '편집 계정으로 로그인해 주세요.';
    if(this.state.pending>0)return '기존 저장 요청이 끝난 뒤 초안을 저장해 주세요. 대기 중인 요청은 그대로 유지됩니다.';
    if(['error','conflict','invalid','loading'].includes(this.state.phase)||this.state.error)return '먼저 기존 저장 오류나 DB 연결을 확인해 주세요.';
    if([...bank.records.values()].some(record=>record.submitted))return '이전 저장 결과를 확인하고 있습니다. 같은 요청의 확인이 끝난 뒤 저장해 주세요.';
    return null;
  }
  summary({keys=null}={}){
    const bank=this._bank();if(!bank)return {dirtyCount:0,saving:false,submittedCount:0,blockedReason:'편집 계정으로 로그인해 주세요.',error:null,storageError:null,items:[]};
    const items=this._keys(keys,bank).map(key=>bank.records.get(key)).map(record=>{const row=this._row(bank,record),conflicts=this._conflicts(record,row),structuralConflict=this._structural(bank,record,row);return {key:this.key(record.type,record.id),type:record.type,id:record.id,operation:record.operation,baseVersion:record.baseVersion,fields:clone(record.fields),submitted:record.submitted?{operation:record.submitted.operation,fields:clone(record.submitted.fields),uncertain:record.submitted.uncertain===true}:null,content:this._desired(record,row),conflicts,structuralConflict,dirty:record.operation==='create'&&!record.submitted||Object.keys(record.fields).length>0};});
    const blockedReason=this._blocked(bank)||items.find(item=>item.structuralConflict)?.structuralConflict||(items.some(item=>item.conflicts.length)?'DB에서 같은 필드가 바뀌었습니다. 초안을 유지할지 DB 내용을 사용할지 선택해 주세요.':null);
    return {dirtyCount:items.filter(item=>item.dirty).length,saving:Boolean(bank.task)||items.some(item=>item.submitted),submittedCount:items.filter(item=>item.submitted).length,blockedReason,error:bank.error,storageError:bank.storageError,items};
  }
  _restoreSent(owner,record,submitted,message){
    const bank=this._bank(owner),key=this.key(record.type,record.id);if(!bank||bank.records.get(key)!==record||record.submitted!==submitted)return;record.fields={...clone(submitted.fields),...record.fields};record.operation=submitted.operation;record.submitted=null;record.baseContent=clone(submitted.baseContent);record.baseVersion=submitted.baseVersion;bank.error=message;this._clean(bank,record);this._persist(owner);this._emit(owner);
  }
  _ack(owner,record,submitted,result){
    const bank=this._bank(owner);if(!bank)return result;
    if(result?.discarded){this._restoreSent(owner,record,submitted,'저장 대기 요청은 취소됐으며 로컬 초안은 유지됩니다.');return result;}
    need(result?.kind==='unified039-write-ack'||result?.kind==='already-current'&&result.alreadyCurrent===true,'저장 결과를 확인하지 못했습니다. 기존 요청을 먼저 확인해 주세요.');
    if(result?.kind==='already-current')need(result.entityType===record.type&&result.entityId===record.id,'저장 확인 항목이 초안과 다릅니다. 기존 요청을 먼저 확인해 주세요.');
    const row=result?.alreadyCurrent===true?result.entity:(result?.entities??[]).find(item=>item.entity_type===record.type&&item.entity_id===record.id&&!item.deleted);
    this._finish(owner,record,submitted,row??null);bank.error=null;this._emit(owner);return result;
  }
  saveAll({keys=null}={}){
    const bank=this._bank();need(bank,'편집 계정으로 로그인해 주세요.');if(bank.task)return bank.task.promise;
    const selected=this._keys(keys,bank);if(!selected.length)return Promise.resolve({saved:0,alreadyCurrent:0});need(!this._blocked(bank),this._blocked(bank));
    const plans=[];let alreadyCurrent=0;
    for(const key of selected){const record=bank.records.get(key);this._clean(bank,record);if(!bank.records.has(key)){alreadyCurrent++;continue;}const row=this._row(bank,record),structural=this._structural(bank,record,row);need(!structural,structural);const conflicts=this._conflicts(record,row);need(!conflicts.length,'DB에서 같은 필드가 바뀌었습니다. 초안을 유지할지 DB 내용을 사용할지 선택해 주세요.');plans.push({key,record,fields:clone(record.fields),operation:record.operation});}
    this._persist();if(!plans.length){this._emit();return Promise.resolve({saved:0,alreadyCurrent});}
    const owner=this.owner;let leaveOwner;const left=new Promise(resolve=>leaveOwner=()=>resolve({ownerChanged:true})),task={leaveOwner,promise:null};bank.task=task;bank.error=null;
    task.promise=Promise.resolve().then(async()=>{
      let saved=0;
      for(const plan of plans){
        if(this.owner!==owner||!this.state?.canEdit)return {saved,alreadyCurrent,ownerChanged:true};if(bank.records.get(plan.key)!==plan.record)continue;
        const record=plan.record,row=this._row(bank,record),structural=this._structural(bank,record,row);need(!structural,structural);need(!this._blocked(bank),this._blocked(bank));
        for(const [field,value] of Object.entries(plan.fields))need(!row||same(row.content[field],record.baseContent[field])||same(row.content[field],value),'DB에서 같은 필드가 바뀌었습니다. 초안을 확인해 주세요.');
        const fields=plan.operation==='create'?clone(plan.fields):Object.fromEntries(Object.entries(plan.fields).filter(([field,value])=>!same(row.content[field],value)).map(([field,value])=>[field,clone(value)]));
        if(!Object.keys(fields).length){this._clean(bank,record);alreadyCurrent++;continue;}
        const desired=this._desired(record,row),submitted={operation:plan.operation,fields,baseVersion:row?.version??0,baseContent:clone(row?.content??{}),uncertain:false};record.submitted=submitted;
        for(const field of Object.keys(fields)){delete record.fields[field];if(own(desired,field)&&!same(desired[field],fields[field]))record.fields[field]=clone(desired[field]);}
        this._persist(owner);this._emit(owner);let result;
        try{result=this.onSave(record.type,record.id,clone(fields),{operation:submitted.operation});}catch(error){this._restoreSent(owner,record,submitted,error.message??String(error));throw error;}
        const complete=Promise.resolve(result).then(ack=>this._ack(owner,record,submitted,ack)).catch(error=>{if(bank.records.get(plan.key)===record&&record.submitted===submitted){submitted.uncertain=true;bank.error='저장 결과를 확인하지 못했습니다. 기존 요청의 확인이 끝날 때까지 새 요청을 만들지 않습니다.';this._persist(owner);this._emit(owner);}throw error;});
        const outcome=await Promise.race([complete,left]);if(outcome?.ownerChanged)return {saved,alreadyCurrent,ownerChanged:true};if(outcome?.discarded)return {saved,alreadyCurrent,discarded:true};saved++;
      }
      return {saved,alreadyCurrent};
    }).finally(()=>{if(bank.task===task)bank.task=null;this._persist(owner);this._emit(owner);});
    this._emit(owner);return task.promise;
  }
  saveEntity(type,id){this._check(type,id);return this.saveAll({keys:[this.key(type,id)]});}
  cancel({keys=null}={}){
    const bank=this._bank();if(!bank)return {cancelled:0};const selected=this._keys(keys,bank);need(!selected.some(key=>bank.records.get(key)?.submitted),'전송한 저장 요청은 여기서 취소할 수 없습니다. 저장 결과를 먼저 확인해 주세요.');for(const key of selected)bank.records.delete(key);bank.error=null;this._persist();this._emit();return {cancelled:selected.length};
  }
  undo(type,id){this._check(type,id);const bank=this._bank(),record=bank?.records.get(this.key(type,id));if(!record)return false;need(!record.submitted,'저장 결과를 확인한 뒤 되돌려 주세요.');if(!record.history.length)return false;const previous=record.history.pop();if(previous===null)bank.records.delete(this.key(type,id));else{record.fields=previous;this._clean(bank,record);}this._persist();this._emit();return true;}
  resolveConflicts({keys=null,choice}={}){
    need(['local','remote'].includes(choice),'충돌 처리 방법을 확인해 주세요.');const bank=this._bank();if(!bank)return {resolved:0};const records=this._keys(keys,bank).map(key=>bank.records.get(key));
    for(const record of records){need(!record.submitted,'기존 저장 요청의 결과를 먼저 확인해 주세요.');need(!this._structural(bank,record,this._row(bank,record)),this._structural(bank,record,this._row(bank,record)));}
    let resolved=0;for(const record of records){const row=this._row(bank,record),conflicts=this._conflicts(record,row);if(!conflicts.length)continue;if(choice==='remote')for(const field of conflicts)delete record.fields[field];record.baseContent=clone(row.content);record.baseVersion=row.version;record.history=[];this._clean(bank,record);resolved++;}bank.error=null;this._persist();this._emit();return {resolved};
  }
}
export const createAuthoringDrafts060=options=>new AuthoringDrafts060(options);
