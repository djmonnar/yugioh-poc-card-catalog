// Unsaved-draft safety net. Live drafts stay in this tab's sessionStorage, exactly
// as before; every write is mirrored to a per-tab localStorage copy so a closed
// tab can offer to restore them. Restoring only stages drafts again: nothing here
// sends a request, and saving still needs the normal save button.

export const DRAFT_PREFIX170='poc-authoring060-drafts:';
export const BACKUP_PREFIX170='poc-authoring170-draft-backup:';
const TAB_KEY170='poc-authoring170-tab';
const MAX_BYTES170=2000000;
export const LIVE_MS170=60000;
const bytes=value=>new TextEncoder().encode(value).byteLength;
const tryRead=(storage,key)=>{try{return storage?.getItem(key)??null;}catch{return null;}};
function keys170(storage){try{const rows=[];for(let i=0;i<(storage?.length??0);i++){const key=storage.key(i);if(typeof key==='string')rows.push(key);}return rows;}catch{return [];}}

function tabId170(session,random){
  let id=tryRead(session,TAB_KEY170);
  if(!id||!/^[A-Za-z0-9-]{8,64}$/.test(id)){id=random();try{session?.setItem(TAB_KEY170,id);}catch{/* A fresh id per page is acceptable. */}}
  return id;
}

export function createDraftBackup170({session=null,local=null,now=()=>Date.now(),random=()=>globalThis.crypto?.randomUUID?.()??`tab-${Math.random().toString(36).slice(2,14)}`}={}){
  if(!session&&!local)return {storage:null,pending:()=>null,discard:()=>false,heartbeat(){},markClosed(){},tab:null};
  const tab=tabId170(session,random),own=new Set();
  const ownerPart=key=>key.startsWith(DRAFT_PREFIX170)?key.slice(DRAFT_PREFIX170.length):null;
  const backupKey=(encodedOwner,id=tab)=>`${BACKUP_PREFIX170}${encodedOwner}:${id}`;
  function parse(key,owner){
    const raw=tryRead(local,key);if(!raw||bytes(raw)>MAX_BYTES170+4096)return null;
    try{
      const data=JSON.parse(raw);if(data?.schema!==1||typeof data.text!=='string'||typeof data.tab!=='string'||!Number.isFinite(data.savedAt))return null;
      const drafts=JSON.parse(data.text);if(drafts?.schema!==1||drafts.owner!==owner||!Array.isArray(drafts.items))return null;
      return {...data,key,count:drafts.items.length};
    }catch{return null;}
  }
  function touch(field){
    for(const key of own){try{const data=JSON.parse(local.getItem(key)??'null');if(data?.schema===1&&data.tab===tab){data[field]=now();local.setItem(key,JSON.stringify(data));}else own.delete(key);}catch{/* Optional. */}}
  }
  const storage={
    getItem(key){return session?session.getItem(key):null;},
    setItem(key,value){
      if(session)session.setItem(key,value);
      const owner=ownerPart(key);if(owner===null||!local)return;
      try{if(bytes(value)<=MAX_BYTES170){const target=backupKey(owner);local.setItem(target,JSON.stringify({schema:1,tab,savedAt:now(),aliveAt:now(),closedAt:null,text:value}));own.add(target);}}catch{/* The tab copy is still kept. */}
    },
    removeItem(key){
      session?.removeItem?.(key);
      const owner=ownerPart(key);if(owner===null||!local)return;
      const target=backupKey(owner);try{local.removeItem(target);}catch{/* Nothing to remove. */}own.delete(target);
    }
  };
  return {
    tab,storage,
    // Newest copy left by a closed (or silent for a minute) tab, offered only
    // while this tab has no drafts of its own. Live tabs keep their copies.
    pending(owner){
      if(typeof owner!=='string'||!owner||!local)return null;
      if(tryRead(session,DRAFT_PREFIX170+encodeURIComponent(owner)))return null;
      const prefix=`${BACKUP_PREFIX170}${encodeURIComponent(owner)}:`,time=now();let best=null;
      for(const key of keys170(local)){
        if(!key.startsWith(prefix)||key===backupKey(encodeURIComponent(owner)))continue;
        const row=parse(key,owner);if(!row||!row.count||row.tab===tab)continue;
        if(!Number.isFinite(row.closedAt)&&time-(Number.isFinite(row.aliveAt)?row.aliveAt:row.savedAt)<LIVE_MS170)continue;
        if(!best||row.savedAt>best.savedAt)best=row;
      }
      return best?{owner,key:best.key,savedAt:best.savedAt,count:best.count,text:best.text}:null;
    },
    discard(key){if(typeof key!=='string'||!key.startsWith(BACKUP_PREFIX170))return false;try{local?.removeItem(key);return true;}catch{return false;}},
    heartbeat(){touch('aliveAt');},
    markClosed(){touch('closedAt');}
  };
}

// One undo step can cover several drafts (a bulk edit or a multi-section staging).
export function createUndoStack170({limit=50}={}){
  const entries=[];let group=null;
  const push=keys=>{entries.push(keys);if(entries.length>limit)entries.shift();};
  return {
    record(key){if(group)group.push(key);else push([key]);},
    group(run){
      if(group)return run();
      group=[];
      try{return run();}finally{const keys=group;group=null;if(keys.length)push(keys);}
    },
    // canUndo(type,id) comes from the drafts bank; stale steps (saved, cancelled
    // or resolved drafts) are skipped instead of rewinding unrelated edits.
    available(canUndo){while(entries.length&&!entries.at(-1).some(key=>canUndo(key.type,key.id)))entries.pop();return entries.length>0;},
    undo(canUndo,undo){
      if(!this.available(canUndo))return 0;
      const keys=entries.pop();let count=0;
      for(const key of [...keys].reverse())if(canUndo(key.type,key.id)&&undo(key.type,key.id))count++;
      return count;
    },
    clear(){entries.length=0;},
    get size(){return entries.length;}
  };
}
