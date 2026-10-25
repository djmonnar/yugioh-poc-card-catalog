import {parseLibrary035,parseNative035,applyReferences035} from './native035-core.js?v=035-2';
export class NativeCloud035{
  constructor(client,index,options={}){this.client=client;this.index=index;this.options=options;}
  accept(value){const parsed=parseLibrary035(value,this.index,this.options);this.index=applyReferences035(parsed.references,this.index).index;this.options={...this.options,characterIds:new Set(parsed.references.characters.map(c=>c.id)),characterRows:parsed.references.characters};return parsed;}
  async load(){const r=await this.client.rpc('poc_load_native035_library');if(r.error)throw r.error;return this.accept(r.data);}
  async save(document,expected){if(!Number.isSafeInteger(expected)||expected<0)throw Error('온라인 버전을 먼저 확인해줘.');const d=parseNative035(document,this.index,this.options);const r=await this.client.rpc('poc_save_native035_library',{p_document:d,p_expected_version:expected});if(r.error)throw r.error;return this.accept(r.data);}
}
