import {snapshotCard} from './roguelite-card.js?v=20261014-139';
import {FIELD_OPTIONS163} from './expedition-content163-core.js?v=20261018-163';
const fail=message=>{throw new Error(message);},clone=structuredClone;
const key=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function exact(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))fail(`${label} 형식을 확인해줘.`);}
export function cleanRecipes163(value){
 exact(value,['schema','kind','catalog_dataset_id','fusion_spell','fusions','rituals','fields'],'정식 소환 표');
 if(value.schema!==1||value.kind!=='poc-expedition-engine-recipes158'||!key(value.catalog_dataset_id)||!key(value.fusion_spell)||!Array.isArray(value.fusions)||value.fusions.length>500||!Array.isArray(value.rituals)||value.rituals.length>500||!Array.isArray(value.fields)||value.fields.length!==6)fail('정식 소환 표의 버전을 확인해줘.');
 const seen=new Set(),fusions=value.fusions.map(row=>{exact(row,['fusion','materials'],'융합 식');if(!key(row.fusion)||!Array.isArray(row.materials)||![2,3].includes(row.materials.length)||!row.materials.every(key))fail('정식 융합 소재를 확인해줘.');const id=JSON.stringify([row.fusion,row.materials]);if(seen.has(id))fail('같은 융합 식이 중복됐어.');seen.add(id);return clone(row);});
 const ids=new Set(),rituals=value.rituals.map(row=>{exact(row,['monster','spell'],'의식 식');if(!key(row.monster)||!key(row.spell)||ids.has(row.monster))fail('정식 의식 식이 중복되거나 잘못됐어.');ids.add(row.monster);return clone(row);});
 const fields=value.fields.map(row=>{exact(row,['id','identity_key','internal_id'],'기본 필드');const known=FIELD_OPTIONS163.find(v=>v.id===row.id);if(!known||known.identity_key!==row.identity_key||known.internal_id!==row.internal_id)fail('정식 기본 필드가 설치판과 달라.');return clone(row);});
 if(new Set(fields.map(row=>row.id)).size!==6)fail('기본 필드가 중복됐어.');
 return {schema:1,kind:value.kind,catalog_dataset_id:value.catalog_dataset_id,fusion_spell:value.fusion_spell,fusions,rituals,fields};
}
const legal=card=>!!card&&!card.special&&card.deck_limit!==0&&card.speed_limit!==0;
export function recipePools163(book,cards){
 const clean=cleanRecipes163(book),by=new Map(cards.map(card=>[card.identity_key,card])),resolve=id=>legal(by.get(id))?snapshotCard(by.get(id)):null;
 const spell=resolve(clean.fusion_spell),fusions=clean.fusions.flatMap(recipe=>{const fusion=resolve(recipe.fusion),materials=recipe.materials.map(resolve);return spell?.type==='마법'&&fusion?.type==='융합 몬스터'&&materials.every(card=>card&&card.type.includes('몬스터'))?[{recipe:clone(recipe),fusion,spell,materials}]:[];});
 const rituals=clean.rituals.flatMap(recipe=>{const monster=resolve(recipe.monster),spell=resolve(recipe.spell);return monster?.type==='의식 몬스터'&&spell?.type==='마법'?[{recipe:clone(recipe),monster,spell}]:[];});
 return {fusions,rituals};
}
export function deterministic163(items,seed){
 if(!items.length)return null;let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.codePointAt(0),16777619)>>>0;
 let t=h+0x6d2b79f5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return items[Math.floor(((t^t>>>14)>>>0)/4294967296*items.length)];
}
export function aggregateCards163(entries){
 const out=[];for(const {card,count} of entries){const prior=out.find(row=>row.card.identity_key===card.identity_key);if(prior)prior.count+=count;else out.push({card:clone(card),count});}return out;
}
export function fusionGrant163(pair,materialCopies=1){return aggregateCards163([{card:pair.fusion,count:1},{card:pair.spell,count:1},...pair.materials.map(card=>({card,count:materialCopies}))]);}
export function ritualGrant163(pair){return aggregateCards163([{card:pair.monster,count:1},{card:pair.spell,count:1}]);}
