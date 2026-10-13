import { writeFile } from 'node:fs/promises';

const out=process.env.LOADIN_CONFIG_OUT||'loadin-config.json';
const env=process.env;
function req(name,{optional=false}={}){const v=String(env[name]||'').trim();if(!v&&!optional)throw new Error(`missing_${name}`);return v}
function rejectSecret(name,value){if(!value)return;const upper=name.toUpperCase();if(upper.includes('SERVICE_ROLE')||upper.includes('PRIVATE_KEY')||upper.includes('KEY_SECRET')||upper.includes('WEBHOOK_SECRET'))throw new Error(`server_secret_forbidden_in_public_config:${name}`)}

for(const [name,value] of Object.entries(env)){
  if(!name.startsWith('LOADIN_PUBLIC_'))continue;
  rejectSecret(name,value);
}

const firebase={
  apiKey:req('LOADIN_PUBLIC_FIREBASE_API_KEY',{optional:true}),
  authDomain:req('LOADIN_PUBLIC_FIREBASE_AUTH_DOMAIN',{optional:true}),
  projectId:req('LOADIN_PUBLIC_FIREBASE_PROJECT_ID',{optional:true}),
  storageBucket:req('LOADIN_PUBLIC_FIREBASE_STORAGE_BUCKET',{optional:true}),
  messagingSenderId:req('LOADIN_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',{optional:true}),
  appId:req('LOADIN_PUBLIC_FIREBASE_APP_ID',{optional:true})
};
const config={
  supabaseUrl:req('LOADIN_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey:req('LOADIN_PUBLIC_SUPABASE_ANON_KEY'),
  googleMapsApiKey:req('LOADIN_PUBLIC_GOOGLE_MAPS_API_KEY',{optional:true}),
  paymentProvider:req('LOADIN_PUBLIC_PAYMENT_PROVIDER',{optional:true})||'RAZORPAY',
  paymentPublicKey:req('LOADIN_PUBLIC_PAYMENT_KEY',{optional:true}),
  paymentApiBase:req('LOADIN_PUBLIC_PAYMENT_API_BASE',{optional:true}),
  adminApiBase:req('LOADIN_PUBLIC_ADMIN_API_BASE',{optional:true}),
  firebaseConfig:firebase,
  firebaseVapidKey:req('LOADIN_PUBLIC_FIREBASE_VAPID_KEY',{optional:true}),
  firebaseSdkVersion:req('LOADIN_PUBLIC_FIREBASE_SDK_VERSION',{optional:true})||'10.14.1'
};

const serialized=JSON.stringify(config,null,2)+'\n';
if(/service[_-]?role|private[_-]?key|key[_-]?secret|webhook[_-]?secret/i.test(serialized))throw new Error('public_config_contains_secret_marker');
await writeFile(out,serialized,'utf8');
console.log(JSON.stringify({ok:true,out,publicOnly:true,supabase:true,maps:Boolean(config.googleMapsApiKey),payments:Boolean(config.paymentApiBase&&config.paymentPublicKey),firebase:Boolean(config.firebaseConfig.projectId&&config.firebaseVapidKey)}));
