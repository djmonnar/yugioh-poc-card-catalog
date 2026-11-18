import {createClient} from './assets/cloud/supabase-client.js?v=2.117.2';
import {validateCloudConfig} from './supabase-cloud.js?v=20261008-70';
import {AuthoringStore039} from './authoring039-store.js?v=20261102-068';
import {mountAuthoringShell039} from './authoring039-shell.js?v=20261102-068';
import {createDraftBackup170} from './authoring170-drafts.js';
import {createHistorySource170} from './authoring170-history.js';
import {localPreview170,createPreviewClient170} from './authoring170-preview.js';

const root=document.getElementById('authoring-root');
async function previewClient170(storage){
  // Only reachable on localhost/127.0.0.1/[::1] with ?preview=local; the seed exists only on scripts/serve-local.mjs.
  const response=await fetch('./__preview170/seed.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('로컬 미리보기 자료가 없습니다. 저장소 폴더에서 node scripts/serve-local.mjs로 실행해 주세요.');
  const url=new URL(window.location.href),reset=url.searchParams.get('reset')==='1';
  if(reset){url.searchParams.delete('reset');window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
  return createPreviewClient170({seed:await response.json(),storage,reset});
}
async function start(){
  try{
    let storage=null;try{storage=window.localStorage;}catch{/* Recovery storage is optional; the DB remains authoritative. */}
    const preview=localPreview170(window.location.href);
    let client;
    if(preview){client=await previewClient170(storage);window.preview170={remoteEdit:(type,id,fields)=>client.remoteEdit170(type,id,fields)};}
    else{
      const response=await fetch('./data/cloud-config.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('DB 연결 설정을 불러오지 못했습니다.');
      const config=validateCloudConfig(await response.json());client=createClient(config.url,config.publishable_key,{auth:{storageKey:'poc-ai-editor-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options)=>fetch(url,{...options,signal:options?.signal||AbortSignal.timeout(20000)})}});
    }
    const store=new AuthoringStore039({client,storage});
    const loadingMessage=root.querySelector('.au-loading p');if(loadingMessage)loadingMessage.textContent='저장된 카드와 편집 자료를 불러오고 있습니다…';
    const uploadAsset=async image=>{if(!store.snapshot().canEdit)throw Error('편집 계정으로 로그인해 주세요.');if(!image||image.size>3*1024*1024||!['image/png','image/jpeg','image/webp'].includes(image.type))throw Error('PNG·JPEG·WebP, 3MB 이하 이미지를 골라 주세요.');const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image.type],path=`portraits/${crypto.randomUUID()}.${ext}`,bucket=client.storage.from('poc-story-assets'),reply=await bucket.upload(path,image,{contentType:image.type,upsert:false});if(reply.error)throw reply.error;return bucket.getPublicUrl(path).data.publicUrl;};
    let session=null;try{session=window.sessionStorage;}catch{/* Unsaved edits remain in memory when session storage is unavailable. */}
    // Live drafts stay per tab (sessionStorage); a per-tab copy in localStorage lets a closed tab offer a restore.
    const draftBackup170=createDraftBackup170({session,local:storage});
    window.addEventListener('pagehide',()=>draftBackup170.markClosed());window.setInterval(()=>draftBackup170.heartbeat(),20000);
    const history170=createHistorySource170({storage});
    mountAuthoringShell039({root,store,uploadAsset,manualSave:true,draftStorage:draftBackup170.storage,draftBackup170,history170,preview170:preview});await store.start();
  }catch(error){
    if(root.querySelector('.au-app'))return;
    const box=document.createElement('section');box.className='au-loading';const title=document.createElement('h1');title.textContent='원정 제작소';const message=document.createElement('p');message.textContent=error.message||'DB 연결을 확인해 주세요.';const retry=document.createElement('button');retry.type='button';retry.textContent='다시 연결';retry.onclick=()=>window.location.reload();box.append(title,message,retry);root.replaceChildren(box);
  }
}
start();
