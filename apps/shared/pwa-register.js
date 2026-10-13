export async function registerLoadinPwa(){
  if(!('serviceWorker' in navigator))return {supported:false};
  try{
    const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/'});
    return {supported:true,registered:true,scope:registration.scope};
  }catch(error){
    console.warn('LOADIN PWA service worker registration failed',error);
    return {supported:true,registered:false,error:String(error?.message||error)};
  }
}

registerLoadinPwa();
