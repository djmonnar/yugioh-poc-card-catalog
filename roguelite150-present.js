// Display helpers only. The host decides availability, prices and grants.
export function filterNodeCards150(choices,query=''){
  const term=String(query).trim().normalize('NFC').toLocaleLowerCase('ko').replace(/^#/,'');
  return choices.filter(({card})=>!term||[card.name_ko,card.name_en,card.description_ko,card.race,card.attribute,card.type,card.subtype,card.slot,card.internal_id,...(card.tags||[])].join(' ').normalize('NFC').toLocaleLowerCase('ko').includes(term));
}
export function deckCopies150(run,identityKey){
  return ['main','extra'].reduce((total,group)=>total+(run.active_deck.groups[group].find(row=>row.identity_key===identityKey)?.count||0),0);
}
export function shouldApplyCheckpoint150(existing,incoming){
  return !(existing?.id===incoming.id&&existing.revision>incoming.revision);
}
export function priceText150(base,price){
  return base===price?`${price.toLocaleString()} 금화`:`${price.toLocaleString()} 금화 · 원래 ${base.toLocaleString()}`;
}
export function nodeResultObserved150(action,args,before,after){
  if(!after||after.id!==before.id||after.revision<=before.revision)return false;
  const node=after.nodes150?.shops?.[args.node_id]||after.nodes150?.events?.[args.node_id];
  if(action==='enter_node')return after.current_node_id===args.node_id&&after.state==='at_node'&&node?.status==='open';
  if(action==='leave_node')return node?.status==='left'&&after.state==='between_nodes';
  if(action==='remove_card')return node?.removal_used===true;
  if(action==='event_choice')return node?.status==='resolved'&&node.choice===args.choice;
  if(action==='buy_card')return args.item_id==='relic'?node?.relic?.purchased===true:node?.cards?.some(row=>row.id===args.item_id&&row.purchased===true);
  return false;
}
