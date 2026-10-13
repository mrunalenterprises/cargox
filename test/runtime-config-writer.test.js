import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

function run(extra={}){
  const out=`/tmp/loadin-config-${process.pid}-${Math.random().toString(36).slice(2)}.json`;
  const env={...process.env,LOADIN_CONFIG_OUT:out,LOADIN_PUBLIC_SUPABASE_URL:'https://example.supabase.co',LOADIN_PUBLIC_SUPABASE_ANON_KEY:'public-anon-test',...extra};
  const result=spawnSync(process.execPath,['scripts/write-runtime-config.mjs'],{env,encoding:'utf8'});
  return {out,result};
}

test('writer emits only public runtime config',()=>{
  const {out,result}=run({LOADIN_PUBLIC_PAYMENT_PROVIDER:'RAZORPAY',LOADIN_PUBLIC_PAYMENT_KEY:'rzp_test_public'});
  assert.equal(result.status,0,result.stderr);
  const config=JSON.parse(readFileSync(out,'utf8'));
  assert.equal(config.supabaseAnonKey,'public-anon-test');
  assert.equal(config.paymentPublicKey,'rzp_test_public');
  rmSync(out,{force:true});
});

test('writer rejects Supabase secret key format',()=>{
  const {out,result}=run({LOADIN_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_should_never_be_public'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/supabase_secret_key_forbidden_in_public_config/);
  rmSync(out,{force:true});
});

test('writer rejects JWT service_role key',()=>{
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url');
  const token=`${header}.${payload}.signature`;
  const {out,result}=run({LOADIN_PUBLIC_SUPABASE_ANON_KEY:token});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/supabase_service_role_forbidden_in_public_config/);
  rmSync(out,{force:true});
});
