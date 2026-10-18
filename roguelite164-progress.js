import {transition163} from './roguelite163-progress.js?v=20261018-163';
import {cleanCampaignLibrary164} from './campaign164-core.js?v=20261018-164';
import {initCampaign164,completeChapter164} from './roguelite164-core.js?v=20261018-164';
import {transition159 as legacyTransition158} from './roguelite159-progress.js?v=20261017-159';
import {transition157 as legacyTransition157} from './roguelite157-progress.js?v=20261017-157';
import {transition154 as legacyTransition154} from './roguelite154-progress.js?v=20261017-154';
import {normalizeRun,commitRunDeck,resolveRestChoice} from './roguelite164-core.js?v=20261018-164';
import {applyNodeAction150,isEmptyNodes150,emptyNodes163,makeSpecialReward163} from './roguelite164-nodes.js?v=20261018-164';
import {prepareCardReward,selectCardReward} from './roguelite163-rewards.js?v=20261018-163';
import {rewardPolicy,MAX_RUN_LP,validateDuelRelics154,pickRelic163,relicMeta163,relicChoiceOptions163} from './roguelite163-rules.js?v=20261018-163';
import {grant163,acquireRelic163} from './roguelite163-ledger.js?v=20261018-163';
import {reserveUse163,commitUse163} from './roguelite163-consumables.js?v=20261018-163';
import {cleanThemes163} from './roguelite163-themes.js?v=20261018-163';
import {cleanRecipes163} from './roguelite163-recipes.js?v=20261018-163';
import {cleanLibrary163,FIELD_OPTIONS163} from './expedition-content163-core.js?v=20261018-163';
import {createInstances163} from './roguelite163-instances.js?v=20261018-163';
import {makeOpening163,chooseOpening163,emptyRuntime163,pendingForge163,forgeCard163,syncProgress163} from './roguelite163-opening.js?v=20261018-163';
import {eligibleRewardCards} from './roguelite-rewards.js?v=20261014-139';
import {deterministic163} from './roguelite163-recipes.js?v=20261018-163';
import {snapshotCard} from './roguelite-card.js?v=20261014-139';
const fail=m=>{throw Error(m);},clone=structuredClone;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=(v,min,max,label)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail(`${label} 값을 확인해줘.`);return v;};
const identifier=(v,label)=>{if(!id(v))fail(`${label} 형식을 확인해줘.`);return v;};
const digest=(v,label)=>{if(!hash(v))fail(`${label} 지문을 확인해줘.`);return v;};
const bridge=run=>run.bridge147||{schema:1,phase:'idle',attempt:null,results:[]};
const battle=kind=>['battle','elite','midboss','boss'].includes(kind);
export function reachableNodes(run){if(!run?.map||run.state!=='between_nodes'||!['idle','resolved'].includes(bridge(run).phase)||run.lp<1||run.nodes163?.pending_reward||run.runtime163?.rest_reward||run.opening163?.status==='pending'||run.content163&&pendingForge163(run))return [];return run.current_node_id===null?run.map.nodes.filter(n=>n.floor===1).map(n=>n.id):[...(run.map.nodes.find(n=>n.id===run.current_node_id)?.next||[])];}
function destination(run,nodeId){if(!reachableNodes(run).includes(nodeId))fail('현재 위치에서 이어지는 다음 칸을 선택해줘.');return run.map.nodes.find(n=>n.id===nodeId);}
function sameAttempt(run,args){const a=bridge(run).attempt;if(!a||a.attempt_id!==args.attempt_id)fail('현재 전투 시도와 요청이 달라.');return a;}
function finished(run,now){run.revision++;run.updated_at=new Date(now).toISOString();return normalizeRun(run);}
function challengeEvent(run,nodeId){const e=run.nodes163.events[nodeId];return e?.kind==='challenge_duel'&&e.choice==='accept'&&e.challenge?e:null;}
function claimVictoryRelic(run,seed,cards,kind){
 const excluded=[],rarities=['elite','midboss'].includes(kind)?['N','R','SR']:null;
 for(let i=0;i<23;i++){
  const picked=pickRelic163(run,seed,{excluded,rarities});if(!picked)break;
  const trial=clone(run);try{acquireRelic163(trial,picked,`victory163_${run.bridge147.attempt.attempt_id}`,cards);Object.assign(run,trial);return {relic_id:picked,reason:''};}catch{excluded.push(picked);}
 }
 return {relic_id:null,reason:'획득 가능한 미보유 유물이 없어. 활성화·등급·카드 지급 후보를 확인해줘.'};
}
function settle(run,args,cards,now){
 let b=bridge(run);const a=sameAttempt(run,args),resultId=identifier(args.result_id,'결과 번호'),resultHash=digest(args.result_sha256,'결과');
 if(args.session_id!==a.session_id||args.launch_nonce!==a.launch_nonce||args.launch_sha256!==a.launch_sha256||args.reward_pool_sha256!==a.reward_pool_sha256)fail('이 전투의 완료 기록을 확인할 수 없어.');
 const prior=b.results.find(r=>r.result_id===resultId);
 if(prior){if(prior.result_sha256!==resultHash||prior.attempt_id!==a.attempt_id||prior.player_result!==args.player_result||prior.player_end_lp!==args.player_end_lp||prior.opponent_end_lp!==args.opponent_end_lp||prior.completed_turns!==args.completed_turns)fail('같은 결과 번호의 내용이 달라.');return run;}
 if(b.phase!=='duel_started'||!['win','loss','draw'].includes(args.player_result))fail('이 전투의 완료 기록을 확인할 수 없어.');
 if(run.nodes163.uses.some(r=>['reserved','accepted'].includes(r.status)))fail('소모품의 확정·중단 처리를 먼저 마쳐줘.');
 const end=integer(args.player_end_lp,0,run.max_lp,'종료 LP'),e=challengeEvent(run,a.node_id);
 const result={result_id:resultId,attempt_id:a.attempt_id,node_id:a.node_id,result_sha256:resultHash,player_result:args.player_result,player_end_lp:end,opponent_end_lp:integer(args.opponent_end_lp,0,65535,'상대 종료 LP'),completed_turns:integer(args.completed_turns,0,100000,'종료 턴')};
 run.lp=end;a.result_id=resultId;b.results.push(result);run.history.push({kind:'duel_result',...result,recorded_end_lp:end});
 if(e){e.challenge.result_id=resultId;e.challenge.status=args.player_result==='win'&&end>0?'won':args.player_result==='draw'&&end>0?'draw':'lost';}
 if(args.player_result==='win'&&end>0){
  if(e){makeSpecialReward163(run,e,'challenge_duel');run.state='reward_pending';b.phase='reward_pending';}
  else{
   const node=run.map.nodes.find(n=>n.id===a.node_id),policy=rewardPolicy(node.kind,run),bias=run.nodes163.race_bias;
   run.reward_track=prepareCardReward(run.reward_track,{offerId:`reward_${a.attempt_id}`,seed:a.reward_seed,area:run.area??1,kind:node.kind,cards,choices:policy.card_choices,raceBias:bias?{race:bias.race,multiplier:bias.multiplier}:null});
   run.gold=integer(run.gold+policy.gold,0,2e9,'원정 금화');run.lp=Math.min(run.max_lp,run.lp+policy.heal);
   if(policy.relic){const awarded=claimVictoryRelic(run,`victory163:${a.reward_seed}`,cards,node.kind);run.history.push({kind:'relic',node_id:a.node_id,...awarded});b=bridge(run);}
   run.state='reward_pending';b.phase='reward_pending';
  }
 }else if(args.player_result==='loss'||end===0){run.state='defeated';b.phase='resolved';if(e)e.status='resolved';}
 else{run.state='at_node';b.phase='resolved';if(e)e.status='battle_pending';}
 run.bridge147=b;return finished(run,now);
}
function retreat163(run,args,now){
 const b=bridge(run),a=sameAttempt(run,args),p=run.runtime163.prebattle,row=run.nodes163.uses.find(u=>u.use_id===args.use_id&&u.item_id==='lizard_tail'&&u.attempt_id===a.attempt_id&&u.status==='applied'&&u.charged);
 if(!p||p.attempt_id!==a.attempt_id||!row||args.player_result!=='draw'||args.session_id!==a.session_id||args.launch_nonce!==a.launch_nonce||args.launch_sha256!==a.launch_sha256||args.reward_pool_sha256!==a.reward_pool_sha256)fail('도마뱀 꼬리의 확정된 사용·무승부 기록이 필요해.');
 const resultId=identifier(args.result_id,'결과 번호'),resultHash=digest(args.result_sha256,'결과'),prior=b.results.find(r=>r.result_id===resultId);
 if(prior){if(prior.result_sha256!==resultHash||!run.history.some(h=>h.kind==='lizard_retreat163'&&h.use_id===args.use_id&&h.result_id===resultId))fail('같은 도마뱀 꼬리 결과의 내용이 달라.');return run;}
 if(b.phase!=='duel_started'||run.nodes163.uses.some(u=>['reserved','accepted'].includes(u.status)))fail('전투·사용 결과를 먼저 확정해줘.');
 const result={result_id:resultId,attempt_id:a.attempt_id,node_id:a.node_id,result_sha256:resultHash,player_result:'draw',player_end_lp:p.lp,opponent_end_lp:integer(args.opponent_end_lp,0,65535,'상대 종료 LP'),completed_turns:integer(args.completed_turns,0,100000,'종료 턴')};
 a.result_id=resultId;b.results.push(result);b.phase='resolved';run.floor=p.floor;run.current_node_id=p.current_node_id;run.state=p.state;run.lp=p.lp;run.max_lp=p.max_lp;run.runtime163.temporary_card=null;
 const event=challengeEvent(run,a.node_id);if(event){
  if(p.current_node_id!==a.node_id){if(run.nodes163.pending_reward?.node_id===a.node_id||run.nodes163.reward_offers.some(o=>o.node_id===a.node_id)||event.challenge.status==='won')fail('이미 보상을 받은 특별 결투를 되돌릴 수 없어.');delete run.nodes163.events[a.node_id];}
  else{event.challenge.status='draw';event.challenge.result_id=resultId;event.status='battle_pending';}
 }
 run.history.push({kind:'lizard_retreat163',use_id:args.use_id,result_id:resultId,attempt_id:a.attempt_id,restored_lp:p.lp,node_id:p.current_node_id,target_node_id:a.node_id});return finished(run,now);
}
export function transition164(input){
 if(input?.schema!==1)fail('지원하지 않는 게임 연결 버전이야.');
 if(input.run?.campaign164===undefined)return transition163(input);
 let run=normalizeRun(input.run),b=bridge(run);const args=input.args||{},now=input.now||new Date().toISOString();
 if(input.action==='bind'){
  const trusted=cleanCampaignLibrary164(input.expedition_campaign164,input.cards);
  if(canonical164(run.campaign164.library)!==canonical164(trusted))fail('온라인 원정 구성이 바뀌었어. 시작 덱 선택 화면에서 새로 불러와줘.');
  run=initCampaign164(run,trusted,input.cards);
  if(['content157','content158','content163','nodes158','nodes163','recipe_book158','recipe_book163','theme_book163','relic_choices158','relic_choices163'].some(k=>Object.hasOwn(input.run,k)))fail('시작 정책·소환 식·확장 기록은 게임 서버에서만 지정할 수 있어.');
  if(run.bridge147||!isEmptyNodes150(run.nodes150)||run.state!=='between_nodes'||run.reward_track.pending||!run.map||run.lp!==4000||run.max_lp!==4000||run.gold!==0||run.floor!==0||run.current_node_id!==null||run.relics.length||run.history.length||run.rest_claims.length||run.reward_claims.length||run.reward_track.offers.length||run.reward_track.sr_misses||run.reward_track.ur_misses)fail('아직 진행하지 않은 원정 준비본만 처음 연결할 수 있어.');
  run.content163=cleanLibrary163(input.expedition_content163);run.recipe_book163=cleanRecipes163(input.recipes163);run.theme_book163=cleanThemes163(input.themes163,input.cards);run.nodes163=emptyNodes163();run.relic_choices163={};run.bridge147=b;createInstances163(run);run.runtime163=emptyRuntime163();run.opening163=makeOpening163(run,input.cards);return normalizeRun(run);
 }
 if(!run.bridge147||!run.content163)fail('먼저 원정을 게임에 연결해줘.');
 if(run.max_lp>MAX_RUN_LP)fail('게임 연결 원정의 최대 LP는 60,000까지야.');
 integer(input.expected_revision,0,Number.MAX_SAFE_INTEGER,'기대 버전');
 if(input.action==='settle_result'){
  if(args.disposition==='lizard_tail')return retreat163(run,args,now);
  const settled=settle(run,args,input.cards,now);settled.runtime163.temporary_card=null;return normalizeRun(settled);
 }
 if(input.expected_revision!==run.revision)fail('게임의 원정 저장이 바뀌었어. 최신 진행을 다시 불러와줘.');
 if(input.action==='choose_opening')return chooseOpening163(run,args,input.cards)?finished(run,now):run;
 if(input.action==='forge_card163'){forgeCard163(run,args);return finished(run,now);}
 if(input.action==='sync_progress163')return syncProgress163(run,args)?finished(run,now):run;
 if(input.action==='finish_lizard163')return retreat163(run,args,now);
 if(run.opening163.status!=='chosen')fail('탑에 오르기 전에 시작 보상 하나를 선택해줘.');
 if(pendingForge163(run)&&!['reserve_use163','commit_use163'].includes(input.action))fail('획득한 제련 유물로 강화할 몬스터 카드 1매를 먼저 골라줘.');
 if(input.action==='reserve_use163'||input.action==='commit_use163'){
  const changed=input.action==='reserve_use163'?reserveUse163(run,args):commitUse163(run,args);return changed?finished(run,now):run;
 }
 if(['enter_node','buy_card','sell_card','refresh_shop','event_choice','leave_node','pass_node'].includes(input.action)){
  const result=applyNodeAction150(run,input.action==='pass_node'?'enter_node':input.action,args,input.cards,{normalize:normalizeRun});return result.changed?finished(result.run,now):result.run;
 }
 if(input.action==='choose_reward'){
  if(run.runtime163.rest_reward){
   const offer=run.runtime163.rest_reward;if(args.offer_id!==offer.id||run.reward_track.pending?.id!==offer.id)fail('현재 휴식 보상 후보에서 골라줘.');const card=offer.candidates.find(c=>c.identity_key===args.identity_key);if(!card)fail('현재 휴식 보상 후보 중 한 장을 골라줘.');run.reward_track=selectCardReward(run.reward_track,offer.id,card.identity_key);grant163(run,card,1,offer.id);offer.chosen_identity_key=card.identity_key;run.runtime163.rest_offers.push(offer);run.runtime163.rest_reward=null;return finished(run,now);
  }
  const priorRest=run.runtime163.rest_offers.find(o=>o.id===args.offer_id);if(priorRest){if(priorRest.chosen_identity_key!==args.identity_key)fail('이 휴식에서는 이미 다른 카드를 골랐어.');return run;}
  const special=run.nodes163.pending_reward;
  if(special){
   if(special.id!==args.offer_id)fail('현재 대기 중인 특별 보상과 요청이 달라.');const card=special.candidates.find(c=>c.identity_key===args.identity_key);if(!card)fail('특별 보상 후보 중 한 장을 골라줘.');
   if(special.kind==='challenge_duel'&&(run.state!=='reward_pending'||b.phase!=='reward_pending')||special.kind!=='challenge_duel'&&(run.state!=='at_node'||!['idle','resolved'].includes(b.phase)))fail('특별 보상을 선택할 수 있는 상태가 아니야.');
   grant163(run,card,1,special.id);special.chosen_identity_key=card.identity_key;run.nodes163.reward_offers.push(special);run.nodes163.pending_reward=null;run.nodes163.events[special.node_id].status='resolved';run.state='at_node';b.phase='resolved';
  }else{
   const prior=run.nodes163.reward_offers.find(o=>o.id===args.offer_id);if(prior){if(prior.chosen_identity_key!==args.identity_key)fail('이 특별 보상에서는 이미 다른 카드를 골랐어.');return run;}
   if(b.phase!=='reward_pending'||run.state!=='reward_pending')fail('먼저 실제 전투 보상을 확인해줘.');
   const offer=run.reward_track.pending;if(args.offer_id!==offer.id)fail('현재 대기 중인 보상과 요청이 달라.');const card=offer.candidates.find(c=>c.identity_key===args.identity_key);if(!card)fail('현재 보상 후보 중 한 장을 골라줘.');
   run.reward_track=selectCardReward(run.reward_track,offer.id,card.identity_key);grant163(run,card,1,offer.id);b.phase='resolved';run.state='between_nodes';if(run.map.nodes.find(n=>n.id===run.current_node_id).kind==='boss')completeChapter164(run,offer,card.identity_key);
  }
 }else if(input.action==='set_relic_choice'){
  if(!['between_nodes','at_node'].includes(run.state)||!['idle','resolved'].includes(b.phase)||run.nodes163.pending_reward)fail('전투나 보상 처리 중에는 유물 선택을 바꿀 수 없어.');
  if(args.relic_id==='field_legacy'){
   if(!run.relics.includes('field_legacy')||!FIELD_OPTIONS163.some(f=>f.id===args.field_id)||!relicMeta163(run,'field_legacy').params.fields.includes(args.field_id))fail('보유한 태고의 지형의 허용 필드를 골라줘.');
   const old=run.relic_choices163.field_legacy;if(old){if(old!==args.field_id)fail('이번 원정에서 한 번 고른 시작 필드는 바꿀 수 없어.');return run;}
   run.relic_choices163.field_legacy=args.field_id;run.history.push({kind:'relic_choice163',relic_id:'field_legacy',field_id:args.field_id});
  }else if(['wise_burial','prepared_trap','prepared_spell','prepared_monster'].includes(args.relic_id)){
   const option=relicChoiceOptions163(run,args.relic_id).find(r=>r.identity_key===args.identity_key);if(!option||option.disabled)fail(option?.reason||'현재 메인 덱에서 유물에 맞는 카드 1장을 골라줘.');
   if(run.relic_choices163[args.relic_id]===args.identity_key)return run;run.relic_choices163[args.relic_id]=args.identity_key;run.history.push({kind:'relic_choice163',relic_id:args.relic_id,identity_key:args.identity_key});
  }else{
   if(args.relic_id!=='destiny_draw'||!run.relics.includes('destiny_draw')||!hash(args.identity_key)||!run.active_deck.groups.main.some(r=>r.identity_key===args.identity_key&&r.count>0))fail('보유한 운명의 패와 현재 메인 덱 카드 1장을 골라줘.');
   const option=relicChoiceOptions163(run,'destiny_draw').find(r=>r.identity_key===args.identity_key);if(option?.disabled)fail(option.reason);if(run.relic_choices154.destiny_draw===args.identity_key)return run;run.relic_choices154.destiny_draw=args.identity_key;run.history.push({kind:'relic_choice154',relic_id:'destiny_draw',identity_key:args.identity_key});
  }
 }else if(input.action==='prepare'){
  validateDuelRelics154(run);if(run.nodes163.pending_reward||run.reward_track.pending||run.runtime163.rest_reward)fail('먼저 대기 중인 보상을 골라줘.');
  const event=challengeEvent(run,args.node_id),atCurrent=run.state==='at_node'&&run.current_node_id===args.node_id&&['idle','resolved'].includes(b.phase);
  const node=atCurrent?run.map.nodes.find(n=>n.id===args.node_id):destination(run,args.node_id);
  if(event){if(!atCurrent||event.status!=='battle_pending'||!['accepted','draw'].includes(event.challenge.status))fail('수락한 특별 결투를 선택해줘.');}
  else if(!battle(node.kind)||!run.encounters[node.id])fail('상대가 지정된 전투 칸을 선택해줘.');
  if(run.lp<1)fail('LP가 없어 전투를 시작할 수 없어.');
  const retry=atCurrent&&b.attempt?.node_id===node.id,rewardSeed=retry?b.attempt.reward_seed:identifier(args.reward_seed,'보상 시드');
  const previousPosition=event?(run.runtime163.node_entries.find(e=>e.node_id===node.id)??run):(retry&&run.runtime163.prebattle?.attempt_id===b.attempt?.attempt_id?run.runtime163.prebattle:run);
  run.runtime163.prebattle={attempt_id:identifier(args.attempt_id,'전투 시도'),floor:previousPosition.floor,current_node_id:previousPosition.current_node_id,state:previousPosition.state,lp:run.lp,max_lp:run.max_lp};
  b.attempt={attempt_id:identifier(args.attempt_id,'전투 시도'),node_id:node.id,session_id:identifier(args.session_id,'게임 세션'),launch_nonce:identifier(args.launch_nonce,'실행 번호'),reward_seed:rewardSeed,reward_pool_sha256:digest(args.reward_pool_sha256,'보상 풀'),prebattle_revision:run.revision,start_lp:run.lp,max_lp:run.max_lp,launch_sha256:null,result_id:null};
  if(run.relics.includes('mystery_card')){const card=deterministic163(eligibleRewardCards(input.cards).filter(card=>card.type!=='융합 몬스터'),`mystery163|${run.seed}|${node.id}|${rewardSeed}`);if(!card)fail('임시로 받을 카드 후보가 없어.');run.runtime163.temporary_card={attempt_id:b.attempt.attempt_id,card:snapshotCard(card)};}else run.runtime163.temporary_card=null;
  if(event){event.challenge.attempt_id=b.attempt.attempt_id;event.challenge.result_id=null;event.challenge.status='in_battle';}
  b.phase='prepared';run.floor=node.floor;run.current_node_id=node.id;run.state='in_battle';
 }else if(input.action==='start_ack'){
  validateDuelRelics154(run);const a=sameAttempt(run,args);if(b.phase!=='prepared')fail('준비된 전투만 시작할 수 있어.');a.launch_sha256=digest(args.launch_sha256,'시작 패킷');b.phase='duel_started';
 }else if(input.action==='cancel_prepared'){
  const a=sameAttempt(run,args);if(b.phase!=='prepared')fail('게임이 시작된 전투는 취소할 수 없어.');b.phase='resolved';run.state='at_node';const e=challengeEvent(run,a.node_id);if(e)e.challenge.status='accepted';
 }else if(input.action==='mark_interrupted'){
  sameAttempt(run,args);if(b.phase!=='duel_started')fail('시작된 전투만 중단 기록을 남길 수 있어.');if(run.nodes163.uses.some(r=>['reserved','accepted'].includes(r.status)))fail('먼저 소모품 사용의 중단 영수증을 확정해줘.');b.phase='interrupted';
 }else if(input.action==='recover_interrupted'){
  const a=sameAttempt(run,args);if(b.phase!=='interrupted')fail('중단된 전투만 다시 준비할 수 있어.');run.lp=a.start_lp;run.max_lp=a.max_lp;a.session_id=identifier(args.session_id,'새 게임 세션');a.launch_nonce=identifier(args.launch_nonce,'새 실행 번호');a.launch_sha256=null;b.phase='prepared';run.history.push({kind:'interrupted_retry',attempt_id:a.attempt_id,node_id:a.node_id});
 }else if(input.action==='rest'){
  const node=destination(run,args.node_id);if(node.kind!=='rest')fail('휴식 칸을 선택해줘.');const revision=run.revision;run.floor=node.floor;run.current_node_id=node.id;run.state='at_node';run=resolveRestChoice(run,node.id,args.choice,{now,cards:input.cards});run.revision=revision;b=bridge(run);b.phase='resolved';run.history.push({kind:'rest',node_id:node.id,choice:args.choice});
  if(run.relics.includes('dreamcatcher')){const meta=relicMeta163(run,'dreamcatcher'),bias=run.nodes163.race_bias;run.reward_track=prepareCardReward(run.reward_track,{offerId:`rest163_${node.id}`,seed:`dreamcatcher163|${run.seed}|${node.id}`,area:run.area??1,kind:'battle',cards:input.cards,choices:meta.params.choices,raceBias:bias?{race:bias.race,multiplier:bias.multiplier}:null});run.runtime163.rest_reward={id:run.reward_track.pending.id,node_id:node.id,candidates:clone(run.reward_track.pending.candidates),chosen_identity_key:null};}
 }else if(input.action==='sync_deck'){
  if(!['idle','resolved'].includes(b.phase)||run.nodes163.pending_reward)fail('전투나 보상 처리 중에는 덱을 바꿀 수 없어.');const revision=run.revision;run=commitRunDeck(run,args.draft,{now});run.revision=revision;b=bridge(run);
 }else fail('지원하지 않는 원정 명령이야.');
 run.bridge147=b;return finished(run,now);
}
export const transition154=transition164,transition147=transition164;
const canonical164=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
