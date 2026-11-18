// Read-only view of the public web-db-history branch (scripts/web-db-history.mjs).
// Uses unauthenticated GitHub REST reads only, caches them briefly and fails soft:
// the studio keeps working when GitHub is unreachable or rate limited.

export const HISTORY_REPO170=Object.freeze({owner:'djmonnar',repo:'yugioh-poc-card-catalog',branch:'web-db-history'});
const CACHE170='poc-authoring170-history-v1';
const SHA=/^[0-9a-f]{7,40}$/;
const SECTION_LABELS170={'map-rules':'맵 분포','content-profiles':'콘텐츠 설정'};

export function historyLinks170(repo=HISTORY_REPO170){
  const base=`https://github.com/${repo.owner}/${repo.repo}`,api=`https://api.github.com/repos/${repo.owner}/${repo.repo}`;
  return {
    commits:`${api}/commits?sha=${encodeURIComponent(repo.branch)}&per_page=30`,
    commit:(sha,page=1)=>`${api}/commits/${sha}?per_page=300&page=${page}`,
    latest:`https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${encodeURIComponent(repo.branch)}/LATEST.md`,
    html:sha=>`${base}/commit/${sha}`,
    compare:(from,to)=>`${base}/compare/${from}...${to}`,
    branch:`${base}/commits/${encodeURIComponent(repo.branch)}`
  };
}

// "- 카드 (game/catalog) · 변경 1185: 0 푸른 눈의 백룡, … / 추가 2: …"
export function parseSummaryLine170(line){
  const match=/^- (.+?) \(([^()]+)\) · (.+)$/.exec(String(line??'').trim());if(!match)return null;
  const parts=match[3].split(' / ').map(part=>{const row=/^(변경|추가|삭제) (\d+): (.*)$/.exec(part);return row?{kind:row[1],count:Number(row[2]),names:row[3]}:null;}).filter(Boolean);
  return {label:match[1],section:match[2],parts};
}
export function parseCommitMessage170(message){
  const lines=String(message??'').split(/\r?\n/),title=lines[0]?.trim()||'변경 기록';
  const sections=lines.slice(1).map(parseSummaryLine170).filter(Boolean),revision=/개정 (\d+)/.exec(title)?.[1]??null,previous=/이전 기록 (\d+)/.exec(title)?.[1]??null;
  return {title,revision:revision&&Number(revision),previous:previous&&Number(previous),sections};
}
export function parseCommits170(rows){
  if(!Array.isArray(rows))throw Error('변경 기록 응답을 확인하지 못했습니다.');
  return rows.filter(row=>row&&SHA.test(row.sha??'')).slice(0,50).map(row=>{
    const message=parseCommitMessage170(row.commit?.message);
    return {sha:row.sha,short:row.sha.slice(0,7),...message,date:row.commit?.committer?.date??row.commit?.author?.date??null,url:typeof row.html_url==='string'&&row.html_url.startsWith('https://github.com/')?row.html_url:null,parent:SHA.test(row.parents?.[0]?.sha??'')?row.parents[0].sha:null};
  });
}
export function cardIdsFromFiles170(files){
  const ids=new Set();for(const file of Array.isArray(files)?files:[]){const match=/^game\/catalog\/(\d{1,6})\.json$/.exec(file?.filename??'');if(match)ids.add(Number(match[1]));}
  return ids;
}
// Fallback when the commit file list is unavailable: LATEST.md lists only the
// first names of each group, so the result is marked partial.
export function cardIdsFromSummary170(text){
  const ids=new Set();let total=0;
  for(const line of String(text??'').split(/\r?\n/)){const row=parseSummaryLine170(line);if(row?.section!=='game/catalog')continue;for(const part of row.parts){if(part.kind==='삭제')continue;total+=part.count;for(const name of part.names.split(', ')){const id=/^(\d{1,6})\b/.exec(name)?.[1];if(id)ids.add(Number(id));}}}
  const revision=/웹 DB 개정 (\d+)/.exec(String(text??''))?.[1];
  return {ids,total,partial:ids.size<total,revision:revision?Number(revision):null};
}

export function createHistorySource170({fetch:fetchImpl=globalThis.fetch?.bind(globalThis),storage=null,now=()=>Date.now(),ttlMs=30*60*1000,maxFilePages=10,repo=HISTORY_REPO170}={}){
  const links=historyLinks170(repo),memory={commits:null,changed:new Map()},tasks=new Map();
  const readCache=()=>{try{const data=JSON.parse(storage?.getItem(CACHE170)??'null');return data?.schema===1?data:null;}catch{return null;}};
  const writeCache=()=>{try{storage?.setItem(CACHE170,JSON.stringify({schema:1,commits:memory.commits,changed:[...memory.changed].slice(-6).map(([sha,row])=>[sha,{...row,ids:[...row.ids]}])}));}catch{/* Cache is optional. */}};
  const cached=readCache();
  if(cached){if(cached.commits?.ok)memory.commits=cached.commits;for(const [sha,row] of Array.isArray(cached.changed)?cached.changed:[])if(SHA.test(sha)&&row?.ok&&Array.isArray(row.ids))memory.changed.set(sha,{...row,ids:new Set(row.ids.filter(Number.isSafeInteger))});}
  const fresh=row=>row&&now()-row.fetchedAt<ttlMs;
  async function json(url){
    if(typeof fetchImpl!=='function')throw Error('이 브라우저에서 변경 기록을 불러올 수 없습니다.');
    const response=await fetchImpl(url,{headers:{Accept:'application/vnd.github+json'},cache:'no-store',signal:globalThis.AbortSignal?.timeout?.(15000)});
    if(response.status===403||response.status===429)throw Error('GitHub 조회 한도에 걸렸습니다. 잠시 뒤 다시 확인해 주세요.');
    if(!response.ok)throw Error(`변경 기록을 불러오지 못했습니다 (HTTP ${response.status}).`);
    return response.json();
  }
  async function text(url){const response=await fetchImpl(url,{cache:'no-store',signal:globalThis.AbortSignal?.timeout?.(15000)});if(!response.ok)throw Error(`LATEST.md를 불러오지 못했습니다 (HTTP ${response.status}).`);return response.text();}
  function once(key,run){if(!tasks.has(key))tasks.set(key,Promise.resolve().then(run).finally(()=>tasks.delete(key)));return tasks.get(key);}
  const fail=error=>({ok:false,message:error?.message??'변경 기록을 불러오지 못했습니다.',fetchedAt:now()});
  const api={
    links,
    peekCommits(){return memory.commits;},
    peekChanged(sha=null){const key=sha??memory.commits?.commits?.[0]?.sha??'latest';return memory.changed.get(key)??null;},
    commits({force=false}={}){
      if(!force&&fresh(memory.commits))return Promise.resolve(memory.commits);
      return once('commits',async()=>{try{memory.commits={ok:true,commits:parseCommits170(await json(links.commits)),fetchedAt:now()};writeCache();return memory.commits;}catch(error){return memory.commits?.ok?{...memory.commits,stale:true,message:fail(error).message}:fail(error);}});
    },
    changedCards(sha=null,{force=false}={}){
      return once(`changed:${sha??'latest'}`,async()=>{
        let target=sha,title=null;
        if(!target){const list=await api.commits();target=list.ok?list.commits[0]?.sha:null;title=list.ok?list.commits[0]?.title:null;}
        else title=memory.commits?.commits?.find(row=>row.sha===target)?.title??null;
        const key=target??'latest',known=memory.changed.get(key);if(!force&&fresh(known))return known;
        try{
          if(!target)throw Error('최근 변경 기록이 없습니다.');
          const ids=new Set();let page=1,complete=false;
          for(;page<=maxFilePages;page++){const data=await json(links.commit(target,page));for(const id of cardIdsFromFiles170(data.files))ids.add(id);if(!Array.isArray(data.files)||data.files.length<300){complete=true;break;}}
          const row={ok:true,sha:target,title,ids,partial:!complete,source:'commit',fetchedAt:now()};memory.changed.set(key,row);writeCache();return row;
        }catch(error){
          if(sha)return fail(error);
          try{const summary=cardIdsFromSummary170(await text(links.latest));if(!summary.ids.size)throw error;const row={ok:true,sha:target,title:title??(summary.revision?`웹 DB 개정 ${summary.revision}`:'최근 변경'),ids:summary.ids,partial:summary.partial,source:'summary',fetchedAt:now()};memory.changed.set(key,row);return row;}
          catch{return fail(error);}
        }
      });
    }
  };
  return api;
}

export function historyDate170(value){
  const time=Date.parse(value??'');if(!Number.isFinite(time))return '';
  return new Date(time).toLocaleString('ko-KR',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
}

// Panel rendering is self-contained so a store refresh never re-fetches.
export function renderHistoryPanel170({host,doc,el,button,source,onShowCards=null}){
  host.append(el('h1','변경 이력'),el('p','웹 DB의 공개 게임 자료를 한 시간마다 기록한 내용입니다. 읽기 전용이며 DB를 바꾸지 않습니다.','au-lead'));
  const status=el('p',null,'au-hint au-history-status170'),list=el('div',null,'au-history-list170'),tools=el('div',null,'au-toolbar');status.setAttribute('role','status');
  const reload=button('다시 불러오기',()=>load(true));tools.append(reload);
  if(source?.links?.branch){const all=el('a','GitHub에서 전체 기록 보기');all.href=source.links.branch;all.target='_blank';all.rel='noopener noreferrer';tools.append(all);}
  host.append(tools,status,list);
  if(!source){status.textContent='변경 기록을 불러올 연결이 없습니다.';reload.disabled=true;return;}
  function draw(result){
    list.replaceChildren();
    if(!result?.ok){status.textContent=`${result?.message??'변경 기록을 불러오지 못했습니다.'} 제작소 편집에는 영향이 없습니다.`;return;}
    status.textContent=`${result.stale?`${result.message} 이전에 받은 기록을 보여 줍니다. · `:''}최근 기록 ${result.commits.length.toLocaleString('ko-KR')}개`;
    if(!result.commits.length){list.append(el('p','아직 기록이 없습니다.','au-empty'));return;}
    for(const commit of result.commits){
      const item=el('article',null,'au-panel au-history-item170'),head=el('div',null,'au-history-head170');head.append(el('h2',commit.title));
      const when=historyDate170(commit.date);if(when)head.append(el('small',`${when} · ${commit.short}`));item.append(head);
      const sections=commit.sections.filter(row=>row.section!=='revision'&&!(row.label===row.section&&/^game(\/|$)/.test(row.section)));
      if(sections.length){const ul=el('ul',null,'au-history-sections170');for(const row of sections)ul.append(el('li',`${SECTION_LABELS170[row.section]??row.label} · ${row.parts.map(part=>`${part.kind} ${part.count.toLocaleString('ko-KR')}`).join(', ')}`));item.append(ul);}
      else item.append(el('p','개정 번호와 공통 설정만 바뀌었습니다.','au-hint'));
      const actions=el('div',null,'au-history-actions170');
      if(commit.url){const link=el('a','커밋 보기');link.href=commit.url;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);}
      if(commit.parent){const compare=el('a','이전 기록과 비교');compare.href=source.links.compare(commit.parent,commit.sha);compare.target='_blank';compare.rel='noopener noreferrer';actions.append(compare);}
      if(onShowCards&&commit.sections.some(row=>row.section==='game/catalog'))actions.append(button('바뀐 카드 보기',()=>onShowCards(commit.sha)));
      item.append(actions);list.append(item);
    }
  }
  function load(force=false){
    reload.disabled=true;status.textContent='변경 기록을 불러오는 중…';
    return source.commits({force}).then(result=>{if(host.isConnected!==false)draw(result);}).finally(()=>{reload.disabled=false;});
  }
  const cached=source.peekCommits();if(cached)draw(cached);
  load(false);
}
