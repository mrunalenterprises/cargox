import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root=process.cwd();
const allowed=new Set([
  'apps/shared/runtime-config.js',
  'apps/shared/config.example.js'
]);
const extensions=new Set(['.js','.mjs','.html']);

async function files(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory())out.push(...await files(full));
    else if([...extensions].some(ext=>entry.name.endsWith(ext)))out.push(full);
  }
  return out;
}

let failures=0;
for(const full of await files(join(root,'apps'))){
  const path=relative(root,full).replaceAll('\\','/');
  if(allowed.has(path))continue;
  const source=await readFile(full,'utf8');
  if(source.includes('__LOADIN_CONFIG__')){
    console.error(`${path}: direct __LOADIN_CONFIG__ access is forbidden; import runtimeConfig from apps/shared/runtime-config.js`);
    failures++;
  }
}
if(failures)process.exit(1);
console.log('Runtime config usage is centralized.');
