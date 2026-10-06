import {cloudError} from './supabase-cloud.js?v=20261006-13';
export const PRICES={UR:[300,150],SR:[200,100],R:[100,50],N:[50,25]};
export function settingsRows(value){
  if(!Array.isArray(value)||value.length>1110)throw new Error('카드 설정 자료를 확인할 수 없어.');
  const seen=new Set();for(const row of value){if(!row||!Number.isInteger(row.slot)||row.slot<1||row.slot>2047||!Number.isInteger(row.internal_id)||! /^[a-f0-9]{64}$/.test(row.identity_key)||!PRICES[row.rarity]||typeof row.stock!=='boolean'||!Number.isSafeInteger(row.version)||row.version<1||seen.has(row.slot))throw new Error('카드 설정을 확인할 수 없어.');seen.add(row.slot);}return value;
}
export function applySettings(cards,rows){
  settingsRows(rows);const bySlot=new Map(cards.map(c=>[c.slot,c]));let count=0;
  for(const row of rows){const c=bySlot.get(row.slot);if(!c||c.special||c.identity_key!==row.identity_key||c.internal_id!==row.internal_id)continue;[c.buy_price,c.sell_price]=PRICES[row.rarity];c.rarity=row.rarity;c.stock=row.stock;c.rarity_reason='도감에서 직접 저장한 등급';count++;}
  for(const c of cards)for(const material of c.fusion_materials||[]){const target=bySlot.get(material.slot);if(target?.identity_key===material.identity_key)material.shop_stock=target.stock;}
  return count;
}
export class CardSettingsCloud{
  constructor(client){this.client=client;this.rows=null;}
  async load(){const {data,error}=await this.client.rpc('poc_load_card_settings');if(error)throw error;this.rows=settingsRows(data);return this.rows;}
  version(card){if(this.rows===null)throw new Error('온라인 설정을 먼저 불러와야 해.');return this.rows.find(r=>r.slot===card.slot&&r.identity_key===card.identity_key)?.version??0;}
  async save(meta,card,rarity,stock,expectedVersion){
    if(!PRICES[rarity]||typeof stock!=='boolean'||card.special||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('카드 설정을 확인해줘.');
    const {data,error}=await this.client.rpc('poc_save_card_setting',{p_dataset:meta.dataset_id,p_slot:card.slot,p_identity_key:card.identity_key,p_rarity:rarity,p_stock:stock,p_expected_version:expectedVersion});if(error)throw new Error(cloudError(error).replace('이 덱','이 카드 설정').replace('온라인 덱','온라인 설정'));
    const saved=settingsRows([data])[0];if(saved.slot!==card.slot||saved.identity_key!==card.identity_key||saved.internal_id!==card.internal_id)throw new Error('카드가 현재 도감과 달라.');
    this.rows=[...(this.rows||[]).filter(r=>r.slot!==saved.slot),saved];return saved;
  }
}
