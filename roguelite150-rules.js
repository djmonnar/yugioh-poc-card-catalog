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

// Shop/event prices do not touch battle reward odds or pity. Prices are quoted
// from the current relic inventory; stored merchandise keeps its base price.
export const SHOP_PRICES150=Object.freeze({N:50,R:100,SR:180,UR:300});
export function shopPrice150(base,relics=[]){
  if(!Number.isSafeInteger(base)||base<0||base>2000000000)throw new Error('상점 기본 가격을 확인해줘.');
  return relics.includes('merchant_seal')?Math.floor(base*85/100):base;
}
export const EVENTS150=Object.freeze([
  Object.freeze({id:'healing_pool',title:'수호자의 샘',description:'돌 수호자가 별빛이 담긴 샘을 가리킨다. 작은 공물을 놓으면 상처가 아물 듯하다.',name:'금화 50을 바치고 LP 1,000 회복',effect:'원정 금화 -50 · LP +1,000 (최대 LP까지)'}),
  Object.freeze({id:'life_inscription',title:'생명의 비문',description:'빛나는 비문이 맥박에 맞춰 반짝인다. 잠깐의 생명력을 내어주면 생명의 그릇을 넓힐 수 있다.',name:'LP 300을 바치고 최대 LP +500',effect:'현재 LP -300 · 최대 LP +500 (현재 LP 추가 회복 없음)'}),
  Object.freeze({id:'golden_idol',title:'황금 우상의 계약',description:'황금 우상이 동전 한 줌을 내민다. 대가를 치를지, 아무것도 받지 않고 지나갈지는 너의 선택이다.',name:'LP 500을 바치고 금화 120 획득',effect:'현재 LP -500 · 원정 금화 +120'}),
  Object.freeze({id:'mirror_exchange',title:'가능성의 거울',description:'거울 속 카드의 그림이 천천히 바뀐다. 카드 한 장을 비추면 같은 등급의 다른 가능성과 교환할 수 있다.',name:'보유 카드 1장을 같은 등급의 다른 카드로 교환',effect:'선택 카드 1매 영구 반납 · 같은 등급 카드 1매 획득'}),
  Object.freeze({id:'card_reforge',title:'봉인된 연성로',description:'오래된 연성로에 희미한 불꽃이 남아 있다. 카드와 금화를 바치면 한 단계 높은 힘이 깨어난다.',name:'금화 75와 카드 1장을 바치고 등급 상향',effect:'원정 금화 -75 · N→R / R→SR / SR→UR 카드 1매 교환'}),
  Object.freeze({id:'relic_bargain',title:'잊힌 유물의 수집가',description:'방랑하는 수집가가 아직 손에 넣지 못한 유물 하나를 펼쳐 보인다. 그는 동전 대신 생명력을 원한다.',name:'LP 800을 바치고 미보유 유물 획득',effect:'현재 LP -800 · 아직 보유하지 않은 유물 1개 획득'})
]);
