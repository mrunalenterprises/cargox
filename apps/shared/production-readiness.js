import { runtimeConfig as cfg } from './runtime-config.js';

function text(v){return String(v||'').trim()}
function placeholder(v){const s=text(v).toUpperCase();return !s||s.includes('YOUR_')||s.includes('EXAMPLE.COM')||s.includes('YOUR-PROJECT')||s.includes('YOUR_PROJECT')}
function urlReady(v){if(placeholder(v))return false;try{const u=new URL(v);return u.protocol==='https:'||u.hostname==='127.0.0.1'||u.hostname==='localhost'}catch{return false}}
function readyItem(id,label,ok,detail,blocking=true){return {id,label,status:ok?'READY':'MISSING',detail,blocking}}
function firebaseReady(){const f=cfg.firebaseConfig||{};return ['apiKey','authDomain','projectId','messagingSenderId','appId'].every(k=>!placeholder(f[k]))&&!placeholder(cfg.firebaseVapidKey)}
function browserItems(){
  const supabaseUrl=urlReady(cfg.supabaseUrl),anon=!placeholder(cfg.supabaseAnonKey);
  const paymentProvider=text(cfg.paymentProvider).toUpperCase()==='RAZORPAY';
  return [
    readyItem('supabase','Supabase project',supabaseUrl&&anon,'Public URL + anon key configured.'),
    readyItem('maps','Google Maps',!placeholder(cfg.googleMapsApiKey),'HTTP-referrer restricted browser key configured.'),
    readyItem('payment','Online payments',paymentProvider&&!placeholder(cfg.paymentPublicKey)&&urlReady(cfg.paymentApiBase),'Razorpay public key + secure payment API configured.'),
    readyItem('push','FCM Web Push',firebaseReady(),'Firebase web config + public VAPID key configured.'),
    readyItem('adminApi','Admin/Fleet API',urlReady(cfg.adminApiBase),'Secure portal API configured. Browser can fall back to scoped Supabase RPCs when this is omitted.',false),
    readyItem('serviceWorker','Push service worker','serviceWorker' in navigator,'Browser supports service workers.',false),
    readyItem('notifications','Browser notifications','Notification' in globalThis,'Browser supports Notification API.',false)
  ];
}
async function timedFetch(url,options={},timeoutMs=5000){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeoutMs);try{return await fetch(url,{...options,signal:ctrl.signal,cache:'no-store'})}finally{clearTimeout(t)}}
async function supabaseHealth(){if(placeholder(cfg.supabaseUrl)||placeholder(cfg.supabaseAnonKey))return {status:'NOT_CONFIGURED',ok:false};try{const r=await timedFetch(`${text(cfg.supabaseUrl).replace(/\/$/,'')}/rest/v1/`,{headers:{apikey:cfg.supabaseAnonKey}});return {status:r.ok?'REACHABLE':`HTTP_${r.status}`,ok:r.ok}}catch(e){return {status:e.name==='AbortError'?'TIMEOUT':'UNREACHABLE',ok:false}}}
async function paymentHealth(){if(!urlReady(cfg.paymentApiBase))return {status:'NOT_CONFIGURED',ok:false};try{const r=await timedFetch(`${text(cfg.paymentApiBase).replace(/\/$/,'')}/ready`);let data=null;try{data=await r.json()}catch{}return {status:r.ok?'READY':`HTTP_${r.status}`,ok:r.ok,provider:data?.provider||text(cfg.paymentProvider)||null,checks:data?.checks||null}}catch(e){return {status:e.name==='AbortError'?'TIMEOUT':'UNREACHABLE',ok:false}}}
async function portalApiHealth(){if(!urlReady(cfg.adminApiBase))return {status:'NOT_CONFIGURED',ok:false,configured:false};try{const r=await timedFetch(`${text(cfg.adminApiBase).replace(/\/$/,'')}/ready`);let data=null;try{data=await r.json()}catch{}return {status:r.ok?'READY':`HTTP_${r.status}`,ok:r.ok,configured:true,service:data?.service||null,checks:data?.checks||null}}catch(e){return {status:e.name==='AbortError'?'TIMEOUT':'UNREACHABLE',ok:false,configured:true}}}
async function serviceWorkerHealth(){try{const r=await timedFetch('/firebase-messaging-sw.js',{},3000);return {status:r.ok?'PRESENT':`HTTP_${r.status}`,ok:r.ok}}catch{return {status:'UNREACHABLE',ok:false}}}
function summarize(items,remote){const blockers=items.filter(x=>x.blocking&&x.status!=='READY').map(x=>x.label);if(remote.supabase&&!remote.supabase.ok&&!blockers.includes('Supabase project'))blockers.push('Supabase connectivity');if(remote.payment&&browserItems().find(x=>x.id==='payment')?.status==='READY'&&!remote.payment.ok)blockers.push('Payment worker readiness');if(remote.portalApi?.configured&&!remote.portalApi.ok)blockers.push('Admin/Fleet API readiness');return {ready:blockers.length===0,blockers}}

export const productionReadiness={
  browserSnapshot(){const items=browserItems();return {mode:placeholder(cfg.supabaseUrl)?'DEMO':'LIVE_CONFIGURED',items,...summarize(items,{})}},
  async fullSnapshot(){const items=browserItems();const [supabase,payment,portalApi,serviceWorker]=await Promise.all([supabaseHealth(),paymentHealth(),portalApiHealth(),serviceWorkerHealth()]);const remote={supabase,payment,portalApi,serviceWorker};return {mode:placeholder(cfg.supabaseUrl)?'DEMO':'LIVE_CONFIGURED',items,remote,...summarize(items,remote)}},
  config:{paymentProvider:text(cfg.paymentProvider).toUpperCase()||'UNSET'}
};
