// LOADIN notification worker. Run only in trusted server infrastructure.
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// FCM: set FCM_PROJECT_ID plus either FCM_SERVICE_ACCOUNT_JSON or FCM_CLIENT_EMAIL + FCM_PRIVATE_KEY.
// FCM_ACCESS_TOKEN remains supported only as a short-lived deployment/debug override.

import { createSign } from 'node:crypto';

const base=String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const staticAccessToken=String(process.env.FCM_ACCESS_TOKEN||'').trim();
const batchSize=Math.max(1,Math.min(Number(process.env.LOADIN_NOTIFICATION_BATCH||100),500));
let oauthCache={token:null,expiresAt:0};

function parseServiceAccount(){
  const directEmail=String(process.env.FCM_CLIENT_EMAIL||'').trim();
  const directKey=String(process.env.FCM_PRIVATE_KEY||'').replaceAll('\\n','\n').trim();
  if(directEmail&&directKey)return {client_email:directEmail,private_key:directKey,project_id:String(process.env.FCM_PROJECT_ID||'').trim()};
  const raw=String(process.env.FCM_SERVICE_ACCOUNT_JSON||'').trim();
  if(!raw)return null;
  try{return JSON.parse(raw)}catch{}
  try{return JSON.parse(Buffer.from(raw,'base64').toString('utf8'))}catch{return null}
}
const serviceAccount=parseServiceAccount();
const projectId=String(process.env.FCM_PROJECT_ID||serviceAccount?.project_id||'').trim();
function readiness(){const checks={supabase:Boolean(base&&serviceKey),fcmProject:Boolean(projectId),fcmCredentials:Boolean(staticAccessToken||(serviceAccount?.client_email&&serviceAccount?.private_key))};return {ok:Object.values(checks).every(Boolean),service:'loadin-notification-worker',authMode:staticAccessToken?'ACCESS_TOKEN':serviceAccount?'SERVICE_ACCOUNT':'UNCONFIGURED',checks,batchSize}}

if(process.argv.includes('--check')){const r=readiness();console.log(JSON.stringify(r));process.exit(r.ok?0:2)}
if(!base||!serviceKey){console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');process.exit(2)}

function b64url(value){return Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url')}
async function getFcmAccessToken(){
  if(staticAccessToken)return staticAccessToken;
  if(oauthCache.token&&oauthCache.expiresAt>Date.now()+60_000)return oauthCache.token;
  if(!serviceAccount?.client_email||!serviceAccount?.private_key)return null;
  const now=Math.floor(Date.now()/1000);
  const header=b64url({alg:'RS256',typ:'JWT'});
  const claims=b64url({iss:serviceAccount.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const unsigned=`${header}.${claims}`;
  const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${signer.sign(serviceAccount.private_key).toString('base64url')}`;
  const body=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion});
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const data=await res.json().catch(()=>null);
  if(!res.ok||!data?.access_token)throw new Error(data?.error_description||data?.error||`fcm_oauth_${res.status}`);
  oauthCache={token:data.access_token,expiresAt:Date.now()+Math.max(60,Number(data.expires_in||3600)-120)*1000};
  return oauthCache.token;
}

async function rpc(name,args={}){
  const res=await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify(args)});
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok)throw new Error(data?.message||data?.error||`rpc_${name}_${res.status}`);
  return data;
}

function stringData(notification){
  const payload={...(notification.payload||{}),notification_id:notification.id,notification_type:notification.notification_type,priority:notification.priority};
  return Object.fromEntries(Object.entries(payload).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));
}
async function sendFcm(token,notification){
  if(!projectId)return {outcome:'RETRY',errorCode:'FCM_PROJECT_NOT_CONFIGURED',errorMessage:'FCM_PROJECT_ID missing'};
  let accessToken;try{accessToken=await getFcmAccessToken()}catch(error){return {outcome:'RETRY',errorCode:'FCM_OAUTH_FAILED',errorMessage:error.message}}
  if(!accessToken)return {outcome:'RETRY',errorCode:'FCM_CREDENTIALS_NOT_CONFIGURED',errorMessage:'FCM service account credentials missing'};
  const high=notification.priority==='CRITICAL'||notification.priority==='HIGH';
  const data=stringData(notification);
  const link=String(notification.payload?.url||'/');
  const payload={message:{token,notification:{title:notification.title,body:notification.body},data,android:{priority:high?'high':'normal',notification:{sound:notification.sound_key||'default'}},apns:{headers:{'apns-priority':high?'10':'5'}},webpush:{headers:{Urgency:high?'high':'normal'},fcm_options:{link}}}};
  const res=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(payload)});
  const text=await res.text();let dataOut=null;try{dataOut=text?JSON.parse(text):null}catch{dataOut=text}
  if(res.ok)return {outcome:'SENT',providerMessageId:dataOut?.name||null};
  const code=dataOut?.error?.status||`HTTP_${res.status}`;
  const retry=[408,429,500,502,503,504].includes(res.status);
  return {outcome:retry?'RETRY':'FAILED',errorCode:code,errorMessage:dataOut?.error?.message||String(text).slice(0,500)};
}

async function main(){
  const compliance=await rpc('refresh_loadin_document_compliance');
  const claim=await rpc('claim_loadin_notifications',{p_limit:batchSize});
  const items=claim?.items||[];let sent=0,failed=0,retry=0,noToken=0;
  for(const item of items){
    const n=item.notification;const tokens=item.tokens||[];
    if(!tokens.length){
      noToken++;
      await rpc('record_loadin_notification_delivery',{p_notification_id:n.id,p_claim_token:claim.claim_token,p_outcome:'RETRY',p_provider_message_id:null,p_error_code:'NO_ACTIVE_TOKEN',p_error_message:'No active device token'});
      continue;
    }
    let success=null,lastFailure=null;
    for(const target of tokens){
      const result=await sendFcm(target.token,n);
      if(result.outcome==='SENT'){success=result;break}
      lastFailure=result;
    }
    const result=success||lastFailure||{outcome:'RETRY',errorCode:'UNKNOWN'};
    if(result.outcome==='SENT')sent++;else if(result.outcome==='FAILED')failed++;else retry++;
    await rpc('record_loadin_notification_delivery',{p_notification_id:n.id,p_claim_token:claim.claim_token,p_outcome:result.outcome,p_provider_message_id:result.providerMessageId||null,p_error_code:result.errorCode||null,p_error_message:result.errorMessage||null});
  }
  console.log(JSON.stringify({ok:true,authMode:staticAccessToken?'ACCESS_TOKEN':serviceAccount?'SERVICE_ACCOUNT':'UNCONFIGURED',projectConfigured:Boolean(projectId),compliance,claimed:items.length,sent,failed,retry,noToken,finishedAt:new Date().toISOString()}));
}

main().catch(err=>{console.error(err);process.exit(1)});
