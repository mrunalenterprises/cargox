import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';

const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const firebaseConfig=cfg.firebaseConfig||null;
const vapidKey=String(cfg.firebaseVapidKey||'').trim();
const sdkVersion=String(cfg.firebaseSdkVersion||'10.14.1').trim();
const DEVICE_KEY='loadin.push.device.id';
let foregroundUnsubscribe=null;

function deviceId(){
  try{
    let id=localStorage.getItem(DEVICE_KEY);
    if(!id){id=globalThis.crypto?.randomUUID?.()||`web-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(DEVICE_KEY,id)}
    return id;
  }catch{return `web-${Date.now()}`}
}
function encodeConfig(value){
  const bytes=new TextEncoder().encode(JSON.stringify(value));let binary='';
  for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function firebaseModules(){
  const base=`https://www.gstatic.com/firebasejs/${sdkVersion}`;
  const [app,messaging]=await Promise.all([import(`${base}/firebase-app.js`),import(`${base}/firebase-messaging.js`)]);
  return {app,messaging};
}
async function messagingContext(){
  if(!firebaseConfig||!vapidKey)throw new Error('firebase_web_push_not_configured');
  if(!('serviceWorker' in navigator)||!('Notification' in globalThis))throw new Error('web_push_not_supported');
  const {app,messaging}=await firebaseModules();
  const firebaseApp=app.getApps().length?app.getApp():app.initializeApp(firebaseConfig);
  const swUrl=`/firebase-messaging-sw.js?cfg=${encodeURIComponent(encodeConfig(firebaseConfig))}&sdk=${encodeURIComponent(sdkVersion)}`;
  const registration=await navigator.serviceWorker.register(swUrl,{scope:'/',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  return {messaging,instance:messaging.getMessaging(firebaseApp),registration};
}

export const pushProduction={
  configured:Boolean(client.configured&&firebaseConfig&&vapidKey),
  permission:()=>globalThis.Notification?.permission||'unsupported',
  deviceId,
  async devices(){if(!client.configured)return {devices:[],demo:true};return client.rpc('get_my_push_devices')},
  async enable(){
    if(!client.configured)return {enabled:false,demo:true,reason:'demo_mode'};
    if(!this.configured)throw new Error('firebase_web_push_not_configured');
    let permission=Notification.permission;
    if(permission!=='granted')permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error(permission==='denied'?'notification_permission_denied':'notification_permission_not_granted');
    const {messaging,instance,registration}=await messagingContext();
    const token=await messaging.getToken(instance,{vapidKey,serviceWorkerRegistration:registration});
    if(!token)throw new Error('fcm_token_not_available');
    const result=await client.rpc('upsert_my_push_token',{p_token:token,p_platform:'WEB',p_device_id:deviceId()});
    if(foregroundUnsubscribe)foregroundUnsubscribe();
    foregroundUnsubscribe=messaging.onMessage(instance,payload=>globalThis.dispatchEvent(new CustomEvent('loadin:push',{detail:payload})));
    return {...result,permission,registered:true};
  },
  async disable(){
    if(!client.configured)return {deactivated:false,demo:true};
    const result=await client.rpc('deactivate_my_push_device',{p_device_id:deviceId()});
    if(foregroundUnsubscribe){foregroundUnsubscribe();foregroundUnsubscribe=null}
    return result;
  },
  async status(){
    if(!client.configured)return {configured:false,permission:this.permission(),active:false,demo:true};
    const snapshot=await this.devices();
    const current=(snapshot?.devices||[]).find(d=>d.device_id===deviceId());
    return {configured:this.configured,permission:this.permission(),active:Boolean(current?.active),device:current||null};
  }
};
