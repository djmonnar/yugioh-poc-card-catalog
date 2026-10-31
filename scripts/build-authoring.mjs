import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,brotliCompressSync} from 'node:zlib';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--check'))throw new Error('Usage: node scripts/build-authoring.mjs [--check]');
const check=args.includes('--check');

// Query versions are cache keys for the unbundled browser modules. Resolve the
// same local source once when two legacy importers use different cache keys.
const localVersionImports={
  name:'local-version-imports',
  setup(build){
    build.onResolve({filter:/\?v=/},args=>{
      const match=/^(\.{1,2}\/[^?#]+)\?v=[^&#]*$/.exec(args.path);
      if(match)return {path:path.resolve(args.resolveDir,match[1])};
    });
  }
};

const result=await build({
  absWorkingDir:projectRoot,
  entryPoints:['app.js'],
  outfile:'assets/authoring/app.js',
  bundle:true,
  format:'esm',
  platform:'browser',
  target:['es2022'],
  minify:true,
  legalComments:'eof',
  banner:{js:'/*! Includes @supabase/supabase-js 2.117.2. MIT license: SUPABASE-LICENSE. */'},
  plugins:[localVersionImports],
  metafile:true,
  write:false
});
if(Object.values(result.metafile.outputs).some(output=>output.imports.length))throw new Error('The authoring bundle must not request additional JavaScript modules.');

const license=await readFile(path.join(projectRoot,'assets/cloud/SUPABASE-LICENSE'));
const outputs=[...result.outputFiles,{path:path.join(projectRoot,'assets/authoring/SUPABASE-LICENSE'),contents:license}];
for(const output of outputs){
  if(check){
    let current;
    try{current=await readFile(output.path);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!current?.equals(Buffer.from(output.contents)))throw new Error(`${path.relative(projectRoot,output.path)} is missing or stale. Run npm run build:authoring.`);
  }else{
    await mkdir(path.dirname(output.path),{recursive:true});
    await writeFile(output.path,output.contents);
  }
}
const bundle=result.outputFiles[0].contents;
console.log(JSON.stringify({mode:check?'verified':'built',modules:Object.keys(result.metafile.inputs).length,javascriptRequests:1,bytes:bundle.length,gzipBytes:gzipSync(bundle).length,brotliBytes:brotliCompressSync(bundle).length}));
