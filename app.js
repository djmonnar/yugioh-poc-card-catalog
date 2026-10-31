import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig} from './supabase-cloud.js?v=20261008-70';
import {AuthoringStore039} from './authoring039-store.js?v=20261031-060';
import {mountAuthoringShell039} from './authoring039-shell.js?v=20261031-060';

const root=document.getElementById('authoring-root');
async function start(){
  try{
    const response=await fetch('./data/cloud-config.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('DB 연결 설정을 불러오지 못했습니다.');
    const config=validateCloudConfig(await response.json()),client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(20000)})}});
    let storage=null;try{storage=window.localStorage;}catch{/* Recovery storage is optional; the DB remains authoritative. */}
    const store=new AuthoringStore039({client,storage});
    const uploadAsset=async image=>{if(!store.snapshot().canEdit)throw Error('편집 계정으로 로그인해 주세요.');if(!image||image.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(image.type))throw Error('PNG·JPEG·WebP, 3MB 이하 이미지를 골라 주세요.');const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image.type],path=`portraits/${crypto.randomUUID()}.${ext}`,bucket=client.storage.from('poc-story-assets'),reply=await bucket.upload(path,image,{contentType:image.type,upsert:false});if(reply.error)throw reply.error;return bucket.getPublicUrl(path).data.publicUrl;};
    let draftStorage=null;try{draftStorage=window.sessionStorage;}catch{/* Unsaved edits remain in memory when session storage is unavailable. */}
    mountAuthoringShell039({root,store,uploadAsset,manualSave:true,draftStorage});await store.start();
  }catch(error){
    if(root.querySelector('.au-app'))return;
    const box=document.createElement('section');box.className='au-loading';const title=document.createElement('h1');title.textContent='원정 제작소';const message=document.createElement('p');message.textContent=error.message||'DB 연결을 확인해 주세요.';const retry=document.createElement('button');retry.type='button';retry.textContent='다시 연결';retry.onclick=()=>window.location.reload();box.append(title,message,retry);root.replaceChildren(box);
  }
}
start();
