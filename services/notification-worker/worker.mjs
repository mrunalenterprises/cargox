// LOADIN notification worker. Run only in trusted server infrastructure.
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// For FCM delivery also provide FCM_PROJECT_ID and a short-lived FCM_ACCESS_TOKEN.

const base=String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const projectId=String(process.env.FCM_PROJECT_ID||'');
const accessToken=String(process.env.FCM_ACCESS_TOKEN||'');
const batchSize=Math.max(1,Math.min(Number(process.env.LOADIN_NOTIFICATION_BATCH||100),500));

if(!base||!serviceKey){console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');process.exit(2)}

async function rpc(name,args={}){
  const res=await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify(args)});
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok)throw new Error(data?.message||data?.error||`rpc_${name}_${res.status}`);
  return data;
}

async function sendFcm(token,notification){
  if(!projectId||!accessToken)return {outcome:'RETRY',errorCode:'FCM_NOT_CONFIGURED',errorMessage:'FCM_PROJECT_ID / FCM_ACCESS_TOKEN missing'};
  const payload={message:{token,notification:{title:notification.title,body:notification.body},data:Object.fromEntries(Object.entries(notification.payload||{}).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)])),android:{priority:notification.priority==='CRITICAL'||notification.priority==='HIGH'?'high':'normal',notification:{sound:notification.sound_key||'default'}},apns:{headers:{'apns-priority':notification.priority==='CRITICAL'||notification.priority==='HIGH'?'10':'5'}}}};
  const res=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(payload)});
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(res.ok)return {outcome:'SENT',providerMessageId:data?.name||null};
  const code=data?.error?.status||`HTTP_${res.status}`;
  const retry=[408,429,500,502,503,504].includes(res.status);
  return {outcome:retry?'RETRY':'FAILED',errorCode:code,errorMessage:data?.error?.message||String(text).slice(0,500)};
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
    // A notification may have multiple devices. Mark the notification successful if any device accepts it.
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
  console.log(JSON.stringify({ok:true,compliance,claimed:items.length,sent,failed,retry,noToken,finishedAt:new Date().toISOString()}));
}

main().catch(err=>{console.error(err);process.exit(1)});
