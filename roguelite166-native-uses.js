// The host authenticates native eligibility and receipts. This ledger handles
// durable reservations and once-per-battle accounting without removing relics.
const fail=m=>{throw Error(m);},hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export function reserveUse166(run,args){
 const state=run.runtime166,a=run.bridge147?.attempt;
 if(!state||!uuid(args.use_id)||!['moon_book','grimoire_search'].includes(args.item_id)||!hash(args.target_id)||typeof args.effect_id!=='string'||!/^[-A-Za-z0-9_:]{1,160}$/.test(args.effect_id))fail('사용할 유물·대상·효과 식별값을 확인해줘.');
 const old=state.native_uses.find(u=>u.use_id===args.use_id);if(old){if(old.item_id!==args.item_id||old.target_id!==args.target_id||old.effect_id!==args.effect_id)fail('같은 사용 번호의 내용이 달라.');return false;}
 if(run.state!=='in_battle'||run.bridge147?.phase!=='duel_started'||!hash(a?.launch_sha256))fail('실제 전투 중에 사용할 수 있어.');
 if(state.native_uses.some(u=>['reserved','accepted'].includes(u.status))||run.nodes163.uses.some(u=>['reserved','accepted'].includes(u.status)))fail('먼저 처리 중인 유물 요청을 마쳐줘.');
 if(args.item_id==='moon_book'&&(!run.relics.includes('moon_book')||state.native_uses.some(u=>u.item_id==='moon_book'&&u.attempt_id===a.attempt_id&&u.charged)))fail('이 전투에서 사용할 달의 서가 없어.');
 if(args.item_id==='grimoire_search'&&!run.instances163.items.some(i=>i.special_spell_search&&!i.seal_remaining&&run.instances163.active.main.includes(i.id)))fail('전투 덱에 마도서로 강화된 카드가 없어.');
 if(args.item_id==='grimoire_search'&&state.native_uses.some(u=>u.item_id==='grimoire_search'&&u.attempt_id===a.attempt_id&&u.effect_id===args.effect_id&&u.charged))fail('이미 처리한 특수 소환 서치야.');
 state.native_uses.push({use_id:args.use_id,item_id:args.item_id,target_id:args.target_id,effect_id:args.effect_id,attempt_id:a.attempt_id,session_id:a.session_id,launch_nonce:a.launch_nonce,launch_sha256:a.launch_sha256,status:'reserved',charged:false,receipt_sha256:null,reason:''});return true;
}
export function commitUse166(run,args){
 const row=run.runtime166.native_uses.find(u=>u.use_id===args.use_id);if(!row||!['rejected','accepted','applied','interrupted'].includes(args.status)||!hash(args.receipt_sha256)||args.reason!==undefined&&(typeof args.reason!=='string'||args.reason.length>1000))fail('검증된 유물 처리 영수증이 필요해.');
 if(row.status===args.status){if(row.receipt_sha256!==args.receipt_sha256)fail('같은 상태의 영수증이 달라.');return false;}
 if(['rejected','applied','interrupted'].includes(row.status)||args.status==='rejected'&&row.status!=='reserved'||args.status==='interrupted'&&row.status!=='accepted')fail('이미 확정된 유물 사용 상태를 바꿀 수 없어.');
 if(args.status!=='rejected')row.charged=true;row.status=args.status;row.receipt_sha256=args.receipt_sha256;row.reason=args.reason??'';return true;
}
export function cleanNativeUses166(rows,run){
 const uses=new Set(),charged=new Set();if(!Array.isArray(rows)||rows.length>1000)fail('유물 사용 기록이 너무 많아.');
 for(const u of rows){if(!u||Object.keys(u).sort().join(',')!=='attempt_id,charged,effect_id,item_id,launch_nonce,launch_sha256,reason,receipt_sha256,session_id,status,target_id,use_id'||!uuid(u.use_id)||uses.has(u.use_id)||!['moon_book','grimoire_search'].includes(u.item_id)||!hash(u.target_id)||!['attempt_id','session_id','launch_nonce','effect_id'].every(k=>typeof u[k]==='string'&&/^[-A-Za-z0-9_:]{1,160}$/.test(u[k]))||!hash(u.launch_sha256)||!['reserved','rejected','accepted','applied','interrupted'].includes(u.status)||u.charged!==['accepted','applied','interrupted'].includes(u.status)||(u.status==='reserved'?u.receipt_sha256!==null:!hash(u.receipt_sha256))||typeof u.reason!=='string'||u.reason.length>1000)fail('유물 사용·대상·영수증이 달라.');uses.add(u.use_id);
  if(u.item_id==='moon_book'&&!run.nodes163.acquisitions.some(a=>a.relic_id==='moon_book'))fail('획득하지 않은 달의 서 사용 기록이야.');
  const claim=u.item_id==='moon_book'?`${u.attempt_id}:moon_book`:`${u.attempt_id}:${u.effect_id}`;if(u.charged){if(charged.has(claim))fail('같은 전투 효과를 중복 사용했어.');charged.add(claim);}
 }
 if(rows.filter(u=>['reserved','accepted'].includes(u.status)).length+run.nodes163.uses.filter(u=>['reserved','accepted'].includes(u.status)).length>1)fail('유물 사용 요청이 겹쳐 있어.');
 return structuredClone(rows);
}
