export const MEDIA_EVENTS={start:'듀얼 시작',summon:'몬스터 소환',attack:'공격',activate:'효과 발동',damage:'피격·반응',win:'승리',lose:'패배',draw:'무승부'};
export function defaultPresentation(actor){
  const name=actor.name.normalize('NFKC').toLowerCase().replace(/\s/g,'');
  const builtin=['유희','어둠의유희','무토유희','유우기','어둠의유우기','yugi','yamiyugi','yugimuto','카이바','세토카이바','카이바세토','kaiba','setokaiba','조이','죠노우치','죠노우치카츠야','조노우치','조노우치카츠야','joey','joeywheeler','jonouchi'].includes(name);
  return {enabled:!!actor.portrait&&!builtin,portrait:true,events:{}};
}
export function safeMedia(v,kind='image'){
  if(typeof v!=='string'||v.length>1000||v.includes('..'))return false;
  if(v==='')return true;
  const ext=kind==='audio'?'wav':'(?:png|jpe?g|webp)';
  return new RegExp(`^(?:(?:assets|content-packs)/|https://[a-z]{20}\\.supabase\\.co/storage/v1/object/public/poc-story-assets/)[a-zA-Z0-9_./-]+\\.${ext}$`,'i').test(v);
}
export function parsePresentation(v){
  if(v===undefined)return undefined;
  const fail=()=>{throw new Error('캐릭터 컷신·음성 설정을 확인해줘.');};
  if(!v||typeof v!=='object'||typeof v.enabled!=='boolean'||typeof v.portrait!=='boolean'||!v.events||Array.isArray(v.events)||typeof v.events!=='object')fail();
  const events={};for(const [key,e] of Object.entries(v.events)){
    if(!Object.hasOwn(MEDIA_EVENTS,key)||!e||!safeMedia(e.image)||!safeMedia(e.audio,'audio'))fail();
    events[key]={image:e.image,audio:e.audio};
  }
  return {enabled:v.enabled,portrait:v.portrait,events};
}
export async function validateAudioFile(file){
  if(file.size>3*1024*1024)throw new Error('WAV는 3MB 이하로 골라줘.');
  const b=await file.arrayBuffer(),v=new DataView(b);
  const word=(a)=>String.fromCharCode(...new Uint8Array(b,a,4));
  if(b.byteLength<44||word(0)!=='RIFF'||word(8)!=='WAVE')throw new Error('PCM WAV 파일을 골라줘.');
  let fmt,data=0;for(let p=12;p+8<=b.byteLength;){const n=v.getUint32(p+4,true);if(p+8+n>b.byteLength)throw new Error('손상된 WAV야.');if(word(p)==='fmt '&&n>=16)fmt={kind:v.getUint16(p+8,true),channels:v.getUint16(p+10,true),rate:v.getUint32(p+12,true),block:v.getUint16(p+20,true),bits:v.getUint16(p+22,true)};if(word(p)==='data')data=n;p+=8+n+(n%2);}
  if(!fmt||fmt.kind!==1||![1,2].includes(fmt.channels)||![8,16].includes(fmt.bits)||![22050,44100,48000].includes(fmt.rate)||fmt.block!==fmt.channels*fmt.bits/8||!data||data/(fmt.rate*fmt.block)>12)throw new Error('12초 이하 PCM WAV(8/16bit, 모노/스테레오, 22050/44100/48000Hz)를 골라줘.');
}
