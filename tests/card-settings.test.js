import test from 'node:test';import assert from 'node:assert/strict';
import {CardSettingsCloud,applySettings,settingsRows} from '../card-settings.js';
const card={slot:316,internal_id:1,identity_key:'a'.repeat(64),rarity:'SR',stock:false};
const setting={...card,rarity:'UR',stock:true,version:3};
test('card settings change prices and stock together without changing card identity',()=>{
 const cards=[structuredClone(card)];assert.equal(applySettings(cards,[setting]),1);assert.deepEqual([cards[0].rarity,cards[0].stock,cards[0].buy_price,cards[0].sell_price],['UR',true,300,150]);assert.equal(cards[0].identity_key,card.identity_key);
 applySettings(cards,[{...setting,rarity:'N',stock:false,version:4}]);assert.deepEqual([cards[0].stock,cards[0].buy_price,cards[0].sell_price],[false,50,25]);
});
test('replaced cards and tokens cannot inherit old shop settings',()=>{const cards=[{...card,identity_key:'b'.repeat(64)}];assert.equal(applySettings(cards,[setting]),0);assert.equal(cards[0].rarity,'SR');assert.equal(applySettings([{...card,special:true}],[setting]),0);});
test('duplicate slots, unknown tiers and nonboolean stock fail before overlaying',()=>{for(const rows of [[setting,setting],[{...setting,rarity:'XX'}],[{...setting,stock:1}]])assert.throws(()=>settingsRows(rows));});
test('card save passes the displayed version and leaves the old settings on conflict',async()=>{
 const calls=[],cloud=new CardSettingsCloud({rpc:async(name,args)=>{calls.push([name,args]);return name==='poc_load_card_settings'?{data:[setting]}:{error:{message:'poc_conflict'}};}});
 assert.throws(()=>cloud.version(card));await cloud.load();await assert.rejects(cloud.save({dataset_id:'dataset'},card,'R',false,cloud.version(card)),/다른 기기/);assert.equal(calls[1][1].p_expected_version,3);assert.equal(cloud.rows[0].rarity,'UR');
});
test('legend settings enforce no stock/draw; the draw toggle preserves fixed reward eligibility',()=>{
 const cards=[{...card,reward_eligible:true}];
 applySettings(cards,[{...setting,rarity:'L',stock:false,draw_enabled:false}]);
 assert.deepEqual([cards[0].rarity,cards[0].stock,cards[0].draw_enabled,cards[0].sell_enabled,cards[0].buy_price,cards[0].sell_price],['L',false,false,false,0,0]);
 assert.equal(cards[0].reward_eligible,true);
 applySettings(cards,[{...setting,draw_enabled:false}]);assert.equal(cards[0].draw_enabled,false);
 applySettings(cards,[{...setting,draw_enabled:true}]);assert.equal(cards[0].draw_enabled,true);
 for(const row of [{...setting,rarity:'L'},{...setting,rarity:'L',stock:false,draw_enabled:true},{...setting,draw_enabled:1}])assert.throws(()=>settingsRows([row]));
});
test('legend save uses the new RPC and forces stock/draw false',async()=>{
 const calls=[],cloud=new CardSettingsCloud({rpc:async(name,args)=>{calls.push([name,args]);return {data:{...setting,rarity:'L',stock:false,draw_enabled:false,version:4}};}});
 await cloud.save({dataset_id:'dataset'},card,'L',true,3,true);
 assert.equal(calls[0][0],'poc_save_card_setting_v2');assert.equal(calls[0][1].p_stock,false);assert.equal(calls[0][1].p_draw_enabled,false);
});
