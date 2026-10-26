// A Korean IME owns its live DOM node until editing finishes. Restoring focus
// after replacing an input cannot restore the keyboard's composition session.
export function editableControl041(node){
  if(!node||node.disabled||node.readOnly)return false;
  if(node.tagName==='TEXTAREA')return true;
  return node.tagName==='INPUT'&&!['button','submit','reset','checkbox','radio','range','file','hidden','color'].includes(String(node.type??'text').toLowerCase());
}
function within(root,node){
  if(!root||!node)return false;
  if(typeof root.contains==='function')return root.contains(node);
  for(let n=node;n;n=n.parentElement??n.parentNode)if(n===root)return true;
  return false;
}

export function createEditingGuard041({document:doc,getRoots,onEditingChange=()=>{},setTimeout:schedule=globalThis.setTimeout,clearTimeout:cancel=globalThis.clearTimeout}={}){
  let pending=null,timer=null,pointerDown=false,disposed=false,editing=false,protectedControl=null;
  const composing=new WeakSet(),bound=new WeakSet(),listeners=[];
  const owns=node=>getRoots().some(root=>within(root,node));
  const active=()=>owns(doc.activeElement)&&editableControl041(doc.activeElement)?doc.activeElement:null;
  function signal(){const next=!!active();if(next!==editing){editing=next;onEditingChange(next);}}
  function flush(){
    timer=null;if(disposed||pointerDown)return;
    const target=active();if(target&&(composing.has(target)||target===protectedControl))return;
    const render=pending;pending=null;if(render)render();signal();
  }
  function later(delay=0){if(disposed)return;cancel(timer);timer=schedule(flush,delay);}
  function focus(){signal();}
  function blur(){signal();later();}
  function compositionStart(event){if(owns(event.target)){composing.add(event.target);signal();}}
  function compositionEnd(event){composing.delete(event.target);signal();}
  function listen(target,name,handler,options){if(!target?.addEventListener)return;target.addEventListener(name,handler,options);listeners.push(()=>target.removeEventListener?.(name,handler,options));}
  // Capture covers ad-hoc search/registration inputs as well as schema fields.
  listen(doc,'focusin',focus,true);listen(doc,'focusout',blur,true);
  listen(doc,'compositionstart',compositionStart,true);listen(doc,'compositionend',compositionEnd,true);
  listen(doc,'pointerdown',event=>{if(owns(event.target))pointerDown=true;},true);
  listen(doc,'pointerup',()=>{if(pointerDown){pointerDown=false;later(120);}},true);
  listen(doc,'pointercancel',()=>{pointerDown=false;later();},true);
  // Flush after the tapped button's handler, never between touch-down and click.
  listen(doc,'click',()=>{pointerDown=false;later();},false);
  return {
    defer(render,{force=false}={}){
      if(disposed)return false;
      if(!force&&active()){pending=render;protectedControl=active();signal();return true;}
      pending=null;protectedControl=null;cancel(timer);timer=null;return false;
    },
    bind(control){
      if(bound.has(control))return;bound.add(control);
      // Direct listeners also make detached form fixtures and non-bubbling blur
      // events behave consistently; document capture handles ordinary fields.
      control.addEventListener('focus',focus);control.addEventListener('blur',blur);
      control.addEventListener('compositionstart',compositionStart);control.addEventListener('compositionend',compositionEnd);
    },
    isComposing:control=>composing.has(control),
    refreshSignal:signal,
    dispose(){disposed=true;pending=null;cancel(timer);for(const off of listeners)off();if(editing)onEditingChange(false);}
  };
}
