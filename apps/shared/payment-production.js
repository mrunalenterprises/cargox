import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';

const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const apiBase=String(cfg.paymentApiBase||'').replace(/\/$/,'');

async function loadScript(src){if(document.querySelector(`script[src="${src}"]`))return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('payment_sdk_load_failed'));document.head.appendChild(s)})}
async function api(path,options={}){if(!apiBase)throw new Error('payment_api_not_configured');const token=client.accessToken();if(!token)throw new Error('login_required');const r=await fetch(`${apiBase}${path}`,{...options,headers:{'content-type':'application/json',Authorization:`Bearer ${token}`,...(options.headers||{})}});const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw new Error(data?.error||`payment_api_${r.status}`);return data}

export const paymentProduction={
  configured:Boolean(client.configured&&apiBase),
  provider:String(cfg.paymentProvider||'UNSET').toUpperCase(),
  async createSession(bookingId){if(!client.configured)return {provider:'DEMO',paymentId:`DEMO-${bookingId}`,bookingId,amount:0,currency:'INR',status:'PENDING',demo:true};return api('/session',{method:'POST',body:JSON.stringify({bookingId})})},
  async openCheckout(session,{name='LOADIN',description='Fare Locked booking',prefill={}}={}){
    if(session?.status==='PAID')return {status:'PAID',alreadyPaid:true};
    if(session?.provider!=='RAZORPAY')throw new Error('payment_provider_not_supported');
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    if(typeof globalThis.Razorpay!=='function')throw new Error('razorpay_sdk_unavailable');
    return new Promise((resolve,reject)=>{const instance=new globalThis.Razorpay({key:session.keyId,amount:session.amountPaise,currency:session.currency||'INR',name,description,order_id:session.orderId,prefill,theme:{color:'#ff7a00'},handler:(response)=>resolve({status:'SUBMITTED',response}),modal:{ondismiss:()=>reject(new Error('payment_cancelled'))}});instance.on?.('payment.failed',response=>reject(new Error(response?.error?.description||'payment_failed')));instance.open()})
  }
};
