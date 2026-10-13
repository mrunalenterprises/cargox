const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const superAdminUserId=String(process.env.LOADIN_SUPER_ADMIN_USER_ID||'').trim();
const superAdminName=String(process.env.LOADIN_SUPER_ADMIN_NAME||'LOADIN Super Admin').trim();
const cityCode=String(process.env.LOADIN_CITY_CODE||'CSN').trim().toUpperCase();
const cityName=String(process.env.LOADIN_CITY_NAME||'Chhatrapati Sambhaji Nagar').trim();
const stateName=String(process.env.LOADIN_STATE_NAME||'Maharashtra').trim();
const initialStatus=String(process.env.LOADIN_INITIAL_SERVICE_STATUS||'COMING_SOON').trim().toUpperCase();
const dryRun=process.argv.includes('--dry-run');
const checkOnly=process.argv.includes('--check');
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const services=['PARCEL_2W','LOADING_VEHICLE','HELPER','FULL_SHIFTING'];

function readiness(){const checks={supabaseUrl:Boolean(base),serviceRole:Boolean(serviceKey),superAdminUserId:uuidRe.test(superAdminUserId),serviceStatus:['ACTIVE','COMING_SOON','PAUSED','DISABLED'].includes(initialStatus)};return {ok:Object.values(checks).every(Boolean),checks,cityCode,cityName,initialStatus,dryRun}}
function headers(extra={}){return {apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'content-type':'application/json',...extra}}
async function request(path,{method='GET',body,prefer}={}){const res=await fetch(`${base}${path}`,{method,headers:headers(prefer?{Prefer:prefer}:{}),body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!res.ok)throw new Error(typeof data==='string'?data:data?.message||data?.error||`http_${res.status}`);return data}
async function rpc(name,args){return request(`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',body:args})}

const r=readiness();
if(checkOnly){console.log(JSON.stringify(r));process.exit(r.ok?0:2)}
if(!r.ok){console.error(JSON.stringify(r));process.exit(2)}
if(dryRun){console.log(JSON.stringify({ok:true,dryRun:true,plan:{superAdminUserId,superAdminName,cityCode,cityName,stateName,initialStatus,services}},null,2));process.exit(0)}

const admin=await rpc('loadin_bootstrap_super_admin',{p_user_id:superAdminUserId,p_display_name:superAdminName,p_reason:'Production bootstrap script'});
const cityRows=await request('/rest/v1/operating_cities?on_conflict=code',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:[{code:cityCode,name:cityName,state_name:stateName,country_code:'IN',enabled:true,allow_outstation_drop:true,timezone:'Asia/Kolkata'}]});
const city=Array.isArray(cityRows)?cityRows[0]:cityRows;
if(!city?.id)throw new Error('bootstrap_city_id_missing');
const controls=services.map(service_code=>({city_id:city.id,service_code,status:initialStatus,schedule_enabled:true,recurring_enabled:true,return_load_enabled:service_code==='LOADING_VEHICLE',notes:'Seeded by production bootstrap'}));
await request('/rest/v1/city_service_controls?on_conflict=city_id,service_code',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:controls});
console.log(JSON.stringify({ok:true,superAdmin:{userId:admin?.user_id||superAdminUserId,role:admin?.role||'SUPER_ADMIN'},city:{id:city.id,code:city.code,name:city.name,enabled:city.enabled},services:controls.map(x=>({serviceCode:x.service_code,status:x.status}))},null,2));
