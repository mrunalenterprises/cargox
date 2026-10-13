import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseRestClient } from '../src/platform/supabase-rest.js';

function response(body,{ok=true,status=200}={}){return {ok,status,async text(){return body===undefined?'':JSON.stringify(body)}}}

test('storage upload requires signed-in session',async()=>{
  const c=createSupabaseRestClient({url:'https://demo.supabase.co',anonKey:'public-key',fetchImpl:async()=>response({})});
  await assert.rejects(()=>c.uploadObject('partner-documents','user/a.pdf','file'),/login_required/);
});

test('storage upload sends authenticated file body',async()=>{
  let seenUrl='',seenOpts;const memory=new Map([['loadin.supabase.session',JSON.stringify({access_token:'session-token'})]]);
  const c=createSupabaseRestClient({url:'https://demo.supabase.co',anonKey:'public-key',storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},fetchImpl:async(url,opts)=>{seenUrl=url;seenOpts=opts;return response({Key:'user/file.pdf'})}});
  await c.uploadObject('partner-documents','user/file.pdf','file-body',{contentType:'application/pdf',upsert:true});
  assert.match(seenUrl,/storage\/v1\/object\/partner-documents\/user\/file.pdf$/);
  assert.equal(seenOpts.headers.Authorization,'Bearer session-token');
  assert.equal(seenOpts.headers['Content-Type'],'application/pdf');
  assert.equal(seenOpts.headers['x-upsert'],'true');
  assert.equal(seenOpts.body,'file-body');
});
