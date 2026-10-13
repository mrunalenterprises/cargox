import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { runtimeConfig as cfg } from './runtime-config.js';

const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const apiBase=String(cfg.adminApiBase||'').replace(/\/$/,'');
const FIXED_SERVICES=[
  {code:'PARCEL_2W',name:'2-Wheeler Parcel'},
  {code:'LOADING_VEHICLE',name:'Loading Vehicle'},
  {code:'HELPER',name:'Helper'},
  {code:'FULL_SHIFTING',name:'Full Shifting'}
];
function eq(v){return `eq.${v}`}
async function api(path,body){const token=client.accessToken();if(!token)throw new Error('login_required');const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);try{const res=await fetch(`${apiBase}${path}`,{method:'POST',signal:ctrl.signal,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}if(!res.ok)throw new Error(data?.error||`portal_api_${res.status}`);return data}catch(e){if(e.name==='AbortError')throw new Error('portal_api_timeout');throw e}finally{clearTimeout(timer)}}

export const cityServiceProduction={
  services:FIXED_SERVICES,
  configured:client.configured,
  async snapshot(cityCode='CSN'){
    if(!client.configured)return {city:{code:'CSN',name:'Chhatrapati Sambhaji Nagar',enabled:true},services:FIXED_SERVICES.map((s,i)=>({...s,status:i===3?'COMING_SOON':'ACTIVE'})),demo:true};
    const cities=await client.select('operating_cities',{filters:{code:eq(cityCode)},limit:1});const city=cities?.[0];if(!city)throw new Error('city_not_found');
    const rows=await client.select('city_service_controls',{filters:{city_id:eq(city.id)},limit:20});
    const byCode=new Map((rows||[]).map(r=>[r.service_code,r]));
    return {city,services:FIXED_SERVICES.map(s=>({...s,...(byCode.get(s.code)||{}),status:byCode.get(s.code)?.status||'COMING_SOON'}))};
  },
  async setStatus({cityCode='CSN',serviceCode,status,reason=''}){
    if(!client.configured)return {city_code:cityCode,service_code:serviceCode,status,demo:true};
    if(apiBase)return api('/admin/city-service-status',{cityCode,serviceCode,status,reason});
    return client.rpc('loadin_admin_set_city_service_status',{p_city_code:cityCode,p_service_code:serviceCode,p_status:status,p_reason:reason||null});
  }
};
