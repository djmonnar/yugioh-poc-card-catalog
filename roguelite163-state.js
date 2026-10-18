// Same launch/result contract as 147. A challenge event is admitted only when
// its immutable encounter snapshot is present; the map itself is never edited.
const phases=['idle','prepared','duel_started','interrupted','reward_pending','resolved'];
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_:-]{1,160}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uint=v=>Number.isSafeInteger(v)&&v>=0;
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const fail=()=>{throw Error('게임 연결 진행 기록을 확인할 수 없어. 원본 백업을 보존해줘.');};
export function cleanBridgeState(value,run){
 if(value==null)return null;
 if(value.schema!==1||!phases.includes(value.phase)||!Array.isArray(value.results)||value.results.length>1000)fail();
 const results=[],seen=new Set();
 for(const r of value.results){
  if(!r||!id(r.result_id)||seen.has(r.result_id)||!id(r.attempt_id)||!id(r.node_id)||!hash(r.result_sha256)||!['win','loss','draw'].includes(r.player_result)||!uint(r.player_end_lp)||r.player_end_lp>65535||!uint(r.opponent_end_lp)||r.opponent_end_lp>65535||!uint(r.completed_turns))fail();
  seen.add(r.result_id);results.push(Object.fromEntries(['result_id','attempt_id','node_id','result_sha256','player_result','player_end_lp','opponent_end_lp','completed_turns'].map(k=>[k,r[k]])));
 }
 let attempt=null;
 if(value.attempt!=null){
  const a=value.attempt,n=run.map?.nodes.find(n=>n.id===a.node_id),e=run.nodes163?.events?.[a.node_id],c=e?.challenge;
  const ordinary=n&&['battle','elite','midboss','boss'].includes(n.kind);
  const challenge=n?.kind==='event'&&e?.kind==='challenge_duel'&&e.choice==='accept'&&c&&canonical(c.encounter)===canonical(run.encounters[c.source_node_id])&&c.template_id===c.encounter.template_id&&c.attempt_id===a.attempt_id;
  const retreated=n?.kind==='event'&&value.phase==='resolved'&&['between_nodes','at_node'].includes(run.state)&&run.history.some(h=>h.kind==='lizard_retreat163'&&h.attempt_id===a.attempt_id&&h.target_node_id===a.node_id&&h.result_id===a.result_id&&run.nodes163.uses.some(u=>u.use_id===h.use_id&&u.item_id==='lizard_tail'&&u.attempt_id===a.attempt_id&&u.status==='applied'&&u.charged))&&results.some(r=>r.result_id===a.result_id&&r.attempt_id===a.attempt_id&&r.node_id===a.node_id&&r.player_result==='draw');
  if(!['attempt_id','node_id','session_id','launch_nonce','reward_seed'].every(k=>id(a[k]))||!hash(a.reward_pool_sha256)||!uint(a.prebattle_revision)||!Number.isInteger(a.start_lp)||a.start_lp<1||a.start_lp>60000||!Number.isInteger(a.max_lp)||a.max_lp<a.start_lp||a.max_lp>60000||!(a.launch_sha256===null||hash(a.launch_sha256))||!(a.result_id===null||id(a.result_id))||(!ordinary&&!challenge&&!retreated))fail();
  attempt=Object.fromEntries(['attempt_id','node_id','session_id','launch_nonce','reward_seed','reward_pool_sha256','prebattle_revision','start_lp','max_lp','launch_sha256','result_id'].map(k=>[k,a[k]]));
 }
 if(['prepared','duel_started','interrupted','reward_pending'].includes(value.phase)&&(!attempt||run.current_node_id!==attempt.node_id))fail();
 if(['prepared','duel_started','interrupted'].includes(value.phase)&&run.state!=='in_battle')fail();
 if(value.phase==='reward_pending'&&(run.state!=='reward_pending'||!attempt.result_id||!(run.reward_track?.pending||run.nodes163?.pending_reward?.kind==='challenge_duel')))fail();
 if(value.phase==='duel_started'&&!attempt.launch_sha256)fail();
 return {schema:1,phase:value.phase,attempt,results};
}
