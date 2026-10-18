const fail=m=>{throw Error(m);};
export function cleanThemes159(value,cards){
 if(!value||value.schema!==1||value.kind!=='poc-expedition-theme-library159'||Object.keys(value).length!==3||!Array.isArray(value.themes)||value.themes.length>20)fail('등록된 덱 테마 자료를 확인해줘.');
 const seen=new Set(),themes=value.themes.map(row=>{
  if(!row||Object.keys(row).length!==3||!['id','name','identities'].every(k=>Object.hasOwn(row,k))||typeof row.id!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(row.id)||seen.has(row.id)||typeof row.name!=='string'||!row.name.length||row.name.length>100||!Array.isArray(row.identities)||row.identities.length>2047||new Set(row.identities).size!==row.identities.length||row.identities.some(k=>typeof k!=='string'||!/^[a-f0-9]{64}$/.test(k)))fail('덱 테마 식별값·카드 목록이 달라.');
  if(cards!==undefined&&(!Array.isArray(cards)||row.identities.some(k=>!cards.some(c=>c.identity_key===k))))fail('덱 테마 카드가 설치 도감에 없어.');seen.add(row.id);return {id:row.id,name:row.name,identities:[...row.identities]};
 });return {schema:1,kind:value.kind,themes};
}
