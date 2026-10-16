import {emptySave,parseSave} from './roguelite-core.js?v=20261015-147';
import {validateCloudConfig} from './supabase-cloud.js';

export const STARTER_LIMIT153=20;
export const STARTER_BYTES153=4_000_000;
export const STARTER_KIND153='poc-roguelite-starters';
const clone=value=>structuredClone(value),fail=message=>{throw new Error(message);};
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const stable=value=>JSON.stringify(value,(_key,item)=>record(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
function exact(value,keys,label){if(!record(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))fail(`${label} 형식을 확인해줘.`);}
const starterKeys=['starter_id','source_deck_id','name','catalog_version','registered_at','collection','groups'];
const cardKeys=['identity_key','slot','internal_id','name_ko','name_en','type','special','speed_limit','deck_limit','rarity','description_ko','image','subtype','race','attribute','tags','level','atk','def'];
const lineKeys=['identity_key','slot','internal_id','name_ko','name_en','count'];

// The public preparation tool still uses the frozen147 save core. Never pass
// a newer150 slot through that older normalizer: it drops nodes150 and cannot
// validate last-copy removal provenance. Preserve that original save instead.
export function assertLegacySlots153(input){
  if(input===null)return;
  if(typeof input==='string'){
    if(input.length>8_000_000)fail('원정 저장 파일이 너무 커. 원본을 보존했어.');
    input=JSON.parse(input);
  }
  if(Array.isArray(input?.slots)&&input.slots.some(s=>s?.run&&Object.hasOwn(s.run,'nodes150')))fail('이 저장본에는 게임 전용 원정150 진행이 있어. 원본을 보존했어. 게임의 원정 화면에서 이어가고, 시작 덱 도구는 공개 사이트에서 열어줘.');
}

export function cleanStarterDocument153(value,{allowUnset=false}={}){
  exact(value,['schema_version','kind','catalog_dataset_id','starters'],'시작 덱 목록');
  if(value.schema_version!==1||value.kind!==STARTER_KIND153||!Array.isArray(value.starters)||value.starters.length>STARTER_LIMIT153)fail('원정 시작 덱은 최대 20개까지 저장할 수 있어.');
  if(new TextEncoder().encode(JSON.stringify(value)).length>STARTER_BYTES153)fail('시작 덱 목록은 4MB 이하로 저장해줘.');
  if(!(typeof value.catalog_dataset_id==='string'&&/^[a-f0-9]{64}$/.test(value.catalog_dataset_id))&&!(allowUnset&&value.catalog_dataset_id===null&&value.starters.length===0))fail('시작 덱의 카드 자료 버전을 확인해줘.');
  const seen=new Set();
  for(const starter of value.starters){
    exact(starter,starterKeys,'시작 덱');
    if(!identifier(starter.starter_id)||seen.has(starter.starter_id))fail('시작 덱 번호가 중복되거나 잘못됐어.');seen.add(starter.starter_id);
    if(!Array.isArray(starter.collection))fail('시작 덱 카드함을 확인해줘.');
    for(const entry of starter.collection){exact(entry,['card','count'],'시작 덱 카드함');exact(entry.card,cardKeys,'시작 덱 카드 정보');}
    exact(starter.groups,['main','extra','side'],'시작 덱 위치');
    for(const group of ['main','extra','side']){
      if(!Array.isArray(starter.groups[group]))fail('시작 덱의 카드 목록을 확인해줘.');
      for(const row of starter.groups[group])exact(row,lineKeys,'시작 덱 카드 참조');
    }
  }
  // Use the same established player-deck/card snapshot validator as run saves.
  // No run, slots, gold, history or AI deck is part of this online document.
  const checked=parseSave({...emptySave(),starters:clone(value.starters)}).starters;
  return {schema_version:1,kind:STARTER_KIND153,catalog_dataset_id:value.catalog_dataset_id,starters:checked};
}
export function starterDocument153(starters,dataset){return cleanStarterDocument153({schema_version:1,kind:STARTER_KIND153,catalog_dataset_id:dataset,starters:clone(starters)});}
export function cleanStarterEnvelope153(value){
  exact(value,['schema','kind','version','document','updated_at'],'온라인 시작 덱 결과');
  if(value.schema!==1||value.kind!=='poc-roguelite-starter-library'||!Number.isSafeInteger(value.version)||value.version<0)fail('온라인 시작 덱 버전을 확인해줘.');
  const document=cleanStarterDocument153(value.document,{allowUnset:value.version===0});
  if(value.version===0){if(value.updated_at!==null||document.catalog_dataset_id!==null||document.starters.length)fail('미설정 시작 덱 목록이 잘못됐어.');}
  else if(typeof value.updated_at!=='string'||!Number.isFinite(new Date(value.updated_at).getTime()))fail('온라인 시작 덱 저장 시각을 확인해줘.');
  return {schema:1,kind:'poc-roguelite-starter-library',version:value.version,document,updated_at:value.updated_at};
}
export function starterCloudError153(error){
  const text=error?.message||'';
  if(text.includes('poc_starter_conflict'))return '다른 곳에서 원정 시작 덱 목록이 변경됐어. 현재 브라우저 편집본은 유지했어. 온라인 목록을 확인한 뒤 비교하고 다시 저장해줘.';
  if(text.includes('poc_editor_required')||error?.code==='42501')return '기존 덱 편집 권한이 있는 이메일로 로그인해줘. 현재 시작 덱 목록은 유지돼.';
  if(text.includes('poc_starter_identity')||text.includes('poc_invalid_catalog'))return '시작 덱의 카드 자료가 바뀌었어. 해당 덱을 현재 카드로 다시 등록해줘. 브라우저 편집본은 유지돼.';
  if(text.includes('poc_starter_'))return '시작 덱 목록 검사에 통과하지 못했어. 카드 수·덱 위치·보유 매수와 제한을 확인해줘. 편집본은 유지돼.';
  return text||'온라인 시작 덱 연결에 실패했어. 현재 브라우저 목록은 그대로 유지돼.';
}
export class StarterCloud153{
  constructor(client){this.client=client;this.row=null;}
  async load(){const {data,error}=await this.client.rpc('poc_load_roguelite_starters');if(error)throw error;const row=cleanStarterEnvelope153(data);this.row=row;return clone(row);}
  async editor(){const {data,error}=await this.client.rpc('poc_editor_status');if(error)throw error;return data===true;}
  async save(document,expectedVersion){
    const captured=cleanStarterDocument153(document);
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)fail('온라인 버전을 먼저 확인해줘.');
    const {data,error}=await this.client.rpc('poc_save_roguelite_starters',{p_document:captured,p_expected_version:expectedVersion});if(error)throw error;
    const row=cleanStarterEnvelope153(data);
    if(row.version<=expectedVersion||stable(row.document)!==stable(captured))fail('온라인 저장 응답이 요청한 시작 덱 목록과 달라. 현재 편집본은 유지돼.');
    this.row=row;return clone(row);
  }
}

// Explicit dependencies keep the authoring module's private state private.
// Fetching metadata never replaces a draft. Only an explicit load confirmation
// calls replaceStarters; that callback merges starters into the latest save.
export class StarterSync153{
  constructor({cloud,getStarters,getDataset,replaceStarters,confirm,backup,assertReady=()=>{},changed=()=>{}}){
    Object.assign(this,{cloud,getStarters,getDataset,replaceStarters,confirm,backup,assertReady,changed});this.online=null;this.busy=false;this.message='온라인 목록을 확인하면 버전과 등록 수를 볼 수 있어.';
  }
  view(){const local=this.getStarters();return {busy:this.busy,local_count:local.length,online_count:this.online?.document.starters.length??null,version:this.online?.version??null,same:!!this.online&&stable(local)===stable(this.online.document.starters),message:this.message};}
  notify(message){if(message)this.message=message;this.changed(this.view());}
  async task(callback){if(this.busy)fail('시작 덱 연결 작업이 끝난 뒤 다시 눌러줘.');this.assertReady();this.busy=true;this.notify();try{return await callback();}catch(error){this.notify(starterCloudError153(error));throw error;}finally{this.busy=false;this.notify();}}
  async refresh(){return this.task(async()=>{const loaded=await this.cloud.load();this.online=loaded;this.notify(loaded.version===0?'아직 온라인에 등록한 시작 덱 목록이 없어. 브라우저 목록은 유지했어.':`온라인 버전 ${loaded.version} · 시작 덱 ${loaded.document.starters.length}개를 확인했어. 브라우저 편집본은 유지돼.`);return clone(loaded);});}
  async loadIntoBrowser(){return this.task(async()=>{
    const before=clone(this.getStarters()),fingerprint=stable(before);const loaded=await this.cloud.load();this.online=loaded;
    if(loaded.version===0){this.notify('아직 온라인에 등록한 시작 덱 목록이 없어. 현재 브라우저 목록은 그대로 유지했어.');return false;}
    if(!await this.confirm('온라인 시작 덱을 불러올까?',`현재 브라우저 시작 덱 ${before.length}개를 온라인 버전 ${loaded.version}의 ${loaded.document.starters.length}개로 바꿔. 현재 목록의 JSON 백업을 먼저 받을게. 진행 중인 원정 슬롯·카드함·LP·금화는 유지돼.`))return false;
    this.assertReady();if(stable(this.getStarters())!==fingerprint)fail('확인하는 동안 브라우저 시작 덱 목록이 바뀌었어. 최신 목록을 보고 다시 불러와줘.');
    await this.backup(starterDocument153(before,this.getDataset()),'roguelite-starters-before-load.json');
    // replaceStarters must merge into the newest envelope, never a save captured
    // before awaiting the network/confirmation. Existing runs are untouched.
    await this.replaceStarters(clone(loaded.document.starters));
    this.notify(`온라인 시작 덱 ${loaded.document.starters.length}개를 브라우저로 불러왔어. 원정 슬롯은 유지했어.`);return true;
  });}
  async saveOnline(){return this.task(async()=>{
    const captured=starterDocument153(this.getStarters(),this.getDataset());
    if(!this.online)this.online=await this.cloud.load();
    if(!await this.cloud.editor())fail('poc_editor_required');
    const prior=clone(this.online);
    if(!await this.confirm('이 목록을 온라인 저장할까?',`온라인 시작 덱 ${prior.document.starters.length}개를 현재 브라우저의 ${captured.starters.length}개로 저장해. AI 덱·시나리오와 진행 중인 원정은 바뀌지 않아.`))return false;
    this.assertReady();if(stable(this.getStarters())!==stable(captured.starters))fail('확인하는 동안 시작 덱 목록이 바뀌었어. 최신 편집본을 보고 다시 저장해줘.');
    const saved=await this.cloud.save(captured,prior.version);this.online=saved;
    const unchanged=stable(this.getStarters())===stable(captured.starters);
    this.notify(`온라인 버전 ${saved.version} · 시작 덱 ${saved.document.starters.length}개 저장 완료.${unchanged?' 게임의 새 원정 시작 덱 목록에서 불러올 수 있어.':' 저장 중 만든 새 브라우저 편집본은 따로 유지돼.'}`);return clone(saved);
  });}
}

export function mountStarterSync153({root,getSave,getMeta,replaceStarters,createClient,confirm,download,assertReady=()=>{},fetcher=fetch}){
  if(!root)fail('온라인 시작 덱 도구 위치를 확인해줘.');
  const find=id=>root.querySelector(`[data-starter153="${id}"]`);let connecting=null,sync=null;
  const render=()=>{
    if(!sync)return;const state=sync.view();find('status').textContent=`브라우저 ${state.local_count}개 · 온라인 ${state.online_count===null?'미확인':state.online_count+'개'}${state.version===null?'':' · 버전 '+state.version}${state.same?' · 동일한 목록':''}\n${state.message}`;
    for(const name of ['refresh','load','save'])find(name).disabled=state.busy;
  };
  async function connect(){
    if(sync)return sync;if(connecting)return connecting;
    connecting=(async()=>{
      const response=await fetcher('./data/cloud-config.json',{cache:'no-store'});if(!response.ok)fail('온라인 연결 설정을 읽지 못했어.');
      const config=validateCloudConfig(await response.json());
      const client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options)=>fetcher(url,{...options,signal:options?.signal||AbortSignal.timeout(10000)})}});
      sync=new StarterSync153({cloud:new StarterCloud153(client),getStarters:()=>getSave().starters,getDataset:()=>getMeta().dataset_id,replaceStarters,confirm,backup:(value,name)=>download(JSON.stringify(value,null,2),name),assertReady,changed:render});render();return sync;
    })();try{return await connecting;}finally{connecting=null;}
  }
  const act=callback=>async()=>{try{assertReady();await callback(await connect());}catch(error){find('status').textContent=starterCloudError153(error);}};
  find('refresh').addEventListener('click',act(value=>value.refresh()));
  find('load').addEventListener('click',act(value=>value.loadIntoBrowser()));
  find('save').addEventListener('click',act(value=>value.saveOnline()));
  find('export').addEventListener('click',()=>{try{const value=starterDocument153(getSave().starters,getMeta().dataset_id);download(JSON.stringify(value,null,2),'roguelite-starters-draft.json');}catch(error){find('status').textContent=error.message;}});
  // A module mount performs no network call and reads no auth/localStorage.
  return {refreshView:render,destroy(){}};
}
