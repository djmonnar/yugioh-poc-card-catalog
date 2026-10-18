import {transition157 as legacyTransition157} from './roguelite157-progress.js?v=20261017-157';
import {transition154 as legacyTransition154} from './roguelite154-progress.js?v=20261017-154';
import {normalizeRun,commitRunDeck,resolveRestChoice} from './roguelite158-core.js?v=20261017-158';
import {applyNodeAction150,isEmptyNodes150,emptyNodes158,makeSpecialReward158} from './roguelite158-nodes.js?v=20261017-158';
import {prepareCardReward,selectCardReward} from './roguelite158-rewards.js?v=20261017-158';
import {rewardPolicy,MAX_RUN_LP,validateDuelRelics154,pickRelic158,relicMeta158} from './roguelite158-rules.js?v=20261017-158';
import {grant158,acquireRelic158} from './roguelite158-ledger.js?v=20261017-158';
import {reserveUse158,commitUse158} from './roguelite158-consumables.js?v=20261017-158';
import {cleanRecipes158} from './roguelite158-recipes.js?v=20261017-158';
import {cleanLibrary158,FIELD_OPTIONS158} from './expedition-content158-core.js?v=20261017-158';
const fail=m=>{throw Error(m);},clone=structuredClone;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=(v,min,max,label)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail(`${label} 값을 확인해줘.`);return v;};
const identifier=(v,label)=>{if(!id(v))fail(`${label} 형식을 확인해줘.`);return v;};
const digest=(v,label)=>{if(!hash(v))fail(`${label} 지문을 확인해줘.`);return v;};
const bridge=run=>run.bridge147||{schema:1,phase:'idle',attempt:null,results:[]};
const battle=kind=>['battle','elite','midboss','boss'].includes(kind);
export function reachableNodes(run){if(!run?.map||run.state!=='between_nodes'||!['idle','resolved'].includes(bridge(run).phase)||run.lp<1||run.nodes158?.pending_reward)return [];return run.current_node_id===null?run.map.nodes.filter(n=>n.floor===1).map(n=>n.id):[...(run.map.nodes.find(n=>n.id===run.current_node_id)?.next||[])];}
function destination(run,nodeId){if(!reachableNodes(run).includes(nodeId))fail('현재 위치에서 이어지는 다음 칸을 선택해줘.');return run.map.nodes.find(n=>n.id===nodeId);}
function sameAttempt(run,args){const a=bridge(run).attempt;if(!a||a.attempt_id!==args.attempt_id)fail('현재 전투 시도와 요청이 달라.');return a;}
function finished(run,now){run.revision++;run.updated_at=new Date(now).toISOString();return normalizeRun(run);}
function challengeEvent(run,nodeId){const e=run.nodes158.events[nodeId];return e?.kind==='challenge_duel'&&e.choice==='accept'&&e.challenge?e:null;}
function claimVictoryRelic(run,seed,cards,kind){
 const excluded=[],rarities=['elite','midboss'].includes(kind)?['N','R','SR']:null;
 for(let i=0;i<14;i++){
  const picked=pickRelic158(run,seed,{excluded,rarities});if(!picked)break;
  const trial=clone(run);try{acquireRelic158(trial,picked,`victory158_${run.bridge147.attempt.attempt_id}`,cards);Object.assign(run,trial);return {relic_id:picked,reason:''};}catch{excluded.push(picked);}
 }
 return {relic_id:null,reason:'획득 가능한 미보유 유물이 없어. 활성화·등급·카드 지급 후보를 확인해줘.'};
}
function settle(run,args,cards,now){
 let b=bridge(run);const a=sameAttempt(run,args),resultId=identifier(args.result_id,'결과 번호'),resultHash=digest(args.result_sha256,'결과');
 if(args.session_id!==a.session_id||args.launch_nonce!==a.launch_nonce||args.launch_sha256!==a.launch_sha256||args.reward_pool_sha256!==a.reward_pool_sha256)fail('이 전투의 완료 기록을 확인할 수 없어.');
 const prior=b.results.find(r=>r.result_id===resultId);
 if(prior){if(prior.result_sha256!==resultHash||prior.attempt_id!==a.attempt_id||prior.player_result!==args.player_result||prior.player_end_lp!==args.player_end_lp||prior.opponent_end_lp!==args.opponent_end_lp||prior.completed_turns!==args.completed_turns)fail('같은 결과 번호의 내용이 달라.');return run;}
 if(b.phase!=='duel_started'||!['win','loss','draw'].includes(args.player_result))fail('이 전투의 완료 기록을 확인할 수 없어.');
 if(run.nodes158.uses.some(r=>['reserved','accepted'].includes(r.status)))fail('소모품의 확정·중단 처리를 먼저 마쳐줘.');
 const end=integer(args.player_end_lp,0,run.max_lp,'종료 LP'),e=challengeEvent(run,a.node_id);
 const result={result_id:resultId,attempt_id:a.attempt_id,node_id:a.node_id,result_sha256:resultHash,player_result:args.player_result,player_end_lp:end,opponent_end_lp:integer(args.opponent_end_lp,0,65535,'상대 종료 LP'),completed_turns:integer(args.completed_turns,0,100000,'종료 턴')};
 run.lp=end;a.result_id=resultId;b.results.push(result);run.history.push({kind:'duel_result',...result,recorded_end_lp:end});
 if(e){e.challenge.result_id=resultId;e.challenge.status=args.player_result==='win'&&end>0?'won':args.player_result==='draw'&&end>0?'draw':'lost';}
 if(args.player_result==='win'&&end>0){
  if(e){makeSpecialReward158(run,e,'challenge_duel');run.state='reward_pending';b.phase='reward_pending';}
  else{
   const node=run.map.nodes.find(n=>n.id===a.node_id),policy=rewardPolicy(node.kind,run),bias=run.nodes158.race_bias;
   run.reward_track=prepareCardReward(run.reward_track,{offerId:`reward_${a.attempt_id}`,seed:a.reward_seed,area:run.area??1,kind:node.kind,cards,choices:policy.card_choices,raceBias:bias?{race:bias.race,multiplier:bias.multiplier}:null});
   run.gold=integer(run.gold+policy.gold,0,2e9,'원정 금화');run.lp=Math.min(run.max_lp,run.lp+policy.heal);
   if(policy.relic){const awarded=claimVictoryRelic(run,`victory158:${a.reward_seed}`,cards,node.kind);run.history.push({kind:'relic',node_id:a.node_id,...awarded});b=bridge(run);}
   run.state='reward_pending';b.phase='reward_pending';
  }
 }else if(args.player_result==='loss'||end===0){run.state='defeated';b.phase='resolved';if(e)e.status='resolved';}
 else{run.state='at_node';b.phase='resolved';if(e)e.status='battle_pending';}
 run.bridge147=b;return finished(run,now);
}
export function transition158(input){
 if(input?.schema!==1)fail('지원하지 않는 게임 연결 버전이야.');
 if(input.action!=='bind'&&input.run?.bridge147&&input.run.content158===undefined)return input.run.content157===undefined?legacyTransition154(input):legacyTransition157(input);
 let run=normalizeRun(input.run),b=bridge(run);const args=input.args||{},now=input.now||new Date().toISOString();
 if(input.action==='bind'){
  if(['content157','content158','nodes158','recipe_book158','relic_choices158'].some(k=>Object.hasOwn(input.run,k)))fail('시작 정책·소환 식·확장 기록은 게임 서버에서만 지정할 수 있어.');
  if(run.bridge147||!isEmptyNodes150(run.nodes150)||run.state!=='between_nodes'||run.reward_track.pending||!run.map||run.lp!==4000||run.max_lp!==4000||run.gold!==0||run.floor!==0||run.current_node_id!==null||run.relics.length||run.history.length||run.rest_claims.length||run.reward_claims.length||run.reward_track.offers.length||run.reward_track.sr_misses||run.reward_track.ur_misses)fail('아직 진행하지 않은 원정 준비본만 처음 연결할 수 있어.');
  run.content158=cleanLibrary158(input.expedition_content158);run.recipe_book158=cleanRecipes158(input.recipes158);run.nodes158=emptyNodes158();run.relic_choices158={};run.bridge147=b;return normalizeRun(run);
 }
 if(!run.bridge147||!run.content158)fail('먼저 원정을 게임에 연결해줘.');
 if(run.max_lp>MAX_RUN_LP)fail('게임 연결 원정의 최대 LP는 60,000까지야.');
 integer(input.expected_revision,0,Number.MAX_SAFE_INTEGER,'기대 버전');
 if(input.action==='settle_result')return settle(run,args,input.cards,now);
 if(input.expected_revision!==run.revision)fail('게임의 원정 저장이 바뀌었어. 최신 진행을 다시 불러와줘.');
 if(input.action==='reserve_use158'||input.action==='commit_use158'){
  const changed=input.action==='reserve_use158'?reserveUse158(run,args):commitUse158(run,args);return changed?finished(run,now):run;
 }
 if(['enter_node','buy_card','remove_card','event_choice','leave_node','pass_node'].includes(input.action)){
  const result=applyNodeAction150(run,input.action==='pass_node'?'enter_node':input.action,args,input.cards,{normalize:normalizeRun});return result.changed?finished(result.run,now):result.run;
 }
 if(input.action==='choose_reward'){
  const special=run.nodes158.pending_reward;
  if(special){
   if(special.id!==args.offer_id)fail('현재 대기 중인 특별 보상과 요청이 달라.');const card=special.candidates.find(c=>c.identity_key===args.identity_key);if(!card)fail('특별 보상 후보 중 한 장을 골라줘.');
   if(special.kind==='challenge_duel'&&(run.state!=='reward_pending'||b.phase!=='reward_pending')||special.kind==='twin_sacrifice'&&(run.state!=='at_node'||!['idle','resolved'].includes(b.phase)))fail('특별 보상을 선택할 수 있는 상태가 아니야.');
   grant158(run,card,1,special.id);special.chosen_identity_key=card.identity_key;run.nodes158.reward_offers.push(special);run.nodes158.pending_reward=null;run.nodes158.events[special.node_id].status='resolved';run.state='at_node';b.phase='resolved';
  }else{
   const prior=run.nodes158.reward_offers.find(o=>o.id===args.offer_id);if(prior){if(prior.chosen_identity_key!==args.identity_key)fail('이 특별 보상에서는 이미 다른 카드를 골랐어.');return run;}
   if(b.phase!=='reward_pending'||run.state!=='reward_pending')fail('먼저 실제 전투 보상을 확인해줘.');
   const offer=run.reward_track.pending;if(args.offer_id!==offer.id)fail('현재 대기 중인 보상과 요청이 달라.');const card=offer.candidates.find(c=>c.identity_key===args.identity_key);if(!card)fail('현재 보상 후보 중 한 장을 골라줘.');
   run.reward_track=selectCardReward(run.reward_track,offer.id,card.identity_key);grant158(run,card,1,offer.id);b.phase='resolved';run.state=run.map.nodes.find(n=>n.id===run.current_node_id).kind==='boss'?'completed':'between_nodes';
  }
 }else if(input.action==='set_relic_choice'){
  if(!['between_nodes','at_node'].includes(run.state)||!['idle','resolved'].includes(b.phase)||run.nodes158.pending_reward)fail('전투나 보상 처리 중에는 유물 선택을 바꿀 수 없어.');
  if(args.relic_id==='field_legacy'){
   if(!run.relics.includes('field_legacy')||!FIELD_OPTIONS158.some(f=>f.id===args.field_id)||!relicMeta158(run,'field_legacy').params.fields.includes(args.field_id))fail('보유한 태고의 지형의 허용 필드를 골라줘.');
   const old=run.relic_choices158.field_legacy;if(old){if(old!==args.field_id)fail('이번 원정에서 한 번 고른 시작 필드는 바꿀 수 없어.');return run;}
   run.relic_choices158.field_legacy=args.field_id;run.history.push({kind:'relic_choice158',relic_id:'field_legacy',field_id:args.field_id});
  }else{
   if(args.relic_id!=='destiny_draw'||!run.relics.includes('destiny_draw')||!hash(args.identity_key)||!run.active_deck.groups.main.some(r=>r.identity_key===args.identity_key&&r.count>0))fail('보유한 운명의 패와 현재 메인 덱 카드 1장을 골라줘.');
   if(run.relic_choices154.destiny_draw===args.identity_key)return run;run.relic_choices154.destiny_draw=args.identity_key;run.history.push({kind:'relic_choice154',relic_id:'destiny_draw',identity_key:args.identity_key});
  }
 }else if(input.action==='prepare'){
  validateDuelRelics154(run);if(run.nodes158.pending_reward||run.reward_track.pending)fail('먼저 대기 중인 보상을 골라줘.');
  const event=challengeEvent(run,args.node_id),atCurrent=run.state==='at_node'&&run.current_node_id===args.node_id&&['idle','resolved'].includes(b.phase);
  const node=atCurrent?run.map.nodes.find(n=>n.id===args.node_id):destination(run,args.node_id);
  if(event){if(!atCurrent||event.status!=='battle_pending'||!['accepted','draw'].includes(event.challenge.status))fail('수락한 특별 결투를 선택해줘.');}
  else if(!battle(node.kind)||!run.encounters[node.id])fail('상대가 지정된 전투 칸을 선택해줘.');
  if(run.lp<1)fail('LP가 없어 전투를 시작할 수 없어.');
  const retry=atCurrent&&b.attempt?.node_id===node.id,rewardSeed=retry?b.attempt.reward_seed:identifier(args.reward_seed,'보상 시드');
  b.attempt={attempt_id:identifier(args.attempt_id,'전투 시도'),node_id:node.id,session_id:identifier(args.session_id,'게임 세션'),launch_nonce:identifier(args.launch_nonce,'실행 번호'),reward_seed:rewardSeed,reward_pool_sha256:digest(args.reward_pool_sha256,'보상 풀'),prebattle_revision:run.revision,start_lp:run.lp,max_lp:run.max_lp,launch_sha256:null,result_id:null};
  if(event){event.challenge.attempt_id=b.attempt.attempt_id;event.challenge.result_id=null;event.challenge.status='in_battle';}
  b.phase='prepared';run.floor=node.floor;run.current_node_id=node.id;run.state='in_battle';
 }else if(input.action==='start_ack'){
  validateDuelRelics154(run);const a=sameAttempt(run,args);if(b.phase!=='prepared')fail('준비된 전투만 시작할 수 있어.');a.launch_sha256=digest(args.launch_sha256,'시작 패킷');b.phase='duel_started';
 }else if(input.action==='cancel_prepared'){
  const a=sameAttempt(run,args);if(b.phase!=='prepared')fail('게임이 시작된 전투는 취소할 수 없어.');b.phase='resolved';run.state='at_node';const e=challengeEvent(run,a.node_id);if(e)e.challenge.status='accepted';
 }else if(input.action==='mark_interrupted'){
  sameAttempt(run,args);if(b.phase!=='duel_started')fail('시작된 전투만 중단 기록을 남길 수 있어.');if(run.nodes158.uses.some(r=>['reserved','accepted'].includes(r.status)))fail('먼저 소모품 사용의 중단 영수증을 확정해줘.');b.phase='interrupted';
 }else if(input.action==='recover_interrupted'){
  const a=sameAttempt(run,args);if(b.phase!=='interrupted')fail('중단된 전투만 다시 준비할 수 있어.');run.lp=a.start_lp;run.max_lp=a.max_lp;a.session_id=identifier(args.session_id,'새 게임 세션');a.launch_nonce=identifier(args.launch_nonce,'새 실행 번호');a.launch_sha256=null;b.phase='prepared';run.history.push({kind:'interrupted_retry',attempt_id:a.attempt_id,node_id:a.node_id});
 }else if(input.action==='rest'){
  const node=destination(run,args.node_id);if(node.kind!=='rest')fail('휴식 칸을 선택해줘.');const revision=run.revision;run.floor=node.floor;run.current_node_id=node.id;run.state='at_node';run=resolveRestChoice(run,node.id,args.choice,{now,cards:input.cards});run.revision=revision;b=bridge(run);b.phase='resolved';run.history.push({kind:'rest',node_id:node.id,choice:args.choice});
 }else if(input.action==='sync_deck'){
  if(!['idle','resolved'].includes(b.phase)||run.nodes158.pending_reward)fail('전투나 보상 처리 중에는 덱을 바꿀 수 없어.');const revision=run.revision;run=commitRunDeck(run,args.draft,{now});run.revision=revision;b=bridge(run);
 }else fail('지원하지 않는 원정 명령이야.');
 run.bridge147=b;return finished(run,now);
}
export const transition154=transition158,transition147=transition158;
