// Reuse the established dialog/card preview; starting decks belong to the
// shared library, while the chosen slot holds this run's progress only.
export function mountStartView164(document){
  const dialog=document.getElementById('new-run-dialog');
  const make=(tag,text,className)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;};
  const head=dialog.querySelector('.dialog-head'),select=document.getElementById('start-deck'),preview=document.getElementById('starter-preview'),slotNote=document.getElementById('new-run-slot'),legacy=document.getElementById('opponent-settings'),seed=dialog.querySelector('input#run-seed-input').closest('details'),create=document.getElementById('create-run');
  document.getElementById('new-run-title').textContent='새 여정 · 시작 덱 선택';
  select.hidden=true;legacy.hidden=true;legacy.removeAttribute('open');
  const intro=make('p','매번 원하는 덱으로 새롭게 시작해. 3개 장의 보스를 넘어 탑의 봉인을 풀어보자.','new-run-intro164');
  const decks=make('section',null,'start-section164');decks.append(make('h3','1. 시작 덱을 골라줘'));
  const choices=make('div',null,'starter-choices164');choices.id='starter-choices164';choices.setAttribute('aria-label','등록된 원정 시작 덱');
  const deckDetails=make('details',null,'starter-details164');deckDetails.append(make('summary','선택한 덱 카드 보기'),preview);decks.append(select,choices,deckDetails);
  const slots=make('section',null,'start-section164');slots.append(make('h3','2. 진행을 저장할 슬롯'));
  const slotChoices=make('div',null,'save-slot-choices164');slotChoices.id='save-slot-choices164';slotChoices.setAttribute('aria-label','이번 원정의 저장 슬롯');slots.append(slotChoices,slotNote);
  const campaign=make('details',null,'campaign-overview164');campaign.append(make('summary','3개 장 · 장마다 15층'));
  const status=make('p');status.id='campaign-status164';status.setAttribute('role','status');
  const summary=make('div',null,'campaign-summary164');summary.id='campaign-summary164';
  const reload=make('button','장별 설정 다시 읽기');reload.id='reload-campaign164';reload.type='button';
  const edit=make('a','장별 상대·LP·특성 편집 ↗');edit.href='https://djmonnar.github.io/yugioh-poc-card-catalog/campaign164.html';edit.target='_blank';edit.rel='noopener';
  campaign.append(make('p','각 장의 15층 보스를 이기면 다음 장이 열려. 덱·LP·유물·골드와 카드 보상 천장은 이어져.'),status,summary,reload,edit);
  create.textContent='선택한 덱으로 여정 시작';
  dialog.replaceChildren(head,intro,decks,slots,campaign,seed,create,legacy);
}
