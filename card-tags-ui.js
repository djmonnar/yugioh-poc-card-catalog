import {CardTagsCloud,annotationFor,tagMatches,relatedAnnotations} from './card-tags.js?v=20261007-47';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export class CardTagsUI{
  constructor(options){this.options=options;this.cloud=null;this.selected=new Set();this.drafts=new Map();this.renderFilters();}
  async connect(client){this.cloud=new CardTagsCloud(client);await this.reload();}
  async reload(){if(this.cloud)await this.cloud.load();this.renderFilters();}
  reset(){this.selected.clear();this.renderFilters();}
  select(name){this.selected=new Set([name]);this.renderFilters();}
  matches(card){return tagMatches(this.cloud?.state,card,[...this.selected]);}
  searchText(card){return (annotationFor(this.cloud?.state,card)?.tags||[]).join(' ').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');}
  summary(){return [...this.selected].map(t=>'#'+t);}
  ready(){return this.options.canEdit()&&this.cloud?.state!=null;}
  renderFilters(){
    const box=document.getElementById('custom-tag-filters');if(!box)return;box.replaceChildren();
    const counts=new Map(),cards=new Map(this.options.cards().map(c=>[c.slot,c]));
    for(const row of this.cloud?.state?.annotations||[]){const c=cards.get(row.slot);if(!c||c.identity_key!==row.identity_key||c.internal_id!==row.internal_id)continue;for(const tag of row.tags)counts.set(tag,(counts.get(tag)||0)+1);}
    const categories=this.cloud?.state?.categories||[];
    for(const {name} of categories){const label=node('label',null,'tag-choice'),check=node('input');check.type='checkbox';check.checked=this.selected.has(name);check.addEventListener('change',()=>{check.checked?this.selected.add(name):this.selected.delete(name);this.options.changed();});label.append(check,node('span',name),node('small',counts.get(name)||0));box.append(label);}
    if(!categories.length)box.append(node('p',this.cloud?.state?'아직 만든 카테고리가 없어. 아래에서 하나 만들어봐.':'온라인 카테고리를 읽는 중…','muted'));
    document.getElementById('create-category').disabled=!this.ready();
    document.getElementById('new-category-name').disabled=!this.ready();
  }
  async create(name){
    if(!this.ready())throw new Error('이메일 로그인 후 카테고리를 만들 수 있어.');
    await this.cloud.create(name);this.renderFilters();this.options.changed();this.options.reopen();
  }
  badges(card,container){
    const tags=annotationFor(this.cloud?.state,card)?.tags||[];
    if(!tags.length)return;const list=node('div',null,'custom-tag-badges');
    for(const tag of tags){const b=node('button','#'+tag,'tag-badge');b.type='button';b.addEventListener('click',()=>this.options.showTag(tag));list.append(b);}container.append(list);
  }
  detail(card,info,relatedLink){
    const heading=node('section',null,'card-relations');
    const renderHeading=()=>{
      heading.replaceChildren(node('h3','내 카테고리 · 관련 카드'));this.badges(card,heading);
      const related=relatedAnnotations(this.cloud?.state,card,this.options.cards());
      if(related.length){const list=node('div',null,'relation-links');for(const c of related)list.append(relatedLink(c));heading.append(list);}
      else heading.append(node('p','관련 카드를 연결하면 양쪽 카드에서 서로 이동할 수 있어.','muted'));
    };renderHeading();
    info.append(heading);
    const box=node('section',null,'review-editor annotation-editor');box.append(node('h3','카테고리·링크 편집'));
    const ready=this.ready(),stored=annotationFor(this.cloud?.state,card);let expected=ready?this.cloud.version(card):null;
    let draft=this.drafts.get(card.identity_key);
    if(!draft)draft={tags:[...(stored?.tags||[])],links:(stored?.links||[]).map(l=>({...l}))};
    const remember=()=>this.drafts.set(card.identity_key,draft);
    const choices=node('div',null,'annotation-categories');
    for(const {name} of this.cloud?.state?.categories||[]){const label=node('label',null,'tag-choice'),check=node('input');check.type='checkbox';check.checked=draft.tags.includes(name);check.disabled=!ready;check.addEventListener('change',()=>{draft.tags=check.checked?[...draft.tags,name]:draft.tags.filter(t=>t!==name);remember();});label.append(check,node('span',name));choices.append(label);}
    if(!choices.children.length)choices.append(node('p','카드 찾기의 ‘내 카테고리’에서 먼저 카테고리를 만들어줘.','muted'));box.append(choices);
    const searchLabel=node('label','관련 카드 찾기');searchLabel.htmlFor='annotation-link-search';const search=node('input');search.id='annotation-link-search';search.type='search';search.placeholder='카드 이름 또는 카드 번호';search.disabled=!ready;search.autocomplete='off';box.append(searchLabel,search);
    const picked=node('div',null,'relation-links'),results=node('div',null,'annotation-link-results');box.append(picked,results);
    const renderLinks=()=>{
      picked.replaceChildren();const by=new Map(this.options.cards().map(c=>[c.slot,c]));
      for(const link of draft.links){const c=by.get(link.slot),b=node('button',(c?.name_ko||'#'+link.slot)+' ×');b.type='button';b.disabled=!ready;b.setAttribute('aria-label',(c?.name_ko||'#'+link.slot)+' 연결 해제');b.addEventListener('click',()=>{draft.links=draft.links.filter(l=>l.slot!==link.slot);remember();renderLinks();});picked.append(b);}
      results.replaceChildren();const q=search.value.trim().normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'');if(!q)return;
      const found=this.options.cards().filter(c=>c.slot!==card.slot&&!draft.links.some(l=>l.slot===c.slot)&&[c.name_ko,c.name_en,String(c.slot)].join(' ').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s/g,'').includes(q));
      for(const c of found.slice(0,20)){const b=node('button',`${c.name_ko} · #${c.slot} ＋`);b.type='button';b.addEventListener('click',()=>{if(draft.links.length>=20){status.textContent='관련 카드는 20장까지 연결할 수 있어.';return;}draft.links.push({slot:c.slot,identity_key:c.identity_key});remember();renderLinks();});results.append(b);}
      if(!found.length)results.append(node('p','일치하는 카드가 없어.','muted'));
      else if(found.length>20)results.append(node('p','20장만 표시했어. 이름을 더 입력해서 좁혀줘.','muted'));
    };
    search.addEventListener('input',renderLinks);
    const save=node('button','카테고리·링크 온라인 저장','primary');save.type='button';save.disabled=!ready;save.id='save-card-annotation';
    const status=node('p',ready?'태그는 최대 12개, 관련 카드는 20장까지. 저장한 분류는 다른 기기에서도 볼 수 있어.':'이메일 로그인 후 분류와 관련 카드 연결을 저장할 수 있어.','muted');status.id='annotation-status';status.setAttribute('role','status');box.append(save,status);
    save.addEventListener('click',async()=>{
      box.querySelectorAll('input,button').forEach(n=>n.disabled=true);status.textContent='분류를 저장하는 중…';
      try{
        const saved=await this.cloud.save(this.options.meta(),card,draft.tags,draft.links,expected);expected=saved.version;
        this.drafts.delete(card.identity_key);
        const dialog=box.closest('dialog'),top=save.getBoundingClientRect().top;
        this.renderFilters();this.options.changed({preservePage:true});renderHeading();
        box.querySelectorAll('input,button').forEach(n=>n.disabled=!this.ready());
        status.textContent='저장 완료 · 카테고리와 관련 카드 연결을 반영했어.';
        if(dialog)dialog.scrollTop+=save.getBoundingClientRect().top-top;
        this.options.toast('카테고리와 관련 카드 연결을 저장했어.');
      }
      catch(e){status.textContent=e.message;box.querySelectorAll('input,button').forEach(n=>n.disabled=!this.ready());}
    });renderLinks();info.append(box);
  }
}
