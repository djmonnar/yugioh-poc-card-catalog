import {createAuthoringFixture039} from './authoring-fixture039.js';
export function fixture041(){return createAuthoringFixture039();}

export class Node041 {
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.nodeName=this.tagName;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.listeners={};this._text='';this._value=null;this.className='';this.hidden=false;this.disabled=false;this.open=false;this.style={};if(tag==='textarea')Object.defineProperty(this,'type',{get:()=> 'textarea'});}
  get parentElement(){return this.parentNode??null;}get isConnected(){return this===this.ownerDocument?.body||this.ownerDocument?.body.contains(this)===true;}
  set textContent(value){this.replaceChildren();this._text=String(value??'');}get textContent(){return this._text+this.children.map(n=>n.textContent??'').join('');}
  set value(value){this._value=String(value??'');}get value(){return this._value??(this.tagName==='SELECT'?this.options.find(o=>!o.disabled)?.value??'':'');}
  get options(){return this.querySelectorAll('option');}get selectedOptions(){return this.options.filter(o=>o.value===this.value);}get lastChild(){return this.children.at(-1);}
  get classList(){return {add:value=>{const list=new Set(this.className.split(/\s+/).filter(Boolean));list.add(value);this.className=[...list].join(' ');},remove:value=>this.className=this.className.split(/\s+/).filter(v=>v!==value).join(' '),contains:value=>this.className.split(/\s+/).includes(value),toggle:(value,on)=>{const list=new Set(this.className.split(/\s+/).filter(Boolean));if(on??!list.has(value))list.add(value);else list.delete(value);this.className=[...list].join(' ');}};}
  contains(other){return this===other||this.children.some(child=>child.contains(other));}
  append(...nodes){for(let node of nodes){if(typeof node==='string')node=this.ownerDocument.createTextNode(node);if(node.tagName==='#FRAGMENT'){this.append(...[...node.children]);continue;}if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(n=>n!==node);node.parentNode=this;this.children.push(node);}}
  prepend(node){if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(n=>n!==node);node.parentNode=this;this.children.unshift(node);}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.children=[];this._text='';this.append(...nodes);}
  insertBefore(node,before){if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(n=>n!==node);node.parentNode=this;const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,node);}
  remove(){const doc=this.ownerDocument;if(this.contains(doc?.activeElement))doc.activeElement=doc.body;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='id')this.id=String(value);if(key==='tabindex')this.tabIndex=Number(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  getAttribute(key){return this.attributes[key]??null;}removeAttribute(key){delete this.attributes[key];}hasAttribute(key){return Object.hasOwn(this.attributes,key);}
  addEventListener(name,fn,options){(this.listeners[name]??=[]).push({fn,capture:options===true||options?.capture===true});}
  removeEventListener(name,fn){this.listeners[name]=(this.listeners[name]??[]).filter(row=>row.fn!==fn);}
  fire(name,props={}){const event={type:name,target:this,currentTarget:this,bubbles:!['focus','blur'].includes(name),defaultPrevented:false,cancelBubble:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.cancelBubble=true;},...props};const path=[];for(let node=this;node;node=node.parentNode)path.push(node);if(!path.includes(this.ownerDocument))path.push(this.ownerDocument);const invoke=(node,capture)=>{event.currentTarget=node;for(const row of [...(node?.listeners?.[name]??[])])if(row.capture===capture)row.fn(event);if(!capture)node?.['on'+name]?.(event);};for(const node of [...path].reverse()){invoke(node,true);if(event.cancelBubble)return event;}invoke(this,false);if(event.bubbles)for(const node of path.slice(1)){invoke(node,false);if(event.cancelBubble)break;}return event;}
  focus(){if(this.disabled)return;const doc=this.ownerDocument,previous=doc.activeElement;if(previous===this)return;doc.activeElement=this;previous?.fire('blur',{relatedTarget:this});previous?.fire('focusout',{relatedTarget:this});this.fire('focus',{relatedTarget:previous});this.fire('focusin',{relatedTarget:previous});}
  blur(){this.ownerDocument.body.focus();}click(){if(this.disabled)return;this.focus();this.fire('click');}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
  showModal(){this.open=true;}close(){this.open=false;this.fire('close');}
  matches(selector){return selector.split(',').some(raw=>{const value=raw.trim();if(value==='[data-edit-key]')return this.dataset.editKey!==undefined;if(value==='input:checked')return this.tagName==='INPUT'&&this.checked;const attr=/^\[([\w-]+)(?:=["']?(.*?)["']?)?\]$/.exec(value);if(attr)return attr[2]===undefined?this.hasAttribute(attr[1]):this.getAttribute(attr[1])===attr[2];if(value.startsWith('.'))return this.classList.contains(value.slice(1));if(value.startsWith('#'))return this.id===value.slice(1);return this.tagName===value.toUpperCase();});}
  closest(selector){for(let node=this;node;node=node.parentNode)if(node.matches?.(selector))return node;return null;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
export class Document041 extends Node041 {
  constructor(){super('#document',null);this.ownerDocument=this;this.body=new Node041('body',this);this.append(this.body);this.activeElement=this.body;}
  createElement(tag){return new Node041(tag,this);}createTextNode(value){const node=new Node041('#text',this);node._text=String(value);return node;}createDocumentFragment(){return new Node041('#fragment',this);}getElementById(id){return this.querySelectorAll('#'+id)[0]??null;}
}
export const field041=(root,label)=>root.querySelectorAll('input,select,textarea').find(node=>node.getAttribute('aria-label')===label);
export const button041=(root,label)=>root.querySelectorAll('button').find(node=>node.textContent===label);
