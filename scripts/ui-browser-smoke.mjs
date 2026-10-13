import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base=String(process.env.LOADIN_APP_BASE||'http://127.0.0.1:4173').replace(/\/$/,'');
const out=process.env.LOADIN_UI_ARTIFACT_DIR||'artifacts/ui-smoke';
await mkdir(out,{recursive:true});

const cases=[
  {name:'website-root',path:'/',title:'LOADIN',visible:'Move Anything.'},
  {name:'website',path:'/website',title:'LOADIN',visible:'Move Anything.'},
  {name:'customer',path:'/customer',title:'LOADIN Customer',visible:'Book Fast.'},
  {name:'partner',path:'/partner',title:'LOADIN Partner',visible:'Go Online.'},
  {name:'admin',path:'/admin',title:'LOADIN Admin',visible:'LOADIN OPERATIONS'},
  {name:'admin-launch',path:'/admin-launch',title:'LOADIN Launch Control',visible:'Production release gate'},
  {name:'admin-readiness',path:'/admin-readiness',title:'LOADIN Production Readiness',visible:'Production configuration health'},
  {name:'fleet',path:'/fleet',title:'LOADIN Fleet',visible:'Total Vehicles'}
];

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const results=[];
try{
  for(const c of cases){
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
    page.on('response',r=>{
      const u=r.url();
      if(r.status()>=400&&u.startsWith(base)&&!u.endsWith('/favicon.ico'))errors.push(`http ${r.status()}: ${u.slice(base.length)}`);
    });
    let response=null;
    try{
      response=await page.goto(`${base}${c.path}`,{waitUntil:'domcontentloaded',timeout:15000});
      await page.waitForFunction(text=>document.body?.innerText?.includes(text),c.visible,{timeout:10000});
    }catch(e){errors.push(`navigation: ${e.message}`)}
    const body=await page.locator('body').innerText().catch(()=> '');
    const title=await page.title().catch(()=> '');
    const titleOk=title.includes(c.title);
    const visibleOk=body.includes(c.visible);
    const ok=Boolean(response?.ok())&&titleOk&&visibleOk&&errors.length===0;
    await page.screenshot({path:`${out}/${c.name}.png`,fullPage:true}).catch(()=>{});
    results.push({name:c.name,path:c.path,status:response?.status()||0,title,expectedTitle:c.title,titleOk,expectedVisible:c.visible,visibleOk,errors,ok});
    await page.close();
  }
}finally{await browser.close()}

const failed=results.filter(r=>!r.ok);
console.log(JSON.stringify({ok:failed.length===0,base,results},null,2));
if(failed.length)process.exit(1);
