import {emptyDeck,parseBundle} from './ai-deck-core.js';
import {makeStarter} from './roguelite-core.js?v=20261015-147';
import {cleanStarterDocument153,cleanStarterEnvelope153,starterDocument153} from './roguelite153-starters.js';

export const DRAFT_KEY026='poc-starting-deck-editor026';
export const BACKUP_KEY026='poc-starting-deck-backup026';
const copy=structuredClone,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function deckFromStarter026(starter){const deck=emptyDeck(starter.source_deck_id,'duel_links_plan');deck.name=starter.name;deck.groups=copy(starter.groups);return deck;}
export function replaceStarter026(document,id,deck,cards,meta){
 const before=document.starters.find(s=>s.starter_id===id);if(!before)throw Error('수정할 시작 덱을 골라줘.');
 const next=makeStarter(deck,cards,{...meta,id:before.starter_id,name:deck.name,now:new Date()});
 return starterDocument153(document.starters.map(s=>s.starter_id===id?next:s),meta.dataset_id);
}
export class StarterEditor026{
 constructor({storage,cloud,meta,cards}){Object.assign(this,{storage,cloud,meta,cards});this.document=null;this.base=null;this.baseline=null;this.online=null;this.work=null;this.busy=false;this.loaded=false;
  const raw=storage.getItem(DRAFT_KEY026);if(raw!==null){const draft=JSON.parse(raw);if(draft.schema!==1)throw Error('브라우저 초안의 버전을 확인해줘.');this.document=cleanStarterDocument153(draft.document,{allowUnset:true});this.base=draft.base;this.baseline=draft.baseline===null?null:cleanStarterEnvelope153(draft.baseline);if(!(this.base===null||Number.isSafeInteger(this.base)&&this.base>=0)||this.baseline?.version!==this.base&&this.base!==null)throw Error('브라우저 초안의 온라인 기준을 확인해줘.');if(draft.work){const deck=parseBundle({schema_version:1,kind:'poc-ai-deck-bundle',decks:[draft.work.deck]},cards)[0];if(!this.document.starters.some(s=>s.starter_id===draft.work.id))throw Error('수정 중인 시작 덱을 확인해줘.');this.work={id:draft.work.id,deck};}}
 }
 persist(){this.storage.setItem(DRAFT_KEY026,JSON.stringify({schema:1,document:this.document,base:this.base,baseline:this.baseline,work:this.work}));}
 async refresh(){const row=cleanStarterEnvelope153(await this.cloud.load());this.online=row;this.loaded=true;if(this.document===null){this.document=copy(row.document);this.base=row.version;this.baseline=copy(row);this.persist();}return row;}
 backup(){const value={schema:1,created_at:new Date().toISOString(),document:copy(this.document),work:copy(this.work),baseline:copy(this.baseline),online:copy(this.online)};this.storage.setItem(BACKUP_KEY026,JSON.stringify(value));return value;}
 useOnline(){if(!this.online)throw Error('온라인 목록을 먼저 확인해줘.');this.backup();this.document=copy(this.online.document);this.base=this.online.version;this.baseline=copy(this.online);this.work=null;this.persist();}
 setDocument(value){const checked=cleanStarterDocument153(value,{allowUnset:true});const before=this.document;this.document=checked;try{this.persist();}catch(error){this.document=before;throw error;}}
 rename(id,name){name=name.trim();if(!name||name.length>80)throw Error('시작 덱 이름은 1~80자로 적어줘.');const next=copy(this.document);const starter=next.starters.find(s=>s.starter_id===id);if(!starter)throw Error('시작 덱을 골라줘.');starter.name=name;this.setDocument(next);}
 move(id,step){const next=copy(this.document),index=next.starters.findIndex(s=>s.starter_id===id),target=index+step;if(index<0||target<0||target>=next.starters.length)return;[next.starters[index],next.starters[target]]=[next.starters[target],next.starters[index]];this.setDocument(next);}
 remove(id){if(this.work?.id===id)this.work=null;this.setDocument({...this.document,starters:this.document.starters.filter(s=>s.starter_id!==id)});}
 add(deck){if(this.document.starters.length>=20)throw Error('시작 덱은 최대 20개까지 등록할 수 있어.');const starter=makeStarter(deck,this.cards,{...this.meta,id:crypto.randomUUID(),name:deck.name});this.setDocument(starterDocument153([...this.document.starters,starter],this.meta.dataset_id));return starter.starter_id;}
 begin(id){const starter=this.document.starters.find(s=>s.starter_id===id);if(!starter)throw Error('수정할 시작 덱을 골라줘.');this.work={id,deck:deckFromStarter026(starter)};this.persist();}
 updateWork(deck){if(!this.work)throw Error('카드 수정을 먼저 열어줘.');this.work.deck=parseBundle({schema_version:1,kind:'poc-ai-deck-bundle',decks:[deck]},this.cards)[0];this.persist();}
 applyWork(){if(!this.work)return;const next=replaceStarter026(this.document,this.work.id,this.work.deck,this.cards,this.meta),before=this.work;this.work=null;try{this.setDocument(next);}catch(error){this.work=before;throw error;}}
 cancelWork(){this.work=null;this.persist();}
 async save({reviewedVersion=null}={}){
  if(this.busy)throw Error('저장 중이야. 잠시 기다려줘.');if(!this.loaded||this.base===null||!this.baseline)throw Error('온라인 목록을 먼저 불러와야 저장할 수 있어.');if(this.work)throw Error('수정 중인 카드 목록을 먼저 적용하거나 취소해줘.');
  const captured=cleanStarterDocument153(this.document);this.busy=true;
  try{const latest=cleanStarterEnvelope153(await this.cloud.load());this.online=latest;
   if(latest.version!==this.base&&reviewedVersion!==latest.version)throw Error('다른 곳에서 시작 덱 목록이 변경됐어. 아래 온라인 목록과 비교해줘. 현재 편집본은 보존했어.');
   if(!await this.cloud.editor())throw Error('poc_editor_required');
   this.backup();const saved=cleanStarterEnvelope153(await this.cloud.save(captured,latest.version));this.online=saved;
   if(!same(captured,this.document))throw Error('저장 중 편집본이 바뀌었어. 현재 초안은 보존했어.');this.base=saved.version;this.baseline=copy(saved);this.persist();return saved;
  }finally{this.busy=false;}
 }
}
