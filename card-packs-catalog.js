import {CardPacksCloud,packCloudError,packCardEligible,resolvePackCard} from './card-packs-core.js?v=20261013-packs131';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export class CatalogCardPacks{
  constructor({cards,meta,canEdit,reopen,toast}){Object.assign(this,{cards,meta,canEdit,reopen,toast});this.cloud=null;}
  async connect(client){this.cloud=new CardPacksCloud(client);await this.reload();}
  async reload(){if(this.cloud)await this.cloud.load();}
  detail(card,info){
    if(card.special)return;const box=node('section',null,'review-editor live-card-packs');box.append(node('h3','판매 카드팩 지정'));const status=node('p','','muted');status.setAttribute('role','status');const create=node('a','+ 새 카드팩 만들기');create.href=`card-packs.html?new=1&card=${card.slot}`;
    if(this.cloud?.rows==null){status.textContent='카드팩 목록을 불러오지 못했어. 새로 불러오기를 눌러줘.';}
    const ready=this.canEdit()&&this.cloud?.rows!=null;const rows=(this.cloud?.rows||[]).filter(r=>!r.archived);
    if(!rows.length&&this.cloud?.rows!=null)status.textContent='판매 카드팩을 먼저 만들어줘. 그 뒤 이 카드가 들어갈 팩을 선택할 수 있어.';
    for(const row of rows){const label=node('label',null,'pack-membership'),input=node('input');input.type='checkbox';input.checked=row.document.cards.some(ref=>resolvePackCard(ref,this.cards())?.identity_key===card.identity_key||ref.identity_key===card.identity_key);input.disabled=!ready||!input.checked&&!packCardEligible(card);const link=node('a','팩 편집');link.href=`card-packs.html?pack=${encodeURIComponent(row.id)}`;label.append(input,node('span',row.document.name||'이름 없는 카드팩'),link);box.append(label);
      input.onchange=async()=>{const included=input.checked;for(const c of box.querySelectorAll('input,button'))c.disabled=true;status.textContent='카드팩 지정 저장 중…';try{await this.cloud.member(this.meta(),card,row.id,included,row.version);this.reopen();this.toast(`${row.document.name} · ${included?'카드를 추가했어.':'카드를 뺐어.'}`);}catch(e){input.checked=!included;status.textContent=packCloudError(e);for(const c of box.querySelectorAll('input'))c.disabled=!ready||!c.checked&&!packCardEligible(card);refresh.disabled=false;}};
    }
    const refresh=node('button','카드팩 새로 불러오기');refresh.type='button';refresh.onclick=async()=>{refresh.disabled=true;try{await this.reload();this.reopen();}catch(e){status.textContent=packCloudError(e);refresh.disabled=false;}};
    if(!packCardEligible(card))box.append(node('p','이 카드는 현재 랜덤 뽑기 대상이 아니야. 기존 팩 지정은 유지되며, 도감의 등급·금제·뽑기 설정을 확인해줘.','muted'));
    else if(!ready&&rows.length)box.append(node('p','편집자 이메일로 로그인하면 이 카드가 들어갈 팩을 저장할 수 있어.','muted'));
    box.append(create,document.createTextNode(' '),refresh,status);info.append(box);
  }
}
