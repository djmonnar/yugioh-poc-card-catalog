// Presentation and uncertain-response observation only. The host owns grants.
export {filterNodeCards150,deckCopies150,shouldApplyCheckpoint150,priceText150} from './roguelite150-present.js?v=20261018-163';
export function nodeResultObserved150(action,args,before,after){
  if(!after||after.id!==before.id||after.revision<=before.revision)return false;
  const node=after.nodes163?.shops?.[args.node_id]||after.nodes163?.events?.[args.node_id]||after.nodes158?.shops?.[args.node_id]||after.nodes158?.events?.[args.node_id]||after.nodes150?.shops?.[args.node_id]||after.nodes150?.events?.[args.node_id];
  if(action==='enter_node')return after.current_node_id===args.node_id&&after.state==='at_node'&&node?.status==='open';
  if(action==='leave_node')return node?.status==='left'&&after.state==='between_nodes';
  if(action==='sell_card')return after.history.some(h=>h.kind==='shop_sell163'&&h.node_id===args.node_id&&h.instance_id===args.instance_id);
  if(action==='refresh_shop')return node?.shop_version===164&&node.refresh_count>(before.nodes163?.shops?.[args.node_id]?.refresh_count??0)&&after.history.some(h=>h.kind==='shop_refresh164'&&h.node_id===args.node_id);
  if(action==='remove_card')return node?.removal_used===true;
  if(action==='event_choice')return node?.choice===args.choice&&(node.status==='resolved'||Boolean(node.challenge)||Boolean((after.nodes163??after.nodes158)?.pending_reward));
  if(action==='buy_card'&&[158,163,164].includes(node?.shop_version)){
    const old=(before.nodes163??before.nodes158)?.shops?.[args.node_id],item=node.cards?.find(row=>row.id===args.item_id),previous=old?.cards?.find(row=>row.id===args.item_id);
    return item&&previous&&item.remaining<previous.remaining||node.relics?.some(row=>row.id===args.item_id&&row.purchased===true);
  }
  if(action==='buy_card')return node?.shop_version===157
    ?[...(node.cards||[]),...(node.relics||[])].some(row=>row.id===args.item_id&&row.purchased===true)
    :args.item_id==='relic'?node?.relic?.purchased===true:node?.cards?.some(row=>row.id===args.item_id&&row.purchased===true);
  return false;
}
export const pendingReward163=run=>run?.nodes163?.pending_reward??run?.nodes159?.pending_reward??run?.nodes158?.pending_reward??run?.reward_track?.pending??null;
export const battleOpponent163=(run,attempt)=>run?.encounters?.[attempt?.node_id]??run?.nodes163?.events?.[attempt?.node_id]?.challenge?.encounter??run?.nodes158?.events?.[attempt?.node_id]?.challenge?.encounter??null;
export function selectedDeckKeys163(selection){return [...selection].flatMap(([key,count])=>Array.from({length:count},()=>key));}
export function canSacrificeTwo163(run,rows,selection){
  const keys=selectedDeckKeys163(selection);if(keys.length!==2)return {valid:false,reason:'덱에서 바칠 카드 정확히 2매를 골라줘.'};
  for(const [key,count] of selection){const row=rows.find(row=>row.identity_key===key);if(!Number.isSafeInteger(count)||count<1||!row||count>row.count)return {valid:false,reason:'선택한 매수만큼 덱에 있는 카드를 골라줘.'};}
  const removedMain=keys.filter(key=>rows.find(row=>row.identity_key===key)?.group==='main').length;
  if(run.active_deck.groups.main.reduce((sum,row)=>sum+row.count,0)-removedMain<20)return {valid:false,reason:'메인 덱은 20장 이상 남아야 해. 다른 카드를 골라줘.'};
  return {valid:true,reason:''};
}
