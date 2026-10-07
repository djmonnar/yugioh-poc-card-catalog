import {cloudError} from './supabase-cloud.js?v=20261006-13';
export const PRICES={L:[0,0],UR:[300,150],SR:[200,100],R:[100,50],N:[50,25]};
export function settingsRows(value){
  if(!Array.isArray(value)||value.length>1110)throw new Error('카드 설정 자료를 확인할 수 없어.');
  const seen=new Set();for(const row of value){if(!row||!Number.isInteger(row.slot)||row.slot<1||row.slot>2047||!Number.isInteger(row.internal_id)||! /^[a-f0-9]{64}$/.test(row.identity_key)||!PRICES[row.rarity]||typeof row.stock!=='boolean'||(row.draw_enabled!=null&&typeof row.draw_enabled!=='boolean')||!Number.isSafeInteger(row.version)||row.version<1||seen.has(row.slot)||(row.rarity==='L'&&(row.stock||row.draw_enabled!==false)))throw new Error('카드 설정을 확인할 수 없어.');seen.add(row.slot);}return value;
}
export function applySettings(cards,rows){
  settingsRows(rows);const bySlot=new Map(cards.map(c=>[c.slot,c]));let count=0;
  for(const row of rows){const c=bySlot.get(row.slot);if(!c||c.special||c.identity_key!==row.identity_key||c.internal_id!==row.internal_id)continue;[c.buy_price,c.sell_price]=PRICES[row.rarity];c.rarity=row.rarity;c.stock=row.stock;c.draw_enabled=row.draw_enabled??true;c.sell_enabled=row.rarity!=='L';c.rarity_reason='도감에서 직접 저장한 등급';count++;}
  for(const c of cards)for(const material of c.fusion_materials||[]){const target=bySlot.get(material.slot);if(target?.identity_key===material.identity_key)material.shop_stock=target.stock;}
  return count;
}
export class CardSettingsCloud{
  constructor(client){this.client=client;this.rows=null;}
  async load(){const {data,error}=await this.client.rpc('poc_load_card_settings');if(error)throw error;this.rows=settingsRows(data);return this.rows;}
  version(card){if(this.rows===null)throw new Error('온라인 설정을 먼저 불러와야 해.');return this.rows.find(r=>r.slot===card.slot&&r.identity_key===card.identity_key)?.version??0;}
  async save(meta,card,rarity,stock,expectedVersion,drawEnabled=card.draw_enabled??true){
    if(!PRICES[rarity]||typeof stock!=='boolean'||card.special||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('카드 설정을 확인해줘.');
    if(typeof drawEnabled!=='boolean')throw new Error('뽑기 포함 여부를 확인해줘.');
    const {data,error}=await this.client.rpc('poc_save_card_setting_v2',{p_dataset:meta.dataset_id,p_slot:card.slot,p_identity_key:card.identity_key,p_rarity:rarity,p_stock:rarity==='L'?false:stock,p_expected_version:expectedVersion,p_draw_enabled:rarity==='L'?false:drawEnabled});if(error)throw new Error(cloudError(error).replace('이 덱','이 카드 설정').replace('온라인 덱','온라인 설정'));
    const saved=settingsRows([data])[0];if(saved.slot!==card.slot||saved.identity_key!==card.identity_key||saved.internal_id!==card.internal_id)throw new Error('카드가 현재 도감과 달라.');
    this.rows=[...(this.rows||[]).filter(r=>r.slot!==saved.slot),saved];return saved;
  }
}
