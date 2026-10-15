import {createBridgeClient147} from './roguelite147-client.js?v=20261015-147';
import {reachableNodes} from './roguelite147-progress.js?v=20261015-147';
import {REST_CHOICES,RELICS,MAX_RUN_LP} from './roguelite-rules.js?v=20261015-147';
const labels={idle:'다음 길 선택',prepared:'전투 준비 완료',duel_started:'게임에서 전투 중',interrupted:'전투 중단 · 복구 대기',reward_pending:'승리 카드 선택',resolved:'다음 길 선택'};
export function mountBridge147({config,getRun,getSave,applyRuns,applyArchived,showCard,toast,onChanged}){
  const make=(tag,text,className)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;};
  const status=make('section',null,'bridge147-connection');status.id='bridge147-connection';
  const title=make('h2',config?'게임 원정 연결':'실제 전투로 이어가기');const message=make('p',null,'muted'),actions=make('div',null,'actions');status.append(title,message,actions);
  document.querySelector('.storage-bar').before(status);
  const panel=make('section',null,'bridge147-panel');panel.id='bridge147-panel';document.querySelector('.run-columns').before(panel);
  const controls=make('section',null,'bridge147-node-actions');controls.id='bridge147-node-actions';document.getElementById('node-description').after(controls);
  document.querySelector('.map-preview-note').textContent='칸을 눌러 상대와 다음 길을 확인해. 게임에 연결한 원정에서는 이어진 길로 이동하고 실제 듀얼을 진행할 수 있어.';
  document.querySelector('#node-dialog>.phase-note').textContent='미리보기에서는 원정 저장을 바꾸지 않아. 게임 연결 원정에서는 아래 선택을 실제 진행에 저장해.';
  if(config)document.querySelector('footer span').textContent='게임에 연결한 원정은 로컬 게임의 원정 저장이 기준이야. 이 브라우저의 복사본과 슬롯 백업은 따로 보관할 수 있어.';
  let client=null,busy=false,healthy=false,pollTimer=null,stopped=false,currentNode=null,launches={};
  function button(text,fn,className=''){
    const b=make('button',text,className);b.type='button';b.disabled=busy;
    b.addEventListener('click',()=>guard(fn));return b;
  }
  async function guard(fn){try{await fn();}catch(error){message.textContent=error.message;toast(error.message);}}
  function schedule(){
    clearTimeout(pollTimer);if(stopped||!client||document.hidden)return;
    const active=getRun();if(active?.bridge147&&['prepared','duel_started','interrupted'].includes(active.bridge147.phase))pollTimer=setTimeout(()=>guard(refresh),3000);
  }
  async function receiveStatus(payload,{allowDraftCommit=false}={}){
    // Only authenticated host responses contain executable archive receipts.
    // Apply old tombstones first so a recycled slot can hydrate its new run.
    for(const receipt of payload.archives)await applyArchived(receipt,{fromStatus:true});
    launches=payload.launches;await applyRuns(payload.runs,{allowDraftCommit});client.acknowledgeStatus(payload);
  }
  async function refresh(){
    if(!client||busy)return;
    busy=true;render();
    try{const payload=await client.status();await receiveStatus(payload);healthy=true;message.textContent='게임의 원정 저장과 연결됐어. 전투가 끝나면 실제 종료 LP와 보상을 불러와.';}
    catch(error){healthy=false;message.textContent=`${error.message} 진행을 임의로 처리하지 않았어.`;}
    finally{busy=false;onChanged();render();schedule();}
  }
  async function command(action,args={},selectedRun=getRun()){
    if(!client||!healthy)throw new Error('먼저 게임 연결을 확인해줘.');if(busy)throw new Error('게임 저장을 처리 중이야.');
    if(!selectedRun)throw new Error('원정 슬롯을 불러와줘.');
    busy=true;render();
    try{
      const reply=await client.command(action,selectedRun,args);
      if(reply.archived){await applyArchived(reply);onChanged();render();return reply;}
      if(reply.native_status&&args.attempt_id)launches[args.attempt_id]=reply.native_status;
      await applyRuns([reply.run],{allowDraftCommit:action==='sync_deck'});onChanged();render();return reply.run;
    }catch(error){
      healthy=false;
      // An uncertain POST may already have committed. Read the authenticated
      // journal before reporting failure; never undo a grant or leave an old
      // mirror as the apparent source of truth.
      try{
        const payload=await client.status(),next=payload.runs.find(r=>r.id===selectedRun.id);
        const sameDeck=action==='sync_deck'&&next&&JSON.stringify(next.active_deck.groups)===JSON.stringify(args.draft.groups);
        await receiveStatus(payload,{allowDraftCommit:sameDeck});healthy=true;onChanged();
        const archived=action==='archive_run'&&payload.archives.find(r=>r.run_id===selectedRun.id&&r.slot_id===selectedRun.slot_id);
        if(archived){message.textContent='응답이 늦었지만 게임에 보관된 영수증을 확인하고 슬롯을 비웠어.';return archived;}
        const observed=next&&(
          (action==='bind'&&next.bridge147)||
          (action==='choose_reward'&&next.reward_claims.some(c=>c.id===args.offer_id&&c.identity_key===args.identity_key))||
          sameDeck||
          (action==='prepare'&&next.bridge147?.attempt?.node_id===args.node_id&&next.revision>selectedRun.revision)||
          (action==='start'&&['queued','started','resolved','interrupted'].includes(launches[args.attempt_id]))||
          (action==='cancel_prepared'&&next.state==='at_node'&&next.bridge147?.phase==='resolved')||
          (action==='recover_interrupted'&&next.bridge147?.attempt?.attempt_id===args.attempt_id&&next.bridge147?.phase==='prepared')||
          (action==='rest'&&next.rest_claims.some(c=>c.node_id===args.node_id&&c.choice===args.choice))||
          (action==='pass_node'&&next.history.some(c=>c.kind==='pass_node'&&c.node_id===args.node_id)));
        message.textContent=observed?'응답이 늦었지만 게임에 저장된 진행을 확인했어. 같은 보상을 다시 지급하지 않았어.':'게임에 기록된 최신 진행을 다시 읽었어. 완료되지 않은 요청은 같은 내용으로 다시 확인해줘.';
        if(observed)return next;
      }catch(refreshError){message.textContent=`${refreshError.message} 기존 진행은 보존했어. 같은 요청 번호로 다시 확인할 수 있어.`;}
      throw error;
    }
    finally{busy=false;render();schedule();}
  }
  function render(){
    actions.replaceChildren();if(client)actions.append(button(busy?'연결 확인 중…':'게임 진행 다시 불러오기',refresh));
    panel.replaceChildren();const r=getRun();panel.hidden=!r;if(!r)return;
    if(!client){panel.append(make('p','이 화면은 지도와 보상 체험용이야. 실제 전투는 PC에서 KoreanPatch/Launch-Roguelite.cmd를 실행해 연 원정 화면에서 진행해.','phase-note'));return;}
    if(!r.bridge147){
      panel.append(make('h3','이 슬롯을 게임에 연결'),make('p','시작 덱·지도·상대를 고정하고 실제 전투를 시작해. 계정의 일반 덱과 보유 카드는 원정과 분리돼.'));
      const bind=button('이 원정으로 게임 연결',()=>command('bind',{},r),'primary');bind.disabled||=!healthy;panel.append(bind);return;
    }
    const state=r.bridge147,a=state.attempt;panel.append(make('h3',labels[state.phase]||r.state));
    if(r.state==='defeated')panel.append(make('p','원정이 끝났어. 실제 종료 LP와 전투 기록을 저장했어. 다른 슬롯에서 새로운 원정을 시작할 수 있어.'));
    else if(r.state==='completed')panel.append(make('p','봉인된 듀얼의 탑을 완주했어! 마지막 카드 보상까지 원정 카드함에 저장했어.'));
    else if(state.phase==='prepared'){
      panel.append(make('p',`${r.encounters[a.node_id].opponent_name} · 시작 LP ${a.start_lp.toLocaleString()} / ${a.max_lp.toLocaleString()}`));
      if(launches[a.attempt_id]==='queued')panel.append(make('p','게임의 전투 시작 응답을 기다리고 있어. 대기 중에는 다시 시작하거나 취소하지 않아.'));
      else panel.append(button('게임에서 듀얼 시작',()=>command('start',{attempt_id:a.attempt_id}),'primary'),button('준비 취소',()=>command('cancel_prepared',{attempt_id:a.attempt_id})));
    }else if(state.phase==='duel_started')panel.append(make('p','게임 창에서 듀얼을 진행해줘. 종료 기록을 기다리고 있어. 창을 닫거나 다시 열어도 같은 전투 기록을 확인해.'));
    else if(state.phase==='interrupted'){
      panel.append(make('p','완료 기록이 없는 중단이야. 승패나 보상은 만들지 않았어. 같은 상대와 전투 전 LP로 다시 시작할 수 있어.'));
      panel.append(button('같은 전투 다시 준비',()=>command('recover_interrupted',{attempt_id:a.attempt_id}),'primary'));
    }else if(state.phase==='reward_pending')renderReward(r);
    else if(r.state==='at_node'&&a){panel.append(make('p','현재 전투를 다시 준비할 수 있어. 무승부라면 종료 LP를 이어가고 보상은 받지 않아.'));panel.append(button('현재 상대 다시 준비',()=>command('prepare',{node_id:a.node_id}),'primary'));}
    else panel.append(make('p','지도에서 이어지는 다음 길을 선택해. 상대와 덱을 확인한 뒤 전투를 준비할 수 있어.'));
    if(currentNode)renderNode(currentNode.entry,currentNode.r,currentNode.preview);
    for(const b of panel.querySelectorAll('button'))b.disabled||=busy||!healthy;
  }
  function renderReward(r){
    const offer=r.reward_track.pending;if(!offer)return;
    panel.append(make('p',`승리! 현재 LP ${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()} · 원정 금화 ${r.gold.toLocaleString()}`),make('p',`후보 ${offer.candidates.length}장 중 한 장을 골라줘. 선택 전에는 다음 길로 갈 수 없어.`));
    const candidates=make('div',null,'reward-candidates bridge147-rewards');candidates.id='bridge147-rewards';
    for(const card of offer.candidates){
      const tile=make('article',null,`reward-card tier-${card.rarity}`);tile.dataset.identity=card.identity_key;
      const art=button('',()=>showCard(card),'reward-art'),picture=make('img');picture.src=card.image;picture.alt=card.name_ko;picture.loading='lazy';art.setAttribute('aria-label',`${card.name_ko} 효과 보기`);art.append(picture);
      tile.append(art,make('span',card.rarity,'reward-tier'),make('strong',card.name_ko),button('이 카드 선택',()=>command('choose_reward',{offer_id:offer.id,identity_key:card.identity_key}),'bridge147-select'));candidates.append(tile);
    }panel.append(candidates,make('p',`후보 미등장 · SR 이상 ${r.reward_track.sr_misses}회 / UR ${r.reward_track.ur_misses}회`,'muted'));
  }
  function renderNode(entry,source,preview=false){
    currentNode={entry,r:source,preview};controls.replaceChildren();
    const r=getRun(),bound=client&&r?.id===source.id&&r?.bridge147;
    if(preview||!bound){controls.append(make('p','지도 미리보기야. 게임에 연결한 원정에서 실제 이동할 수 있어.','muted'));return;}
    const reachable=reachableNodes(r).includes(entry.id),retry=r.state==='at_node'&&r.current_node_id===entry.id;
    if(!reachable&&!retry){controls.append(make('p',r.state==='reward_pending'?'먼저 승리 카드 한 장을 선택해줘.':'현재 위치에서 이어지는 다음 칸을 선택해줘.','phase-note'));return;}
    if(['battle','elite','midboss','boss'].includes(entry.kind)){
      controls.append(button('이 상대와 전투 준비',async()=>{await command('prepare',{node_id:entry.id});document.getElementById('node-dialog').close();panel.scrollIntoView({block:'start'});},'primary'));
    }else if(entry.kind==='rest'){
      controls.append(make('h3','휴식 · 한 가지 선택'),make('p',`현재 LP ${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()}`));
      const choices=make('div',null,'rest-choices');for(const choice of REST_CHOICES){
        const choose=button('',async()=>{await command('rest',{node_id:entry.id,choice:choice.id});document.getElementById('node-dialog').close();},'rest-choice');choose.dataset.choice=choice.id;choose.append(make('strong',choice.name),make('span',choice.description));
        if(choice.id==='heal'&&r.lp===r.max_lp)choose.disabled=true;if(choice.id==='max_lp'&&r.max_lp>MAX_RUN_LP-500)choose.disabled=true;
        if(choice.id==='relic'&&!RELICS.some(item=>!r.relics.includes(item.id)&&r.max_lp+(item.max_lp||0)<=MAX_RUN_LP))choose.disabled=true;choices.append(choose);
      }controls.append(choices);
    }else{
      controls.append(make('p','이번 전투 연결판에서는 상점·이벤트 효과가 아직 준비 중이야. 보상을 받거나 LP를 바꾸지 않고 다음 길로 통과할 수 있어.','phase-note'));
      controls.append(button('이 칸 통과하기',async()=>{await command('pass_node',{node_id:entry.id});document.getElementById('node-dialog').close();},'primary'));
    }
    for(const b of controls.querySelectorAll('button'))b.disabled||=busy||!healthy;
  }
  try{client=createBridgeClient147(config);}catch(error){message.textContent=error.message;}
  if(!client)message.textContent||='공개 페이지에서는 게임에 자동 연결하지 않아. 슬롯 백업을 받은 뒤 PC에서 KoreanPatch/Launch-Roguelite.cmd를 실행하고 원정 화면에서 불러와 연결해줘.';
  else{message.textContent='게임의 원정 저장을 읽는 중…';guard(refresh);}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)guard(refresh);else clearTimeout(pollTimer);});
  const canArchive=r=>Boolean(client&&r?.bridge147&&['idle','resolved','prepared'].includes(r.bridge147.phase)&&!['queued','started','interrupted'].includes(launches[r.bridge147.attempt?.attempt_id]));
  render();return {render,renderNode,command,isLocal:()=>Boolean(client),isBound:run=>Boolean(client&&run?.bridge147),canArchive,
    archiveRun:async r=>command('archive_run',{},r),
    syncDeck:async draft=>command('sync_deck',{draft}),destroy:()=>{stopped=true;clearTimeout(pollTimer);}};
}
