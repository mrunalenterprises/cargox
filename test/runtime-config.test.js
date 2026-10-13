import test from 'node:test';
import assert from 'node:assert/strict';

const originalFetch=globalThis.fetch;
const originalConfig=globalThis.__LOADIN_CONFIG__;

function restore(){globalThis.fetch=originalFetch;if(originalConfig===undefined)delete globalThis.__LOADIN_CONFIG__;else globalThis.__LOADIN_CONFIG__=originalConfig}

test('runtime config loads hosted public config',async()=>{
  delete globalThis.__LOADIN_CONFIG__;
  globalThis.fetch=async url=>{
    assert.equal(url,'/loadin-config.json');
    return {ok:true,json:async()=>({supabaseUrl:'https://demo.supabase.co',supabaseAnonKey:'anon',paymentProvider:'RAZORPAY',paymentApiBase:'https://payments.example.com/loadin'})};
  };
  const mod=await import(`../apps/shared/runtime-config.js?hosted=${Date.now()}`);
  assert.equal(mod.runtimeMode,'LIVE');
  assert.equal(mod.runtimeConfig.supabaseUrl,'https://demo.supabase.co');
  assert.equal(mod.publicConfigSummary().payments,true);
  restore();
});

test('injected config overrides hosted fields but keeps hosted extras',async()=>{
  globalThis.__LOADIN_CONFIG__={supabaseUrl:'https://override.supabase.co',supabaseAnonKey:'override-anon'};
  globalThis.fetch=async()=>({ok:true,json:async()=>({supabaseUrl:'https://hosted.supabase.co',supabaseAnonKey:'hosted-anon',googleMapsApiKey:'maps-public'})});
  const mod=await import(`../apps/shared/runtime-config.js?merge=${Date.now()}`);
  assert.equal(mod.runtimeConfig.supabaseUrl,'https://override.supabase.co');
  assert.equal(mod.runtimeConfig.supabaseAnonKey,'override-anon');
  assert.equal(mod.runtimeConfig.googleMapsApiKey,'maps-public');
  restore();
});

test('missing hosted config falls back to demo without throwing',async()=>{
  delete globalThis.__LOADIN_CONFIG__;
  globalThis.fetch=async()=>{throw new Error('offline')};
  const mod=await import(`../apps/shared/runtime-config.js?offline=${Date.now()}`);
  assert.equal(mod.runtimeMode,'DEMO');
  assert.equal(mod.hasSupabaseConfig(),false);
  restore();
});
