import {spawnSync} from 'node:child_process';
for(const file of ['core-tests.mjs','core-component-tests.mjs','selection-tests.mjs','budget-tests.mjs','director-conformance.mjs']){
 const result=spawnSync(process.execPath,[file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
}
console.log('81 independent director checks passed without game, UI or display modules.');
