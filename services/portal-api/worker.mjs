import http from 'node:http';

const PORT=Number(process.env.PORT||8790);
const SUPABASE_URL=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SUPABASE_ANON_KEY=String(process.env.SUPABASE_ANON_KEY||'').trim();
const ALLOWED_ORIGINS=new Set(String(process.env.LOADIN_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean));
const REQUIRE_BROWSER_ORIGINS=/^(1|true|yes)$/i.test(String(process.env.LOADIN_REQUIRE_BROWSER_ORIGINS||''));
const MAX_BODY_BYTES=Math.max(1024,Math.min(Number(process.env.LOADIN_PORTAL_MAX_BODY_BYTES||32768),1048576));

function requestOrigin(req){return String(req.headers.origin||'').trim().replace(/\/$/,'')}
function allowedOrigin(req){const origin=requestOrigin(req);return origin&&ALLOWED_ORIGINS.has(origin)?origin:''}
function corsHeaders(req){const origin=allowedOrigin(req);return origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{}}
function json(req,res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...corsHeaders(req)});res.end(JSON.stringify(body))}
function bearer(req){const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7).trim():''}
function configured(){return Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY)}
function readiness(){const checks={supabase:Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY),browserOriginsConfigured:ALLOWED_ORIGINS.size>0};return {ok:checks.supabase&&(!REQUIRE_BROWSER_ORIGINS||checks.browserOriginsConfigured),service:'loadin-portal-api',strictBrowserOrigins:REQUIRE_BROWSER_ORIGINS,maxBodyBytes:MAX_BODY_BYTES,checks}}
async function readBody(req,{maxBytes=MAX_BODY_BYTES}={}){const chunks=[];let total=0;for await(const c of req){total+=c.length;if(total>maxBytes){const e=new Error('request_body_too_large');e.status=413;throw e}chunks.push(c)}return Buffer.concat(chunks,total)}
function parseJson(raw){try{return JSON.parse(raw.toString('utf8')||'{}')}catch{const e=new Error('invalid_json');e.status=400;throw e}}
function safeUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}
function normalizeUpstreamStatus(status,data){if(status===401)return 401;if(status===403)return 403;const msg=String(data?.message||data?.error||'');if(/authentication_required|jwt|token/i.test(msg))return 401;if(/access_required|not_allowed|scope_denied|permission|forbidden|requires_/i.test(msg))return 403;if(/not_found/i.test(msg))return 404;if(/already_exists|conflict|active_assignment_conflict|unique/i.test(msg))return 409;return status>=400&&status<500?400:502}
async function sbRpc(name,args,token){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(args||{})});const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data={message:text}}if(!r.ok){const e=new Error(data?.message||data?.error||`supabase_${r.status}`);e.status=normalizeUpstreamStatus(r.status,data);e.data=data;throw e}return data}
function requireAuth(req){const token=bearer(req);if(!token){const e=new Error('login_required');e.status=401;throw e}return token}
function assertOrigin(req){const origin=requestOrigin(req);if(origin&&!allowedOrigin(req)){const e=new Error('origin_not_allowed');e.status=403;throw e}if(REQUIRE_BROWSER_ORIGINS&&!origin){const e=new Error('origin_required');e.status=403;throw e}}
function smallText(v,max=120){return String(v??'').trim().slice(0,max)}
function finiteMoney(v){const n=Number(v);return Number.isFinite(n)?n:null}

export async function handlePortalRequest(req,res){
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(req.method==='OPTIONS'){
      assertOrigin(req);
      res.writeHead(204,{...corsHeaders(req),'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,content-type','access-control-max-age':'600'});res.end();return;
    }
    if(req.method==='GET'&&url.pathname==='/health')return json(req,res,200,{ok:true,service:'loadin-portal-api'});
    if(req.method==='GET'&&url.pathname==='/ready'){const r=readiness();return json(req,res,r.ok?200:503,r)}
    if(!configured())return json(req,res,503,{error:'portal_api_not_configured'});
    assertOrigin(req);
    const token=requireAuth(req);

    if(req.method==='GET'&&url.pathname==='/dashboard')return json(req,res,200,await sbRpc('loadin_admin_dashboard_snapshot',{},token));
    if(req.method==='GET'&&url.pathname==='/fleet/me')return json(req,res,200,await sbRpc('loadin_fleet_snapshot',{},token));
    if(req.method==='GET'&&url.pathname==='/admin/city-service-config'){
      const cityCode=smallText(url.searchParams.get('cityCode')||'CSN',24).toUpperCase();
      return json(req,res,200,await sbRpc('loadin_admin_city_service_config_snapshot',{p_city_code:cityCode},token));
    }

    const supportMatch=url.pathname.match(/^\/admin\/support\/([^/]+)\/resolve$/);
    if(req.method==='POST'&&supportMatch){
      if(!safeUuid(supportMatch[1]))return json(req,res,400,{error:'invalid_case_id'});
      const body=parseJson(await readBody(req));
      return json(req,res,200,await sbRpc('loadin_admin_resolve_support_case',{p_case_id:supportMatch[1],p_resolution_notes:String(body.notes||'Resolved by admin').slice(0,2000)},token));
    }
    if(req.method==='POST'&&url.pathname==='/admin/city-service-status'){
      const body=parseJson(await readBody(req));
      const cityCode=smallText(body.cityCode,24).toUpperCase();
      const serviceCode=smallText(body.serviceCode,80).toUpperCase();
      const status=smallText(body.status,24).toUpperCase();
      if(!cityCode||!serviceCode||!['ACTIVE','COMING_SOON','PAUSED','DISABLED'].includes(status))return json(req,res,400,{error:'invalid_city_service_request'});
      return json(req,res,200,await sbRpc('loadin_admin_set_city_service_status',{p_city_code:cityCode,p_service_code:serviceCode,p_status:status,p_reason:String(body.reason||'').slice(0,1000)||null},token));
    }
    if(req.method==='POST'&&url.pathname==='/admin/city-pricing'){
      const body=parseJson(await readBody(req));
      const cityCode=smallText(body.cityCode,24).toUpperCase();
      const serviceCode=smallText(body.serviceCode,80).toUpperCase();
      const baseFare=finiteMoney(body.baseFare),extraKmRate=finiteMoney(body.extraKmRate);
      if(!cityCode||!serviceCode||baseFare===null||extraKmRate===null||baseFare<0||extraKmRate<0)return json(req,res,400,{error:'invalid_city_pricing_request'});
      return json(req,res,200,await sbRpc('loadin_admin_set_city_pricing',{p_city_code:cityCode,p_service_code:serviceCode,p_base_fare:baseFare,p_extra_km_rate:extraKmRate,p_reason:String(body.reason||'').slice(0,1000)||null},token));
    }

    if(req.method==='POST'&&url.pathname==='/fleet/vehicles'){
      const body=parseJson(await readBody(req));
      const registrationNumber=smallText(body.registrationNumber,32);
      const vehicleType=smallText(body.vehicleType,80);
      if(!registrationNumber||!vehicleType)return json(req,res,400,{error:'registration_and_vehicle_type_required'});
      return json(req,res,201,await sbRpc('loadin_fleet_add_vehicle',{p_registration_number:registrationNumber,p_vehicle_type:vehicleType},token));
    }
    if(req.method==='POST'&&url.pathname==='/fleet/drivers'){
      const body=parseJson(await readBody(req));
      const fullName=smallText(body.fullName,120);
      const mobile=smallText(body.mobile,24)||null;
      if(!fullName)return json(req,res,400,{error:'driver_name_required'});
      return json(req,res,201,await sbRpc('loadin_fleet_add_driver',{p_full_name:fullName,p_mobile:mobile},token));
    }
    if(req.method==='POST'&&url.pathname==='/fleet/assignments'){
      const body=parseJson(await readBody(req));
      if(!safeUuid(body.vehicleId)||!safeUuid(body.driverId))return json(req,res,400,{error:'valid_vehicle_and_driver_required'});
      return json(req,res,201,await sbRpc('loadin_fleet_assign_driver',{p_vehicle_id:body.vehicleId,p_driver_id:body.driverId},token));
    }
    const endAssignment=url.pathname.match(/^\/fleet\/assignments\/([^/]+)\/end$/);
    if(req.method==='POST'&&endAssignment){
      if(!safeUuid(endAssignment[1]))return json(req,res,400,{error:'invalid_assignment_id'});
      return json(req,res,200,await sbRpc('loadin_fleet_end_assignment',{p_assignment_id:endAssignment[1]},token));
    }
    const vehicleStatus=url.pathname.match(/^\/fleet\/vehicles\/([^/]+)\/status$/);
    if(req.method==='POST'&&vehicleStatus){
      if(!safeUuid(vehicleStatus[1]))return json(req,res,400,{error:'invalid_vehicle_id'});
      const body=parseJson(await readBody(req));const status=smallText(body.status,24).toUpperCase();
      if(!['ACTIVE','INACTIVE','MAINTENANCE'].includes(status))return json(req,res,400,{error:'invalid_vehicle_status'});
      return json(req,res,200,await sbRpc('loadin_fleet_set_vehicle_status',{p_vehicle_id:vehicleStatus[1],p_status:status},token));
    }
    const driverStatus=url.pathname.match(/^\/fleet\/drivers\/([^/]+)\/status$/);
    if(req.method==='POST'&&driverStatus){
      if(!safeUuid(driverStatus[1]))return json(req,res,400,{error:'invalid_driver_id'});
      const body=parseJson(await readBody(req));const status=smallText(body.status,24).toUpperCase();
      if(!['ACTIVE','INACTIVE'].includes(status))return json(req,res,400,{error:'invalid_driver_status'});
      return json(req,res,200,await sbRpc('loadin_fleet_set_driver_status',{p_driver_id:driverStatus[1],p_status:status},token));
    }

    return json(req,res,404,{error:'not_found'});
  }catch(error){console.error(error);return json(req,res,error.status||500,{error:error.message||'portal_api_error'})}
}

export const portalReadiness=readiness;

if(process.argv.includes('--check')){
  const r=readiness();console.log(JSON.stringify(r));process.exit(r.ok?0:1);
}

const server=http.createServer(handlePortalRequest);
server.listen(PORT,'0.0.0.0',()=>console.log(`LOADIN portal API listening on :${PORT}`));
