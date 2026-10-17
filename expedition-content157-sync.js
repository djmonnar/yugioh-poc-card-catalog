import {cleanContent157,cleanLibrary157} from './expedition-content157-core.js?v=20261017-157';
const clone=structuredClone,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function contentError157(error){
  const message=error?.message||'';
  if(message.includes('conflict'))return '다른 곳에서 원정 설정이 바뀌었어. 현재 편집본은 유지했어. 온라인 설정과 비교해줘.';
  if(message.includes('poc_editor_required')||error?.code==='42501')return '기존 편집자 이메일로 로그인해줘. 현재 편집본은 유지돼.';
  if(message.includes('poc_'))return '원정 설정 검사에 통과하지 못했어. 사용 여부·가중치·가격·카드 후보를 확인해줘.';
  return message||'온라인 연결에 실패했어. 브라우저 편집본은 유지돼.';
}
export class ContentCloud157{
  constructor(client){this.client=client;}
  async load(){const {data,error}=await this.client.rpc('read_poc_expedition_content157');if(error)throw error;return cleanLibrary157(data);}
  async editor(){const {data,error}=await this.client.rpc('poc_editor_status');if(error)throw error;return data===true;}
  async save(document,expectedVersion){
    const captured=cleanContent157(document);
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('온라인 설정 버전을 먼저 확인해줘.');
    const {data,error}=await this.client.rpc('save_poc_expedition_content157',{p_document:captured,p_expected_version:expectedVersion});
    if(error)throw error;
    const row=cleanLibrary157(data);
    if(row.version<=expectedVersion||!same(row.document,captured))throw new Error('저장 응답이 요청한 원정 설정과 달라. 현재 편집본은 유지했어.');
    return row;
  }
}
export class ContentSync157{
  constructor({cloud,getDocument,replaceDocument,changed=()=>{},baseVersion=null,baseline=null,cards=()=>undefined}){
    Object.assign(this,{cloud,getDocument,replaceDocument,changed,baseVersion,baseline,cards});
    this.online=null;this.busy=false;this.message='온라인 설정을 확인하면 저장 버전을 볼 수 있어.';
  }
  state(){return {busy:this.busy,base_version:this.baseVersion,online:this.online?clone(this.online):null,
    baseline:this.baseline?clone(this.baseline):null,message:this.message,
    conflict:this.online!==null&&this.baseVersion!==null&&this.online.version!==this.baseVersion,
    same:this.online!==null&&same(this.getDocument(),this.online.document)};}
  notify(message){if(message)this.message=message;this.changed(this.state());}
  async task(callback){if(this.busy)throw new Error('현재 연결 작업이 끝난 뒤 다시 눌러줘.');this.busy=true;this.notify();try{return await callback();}catch(error){this.notify(contentError157(error));throw error;}finally{this.busy=false;this.notify();}}
  async refresh(){return this.task(async()=>{
    this.online=await this.cloud.load();
    if(this.baseVersion===null){this.baseVersion=this.online.version;this.baseline=clone(this.online);}
    this.notify(`온라인 버전 ${this.online.version}을 확인했어. 브라우저 편집본은 유지돼.`);
    return clone(this.online);
  });}
  async loadIntoDraft(){return this.task(async()=>{
    const captured=clone(this.getDocument()),row=await this.cloud.load();this.online=row;
    if(!same(captured,this.getDocument()))throw new Error('불러오는 동안 편집본이 바뀌었어. 현재 편집본을 유지했어. 다시 눌러줘.');
    this.replaceDocument(clone(row.document));this.baseVersion=row.version;this.baseline=clone(row);
    this.notify(`온라인 버전 ${row.version}을 브라우저 편집본으로 불러왔어.`);return clone(row);
  });}
  async save({compared=false}={}){return this.task(async()=>{
    const captured=cleanContent157(this.getDocument(),this.cards());
    if(!this.online)this.online=await this.cloud.load();
    if(this.baseVersion===null){this.baseVersion=this.online.version;this.baseline=clone(this.online);}
    if(!await this.cloud.editor())throw new Error('poc_editor_required');
    const expected=compared?this.online.version:this.baseVersion;
    let saved,recovered=false;
    try{saved=await this.cloud.save(captured,expected);}
    catch(error){
      // A lost POST reply is uncertain. Observe the authoritative saved value;
      // never resend with a newer version or overwrite a concurrent document.
      try{
        const observed=await this.cloud.load();this.online=observed;
        if(observed.version>expected&&same(observed.document,captured)){saved=observed;recovered=true;}
      }catch{}
      if(!saved)throw error;
    }
    this.online=clone(saved);this.baseline=clone(saved);this.baseVersion=saved.version;
    const advanced=!same(this.getDocument(),captured);
    this.notify(`${recovered?'서버 저장을 다시 확인했어. ':''}온라인 버전 ${saved.version} 저장 완료.${advanced?' 저장 중 만든 새 편집본도 유지했어.':' 다음 새 원정에 적용돼.'}`);
    return clone(saved);
  });}
}
