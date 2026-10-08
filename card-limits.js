import {cloudError} from './supabase-cloud.js?v=20261006-13';
const bases=new WeakMap();
export function limitRows(rows){
  if(!Array.isArray(rows)||rows.length>2047)throw new Error('금제 자료를 확인할 수 없어.');
  const seen=new Set();for(const r of rows){
    if(!r||!Number.isInteger(r.slot)||r.slot<1||r.slot>2047||seen.has(r.slot)||!Number.isInteger(r.internal_id)||! /^[a-f0-9]{64}$/.test(r.identity_key)||!Number.isSafeInteger(r.version)||r.version<1||![null,0,1,2,3].includes(r.normal_limit)||![null,-1,0,1,2,3].includes(r.speed_limit))throw new Error('금제 설정을 확인할 수 없어.');seen.add(r.slot);
  }return rows;
}
export function applyLimits(cards,rows){
  limitRows(rows);const by=new Map(cards.map(c=>[c.slot,c]));let count=0;
  for(const c of cards){if(!bases.has(c))bases.set(c,{normal:c.deck_limit,speed:c.speed_limit});const b=bases.get(c);c.deck_limit=b.normal;c.speed_limit=b.speed;}
  for(const r of rows){const c=by.get(r.slot);if(!c||c.special||c.internal_id!==r.internal_id||c.identity_key!==r.identity_key)continue;
    if(r.normal_limit!==null)c.deck_limit=r.normal_limit;
    if(r.speed_limit!==null)c.speed_limit=r.speed_limit===-1?null:r.speed_limit;count++;
  }return count;
}
export function speedLimitName(card){return card.speed_limit==null?'스피드 · 제한 없음':card.speed_limit===0?'스피드 · 금지':`스피드 · 제한 ${card.speed_limit} 그룹`;}
export class CardLimitsCloud{
  constructor(client){this.client=client;this.rows=null;}
  async load(){const {data,error}=await this.client.rpc('poc_load_card_limits');if(error)throw error;return this.rows=limitRows(data);}
  row(card){return this.rows?.find(r=>r.slot===card.slot&&r.identity_key===card.identity_key);}
  async save(meta,card,normal,speed){
    if(this.rows===null||card.special||![null,0,1,2,3].includes(normal)||![null,-1,0,1,2,3].includes(speed))throw new Error('금제 설정을 확인해줘.');
    const {data,error}=await this.client.rpc('poc_save_card_limit',{p_dataset:meta.dataset_id,p_slot:card.slot,p_identity_key:card.identity_key,p_normal_limit:normal,p_speed_limit:speed,p_expected_version:this.row(card)?.version??0});
    if(error)throw new Error(cloudError(error));const r=limitRows([data])[0];
    if(r.slot!==card.slot||r.identity_key!==card.identity_key||r.internal_id!==card.internal_id)throw new Error('현재 카드와 다른 금제 설정이야.');
    this.rows=[...this.rows.filter(v=>v.slot!==r.slot),r];return r;
  }
}
