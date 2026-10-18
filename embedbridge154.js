const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const envelope=(type,sessionId,nonce)=>({schema:152,kind:'expedition152',type,session_id:sessionId,...(nonce?{embed_nonce:nonce}:{})});

// This channel controls presentation only. Duel/result authority stays in the
// existing authenticated150 HTTP API and the native host.
export function createEmbedBridge152({sessionId,search=globalThis.location?.search||'',webview=globalThis.chrome?.webview,onState=()=>{},onResume=async()=>{},onStop=()=>{}}={}){
  const requested=new URLSearchParams(search).get('in_game')==='1',available=requested&&webview&&typeof webview.postMessage==='function'&&typeof webview.addEventListener==='function';
  let nonce=null,visible=false,connected=false,autoplay=false,disposed=false;const owners=new Set();
  const state=()=>({requested,available:Boolean(available),connected,visible,busy:owners.size>0,autoplay_allowed:autoplay});
  const emit=()=>onState(state());
  function post(type,extra={}){if(!available||disposed)return false;webview.postMessage({...envelope(type,sessionId,nonce),...extra});return true;}
  async function receive(event){
    const value=event.data;
    if(disposed||!value||typeof value!=='object'||value.schema!==152||value.kind!=='expedition152'||value.session_id!==sessionId)return;
    if(value.type==='handshake'){
      if(!uuid(value.embed_nonce)||nonce&&value.embed_nonce!==nonce||typeof value.autoplay_allowed!=='boolean')return;
      const first=!connected;nonce=value.embed_nonce;connected=true;autoplay=value.autoplay_allowed;emit();if(first)post('ready');return;
    }
    if(!connected||value.embed_nonce!==nonce||!['resume','hide','battle','close'].includes(value.type))return;
    if(value.type==='resume'){
      visible=true;emit();try{await onResume(state());}catch(error){onState({...state(),error:error.message});}return;
    }
    visible=false;onStop(value.type);emit();
  }
  if(available)webview.addEventListener('message',receive);
  return {
    state,announce(){emit();return post('ready');},
    setBusy(owner,value){const prior=owners.size>0;if(value)owners.add(owner);else owners.delete(owner);emit();if(connected&&prior!==(owners.size>0))post(owners.size?'busy':'idle');},
    requestClose(){if(!connected||owners.size)return false;visible=false;onStop('close');emit();return post('close');},
    diagnostics(value){if(connected)post('audio',value);},
    destroy(){disposed=true;visible=false;onStop('unload');if(available)webview.removeEventListener('message',receive);}
  };
}

export const AUDIO_SETTINGS152='yugioh-classic-expedition152-audio-v1';
export function mountGameAudio152({document=globalThis.document,storage=globalThis.localStorage,audioFactory=()=>document.createElement('audio'),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),onAudio=()=>{}}={}){
  let volume=.35,muted=false;
  try{const value=JSON.parse(storage.getItem(AUDIO_SETTINGS152)||'null');if(value&&Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1&&typeof value.muted==='boolean'){volume=value.volume;muted=value.muted;}}catch{}
  const audio=audioFactory();audio.loop=true;audio.preload='none';audio.volume=0;
  for(const [src,type]of [['assets/expedition152/tower_theme.ogg','audio/ogg'],['assets/expedition152/tower_theme.mp3','audio/mpeg']]){const source=document.createElement('source');source.src=src;source.type=type;audio.append(source);}
  audio.hidden=true;document.body.append(audio);
  const toggle=document.getElementById('audio152-toggle'),slider=document.getElementById('audio152-volume'),label=document.getElementById('audio152-label'),status=document.getElementById('audio152-status');
  let current={connected:false,visible:false,autoplay_allowed:false},frame=null,serial=0,blocked=false,disposed=false,pendingPlay=null;
  function paint(){toggle.textContent=muted?'음악 켜기':'음악 끄기';toggle.setAttribute('aria-pressed',String(!muted));slider.value=String(volume);label.textContent=muted?'음악 꺼짐':'음악';status.textContent=blocked?'음악 켜기를 눌러 들을 수 있어.':muted?'원정 음악을 껐어.':`음량 ${Math.round(volume*100)}%`;}
  function store(){try{storage.setItem(AUDIO_SETTINGS152,JSON.stringify({volume,muted}));}catch{}}
  function fade(){if(frame!==null)cancelFrame(frame);const start=performance.now(),initial=audio.volume;const tick=now=>{const ratio=Math.max(0,Math.min(1,(now-start)/700));audio.volume=Math.max(0,Math.min(1,initial+(volume-initial)*ratio));if(ratio<1&&!disposed)frame=requestFrame(tick);else frame=null;};frame=requestFrame(tick);}
  function pause(){serial++;if(frame!==null)cancelFrame(frame);frame=null;audio.pause();audio.volume=0;onAudio({state:'paused'});}
  async function play(userGesture=false){
    if(disposed||muted||!current.connected||!current.visible||!current.autoplay_allowed&&!userGesture){pause();paint();return;}
    if(!audio.paused){fade();paint();return;}if(pendingPlay)return pendingPlay;
    const generation=serial;
    try{pendingPlay=audio.play();await pendingPlay;if(generation!==serial||disposed||!current.visible){audio.pause();return;}blocked=false;fade();onAudio({state:'playing'});}
    catch{if(generation===serial){blocked=true;onAudio({state:'blocked'});}}
    finally{pendingPlay=null;if(generation!==serial&&!disposed&&!muted&&current.connected&&current.visible)play();}
    paint();
  }
  function sync(value){current=value;if(value.connected&&value.visible)play();else pause();paint();}
  toggle.addEventListener('click',()=>{if(blocked){muted=false;blocked=false;}else muted=!muted;store();if(muted)pause();else play(true);paint();});
  slider.addEventListener('input',()=>{volume=Number(slider.value);store();if(!audio.paused)fade();paint();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(current.visible)play();});
  paint();return {sync,pause,destroy(){disposed=true;pause();audio.remove();}};
}
