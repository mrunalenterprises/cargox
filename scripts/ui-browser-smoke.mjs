import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base=String(process.env.LOADIN_APP_BASE||'http://127.0.0.1:4173').replace(/\/$/,'');
const out=process.env.LOADIN_UI_ARTIFACT_DIR||'artifacts/ui-smoke';
await mkdir(out,{recursive:true});

const cases=[
  {name:'website',path:'/website',expect:'LOADIN'},
  {name:'customer',path:'/customer',expect:'LOADIN Customer'},
  {name:'partner',path:'/partner',expect:'LOADIN Partner'},
  {name:'admin',path:'/admin',expect:'LOADIN OPERATIONS'},
  {name:'admin-launch',path:'/admin-launch',expect:'Production release gate'},
  {name:'admin-readiness',path:'/admin-readiness',expect:'Production configuration health'},
  {name:'fleet',path:'/fleet',expect:'LOADIN Fleet'}
];

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const results=[];
try{
  for(const c of cases){
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
    page.on('console',m=>{if(m.type()==='error'&&!/favicon/i.test(m.text()))errors.push(`console: ${m.text()}`)});
    const response=await page.goto(`${base}${c.path}`,{waitUntil:'networkidle',timeout:15000});
    const body=await page.locator('body').innerText();
    const ok=Boolean(response?.ok())&&body.includes(c.expect)&&errors.length===0;
    await page.screenshot({path:`${out}/${c.name}.png`,fullPage:true});
    results.push({name:c.name,path:c.path,status:response?.status()||0,expected:c.expect,found:body.includes(c.expect),errors,ok});
    await page.close();
  }
}finally{await browser.close()}

const failed=results.filter(r=>!r.ok);
console.log(JSON.stringify({ok:failed.length===0,base,results},null,2));
if(failed.length)process.exit(1);
