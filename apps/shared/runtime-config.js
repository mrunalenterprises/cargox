const DEFAULTS={
  supabaseUrl:'',
  supabaseAnonKey:'',
  googleMapsApiKey:'',
  paymentProvider:'UNSET',
  paymentPublicKey:'',
  paymentApiBase:'',
  adminApiBase:'',
  firebaseConfig:null,
  firebaseVapidKey:'',
  firebaseSdkVersion:'10.14.1'
};

function clean(value){return typeof value==='string'?value.trim():value}
function mergeConfig(base,extra){
  const out={...base,...(extra||{})};
  if(base.firebaseConfig||extra?.firebaseConfig)out.firebaseConfig={...(base.firebaseConfig||{}),...(extra?.firebaseConfig||{})};
  for(const key of Object.keys(out))if(typeof out[key]==='string')out[key]=clean(out[key]);
  return out;
}
function meaningful(config){return Boolean(config?.supabaseUrl&&config?.supabaseAnonKey)}

async function loadPublicConfig(){
  const injected=globalThis.__LOADIN_CONFIG__||{};
  let remote={};
  if(typeof fetch==='function'){
    try{
      const response=await fetch('/loadin-config.json',{cache:'no-store',credentials:'same-origin'});
      if(response.ok)remote=await response.json();
    }catch{}
  }
  const config=mergeConfig(mergeConfig(DEFAULTS,remote),injected);
  globalThis.__LOADIN_CONFIG__=config;
  return config;
}

export const runtimeConfig=await loadPublicConfig();
export const runtimeMode=meaningful(runtimeConfig)?'LIVE':'DEMO';
export function hasSupabaseConfig(){return meaningful(runtimeConfig)}
export function publicConfigSummary(){
  return {
    mode:runtimeMode,
    supabase:Boolean(runtimeConfig.supabaseUrl&&runtimeConfig.supabaseAnonKey),
    maps:Boolean(runtimeConfig.googleMapsApiKey),
    payments:Boolean(runtimeConfig.paymentApiBase&&runtimeConfig.paymentProvider&&runtimeConfig.paymentProvider!=='UNSET'),
    adminApi:Boolean(runtimeConfig.adminApiBase),
    firebase:Boolean(runtimeConfig.firebaseConfig?.projectId&&runtimeConfig.firebaseVapidKey)
  };
}
