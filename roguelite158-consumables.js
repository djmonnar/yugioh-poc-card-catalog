// Run charges and durable reservation accounting. Native eligibility, receipt
// authentication and actual draw/heal execution are owned by the Python host.
export const CONSUMABLE_IDS158=Object.freeze(['draw_scroll','draw_tome','healing_potion','greater_healing_potion']);
const fail=message=>{throw new Error(message);};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const active=row=>['reserved','accepted'].includes(row.status);
function binding(run){
 const a=run.bridge147?.attempt;
 if(!a||!hash(a.launch_sha256))fail('진행 중인 실제 원정 전투가 없어.');
 return {attempt_id:a.attempt_id,session_id:a.session_id,launch_nonce:a.launch_nonce,launch_sha256:a.launch_sha256};
}
export function registerConsumable158(run,itemId,acquisitionId,params){
 if(!CONSUMABLE_IDS158.includes(itemId))return;
 if(!id(acquisitionId)||!Number.isSafeInteger(params.charges)||params.charges<1||params.charges>10)fail('소모품 획득 기록을 확인해줘.');
 if(run.nodes158.uses.some(row=>row.item_id===itemId&&active(row)))fail('사용 처리 중인 소모품은 다시 획득할 수 없어.');
 run.nodes158.consumables[itemId]={acquisition_id:acquisitionId,total:params.charges,remaining:params.charges};
}
export function reserveUse158(run,args){
 if(!uuid(args.use_id)||!CONSUMABLE_IDS158.includes(args.item_id))fail('사용할 소모품과 UUID 요청 번호를 확인해줘.');
 const old=run.nodes158.uses.find(row=>row.use_id===args.use_id);
 if(old){if(old.item_id!==args.item_id)fail('같은 사용 번호로 다른 소모품을 사용할 수 없어.');return false;}
 if(run.state!=='in_battle'||run.bridge147?.phase!=='duel_started')fail('실제 전투가 시작된 뒤에 소모품을 사용할 수 있어.');
 const item=run.nodes158.consumables[args.item_id];
 if(!run.relics.includes(args.item_id)||!item||item.remaining<1)fail('남은 사용 횟수가 있는 보유 소모품을 골라줘.');
 if(run.nodes158.uses.some(active))fail('먼저 요청한 소모품의 처리 결과를 기다려줘.');
 if(run.nodes158.uses.length>=1000)fail('소모품 사용 기록이 가득 찼어.');
 run.nodes158.uses.push({use_id:args.use_id,item_id:args.item_id,acquisition_id:item.acquisition_id,...binding(run),status:'reserved',charged:false,receipt_sha256:null,reason:''});
 return true;
}
export function commitUse158(run,args){
 const row=run.nodes158.uses.find(value=>value.use_id===args.use_id);
 if(!row||!['rejected','accepted','applied','interrupted'].includes(args.status)||!hash(args.receipt_sha256))fail('검증된 소모품 처리 영수증이 필요해.');
 if(args.reason!==undefined&&(typeof args.reason!=='string'||args.reason.length>1000))fail('소모품 처리 사유를 확인해줘.');
 if(row.status===args.status){if(row.receipt_sha256!==args.receipt_sha256)fail('같은 소모품 처리 상태의 영수증이 달라.');return false;}
 if(['rejected','applied','interrupted'].includes(row.status))fail('이미 마친 소모품 사용 상태를 바꿀 수 없어.');
 if(args.status==='rejected'&&row.status!=='reserved')fail('이미 수락된 소모품은 환불할 수 없어.');
 if(args.status==='interrupted'&&row.status!=='accepted')fail('수락 영수증이 없는 소모품을 소모 확정할 수 없어.');
 if(args.status!=='rejected'&&!row.charged){
  const item=run.nodes158.consumables[row.item_id];
  if(!item||item.acquisition_id!==row.acquisition_id||item.remaining<1)fail('소모품 획득 기록과 남은 횟수가 달라.');
  item.remaining--;row.charged=true;
  if(item.remaining===0){
   if(!run.relics.includes(row.item_id))fail('소진할 소모품의 보유 기록이 없어.');
   run.relics.splice(run.relics.indexOf(row.item_id),1);
   run.nodes158.relic_losses.push({id:row.use_id,node_id:run.current_node_id,relic_id:row.item_id,acquisition_id:row.acquisition_id,kind:'consumed',use_id:row.use_id});
  }
 }
 row.status=args.status;row.receipt_sha256=args.receipt_sha256;row.reason=args.reason??'';
 return true;
}
export function consumableChoices158(run){
 const metas=run.content158?.document?.relics??[];
 return CONSUMABLE_IDS158.flatMap(item_id=>{
  if(!run.relics.includes(item_id))return [];
  const meta=metas.find(row=>row.id===item_id),item=run.nodes158?.consumables?.[item_id];if(!meta||!item)return [];
  const pending=run.nodes158.uses.find(row=>active(row));
  const reason=run.state!=='in_battle'||run.bridge147?.phase!=='duel_started'?'전투 중에 사용할 수 있어.':pending?'이전 사용 요청을 처리 중이야.':item.remaining<1?'남은 사용 횟수가 없어.':'';
  return [{item_id,name:meta.name,description:meta.description,remaining:item.remaining,total:item.total,params:structuredClone(meta.params),disabled:!!reason,reason,pending_use_id:pending?.use_id??null}];
 });
}
