import { createServer } from 'node:http';

class RequestError extends Error {
  constructor(status, code) { super(code); this.status=status; this.code=code; }
}
const fail = (status, code) => { throw new RequestError(status, code); };
const text = (value, min, max) => typeof value==='string' && value.length>=min && value.length<=max;
const uuid = value => typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const fields = (body, validators) => {
  if (!body || Array.isArray(body) || typeof body!=='object' ||
      Object.keys(body).some(k=>!Object.hasOwn(validators,k)) ||
      Object.entries(validators).some(([k,check])=>!check(body[k]))) fail(400,'INVALID_INPUT');
  return body;
};
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')) fail(415,'JSON_REQUIRED');
  if(Number(req.headers['content-length'])>16384) fail(413,'BODY_TOO_LARGE');
  let size=0; const parts=[];
  for await (const part of req) { size+=part.length; if(size>16384) fail(413,'BODY_TOO_LARGE'); parts.push(part); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { fail(400,'INVALID_JSON'); }
}
function limiter(now) {
  const entries=new Map();
  return (key, maximum, duration) => {
    const time=now();
    for(const [k,v] of entries) if(v.until<=time) entries.delete(k);
    let record=entries.get(key);
    if(!record) { if(entries.size>=1000) fail(429,'RATE_LIMITED'); record={count:0,until:time+duration}; entries.set(key,record); }
    if(++record.count>maximum) fail(429,'RATE_LIMITED');
  };
}

export function createStagingServer(adapter, { now=Date.now }={}) {
  const limit=limiter(now);
  const server=createServer(async(req,res)=>{
    const send=(status,body)=>{
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",
        'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
        'Cross-Origin-Resource-Policy':'same-origin',
        'Permissions-Policy':'camera=(), geolocation=(), microphone=()',
        ...(status===429?{'Retry-After':'600'}:{})});
      res.end(JSON.stringify(body));
    };
    try {
      // No browser origin is approved yet. Native clients must use explicit Bearer tokens.
      if(req.headers.origin) fail(403,'ORIGIN_NOT_ALLOWED');
      const { pathname }=new URL(req.url,'http://127.0.0.1');
      if(req.method==='GET' && pathname==='/health') return send(200,{mode:'staging-foundation',demo:false,readyForProduction:false});
      if(!['GET','POST'].includes(req.method)) fail(405,'METHOD_NOT_ALLOWED');
      const ip=req.socket.remoteAddress;
      limit(`${ip}:all`,120,60000);
      if(req.method==='POST' && ['/v1/auth/otp','/v1/auth/verify'].includes(pathname)) {
        const phone=v=>typeof v==='string' && /^\+[1-9]\d{7,14}$/.test(v);
        limit(`${ip}:${pathname}`,pathname.endsWith('/otp')?5:10,600000);
        const body=await readBody(req);
        if(pathname.endsWith('/otp')) {
          fields(body,{phone,captchaToken:v=>text(v,1,4096)});
          try { await adapter.requestOtp(body.phone,body.captchaToken); }
          catch { fail(503,'AUTH_PROVIDER_UNAVAILABLE'); }
          return send(202,{status:'requested',message:'Complete the provider OTP challenge if eligible.'});
        }
        fields(body,{phone,token:v=>typeof v==='string' && /^\d{6,10}$/.test(v)});
        try { return send(200,await adapter.verifyOtp(body.phone,body.token)); }
        catch { fail(401,'INVALID_AUTH_CHALLENGE'); }
      }
      const match=/^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(req.headers.authorization??'');
      if(!match) fail(401,'AUTH_REQUIRED');
      let actor;
      try { actor=await adapter.authenticate(match[1]); } catch(error) {
        if(error.status>=500 || ['AuthRetryableFetchError','AbortError','TimeoutError'].includes(error.name)) fail(503,'AUTH_PROVIDER_UNAVAILABLE');
        fail(401,'INVALID_SESSION');
      }
      if(!actor || !uuid(actor.id)) fail(401,'INVALID_SESSION');
      const reads={'/v1/me':'profiles','/v1/onboarding/customer':'customer_onboarding',
        '/v1/onboarding/applications':'partner_applications','/v1/onboarding/documents':'onboarding_documents','/v1/staff/audit':'audit_events'};
      if(req.method==='GET' && Object.hasOwn(reads,pathname)) return send(200,await adapter.read(actor,reads[pathname]));
      if(req.method==='POST') {
        const body=await readBody(req);
        let rpc, params;
        switch(pathname) {
          case '/v1/onboarding/customer':
            fields(body,{displayName:v=>typeof v==='string' && text(v.trim(),2,80),locale:v=>['en','hi','mr'].includes(v),consentVersion:v=>v==='2026-09-foundation',consentAccepted:v=>v===true});
            rpc='complete_customer_onboarding';params={display_name:body.displayName.trim(),locale:body.locale,consent_version:body.consentVersion};break;
          case '/v1/onboarding/applications':
            fields(body,{cityId:uuid,accountKind:v=>['driver','owner','fleet','agency'].includes(v)});
            rpc='save_partner_application';params={city_id:body.cityId,account_kind:body.accountKind};break;
          case '/v1/onboarding/documents':
            fields(body,{applicationId:uuid,kind:v=>['identity','police','permit','insurance'].includes(v),objectPath:v=>text(v,40,160)});
            rpc='attach_onboarding_document';params={application_id:body.applicationId,kind:body.kind,object_path:body.objectPath};break;
          case '/v1/onboarding/submit':
            fields(body,{applicationId:uuid});rpc='submit_partner_application';params={application_id:body.applicationId};break;
          case '/v1/staff/assignments':
            fields(body,{applicationId:uuid,fieldOfficerId:uuid});rpc='assign_application_officer';params={application_id:body.applicationId,field_officer_id:body.fieldOfficerId};break;
          case '/v1/staff/reviews':
            fields(body,{applicationId:uuid,decision:v=>['staff_review','approve','reject'].includes(v)});
            rpc='review_partner_application';params={application_id:body.applicationId,decision:body.decision};break;
          default: fail(404,'NOT_FOUND');
        }
        return send(200,{result:await adapter.rpc(actor,rpc,params)});
      }
      fail(404,'NOT_FOUND');
    } catch(error) {
      if(error instanceof RequestError) return send(error.status,{error:error.code});
      if(error.code==='42501') return send(403,{error:'NOT_PERMITTED'});
      if(['22023','23514','23502','23503','22P02'].includes(error.code)) return send(400,{error:'INVALID_INPUT'});
      if(['23505','55000'].includes(error.code)) return send(409,{error:'STATE_CONFLICT'});
      // Provider/SQL details, phone numbers and tokens never reach response/logs.
      return send(503,{error:'STAGING_DEPENDENCY_UNAVAILABLE'});
    }
  });
  server.requestTimeout=15000;
  server.headersTimeout=10000;
  return server;
}
