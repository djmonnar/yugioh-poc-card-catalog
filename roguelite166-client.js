import {normalizeRun} from './roguelite166-core.js?v=20261018-166';
const fail=message=>{throw new Error(message);};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const actions=['bind','prepare','start','cancel_prepared','recover_interrupted','choose_reward','rest','sync_deck','pass_node','archive_run','enter_node','buy_card','remove_card','event_choice','leave_node','set_relic_choice','choose_opening','sell_card','refresh_shop','forge_card163','enhance_card166'];
function archivedReceipt(receipt){
  if(!receipt||receipt.schema!==1||receipt.kind!=='roguelite147_archived'||!id(receipt.command_id)||!id(receipt.run_id)||!['slot-1','slot-2','slot-3'].includes(receipt.slot_id)||receipt.archived!==true)fail('원정 보관 영수증을 확인할 수 없어. 슬롯을 비우지 않았어.');
  return {schema:1,kind:'roguelite147_archived',command_id:receipt.command_id,run_id:receipt.run_id,slot_id:receipt.slot_id,archived:true};
}
export function createBridgeClient154(config,{location=globalThis.location,fetcher=globalThis.fetch,uuid=()=>crypto.randomUUID(),useStorage=globalThis.sessionStorage}={}){
  if(config==null)return null;
  if(config.schema!==1||typeof config.token!=='string'||config.token.length<20||!id(config.session_id)||!hash(config.native_sha256)||typeof config.catalog_id!=='string')fail('게임 연결 설정을 확인할 수 없어. 실행기에서 원정을 다시 열어줘.');
  if(typeof config.apiBase!=='string'||!config.apiBase.startsWith('./api/roguelite147/')||/[?#\\]/.test(config.apiBase))fail('게임 연결 주소를 확인할 수 없어.');
  const base=new URL(config.apiBase,location.href);
  if(base.origin!==location.origin||!['http:','https:'].includes(base.protocol)||!['127.0.0.1','localhost','[::1]'].includes(base.hostname))fail('게임 실행기와 같은 로컬 주소에서만 연결할 수 있어.');
  const pending=new Map();
  const useIds=new Set(['draw_scroll','draw_tome','healing_potion','greater_healing_potion','destruction_scroll','flame_scroll','lizard_tail','reload','reload_skip','moon_book','grimoire_search']),uuidValue=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value),useKey=`roguelite163-use:${config.session_id}`;
  let pendingUse=null,useStorageBlocked=false;
  try{const raw=useStorage?.getItem(useKey);if(raw){const value=JSON.parse(raw);if(!value||value.schema!==1||!id(value.run_id)||!Number.isSafeInteger(value.expected_revision)||value.expected_revision<0||!uuidValue(value.command_id)||!uuidValue(value.use_id)||!useIds.has(value.item_id)||Object.keys(value).length!==7||!(value.target_id===null||typeof value.target_id==='string'&&value.target_id.length>0&&value.target_id.length<=256))throw new Error('shape');pendingUse=value;}}catch{useStorageBlocked=true;}
  function storeUse(value){if(value===null){pendingUse=null;try{useStorage?.removeItem(useKey);}catch{useStorageBlocked=true;}return;}if(useStorageBlocked||!useStorage)fail('소모품 요청의 임시 저장 상태를 확인할 수 없어. 새로 사용하지 않았어.');try{useStorage.setItem(useKey,JSON.stringify(value));pendingUse=value;}catch{useStorageBlocked=true;fail('소모품 요청을 임시 저장하지 못했어. 새로 사용하지 않았어.');}}
  function observeUseRun(run){if(pendingUse&&run?.id===pendingUse.run_id){const row=[...((run.nodes163??run.nodes159??run.nodes158)?.uses??[]),...(run.runtime166?.native_uses??[])].find(row=>row.use_id===pendingUse.use_id&&row.item_id===pendingUse.item_id);if(row&&['applied','rejected','interrupted'].includes(row.status))storeUse(null);}}
  const useBase=new URL('../roguelite163/',base);
  const uncertain=message=>Object.assign(new Error(message),{uncertain:true});
  async function request(path,body){
    let response;
    try{response=await fetcher(new URL(path,base).href,{method:body?'POST':'GET',cache:'no-store',credentials:'omit',redirect:'error',
      headers:{'X-Rogue-Token':config.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}
    catch{throw uncertain('게임 응답을 받지 못했어. 같은 요청 번호로 다시 확인할게.');}
    let payload;try{payload=await response.json();}catch{throw uncertain('게임 연결 응답을 읽지 못했어. 같은 요청 번호로 확인해줘.');}
    if(!response.ok||payload.ok===false){const error=new Error(payload.error||'게임 연결 요청을 마치지 못했어.');error.uncertain=response.status>=500;throw error;}
    return payload;
  }
  function checkpoint(receipt,command){
    if(receipt.schema!==1||receipt.kind!=='roguelite147_checkpoint'||receipt.command_id!==command.command_id||receipt.run_id!==command.run_id||
      !hash(receipt.checkpoint_sha256)||receipt.previous_revision!==command.expected_revision||!Number.isSafeInteger(receipt.revision)||receipt.revision<command.expected_revision||receipt.revision>command.expected_revision+1)fail('게임 저장 영수증과 요청이 달라. 진행을 다시 불러와줘.');
    const run=normalizeRun(receipt.run);
    if(run.id!==receipt.run_id||run.revision!==receipt.revision||!run.bridge147)fail('게임 저장 영수증의 원정 내용이 달라.');
    return run;
  }
  async function useRequest(path,body){
    let response;try{response=await fetcher(new URL(path,useBase).href,{method:body?'POST':'GET',cache:'no-store',credentials:'omit',redirect:'error',headers:{'X-Rogue-Token':config.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}catch{throw uncertain('소모품 응답이 늦어. 같은 사용 요청을 보존했어. 다시 상태를 확인해줘.');}
    let payload;try{payload=await response.json();}catch{throw uncertain('소모품 응답을 읽지 못했어. 같은 사용 요청을 보존했어.');}
    if(!response.ok||payload.ok===false){const error=new Error(payload.error||'소모품 사용을 마치지 못했어.');error.uncertain=response.status>=500;throw error;}return payload;
  }
  function useRun(source,runId,attemptId,{safe=false}={}){
    if(source===null){if(runId!==null||attemptId!==null||safe)fail('소모품 전투 기록이 현재 게임과 달라.');return null;}
    const run=normalizeRun(source),attempt=run.bridge147?.attempt;if(run.id!==runId||attempt?.attempt_id!==attemptId)fail('소모품 원정과 전투 번호가 달라.');
    if(safe&&(run.state!=='in_battle'||run.bridge147.phase!=='duel_started'||attempt.session_id!==config.session_id))fail('현재 게임에서 진행 중인 전투가 아니야.');return run;
  }
  return {
    config,
    async status(){
      const payload=await request('status');
      if(payload.supported!==true||typeof payload.title_ready!=='boolean')fail('현재 게임이 원정 전투 연결을 지원하지 않아. 새 설치판을 실행기에서 다시 열어줘.');
      if(payload.schema!==1||payload.kind!=='roguelite147_status'||payload.session_id!==config.session_id||payload.native_sha256!==config.native_sha256||payload.catalog_id!==config.catalog_id||!Array.isArray(payload.runs)||payload.runs.length>3)fail('현재 게임 세션과 원정 저장이 달라. 실행기에서 원정을 다시 열어줘.');
      const seen=new Set(),slots=new Set();const runs=payload.runs.map(source=>{
        const run=normalizeRun(source);if(!run.bridge147||seen.has(run.id)||slots.has(run.slot_id))fail('게임 원정 슬롯이 중복돼 있어.');
        seen.add(run.id);slots.add(run.slot_id);observeUseRun(run);return run;
      });
      const launches=payload.launches||{};
      if(!launches||typeof launches!=='object'||Array.isArray(launches)||Object.entries(launches).some(([key,value])=>!id(key)||!['prepared','queued','started','resolved','interrupted','cancelled'].includes(value)))fail('전투 대기 상태를 확인할 수 없어.');
      if(!Array.isArray(payload.archives??[])||(payload.archives??[]).length>10000)fail('원정 보관 기록을 확인할 수 없어.');
      const archiveIds=new Set(),archives=(payload.archives??[]).map(value=>{const receipt=archivedReceipt(value);if(archiveIds.has(receipt.run_id)||seen.has(receipt.run_id))fail('원정 보관 기록과 현재 원정이 겹쳐 있어.');archiveIds.add(receipt.run_id);return receipt;});
      if(pendingUse&&archives.some(row=>row.run_id===pendingUse.run_id))storeUse(null);
      const source=payload.content_source163??payload.content_source158??payload.content_source157??null;
      if(source!==null&&(!source||typeof source!=='object'||!['online','last_valid','bundled_default'].includes(source.mode)||!Number.isSafeInteger(source.version)||source.version<0||typeof source.message!=='string'||source.message.length>1000))fail('원정 설정의 연결 상태를 확인할 수 없어.');
      return {runs,archives,launches,session_id:payload.session_id,content_source163:source,content_source157:source};
    },
    acknowledgeStatus({runs,archives=[],launches={}}){
      for(const [key,body]of pending){
        if(body.action==='archive_run'){if(archives.some(r=>r.command_id===body.command_id&&r.run_id===body.run_id))pending.delete(key);continue;}
        const current=runs.find(r=>r.id===body.run_id);
        if(current&&(current.revision>body.expected_revision||(body.action==='bind'&&current.bridge147)||
          (body.action==='start'&&['queued','started','resolved','interrupted'].includes(launches[body.args.attempt_id]))))pending.delete(key);
      }
    },
    async command(action,run,args={},commandId=uuid()){
      if(!actions.includes(action))fail('브라우저에서 보낼 수 없는 원정 명령이야.');
      if(!id(commandId))fail('게임 명령 번호를 확인해줘.');
      const source=normalizeRun(run),key=`${source.id}:${action}`;
      let body=pending.get(key);
      if(body){if(JSON.stringify(body.args)!==JSON.stringify(args))fail('아직 확인 중인 같은 요청을 먼저 다시 확인해줘.');}
      else{body=structuredClone({schema:1,command_id:commandId,action,run_id:source.id,expected_revision:source.revision,args});if(action==='bind')body.run=source;pending.set(key,body);}
      let receipt;
      try{
        try{receipt=await request('command',body);}catch(error){if(!error.uncertain)throw error;receipt=await request('command',body);}
        if(action==='archive_run'){
          receipt=archivedReceipt(receipt);
          if(receipt.command_id!==body.command_id||receipt.run_id!==source.id||receipt.slot_id!==source.slot_id)fail('원정 보관 영수증과 요청이 달라. 슬롯을 비우지 않았어.');
          pending.delete(key);return {archived:true,run_id:receipt.run_id,slot_id:receipt.slot_id,command_id:receipt.command_id};
        }
        const result={run:checkpoint(receipt,body),native_status:receipt.native_status||null};pending.delete(key);return result;
      }catch(error){if(error.uncertain===false)pending.delete(key);throw error;}
    },
    async useStatus163(){
      const payload=await useRequest('use_status');
      if(payload.schema!==1||payload.kind!=='roguelite163_use_status'||!(payload.run_id===null||id(payload.run_id))||!(payload.attempt_id===null||id(payload.attempt_id))||typeof payload.safe!=='boolean'||typeof payload.overlay_open!=='boolean'||typeof payload.reason!=='string'||payload.reason.length>1000||!Number.isSafeInteger(payload.ui_open_seq)||payload.ui_open_seq<0||payload.ui_open_seq>0xffffffff||!(payload.pending_use_id===null||uuidValue(payload.pending_use_id))||!Array.isArray(payload.items)||payload.items.length>11)fail('소모품 사용 가능 응답을 확인할 수 없어.');
      const run=useRun(payload.run,payload.run_id,payload.attempt_id,{safe:payload.safe}),seen=new Set(),items=payload.items.map(row=>{
        if(!row||!useIds.has(row.item_id)||seen.has(row.item_id)||!Number.isSafeInteger(row.remaining)||row.remaining<0||row.remaining>10||!Number.isSafeInteger(row.amount)||row.amount<1||row.amount>60000||typeof row.can_use!=='boolean'||typeof row.reason!=='string'||row.reason.length>1000)fail('소모품별 사용 상태를 확인할 수 없어.');seen.add(row.item_id);const targets=row.targets??[];if(!Array.isArray(targets)||targets.length>(row.item_id==='grimoire_search'?64:22)||targets.some(target=>!target||typeof target.target_id!=='string'||!target.target_id.length||target.target_id.length>256||typeof target.label!=='string'||target.label.length>250))fail('파괴할 필드 카드 목록을 확인할 수 없어.');if(new Set(targets.map(target=>target.target_id)).size!==targets.length)fail('필드 카드 선택 목록이 겹쳐 있어.');return {...row,targets};
      });
      if(payload.safe&&!payload.overlay_open)fail('전투의 소모품 창이 열려 있지 않아.');
      observeUseRun(run);
      return {...payload,run,items,pending_request:pendingUse?structuredClone(pendingUse):null};
    },
    async useConsumable163(run,itemId,targetId=null){
      const source=normalizeRun(run),attempt=source.bridge147?.attempt;
      if(['destruction_scroll','reload','moon_book','grimoire_search'].includes(itemId)?typeof targetId!=='string'||!targetId.length||targetId.length>256:targetId!==null)fail('파괴할 필드 카드를 하나 골라줘.');
      if(!useIds.has(itemId)||source.state!=='in_battle'||source.bridge147?.phase!=='duel_started'||attempt?.session_id!==config.session_id)fail('현재 전투에서 사용할 보유 소모품을 골라줘.');
      let body=pendingUse;
      if(body){if(body.run_id!==source.id||body.item_id!==itemId||body.target_id!==targetId)fail('앞서 요청한 소모품 결과를 먼저 확인해줘.');}
      else{body={schema:1,run_id:source.id,expected_revision:source.revision,command_id:uuid(),item_id:itemId,use_id:uuid(),target_id:targetId};if(!uuidValue(body.command_id)||!uuidValue(body.use_id))fail('소모품 요청 번호를 만들지 못했어.');storeUse(body);}
      let payload;try{payload=await useRequest('use',body);}catch(error){if(error.uncertain===false)storeUse(null);throw error;}
      if(payload.schema!==1||payload.kind!=='roguelite163_use_pending'||payload.use_id!==body.use_id||!['reserved','accepted','applied','rejected','interrupted','queued'].includes(payload.status))fail('소모품 사용 요청 응답이 달라. 새 사용 요청을 만들지 않았어.');
      const next=useRun(payload.run,source.id,attempt.attempt_id);
      if(!next||next.revision<body.expected_revision||next.bridge147.attempt.launch_sha256!==attempt.launch_sha256||next.bridge147.attempt.session_id!==attempt.session_id)fail('소모품 사용 후 전투 기록이 달라.');
      const recorded=[...((next.nodes163??next.nodes158)?.uses??[]),...(next.runtime166?.native_uses??[])].find(row=>row.use_id===body.use_id&&row.item_id===body.item_id);if(!recorded)fail('소모품 사용 요청이 원정 기록에 없어.');
      if(['applied','rejected','interrupted'].includes(recorded.status))storeUse(null);
      return {run:next,use_id:body.use_id,status:payload.status};
    }
  };
}
