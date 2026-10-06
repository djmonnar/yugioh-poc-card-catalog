// Authored recipe ownership is independent of saved card counts and notes.
export function parseActors(payload){
  if(payload?.schema_version!==1||!Array.isArray(payload.actors))throw new Error('상대 캐릭터 자료를 읽을 수 없어.');
  const seen=new Set(),ids=new Set();
  return payload.actors.map(actor=>{
    if(typeof actor.actor_id!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(actor.actor_id)||ids.has(actor.actor_id)||typeof actor.name!=='string'||!actor.name.trim()||actor.name.length>80||!/^content-packs\/[a-z0-9-]+\/assets\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(actor.portrait)||!Array.isArray(actor.bindings))throw new Error('상대 캐릭터 형식이 맞지 않아.');
    ids.add(actor.actor_id);
    const bindings=actor.bindings.map(b=>{
      const prefix=b.ruleset==='classic'?'cpu_':b.ruleset==='duel_links_plan'?'DLR_':null;
      if(!prefix||!new RegExp(`^${prefix}[0-9]{3}\\.ydc$`).test(b.filename)||seen.has(b.filename))throw new Error('상대 캐릭터와 덱 연결이 맞지 않아.');
      seen.add(b.filename);return {filename:b.filename,ruleset:b.ruleset};
    });
    return {actor_id:actor.actor_id,name:actor.name,portrait:actor.portrait,bindings};
  });
}
export function actorForDeck(actors,deck){
  return actors.find(actor=>actor.bindings.some(b=>b.filename===deck?.source_recipe?.filename&&b.ruleset===deck?.ruleset))??null;
}
