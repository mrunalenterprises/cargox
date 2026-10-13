import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port=8799;
let child;

async function waitForWorker(){
  for(let i=0;i<50;i++){
    try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return}catch{}
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('payment_worker_start_timeout');
}

test.before(async()=>{
  child=spawn(process.execPath,['services/payment-worker/worker.mjs'],{
    env:{...process.env,PORT:String(port),SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',PAYMENT_PROVIDER:'RAZORPAY',RAZORPAY_KEY_ID:'rzp_test_dummy',RAZORPAY_KEY_SECRET:'dummy',RAZORPAY_WEBHOOK_SECRET:'dummy',LOADIN_ALLOWED_ORIGINS:'https://app.loadin.test'},
    stdio:'ignore'
  });
  await waitForWorker();
});

test.after(()=>{child?.kill('SIGTERM')});

test('allowed browser origin receives CORS preflight headers',async()=>{
  const r=await fetch(`http://127.0.0.1:${port}/session`,{method:'OPTIONS',headers:{Origin:'https://app.loadin.test','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(r.status,204);
  assert.equal(r.headers.get('access-control-allow-origin'),'https://app.loadin.test');
  assert.match(r.headers.get('access-control-allow-methods')||'',/POST/);
});

test('unknown browser origin is rejected before session logic',async()=>{
  const r=await fetch(`http://127.0.0.1:${port}/session`,{method:'POST',headers:{Origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({bookingId:'demo'})});
  assert.equal(r.status,403);
  assert.equal((await r.json()).error,'origin_not_allowed');
});

test('allowed origin still requires authenticated bearer token',async()=>{
  const r=await fetch(`http://127.0.0.1:${port}/session`,{method:'POST',headers:{Origin:'https://app.loadin.test','content-type':'application/json'},body:JSON.stringify({bookingId:'demo'})});
  assert.equal(r.status,401);
  assert.equal(r.headers.get('access-control-allow-origin'),'https://app.loadin.test');
  assert.equal((await r.json()).error,'login_required');
});
