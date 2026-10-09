import {statConditionsMatch} from './card-filters.js?v=20261007-44';
import {categoryMatches} from './card-groups.js?v=20261008-additions';

const tiers=['L','UR','SR','R','N'];
const collator=new Intl.Collator('ko');
const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');
export function pickerCards(cards,criteria={},accept=()=>true){
  const query=normalize(criteria.query);
  return cards.filter(card=>{
    if(!accept(card))return false;
    for(const field of ['rarity','type','subtype','race','attribute'])if(criteria[field]&&card[field]!==criteria[field])return false;
    if(!categoryMatches(card,criteria.mechanic,criteria.group)||!statConditionsMatch(card,criteria.stats||[]))return false;
    const text=[card.name_ko,card.name_en,card.description_ko,card.race,card.attribute,card.type,card.subtype,card.slot,card.internal_id].join(' ');
    return !query||normalize(text).includes(query);
  }).sort((a,b)=>{
    const number=field=>(Number.isFinite(b[field])?b[field]:-1)-(Number.isFinite(a[field])?a[field]:-1);
    let order=0;
    if(criteria.sort==='attack')order=number('atk');
    else if(criteria.sort==='level')order=number('level');
    else if(criteria.sort!=='name')order=(tiers.includes(a.rarity)?tiers.indexOf(a.rarity):tiers.length)-(tiers.includes(b.rarity)?tiers.indexOf(b.rarity):tiers.length);
    return order||collator.compare(a.name_ko,b.name_ko)||a.slot-b.slot;
  });
}
