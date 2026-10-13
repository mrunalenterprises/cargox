import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const port=8797;
const allowed='http://127.0.0.1:4173';
const env={...process.env,PORT:String(port),SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',PAYMENT_PROVIDER:'RAZORPAY',RAZORPAY_KEY_ID:'rzp_test_dummy',RAZORPAY_KEY_SECRET:'dummy',RAZORPAY_WEBHOOK_SECRET:'dummy',LOADIN_ALLOWED_ORIGINS:allowed,LOADIN_REQUIRE_BROWSER_ORIGINS:'true',LOADIN_PAYMENT_MAX_BODY_BYTES:'1024'};
const child=spawn(process.execPath,['services/payment-worker/worker.mjs'],{env,stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',d=>stderr+=d);
const base=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitReady(){for(let i=0;i<40;i++){try{const r=await fetch(`${base}/health`);if(r.ok)return}catch{}await sleep(100)}throw new Error(`worker_start_timeout ${stderr}`)}

try{
  await waitReady();
  let r=await fetch(`${base}/ready`);assert.equal(r.status,200);const ready=await r.json();assert.equal(ready.ok,true);assert.equal(ready.strictBrowserOrigins,true);assert.equal(ready.maxBodyBytes,1024);

  r=await fetch(`${base}/session`,{method:'OPTIONS',headers:{Origin:allowed}});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),allowed);
  r=await fetch(`${base}/session`,{method:'OPTIONS',headers:{Origin:'https://evil.example'}});assert.equal(r.status,403);
  r=await fetch(`${base}/session`,{method:'POST',headers:{Origin:allowed,'content-type':'application/json'},body:'{}'});assert.equal(r.status,401);
  r=await fetch(`${base}/session`,{method:'POST',headers:{Origin:allowed,Authorization:'Bearer test','content-type':'application/json'},body:'{broken'});assert.equal(r.status,400);assert.equal((await r.json()).error,'invalid_json');
  r=await fetch(`${base}/session`,{method:'POST',headers:{Origin:allowed,Authorization:'Bearer test','content-type':'application/json'},body:'x'.repeat(2048)});assert.equal(r.status,413);assert.equal((await r.json()).error,'request_body_too_large');
  console.log('Payment worker HTTP security contract passed.');
}finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1000)]);
}
