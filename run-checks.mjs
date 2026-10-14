import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
for(const file of ['core-tests.mjs','core-component-tests.mjs','selection-tests.mjs','budget-tests.mjs','verify-v5.mjs','verify-v7.mjs','verify-v8.mjs','verify-v9.mjs','verify-v10.mjs','verify-v11.mjs','verify-v12.mjs','verify-v13.mjs','verify-v14.mjs','verify-v15.mjs','verify-v16.mjs','verify-v17.mjs','director-conformance.mjs']){
 const result=spawnSync(process.execPath,[file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.mjs')){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);}}}
walk('dist');console.log('All current checks and module syntax checks passed.');
