import http from 'node:http';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT||8788);
const SUPABASE_URL=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SERVICE_ROLE=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const PROVIDER=String(process.env.PAYMENT_PROVIDER||'RAZORPAY').toUpperCase();
const RAZORPAY_KEY_ID=process.env.RAZORPAY_KEY_ID||'';
const RAZORPAY_KEY_SECRET=process.env.RAZORPAY_KEY_SECRET||'';
const RAZORPAY_WEBHOOK_SECRET=process.env.RAZORPAY_WEBHOOK_SECRET||'';
const ALLOWED_ORIGINS=new Set(String(process.env.LOADIN_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean));
const REQUIRE_BROWSER_ORIGINS=/^(1|true|yes)$/i.test(String(process.env.LOADIN_REQUIRE_BROWSER_ORIGINS||''));
const MAX_BODY_BYTES=Math.max(1024,Math.min(Number(process.env.LOADIN_PAYMENT_MAX_BODY_BYTES||1048576),5242880));

function requestOrigin(req){return String(req.headers.origin||'').trim().replace(/\/$/,'')}
function allowedOrigin(req){const origin=requestOrigin(req);return origin&&ALLOWED_ORIGINS.has(origin)?origin:''}
function corsHeaders(req){const origin=allowedOrigin(req);return origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{}}
function json(req,res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...corsHeaders(req)});res.end(JSON.stringify(body))}
function configured(){return Boolean(SUPABASE_URL&&SERVICE_ROLE)}
function readiness(){const checks={supabase:Boolean(SUPABASE_URL&&SERVICE_ROLE),providerSupported:PROVIDER==='RAZORPAY',providerCredentials:Boolean(RAZORPAY_KEY_ID&&RAZORPAY_KEY_SECRET),webhookSecret:Boolean(RAZORPAY_WEBHOOK_SECRET),browserOriginsConfigured:ALLOWED_ORIGINS.size>0};const core=checks.supabase&&checks.providerSupported&&checks.providerCredentials&&checks.webhookSecret;return {ok:core&&(!REQUIRE_BROWSER_ORIGINS||checks.browserOriginsConfigured),provider:PROVIDER,strictBrowserOrigins:REQUIRE_BROWSER_ORIGINS,maxBodyBytes:MAX_BODY_BYTES,checks}}
async function readBody(req,{maxBytes=MAX_BODY_BYTES}={}){const chunks=[];let total=0;for await(const c of req){total+=c.length;if(total>maxBytes){const e=new Error('request_body_too_large');e.status=413;throw e}chunks.push(c)}return Buffer.concat(chunks,total)}
function parseJson(raw){try{return JSON.parse(raw.toString('utf8')||'{}')}catch{const e=new Error('invalid_json');e.status=400;throw e}}
async function sbRpc(name,args,token=SERVICE_ROLE){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:SERVICE_ROLE,Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(args||{})});const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok){const e=new Error(data?.message||data?.error||`supabase_${r.status}`);e.status=r.status;e.data=data;throw e}return data}
async function createRazorpayOrder({paymentId,amount,currency='INR'}){if(!RAZORPAY_KEY_ID||!RAZORPAY_KEY_SECRET)throw new Error('razorpay_not_configured');const paise=Math.round(Number(amount)*100);const auth=Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');const r=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${auth}`,'content-type':'application/json'},body:JSON.stringify({amount:paise,currency,receipt:`loadin_${paymentId}`,notes:{payment_id:paymentId,product:'LOADIN'}})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={raw:text}}if(!r.ok)throw new Error(data?.error?.description||`razorpay_${r.status}`);return data}
function bearer(req){const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7):''}
function verifyRazorpaySignature(raw,signature){if(!RAZORPAY_WEBHOOK_SECRET||!signature)return false;const expected=crypto.createHmac('sha256',RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');const a=Buffer.from(expected);const b=Buffer.from(String(signature));return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function eventId(raw,headers){return String(headers['x-razorpay-event-id']||crypto.createHash('sha256').update(raw).digest('hex'))}
function extractRazorpayPayment(payload){const payment=payload?.payload?.payment?.entity||{};const order=payload?.payload?.order?.entity||{};return {eventType:String(payload?.event||''),orderId:payment.order_id||order.id||null,paymentId:payment.id||null,amountPaise:payment.amount??order.amount_paid??null}}

const server=http.createServer(async(req,res)=>{try{
  if(req.method==='OPTIONS'){
    const origin=requestOrigin(req);if(origin&&!allowedOrigin(req))return json(req,res,403,{error:'origin_not_allowed'});
    res.writeHead(204,{...corsHeaders(req),'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,content-type','access-control-max-age':'600'});res.end();return;
  }
  if(req.method==='GET'&&req.url==='/health')return json(req,res,200,{ok:true,service:'loadin-payment-worker',provider:PROVIDER});
  if(req.method==='GET'&&req.url==='/ready'){const r=readiness();return json(req,res,r.ok?200:503,r)}
  if(!configured())return json(req,res,503,{error:'payment_worker_not_configured'});

  if(req.method==='POST'&&req.url==='/session'){
    const origin=requestOrigin(req);if(origin&&!allowedOrigin(req))return json(req,res,403,{error:'origin_not_allowed'});
    const token=bearer(req);if(!token)return json(req,res,401,{error:'login_required'});
    const body=parseJson(await readBody(req,{maxBytes:Math.min(MAX_BODY_BYTES,32768)}));if(!body.bookingId)return json(req,res,400,{error:'booking_id_required'});
    const intent=await sbRpc('prepare_my_online_payment',{p_booking_id:body.bookingId},token);
    if(intent.status==='PAID')return json(req,res,200,{status:'PAID',paymentId:intent.payment_id,bookingId:intent.booking_id,amount:intent.amount,currency:intent.currency});
    if(PROVIDER!=='RAZORPAY')return json(req,res,503,{error:'payment_provider_not_supported',provider:PROVIDER});
    if(intent.provider_order_id)return json(req,res,200,{provider:'RAZORPAY',keyId:RAZORPAY_KEY_ID,orderId:intent.provider_order_id,paymentId:intent.payment_id,bookingId:intent.booking_id,amount:Number(intent.amount),amountPaise:Math.round(Number(intent.amount)*100),currency:intent.currency,status:intent.status});
    const order=await createRazorpayOrder({paymentId:intent.payment_id,amount:intent.amount,currency:intent.currency});
    await sbRpc('bind_loadin_provider_order',{p_payment_id:intent.payment_id,p_provider:'RAZORPAY',p_provider_order_id:order.id,p_metadata:{provider_amount:order.amount,provider_currency:order.currency,receipt:order.receipt}});
    return json(req,res,200,{provider:'RAZORPAY',keyId:RAZORPAY_KEY_ID,orderId:order.id,paymentId:intent.payment_id,bookingId:intent.booking_id,amount:Number(intent.amount),amountPaise:order.amount,currency:order.currency,status:'PENDING'});
  }

  if(req.method==='POST'&&req.url==='/webhook/razorpay'){
    const raw=await readBody(req);const sig=req.headers['x-razorpay-signature'];const valid=verifyRazorpaySignature(raw,sig);if(!valid)return json(req,res,401,{error:'invalid_signature'});
    const payload=parseJson(raw);const x=extractRazorpayPayment(payload);if(!x.orderId)return json(req,res,202,{ignored:true,reason:'order_id_missing'});
    const result=await sbRpc('record_loadin_payment_event',{p_provider:'RAZORPAY',p_provider_event_id:eventId(raw,req.headers),p_event_type:x.eventType,p_provider_order_id:x.orderId,p_provider_payment_id:x.paymentId,p_amount:x.amountPaise==null?null:Number(x.amountPaise)/100,p_signature_valid:true,p_payload:payload});
    return json(req,res,200,result);
  }

  return json(req,res,404,{error:'not_found'});
}catch(error){console.error(error);return json(req,res,error.status||500,{error:error.message||'payment_worker_error'})}});

server.listen(PORT,'0.0.0.0',()=>console.log(`LOADIN payment worker listening on :${PORT}`));
