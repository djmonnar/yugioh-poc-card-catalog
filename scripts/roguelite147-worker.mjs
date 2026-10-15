import {createInterface} from 'node:readline';
import {transition147} from '../roguelite147-progress.js';
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of lines){
  try{
    if(Buffer.byteLength(line,'utf8')>12_000_000)throw new Error('원정 명령 자료가 너무 커.');
    const run=transition147(JSON.parse(line));
    process.stdout.write(JSON.stringify({ok:true,run,attempt:run.bridge147.attempt,status:run.bridge147.phase})+'\n');
  }catch(error){process.stdout.write(JSON.stringify({ok:false,error:error.message||'원정 명령을 처리하지 못했어.'})+'\n');}
}
