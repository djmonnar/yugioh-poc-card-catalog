export function boundedPage(value, pages) {
  const last=Math.max(1, Math.trunc(Number(pages)) || 1), requested=Number(value);
  return Number.isFinite(requested) ? Math.max(1, Math.min(last, Math.trunc(requested))) : 1;
}

export function pageWindow(page, pages, radius=2) {
  const last=Math.max(1, Math.trunc(Number(pages)) || 1), current=boundedPage(page,last);
  const numbers=new Set([1,last]);
  for(let n=Math.max(1,current-radius);n<=Math.min(last,current+radius);n++)numbers.add(n);
  const result=[];
  for(const n of [...numbers].sort((a,b)=>a-b)) {
    const previous=result.at(-1);
    if(typeof previous==='number' && n-previous>1)result.push(null);
    result.push(n);
  }
  return result;
}

export function renderPagination(nav, page, pages, change) {
  const last=Math.max(1,pages), current=boundedPage(page,last);
  const controls=document.createElement('div');controls.className='page-buttons';
  function button(text, target, label, disabled=false) {
    const b=document.createElement('button');b.type='button';b.textContent=text;
    b.setAttribute('aria-label',label);b.disabled=disabled;
    b.addEventListener('click',()=>change(boundedPage(target,last)));return b;
  }
  controls.append(button('←',current-1,'이전 페이지',current===1));
  for(const n of pageWindow(current,last,matchMedia('(max-width:520px)').matches?1:2)) {
    if(n===null) {const dots=document.createElement('span');dots.textContent='…';dots.setAttribute('aria-hidden','true');controls.append(dots);continue;}
    const b=button(String(n),n,`${n}페이지`);
    if(n===current){b.className='active';b.setAttribute('aria-current','page');}
    controls.append(b);
  }
  controls.append(button('→',current+1,'다음 페이지',current===last));
  const jump=document.createElement('form');jump.className='page-jump';
  const label=document.createElement('label');label.htmlFor=nav.id+'-jump';label.textContent=`${current} / ${last} 페이지`;
  const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='1';input.max=String(last);input.step='1';input.value=String(current);input.id=label.htmlFor;input.required=true;input.setAttribute('aria-label','이동할 페이지 번호');
  const submit=document.createElement('button');submit.type='submit';submit.textContent='이동';
  jump.addEventListener('submit',event=>{event.preventDefault();if(input.checkValidity())change(boundedPage(input.value,last));});
  jump.append(label,input,submit);nav.replaceChildren(controls,jump);
}
