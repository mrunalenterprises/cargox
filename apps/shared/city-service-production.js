import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { runtimeConfig as cfg } from './runtime-config.js';

const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const apiBase=String(cfg.adminApiBase||'').replace(/\/$/,'');
const FIXED_SERVICES=[
  {code:'PARCEL_2W',name:'2-Wheeler Parcel',demoBaseFare:35,demoExtraKmRate:8},
  {code:'LOADING_VEHICLE',name:'Loading Vehicle',demoBaseFare:180,demoExtraKmRate:18},
  {code:'HELPER',name:'Helper',demoBaseFare:250,demoExtraKmRate:0},
  {code:'FULL_SHIFTING',name:'Full Shifting',demoBaseFare:999,demoExtraKmRate:25}
];
function serviceName(code){return FIXED_SERVICES.find(x=>x.code===code)?.name||code}
async function api(path,{method='POST',body=null}={}){const token=client.accessToken();if(!token)throw new Error('login_required');const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);try{const res=await fetch(`${apiBase}${path}`,{method,signal:ctrl.signal,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:body==null?undefined:JSON.stringify(body)});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}if(!res.ok)throw new Error(data?.error||`portal_api_${res.status}`);return data}catch(e){if(e.name==='AbortError')throw new Error('portal_api_timeout');throw e}finally{clearTimeout(timer)}}
function enrich(snapshot){return {...snapshot,services:(snapshot.services||[]).map(s=>({...s,name:serviceName(s.code)}))}}

export const cityServiceProduction={
  services:FIXED_SERVICES,
  configured:client.configured,
  viaPortalApi:Boolean(apiBase),
  async snapshot(cityCode='CSN'){
    if(!client.configured)return {city:{code:'CSN',name:'Chhatrapati Sambhaji Nagar',enabled:true},services:FIXED_SERVICES.map((s,i)=>({code:s.code,name:s.name,status:i===3?'COMING_SOON':'ACTIVE',base_fare:s.demoBaseFare,extra_km_rate:s.demoExtraKmRate,commission_pct:15})),demo:true};
    const snap=apiBase?await api(`/admin/city-service-config?cityCode=${encodeURIComponent(cityCode)}`,{method:'GET'}):await client.rpc('loadin_admin_city_service_config_snapshot',{p_city_code:cityCode});
    return enrich(snap||{});
  },
  async setStatus({cityCode='CSN',serviceCode,status,reason=''}){
    if(!client.configured)return {city_code:cityCode,service_code:serviceCode,status,demo:true};
    if(apiBase)return api('/admin/city-service-status',{body:{cityCode,serviceCode,status,reason}});
    return client.rpc('loadin_admin_set_city_service_status',{p_city_code:cityCode,p_service_code:serviceCode,p_status:status,p_reason:reason||null});
  },
  async setPricing({cityCode='CSN',serviceCode,baseFare,extraKmRate,reason=''}){
    if(!client.configured)return {city_code:cityCode,service_code:serviceCode,base_fare:Number(baseFare),extra_km_rate:Number(extraKmRate),commission_pct:15,demo:true};
    if(apiBase)return api('/admin/city-pricing',{body:{cityCode,serviceCode,baseFare:Number(baseFare),extraKmRate:Number(extraKmRate),reason}});
    return client.rpc('loadin_admin_set_city_pricing',{p_city_code:cityCode,p_service_code:serviceCode,p_base_fare:Number(baseFare),p_extra_km_rate:Number(extraKmRate),p_reason:reason||null});
  }
};
