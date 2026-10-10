const sameCard=(a,b)=>a.slot===b.slot&&a.internal_id===b.internal_id&&a.identity_key===b.identity_key;
export const poolCardSelected=(pool,card)=>pool?.entries.some(entry=>sameCard(entry.card,card))===true;

// Keep existing weights while toggling other cards. Removing the final
// candidate removes the reward, so the empty draft remains valid and savable.
export function togglePoolCard(rewards,pool,card){
  if(pool){
    const rewardIndex=rewards.indexOf(pool);if(rewardIndex<0)throw new Error('보상 목록이 바뀌었어. 다시 열어줘.');
    const index=pool.entries.findIndex(entry=>sameCard(entry.card,card));
    if(index>=0){
      pool.entries.splice(index,1);
      if(!pool.entries.length){rewards.splice(rewardIndex,1);return null;}
    }else{
      if(pool.entries.length>=100)throw new Error('후보 카드는 100장까지야. 선택한 카드를 다시 누르면 취소돼.');
      pool.entries.push({card:structuredClone(card),weight:1});
    }
    return pool;
  }
  if(rewards.length>=20)throw new Error('보상은 종류별 20개까지야.');
  const added={kind:'card_pool',count:1,entries:[{card:structuredClone(card),weight:1}]};rewards.push(added);return added;
}
