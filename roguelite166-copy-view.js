// Presentation only. Catalog rows remain immutable; every badge names its run-local copy.
const amount=value=>Number.isSafeInteger(value)?value:0;
export function upgradeCopyView166(item){
  const card=item.card??{},atkBonus=amount(item.atk_bonus),defBonus=amount(item.def_bonus),seal=amount(item.seal_remaining);
  const lines=[];
  if(atkBonus)lines.push(`공격력 +${atkBonus}`);
  if(defBonus)lines.push(`수비력 +${defBonus}`);
  if(item.tribute_required===1)lines.push('어드밴스 소환에 필요한 릴리스: 1장');
  if(item.special_spell_search)lines.push('추가 효과: 이 카드가 특수 소환되었을 때, 덱에서 마법 카드 1장을 선택해 패에 넣는다.');
  const text=typeof item.upgrade_text==='string'?item.upgrade_text.trim():'';
  if(text&&!lines.length&&!seal)lines.push(text);
  if(seal)lines.push(`봉인 중: 앞으로 완료 전투 ${seal}회 동안 사용할 수 없음. 해제 후 공격력 +${amount(item.seal_pending_atk)} / 수비력 +${amount(item.seal_pending_def)}.`);
  const id=item.instance_id??item.id??'',enhanced=Boolean(item.enhanced||atkBonus||defBonus||item.tribute_required===1||item.special_spell_search);
  return {name:card.name_ko??'카드',instance_id:id,copy_label:`카드 #${id.replace(/^i163_/,'')}`,enhanced,seal_remaining:seal,atk:card.atk==null?null:card.atk<0?card.atk:card.atk+atkBonus,def:card.def==null?null:card.def<0?card.def:card.def+defBonus,lines,summary:lines.join(' · ')};
}
export function decorateCopy166(element,item){
  const view=upgradeCopyView166(item);element.classList.add('copy166-card');element.classList.toggle('secret-rare166',view.enhanced);element.classList.toggle('sealed166',view.seal_remaining>0);element.dataset.instance=view.instance_id;element.dataset.enhanced=String(view.enhanced);element.dataset.sealRemaining=String(view.seal_remaining);return view;
}
export function appendCopyDetails166(root,item,make){
  const view=upgradeCopyView166(item),section=make('section',null,'copy166-enhancement');section.setAttribute('aria-label','선택한 카드 한 장의 원정 강화');
  section.append(make('strong',`${view.copy_label}${view.enhanced?' · 원정 강화':''}`));
  if(view.lines.length)for(const line of view.lines)section.append(make('p',line));else section.append(make('p','이 한 장에는 원정 강화가 적용되지 않았어.'));
  if(view.enhanced)section.append(make('small','이 원정의 선택한 한 장에만 적용 · 원본 카드 효과는 아래에 표시'));
  root.append(section);return section;
}
