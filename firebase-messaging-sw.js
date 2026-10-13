/* LOADIN Web Push service worker. Firebase config is public client configuration passed at registration time. */
function decodeConfig(value=''){
  const normalized=String(value).replaceAll('-','+').replaceAll('_','/');
  const padded=normalized.padEnd(Math.ceil(normalized.length/4)*4,'=');
  const binary=atob(padded);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const params=new URL(self.location.href).searchParams;
const sdk=params.get('sdk')||'10.14.1';
let firebaseConfig=null;
try{firebaseConfig=decodeConfig(params.get('cfg')||'')}catch(error){console.error('LOADIN push config invalid',error)}

if(firebaseConfig){
  importScripts(`https://www.gstatic.com/firebasejs/${sdk}/firebase-app-compat.js`);
  importScripts(`https://www.gstatic.com/firebasejs/${sdk}/firebase-messaging-compat.js`);
  firebase.initializeApp(firebaseConfig);
  const messaging=firebase.messaging();
  messaging.onBackgroundMessage(payload=>{
    // FCM notification messages are displayed by the SDK. Only data-only messages need a fallback notification.
    if(payload?.notification)return;
    const data=payload?.data||{};
    const title=data.title||'LOADIN';
    const body=data.body||'You have a new LOADIN update.';
    self.registration.showNotification(title,{body,data:{url:data.url||'/'},tag:data.notification_id||undefined,renotify:Boolean(data.notification_id)});
  });
}

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification?.data?.url||'/';
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const target=new URL(url,self.location.origin).href;
    for(const client of windows){if(client.url===target&&'focus' in client)return client.focus()}
    return clients.openWindow?clients.openWindow(target):null;
  })());
});
