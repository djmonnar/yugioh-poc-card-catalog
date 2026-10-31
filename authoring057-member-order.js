const names057=values=>[...new Set((values??[]).filter(value=>typeof value==='string'&&value))];
const same057=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// Ordering belongs to this group's membership array. Other groups and the
// canonical category records are deliberately outside this editor's scope.
export function moveCategoryMember057(values,source,target,after=false){
  const next=names057(values);if(source===target||!next.includes(source)||!next.includes(target))return next;
  next.splice(next.indexOf(source),1);next.splice(next.indexOf(target)+(after?1:0),0,source);return next;
}

export function createCategoryMemberOrderEditor057({document:doc=globalThis.document,values=[],archived=[],disabled=false,editKey='category-members057',onChange=()=>{},onInteraction=()=>{}}={}){
  let names=names057(values),locked=disabled,drag=null;const archivedNames=new Set(archived),rows=new Map(),grips=new Map(),ups=new Map(),downs=new Map();
  const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=String(text);if(cls)node.className=cls;return node;};
  const root=el('section',null,'au-member-order057'),heading=el('h3','포함한 카테고리 순서'),list=el('ol',null,'au-member-order-list057'),live=el('p',null,'au-member-order-live057');
  list.setAttribute('aria-label','묶음 안 카테고리 순서');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
  root.append(heading,el('p','손잡이를 끌어 순서를 바꾸고 아래에서 변경 사항을 저장하세요. 카테고리 검색과 관계없이 전체 순서가 표시됩니다.','au-hint'),list,live);
  const button=(text,fn)=>{const node=el('button',text);node.type='button';node.onclick=fn;return node;};
  const announce=name=>live.textContent=`${name} · ${names.indexOf(name)+1}번째로 이동했습니다.`;
  function controls(){for(const [index,name] of names.entries()){grips.get(name).disabled=locked;grips.get(name).draggable=!locked;ups.get(name).disabled=locked||Boolean(drag)||index===0;downs.get(name).disabled=locked||Boolean(drag)||index===names.length-1;}}
  function show(){for(const [index,name] of names.entries()){const row=rows.get(name);row.style.order=String(index);if(!drag)list.append(row);row.querySelector('.au-member-order-position057').textContent=String(index+1);}controls();}
  function apply(next,name){if(locked)return;const before=names;names=next;show();if(!drag&&!same057(before,names)){onChange([...names]);announce(name);}}
  function move(name,target,after){apply(moveCategoryMember057(names,name,target,after),name);}
  function step(name,delta){if(locked||drag)return;const target=names[names.indexOf(name)+delta];if(target){move(name,target,delta>0);grips.get(name)?.focus({preventScroll:true});}}
  function finish(accepted){
    if(!drag)return;const previous=drag;drag=null;if(!accepted)names=previous.start;
    for(const [name,row] of rows){row.classList.remove('is-dragging');grips.get(name).setAttribute('aria-pressed','false');}show();
    if(accepted&&!same057(previous.start,names)){onChange([...names]);announce(previous.name);}onInteraction(false);
  }
  function begin(name,kind,pointerId){if(locked||drag)return false;drag={name,kind,pointerId,start:[...names]};rows.get(name).classList.add('is-dragging');grips.get(name).setAttribute('aria-pressed','true');controls();onInteraction(true);return true;}
  function moveAt(clientY){
    if(!drag||!Number.isFinite(clientY))return;const area=list.getBoundingClientRect?.();
    if(area&&area.height>0){if(clientY<area.top+28)list.scrollTop=Math.max(0,(list.scrollTop??0)-22);else if(clientY>area.bottom-28)list.scrollTop=(list.scrollTop??0)+22;}
    const visible=names.map(name=>({name,rect:rows.get(name)?.getBoundingClientRect?.()})).filter(row=>row.rect&&row.rect.height>0);if(!visible.length)return;
    const target=visible.find(row=>clientY<row.rect.bottom)??visible.at(-1);if(target.name!==drag.name)move(drag.name,target.name,clientY>=target.rect.top+target.rect.height/2);
  }
  function build(){
    list.replaceChildren();rows.clear();grips.clear();ups.clear();downs.clear();
    for(const name of names){
      const row=el('li',null,'au-member-order-row057');row.dataset.orderCategory=name;
      const grip=button('',()=>{});grip.className='au-member-order-grip057';grip.draggable=!locked;grip.dataset.editKey=`${editKey}.${name}.grip`;grip.setAttribute('aria-label',`${name} 카테고리 순서 이동`);grip.setAttribute('aria-pressed','false');grip.title='드래그하거나 방향키로 이동';
      const svg=doc.createElementNS?doc.createElementNS('http://www.w3.org/2000/svg','svg'):doc.createElement('svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('aria-hidden','true');
      for(const x of [8,16])for(const y of [5,12,19]){const dot=doc.createElementNS?doc.createElementNS('http://www.w3.org/2000/svg','circle'):doc.createElement('circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','1.6');dot.setAttribute('fill','currentColor');svg.append(dot);}grip.append(svg);
      const position=el('span',null,'au-member-order-position057');position.setAttribute('aria-hidden','true');const label=el('span',name,'au-member-order-label057');if(archivedNames.has(name))label.append(el('small','보관한 카테고리'));
      const up=button('위',()=>step(name,-1)),down=button('아래',()=>step(name,1));up.setAttribute('aria-label',`${name} 카테고리 위로 이동`);down.setAttribute('aria-label',`${name} 카테고리 아래로 이동`);up.className=down.className='au-member-order-step057';
      grip.onkeydown=event=>{if(event.key==='Escape'&&drag){event.preventDefault();finish(false);}else if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();step(name,event.key==='ArrowUp'?-1:1);}};
      grip.ondragstart=event=>{if(!begin(name,'html')){event.preventDefault();return;}event.dataTransfer?.setData('application/x-yugioh-category-member-order',name);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';};grip.ondragend=()=>finish(false);
      grip.onpointerdown=event=>{if(event.button!=null&&event.button!==0||event.isPrimary===false||!begin(name,'pointer',event.pointerId))return;event.preventDefault();grip.focus({preventScroll:true});grip.setPointerCapture?.(event.pointerId);};
      grip.onpointermove=event=>{if(drag?.kind==='pointer'&&drag.pointerId===event.pointerId){event.preventDefault();moveAt(event.clientY);}};
      grip.onpointerup=event=>{if(drag?.kind==='pointer'&&drag.pointerId===event.pointerId){event.preventDefault();moveAt(event.clientY);finish(true);grip.releasePointerCapture?.(event.pointerId);}};
      grip.onpointercancel=event=>{if(drag?.kind==='pointer'&&drag.pointerId===event.pointerId)finish(false);};grip.onlostpointercapture=()=>{if(drag?.kind==='pointer')finish(false);};
      row.append(grip,position,label,up,down);rows.set(name,row);grips.set(name,grip);ups.set(name,up);downs.set(name,down);
    }
    if(!names.length)list.append(el('li','아래에서 카테고리를 선택하면 순서를 바꿀 수 있습니다.','au-hint'));show();
  }
  list.ondragover=event=>{if(drag?.kind==='html'){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';moveAt(event.clientY);}};list.ondrop=event=>{if(drag?.kind==='html'){event.preventDefault();moveAt(event.clientY);finish(true);}};
  function setValues(next){const clean=names057(next);if(same057(names,clean))return;finish(false);names=clean;live.textContent='';build();}
  function setDisabled(value){locked=Boolean(value);if(locked)finish(false);controls();}
  build();return {root,setValues,setDisabled,isDragging:()=>Boolean(drag),values:()=>[...names]};
}
