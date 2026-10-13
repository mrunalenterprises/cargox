import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

async function htmlFiles(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory())out.push(...await htmlFiles(full));
    else if(entry.isFile()&&entry.name.endsWith('.html'))out.push(full);
  }
  return out;
}

const files=await htmlFiles('apps');
const tempRoot=join(tmpdir(),`loadin-inline-${process.pid}`);
let checked=0,failures=0;
try{
  let index=0;
  for(const file of files){
    const source=await readFile(file,'utf8');
    const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while((match=re.exec(source))){
      const attrs=match[1]||'';
      const code=(match[2]||'').trim();
      if(!/\btype\s*=\s*["']module["']/i.test(attrs)||/\bsrc\s*=/i.test(attrs)||!code)continue;
      const temp=`${tempRoot}-${index++}.mjs`;
      await writeFile(temp,code,'utf8');
      const result=spawnSync(process.execPath,['--check',temp],{encoding:'utf8'});
      await rm(temp,{force:true});
      checked++;
      if(result.status!==0){
        failures++;
        console.error(`Inline module syntax failed: ${relative(process.cwd(),file)}`);
        console.error((result.stderr||result.stdout||'').trim());
      }
    }
  }
}finally{
  // Individual temp files are deleted immediately; this is a best-effort cleanup for interrupted runs.
}

if(failures)process.exit(1);
console.log(`Inline module syntax passed for ${checked} block(s) across ${files.length} HTML file(s).`);
