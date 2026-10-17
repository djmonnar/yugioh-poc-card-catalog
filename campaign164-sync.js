import {cleanCampaign164,cleanCampaignLibrary164,campaignReady164} from './campaign164-core.js?v=20261018-164';
const clone=structuredClone,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function campaignError164(error){
 const value=error?.message||'';
 if(value.includes('conflict'))return '다른 곳에서 원정 구성이 바뀌었어. 현재 편집본은 유지했어. 온라인 저장본과 비교해줘.';
 if(value.includes('poc_editor_required')||error?.code==='42501')return '기존 편집자 이메일로 로그인해줘. 현재 편집본은 유지돼.';
 if(value.includes('poc_'))return '원정 구성 검사에 통과하지 못했어. 상대 후보·카드·특성·추가 LP를 확인해줘.';
 return value||'온라인 연결에 실패했어. 브라우저 편집본은 유지돼.';
}
export class CampaignCloud164{
 constructor(client){this.client=client;}
 async load(){const {data,error}=await this.client.rpc('read_poc_expedition_campaign164');if(error)throw error;return cleanCampaignLibrary164(data);}
 async editor(){const {data,error}=await this.client.rpc('poc_editor_status');if(error)throw error;return data===true;}
 async save(document,version){
  const captured=cleanCampaign164(document),ready=campaignReady164(captured);if(!ready.valid)throw Error(ready.issues[0]);
  if(!Number.isSafeInteger(version)||version<0)throw Error('온라인 버전을 먼저 확인해줘.');
  const {data,error}=await this.client.rpc('save_poc_expedition_campaign164',{p_document:captured,p_expected_version:version});if(error)throw error;
  const row=cleanCampaignLibrary164(data);if(row.version!==version+1||!same(row.document,captured))throw Error('저장 응답이 요청한 구성과 달라. 현재 편집본은 유지했어.');return row;
 }
}
export class CampaignSync164{
 constructor({cloud,getDocument,replaceDocument,changed=()=>{},baseVersion=null,baseline=null,cards=()=>undefined}){Object.assign(this,{cloud,getDocument,replaceDocument,changed,baseVersion,baseline,cards});this.online=null;this.busy=false;this.message='온라인 구성 버전을 확인해줘.';}
 state(){return {busy:this.busy,base_version:this.baseVersion,baseline:this.baseline?clone(this.baseline):null,online:this.online?clone(this.online):null,message:this.message,conflict:this.online!==null&&this.baseVersion!==null&&this.online.version!==this.baseVersion,same:!!this.online&&same(this.getDocument(),this.online.document)};}
 notify(message){if(message)this.message=message;this.changed(this.state());}
 async task(fn){if(this.busy)throw Error('현재 연결이 끝난 뒤 다시 눌러줘.');this.busy=true;this.notify();try{return await fn();}catch(e){this.notify(campaignError164(e));throw e;}finally{this.busy=false;this.notify();}}
 async refresh(){return this.task(async()=>{this.online=await this.cloud.load();if(this.baseVersion===null){this.baseVersion=this.online.version;this.baseline=clone(this.online);}this.notify(`온라인 버전 ${this.online.version} 확인. 현재 편집본은 유지돼.`);return clone(this.online);});}
 async loadIntoDraft(){return this.task(async()=>{const captured=clone(this.getDocument()),row=await this.cloud.load();this.online=row;if(!same(captured,this.getDocument()))throw Error('불러오는 동안 편집본이 바뀌었어. 다시 눌러줘.');this.replaceDocument(clone(row.document));this.baseVersion=row.version;this.baseline=clone(row);this.notify(`온라인 버전 ${row.version}을 편집본으로 불러왔어.`);return clone(row);});}
 async save({compared=false}={}){return this.task(async()=>{
  const captured=cleanCampaign164(this.getDocument(),this.cards()),ready=campaignReady164(captured);if(!ready.valid)throw Error(ready.issues[0]);
  if(!this.online)this.online=await this.cloud.load();if(this.baseVersion===null){this.baseVersion=this.online.version;this.baseline=clone(this.online);}if(!await this.cloud.editor())throw Error('poc_editor_required');
  const expected=compared?this.online.version:this.baseVersion;let saved,recovered=false;
  try{saved=await this.cloud.save(captured,expected);}catch(error){try{const observed=await this.cloud.load();this.online=observed;if(observed.version>expected&&same(observed.document,captured)){saved=observed;recovered=true;}}catch{}if(!saved)throw error;}
  this.online=clone(saved);this.baseline=clone(saved);this.baseVersion=saved.version;this.notify(`${recovered?'서버 저장을 다시 확인했어. ':''}온라인 버전 ${saved.version} 저장 완료. 다음 새 원정부터 적용돼.${same(this.getDocument(),captured)?'':' 저장 중 만든 새 편집본도 유지했어.'}`);return clone(saved);
 });}
}
