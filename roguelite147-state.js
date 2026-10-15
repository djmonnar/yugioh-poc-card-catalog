// Metadata is not proof of a completed duel. Only the authenticated local host
// may replace its authoritative checkpoint with a native result.
const phases = ['idle','prepared','duel_started','interrupted','reward_pending','resolved'];
const id = value => typeof value === 'string' && /^[A-Za-z0-9_:-]{1,160}$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uint = value => Number.isSafeInteger(value) && value >= 0;
const fail = () => {throw new Error('게임 연결 진행 기록을 확인할 수 없어. 원본 백업을 보존해줘.');};
export function cleanBridgeState(value, run) {
  if (value == null) return null;
  if (value.schema !== 1 || !phases.includes(value.phase) || !Array.isArray(value.results) || value.results.length > 1000) fail();
  const results = [], seen = new Set();
  for (const item of value.results) {
    if (!item || !id(item.result_id) || seen.has(item.result_id) || !id(item.attempt_id) || !id(item.node_id) || !hash(item.result_sha256) ||
      !['win','loss','draw'].includes(item.player_result) || !uint(item.player_end_lp) || item.player_end_lp > 65535 ||
      !uint(item.opponent_end_lp) || item.opponent_end_lp > 65535 || !uint(item.completed_turns)) fail();
    seen.add(item.result_id);
    results.push({result_id:item.result_id,attempt_id:item.attempt_id,node_id:item.node_id,result_sha256:item.result_sha256,
      player_result:item.player_result,player_end_lp:item.player_end_lp,opponent_end_lp:item.opponent_end_lp,completed_turns:item.completed_turns});
  }
  let attempt = null;
  if (value.attempt != null) {
    const a=value.attempt;
    if (!['attempt_id','node_id','session_id','launch_nonce','reward_seed'].every(key=>id(a[key])) ||
      !hash(a.reward_pool_sha256) || !uint(a.prebattle_revision) || !Number.isInteger(a.start_lp) || a.start_lp < 1 || a.start_lp > 65535 ||
      !Number.isInteger(a.max_lp) || a.max_lp < a.start_lp || a.max_lp > 65535 ||
      !(a.launch_sha256===null || hash(a.launch_sha256)) || !(a.result_id===null || id(a.result_id)) ||
      !run.map?.nodes.some(n=>n.id===a.node_id&&['battle','elite','midboss','boss'].includes(n.kind))) fail();
    attempt={attempt_id:a.attempt_id,node_id:a.node_id,session_id:a.session_id,launch_nonce:a.launch_nonce,reward_seed:a.reward_seed,
      reward_pool_sha256:a.reward_pool_sha256,prebattle_revision:a.prebattle_revision,start_lp:a.start_lp,max_lp:a.max_lp,
      launch_sha256:a.launch_sha256,result_id:a.result_id};
  }
  if (['prepared','duel_started','interrupted','reward_pending'].includes(value.phase) && (!attempt || run.current_node_id !== attempt.node_id)) fail();
  if (['prepared','duel_started','interrupted'].includes(value.phase) && run.state !== 'in_battle') fail();
  if (value.phase==='reward_pending' && (run.state!=='reward_pending' || !attempt.result_id || !run.reward_track?.pending)) fail();
  if (value.phase==='duel_started' && !attempt.launch_sha256) fail();
  return {schema:1,phase:value.phase,attempt,results};
}
