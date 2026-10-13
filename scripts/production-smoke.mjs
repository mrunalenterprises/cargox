const base=String(process.env.LOADIN_APP_BASE||'http://127.0.0.1:4173').replace(/\/$/,'');
const paymentBase=String(process.env.LOADIN_PAYMENT_API_BASE||'').replace(/\/$/,'');
const portalBase=String(process.env.LOADIN_ADMIN_API_BASE||'').replace(/\/$/,'');
const timeoutMs=Math.max(1000,Number(process.env.LOADIN_SMOKE_TIMEOUT_MS||5000));
const expected=[['/','LOADIN Preview'],['/auth','Secure sign in'],['/customer','LOADIN Customer'],['/partner','LOADIN Partner'],['/admin','LOADIN Admin'],['/fleet','LOADIN Fleet'],['/firebase-messaging-sw.js','LOADIN']];
async function get(path){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeoutMs);try{const r=await fetch(`${base}${path}`,{signal:ctrl.signal,redirect:'follow',cache:'no-store'});const body=await r.text();return {ok:r.ok,status:r.status,body}}catch(e){return {ok:false,status:0,body:'',error:e.name==='AbortError'?'timeout':e.message}}finally{clearTimeout(t)}}
async function checkReady(target,url){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeoutMs);try{const r=await fetch(`${url}/ready`,{signal:ctrl.signal,cache:'no-store'});const body=await r.json().catch(()=>null);return {target,ok:r.ok,status:r.status,reason:r.ok?'ok':body?.checks||`http_${r.status}`}}catch(e){return {target,ok:false,status:0,reason:e.name==='AbortError'?'timeout':e.message}}finally{clearTimeout(t)}}
const results=[];
for(const [path,needle] of expected){const r=await get(path);const ok=r.ok&&r.body.includes(needle);results.push({target:path,ok,status:r.status,reason:ok?'ok':r.error||(!r.ok?`http_${r.status}`:`missing_${needle}`)})}
if(paymentBase)results.push(await checkReady('payment:/ready',paymentBase));
if(portalBase)results.push(await checkReady('portal:/ready',portalBase));
const failed=results.filter(x=>!x.ok);console.log(JSON.stringify({ok:failed.length===0,appBase:base,paymentChecked:Boolean(paymentBase),portalChecked:Boolean(portalBase),results},null,2));if(failed.length)process.exit(1);
