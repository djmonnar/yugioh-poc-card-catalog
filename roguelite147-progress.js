import {normalizeRun,commitRunDeck,resolveRestChoice,grantCard} from './roguelite-core.js?v=20261015-147';
import {prepareCardReward,selectCardReward} from './roguelite-rewards.js?v=20261014-139';
import {rewardPolicy,RELICS,MAX_RUN_LP} from './roguelite-rules.js?v=20261015-147';

const fail=message=>{throw new Error(message);},clone=value=>structuredClone(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const bridge=run=>run.bridge147||{schema:1,phase:'idle',attempt:null,results:[]};
const battle=kind=>['battle','elite','midboss','boss'].includes(kind);
export function reachableNodes(run) {
  if(!run?.map || run.state!=='between_nodes' || !['idle','resolved'].includes(bridge(run).phase) || run.lp < 1)return [];
  if(run.current_node_id===null)return run.map.nodes.filter(n=>n.floor===1).map(n=>n.id);
  return [...(run.map.nodes.find(n=>n.id===run.current_node_id)?.next||[])];
}
function destination(run,nodeId){
  if(!reachableNodes(run).includes(nodeId))fail('현재 위치에서 이어지는 다음 칸을 선택해줘.');
  return run.map.nodes.find(n=>n.id===nodeId);
}
function sameAttempt(run,args){
  const a=bridge(run).attempt;
  if(!a||a.attempt_id!==args.attempt_id)fail('현재 전투 시도와 요청이 달라.');
  return a;
}
function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)fail(`${label} 값을 확인해줘.`);return value;}
function identifier(value,label){if(!id(value))fail(`${label} 형식을 확인해줘.`);return value;}
function digest(value,label){if(!hash(value))fail(`${label} 지문을 확인해줘.`);return value;}
function finished(run,now){run.revision++;run.updated_at=new Date(now).toISOString();return normalizeRun(run);}
function claimRelic(run,seed){
  const pool=RELICS.filter(r=>!run.relics.includes(r.id)&&run.max_lp+(r.max_lp||0)<=MAX_RUN_LP);
  if(!pool.length)return null;
  let value=2166136261;for(const character of seed)value=Math.imul(value^character.charCodeAt(0),16777619)>>>0;
  const relic=pool[value%pool.length];run.relics.push(relic.id);run.max_lp+=relic.max_lp||0;return relic.id;
}
function settle(run,args,cards,now){
  const b=bridge(run),a=sameAttempt(run,args),resultId=identifier(args.result_id,'결과 번호'),resultHash=digest(args.result_sha256,'결과');
  if(args.session_id!==a.session_id||args.launch_nonce!==a.launch_nonce||args.launch_sha256!==a.launch_sha256||args.reward_pool_sha256!==a.reward_pool_sha256)fail('이 전투의 완료 기록을 확인할 수 없어.');
  const prior=b.results.find(item=>item.result_id===resultId);
  if(prior){if(prior.result_sha256!==resultHash||prior.attempt_id!==a.attempt_id||prior.player_result!==args.player_result||prior.player_end_lp!==args.player_end_lp||prior.opponent_end_lp!==args.opponent_end_lp||prior.completed_turns!==args.completed_turns)fail('같은 결과 번호의 내용이 달라.');return run;}
  if(b.phase!=='duel_started')fail('이 전투의 완료 기록을 확인할 수 없어.');
  if(!['win','loss','draw'].includes(args.player_result))fail('승패 기록을 확인해줘.');
  const end=integer(args.player_end_lp,0,run.max_lp,'종료 LP');
  const result={result_id:resultId,attempt_id:a.attempt_id,node_id:a.node_id,result_sha256:resultHash,player_result:args.player_result,
    player_end_lp:end,opponent_end_lp:integer(args.opponent_end_lp,0,65535,'상대 종료 LP'),completed_turns:integer(args.completed_turns,0,100000,'종료 턴')};
  run.lp=Math.min(end,run.max_lp);a.result_id=resultId;b.results.push(result);
  run.history.push({kind:'duel_result',...result,recorded_end_lp:end});
  if(args.player_result==='win'&&end>0){
    const node=run.map.nodes.find(n=>n.id===a.node_id),policy=rewardPolicy(node.kind,run.relics);
    run.reward_track=prepareCardReward(run.reward_track,{offerId:`reward_${a.attempt_id}`,seed:a.reward_seed,area:1,kind:node.kind,cards,choices:policy.card_choices});
    // LP, gold, pity and offer are one durable checkpoint. A duplicate native
    // result returns it unchanged and cannot roll another set of candidates.
    run.gold=integer(run.gold+policy.gold,0,2_000_000_000,'원정 금화');
    run.lp=Math.min(run.max_lp,run.lp+policy.heal);
    const relic=policy.relic?claimRelic(run,`victory147:${a.reward_seed}`):null;
    if(relic)run.history.push({kind:'relic',node_id:a.node_id,relic_id:relic});
    run.state='reward_pending';b.phase='reward_pending';
  }else if(args.player_result==='loss'||end===0){run.state='defeated';b.phase='resolved';}
  else{
    // A draw is a real completed attempt. It awards nothing and leaves the
    // player at this encounter; retry uses the carried LP and fixed seed.
    run.state='at_node';b.phase='resolved';
  }
  run.bridge147=b;return finished(run,now);
}

// This is an internal host transition worker. Browsers submit commands, never
// settle_result. Python owns authentication, native evidence, lock and journal.
export function transition147(input){
  if(input?.schema!==1)fail('지원하지 않는 게임 연결 버전이야.');
  let run=normalizeRun(input.run),b=bridge(run);const args=input.args||{},now=input.now||new Date().toISOString();
  if(run.max_lp>MAX_RUN_LP)fail('게임 연결 원정의 최대 LP는 60,000까지야. 기존 미리보기 백업은 보존했어.');
  if(input.action==='bind'){
    if(run.bridge147)fail('이미 게임에 연결된 원정이야. 게임의 저장본을 불러와줘.');
    if(run.state!=='between_nodes'||run.reward_track.pending||!run.map||run.lp<1)fail('전투 시작 전 원정 준비 저장본만 연결할 수 있어.');
    if(run.floor!==0||run.current_node_id!==null||run.lp!==4000||run.max_lp!==4000||run.gold!==0||run.relics.length||run.history.length||
      run.rest_claims.length||run.reward_claims.length||run.reward_track.offers.length||run.reward_track.sr_misses||run.reward_track.ur_misses)fail('아직 진행하지 않은 원정 준비본만 처음 연결할 수 있어. 실제 진행은 게임의 저장 기록에서 불러와줘.');
    run.bridge147=b;return normalizeRun(run);
  }
  if(!run.bridge147)fail('먼저 원정을 게임에 연결해줘.');
  integer(input.expected_revision,0,Number.MAX_SAFE_INTEGER,'기대 버전');
  // An exact repeated result may arrive after its checkpoint was committed.
  if(input.action==='settle_result')return settle(run,args,input.cards,now);
  if(input.expected_revision!==run.revision)fail('게임의 원정 저장이 바뀌었어. 최신 진행을 다시 불러와줘.');
  if(input.action==='prepare'){
    const node=(run.state==='at_node'&&run.current_node_id===args.node_id&&b.phase==='resolved')?run.map.nodes.find(n=>n.id===args.node_id):destination(run,args.node_id);
    if(!battle(node.kind)||!run.encounters[node.id])fail('상대가 지정된 전투 칸을 선택해줘.');
    if(run.lp<1)fail('LP가 없어 전투를 시작할 수 없어.');
    const retry=run.state==='at_node'&&b.attempt?.node_id===node.id;
    const rewardSeed=retry?b.attempt.reward_seed:identifier(args.reward_seed,'보상 시드');
    b.attempt={attempt_id:identifier(args.attempt_id,'전투 시도'),node_id:node.id,session_id:identifier(args.session_id,'게임 세션'),
      launch_nonce:identifier(args.launch_nonce,'실행 번호'),reward_seed:rewardSeed,reward_pool_sha256:digest(args.reward_pool_sha256,'보상 풀'),
      prebattle_revision:run.revision,start_lp:run.lp,max_lp:run.max_lp,launch_sha256:null,result_id:null};
    b.phase='prepared';run.floor=node.floor;run.current_node_id=node.id;run.state='in_battle';
  }else if(input.action==='start_ack'){
    const a=sameAttempt(run,args);if(b.phase!=='prepared')fail('준비된 전투만 시작할 수 있어.');
    a.launch_sha256=digest(args.launch_sha256,'시작 패킷');b.phase='duel_started';
  }else if(input.action==='cancel_prepared'){
    sameAttempt(run,args);if(b.phase!=='prepared')fail('게임이 시작된 전투는 취소할 수 없어.');
    // Keep the chosen opponent and reward seed; return to this encounter.
    b.phase='resolved';run.state='at_node';
  }else if(input.action==='mark_interrupted'){
    sameAttempt(run,args);if(b.phase!=='duel_started')fail('시작된 전투만 중단 기록을 남길 수 있어.');b.phase='interrupted';
  }else if(input.action==='recover_interrupted'){
    const a=sameAttempt(run,args);if(b.phase!=='interrupted')fail('중단된 전투만 다시 준비할 수 있어.');
    run.lp=a.start_lp;run.max_lp=a.max_lp;a.session_id=identifier(args.session_id,'새 게임 세션');
    a.launch_nonce=identifier(args.launch_nonce,'새 실행 번호');a.launch_sha256=null;b.phase='prepared';
    run.history.push({kind:'interrupted_retry',attempt_id:a.attempt_id,node_id:a.node_id});
  }else if(input.action==='choose_reward'){
    if(b.phase!=='reward_pending'||run.state!=='reward_pending')fail('먼저 실제 전투 보상을 확인해줘.');
    const offer=run.reward_track.pending;if(args.offer_id!==offer.id)fail('현재 대기 중인 보상과 요청이 달라.');
    const card=offer.candidates.find(item=>item.identity_key===args.identity_key);if(!card)fail('현재 보상 후보 중 한 장을 골라줘.');
    run.reward_track=selectCardReward(run.reward_track,offer.id,card.identity_key);
    b.phase='resolved';run.state='between_nodes';
    const baseRevision=run.revision;run=grantCard(run,card,1,{rewardId:offer.id,now});run.revision=baseRevision;
    b=bridge(run);run.state=run.map.nodes.find(n=>n.id===run.current_node_id).kind==='boss'?'completed':'between_nodes';
  }else if(input.action==='rest'){
    const node=destination(run,args.node_id);if(node.kind!=='rest')fail('휴식 칸을 선택해줘.');
    const revision=run.revision;run.floor=node.floor;run.current_node_id=node.id;run.state='at_node';
    run=resolveRestChoice(run,node.id,args.choice,{now});run.revision=revision;b=bridge(run);b.phase='resolved';
    run.history.push({kind:'rest',node_id:node.id,choice:args.choice});
  }else if(input.action==='pass_node'){
    const node=destination(run,args.node_id);if(!['shop','event'].includes(node.kind))fail('이번 단계에서 통과할 수 있는 칸이 아니야.');
    run.floor=node.floor;run.current_node_id=node.id;run.state='between_nodes';b.phase='resolved';
    run.history.push({kind:'pass_node',node_id:node.id,node_kind:node.kind,rewards_granted:false});
  }else if(input.action==='sync_deck'){
    if(!['idle','resolved'].includes(b.phase))fail('전투나 보상 처리 중에는 덱을 바꿀 수 없어.');
    const revision=run.revision;run=commitRunDeck(run,args.draft,{now});run.revision=revision;b=bridge(run);
  }else fail('지원하지 않는 원정 명령이야.');
  run.bridge147=b;return finished(run,now);
}
