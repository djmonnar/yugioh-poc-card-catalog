// Local static server for checking the studio UI without a real login.
//
//   node scripts/serve-local.mjs [--port 8170]
//   → http://127.0.0.1:8170/index.html?preview=local   (add &reset=1 to restart the fake DB)
//
// Binds to 127.0.0.1 only. The page switches to the synthetic preview client only
// on localhost with ?preview=local; /__preview170/seed.json exists only here.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {previewSeed170} from './preview170-seed.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),portIndex=args.indexOf('--port'),port=portIndex>=0?Number(args[portIndex+1]):8170;
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Usage: node scripts/serve-local.mjs [--port 1024-65535]');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
let seedText=null;
const seed=async()=>seedText??=JSON.stringify(await previewSeed170(root));

const server=createServer(async(request,response)=>{
  try{
    const url=new URL(request.url,'http://127.0.0.1');
    if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405).end();return;}
    if(url.pathname==='/__preview170/seed.json'){response.writeHead(200,{'Content-Type':types['.json'],'Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:await seed());return;}
    let relative=decodeURIComponent(url.pathname);if(relative.endsWith('/'))relative+='index.html';
    const file=path.resolve(root,'.'+relative);
    if(!file.startsWith(path.resolve(root)+path.sep)||relative.split('/').some(part=>part.startsWith('.')&&part!=='.')||relative.includes('/node_modules/')){response.writeHead(404).end();return;}
    const info=await stat(file).catch(()=>null);if(!info?.isFile()){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()]??'application/octet-stream','Cache-Control':'no-cache'});
    response.end(request.method==='HEAD'?undefined:await readFile(file));
  }catch(error){response.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'}).end(String(error?.message??error));}
});
server.listen(port,'127.0.0.1',async()=>{
  await seed();
  console.log(`원정 제작소 로컬 미리보기: http://127.0.0.1:${port}/index.html?preview=local`);
  console.log('합성 자료만 사용합니다. 실제 DB에 연결하지 않습니다. 끝내려면 Ctrl+C.');
});
