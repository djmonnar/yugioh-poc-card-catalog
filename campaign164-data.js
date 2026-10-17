import {cleanCampaignLibrary164,CAMPAIGN_LIBRARY_KIND164} from './campaign164-core.js?v=20261018-164';
export async function loadCampaign164({config,cards,fetcher=fetch}={}){
 const privateHost=!!(config&&typeof config.token==='string'&&config.token);
 const url=privateHost?'./api/roguelite164/campaign':'./data/campaign164.json?v=20261018-164';
 const response=await fetcher(url,{cache:'no-store',headers:privateHost?{'X-Rogue-Token':config.token}:{},signal:AbortSignal.timeout(privateHost?20000:10000)});
 let data;try{data=await response.json();}catch{throw Error('원정 구성을 읽지 못했어. 기존 진행은 유지돼.');}
 if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'원정 구성을 불러오지 못했어. 다시 연결해줘.');
 return cleanCampaignLibrary164(privateHost?(data.library??data):{schema:1,kind:CAMPAIGN_LIBRARY_KIND164,version:0,document:data,updated_at:null},cards);
}
