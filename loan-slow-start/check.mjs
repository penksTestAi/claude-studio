import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {run}=require('./checks.js');
const r=run();let bad=0;
for(const x of r.results){console.log((x.ok?'ok   ':'FAIL ')+x.group+': '+x.name+(x.detail?' ['+x.detail+']':''));if(!x.ok)bad++}
console.log(bad?bad+' failed':'all '+r.results.length+' passed');
process.exit(bad?1:0);
