import {build} from 'esbuild';
import fs from 'node:fs/promises';
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd(),sourcefile:'supabase-entry.js'},bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,outfile:'assets/cloud/supabase-client.js',legalComments:'eof'});
await fs.copyFile('node_modules/@supabase/supabase-js/LICENSE','assets/cloud/SUPABASE-LICENSE');
