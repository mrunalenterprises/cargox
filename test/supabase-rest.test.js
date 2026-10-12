import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseRestClient } from '../src/platform/supabase-rest.js';

function response(body,{ok=true,status=200}={}){return {ok,status,async text(){return body===undefined?'':JSON.stringify(body)}}}

test('client is unconfigured without URL/key',()=>{const c=createSupabaseRestClient({fetchImpl:async()=>response({})});assert.equal(c.configured,false)});

test('verifyOtp stores session and subsequent requests use bearer token',async()=>{
  const calls=[];const storage=new Map();
  const c=createSupabaseRestClient({url:'https://demo.supabase.co',anonKey:'anon',storage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetchImpl:async(url,opts)=>{calls.push({url,opts});if(url.endsWith('/auth/v1/verify'))return response({access_token:'jwt-1',refresh_token:'r1'});return response({id:'user-1'})}});
  await c.verifyOtp({phone:'+919000000000',token:'123456'});await c.getUser();
  assert.equal(calls[1].opts.headers.Authorization,'Bearer jwt-1');
});

test('select encodes PostgREST filters',async()=>{
  let seen='';const c=createSupabaseRestClient({url:'https://demo.supabase.co/',anonKey:'anon',fetchImpl:async(url)=>{seen=url;return response([])}});
  await c.select('bookings',{filters:{customer_id:'eq.abc',status:'eq.SEARCHING'},order:'created_at.desc',limit:20});
  assert.match(seen,/rest\/v1\/bookings/);assert.match(seen,/customer_id=eq.abc/);assert.match(seen,/order=created_at.desc/);assert.match(seen,/limit=20/);
});

test('insert asks PostgREST for representation',async()=>{
  let opts;const c=createSupabaseRestClient({url:'https://demo.supabase.co',anonKey:'anon',fetchImpl:async(_u,o)=>{opts=o;return response([{id:'b1'}])}});
  const rows=await c.insert('bookings',{customer_id:'u1'});
  assert.equal(rows[0].id,'b1');assert.equal(opts.method,'POST');assert.equal(opts.headers.Prefer,'return=representation');
});

test('HTTP errors surface backend message',async()=>{
  const c=createSupabaseRestClient({url:'https://demo.supabase.co',anonKey:'anon',fetchImpl:async()=>response({message:'denied'},{ok:false,status:403})});
  await assert.rejects(()=>c.select('bookings'),/denied/);
});
