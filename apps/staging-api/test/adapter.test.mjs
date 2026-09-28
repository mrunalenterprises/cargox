import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingConfig,supabaseAdapter } from '../src/supabase.mjs';
const ref='abcdefghijklmnopqrst';
const env={CARGOX_ENV:'staging',CARGOX_STAGING_PROJECT_REF:ref,SUPABASE_URL:`https://${ref}.supabase.co`,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
test('startup rejects missing config, foreign origins, privileged keys and demo ports',()=>{
 assert.equal(stagingConfig(env).port,4180);
 for(const changes of [{CARGOX_ENV:'production'},{SUPABASE_URL:'http://127.0.0.1:4174'},{SUPABASE_URL:'https://different.supabase.co'},
  {SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'},{SUPABASE_SERVICE_ROLE_KEY:'forbidden'},{DATABASE_URL:'forbidden'},{PORT:'4174'},{PORT:'NaN'}])
  assert.throws(()=>stagingConfig({...env,...changes}));
 assert.throws(()=>stagingConfig({}));
});
test('Supabase adapter verifies identity with getUser and forwards user JWT to database',async()=>{
 const calls=[];const user={id:'00000000-0000-4000-8000-000000000001',phone_confirmed_at:'2026-09-28',user_metadata:{role:'super_admin'}};
 const factory=(url,key,options)=>{
  calls.push({url,key,options});
  return {auth:{getUser:async token=>{assert.equal(token,'fixture-token');return {data:{user}};}},rpc:async(name,params)=>({data:{name,params}})};
 };
 const adapter=supabaseAdapter(stagingConfig(env),factory);const actor=await adapter.authenticate('fixture-token');
 assert.deepEqual(actor,{id:user.id,token:'fixture-token'});
 await adapter.rpc(actor,'save_partner_application',{account_kind:'driver'});
 assert.equal(calls[1].options.global.headers.Authorization,'Bearer fixture-token');
 assert.equal(calls[0].options.auth.persistSession,false);assert.equal(calls[0].options.auth.autoRefreshToken,false);
 user.is_anonymous=true;await assert.rejects(adapter.authenticate('fixture-token'));
 user.is_anonymous=false;user.phone_confirmed_at=null;await assert.rejects(adapter.authenticate('fixture-token'));
});
test('OTP adapter maps SMS challenge and returns only session fields using separate clients',async()=>{
 let count=0;
 const adapter=supabaseAdapter(stagingConfig(env),()=>{count++;return {auth:{
  signInWithOtp:async input=>{assert.equal(input.options.captchaToken,'captcha');assert.equal(input.options.shouldCreateUser,true);return {data:{}};},
  verifyOtp:async input=>{assert.equal(input.type,'sms');return {data:{session:{access_token:'access',refresh_token:'refresh',expires_in:3600,token_type:'bearer',user:{private:'data'}}}};},
 }};});
 await adapter.requestOtp('+919999999999','captcha');
 assert.deepEqual(await adapter.verifyOtp('+919999999999','123456'),{access_token:'access',refresh_token:'refresh',expires_in:3600,token_type:'bearer'});
 assert.equal(count,2);
});
