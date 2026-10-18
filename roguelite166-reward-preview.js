import {emptyRewardTrack,prepareCardReward,selectCardReward,rewardOdds} from './roguelite166-rewards.js?v=20261018-166';

// This sandbox keeps its trial history in memory, separate from real run slots.
export function mountRewardPreview({cards,showCard}) {
  const $=id=>document.getElementById(id),dialog=$('reward-preview-dialog');
  const make=(tag,text,className)=>{const element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;};
  let track=emptyRewardTrack(),seed=crypto.randomUUID(),lastOffer=null;
  const formatOdds=odds=>['UR','SR','R','N'].map(tier=>`${tier} ${odds[tier]}%`).join(' · ');
  const status=message=>$('reward-result').textContent=message;
  function guarded(action){try{action();}catch(error){status(error.message||'보상 체험을 준비하지 못했어.');}}
  function refresh(){
    const pending=track.pending,offer=pending||lastOffer,area=Number($('reward-area').value);
    $('reward-odds').textContent=`${pending?'일반 후보 추첨 확률':'다음 일반 후보 확률'} · ${formatOdds(pending?.odds||rewardOdds(area,track))}`;
    $('reward-pity').textContent=`후보 미등장 기록 · SR 이상 ${track.sr_misses}회 / UR ${track.ur_misses}회 · 후보가 뜨는 순간 반영돼.`;
    $('reward-area').disabled=Boolean(pending);$('reward-kind').disabled=Boolean(pending);$('next-reward-preview').disabled=Boolean(pending);
    $('next-reward-preview').textContent=track.offers.length?'다음 보상 보기':'보상 5장 보기';
    const root=$('reward-candidates');root.replaceChildren();
    for(const card of offer?.candidates||[]){
      const tile=make('article',null,`reward-card tier-${card.rarity}`);tile.dataset.identity=card.identity_key;
      const art=make('button',null,'reward-art');art.type='button';art.setAttribute('aria-label',`${card.name_ko} 효과 보기`);
      const picture=make('img');picture.src=card.image;picture.alt=card.name_ko;picture.loading='lazy';art.append(picture);art.addEventListener('click',()=>showCard(card));
      const choose=make('button',offer.chosen_identity_key===card.identity_key?'선택 완료':'이 카드 선택','reward-select');choose.type='button';choose.disabled=!pending;
      choose.addEventListener('click',()=>guarded(()=>{
        // Use the current pending id; subsequent clicks cannot claim another card.
        if(!track.pending)return;
        track=selectCardReward(track,track.pending.id,card.identity_key);lastOffer=track.offers.at(-1);refresh();
        $('next-reward-preview').focus({preventScroll:true});
        status(`${card.name_ko} 선택! 실제 보유 카드는 바뀌지 않았어. 다음 전투 보상을 이어서 체험할 수 있어.`);
      }));
      if(offer.chosen_identity_key===card.identity_key)tile.classList.add('chosen');
      tile.append(art,make('span',card.rarity,'reward-tier'),make('strong',card.name_ko),choose);root.append(tile);
    }
  }
  $('next-reward-preview').addEventListener('click',()=>guarded(()=>{
    if(track.pending)return;
    const area=Number($('reward-area').value),kind=$('reward-kind').value;
    track=prepareCardReward(track,{offerId:`trial-${track.offers.length+1}`,seed,area,kind,cards,choices:5});lastOffer=null;refresh();
    const reasons=track.pending.guarantee_reasons||[];
    status(`후보 5장 중 하나를 골라줘.${kind==='elite'?' 엘리트: SR 이상 1장 보장.':kind==='boss'?' 보스: UR 1장 보장.':''}${reasons.includes('ur_pity')?' UR 천장이 적용됐어.':reasons.includes('sr_pity')?' SR 이상 천장이 적용됐어.':''}`);
  }));
  $('reset-reward-preview').addEventListener('click',()=>{track=emptyRewardTrack();seed=crypto.randomUUID();lastOffer=null;refresh();status('시험 기록을 초기화했어. 보상 5장 보기를 눌러 시작해.');});
  for(const id of ['reward-area','reward-kind'])$(id).addEventListener('change',()=>guarded(refresh));
  $('open-reward-preview').addEventListener('click',()=>{refresh();dialog.showModal();});
  $('close-reward-preview').addEventListener('click',()=>dialog.close());
  const table=make('table'),caption=make('caption','구역별 기본 확률 · 첫 테스트 수치');table.append(caption);
  const head=make('tr');for(const label of ['구역','UR','SR','R','N'])head.append(make('th',label));const thead=make('thead');thead.append(head);table.append(thead);
  const tbody=make('tbody');for(const area of [1,2,3]){const row=make('tr'),odds=rewardOdds(area,emptyRewardTrack());row.append(make('th',area===3?'3구역 이후':`${area}구역`));for(const tier of ['UR','SR','R','N'])row.append(make('td',`${odds[tier]}%`));tbody.append(row);}table.append(tbody);$('reward-base-odds').append(table);
  refresh();$('open-reward-preview').disabled=false;
}
