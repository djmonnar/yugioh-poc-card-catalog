import fs from 'node:fs';
import vm from 'node:vm';
export function redirectAuthoring039(file,suffix=''){
  const html=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),script=/<script\b[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if(!script)throw Error(`Missing redirect script: ${file}`);
  const href='https://example.test/catalog/'+file+suffix,calls=[],context=vm.createContext({URL,location:{href,replace:path=>calls.push(path)}});
  vm.runInContext(script[1],context,{timeout:1000});
  if(calls.length!==1)throw Error(`Expected one redirect: ${file}`);
  return new URL(calls[0],href);
}
