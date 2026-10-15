// Run-host rules. Native duel completion will supply the real LP/result later.
export const MAX_RUN_LP = 60000;
export const REST_CHOICES = Object.freeze([
  Object.freeze({id:'max_lp',name:'생명의 그릇',description:'최대 LP +500. 현재 LP는 그대로야.'}),
  Object.freeze({id:'heal',name:'완전한 휴식',description:'현재 LP를 최대 LP까지 모두 회복해.'}),
  Object.freeze({id:'relic',name:'봉인된 유물',description:'아직 갖고 있지 않은 유물 1개를 무작위로 얻어.'})
]);
export const RELICS = Object.freeze([
  Object.freeze({id:'golden_scarab',name:'황금 풍뎅이',description:'전투 승리 시 원정 금화 +20.',win_gold:20}),
  Object.freeze({id:'restoring_ankh',name:'재생의 앙크',description:'전투 승리 시 LP 200 회복.',win_heal:200}),
  Object.freeze({id:'card_slate',name:'카드의 석판',description:'전투 카드 보상 후보 +1. 기본 5장에서 6장으로 늘어나.',reward_choices:1}),
  Object.freeze({id:'merchant_seal',name:'상인의 인장',description:'원정 상점 가격 15% 할인.',shop_discount:0.15}),
  Object.freeze({id:'life_fragment',name:'생명의 조각',description:'획득 즉시 최대 LP +250. 현재 LP는 그대로야.',max_lp:250})
]);
export const BATTLE_REWARDS = Object.freeze({
  // min_rarity guarantees one candidate; other candidates use the area odds.
  battle:Object.freeze({gold:50,card_choices:5,min_rarity:'N',relic:false}),
  elite:Object.freeze({gold:120,card_choices:5,min_rarity:'SR',relic:true}),
  boss:Object.freeze({gold:200,card_choices:5,min_rarity:'UR',relic:true})
});
const fail = message => {throw new Error(message);};
function hash(text){let value=2166136261;for(const char of text){value^=char.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;}
export function rewardPolicy(kind,relics=[]){
  const base=BATTLE_REWARDS[kind==='midboss'?'elite':kind];if(!base)fail('전투 종류를 확인해줘.');
  const owned=RELICS.filter(r=>relics.includes(r.id));
  return {...base,gold:base.gold+owned.reduce((n,r)=>n+(r.win_gold||0),0),card_choices:base.card_choices+owned.reduce((n,r)=>n+(r.reward_choices||0),0),heal:owned.reduce((n,r)=>n+(r.win_heal||0),0)};
}
export function restOutcome({lp,max_lp,relics=[],seed,nodeId},choice){
  if(!Number.isSafeInteger(max_lp)||max_lp<1||max_lp>MAX_RUN_LP||!Number.isSafeInteger(lp)||lp<1||lp>max_lp)fail('휴식 전 LP를 60,000 이하로 확인해줘.');
  if(!Array.isArray(relics)||new Set(relics).size!==relics.length||!relics.every(id=>typeof id==='string'))fail('유물 목록을 확인해줘.');
  if(typeof seed!=='string'||!seed||typeof nodeId!=='string'||!nodeId)fail('휴식 장소를 확인해줘.');
  const next={lp,max_lp,relics:[...relics],relic_id:null};
  if(choice==='max_lp'){
    if(max_lp>MAX_RUN_LP-500)fail('최대 LP가 60,000 한계에 도달해 다른 휴식을 선택해야 해.');
    next.max_lp+=500;
  }else if(choice==='heal'){
    if(lp===max_lp)fail('이미 LP가 가득 차 있어. 다른 휴식을 선택해줘.');
    next.lp=max_lp;
  }else if(choice==='relic'){
    const candidates=RELICS.filter(r=>!relics.includes(r.id)&&max_lp+(r.max_lp||0)<=MAX_RUN_LP);
    if(!candidates.length)fail('받을 수 있는 유물을 모두 갖고 있어. 다른 휴식을 선택해줘.');
    const selected=candidates[hash(`rest138|${seed}|${nodeId}`)%candidates.length];
    next.relic_id=selected.id;next.relics.push(selected.id);next.max_lp+=selected.max_lp||0;
  }else fail('휴식 선택지를 확인해줘.');
  return next;
}
export function cleanRestClaims(claims,map,relics){
  if(!Array.isArray(claims)||claims.length>100)fail('휴식 기록을 확인할 수 없어.');
  const seen=new Set();
  return claims.map(claim=>{
    if(!claim||typeof claim!=='object'||Array.isArray(claim))fail('휴식 기록 형식이 올바르지 않아.');
    const node=map?.nodes.find(n=>n.id===claim.node_id);
    if(!node||node.kind!=='rest'||seen.has(node.id))fail('휴식 장소가 없거나 휴식 기록이 중복돼 있어.');
    if(!REST_CHOICES.some(c=>c.id===claim.choice))fail('휴식 선택 기록이 올바르지 않아.');
    if(claim.choice==='relic'){
      if(!RELICS.some(r=>r.id===claim.relic_id)||!relics.includes(claim.relic_id))fail('휴식 유물 기록과 보유 유물이 일치하지 않아.');
    }else if(claim.relic_id!==null)fail('휴식 선택과 유물 기록이 일치하지 않아.');
    seen.add(node.id);return {node_id:node.id,choice:claim.choice,relic_id:claim.relic_id};
  });
}
