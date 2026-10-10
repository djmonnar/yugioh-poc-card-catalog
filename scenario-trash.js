import {parseStory} from './story-core.js?v=20261010-characters103';
import {readLibrary} from './story-library.js?v=20261010-characters103';
import {parseCharacters} from './character-library.js?v=20261010-characters103';
export const TRASH_KEY='poc-scenario-trash-v1';
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id)&&id!=='main';
export function parseTrash(rows){
  if(!Array.isArray(rows)||rows.length>100)throw new Error('삭제한 시나리오 목록을 확인해줘.');
  const seen=new Set();return rows.map(r=>{
    if(!validId(r.id)||seen.has(r.id)||!Number.isSafeInteger(r.version)||r.version<0)throw new Error('삭제한 시나리오 정보를 확인해줘.');
    seen.add(r.id);return {...r,document:parseStory(r.document),baselines:parseCharacters(r.baselines||[])};
  });
}
export function archiveLocal(library,document,version,baselines,trash){
  if(!validId(library.active))throw new Error('기본 시나리오는 삭제할 수 없어.');
  const next=readLibrary({schema:1,...library}),id=next.active;
  const row=parseTrash([{id,document,version:version??0,baselines,deleted_at:new Date().toISOString()}])[0];
  const remaining=trash.filter(r=>r.id!==id);if(remaining.length>=100)throw new Error('삭제한 시나리오는 100개까지 보관할 수 있어.');
  next.entries=next.entries.filter(e=>e.id!==id);next.active='main';
  return {library:next,trash:[row,...remaining],row};
}
export function restoreLocal(library,row){
  const clean=parseTrash([row])[0],next=readLibrary({schema:1,...library});
  if(next.entries.some(e=>e.id===clean.id))throw new Error('같은 시나리오가 이미 있어.');
  if(next.entries.length>=20)throw new Error('시나리오는 20개까지 만들 수 있어.');
  next.entries.push({id:clean.id,title:clean.document.title,version:clean.version});next.active=clean.id;
  return {library:next,document:structuredClone(clean.document),version:clean.version,baselines:structuredClone(clean.baselines)};
}
