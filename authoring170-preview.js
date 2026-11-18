// Local editor preview with synthetic data. It is inert unless the page is served
// from this computer (localhost / 127.0.0.1 / [::1]) AND the URL has
// ?preview=local; the seed only exists on scripts/serve-local.mjs. The fake client
// never talks to Supabase: reads and "saves" stay in this browser's localStorage.
import {PROJECT039,IDENTITY039} from './authoring039-store.js?v=20261102-068';

export const PREVIEW_USER170=Object.freeze({id:'local-preview-editor',email:'preview@localhost'});
const HOSTS170=new Set(['localhost','127.0.0.1','[::1]']);
const DB_KEY170='poc-preview170-db';
const copy=value=>structuredClone(value);
const rowKey=(type,id)=>`${type}\n${id}`;

export function localPreview170(href){
  try{const url=new URL(String(href));return ['http:','https:'].includes(url.protocol)&&HOSTS170.has(url.hostname)&&url.searchParams.get('preview')==='local';}
  catch{return false;}
}

async function sha256(text,crypto){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}

export function createPreviewClient170({seed,crypto=globalThis.crypto,storage=null,reset=false}={}){
  if(!seed||!Array.isArray(seed.rows)||!Array.isArray(seed.catalog))throw Error('미리보기 자료를 확인하지 못했습니다.');
  const payloadJson=JSON.stringify(seed.payload),base=new Map(seed.rows.map(row=>[rowKey(row.entity_type,row.entity_id),row]));
  let fingerprint=null,session={user:{...PREVIEW_USER170}},listener=null,persist=Boolean(storage);
  if(reset)try{storage?.removeItem(DB_KEY170);}catch{/* Nothing stored. */}
  // Only changed rows are stored (the seed itself is several MB).
  const fresh=()=>({revision:seed.revision??1,overrides:new Map(),requests:[]});
  const load=()=>{
    try{const data=JSON.parse(storage?.getItem(DB_KEY170)??'null');if(data?.schema===1&&data.seed===seed.id&&Number.isSafeInteger(data.revision)&&Array.isArray(data.overrides))return {revision:data.revision,overrides:new Map(data.overrides),requests:Array.isArray(data.requests)?data.requests:[]};}catch{/* Start from the seed. */}
    return fresh();
  };
  let memory=persist?load():fresh();
  const save=db=>{if(!persist)return;try{storage.setItem(DB_KEY170,JSON.stringify({schema:1,seed:seed.id,revision:db.revision,overrides:[...db.overrides],requests:db.requests.slice(-100)}));}catch{persist=false;}};
  // Re-read before each call so two preview tabs can produce a real save conflict.
  const current=()=>{if(persist)memory=load();return memory;};
  const find=(db,type,id)=>{const key=rowKey(type,id);return db.overrides.has(key)?db.overrides.get(key):base.get(key)??null;};
  const rows=db=>{const out=[];for(const [key,row] of base)if(!db.overrides.has(key))out.push(row);for(const row of db.overrides.values())if(row)out.push(row);return out;};
  const row=(type,id,content,version)=>({entity_type:type,entity_id:id,version,state:'saved',issues:[],content:copy(content)});
  async function bootstrap(){
    const db=current();fingerprint??=await sha256(payloadJson,crypto);
    return {data:{schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,view:'authoring',project_revision:db.revision,unchanged:false,permissions:{can_edit:Boolean(session)},capabilities:copy(seed.capabilities),catalog:{cards:copy(seed.catalog)},characters:copy(seed.characters),
      authoring:session?{entities:copy(rows(db))}:null,
      game:{schema:1,kind:'poc-unified-game039',authoring_revision:db.revision,game_revision:db.revision,metadata_revision:String(db.revision),identity:IDENTITY039,source_fingerprint:fingerprint,payload_json:payloadJson}}};
  }
  function apply(intent){
    const db=current();if(!session)return {error:{code:'P0001',message:'unified039_editor_required'}};
    const replay=db.requests.find(entry=>entry.id===intent.request_id);if(replay)return {data:{...copy(replay.ack),replayed:true}};
    if(intent.expected_project_revision!==db.revision||intent.changes.some(change=>change.expected_entity_version!==(find(db,change.entity_type,change.entity_id)?.version??0)))
      return {error:{code:'P0001',message:'unified039_conflict',details:JSON.stringify({project_revision:db.revision})}};
    const revision=db.revision+1,changed=[],set=(type,id,value)=>db.overrides.set(rowKey(type,id),value);
    for(const change of intent.changes){
      const old=find(db,change.entity_type,change.entity_id);
      if(change.operation==='delete'){set(change.entity_type,change.entity_id,null);changed.push({entity_type:change.entity_type,entity_id:change.entity_id,deleted:true,version:revision});continue;}
      const renamed=change.entity_type==='category'&&change.operation==='patch'&&typeof change.fields.name==='string'&&change.fields.name!==change.entity_id?change.fields.name:null;
      if(renamed!==null){
        set('category',change.entity_id,null);changed.push({entity_type:'category',entity_id:change.entity_id,deleted:true,version:revision});
        const next=row('category',renamed,{...old?.content,...change.fields,name:renamed,archived:false},revision);set('category',renamed,next);changed.push(copy(next));
        for(const item of rows(db))if(item.entity_type==='card_annotation'&&(item.content.tags??[]).includes(change.entity_id)){const updated=row(item.entity_type,item.entity_id,{...item.content,tags:[...new Set(item.content.tags.map(tag=>tag===change.entity_id?renamed:tag))]},revision);set(item.entity_type,item.entity_id,updated);changed.push(copy(updated));}
        continue;
      }
      const next=row(change.entity_type,change.entity_id,{...(old?.content??{}),...copy(change.fields)},revision);set(change.entity_type,change.entity_id,next);changed.push(copy(next));
    }
    db.revision=revision;
    const ack={schema:1,kind:'unified039-write-ack',request_id:intent.request_id,applied_revision:revision,observed_project_revision:revision,entities:changed,game_revision:revision,game_source_fingerprint:fingerprint,issues:[]};
    db.requests.push({id:intent.request_id,ack:copy(ack)});save(db);return {data:ack};
  }
  return {
    preview170:true,
    auth:{
      getSession:async()=>({data:{session:session?copy(session):null},error:null}),
      onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){if(listener===fn)listener=null;}}}};},
      signInWithOtp:async()=>({error:Error('로컬 미리보기에서는 로그인 메일을 보내지 않습니다. 주소에 ?preview=local을 붙여 새로 열어 주세요.')}),
      signOut:async()=>{session=null;queueMicrotask(()=>listener?.('SIGNED_OUT',null));return {error:null};}
    },
    rpc:async(name,args={})=>{
      if(name==='poc_bootstrap039')return bootstrap();
      if(name==='poc_apply_intent039')return apply(copy(args.p_intent));
      return {error:{message:'로컬 미리보기에는 이전 자료 보관소가 없습니다.'}};
    },
    storage:{from:()=>({upload:async()=>({error:Error('로컬 미리보기에서는 이미지를 올리지 않습니다.')}),getPublicUrl:()=>({data:{publicUrl:''}})})},
    // Console helper for the conflict view: change a row as if another editor saved it.
    remoteEdit170(type,id,fields){const db=current(),old=find(db,type,String(id));if(!old)throw Error('미리보기 DB에 없는 항목입니다.');db.revision++;const next=row(type,String(id),{...old.content,...copy(fields)},db.revision);db.overrides.set(rowKey(type,String(id)),next);save(db);return copy(next);}
  };
}
