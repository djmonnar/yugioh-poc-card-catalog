import {pendingEnhancement166,enhancementOptions166} from './roguelite166-instances.js?v=20261018-166';
import {upgradeCopyView166,decorateCopy166,appendCopyDetails166} from './roguelite166-copy-view.js?v=20261018-166';
import {createBridgeClient154} from './roguelite166-client.js?v=20261018-166';
import {reachableNodes} from './roguelite166-progress.js?v=20261018-166';
import {REST_CHOICES,MAX_RUN_LP,destinyChoice154,validateDuelRelics154,relicMeta157,pickRelic157,contentPolicy157,relicChoiceOptions163} from './roguelite166-rules.js?v=20261018-166';
import {FIELD_OPTIONS163,relicEffectText163} from './expedition-content166-core.js?v=20261018-166';
import {consumableChoices163} from './roguelite166-consumables.js?v=20261018-166';
import {inspectNode150} from './roguelite166-nodes.js?v=20261018-166';
import {filterNodeCards150,deckCopies150,priceText150,nodeResultObserved150,pendingReward163,battleOpponent163,selectedDeckKeys163,canSacrificeTwo163} from './roguelite166-present.js?v=20261018-166';
import {openingView163,pendingForge163,forgeOptions163} from './roguelite166-opening.js?v=20261018-166';
const labels={idle:'다음 길 선택',prepared:'전투 준비 완료',duel_started:'게임에서 전투 중',interrupted:'전투 중단 · 복구 대기',reward_pending:'승리 카드 선택',resolved:'다음 길 선택'};
export function mountBridge154({config,getRun,getSave,applyRuns,applyArchived,showCard,toast,onChanged,cards,assertReady=()=>{},onBusy=()=>{},onConsumableView=()=>{},closeToGame=()=>{}}){
  const make=(tag,text,className)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;};
  const status=make('section',null,'bridge147-connection');status.id='bridge147-connection';
  const title=make('h2','원정 기록');const message=make('p',null,'muted'),contentMessage=make('p',null,'content157-source muted'),actions=make('div',null,'actions');status.append(title,message,contentMessage,actions);
  document.querySelector('.storage-bar').before(status);
  const panel=make('section',null,'bridge147-panel');panel.id='bridge147-panel';document.getElementById('run-stage-content').append(panel);
  const controls=make('section',null,'bridge147-node-actions');controls.id='bridge147-node-actions';document.getElementById('node-description').after(controls);
  document.querySelector('.map-preview-note').textContent='칸을 눌러 상대와 다음 길을 확인해. 게임에 연결한 원정에서는 이어진 길로 이동하고 실제 듀얼을 진행할 수 있어.';
  document.querySelector('#node-dialog>.phase-note').textContent='미리보기에서는 원정 저장을 바꾸지 않아. 게임 연결 원정에서는 아래 선택을 실제 진행에 저장해.';
  if(config)document.querySelector('footer span').textContent='게임에 연결한 원정은 로컬 게임의 원정 저장이 기준이야. 이 브라우저의 복사본과 슬롯 백업은 따로 보관할 수 있어.';
  let choiceRelic163='destiny_draw',targetKey163=null,openingMode163=null;
  let client=null,busy=false,healthy=false,pollTimer=null,stopped=false,currentNode=null,launches={},nodeScreen=null,shownStage=null,destinyKey154=null,destinyListKey154=null,fieldKey163=null,useStatus163=null,useBusy163=false;
  function button(text,fn,className=''){
    const b=make('button',text,className);b.type='button';b.disabled=busy;
    b.addEventListener('click',()=>guard(fn));return b;
  }
  async function guard(fn){try{await fn();}catch(error){message.textContent=error.message;toast(error.message);}}
  function schedule(){
    clearTimeout(pollTimer);if(stopped||!client||document.hidden||useBusy163)return;
    const active=getRun();if(active?.bridge147&&['prepared','duel_started','interrupted'].includes(active.bridge147.phase))pollTimer=setTimeout(()=>guard(refresh),3000);
  }
  async function receiveStatus(payload,{allowDraftCommit=false}={}){
    // Only authenticated host responses contain executable archive receipts.
    // Apply old tombstones first so a recycled slot can hydrate its new run.
    for(const receipt of payload.archives)await applyArchived(receipt,{fromStatus:true});
    launches=payload.launches;contentMessage.textContent=(payload.content_source163??payload.content_source158??payload.content_source157)?.message??'';await applyRuns(payload.runs,{allowDraftCommit});client.acknowledgeStatus(payload);
  }
  async function refresh(){
    if(!client||busy||useBusy163)return;
    busy=true;onBusy(true);render();
    try{const payload=await client.status();await receiveStatus(payload);healthy=true;message.textContent='원정 기록을 불러왔어.';}
    catch(error){healthy=false;message.textContent=`${error.message} 진행을 임의로 처리하지 않았어.`;}
    finally{busy=false;onBusy(false);onChanged();render();schedule();}
  }
  async function command(action,args={},selectedRun=getRun()){
    if(!client||!healthy)throw new Error('먼저 게임 연결을 확인해줘.');if(busy||useBusy163)throw new Error('게임 저장을 처리 중이야.');
    if(!selectedRun)throw new Error('원정 슬롯을 불러와줘.');
    if(['enter_node','buy_card','refresh_shop','remove_card','sell_card','choose_opening','forge_card163','enhance_card166','event_choice','leave_node','prepare','rest','set_relic_choice'].includes(action))assertReady();
    busy=true;onBusy(true);render();
    try{
      const reply=await client.command(action,selectedRun,args);
      if(reply.archived){await applyArchived(reply);onChanged();render();return reply;}
      if(reply.native_status&&args.attempt_id&&reply.run.revision>=(getRun()?.revision??0))launches[args.attempt_id]=reply.native_status;
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
          (action==='choose_opening'&&next.opening163?.status==='chosen'&&next.opening163.choice===args.choice&&next.opening163.chosen_identity_key===(args.identity_key??null))||
          (action==='enhance_card166'&&next.runtime166?.upgrade_claims.some(c=>c.source_id===args.claim_id&&c.instance_id===args.instance_id))||
          (action==='forge_card163'&&next.runtime163?.forge_claims.some(c=>c.relic_id===args.relic_id&&c.instance_id===args.instance_id))||
          (action==='choose_reward'&&next.reward_claims.some(c=>c.id===args.offer_id&&c.identity_key===args.identity_key))||
          sameDeck||
          (action==='set_relic_choice'&&(args.relic_id==='field_legacy'?(next.relic_choices163??next.relic_choices158)?.field_legacy===args.field_id:(args.relic_id==='destiny_draw'?next.relic_choices154?.destiny_draw:next.relic_choices163?.[args.relic_id])===args.identity_key))||
          (action==='prepare'&&next.bridge147?.attempt?.node_id===args.node_id&&next.revision>selectedRun.revision)||
          (action==='start'&&['queued','started','resolved','interrupted'].includes(launches[args.attempt_id]))||
          (action==='cancel_prepared'&&next.state==='at_node'&&next.bridge147?.phase==='resolved')||
          (action==='recover_interrupted'&&next.bridge147?.attempt?.attempt_id===args.attempt_id&&next.bridge147?.phase==='prepared')||
          (action==='rest'&&next.rest_claims.some(c=>c.node_id===args.node_id&&c.choice===args.choice))||
          (action==='pass_node'&&next.history.some(c=>c.kind==='pass_node'&&c.node_id===args.node_id))||
          nodeResultObserved150(action,args,selectedRun,next));
        message.textContent=observed?'응답이 늦었지만 게임에 저장된 진행을 확인했어. 같은 보상을 다시 지급하지 않았어.':'게임에 기록된 최신 진행을 다시 읽었어. 완료되지 않은 요청은 같은 내용으로 다시 확인해줘.';
        if(observed)return next;
      }catch(refreshError){message.textContent=`${refreshError.message} 기존 진행은 보존했어. 같은 요청 번호로 다시 확인할 수 있어.`;}
      throw error;
    }
    finally{busy=false;onBusy(false);render();schedule();}
  }
  function render(){
    status.dataset.health=busy?'loading':healthy?'ready':'error';
    actions.replaceChildren();if(client)actions.append(button(busy?'기록 확인 중…':'다시 확인',refresh));
    panel.replaceChildren();const r=getRun();panel.hidden=!r;if(!r){document.getElementById('run-stage-dialog').close();return;}
    if(!client){panel.append(make('p','이 화면은 지도와 보상 체험용이야. 실제 원정은 PC에서 게임을 실행하고 메인 메뉴의 ‘원정 전투’를 눌러 열어줘.','phase-note'));return;}
    if(!r.bridge147){
      panel.append(make('h3','이 슬롯을 게임에 연결'),make('p','시작 덱·지도·상대를 고정하고 실제 전투를 시작해. 계정의 일반 덱과 보유 카드는 원정과 분리돼.'));
      const bind=button('이 원정으로 게임 연결',()=>command('bind',{},r),'primary');bind.disabled||=!healthy;panel.append(bind);const stage=document.getElementById('run-stage-dialog');if(document.body.dataset.screen==='run'&&shownStage!==`${r.id}:bind`){shownStage=`${r.id}:bind`;if(!stage.open)stage.showModal();}return;
    }
    if(r.content163&&r.opening163.status==='pending'){renderOpening163(r);ensureStage163(`${r.id}:opening`);return;}
    if(pendingEnhancement166(r)){renderEnhancement166(r);ensureStage163(`${r.id}:enhance:${pendingEnhancement166(r).claim_id}`);return;}
    if(r.content163&&pendingForge163(r)){renderForge163(r);ensureStage163(`${r.id}:forge:${pendingForge163(r).id}`);return;}
    const state=r.bridge147,a=state.attempt;panel.append(make('h3',labels[state.phase]||r.state));
    panel.dataset.phase=state.phase;panel.dataset.state=r.state;panel.dataset.relicCount=String(r.relics.length);
    if(r.state==='defeated')panel.append(make('p','원정이 끝났어. 실제 종료 LP와 전투 기록을 저장했어. 다른 슬롯에서 새로운 원정을 시작할 수 있어.'));
    else if(r.state==='completed')panel.append(make('p','봉인된 듀얼의 탑을 완주했어! 마지막 카드 보상까지 원정 카드함에 저장했어.'));
    else if(state.phase==='prepared'){
      panel.append(make('p',`${battleOpponent163(r,a)?.opponent_name??'특별 결투 상대'} · 시작 LP ${a.start_lp.toLocaleString()} / ${a.max_lp.toLocaleString()}`));
      if(launches[a.attempt_id]==='queued')panel.append(make('p','게임의 전투 시작 응답을 기다리고 있어. 대기 중에는 다시 시작하거나 취소하지 않아.'));
      else panel.append(button('듀얼 시작',()=>{validateDuelRelics154(r);return command('start',{attempt_id:a.attempt_id});},'primary'),button('준비 취소',()=>command('cancel_prepared',{attempt_id:a.attempt_id})));
    }else if(state.phase==='duel_started')panel.append(make('p','게임 창에서 듀얼을 진행해줘. 종료 기록을 기다리고 있어. 창을 닫거나 다시 열어도 같은 전투 기록을 확인해.'));
    else if(state.phase==='interrupted'){
      panel.append(make('p','완료 기록이 없는 중단이야. 승패나 보상은 만들지 않았어. 같은 상대와 전투 전 LP로 다시 시작할 수 있어.'));
      panel.append(button('같은 전투 다시 준비',()=>command('recover_interrupted',{attempt_id:a.attempt_id}),'primary'));
    }else if(pendingReward163(r)||state.phase==='reward_pending')renderReward(r);
    else if(r.state==='at_node'&&['shop','event'].includes(r.map.nodes.find(n=>n.id===r.current_node_id)?.kind)){
      const entry=r.map.nodes.find(n=>n.id===r.current_node_id);
      panel.append(make('p',entry.kind==='shop'?'카드와 유물을 살펴본 뒤 다음 길로 나가줘. 한 번 떠난 상점에는 다시 들어갈 수 없어.':'선택을 마친 뒤 다음 길로 나가줘. 닫았다 다시 열어도 같은 사건이 기다리고 있어.'));
      panel.append(button(entry.kind==='shop'?'현재 상점 다시 열기':'현재 이벤트 다시 열기',()=>openCurrentNode(entry),'primary'));
    }
    else if(r.state==='at_node'&&a){panel.append(make('p','현재 전투를 다시 준비할 수 있어. 무승부라면 종료 LP를 이어가고 보상은 받지 않아.'));panel.append(button('현재 상대 다시 준비',()=>command('prepare',{node_id:a.node_id}),'primary'));}
    else panel.append(make('p','지도에서 이어지는 다음 길을 선택해. 상대와 덱을 확인한 뒤 전투를 준비할 수 있어.'));
    renderRelics(r);if(document.getElementById('destiny-dialog154').open)renderDestiny154(r);if(document.getElementById('field-dialog163').open)renderField163(r);
    if(currentNode)renderNode(currentNode.entry,currentNode.r,currentNode.preview);
    for(const b of panel.querySelectorAll('button'))b.disabled||=busy||!healthy;
    const stage=document.getElementById('run-stage-dialog'),needsStage=Boolean(pendingReward163(r))||['prepared','duel_started','interrupted','reward_pending'].includes(state.phase)||['defeated','completed'].includes(r.state),key=`${r.id}:${state.phase}:${a?.attempt_id||''}:${pendingReward163(r)?.id||''}`;
    if(needsStage&&shownStage!==key&&document.body.dataset.screen==='run'&&!document.getElementById('consumables-dialog163').open){shownStage=key;if(!stage.open)stage.showModal();}
    if(!needsStage&&stage.open)stage.close();
  }
  function ensureStage163(key){const dialog=document.getElementById('run-stage-dialog');for(const b of panel.querySelectorAll('button'))b.disabled||=busy||!healthy;if(document.body.dataset.screen==='run'&&shownStage!==key&&!document.getElementById('consumables-dialog163').open){shownStage=key;if(!dialog.open)dialog.showModal();}}
  function renderOpening163(r){
    const view=openingView163(r);panel.classList.add('opening163');panel.append(make('h3',view.title),make('p',view.description));
    if(['r_card','sr_card'].includes(openingMode163)){
      panel.append(make('p',openingMode163==='sr_card'?'이 카드를 받으면 현재 LP 1,000을 지불해.':'R 카드 한 장을 골라 원정 카드함에 넣어.'));
      const grid=make('div',null,'reward-candidates bridge147-rewards');for(const card of view[openingMode163==='r_card'?'r_candidates':'sr_candidates']){const tile=make('article',null,`reward-card tier-${card.rarity}`);tile.append(artButton(card),make('span',card.rarity,'reward-tier'),make('strong',card.name_ko),button('이 카드 선택',()=>command('choose_opening',{choice:openingMode163,identity_key:card.identity_key}),'primary'));grid.append(tile);}panel.append(grid,button('네 가지 선물 다시 보기',()=>{openingMode163=null;render();}));
    }else{
      const grid=make('div',null,'opening163-options');for(const choice of view.choices){const b=button('',()=>{if(['r_card','sr_card'].includes(choice.id)){openingMode163=choice.id;render();}else return command('choose_opening',{choice:choice.id});},'opening163-choice');b.dataset.choice=choice.id;b.append(make('strong',choice.name),make('span',choice.description));b.disabled||=choice.disabled;grid.append(b);}panel.append(grid,make('p','하나를 확정하면 나머지 선물은 사라져. 선택 전까지 지도와 전투는 진행되지 않아.','muted'));
    }
  }
  function renderForge163(r){
    const gain=pendingForge163(r),meta=relicMeta157(r,gain.relic_id);panel.classList.remove('opening163');panel.append(relicIcon154(meta.id),make('h3',meta.name),make('p','강화할 몬스터 카드 한 장을 골라. 같은 이름을 여러 장 넣었어도 선택한 이 한 장만 강화돼.'));
    const grid=make('div',null,'reward-candidates bridge147-rewards forge163-grid');for(const item of forgeOptions163(r)){const tile=make('article',null,`reward-card tier-${item.card.rarity}`);tile.dataset.instance=item.id;tile.append(artButton(item.card),make('strong',item.card.name_ko),make('small',`카드 ${item.id.slice(5)} · ${item.group==='extra'?'엑스트라':'메인'} 덱`),make('p',item.upgrade_text||'아직 제련하지 않은 카드'),button(meta.id==='forge_attack'?`공격력 +${meta.params.atk}`:`수비력 +${meta.params.def}`,()=>command('forge_card163',{relic_id:meta.id,instance_id:item.id}),'primary'));grid.append(tile);}panel.append(grid);
  }
  function renderEnhancement166(r){
    const claim=pendingEnhancement166(r);panel.classList.remove('opening163');panel.append(relicIcon154(claim.relic_id),make('h3',claim.name),make('p',claim.description),make('p','메인 덱 몬스터 중에서 골라. 같은 이름의 카드가 여러 장이어도 고른 한 장에만 적용돼.','muted'));
    const grid=make('div',null,'reward-candidates bridge147-rewards forge166-grid');
    for(const item of enhancementOptions166(r)){
      const view=upgradeCopyView166(item),tile=make('article',null,`reward-card tier-${item.card.rarity}`);tile.dataset.instance=item.instance_id??item.id;decorateCopy166(tile,item);tile.append(artButton(item.card),make('strong',item.card.name_ko),make('small',view.copy_label));appendCopyDetails166(tile,item,make);
      const choose=button('이 카드 강화',()=>command('enhance_card166',{claim_id:claim.claim_id,instance_id:item.instance_id??item.id,stat:'atk'}),'primary');choose.disabled||=Boolean(item.disabled);tile.append(choose,make('p',item.reason??'','node150-reason'));grid.append(tile);
    }panel.append(grid);
  }
  function renderReward(r){
    const offer=pendingReward163(r);if(!offer)return;
    const attemptNode=r.map.nodes.find(n=>n.id===r.bridge147?.attempt?.node_id),boss=attemptNode?.kind==='boss'&&!r.nodes163?.pending_reward&&!r.runtime163?.rest_reward;if(boss){panel.append(make('h3','보스 격파 보상'),make('p','원정 금화 +100 · R 이상 무작위 유물 · SR 후보 5장 중 1장','boss166-reward'));const gained=[...r.history].reverse().find(h=>h.kind==='relic'&&h.node_id===attemptNode.id);if(gained?.relic_id){const relic=relicMeta157(r,gained.relic_id),line=make('div',null,'boss166-relic');line.append(relicIcon154(gained.relic_id),make('strong',`획득 유물 · ${relic.rarity} ${relic.name}`),make('p',relic.effect_text??relic.description));panel.append(line);}else if(gained?.reason)panel.append(make('p',gained.reason,'muted'));}
    panel.append(make('p',`${r.runtime163?.rest_reward?'드림캐쳐 · 휴식 카드 보상':(r.nodes163??r.nodes159??r.nodes158)?.pending_reward?'이벤트 카드 보상':'승리!'} · 현재 LP ${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()} · 원정 금화 ${r.gold.toLocaleString()}`),make('p',`후보 ${offer.candidates.length}장 중 한 장을 골라줘. 선택 전에는 다음 길로 갈 수 없어.`));
    const candidates=make('div',null,'reward-candidates bridge147-rewards');candidates.id='bridge147-rewards';
    for(const card of offer.candidates){
      const tile=make('article',null,`reward-card tier-${card.rarity}`);tile.dataset.identity=card.identity_key;
      const art=button('',()=>showCard(card),'reward-art'),picture=make('img');picture.src=card.image;picture.alt=card.name_ko;picture.loading='lazy';art.setAttribute('aria-label',`${card.name_ko} 효과 보기`);art.append(picture);
      tile.append(art,make('span',card.rarity,'reward-tier'),make('strong',card.name_ko),button('이 카드 선택',()=>command('choose_reward',{offer_id:offer.id,identity_key:card.identity_key}),'bridge147-select'));candidates.append(tile);
    }panel.append(candidates);if(!(r.nodes163??r.nodes159??r.nodes158)?.pending_reward)panel.append(make('p',`후보 미등장 · SR 이상 ${r.reward_track.sr_misses}회 / UR ${r.reward_track.ur_misses}회`,'muted'));
  }
  const relicOrder154=['golden_scarab','restoring_ankh','card_slate','merchant_seal','life_fragment','kuriboh_charm','destiny_draw','card_duplication','generic'];
  function relicIcon154(id){const index=Math.max(0,relicOrder154.indexOf(id)<0?8:relicOrder154.indexOf(id)),icon=make('span',null,'relic-icon154');icon.dataset.relic=id;icon.style.setProperty('--relic-x154',`${index%3*50}%`);icon.style.setProperty('--relic-y154',`${Math.floor(index/3)*50}%`);if(['field_legacy','draw_scroll','draw_tome','healing_potion','greater_healing_potion','rare_cache','fusion_cache','destruction_scroll','flame_scroll','thorn_armor','golden_pot','wise_burial','prepared_trap','prepared_spell','prepared_monster','weak_power'].includes(id)){icon.style.backgroundImage=`url('assets/expedition${['field_legacy','draw_scroll','draw_tome','healing_potion','greater_healing_potion','rare_cache','fusion_cache'].includes(id)?158:163}/relic-${id}.svg')`;icon.style.backgroundSize='contain';icon.style.backgroundPosition='center';icon.style.backgroundRepeat='no-repeat';}icon.setAttribute('aria-hidden','true');return icon;}
  function choiceKey163(r,id=choiceRelic163){return id==='destiny_draw'?destinyChoice154(r):r.relic_choices163?.[id]??null;}
  function canChooseDestiny154(r,id=choiceRelic163){return Boolean(client&&healthy&&!busy&&r.relics.includes(id)&&['between_nodes','at_node'].includes(r.state)&&['idle','resolved'].includes(r.bridge147?.phase));}
  function openDeckChoice163(id){choiceRelic163=id;const r=getRun();destinyKey154=choiceKey163(r);destinyListKey154=null;document.getElementById('destiny-title154').textContent=`${relicMeta157(r,id)?.name??'유물'} · 카드 지정`;document.querySelector('#destiny-dialog154>p').textContent=id==='wise_burial'?'처음 패를 받기 전에 묘지로 보낼 메인 덱 카드 1장을 골라줘. 첫 패에도 같은 카드를 지정하면 덱에 2매 이상 필요해.':'메인 덱의 해당 종류 카드 1장을 골라줘. 처음 받는 4장에 포함되며 패 매수는 늘어나지 않아.';document.getElementById('destiny-search154').value='';renderDestiny154(r);document.getElementById('destiny-dialog154').showModal();}
  function openDestiny154(){openDeckChoice163('destiny_draw');}
  function renderDestiny154(r){
    const list=document.getElementById('destiny-cards154'),options=relicChoiceOptions163(r,choiceRelic163),key=`${r.id}:${r.revision}:${choiceRelic163}`;
    if(destinyListKey154!==key){list.replaceChildren();for(const row of options){const card=row.card,tile=make('article',null,'destiny-card154');tile.dataset.identity=card.identity_key;tile.dataset.search=[card.name_ko,card.name_en,card.description_ko,card.race,card.attribute].join(' ').toLocaleLowerCase('ko');const select=button('이 카드 선택',()=>{destinyKey154=card.identity_key;renderDestiny154(getRun());},'destiny-select154');tile.append(artButton(card),make('strong',card.name_ko),make('span',`메인 덱 ${row.count}장`),select,make('p',row.reason||'','node150-reason'));list.append(tile);}destinyListKey154=key;}
    const query=document.getElementById('destiny-search154').value.trim().toLocaleLowerCase('ko');for(const tile of list.children){const option=options.find(row=>row.identity_key===tile.dataset.identity);tile.hidden=!!query&&!tile.dataset.search.includes(query);tile.classList.toggle('chosen',tile.dataset.identity===destinyKey154);tile.querySelector('.destiny-select154').disabled=!canChooseDestiny154(r)||!!option?.disabled;tile.querySelector('.destiny-select154').textContent=tile.dataset.identity===destinyKey154?'선택됨':'이 카드 선택';}
    const selected=options.find(row=>row.identity_key===destinyKey154),valid=selected&&!selected.disabled;
    document.getElementById('destiny-status154').textContent=!canChooseDestiny154(r)?'전투·보상을 마친 뒤 지정 카드를 바꿀 수 있어.':!options.length?'현재 메인 덱에 지정할 수 있는 종류의 카드가 없어. 덱을 편집해줘.':selected?.reason?selected.reason:valid?`${selected.card.name_ko} · ${choiceRelic163==='wise_burial'?'첫 패를 받기 전에 묘지로 보내.':'다음 듀얼의 첫 패에 포함돼.'}`:'메인 덱 카드 1장을 골라줘.';
    const save=document.getElementById('save-destiny154');save.textContent='이 카드로 지정';save.disabled=!canChooseDestiny154(r)||!valid;
  }
  function missingChoice163(r){return ['wise_burial','prepared_trap','prepared_spell','prepared_monster'].find(id=>r.relics.includes(id)&&!relicChoiceOptions163(r,id).some(row=>row.identity_key===choiceKey163(r,id)&&!row.disabled));}
  function appendMissingChoice163(target,r){const id=missingChoice163(r);if(!id)return false;target.append(make('p',`${relicMeta157(r,id)?.name??'유물'}에 사용할 메인 덱 카드를 지정해줘. 현재 덱 매수와 종류를 확인해.`,'phase-note'),button('유물 카드 지정',()=>openDeckChoice163(id),'primary'));return true;}
  document.getElementById('close-destiny154').addEventListener('click',()=>document.getElementById('destiny-dialog154').close());
  document.getElementById('destiny-search154').addEventListener('input',()=>renderDestiny154(getRun()));
  document.getElementById('save-destiny154').addEventListener('click',()=>guard(async()=>{await command('set_relic_choice',{relic_id:choiceRelic163,identity_key:destinyKey154});document.getElementById('destiny-dialog154').close();toast('유물에 사용할 카드를 지정했어.');}));
  function canChooseField163(r){return Boolean(client&&healthy&&!busy&&r?.relics.includes('field_legacy')&&!(r.relic_choices163??r.relic_choices159??r.relic_choices158)?.field_legacy&&!pendingReward163(r)&&['between_nodes','at_node'].includes(r.state)&&['idle','resolved'].includes(r.bridge147?.phase));}
  function openField163(){const r=getRun();fieldKey163=r?.relic_choices163?.field_legacy??null;renderField163(r);const dialog=document.getElementById('field-dialog163');if(!dialog.open)dialog.showModal();}
  function renderField163(r){
    const meta=relicMeta157(r,'field_legacy'),allowed=meta?.params?.fields??[],selected=(r.relic_choices163??r.relic_choices159??r.relic_choices158)?.field_legacy;
    document.getElementById('field-cards163').replaceChildren(...FIELD_OPTIONS163.filter(field=>allowed.includes(field.id)).map(field=>{
      const tile=make('article',null,'field163-card'),card=cards.find(card=>card.identity_key===field.identity_key);tile.dataset.field=field.id;tile.classList.toggle('chosen',fieldKey163===field.id);
      if(card)tile.append(artButton(card));tile.append(make('strong',field.name));const choose=button(fieldKey163===field.id?'선택됨':'이 필드 선택',()=>{fieldKey163=field.id;renderField163(getRun());});choose.disabled=!canChooseField163(r);tile.append(choose);return tile;
    }));
    document.getElementById('field-status163').textContent=selected?`${FIELD_OPTIONS163.find(field=>field.id===selected)?.name??'선택 필드'} · 이번 원정의 시작 필드로 고정됐어.`:!canChooseField163(r)?'전투와 보상 처리를 마친 뒤 시작 필드를 고를 수 있어.':fieldKey163?`${FIELD_OPTIONS163.find(field=>field.id===fieldKey163)?.name} · 고정한 뒤에는 바꿀 수 없어.`:'시작할 필드 한 가지를 골라줘.';
    document.getElementById('save-field163').disabled=!canChooseField163(r)||!allowed.includes(fieldKey163);
  }
  document.getElementById('close-field163').addEventListener('click',()=>document.getElementById('field-dialog163').close());
  document.getElementById('save-field163').addEventListener('click',()=>guard(async()=>{await command('set_relic_choice',{relic_id:'field_legacy',field_id:fieldKey163});document.getElementById('field-dialog163').close();toast('이번 원정의 시작 필드를 고정했어.');}));
  function renderConsumables163(){
    const payload=useStatus163,hostRun=payload?.run,list=document.getElementById('consumables-list163');
    document.getElementById('consumables-status163').textContent=useBusy163?'소모품 처리 결과를 확인하는 중…':payload?.pending_use_id?'먼저 사용한 소모품의 처리 결과를 기다려줘.':payload?.pending_request?'앞서 보낸 사용 요청을 보존했어. 새로 소모하지 않고 같은 요청의 상태를 확인해줘.':payload?.reason||(!payload?.items.length?'보유한 원정 소모품이 없어.':'남은 횟수와 효과를 확인하고 사용할 소모품을 골라줘.');
    list.replaceChildren(...(payload?.items??[]).map(item=>{
      const reload=['reload','reload_skip'].includes(item.item_id),meta=hostRun?relicMeta157(hostRun,reload?'reload':item.item_id):null,tile=make('article',null,'consumable163-item');tile.dataset.item=item.item_id;
      const effect=reload?(item.item_id==='reload_skip'?'이번 전투의 리로드를 사용하지 않고 넘어가.':'손패 1장을 덱에 넣고 섞은 다음 1장 드로우.'):item.item_id==='lizard_tail'?'무승부로 전투 종료 · 전투 전 위치와 LP 복원':item.item_id==='destruction_scroll'?'필드 카드 1장 선택 파괴 · 발동에 체인 불가 · 파괴 면역·대체 적용':item.item_id==='moon_book'?'앞면 표시 몬스터 1장 → 뒷면 수비 표시 · 전투당 1회':item.item_id==='grimoire_search'?'매지션의 마도서 · 특수 소환한 강화 카드의 효과로 덱의 마법 카드 1장 서치':item.item_id==='flame_scroll'?`상대에게 효과 피해 ${item.amount.toLocaleString()}`:item.item_id.startsWith('draw_')?'카드 1장 드로우':`LP ${item.amount.toLocaleString()} 회복`;
      tile.append(relicIcon154(reload?'reload':item.item_id),make('h3',item.item_id==='grimoire_search'?'매지션의 마도서 · 마법 서치':item.item_id==='reload_skip'?'리로드 건너뛰기':meta?.name??'원정 소모품'),make('p',effect),make('strong',item.item_id==='moon_book'?`이번 전투 남은 횟수 ${item.remaining} / 1`:item.item_id==='grimoire_search'?'현재 특수 소환 효과 · 마법 1장 선택':reload?'이번 전투의 첫 드로우 후 1회 선택':`원정 전체 남은 횟수 ${item.remaining} / ${(hostRun?.nodes163??hostRun?.nodes159??hostRun?.nodes158)?.consumables?.[item.item_id]?.total??item.remaining}`));
      if(['destruction_scroll','reload','moon_book','grimoire_search'].includes(item.item_id)){const label=make('label',item.item_id==='reload'?'덱으로 돌릴 손패 카드':item.item_id==='moon_book'?'뒷면 수비로 바꿀 앞면 몬스터':item.item_id==='grimoire_search'?'덱에서 가져올 마법 카드':'파괴할 필드 카드'),select=make('select');select.append(new Option('대상을 골라줘.',''));for(const target of item.targets??[])select.append(new Option(target.label,target.target_id));const fixed=payload.pending_request?.item_id===item.item_id?payload.pending_request.target_id:null;select.value=fixed??targetKey163??'';select.disabled=useBusy163||!!payload.pending_request;select.onchange=()=>{targetKey163=select.value;renderConsumables163();};label.append(select);tile.append(label);}
      const retry=payload.pending_request?.item_id===item.item_id&&!payload.pending_use_id,reason=item.reason||(!payload.safe?payload.reason:'')||(!item.remaining?'사용 횟수를 모두 썼어.':'');
      const use=button(retry?'같은 사용 요청 다시 확인':item.item_id==='grimoire_search'?'이 마법을 패에 넣기':item.item_id==='moon_book'?'뒷면 수비로 변경':'소모품 사용',async()=>{
        if(useBusy163||!useStatus163?.run)throw new Error('먼저 현재 전투 상태를 확인해줘.');useBusy163=true;onBusy(true);renderConsumables163();
        try{const response=await client.useConsumable163(useStatus163.run,item.item_id,['destruction_scroll','reload','moon_book','grimoire_search'].includes(item.item_id)?(payload.pending_request?.target_id??targetKey163):null);await applyRuns([response.run]);onChanged();useStatus163={...useStatus163,run:response.run,safe:false,pending_request:null,pending_use_id:['reserved','accepted','queued'].includes(response.status)?response.use_id:null,reason:'게임에서 사용 결과를 확인해줘. 다시 F7로 열면 최신 사용 가능 상태를 불러와.',items:useStatus163.items.map(row=>({...row,remaining:(response.run.nodes163??response.run.nodes158)?.consumables?.[row.item_id]?.remaining??row.remaining,can_use:false}))};document.getElementById('consumables-status163').textContent=['rejected','interrupted'].includes(response.status)?'게임에 기록된 사용 결과를 확인했어. 다시 열면 최신 남은 횟수를 볼 수 있어.':'사용 요청을 전달했어. 게임에서 결과를 확인해줘.';}
        catch(error){try{useStatus163=await client.useStatus163();if(useStatus163.run)await applyRuns([useStatus163.run]);onChanged();}catch{}throw error;}
        finally{useBusy163=false;onBusy(false);renderConsumables163();}
      },'primary');
      use.disabled=['destruction_scroll','reload','moon_book','grimoire_search'].includes(item.item_id)&&!retry&&!(item.targets??[]).some(target=>target.target_id===targetKey163)||Boolean(payload.pending_search_seq>0&&item.item_id!=='grimoire_search')||useBusy163||busy||!payload.safe||!item.can_use||!item.remaining||!!payload.pending_use_id||Boolean(payload.pending_request&&!retry);tile.append(use,make('p',reason,'node150-reason'));return tile;
    }));
    if(hostRun?.relics.includes('tactics_manual'))list.prepend(make('p',`병법서 · ${hostRun.runtime163?.draw_progress??0} / ${relicMeta157(hostRun,'tactics_manual').params.threshold} · 누적 드로우 ${hostRun.runtime163?.total_draws??0}장`,'tactics-counter163'));
    document.getElementById('refresh-consumables163').disabled=useBusy163;document.getElementById('close-consumables163').disabled=useBusy163||!canReturnToGame166();const back=document.getElementById('game152-close');if(back)back.disabled=useBusy163||!canReturnToGame166();if(!canReturnToGame166())document.getElementById('consumables-status163').textContent='매지션의 마도서 효과 · 덱에서 패에 넣을 마법 카드 1장을 반드시 골라줘.';
  }
  async function openConsumables163({onlyIfOverlay=true}={}){
    if(!client||useBusy163)return false;
    useStatus163=await client.useStatus163();if(useStatus163.run){await applyRuns([useStatus163.run]);onChanged();}
    const visible=useStatus163.overlay_open&&useStatus163.run?.bridge147?.phase==='duel_started';
    if(onlyIfOverlay&&!visible){document.getElementById('consumables-dialog163').close();onConsumableView(false);return false;}
    for(const dialog of document.querySelectorAll('dialog[open]'))if(dialog.id!=='consumables-dialog163')dialog.close();onConsumableView(true);renderConsumables163();
    const dialog=document.getElementById('consumables-dialog163');if(!dialog.open)dialog.showModal();return true;
  }
  function canReturnToGame166(){return !(useStatus163?.pending_search_seq>0&&useStatus163?.items?.some(item=>item.item_id==='grimoire_search'&&item.can_use));}
  function closeConsumables163(){if(useBusy163||busy||!canReturnToGame166())return;if(closeToGame()===false){toast('게임의 기록 처리가 끝난 뒤 전투로 돌아갈 수 있어.');return;}document.getElementById('consumables-dialog163').close();onConsumableView(false);}
  document.getElementById('close-consumables163').addEventListener('click',closeConsumables163);
  document.getElementById('consumables-dialog163').addEventListener('cancel',event=>{event.preventDefault();closeConsumables163();});
  document.getElementById('refresh-consumables163').addEventListener('click',()=>guard(()=>openConsumables163()));
  function renderRelics(r){
    const section=make('details',null,'node150-relics');section.setAttribute('aria-label','보유 유물');section.append(make('summary',`함께하는 유물 ${r.relics.length}개`));
    if(!r.relics.length)section.append(make('p','아직 유물이 없어. 엘리트·보스 전투, 휴식과 이벤트에서 만날 수 있어.','muted'));
    else{const list=make('ul');for(const id of r.relics){const relic=relicMeta157(r,id);if(!relic)continue;const item=make('li');item.dataset.relic=id;item.append(relicIcon154(id),make('strong',relic.name),make('span',relic.rarity??'','relic163-tier'),make('span',relic.effect_text??relic.description));if(id==='destiny_draw'){const key=destinyChoice154(r),card=r.collection.find(e=>e.card.identity_key===key)?.card;item.append(make('p',card?`지정 카드 · ${card.name_ko}`:'첫 패 카드를 아직 지정하지 않았어.','destiny-current154'));const choose=button(card?'지정 카드 바꾸기':'첫 패 카드 지정',openDestiny154,'primary');choose.disabled=!canChooseDestiny154(r,'destiny_draw');item.append(choose);}if(['wise_burial','prepared_trap','prepared_spell','prepared_monster'].includes(id)){const key=choiceKey163(r,id),card=r.collection.find(row=>row.card.identity_key===key)?.card;item.append(make('p',card?`지정 카드 · ${card.name_ko}`:'사용할 카드를 아직 지정하지 않았어.'));const choose=button(card?'지정 카드 바꾸기':'사용 카드 지정',()=>openDeckChoice163(id),'primary');choose.disabled=!(client&&healthy&&!busy&&['between_nodes','at_node'].includes(r.state)&&['idle','resolved'].includes(r.bridge147?.phase));item.append(choose);}if(id==='field_legacy'){const chosen=(r.relic_choices163??r.relic_choices159??r.relic_choices158)?.field_legacy;item.append(make('p',chosen?`시작 필드 · ${FIELD_OPTIONS163.find(field=>field.id===chosen)?.name??chosen}`:'시작 필드를 아직 선택하지 않았어.'));if(!chosen){const choose=button('시작 필드 선택',openField163,'primary');choose.disabled=!canChooseField163(r);item.append(choose);}}const supply=consumableChoices163(r).find(row=>row.item_id===id);if(supply)item.append(make('p',`원정 전체 남은 횟수 ${supply.remaining} / ${supply.total}`,'consumable163-remaining'));list.append(item);}section.append(list);}
    if(r.relics.includes('tactics_manual'))section.querySelector('[data-relic="tactics_manual"]').append(make('strong',`누적 ${r.runtime163?.draw_progress??0} / ${relicMeta157(r,'tactics_manual').params.threshold}`,'tactics-counter163'));
    const target=document.getElementById('run-relic-list');target.replaceChildren(section);section.open=true;
  }
  function openCurrentNode(entry){
    const r=getRun();document.getElementById('node-dialog').dataset.bound='true';document.getElementById('node-title').textContent=`${r.campaign164?r.campaign164.chapter+'장 · ':''}${r.campaign164?(entry.floor-1)%15+1:entry.floor}층 · ${entry.kind==='shop'?'카드 상점':'랜덤 이벤트'}`;
    document.getElementById('node-description').textContent=entry.kind==='shop'?'탑을 오르는 듀얼리스트를 위한 작은 상점. 현재 원정 금화로만 거래해.':'탑에서 마주친 인연이 다음 듀얼을 바꿀지도 몰라.';
    document.getElementById('node-opponent').hidden=true;document.getElementById('rest-preview').hidden=true;
    renderNode(entry,r);const dialog=document.getElementById('node-dialog');if(!dialog.open)dialog.showModal();
  }
  function screen(key,build){
    if(nodeScreen?.key!==key){controls.replaceChildren();nodeScreen={key,...build()};}return nodeScreen;
  }
  function clearScreen(){controls.replaceChildren();nodeScreen=null;}
  function artButton(card){
    const art=button('',()=>showCard(card),'node150-art');art.setAttribute('aria-label',`${card.name_ko} 효과 보기`);
    const picture=make('img');picture.src=card.image;picture.alt=card.name_ko;picture.loading='lazy';art.append(picture);return art;
  }
  function setPrice(target,base,price){
    target.textContent=`${price.toLocaleString()} 금화`;target.setAttribute('aria-label',priceText150(base,price));
    if(base!==price)target.append(make('del',`${base.toLocaleString()} 금화`));
  }
  function renderShop(entry,r,view){
    const ui=screen(`${r.id}:${entry.id}:shop`,()=>{
      const top=make('div',null,'node150-shop-heading'),gold=make('p',null,'node150-gold'),discount=make('p',null,'node150-discount');top.append(make('h3','탑의 카드 상점'),gold,discount);
      const refresh=button('상품 새로고침',()=>command('refresh_shop',{node_id:entry.id}),'shop-refresh164');refresh.hidden=!r.campaign164;top.append(refresh);
      const grid=make('div',null,'node163-products'),groups={};grid.setAttribute('aria-label','판매 카드');
      for(const [id,title] of [['random','이번 방문의 카드'],['fixed','상시 판매 카드'],['fusion','융합 관련 카드'],['ritual','의식 관련 카드']]){const section=make('section',null,'node163-product-group'),heading=make('h4',title),note=make('p',null,'node163-group-note muted'),items=make('div',null,'node150-stock');section.dataset.group=id;section.append(heading,note,items);grid.append(section);groups[id]={section,heading,note,items};}
      const relic=make('div',null,'node150-stock node157-relic-stock');relic.setAttribute('aria-label','판매 유물');
      const removal=make('details',null,'node150-removal');removal.append(make('summary',r.content163?'카드 판매 · 한 장 고르기':'카드 삭제 서비스 · 한 장 고르기'));
      const removalInfo=make('p'),searchLabel=make('label',r.content163?'판매할 카드 찾기':'삭제할 카드 찾기'),search=make('input');search.type='search';search.placeholder='이름·효과·종족·태그';search.setAttribute('aria-label',r.content163?'판매할 카드 검색':'삭제할 카드 검색');searchLabel.append(search);
      const result=make('p',null,'muted'),list=make('div',null,'node150-owned'),selected=make('p',null,'node150-selection');selected.setAttribute('role','status');
      const remove=button(r.content163?'선택한 카드 1장 판매':'선택한 카드 1장 영구 삭제',async()=>{const key=nodeScreen?.selectedKey;if(!key)throw new Error('거래할 카드 한 장을 골라줘.');await command(r.content163?'sell_card':'remove_card',{node_id:entry.id,...(r.content163?{instance_id:key}:{identity_key:key}),count:1});},'node150-remove');
      removal.append(removalInfo,searchLabel,result,list,selected,remove,make('p',r.content163?'한 번에 카드 한 장을 판매하고 구매 가격의 ¼을 받아. 메인 덱이 20장이면 판매할 수 없어. 제련된 카드를 팔면 그 카드의 강화도 사라져.':'방문당 한 장을 카드함에서 영구히 삭제해. 덱에서 사용 중이면 덱에서도 한 장 빠져. 메인 덱은 20장 이상이어야 해.','muted'));
      const leave=button('상점을 떠나 다음 길로',async()=>{await command('leave_node',{node_id:entry.id});document.getElementById('node-dialog').close();},'primary node150-leave');
      controls.append(top,grid,relic,removal,leave,make('p','떠난 뒤에는 다시 들어올 수 없어. 남은 금화는 다음 상점에서 사용할 수 있어.','muted'));
      search.addEventListener('input',()=>{ui.selectedKey=null;const current=getRun();if(current)renderShop(entry,current,inspectNode150(current,entry.id,cards));});
      return {top,gold,discount,refresh,grid,groups,relic,removal,removalInfo,search,result,list,selected,remove,leave,selectedKey:null};
    });
    ui.gold.textContent=`보유 원정 금화 ${r.gold.toLocaleString()}`;ui.discount.textContent=r.relics.includes('merchant_seal')?`상인의 인장 · 상점 가격 ${relicMeta157(r,'merchant_seal')?.params?.discount_percent??15}% 할인 중`:'표시된 금화로 거래해. 이번 방문의 카드와 유물은 다시 열어도 그대로야.';
    if(view.refresh){ui.refresh.textContent=`상품 새로고침 · ${view.refresh.price.toLocaleString()} 금화`;ui.refresh.disabled=busy||!healthy||view.refresh.disabled;ui.refresh.title=view.refresh.reason||`이번 상점 ${view.refresh.count+1}번째 새로고침`;ui.discount.textContent+=` 새로고침 ${view.refresh.count}회 · 다른 상점에서는 다시 25금화부터 시작해.`;}
    const wanted=new Set(view.cards.map(item=>item.id));for(const tile of ui.grid.querySelectorAll('[data-item]'))if(!wanted.has(tile.dataset.item))tile.remove();
    for(const [key,group] of Object.entries(ui.groups)){const items=view.cards.filter(item=>(item.group??'random')===key),pair=view.pair_groups?.find(row=>row.id===key);group.section.hidden=!items.length&&!pair;group.note.textContent=pair?.reason||(key==='fusion'||key==='ritual'?'관련 카드가 함께 진열됐어. 필요한 카드를 한 장씩 각각 구매해.':'');}
    for(const item of view.cards){
      let tile=[...ui.grid.querySelectorAll('[data-item]')].find(child=>child.dataset.item===item.id);
      if(!tile){tile=make('article',null,`node150-stock-card tier-${item.card.rarity}`);tile.dataset.item=item.id;const price=make('p',null,'node150-price'),stock=make('p',null,'node163-stock-count'),reason=make('p',null,'node150-reason'),buy=button('구매',()=>command('buy_card',{node_id:entry.id,item_id:item.id}),'node150-buy');tile.append(artButton(item.card),make('span',item.card.rarity,'reward-tier'),make('strong',item.card.name_ko),stock,price,buy,reason);(ui.groups[item.group??'random']??ui.groups.random).items.append(tile);}
      tile.classList.toggle('sold-out',item.purchased);setPrice(tile.querySelector('.node150-price'),item.base_price,item.price);
      tile.querySelector('.node163-stock-count').textContent=Number.isSafeInteger(item.remaining)?`남은 재고 ${item.remaining} / ${item.stock}`:item.purchased?'판매 완료':'재고 1장';
      const buy=tile.querySelector('.node150-buy');buy.textContent=item.purchased?'품절':'카드 1장 구매';buy.disabled=busy||!healthy||item.disabled||item.purchased;tile.querySelector('.node150-reason').textContent=item.purchased?'원정 카드함에 넣었어.':item.reason||'';
    }
    let emptyCards=ui.top.querySelector('.node157-empty-cards');if(!emptyCards){emptyCards=make('p','지금 판매할 수 있는 카드가 없어. 다른 상품을 보거나 다음 길로 나갈 수 있어.','node157-empty-cards muted');ui.top.append(emptyCards);}emptyCards.hidden=view.cards.length>0;
    const relicItems=view.relics??(view.relic?[view.relic]:[]),relicIds=new Set(relicItems.map(item=>item.id));
    for(const tile of [...ui.relic.children])if(!relicIds.has(tile.dataset.item))tile.remove();
    for(const item of relicItems){
      let tile=[...ui.relic.children].find(child=>child.dataset.item===item.id);
      if(!tile){tile=make('article',null,'node150-relic-stock');tile.dataset.item=item.id;tile.append(relicIcon154(item.relic_id),make('h4'),make('span',null,'relic163-tier'),make('p',null,'node150-relic-description'),make('p',null,'node150-price'),button('유물 구매',()=>command('buy_card',{node_id:entry.id,item_id:item.id}),'node150-buy'),make('p',null,'node150-reason'));ui.relic.append(tile);}
      tile.classList.toggle('sold-out',item.purchased);tile.querySelector('h4').textContent=item.name;tile.querySelector('.relic163-tier').textContent=item.rarity??'';tile.querySelector('.node150-relic-description').textContent=item.effect_text??item.description;setPrice(tile.querySelector('.node150-price'),item.base_price,item.price);
      const buy=tile.querySelector('button');buy.textContent=item.purchased?'품절':'유물 구매';buy.disabled=busy||!healthy||item.disabled||item.purchased;tile.querySelector('.node150-reason').textContent=item.reason||(item.purchased?'유물을 획득했어.':'');
    }
    if(!relicItems.length)ui.relic.append(make('p','판매할 미보유 유물이 없어. 다음 상점에서 다시 만날 수 있어.','muted'));
    if(r.content163){renderSale163(ui,entry,r,view);return;}
    const service=view.removal,paid=r.history.find(item=>['shop_remove150','shop_remove163'].includes(item.kind)&&item.node_id===entry.id);
    ui.removalInfo.textContent=service.used?`이번 상점 이용 완료${paid?` · 지불한 금화 ${paid.price.toLocaleString()}`:''}`:`카드 한 장 삭제 · ${service.price.toLocaleString()} 금화`;
    const choices=filterNodeCards150(service.choices,ui.search.value),keys=new Set(choices.map(item=>item.identity_key));
    for(const row of [...ui.list.children])row.hidden=!keys.has(row.dataset.key);
    for(const choice of choices){
      let row=[...ui.list.children].find(child=>child.dataset.key===choice.identity_key);
      if(!row){row=make('article',null,'node150-owned-card');row.dataset.key=choice.identity_key;const radio=make('input');radio.type='radio';radio.name='node150-removal-card';radio.value=choice.identity_key;radio.setAttribute('aria-label',`${choice.card.name_ko} 1장 삭제 선택`);radio.addEventListener('change',()=>{ui.selectedKey=choice.identity_key;renderShop(entry,getRun(),inspectNode150(getRun(),entry.id,cards));});const info=make('label');info.append(radio,make('strong',choice.card.name_ko));row.append(artButton(choice.card),info,make('p',null,'node150-owned-count'),make('p',null,'node150-reason'));ui.list.append(row);}
      row.hidden=false;const radio=row.querySelector('input');radio.checked=ui.selectedKey===choice.identity_key;radio.disabled=busy||!healthy||service.disabled||choice.disabled;
      row.querySelector('.node150-owned-count').textContent=`보유 ${choice.count}장 · 덱 ${deckCopies150(r,choice.identity_key)}장`;
      row.querySelector('.node150-reason').textContent=choice.reason||'';
    }
    ui.result.textContent=`${choices.length}종 · 카드 그림을 누르면 효과를 볼 수 있어.`;
    const chosen=service.choices.find(choice=>choice.identity_key===ui.selectedKey);
    ui.selected.textContent=service.reason||(!chosen?'삭제할 카드 한 장을 선택해줘.':chosen.disabled?chosen.reason:`${chosen.card.name_ko} 1장 삭제 · ${service.price.toLocaleString()} 금화`);
    ui.remove.disabled=busy||!healthy||service.disabled||!chosen||chosen.disabled;ui.leave.disabled=busy||!healthy||!view.can_leave;
    for(const art of controls.querySelectorAll('.node150-art'))art.disabled=busy;
  }
  function renderSale163(ui,entry,r,view){
    const service=view.sale??view.removal,choices=filterNodeCards150(service.choices,ui.search.value),keys=new Set(choices.map(item=>item.instance_id));
    ui.removalInfo.textContent='판매 수익은 구매 가격의 ¼ (소수점 버림). 구매 기록이 없는 카드는 현재 등급별 판매가를 기준으로 해.';
    for(const row of [...ui.list.children])if(!keys.has(row.dataset.key))row.remove();
    for(const choice of choices){let row=[...ui.list.children].find(c=>c.dataset.key===choice.instance_id);if(!row){row=make('article',null,'node150-owned-card');row.dataset.key=choice.instance_id;const radio=make('input');radio.type='radio';radio.name='sell-card163';radio.value=choice.instance_id;radio.setAttribute('aria-label',`${choice.card.name_ko} 카드 ${choice.id.slice(5)} 판매 선택`);radio.onchange=()=>{ui.selectedKey=choice.instance_id;renderShop(entry,getRun(),inspectNode150(getRun(),entry.id,cards));};const label=make('label');label.append(radio,make('strong',choice.card.name_ko));row.append(artButton(choice.card),label,make('p',null,'node150-owned-count'),make('p',null,'sale163-upgrades'),make('strong',null,'sale163-price'),make('p',null,'node150-reason'));ui.list.append(row);}row.querySelector('input').checked=ui.selectedKey===choice.instance_id;row.querySelector('input').disabled=busy||!healthy||choice.disabled;row.querySelector('.node150-owned-count').textContent=`카드 ${choice.id.slice(5)} · ${choice.group==='main'?'메인 덱':choice.group==='extra'?'엑스트라 덱':'카드함'}`;row.querySelector('.sale163-upgrades').textContent=choice.upgrade_text||'제련 없음';row.querySelector('.sale163-price').textContent=`판매 +${choice.price.toLocaleString()} 금화`;row.querySelector('.node150-reason').textContent=choice.reason||'';}
    const selected=service.choices.find(c=>c.instance_id===ui.selectedKey);ui.result.textContent=`카드 ${choices.length}매 · 같은 이름도 개별 카드로 골라 판매해.`;ui.selected.textContent=service.reason||(!selected?'판매할 카드 한 장을 골라줘.':selected.disabled?selected.reason:`${selected.card.name_ko}${selected.upgrade_text?` (${selected.upgrade_text})`:''} 1매 판매 · +${selected.price.toLocaleString()} 금화`);ui.remove.disabled=busy||!healthy||!selected||selected.disabled;ui.leave.disabled=busy||!healthy||!view.can_leave;
  }
  function renderExpansionEvent163(entry,r,view){
    const event=view.event,ui=screen(`${r.id}:${entry.id}:event163`,()=>{
      const title=make('h3'),description=make('p',null,'node150-story'),gold=make('p',null,'node150-gold'),selection=make('div',null,'node163-event-options'),choices=make('div',null,'node163-event-choices'),result=make('p',null,'node150-event-result');
      const leave=button('다음 길로 나가기',async()=>{await command('leave_node',{node_id:entry.id});document.getElementById('node-dialog').close();},'primary');controls.append(title,description,gold,selection,choices,result,leave);
      return {title,description,gold,selection,choices,result,leave,selectedKey:null,selectedDeck:new Map(),selectionKey:null};
    });
    ui.title.textContent=event.title;ui.description.textContent=event.description;ui.gold.textContent=`원정 금화 ${r.gold.toLocaleString()} · LP ${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()}`;
    const active=!busy&&healthy&&view.status==='open',redraw=()=>renderExpansionEvent163(entry,getRun(),inspectNode150(getRun(),entry.id,cards));
    const selectionKey=`${r.revision}:${busy}:${healthy}:${view.status}`;
    if(ui.selectionKey!==selectionKey){
      ui.selection.replaceChildren();ui.selectionKey=selectionKey;
      if(event.mana_sources163?.length){
        const label=make('label','공양할 보유 마법 카드'),select=make('select');select.append(new Option('마법 카드 1매를 골라줘.',''));
        for(const row of event.mana_sources163){const option=new Option(`${row.card.name_ko} · 보유 ${row.count}매${row.reason?' · '+row.reason:''}`,row.identity_key);option.disabled=row.disabled;select.append(option);}select.value=ui.selectedKey??'';select.disabled=!active;select.onchange=()=>{ui.selectedKey=select.value;redraw();};label.append(select);ui.selection.append(label);
      }
      if(event.deck_cards?.length&&!['card_enhancement','card_sealing'].includes(event.id)){
        const total=selectedDeckKeys163(ui.selectedDeck).length;ui.selection.append(make('p',`바칠 활성 덱 카드 ${total} / 2매`,'node163-sacrifice-count'));const grid=make('div',null,'node150-event-cards');
        for(const row of event.deck_cards){const chosen=ui.selectedDeck.get(row.identity_key)??0,tile=make('article',null,'node150-event-card');tile.dataset.key=row.identity_key;tile.classList.toggle('chosen',chosen>0);const adjust=delta=>{const next=(ui.selectedDeck.get(row.identity_key)??0)+delta;next?ui.selectedDeck.set(row.identity_key,next):ui.selectedDeck.delete(row.identity_key);ui.selectionKey=null;redraw();};const less=button('− 1매',()=>adjust(-1)),more=button('+ 1매',()=>adjust(1));less.disabled=!active||chosen===0;more.disabled=!active||chosen>=row.count||total>=2;tile.append(artButton(row.card),make('strong',row.card.name_ko),make('p',`${row.group==='main'?'메인':'엑스트라'} ${row.count}매 · 선택 ${chosen}매`),less,more);grid.append(tile);}ui.selection.append(grid);
      }
    }
    ui.choices.replaceChildren();
    const appendChoice=(option,args={},reason='')=>{
      const tile=make('article',null,'node150-event-choice');tile.dataset.option=option.id;
      if(option.relic_id)tile.append(relicIcon154(option.relic_id));tile.append(make('h4',option.name),make('p',option.description??''));
      if(option.candidates?.length){const preview=make('details',null,'node163-opponent-preview'),grid=make('div',null,'node150-event-cards');preview.append(make('summary',`받을 카드 ${option.candidates.length}장 살펴보기`));for(const card of option.candidates){const cardTile=make('article',null,'node150-event-card');cardTile.append(artButton(card),make('strong',card.name_ko));grid.append(cardTile);}preview.append(grid);tile.append(preview);}
      const action=button('이 선택으로 진행',()=>command('event_choice',{node_id:entry.id,choice:'accept',option:option.id,...args}),'primary');action.disabled=!active||option.disabled||!!reason;tile.append(action,make('p',option.reason||reason,'node150-reason'));ui.choices.append(tile);
    };
    for(const option of event.options163??[]){const source=event.mana_sources163?.find(row=>row.identity_key===ui.selectedKey),needs=event.id==='mana_furnace'&&option.id==='sacrifice';appendChoice(option,needs?{identity_key:ui.selectedKey}:{},needs?(!source?'공양할 마법 카드 1매를 먼저 골라줘.':source.reason):'');}
    for(const option of event.evolution163??[]){const tile=make('article',null,'node150-event-choice');tile.dataset.evolution=option.identity_key;if(option.card)tile.append(artButton(option.card),make('strong',`${option.card.name_ko} · 레벨 ${option.card.level}`));tile.append(make('p',`레벨 ${(option.card?.level??0)+1} 몬스터로 교환`));if(option.target)tile.append(artButton(option.target),make('strong',option.target.name_ko));const action=button('이 몬스터를 진화',()=>command('event_choice',{node_id:entry.id,choice:'accept',identity_key:option.identity_key}),'primary');action.disabled=!active||option.disabled;tile.append(action,make('p',option.reason,'node150-reason'));ui.choices.append(tile);}
    for(const option of event.themes163??[]){const reason=canSacrificeTwo163(r,event.deck_cards,ui.selectedDeck).reason;appendChoice(option,{identity_keys:selectedDeckKeys163(ui.selectedDeck)},reason);}
    const skip=button('아무 변화 없이 지나가기',()=>command('event_choice',{node_id:entry.id,choice:'skip'}));skip.disabled=!active;ui.choices.append(skip);
    const pending=pendingReward163(r);ui.result.textContent=pending?'카드 보상 한 장을 선택한 뒤 다음 길로 나갈 수 있어.':view.status==='resolved'?'선택과 보상을 저장했어. 다음 길로 나갈 수 있어.':'원하는 선택의 비용과 보상을 확인해줘. 원하지 않으면 지나갈 수 있어.';
    if(pending?.node_id===entry.id)ui.result.append(button('카드 보상 고르기',()=>{document.getElementById('node-dialog').close();render();if(!document.getElementById('run-stage-dialog').open)document.getElementById('run-stage-dialog').showModal();},'primary'));
    ui.leave.disabled=busy||!healthy||!view.can_leave;ui.leave.title=view.leave_reason??'';
  }
  function renderEvent(entry,r,view){
    if(['relic_choice','card_choice','evolution','mana_furnace','deck_transform'].includes(view.event.id))return renderExpansionEvent163(entry,r,view);
    const ui=screen(`${r.id}:${entry.id}:event`,()=>{
      const title=make('h3'),description=make('p',null,'node150-story'),gold=make('p',null,'node150-gold'),extra=make('div',null,'node163-event-options'),list=make('div',null,'node150-event-cards'),choices=make('div',null,'node150-event-choices'),result=make('p',null,'node150-event-result');result.setAttribute('role','status');
      const leave=button('다음 길로 나가기',async()=>{await command('leave_node',{node_id:entry.id});document.getElementById('node-dialog').close();},'primary node150-leave');controls.append(title,description,gold,extra,list,choices,result,leave);
      return {title,description,gold,extra,list,choices,result,leave,selectedInstance166:null,selectedStat166:'atk',selectedKey:null,selectedRace:'',selectedEncounter:'',selectedRelic:'',selectedDeck:new Map(),extraKey:null};
    });
    const event=view.event;ui.title.replaceChildren(...(event.id==='card_duplication'?[relicIcon154('card_duplication')]:[]),document.createTextNode(event.title));ui.description.textContent=event.description;ui.gold.textContent=`현재 LP ${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()} · 원정 금화 ${r.gold.toLocaleString()}`;
    const redraw=()=>renderEvent(entry,getRun(),inspectNode150(getRun(),entry.id,cards));
    const extraKey=`${r.revision}:${event.id}:${busy}:${healthy}:${view.status}`;
    if(ui.extraKey!==extraKey){
      ui.extra.replaceChildren();ui.extraKey=extraKey;
      function selector(label,values,selected,onChange){const root=make('label',label),input=make('select');input.append(new Option('선택해줘.',''));for(const option of values){const node=new Option(option.name,option.id);node.disabled=!!option.disabled;input.append(node);}input.value=selected;input.disabled=busy||!healthy||view.status!=='open';input.addEventListener('change',()=>{onChange(input.value);redraw();});root.append(input);ui.extra.append(root);return input;}
      if(['card_enhancement','card_sealing'].includes(event.id)){const grid=make('div',null,'copy166-grid');for(const item of event.instances??event.instance_cards??[]){const view=upgradeCopyView166(item),b=make('article',null,'copy166-tile');const chooseInstance=button('이 한 장 선택',()=>{ui.selectedInstance166=item.instance_id??item.id;ui.extraKey=null;redraw();},'primary');chooseInstance.disabled||=item.disabled;b.append(chooseInstance);b.dataset.instance=item.instance_id??item.id;b.classList.toggle('chosen',ui.selectedInstance166===(item.instance_id??item.id));b.append(artButton(item.card),make('strong',view.name),make('small',view.copy_label),make('p',view.summary||'아직 강화되지 않은 카드'));decorateCopy166(b,item);if(item.reason)b.append(make('p',item.reason,'node150-reason'));grid.append(b);}ui.extra.append(grid);if(event.id==='card_enhancement')selector('강화할 능력치',[{id:'atk',name:'공격력'},{id:'def',name:'수비력'}],ui.selectedStat166,value=>ui.selectedStat166=value);}
      if(event.races?.length)selector('함께할 몬스터 종족',event.races.map(race=>({id:race,name:race})),ui.selectedRace,value=>ui.selectedRace=value);
      if(event.encounters?.length){
        selector('도전할 상대',event.encounters.map(enemy=>({id:enemy.source_node_id,name:`${enemy.name} · ${enemy.deck_name} · 난이도 ${enemy.difficulty}`})),ui.selectedEncounter,value=>{ui.selectedEncounter=value;ui.extraKey=null;});
        const opponent=r.encounters[ui.selectedEncounter];
        if(opponent){const preview=make('details',null,'node163-opponent-preview'),grid=make('div',null,'node150-event-cards');preview.append(make('summary','상대 덱 살펴보기'));for(const group of ['main','extra'])for(const row of opponent.deck.groups[group]){const card=cards.find(card=>card.identity_key===row.identity_key);if(!card)continue;const tile=make('article',null,'node150-event-card');tile.append(artButton(card),make('strong',card.name_ko),make('span',`${group==='main'?'메인':'엑스트라'} ${row.count}장`));grid.append(tile);}preview.append(grid);ui.extra.append(preview);}
      }
      if(event.relics?.length)selector('제단에 바칠 유물',event.relics.map(relic=>({id:relic.id??relic.relic_id,name:`${relic.name} · ${relic.effect_text??relic.description}`,disabled:relic.disabled})),ui.selectedRelic,value=>ui.selectedRelic=value);
      if(event.deck_cards?.length&&!['card_enhancement','card_sealing'].includes(event.id)){const total=selectedDeckKeys163(ui.selectedDeck).length,selection=make('p',`바칠 카드 ${total} / 2매`,'node163-sacrifice-count'),grid=make('div',null,'node150-event-cards');ui.extra.append(selection,grid);for(const choice of event.deck_cards){const selected=ui.selectedDeck.get(choice.identity_key)||0,tile=make('article',null,'node150-event-card');tile.dataset.key=choice.identity_key;tile.classList.toggle('chosen',selected>0);const change=delta=>{const next=(ui.selectedDeck.get(choice.identity_key)||0)+delta;if(next>0)ui.selectedDeck.set(choice.identity_key,next);else ui.selectedDeck.delete(choice.identity_key);ui.extraKey=null;redraw();},less=button('− 1매',()=>change(-1)),more=button('+ 1매',()=>change(1));less.disabled=busy||!healthy||view.status!=='open'||!selected;more.disabled=busy||!healthy||view.status!=='open'||selected>=choice.count||total>=2;tile.append(artButton(choice.card),make('strong',choice.card.name_ko),make('p',`${choice.group==='extra'?'엑스트라':'메인'} 덱 ${choice.count}장 · 선택 ${selected}장`),less,more);grid.append(tile);}}
    }
    ui.list.hidden=!event.cards.length;
    const currentKeys=new Set(event.cards.map(item=>item.identity_key));for(const row of [...ui.list.children])row.hidden=!currentKeys.has(row.dataset.key);
    for(const choice of event.cards){
      let row=[...ui.list.children].find(child=>child.dataset.key===choice.identity_key);
      if(!row){row=make('article',null,'node150-event-card');row.dataset.key=choice.identity_key;const select=button('1장 선택',()=>{ui.selectedKey=choice.identity_key;renderEvent(entry,getRun(),inspectNode150(getRun(),entry.id,cards));},'node150-select-card');row.append(artButton(choice.card),make('strong',choice.card.name_ko),make('p',`보유 ${choice.count}장`,'event-owned154'),select,make('p',null,'node150-reason'));ui.list.append(row);}
      row.hidden=false;row.querySelector('.event-owned154').textContent=`보유 ${choice.count}장`;row.classList.toggle('chosen',ui.selectedKey===choice.identity_key);row.querySelector('.node150-select-card').textContent=ui.selectedKey===choice.identity_key?'1장 선택됨':'1장 선택';row.querySelector('.node150-select-card').disabled=busy||!healthy||choice.disabled||view.status!=='open';row.querySelector('.node150-reason').textContent=choice.reason||'';
    }
    const choiceIds=new Set(event.choices.map(choice=>choice.id));for(const row of [...ui.choices.children])if(!choiceIds.has(row.dataset.choice))row.remove();
    function selectionReason(){if(['card_enhancement','card_sealing'].includes(event.id)&&!(event.instances??event.instance_cards??[]).some(item=>(item.instance_id??item.id)===ui.selectedInstance166&&!item.disabled))return '대상 카드 한 장을 먼저 골라줘.';if(event.id==='race_blessing'&&!event.races.includes(ui.selectedRace))return '종족 한 가지를 먼저 골라줘.';if(event.id==='challenge_duel'&&!event.encounters.some(row=>row.source_node_id===ui.selectedEncounter))return '도전할 상대를 먼저 골라줘.';if(event.id==='relic_recovery'&&!event.relics.some(row=>(row.id??row.relic_id)===ui.selectedRelic))return '바칠 유물 한 개를 먼저 골라줘.';if(event.id==='twin_sacrifice')return canSacrificeTwo163(r,event.deck_cards,ui.selectedDeck).reason;return '';}
    for(const choice of event.choices){
      let row=[...ui.choices.children].find(child=>child.dataset.choice===choice.id);
      if(!row){row=make('article',null,'node150-event-choice');row.dataset.choice=choice.id;const action=button(choice.name,()=>{const args={node_id:entry.id,choice:choice.id};if(choice.id==='accept'){if(['card_enhancement','card_sealing'].includes(event.id)){args.instance_id=ui.selectedInstance166;if(event.id==='card_enhancement')args.stat=ui.selectedStat166;}if(event.cards.length)args.identity_key=ui.selectedKey;if(event.id==='race_blessing')args.race=ui.selectedRace;if(event.id==='challenge_duel')args.source_node_id=ui.selectedEncounter;if(event.id==='relic_recovery')args.relic_id=ui.selectedRelic;if(event.id==='twin_sacrifice')args.identity_keys=selectedDeckKeys163(ui.selectedDeck);}return command('event_choice',args);},choice.id==='accept'?'primary':'');row.append(action,make('p',choice.description),make('p',null,'node150-reason'));ui.choices.append(row);}
      const selected=event.cards.find(card=>card.identity_key===ui.selectedKey),needsCard=choice.id==='accept'&&event.cards.length>0,reason=choice.reason||(choice.id==='accept'?selectionReason():'')||(needsCard&&!selected?'먼저 카드 한 장을 골라줘.':'');row.querySelector('button').disabled=busy||!healthy||choice.disabled||view.status!=='open'||!!reason||(needsCard&&(!selected||selected.disabled));row.querySelector('.node150-reason').textContent=reason;
    }
    ui.result.replaceChildren();ui.result.textContent=view.status==='resolved'?'선택을 저장했어. 다음 길로 나갈 수 있어.':event.cards.length?'선택할 카드 한 장을 고른 뒤 진행하거나, 아무 변화 없이 지나칠 수 있어.':'선택지의 비용과 보상을 확인해줘. 원하지 않으면 그냥 지나칠 수 있어.';
    if(view.status==='resolved'){
      const visit=(r.nodes163??r.nodes159??r.nodes158)?.events?.[entry.id]??r.nodes150?.events?.[entry.id]??{};
      if(visit.choice==='skip')ui.result.append(make('span',' 아무 변화 없이 지나갔어.'));
      else if(visit.target_key){const card=visit.kind==='card_duplication'?r.collection.find(item=>item.card.identity_key===visit.target_key)?.card:Object.values(visit.targets??{}).flat().find(item=>item.identity_key===visit.target_key);if(card)ui.result.append(button(`획득 카드 · ${card.name_ko} 효과 보기`,()=>showCard(card),'card-link'));}
      else if(visit.kind==='relic_bargain'){const relic=relicMeta157(r,visit.relic_id);if(relic)ui.result.append(make('span',` 획득 유물 · ${relic.name} — ${relic.description}`));}
    }
    if(event.challenge&&['accepted','draw'].includes(event.challenge.status)&&r.state==='at_node'&&['idle','resolved'].includes(r.bridge147.phase)){
      ui.result.append(make('p',event.challenge.status==='draw'?'무승부로 끝났어. 종료 LP를 이어 같은 상대에게 다시 도전할 수 있어.':'도전을 수락했어. 준비한 뒤 게임에서 결투를 시작해.'));
      if(r.relics.includes('destiny_draw')&&!destinyChoice154(r))ui.result.append(button('운명의 패 카드 지정',openDestiny154,'primary'));
      else if(r.relics.includes('field_legacy')&&!(r.relic_choices163??r.relic_choices159??r.relic_choices158)?.field_legacy)ui.result.append(button('시작 필드 선택',openField163,'primary'));
      else if(appendMissingChoice163(ui.result,r)){}
      else ui.result.append(button('특별 결투 준비',async()=>{await command('prepare',{node_id:entry.id});document.getElementById('node-dialog').close();},'primary'));
    }
    if((r.nodes163??r.nodes159??r.nodes158)?.pending_reward?.node_id===entry.id)ui.result.append(button('특별 카드 보상 고르기',()=>{document.getElementById('node-dialog').close();render();document.getElementById('run-stage-dialog').showModal();},'primary'));
    ui.leave.disabled=busy||!healthy||!view.can_leave;ui.leave.title=view.leave_reason||'';
    for(const art of controls.querySelectorAll('.node150-art'))art.disabled=busy;
  }
  function renderNode(entry,source,preview=false){
    currentNode={entry,r:source,preview};
    const r=getRun(),bound=client&&r?.id===source.id&&r?.bridge147;
    if(preview||!bound){clearScreen();controls.append(make('p','지도 미리보기야. 게임에 연결한 원정에서 실제 이동할 수 있어.','muted'));return;}
    const reachable=reachableNodes(r).includes(entry.id),retry=r.state==='at_node'&&r.current_node_id===entry.id;
    if(!reachable&&!retry){clearScreen();controls.append(make('p',r.state==='reward_pending'?'먼저 승리 카드 한 장을 선택해줘.':'현재 위치에서 이어지는 다음 칸을 선택해줘. 떠난 상점과 이벤트에는 다시 들어갈 수 없어.','phase-note'));return;}
    if(['shop','event'].includes(entry.kind)){
      const view=inspectNode150(r,entry.id,cards);
      if(view){if(entry.kind==='shop')renderShop(entry,r,view);else renderEvent(entry,r,view);return;}
      const ui=screen(`${r.id}:${entry.id}:enter`,()=>{const enter=button(entry.kind==='shop'?'상점에 들어가기':'이벤트 확인하기',()=>command('enter_node',{node_id:entry.id}),'primary');controls.append(make('p',entry.kind==='shop'?`카드 최대 ${contentPolicy157(r).shop.card_count}장과 미보유 유물 최대 ${contentPolicy157(r).shop.relic_count}개, 카드 삭제 서비스를 만날 수 있어.`:'이곳에 들어가면 하나의 사건이 기다려. 같은 장소에서는 같은 선택과 보상이 유지돼.','phase-note'),enter);return {enter};});ui.enter.disabled=busy||!healthy;return;
    }
    clearScreen();
    if(['battle','elite','midboss','boss'].includes(entry.kind)){
      if(r.relics.includes('destiny_draw')&&!destinyChoice154(r)){controls.append(make('p','운명의 패를 위해 첫 패에 넣을 메인 덱 카드 1장을 먼저 지정해줘.','phase-note'),button('운명의 패 카드 지정',openDestiny154,'primary'));return;}
      if(r.relics.includes('field_legacy')&&!(r.relic_choices163??r.relic_choices159??r.relic_choices158)?.field_legacy){controls.append(make('p','태고의 지형에서 이번 원정의 시작 필드를 한 번 선택해줘.','phase-note'),button('시작 필드 선택',openField163,'primary'));return;}
      if(appendMissingChoice163(controls,r))return;
      controls.append(button('이 상대와 전투 준비',async()=>{await command('prepare',{node_id:entry.id});document.getElementById('node-dialog').close();panel.scrollIntoView({block:'start'});},'primary'));
    }else if(entry.kind==='rest'){
      controls.append(make('h3','휴식 · 한 가지 선택'),make('p',`현재 LP ${r.lp.toLocaleString()} / ${r.max_lp.toLocaleString()}`));
      const choices=make('div',null,'rest-choices');for(const choice of REST_CHOICES){
        const choose=button('',async()=>{await command('rest',{node_id:entry.id,choice:choice.id});document.getElementById('node-dialog').close();},'rest-choice');choose.dataset.choice=choice.id;choose.append(make('strong',choice.name),make('span',choice.description));
        if(choice.id==='heal'&&r.lp===r.max_lp)choose.disabled=true;if(choice.id==='max_lp'&&r.max_lp>MAX_RUN_LP-500)choose.disabled=true;
        if(choice.id==='relic'&&!pickRelic157(r,'availability157'))choose.disabled=true;choices.append(choose);
      }controls.append(choices);
    }
    for(const b of controls.querySelectorAll('button'))b.disabled||=busy||!healthy;
  }
  try{client=createBridgeClient154(config);}catch(error){message.textContent=error.message;}
  if(!client)message.textContent||='공개 페이지에서는 게임에 자동 연결하지 않아. 슬롯 백업을 받은 뒤 PC 게임의 메인 메뉴에서 ‘원정 전투’를 열어 불러와줘.';
  else{message.textContent='게임의 원정 저장을 읽는 중…';guard(refresh);}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)guard(refresh);else clearTimeout(pollTimer);});
  const canArchive=r=>Boolean(client&&r?.bridge147&&['idle','resolved','prepared'].includes(r.bridge147.phase)&&!['queued','started','interrupted'].includes(launches[r.bridge147.attempt?.attempt_id]));
  render();return {canReturnToGame166,render,renderNode,command,refresh,isLocal:()=>Boolean(client),isBound:run=>Boolean(client&&run?.bridge147),canArchive,
    archiveRun:async r=>command('archive_run',{},r),
    syncDeck:async draft=>command('sync_deck',{draft}),openConsumables163,destroy:()=>{stopped=true;clearTimeout(pollTimer);}};
}
