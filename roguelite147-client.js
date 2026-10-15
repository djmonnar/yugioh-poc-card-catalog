import {normalizeRun} from './roguelite-core.js?v=20261015-147';
const fail=message=>{throw new Error(message);};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const actions=['bind','prepare','start','cancel_prepared','recover_interrupted','choose_reward','rest','sync_deck','pass_node','archive_run'];
function archivedReceipt(receipt){
  if(!receipt||receipt.schema!==1||receipt.kind!=='roguelite147_archived'||!id(receipt.command_id)||!id(receipt.run_id)||!['slot-1','slot-2','slot-3'].includes(receipt.slot_id)||receipt.archived!==true)fail('원정 보관 영수증을 확인할 수 없어. 슬롯을 비우지 않았어.');
  return {schema:1,kind:'roguelite147_archived',command_id:receipt.command_id,run_id:receipt.run_id,slot_id:receipt.slot_id,archived:true};
}
export function createBridgeClient147(config,{location=globalThis.location,fetcher=globalThis.fetch,uuid=()=>crypto.randomUUID()}={}){
  if(config==null)return null;
  if(config.schema!==1||typeof config.token!=='string'||config.token.length<20||!id(config.session_id)||!hash(config.native_sha256)||typeof config.catalog_id!=='string')fail('게임 연결 설정을 확인할 수 없어. 실행기에서 원정을 다시 열어줘.');
  if(typeof config.apiBase!=='string'||!config.apiBase.startsWith('./api/roguelite147/')||/[?#\\]/.test(config.apiBase))fail('게임 연결 주소를 확인할 수 없어.');
  const base=new URL(config.apiBase,location.href);
  if(base.origin!==location.origin||!['http:','https:'].includes(base.protocol)||!['127.0.0.1','localhost','[::1]'].includes(base.hostname))fail('게임 실행기와 같은 로컬 주소에서만 연결할 수 있어.');
  const pending=new Map();
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
  return {
    config,
    async status(){
      const payload=await request('status');
      if(payload.supported!==true||typeof payload.title_ready!=='boolean')fail('현재 게임이 원정 전투 연결을 지원하지 않아. 새 설치판을 실행기에서 다시 열어줘.');
      if(payload.schema!==1||payload.kind!=='roguelite147_status'||payload.session_id!==config.session_id||payload.native_sha256!==config.native_sha256||payload.catalog_id!==config.catalog_id||!Array.isArray(payload.runs)||payload.runs.length>3)fail('현재 게임 세션과 원정 저장이 달라. 실행기에서 원정을 다시 열어줘.');
      const seen=new Set(),slots=new Set();const runs=payload.runs.map(source=>{
        const run=normalizeRun(source);if(!run.bridge147||seen.has(run.id)||slots.has(run.slot_id))fail('게임 원정 슬롯이 중복돼 있어.');
        seen.add(run.id);slots.add(run.slot_id);return run;
      });
      const launches=payload.launches||{};
      if(!launches||typeof launches!=='object'||Array.isArray(launches)||Object.entries(launches).some(([key,value])=>!id(key)||!['prepared','queued','started','resolved','interrupted','cancelled'].includes(value)))fail('전투 대기 상태를 확인할 수 없어.');
      if(!Array.isArray(payload.archives??[])||(payload.archives??[]).length>10000)fail('원정 보관 기록을 확인할 수 없어.');
      const archiveIds=new Set(),archives=(payload.archives??[]).map(value=>{const receipt=archivedReceipt(value);if(archiveIds.has(receipt.run_id)||seen.has(receipt.run_id))fail('원정 보관 기록과 현재 원정이 겹쳐 있어.');archiveIds.add(receipt.run_id);return receipt;});
      return {runs,archives,launches,session_id:payload.session_id};
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
    }
  };
}
